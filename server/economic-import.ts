import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Integration } from "@shared/schema";
import { economicImportFiles, economicImportRecords, economicImportRuns } from "@shared/schema";
import { archiveBucketConfig, checkArchiveBucket } from "./bookkeeping-archive-readiness";
import { storeLockedArchiveObject } from "./bookkeeping-archive-object";
import { db } from "./storage";

const REST_BASE = "https://restapi.e-conomic.com";
const DOCUMENTS_BASE = "https://apis.e-conomic.com/documentsapi/v4.0.2";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PAGES = 10_000;

type JsonObject = Record<string, any>;

export type EconomicCoverage = {
  key: string;
  label: string;
  count: number | null;
  status: "klar" | "tom" | "mangler_adgang" | "fejl";
  required: boolean;
  message?: string;
};

export type EconomicManifest = {
  version: 1;
  readOnly: true;
  accountingYear: string;
  period: { fromDate: string; toDate: string; retainUntil: string };
  agreement: { agreementNumber: string | null; companyName: string | null };
  coverage: EconomicCoverage[];
  warnings: string[];
  counts: Record<string, number>;
  files: Record<string, number>;
  completedAt?: string;
};

class EconomicApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function apiHeaders(integration: Integration): Record<string, string> {
  return {
    "X-AppSecretToken": integration.apiKey || "",
    "X-AgreementGrantToken": integration.apiSecret || "",
    Accept: "application/json",
  };
}

function assertReady(integration: Integration): void {
  if (integration.provider !== "e-conomic") throw new Error("Den valgte integration er ikke e-conomic.");
  if (!integration.apiKey || !integration.apiSecret) {
    throw new Error("e-conomic mangler AppSecretToken eller AgreementGrantToken.");
  }
}

function allowedUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") throw new Error("e-conomic-linket bruger ikke HTTPS.");
  if (!["restapi.e-conomic.com", "apis.e-conomic.com"].includes(parsed.hostname)) {
    throw new Error("e-conomic returnerede et link til et ukendt domæne.");
  }
  return parsed.toString();
}

async function economicFetch(integration: Integration, rawUrl: string, accept = "application/json"): Promise<Response> {
  const url = allowedUrl(rawUrl);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { ...apiHeaders(integration), Accept: accept },
        signal: controller.signal,
      });
      if (response.status === 429 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        const body = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
        throw new EconomicApiError(response.status, `e-conomic svarede ${response.status}${body ? `: ${body}` : ""}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof EconomicApiError || attempt === 2) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("e-conomic kunne ikke nås.");
}

async function getJson(integration: Integration, url: string): Promise<JsonObject> {
  return await (await economicFetch(integration, url)).json() as JsonObject;
}

function withPageSize(rawUrl: string): string {
  const url = new URL(allowedUrl(rawUrl));
  if (url.hostname === "restapi.e-conomic.com") url.searchParams.set("pagesize", "1000");
  return url.toString();
}

async function legacyCollection(integration: Integration, firstUrl: string): Promise<JsonObject[]> {
  const records: JsonObject[] = [];
  const seen = new Set<string>();
  let next: string | null = withPageSize(firstUrl);
  for (let page = 0; next && page < MAX_PAGES; page += 1) {
    next = allowedUrl(next);
    if (seen.has(next)) throw new Error("e-conomic returnerede en gentaget side under importen.");
    seen.add(next);
    const body = await getJson(integration, next);
    if (Array.isArray(body.collection)) records.push(...body.collection);
    next = typeof body.pagination?.nextPage === "string" ? body.pagination.nextPage : null;
  }
  if (next) throw new Error("e-conomic-importen overskred den sikre sidegrænse.");
  return records;
}

async function cursorCollection(integration: Integration, firstUrl: string): Promise<JsonObject[]> {
  const records: JsonObject[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(allowedUrl(firstUrl));
    if (cursor) url.searchParams.set("cursor", cursor);
    const body = await getJson(integration, url.toString());
    if (Array.isArray(body.items)) records.push(...body.items);
    const nextCursor = typeof body.cursor === "string" && body.cursor ? body.cursor : null;
    if (!nextCursor) return records;
    if (seen.has(nextCursor)) throw new Error("e-conomic returnerede en gentaget dokumentmarkør.");
    seen.add(nextCursor);
    cursor = nextCursor;
  }
  throw new Error("Dokumentimporten overskred den sikre sidegrænse.");
}

async function legacyCount(integration: Integration, rawUrl: string): Promise<number> {
  const url = new URL(allowedUrl(rawUrl));
  url.searchParams.set("pagesize", "1");
  const body = await getJson(integration, url.toString());
  return Number(body.pagination?.results ?? (Array.isArray(body.collection) ? body.collection.length : 0));
}

async function documentCount(integration: Integration, accountingYear: string): Promise<number> {
  const url = new URL(`${DOCUMENTS_BASE}/AttachedDocuments/count`);
  url.searchParams.set("filter", `accountingYear$eq:${accountingYear}`);
  const body: any = await getJson(integration, url.toString());
  return Number(body?.count ?? body?.value ?? body?.total ?? (typeof body === "number" ? body : 0));
}

async function accountingYear(integration: Integration, year: string): Promise<JsonObject> {
  const years = await legacyCollection(integration, `${REST_BASE}/accounting-years`);
  const found = years.find((item) => String(item.year) === year);
  if (!found) throw new Error(`Regnskabsåret ${year} findes ikke i e-conomic.`);
  return found;
}

function invoiceUrl(fromDate: string, toDate: string): string {
  const url = new URL(`${REST_BASE}/invoices/booked`);
  url.searchParams.set("filter", `date$gte:${fromDate}$and:date$lte:${toDate}`);
  return url.toString();
}

function retentionAfter(toDate: string): string {
  const date = new Date(`${toDate}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) throw new Error("e-conomic returnerede en ugyldig slutdato.");
  date.setUTCFullYear(date.getUTCFullYear() + 5);
  return date.toISOString();
}

function coverageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status: EconomicCoverage["status"] = error instanceof EconomicApiError && [401, 403].includes(error.status)
    ? "mangler_adgang" : "fejl";
  return { status, message };
}

export async function inspectEconomicYear(integration: Integration, yearValue: string): Promise<EconomicManifest> {
  assertReady(integration);
  const self = await getJson(integration, `${REST_BASE}/self`);
  const year = await accountingYear(integration, yearValue);
  const fromDate = String(year.fromDate || `${yearValue}-01-01`);
  const toDate = String(year.toDate || `${yearValue}-12-31`);
  const checks: Array<{ key: string; label: string; required: boolean; url?: string; count?: () => Promise<number> }> = [
    { key: "accounts", label: "Kontoplan", required: true, url: `${REST_BASE}/accounts` },
    { key: "entries", label: "Bogførte posteringer", required: true, url: year.entries },
    { key: "totals", label: "Kontosaldi", required: true, url: year.totals },
    { key: "periods", label: "Regnskabsperioder", required: true, url: year.periods },
    { key: "customers", label: "Kunder", required: true, url: `${REST_BASE}/customers` },
    { key: "suppliers", label: "Leverandører", required: true, url: `${REST_BASE}/suppliers` },
    { key: "products", label: "Produkter og ydelser", required: false, url: `${REST_BASE}/products` },
    { key: "vatAccounts", label: "Momskoder", required: true, url: `${REST_BASE}/vat-accounts` },
    { key: "invoices", label: "Bogførte salgsfakturaer", required: true, url: invoiceUrl(fromDate, toDate) },
    { key: "documents", label: "Bilag og vedhæftede dokumenter", required: true, count: () => documentCount(integration, yearValue) },
    { key: "fiveYearArchive", label: "Låst femårsarkiv", required: true, count: async () => {
      const config = archiveBucketConfig();
      await checkArchiveBucket(config);
      if (!process.env.ARCHIVE_ENCRYPTION_KEY) throw new Error("ARCHIVE_ENCRYPTION_KEY mangler; femårsarkivet er ikke klar.");
      return 1;
    } },
  ];
  const coverage: EconomicCoverage[] = [];
  const warnings: string[] = [];
  for (const check of checks) {
    try {
      const count = check.count ? await check.count() : await legacyCount(integration, check.url!);
      coverage.push({ key: check.key, label: check.label, count, required: check.required, status: count > 0 ? "klar" : "tom" });
    } catch (error) {
      const mapped = coverageError(error);
      coverage.push({ key: check.key, label: check.label, count: null, required: check.required, ...mapped });
      warnings.push(`${check.label}: ${mapped.message}`);
    }
  }
  return {
    version: 1,
    readOnly: true,
    accountingYear: yearValue,
    period: { fromDate, toDate, retainUntil: retentionAfter(toDate) },
    agreement: {
      agreementNumber: self.agreementNumber ? String(self.agreementNumber) : null,
      companyName: self.company?.name ? String(self.company.name) : null,
    },
    coverage,
    warnings,
    counts: Object.fromEntries(coverage.map((item) => [item.key, item.count ?? 0])),
    files: {},
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }

function externalId(resourceType: string, value: JsonObject, index: number): string {
  const candidates = [value.self, value.number, value.id, value.accountNumber, value.customerNumber,
    value.supplierNumber, value.productNumber, value.bookedInvoiceNumber,
    value.entryNumber && `${value.entryNumber}:${value.voucherNumber ?? ""}:${value.account?.accountNumber ?? ""}`];
  const found = candidates.find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
  return found ? String(found) : `${resourceType}:${index}:${sha256(stableJson(value)).slice(0, 16)}`;
}

function storeRecords(companyId: number, runId: number, year: string, resourceType: string, values: JsonObject[]): void {
  const fetchedAt = new Date().toISOString();
  db.transaction((tx) => values.forEach((value, index) => {
    const payloadJson = stableJson(value);
    tx.insert(economicImportRecords).values({ companyId, runId, accountingYear: year, resourceType,
      externalId: externalId(resourceType, value, index), payloadJson, checksum: sha256(payloadJson), fetchedAt }).run();
  }));
}

function safeName(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120); }

async function archiveBytes(args: {
  companyId: number; runId: number; year: string; fiscalYearStart: string; retainUntil: string;
  resourceType: string; externalId: string; voucherNumber?: string; extension: "json" | "pdf";
  mimeType: string; plain: Buffer;
}) {
  const config = archiveBucketConfig();
  const secret = process.env.ARCHIVE_ENCRYPTION_KEY || "";
  const checksum = sha256(args.plain);
  const key = `companies/${args.companyId}/fiscal-years/${args.fiscalYearStart}/economic/${args.runId}/`+
    `${safeName(args.resourceType)}-${safeName(args.externalId)}-${checksum.slice(0, 16)}.${args.extension}`;
  const receipt = await storeLockedArchiveObject({ config, key, plain: args.plain,
    retainUntil: args.retainUntil, encryptionSecret: secret });
  db.insert(economicImportFiles).values({
    companyId: args.companyId, runId: args.runId, accountingYear: args.year,
    resourceType: args.resourceType, externalId: args.externalId, voucherNumber: args.voucherNumber ?? null,
    fileName: key.split("/").at(-1)!, mimeType: args.mimeType, sizeBytes: receipt.plainBytes,
    checksum: receipt.sha256, archiveBucket: receipt.bucket, archiveObjectKey: receipt.objectKey,
    archiveVersionId: receipt.versionId, retainUntil: receipt.retainUntil, verified: receipt.verified,
    fetchedAt: new Date().toISOString(),
  }).run();
}

async function archivePdf(args: Omit<Parameters<typeof archiveBytes>[0], "extension" | "mimeType" | "plain"> & {
  integration: Integration; url: string;
}) {
  const response = await economicFetch(args.integration, args.url, "application/pdf");
  const plain = Buffer.from(await response.arrayBuffer());
  if (plain.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Filen fra e-conomic var ikke en gyldig PDF.");
  await archiveBytes({ ...args, extension: "pdf", mimeType: "application/pdf", plain });
}

export async function createEconomicSnapshot(args: {
  integration: Integration; companyId: number; runId: number; accountingYear: string;
}): Promise<EconomicManifest> {
  const { integration, companyId, runId, accountingYear: yearValue } = args;
  let manifest: EconomicManifest | undefined;
  try {
    manifest = await inspectEconomicYear(integration, yearValue);
    const archiveProblem = manifest.coverage.find((item) => item.key === "fiveYearArchive" && item.status !== "klar");
    if (archiveProblem) throw new Error(archiveProblem.message || "Femårsarkivet er ikke klar.");
    db.update(economicImportRuns).set({ status: "koerer",
      sourceAgreementNumber: manifest.agreement.agreementNumber, sourceCompanyName: manifest.agreement.companyName,
      manifestJson: JSON.stringify(manifest) }).where(eq(economicImportRuns.id, runId)).run();

    const year = await accountingYear(integration, yearValue);
    const resourceUrls: Array<[string, string]> = [
      ["accountingYear", String(year.self)], ["periods", String(year.periods)], ["entries", String(year.entries)],
      ["totals", String(year.totals)], ["accounts", `${REST_BASE}/accounts`], ["customers", `${REST_BASE}/customers`],
      ["suppliers", `${REST_BASE}/suppliers`], ["products", `${REST_BASE}/products`], ["vatAccounts", `${REST_BASE}/vat-accounts`],
      ["units", `${REST_BASE}/units`], ["paymentTerms", `${REST_BASE}/payment-terms`], ["customerGroups", `${REST_BASE}/customer-groups`],
      ["supplierGroups", `${REST_BASE}/supplier-groups`], ["departments", `${REST_BASE}/departments`],
      ["departmentalDistributions", `${REST_BASE}/departmental-distributions`],
      ["invoices", invoiceUrl(manifest.period.fromDate, manifest.period.toDate)],
    ];
    const counts: Record<string, number> = {};
    const warnings = [...manifest.warnings];
    const resources = new Map<string, JsonObject[]>();
    let archivedResourceFiles = 0;
    for (const [resourceType, url] of resourceUrls) {
      try {
        const values = resourceType === "accountingYear" ? [await getJson(integration, url)] : await legacyCollection(integration, url);
        resources.set(resourceType, values);
        storeRecords(companyId, runId, yearValue, resourceType, values);
        counts[resourceType] = values.length;
        await archiveBytes({ companyId, runId, year: yearValue, fiscalYearStart: manifest.period.fromDate,
          retainUntil: manifest.period.retainUntil, resourceType: "resource_json", externalId: resourceType,
          extension: "json", mimeType: "application/json", plain: Buffer.from(stableJson(values)) });
        archivedResourceFiles += 1;
      } catch (error) {
        warnings.push(`${resourceType}: ${error instanceof Error ? error.message : String(error)}`);
        counts[resourceType] = 0;
      }
    }

    let invoicePdfCount = 0;
    for (const invoice of resources.get("invoices") ?? []) {
      try {
        let detail = invoice;
        if (!detail.pdf?.download && typeof detail.self === "string") detail = await getJson(integration, detail.self);
        if (typeof detail.pdf?.download !== "string") continue;
        const number = String(detail.bookedInvoiceNumber ?? invoice.bookedInvoiceNumber ?? "ukendt");
        await archivePdf({ integration, url: detail.pdf.download, companyId, runId, year: yearValue,
          fiscalYearStart: manifest.period.fromDate, retainUntil: manifest.period.retainUntil,
          resourceType: "booked_invoice_pdf", externalId: number,
          voucherNumber: detail.voucherNumber ? String(detail.voucherNumber) : undefined });
        invoicePdfCount += 1;
      } catch (error) { warnings.push(`Faktura-PDF: ${error instanceof Error ? error.message : String(error)}`); }
    }

    let voucherPdfCount = 0;
    try {
      const url = new URL(`${DOCUMENTS_BASE}/AttachedDocuments`);
      url.searchParams.set("filter", `accountingYear$eq:${yearValue}`);
      const documents = await cursorCollection(integration, url.toString());
      storeRecords(companyId, runId, yearValue, "voucherDocuments", documents);
      counts.voucherDocuments = documents.length;
      await archiveBytes({ companyId, runId, year: yearValue, fiscalYearStart: manifest.period.fromDate,
        retainUntil: manifest.period.retainUntil, resourceType: "resource_json", externalId: "voucherDocuments",
        extension: "json", mimeType: "application/json", plain: Buffer.from(stableJson(documents)) });
      archivedResourceFiles += 1;
      for (const document of documents) {
        try {
          const number = String(document.number);
          await archivePdf({ integration, url: `${DOCUMENTS_BASE}/AttachedDocuments/${encodeURIComponent(number)}/pdf`,
            companyId, runId, year: yearValue, fiscalYearStart: manifest.period.fromDate,
            retainUntil: manifest.period.retainUntil, resourceType: "voucher_document", externalId: number,
            voucherNumber: document.voucherNumber ? String(document.voucherNumber) : undefined });
          voucherPdfCount += 1;
        } catch (error) { warnings.push(`Bilag ${document.number ?? "ukendt"}: ${error instanceof Error ? error.message : String(error)}`); }
      }
    } catch (error) {
      warnings.push(`Bilagsarkiv: ${error instanceof Error ? error.message : String(error)}`);
      counts.voucherDocuments = 0;
    }

    const recordCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const fileCount = archivedResourceFiles + invoicePdfCount + voucherPdfCount;
    manifest = { ...manifest, counts,
      files: { resourceJson: archivedResourceFiles, bookedInvoicePdfs: invoicePdfCount, voucherDocuments: voucherPdfCount },
      warnings, completedAt: new Date().toISOString() };
    const requiredFailures = manifest.coverage.filter((item) => item.required && ["fejl", "mangler_adgang"].includes(item.status));
    db.update(economicImportRuns).set({ status: requiredFailures.length || warnings.length ? "delvis" : "faerdig",
      recordCount, fileCount, warningCount: warnings.length, manifestJson: JSON.stringify(manifest),
      finishedAt: manifest.completedAt, errorMessage: null }).where(eq(economicImportRuns.id, runId)).run();
    return manifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db.update(economicImportRuns).set({ status: "fejlet", errorMessage: message,
      manifestJson: JSON.stringify(manifest ?? {}), finishedAt: new Date().toISOString() })
      .where(eq(economicImportRuns.id, runId)).run();
    throw error;
  }
}

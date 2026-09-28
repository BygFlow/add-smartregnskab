import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { einvoiceQueue } from "@shared/schema";
import { db, storage } from "./storage";

type GatewayIdentity = { product: string; sourceTenantId: string; cvr: string; active: boolean; receiveEnabled: boolean };
type GatewayDocument = { id: number; sourceId: string; providerMessageId: string | null; direction: string;
  format: string; documentType: string; sha256: string; status: string; error: string | null };

function keys(): Record<string, string> {
  try {
    const value = JSON.parse(process.env.EDI_GATEWAY_KEYS_JSON || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function gatewayConfiguredForCompany(companyId: number): boolean {
  return Boolean(process.env.EDI_GATEWAY_URL && keys()[String(companyId)]);
}

function connection(companyId: number) {
  const raw = process.env.EDI_GATEWAY_URL || "";
  const key = keys()[String(companyId)];
  if (!raw || !/^edi_[a-f0-9]{64}$/.test(String(key || ""))) throw new Error("EDI-gatewayen er ikke konfigureret for virksomheden.");
  const base = new URL(raw);
  if (base.protocol !== "https:" && !(process.env.NODE_ENV === "test" && base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname))) {
    throw new Error("EDI-gatewayen kræver HTTPS.");
  }
  return { base, key };
}

async function gatewayRequest(base: URL, key: string, path: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(new URL(path, base), { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal, redirect: "manual" });
    if (!response.ok) throw new Error(`EDI-gatewayen svarede ${response.status}.`);
    return response;
  } finally { clearTimeout(timer); }
}

function firstXmlValue(xml: string, name: string): string | null {
  return xml.match(new RegExp(`<cbc:${name}(?:\\s[^>]*)?>([^<]*)</cbc:${name}>`))?.[1] || null;
}

export async function syncGatewayInboundForCompany(companyId: number): Promise<number> {
  const { base, key } = connection(companyId);
  const company = await storage.getCompany(companyId);
  if (!company) throw new Error("Regnskabsvirksomheden findes ikke.");
  const identity = await (await gatewayRequest(base, key, "/api/edi-gateway/me")).json() as GatewayIdentity;
  const cvr = String(company.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
  if (identity.product !== "smartregnskab" || identity.sourceTenantId !== String(companyId) || identity.cvr !== cvr) {
    throw new Error("EDI-nøglen tilhører ikke denne regnskabsvirksomhed.");
  }
  if (!identity.active || !identity.receiveEnabled) return 0;

  let imported = 0;
  let afterId = 0;
  for (let page = 0; page < 100; page++) {
    const rows = await (await gatewayRequest(base, key, `/api/edi-gateway/inbound?afterId=${afterId}&limit=100`)).json() as GatewayDocument[];
    if (!Array.isArray(rows)) throw new Error("EDI-gatewayen svarede med en ugyldig dokumentliste.");
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id <= afterId || row.direction !== "inbound" || !row.providerMessageId || !/^[a-f0-9]{64}$/.test(row.sha256)) {
        throw new Error("EDI-gatewayen svarede med ugyldige dokumentoplysninger.");
      }
      afterId = row.id;
      const existing = db.select().from(einvoiceQueue).where(and(eq(einvoiceQueue.companyId, companyId), eq(einvoiceQueue.providerMessageId, row.providerMessageId))).get();
      if (existing) continue;
      const response = await gatewayRequest(base, key, `/api/edi-gateway/inbound/${row.id}/xml`);
      const content = Buffer.from(await response.arrayBuffer());
      if (content.length > 10 * 1024 * 1024) throw new Error("EDI-dokumentet er for stort.");
      if (createHash("sha256").update(content).digest("hex") !== row.sha256) throw new Error("EDI-dokumentets kontrolsum stemmer ikke.");
      const xml = content.toString("utf8");
      const amount = Number(firstXmlValue(xml, "PayableAmount"));
      const valid = row.status === "received";
      const created = db.insert(einvoiceQueue).values({ companyId, direction: "indgående", invoiceNumber: firstXmlValue(xml, "ID"),
        amount: Number.isFinite(amount) ? amount : null, format: row.format, documentType: row.documentType,
        validationStatus: valid ? "godkendt" : "afvist", validationErrors: valid ? null : JSON.stringify([row.error || "EDI-dokumentet er ikke valideret."]),
        routingStatus: "modtaget_fra_gateway", status: valid ? "modtaget" : "afvist", payloadXml: xml,
        providerMessageId: row.providerMessageId, responseType: "modtaget", receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      }).onConflictDoNothing({ target: [einvoiceQueue.companyId, einvoiceQueue.providerMessageId] }).returning().get();
      if (created) imported++;
    }
    if (rows.length < 100) return imported;
  }
  throw new Error("EDI-synkroniseringen overskred 10.000 dokumenter; kræver manuel afklaring.");
}

export async function syncAllGatewayInbound(): Promise<{ imported: number; companies: number; failed: number }> {
  let imported = 0, companies = 0, failed = 0;
  for (const id of Object.keys(keys())) {
    const companyId = Number(id);
    if (!Number.isSafeInteger(companyId) || companyId < 1) { failed++; continue; }
    companies++;
    try { imported += await syncGatewayInboundForCompany(companyId); }
    catch (error) {
      failed++;
      console.error(`EDI-synkronisering fejlede for virksomhed ${companyId}:`, error instanceof Error ? error.message : "Ukendt fejl");
    }
  }
  return { imported, companies, failed };
}

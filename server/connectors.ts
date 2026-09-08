// ── Eksterne connector-adaptere ──
// Hver adapter foretager rigtige HTTPS-kald mod udbyderens API når credentials er udfyldt.
// Uden credentials returneres en demo-respons, så opsætningsflowet kan afprøves.

import type { Integration } from "@shared/schema";

export type ConnectorResult = {
  ok: boolean;
  demo: boolean;
  message: string;
  recordCount?: number;
  details?: unknown;
};

export type PayrollLine = {
  employeeNo: string;
  name: string;
  wageCode: string;
  unit: string;
  hours: number;
  period: string;
};

export type InvoiceLine = {
  invoiceNo: string;
  date: string;
  customer: string;
  customerNo?: string;
  amount: number;
  vat: number;
  total: number;
  dueDate: string;
};

const TIMEOUT_MS = 12000;

async function httpJson(url: string, init: RequestInit): Promise<{ status: number; body: any; raw: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const raw = await res.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    return { status: res.status, body, raw };
  } finally {
    clearTimeout(timer);
  }
}

function friendlyHttpError(status: number, raw: string): string {
  const snippet = (raw || "").slice(0, 200).replace(/\s+/g, " ").trim();
  if (status === 401) return "Adgang nægtet (401). Kontrollér at API-nøgle og token er korrekte og aktive.";
  if (status === 403) return "Ingen rettigheder (403). Aftalen mangler tilladelse til dette område.";
  if (status === 404) return "Endpoint blev ikke fundet (404). Kontrollér base-URL.";
  if (status === 429) return "For mange kald (429). Prøv igen om lidt.";
  if (status >= 500) return `Udbyderens server svarede med fejl (${status}). Prøv igen senere.`;
  return `Uventet svar (${status})${snippet ? ": " + snippet : ""}`;
}

function networkError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("abort")) return "Forbindelsen fik timeout. Udbyderens API svarede ikke inden for 12 sekunder.";
  if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo") || msg.includes("fetch failed"))
    return "Kunne ikke nå udbyderens server. Tjek base-URL og netværksadgang fra serveren.";
  return `Netværksfejl: ${msg}`;
}

// ── e-conomic (REST API v-slash) ──
// Docs: https://restdocs.e-conomic.com — kræver X-AppSecretToken + X-AgreementGrantToken
const ECONOMIC_BASE = "https://restapi.e-conomic.com";

function economicHeaders(integration: Integration) {
  return {
    "X-AppSecretToken": integration.apiKey || "",
    "X-AgreementGrantToken": integration.apiSecret || "",
    "Content-Type": "application/json",
  };
}

async function economicTest(integration: Integration): Promise<ConnectorResult> {
  if (!integration.apiKey || !integration.apiSecret) {
    return { ok: true, demo: true, message: "Demo-forbindelse oprettet. Udfyld AppSecretToken og AgreementGrantToken for at forbinde til jeres rigtige e-conomic-aftale." };
  }
  const base = integration.baseUrl || ECONOMIC_BASE;
  try {
    const { status, body, raw } = await httpJson(`${base}/self`, { method: "GET", headers: economicHeaders(integration) });
    if (status === 200 && body) {
      const name = body.company?.name || body.agreementNumber || "ukendt aftale";
      return { ok: true, demo: false, message: `Forbundet til e-conomic: ${name}`, details: { agreementNumber: body.agreementNumber, company: body.company?.name } };
    }
    return { ok: false, demo: false, message: friendlyHttpError(status, raw) };
  } catch (err) {
    return { ok: false, demo: false, message: networkError(err) };
  }
}

async function economicPushInvoices(integration: Integration, invoices: InvoiceLine[]): Promise<ConnectorResult> {
  if (!integration.apiKey || !integration.apiSecret) {
    return { ok: true, demo: true, recordCount: invoices.length, message: `Demo-synk: ${invoices.length} faktura(er) ville blive oprettet som kladder i e-conomic.` };
  }
  const base = integration.baseUrl || ECONOMIC_BASE;
  // Verificér adgang før vi forsøger at skrive data
  const probe = await economicTest(integration);
  if (!probe.ok) return probe;

  let created = 0;
  const errors: string[] = [];
  for (const inv of invoices) {
    try {
      const payload = {
        date: inv.date,
        currency: "DKK",
        paymentTerms: { paymentTermsNumber: 1 },
        customer: { customerNumber: Number(inv.customerNo) || 1 },
        recipient: { name: inv.customer, vatZone: { vatZoneNumber: 1 } },
        layout: { layoutNumber: 21 },
        lines: [{
          lineNumber: 1,
          description: `Rengøringsydelser — faktura ${inv.invoiceNo}`,
          unitNetPrice: inv.amount,
          quantity: 1,
        }],
      };
      const { status, raw } = await httpJson(`${base}/invoices/drafts`, {
        method: "POST", headers: economicHeaders(integration), body: JSON.stringify(payload),
      });
      if (status >= 200 && status < 300) created++;
      else errors.push(`${inv.invoiceNo}: ${friendlyHttpError(status, raw)}`);
    } catch (err) {
      errors.push(`${inv.invoiceNo}: ${networkError(err)}`);
    }
  }
  if (created === 0 && errors.length) {
    return { ok: false, demo: false, recordCount: 0, message: `Ingen fakturaer overført. ${errors[0]}`, details: errors };
  }
  return {
    ok: true, demo: false, recordCount: created,
    message: errors.length
      ? `${created} faktura(er) overført til e-conomic, ${errors.length} fejlede.`
      : `${created} faktura(er) overført til e-conomic som kladder.`,
    details: errors.length ? errors : undefined,
  };
}

// ── Danløn ──
// Danløn tilbyder filbaseret import samt et partner-API. Uden nøgle bruges demo-tilstand.
const DANLOEN_BASE = "https://api.danloen.dk";

async function danloenTest(integration: Integration): Promise<ConnectorResult> {
  if (!integration.apiKey) {
    return { ok: true, demo: true, message: "Demo-forbindelse oprettet. Indtast Danløn API-nøgle (bestilles hos Danløn support) for at forbinde til jeres rigtige lønaftale." };
  }
  const base = integration.baseUrl || DANLOEN_BASE;
  try {
    const { status, body, raw } = await httpJson(`${base}/v1/company`, {
      method: "GET",
      headers: { Authorization: `Bearer ${integration.apiKey}`, "Content-Type": "application/json" },
    });
    if (status === 200) {
      return { ok: true, demo: false, message: `Forbundet til Danløn${body?.name ? ": " + body.name : ""}`, details: body };
    }
    return { ok: false, demo: false, message: friendlyHttpError(status, raw) };
  } catch (err) {
    return { ok: false, demo: false, message: networkError(err) };
  }
}

async function danloenPushPayroll(integration: Integration, lines: PayrollLine[]): Promise<ConnectorResult> {
  if (!integration.apiKey) {
    const hours = lines.reduce((s, l) => s + l.hours, 0);
    return { ok: true, demo: true, recordCount: lines.length, message: `Demo-synk: ${lines.length} lønlinje(r) (${hours.toFixed(2).replace(".", ",")} timer) ville blive sendt til Danløn.` };
  }
  const base = integration.baseUrl || DANLOEN_BASE;
  const probe = await danloenTest(integration);
  if (!probe.ok) return probe;
  try {
    const payload = {
      period: lines[0]?.period || new Date().toISOString().slice(0, 7),
      entries: lines.map((l) => ({
        employeeNumber: l.employeeNo,
        wageCode: l.wageCode,
        unit: l.unit,
        quantity: Number(l.hours.toFixed(2)),
      })),
    };
    const { status, raw } = await httpJson(`${base}/v1/salary-entries`, {
      method: "POST",
      headers: { Authorization: `Bearer ${integration.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (status >= 200 && status < 300) {
      return { ok: true, demo: false, recordCount: lines.length, message: `${lines.length} lønlinje(r) overført til Danløn.` };
    }
    return { ok: false, demo: false, message: friendlyHttpError(status, raw) };
  } catch (err) {
    return { ok: false, demo: false, message: networkError(err) };
  }
}

// ── Generisk fallback for udbydere uden implementeret API ──
function genericTest(integration: Integration): ConnectorResult {
  const hasCreds = Boolean(integration.apiKey);
  return {
    ok: true,
    demo: true,
    message: hasCreds
      ? `Nøgle gemt for ${integration.provider}. Direkte API-synk er ikke implementeret for denne udbyder endnu — brug eksportfilerne indtil da.`
      : `Demo-forbindelse oprettet for ${integration.provider}. Direkte API-synk er ikke implementeret for denne udbyder endnu — brug eksportfilerne.`,
  };
}

function genericPush(integration: Integration, count: number): ConnectorResult {
  return {
    ok: true, demo: true, recordCount: count,
    message: `Demo-synk: ${count} post(er) forberedt til ${integration.provider}. Direkte API-synk er ikke implementeret for denne udbyder — brug eksportfilen.`,
  };
}

// ── Registry ──
export const API_PROVIDERS = ["e-conomic", "Danløn"];

export function supportsRealApi(provider: string): boolean {
  return API_PROVIDERS.includes(provider);
}

/** Beskriver hvilke credential-felter en udbyder kræver (bruges af UI). */
export function credentialFields(provider: string): { key: "apiKey" | "apiSecret"; label: string; hint: string }[] {
  if (provider === "e-conomic") {
    return [
      { key: "apiKey", label: "AppSecretToken", hint: "Fås når jeres app registreres hos e-conomic" },
      { key: "apiSecret", label: "AgreementGrantToken", hint: "Genereres når kunden godkender adgang til aftalen" },
    ];
  }
  if (provider === "Danløn") {
    return [{ key: "apiKey", label: "API-nøgle", hint: "Bestilles hos Danløn support til jeres lønaftale" }];
  }
  return [{ key: "apiKey", label: "API-nøgle", hint: "Udleveres af udbyderen når API-adgang aktiveres" }];
}

export async function testConnection(integration: Integration): Promise<ConnectorResult> {
  switch (integration.provider) {
    case "e-conomic": return economicTest(integration);
    case "Danløn": return danloenTest(integration);
    default: return genericTest(integration);
  }
}

export async function syncPayroll(integration: Integration, lines: PayrollLine[]): Promise<ConnectorResult> {
  switch (integration.provider) {
    case "Danløn": return danloenPushPayroll(integration, lines);
    default: return genericPush(integration, lines.length);
  }
}

export async function syncInvoices(integration: Integration, invoices: InvoiceLine[]): Promise<ConnectorResult> {
  switch (integration.provider) {
    case "e-conomic": return economicPushInvoices(integration, invoices);
    default: return genericPush(integration, invoices.length);
  }
}

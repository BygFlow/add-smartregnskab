import { and, eq, ne } from "drizzle-orm";
import { sproomChildCompanies } from "@shared/schema";
import { db } from "./storage";

export const SPROOM_PRODUCTS = ["add_smartregnskab", "smartdrift_pro", "smartdrift_clean", "external"] as const;
export type SproomProduct = typeof SPROOM_PRODUCTS[number];

export function normalizeDanishCvr(value: unknown): string {
  const cvr = String(value ?? "").replace(/^DK/i, "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cvr)) throw new Error("Et gyldigt dansk CVR-nummer på 8 cifre er påkrævet.");
  return cvr;
}

function productsOf(value: unknown): SproomProduct[] {
  let candidates: unknown[] = [];
  if (Array.isArray(value)) candidates = value;
  else {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      candidates = Array.isArray(parsed) ? parsed : [];
    } catch { candidates = []; }
  }
  return Array.from(new Set(candidates.map(String).filter((item): item is SproomProduct => SPROOM_PRODUCTS.includes(item as SproomProduct))));
}

function mergeProducts(current: unknown, incoming: unknown): SproomProduct[] {
  return Array.from(new Set([...productsOf(current), ...productsOf(incoming)]));
}

export function sproomConnectionForCompany(companyId: number) {
  return db.select().from(sproomChildCompanies).where(eq(sproomChildCompanies.companyId, companyId)).get() || null;
}

export function sproomConnectionForExternalId(externalCompanyId: string) {
  return db.select().from(sproomChildCompanies).where(eq(sproomChildCompanies.externalCompanyId, externalCompanyId.trim())).get() || null;
}

export function sproomConnectionForCvr(cvrValue: unknown) {
  const cvr = normalizeDanishCvr(cvrValue);
  return db.select().from(sproomChildCompanies).where(eq(sproomChildCompanies.cvr, cvr)).get() || null;
}

export function requestSproomOnboarding(input: {
  companyId: number;
  cvr: unknown;
  sourceProducts?: unknown;
  consentAt: string;
  consentBy: string;
}) {
  const cvr = normalizeDanishCvr(input.cvr);
  const existingForCvr = db.select().from(sproomChildCompanies).where(eq(sproomChildCompanies.cvr, cvr)).get();
  if (existingForCvr && existingForCvr.companyId !== input.companyId) {
    throw new Error("CVR-nummeret er allerede knyttet til en anden kundeorganisation. Kontakt support i stedet for at oprette en ny Sproom-profil.");
  }
  const existing = sproomConnectionForCompany(input.companyId);
  const now = new Date().toISOString();
  const sourceProducts = JSON.stringify(mergeProducts(existing?.sourceProducts, input.sourceProducts || ["add_smartregnskab"]));
  if (existing) {
    return db.update(sproomChildCompanies).set({
      cvr,
      sourceProducts,
      consentAt: input.consentAt,
      consentBy: input.consentBy.slice(0, 255),
      lastError: null,
      updatedAt: now,
    }).where(eq(sproomChildCompanies.id, existing.id)).returning().get();
  }
  return db.insert(sproomChildCompanies).values({
    companyId: input.companyId,
    cvr,
    externalCompanyId: null,
    status: "afventer_sproom",
    sourceProducts,
    nemhandelStatus: "afventer",
    peppolStatus: "afventer",
    consentAt: input.consentAt,
    consentBy: input.consentBy.slice(0, 255),
    createdAt: now,
    updatedAt: now,
  }).returning().get();
}

export function linkSproomChildCompany(input: {
  companyId: number;
  externalCompanyId: unknown;
  sourceProducts?: unknown;
  nemhandelStatus?: string;
  peppolStatus?: string;
}) {
  const externalCompanyId = String(input.externalCompanyId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{6,160}$/.test(externalCompanyId)) throw new Error("Sproom child-company-ID er ugyldigt.");
  const connection = sproomConnectionForCompany(input.companyId);
  if (!connection) throw new Error("Virksomheden skal først godkende Sproom-onboardingen.");
  const duplicate = db.select().from(sproomChildCompanies).where(and(
    eq(sproomChildCompanies.externalCompanyId, externalCompanyId),
    ne(sproomChildCompanies.companyId, input.companyId),
  )).get();
  if (duplicate) throw new Error("Sproom child-company-ID'et er allerede knyttet til en anden kundeorganisation.");
  return db.update(sproomChildCompanies).set({
    externalCompanyId,
    status: "forbundet",
    enrollmentId: null,
    sourceProducts: JSON.stringify(mergeProducts(connection.sourceProducts, input.sourceProducts)),
    nemhandelStatus: input.nemhandelStatus || connection.nemhandelStatus,
    peppolStatus: input.peppolStatus || connection.peppolStatus,
    lastError: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(sproomChildCompanies.id, connection.id)).returning().get();
}

export function updateSproomConnection(input: {
  companyId: number;
  externalCompanyId?: unknown;
  status?: string;
  enrollmentId?: unknown;
  nemhandelStatus?: string;
  nemhandelNetworkId?: unknown;
  peppolStatus?: string;
  peppolNetworkId?: unknown;
  lastError?: unknown;
}) {
  const connection = sproomConnectionForCompany(input.companyId);
  if (!connection) throw new Error("Virksomheden skal først godkende Sproom-onboardingen.");
  const values: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.externalCompanyId !== undefined) {
    const externalCompanyId = String(input.externalCompanyId || "").trim();
    if (externalCompanyId && !/^[a-zA-Z0-9_-]{6,160}$/.test(externalCompanyId)) throw new Error("Sproom child-company-ID er ugyldigt.");
    if (externalCompanyId) {
      const duplicate = db.select().from(sproomChildCompanies).where(and(
        eq(sproomChildCompanies.externalCompanyId, externalCompanyId),
        ne(sproomChildCompanies.companyId, input.companyId),
      )).get();
      if (duplicate) throw new Error("Sproom child-company-ID'et er allerede knyttet til en anden kundeorganisation.");
    }
    values.externalCompanyId = externalCompanyId || null;
  }
  if (input.status !== undefined) values.status = String(input.status).slice(0, 80);
  if (input.enrollmentId !== undefined) values.enrollmentId = String(input.enrollmentId || "").trim().slice(0, 160) || null;
  if (input.nemhandelStatus !== undefined) values.nemhandelStatus = String(input.nemhandelStatus).slice(0, 80);
  if (input.nemhandelNetworkId !== undefined) values.nemhandelNetworkId = String(input.nemhandelNetworkId || "").trim().slice(0, 160) || null;
  if (input.peppolStatus !== undefined) values.peppolStatus = String(input.peppolStatus).slice(0, 80);
  if (input.peppolNetworkId !== undefined) values.peppolNetworkId = String(input.peppolNetworkId || "").trim().slice(0, 160) || null;
  if (input.lastError !== undefined) values.lastError = String(input.lastError || "").trim().slice(0, 1000) || null;
  return db.update(sproomChildCompanies).set(values).where(eq(sproomChildCompanies.id, connection.id)).returning().get();
}

export function addSproomProduct(companyId: number, product: unknown) {
  const connection = sproomConnectionForCompany(companyId);
  if (!connection) return null;
  const sourceProducts = JSON.stringify(mergeProducts(connection.sourceProducts, [product]));
  return db.update(sproomChildCompanies).set({ sourceProducts, updatedAt: new Date().toISOString() })
    .where(eq(sproomChildCompanies.id, connection.id)).returning().get();
}

export function safeSproomConnection(row: ReturnType<typeof sproomConnectionForCompany>) {
  if (!row) return null;
  return {
    cvr: row.cvr,
    status: row.status,
    sourceProducts: productsOf(row.sourceProducts),
    nemhandelStatus: row.nemhandelStatus,
    peppolStatus: row.peppolStatus,
    consentAt: row.consentAt,
    connected: Boolean(row.externalCompanyId && row.status === "forbundet"),
    lastError: row.lastError,
    updatedAt: row.updatedAt,
  };
}

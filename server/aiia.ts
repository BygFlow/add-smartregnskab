import type { Express, NextFunction, Request, Response } from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { decryptField, encryptField } from "./crypto";
import { requireRole, tenantId } from "./auth";
import { consumeToken, issueToken } from "./security";
import { storage } from "./storage";

type AiiaTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string | null;
  consentId?: string | null;
};

type AiiaIntegration = {
  id: number;
  companyId: number;
  type: string;
  displayName: string;
  status: string;
  lastSync?: string | null;
  config?: string | null;
  notes?: string | null;
};

const TIMEOUT_MS = 20_000;
const DEFAULT_SCOPES = "accounts offline_access";

type AiiaWebhookPayload = {
  consentId: string;
  event: string;
  data: unknown;
};

function jwtPayload(token: string | null): Record<string, unknown> {
  if (!token) return {};
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function tokenConsentId(accessToken: string, refreshToken: string | null): string | null {
  const refresh = jwtPayload(refreshToken);
  const access = jwtPayload(accessToken);
  const value = refresh.consentId ?? access.consentId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function verifyAiiaWebhookSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const actual = signature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

export function parseAiiaWebhook(body: unknown): AiiaWebhookPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const envelope = Object.values(body as Record<string, unknown>).find(
    (value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value)),
  );
  if (!envelope) return null;
  const event = typeof envelope.event === "string" ? envelope.event.trim() : "";
  const consentId = typeof envelope.consentId === "string" ? envelope.consentId.trim() : "";
  if (!event || !consentId) return null;
  return { event, consentId, data: envelope.data ?? null };
}

function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error: unknown) {
      if (res.headersSent) return next(error);
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      res.status(400).json({ error: message });
    }
  };
}

function configured(): boolean {
  return Boolean(process.env.AIIA_CLIENT_ID && process.env.AIIA_CLIENT_SECRET && redirectUri());
}

function baseUrl(): string {
  const value = (process.env.AIIA_BASE_URL || "https://api.aiia.eu").replace(/\/$/, "");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || !(parsed.hostname === "aiia.eu" || parsed.hostname.endsWith(".aiia.eu"))) {
    throw new Error("AIIA_BASE_URL skal være et HTTPS-endpoint under aiia.eu.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function redirectUri(): string {
  return process.env.AIIA_REDIRECT_URI
    || (process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/bank/aiia/callback` : "");
}

function appRedirect(result: "connected" | "error"): string {
  const base = (process.env.APP_BASE_URL || "/").replace(/\/$/, "");
  return `${base}/#/smartregnskab/app/bank_integrationer?aiia=${result}`;
}

async function aiiaJson(path: string, init: RequestInit): Promise<Record<string, any>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl()}${path}`, { ...init, signal: controller.signal });
    const raw = await response.text();
    let body: Record<string, any> = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    if (!response.ok) {
      const providerMessage = body?.error_description || body?.message || body?.error;
      throw new Error(`AiiA svarede ${response.status}${providerMessage ? `: ${String(providerMessage).slice(0, 160)}` : "."}`);
    }
    return body;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("AiiA svarede ikke inden for 20 sekunder.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function exchangeToken(body: Record<string, string>): Promise<AiiaTokenSet> {
  if (!configured()) throw new Error("AiiA er ikke konfigureret med klient-id, klienthemmelighed og redirect-URL.");
  const basic = Buffer.from(`${process.env.AIIA_CLIENT_ID}:${process.env.AIIA_CLIENT_SECRET}`).toString("base64");
  const payload = await aiiaJson("/v1/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!payload.access_token) throw new Error("AiiA returnerede ikke et adgangstoken.");
  const expiresIn = Math.max(60, Number(payload.expires_in || 3600));
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: payload.scope ? String(payload.scope) : null,
    consentId: tokenConsentId(String(payload.access_token), payload.refresh_token ? String(payload.refresh_token) : null),
  };
}

function readTokens(integration: AiiaIntegration): AiiaTokenSet {
  const plain = decryptField(integration.config);
  if (!plain) throw new Error("AiiA-sessionen kan ikke dekrypteres. Forbind banken igen.");
  try {
    const parsed = JSON.parse(plain) as AiiaTokenSet;
    if (!parsed.accessToken || !parsed.expiresAt) throw new Error("missing token");
    return parsed;
  } catch {
    throw new Error("AiiA-sessionen er ugyldig. Forbind banken igen.");
  }
}

async function findIntegration(companyId: number): Promise<AiiaIntegration | undefined> {
  const rows = await storage.all("bank_integrations", companyId) as AiiaIntegration[];
  return rows.find((row) => row.type === "aiia");
}

async function findIntegrationByConsent(consentId: string): Promise<AiiaIntegration | undefined> {
  const rows = await storage.all("bank_integrations") as AiiaIntegration[];
  return rows.find((row) => {
    if (row.type !== "aiia" || !row.config) return false;
    try {
      const tokens = readTokens(row);
      return (tokens.consentId || tokenConsentId(tokens.accessToken, tokens.refreshToken)) === consentId;
    } catch {
      return false;
    }
  });
}

async function recordAiiaWebhook(rawBody: string, signatureValid: boolean, eventType: string): Promise<{ id: number; duplicate: boolean }> {
  const eventId = `aiia:${createHash("sha256").update(rawBody, "utf8").digest("hex")}`;
  const existing = await storage.getWebhookEvent(eventId);
  if (existing) return { id: existing.id, duplicate: true };
  const row = await storage.createWebhookEvent({
    provider: "aiia",
    eventId,
    eventType,
    payload: rawBody,
    signatureValid: signatureValid ? 1 : 0,
    processed: 0,
    error: signatureValid ? null : "Ugyldig AiiA-webhooksignatur.",
    receivedAt: new Date().toISOString(),
  });
  return { id: row.id, duplicate: false };
}

async function usableToken(integration: AiiaIntegration): Promise<AiiaTokenSet> {
  const current = readTokens(integration);
  if (new Date(current.expiresAt).getTime() > Date.now() + 60_000) return current;
  if (!current.refreshToken) throw new Error("AiiA-samtykket skal fornyes af bankbrugeren.");
  const refreshed = await exchangeToken({ grant_type: "refresh_token", refresh_token: current.refreshToken });
  if (!refreshed.refreshToken) refreshed.refreshToken = current.refreshToken;
  await storage.update("bank_integrations", integration.id, {
    config: encryptField(JSON.stringify(refreshed)),
    status: "forbundet",
  }, integration.companyId);
  return refreshed;
}

function transactionAmount(transaction: Record<string, any>): number | null {
  const value = transaction.transactionAmount?.value ?? transaction.amount;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function transactionCurrency(transaction: Record<string, any>): string {
  return String(transaction.transactionAmount?.currency ?? transaction.currency ?? "").toUpperCase();
}

export async function syncAiiaCompany(companyId: number): Promise<{ imported: number; skipped: number; accounts: number }> {
  const integration = await findIntegration(companyId);
  if (!integration || integration.status === "afbrudt") throw new Error("Virksomheden har ingen aktiv AiiA-forbindelse.");
  const token = await usableToken(integration);
  const headers = { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" };
  const accountBody = await aiiaJson("/v1/accounts", { method: "GET", headers });
  const accounts = Array.isArray(accountBody.accounts) ? accountBody.accounts : [];
  const existing = await storage.all("bank_transactions", companyId) as Array<{ externalId?: string | null }>;
  const known = new Set(existing.map((row) => row.externalId).filter(Boolean));
  let imported = 0;
  let skipped = 0;

  for (const account of accounts) {
    const accountId = String(account.id || "");
    if (!accountId) continue;
    let pagingToken: string | null = null;
    for (let page = 0; page < 25; page += 1) {
      const query = new URLSearchParams({ pageSize: "100" });
      if (pagingToken) query.set("pagingToken", pagingToken);
      const body = await aiiaJson(`/v1/accounts/${encodeURIComponent(accountId)}/transactions?${query}`, { method: "GET", headers });
      const transactions = Array.isArray(body.transactions) ? body.transactions : [];
      for (const transaction of transactions) {
        if (String(transaction.state || "Booked").toLowerCase() !== "booked") { skipped += 1; continue; }
        const amount = transactionAmount(transaction);
        const id = String(transaction.id || "");
        const externalId = `aiia:${accountId}:${id}`;
        if (!id || amount === null || known.has(externalId)) { skipped += 1; continue; }
        if (transactionCurrency(transaction) !== "DKK") { skipped += 1; continue; }
        const balance = Number(transaction.balance?.value ?? 0);
        await storage.insert("bank_transactions", {
          companyId,
          date: String(transaction.date || transaction.creationDate || new Date().toISOString()).slice(0, 10),
          description: String(transaction.text || transaction.originalText || transaction.type || "AiiA-bankpost").slice(0, 500),
          amount,
          balance: Number.isFinite(balance) ? balance : 0,
          provider: "aiia",
          accountRef: accountId,
          externalId,
          matchedType: null,
          matchedId: null,
          status: "afventer",
          importedAt: new Date().toISOString(),
        });
        known.add(externalId);
        imported += 1;
      }
      const next = body.pagingToken ? String(body.pagingToken) : "";
      if (!next || next === pagingToken || transactions.length === 0) break;
      pagingToken = next;
    }
  }

  const completedAt = new Date().toISOString();
  await storage.update("bank_integrations", integration.id, { status: "forbundet", lastSync: completedAt }, companyId);
  await storage.createAuditLog({
    companyId, userId: null, userEmail: null, action: "aiia_bank_synkroniseret",
    target: `bankIntegration#${integration.id}`,
    detail: `${imported} nye DKK-bankposter importeret fra ${accounts.length} konto/konti; ${skipped} sprunget over.`,
    createdAt: completedAt,
  });
  return { imported, skipped, accounts: accounts.length };
}

export async function syncAllAiia(): Promise<{ imported: number; companies: number; failed: number }> {
  const companies = await storage.getCompanies();
  let imported = 0;
  let synced = 0;
  let failed = 0;
  for (const company of companies) {
    const integration = await findIntegration(company.id);
    if (!integration || integration.status === "afbrudt") continue;
    try {
      const result = await syncAiiaCompany(company.id);
      imported += result.imported;
      synced += 1;
    } catch (error: unknown) {
      failed += 1;
      await storage.update("bank_integrations", integration.id, {
        status: "fejl",
        notes: (error instanceof Error ? error.message : "AiiA-synkronisering fejlede").slice(0, 300),
      }, company.id);
    }
  }
  return { imported, companies: synced, failed };
}

export function registerPublicAiiaRoutes(app: Express): void {
  app.post("/api/bank/aiia/webhook", h(async (req, res) => {
    const secret = process.env.AIIA_WEBHOOK_SECRET?.trim() || "";
    if (!secret) return res.status(503).json({ error: "AiiA-webhook er ikke konfigureret." });
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody.toString("utf8")
      : typeof req.rawBody === "string"
        ? req.rawBody
        : JSON.stringify(req.body ?? {});
    const rawSignature = req.headers["x-viia-signature"];
    const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
    const parsed = parseAiiaWebhook(req.body);
    const valid = verifyAiiaWebhookSignature(rawBody, signature, secret);
    const saved = await recordAiiaWebhook(rawBody, valid, parsed?.event || "ukendt");
    if (!valid) return res.status(401).json({ error: "Webhooksignaturen kunne ikke bekræftes." });
    if (saved.duplicate) return res.status(200).json({ ok: true, duplicate: true });
    if (!parsed) {
      await storage.updateWebhookEvent(saved.id, { error: "Ukendt AiiA-webhookformat." });
      return res.status(400).json({ error: "Ukendt webhookformat." });
    }

    const integration = await findIntegrationByConsent(parsed.consentId);
    if (!integration) {
      await storage.updateWebhookEvent(saved.id, { error: "Intet AiiA-samtykke matcher webhookpen." });
      // Kvitter for en autentisk, men ukendt/udfaset samtykkehændelse for at undgå retry-storme.
      return res.status(202).json({ ok: true, matched: false });
    }

    const event = parsed.event.toLowerCase();
    const now = new Date().toISOString();
    let action = "aiia_webhook_modtaget";
    if (event === "consentrevoked" || event === "connectionremoved") {
      await storage.update("bank_integrations", integration.id, {
        status: "afbrudt",
        notes: "Banksamtykket er tilbagekaldt hos AiiA. Forbind banken igen for at fortsætte.",
      }, integration.companyId);
      action = "aiia_samtykke_tilbagekaldt";
    } else if (event === "consentneedsupdate" || event === "connectionupdaterequired") {
      await storage.update("bank_integrations", integration.id, {
        status: "fejl",
        notes: "AiiA kræver, at bankbrugeren fornyer forbindelsen eller samtykket.",
      }, integration.companyId);
      action = "aiia_samtykke_skal_fornyes";
    } else if (event === "accountsupdated" || event === "syncdone") {
      action = "aiia_bankdata_opdateret";
      setImmediate(() => {
        void syncAiiaCompany(integration.companyId).catch(async (error: unknown) => {
          await storage.update("bank_integrations", integration.id, {
            status: "fejl",
            notes: (error instanceof Error ? error.message : "AiiA-synkronisering fejlede").slice(0, 300),
          }, integration.companyId);
        });
      });
    }
    await storage.createAuditLog({
      companyId: integration.companyId,
      userId: null,
      userEmail: null,
      action,
      target: `bankIntegration#${integration.id}`,
      detail: `AiiA-webhook ${parsed.event} modtaget og signaturvalideret.`,
      createdAt: now,
    });
    await storage.updateWebhookEvent(saved.id, { processed: 1, error: null });
    return res.status(200).json({ ok: true });
  }));

  app.get("/api/bank/aiia/callback", h(async (req, res) => {
    const state = String(req.query.state || "");
    const code = String(req.query.code || "");
    if (!state || !code || req.query.error) return res.redirect(303, appRedirect("error"));
    const consumed = await consumeToken(state, "aiia_oauth");
    if (!consumed.ok || !consumed.row?.companyId) return res.redirect(303, appRedirect("error"));
    const tokenSet = await exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    });
    const companyId = Number(consumed.row.companyId);
    const existing = await findIntegration(companyId);
    const values = {
      companyId,
      type: "aiia",
      displayName: "AiiA / Mastercard Open Banking",
      status: "forbundet",
      lastSync: null,
      config: encryptField(JSON.stringify(tokenSet)),
      notes: "Bankdata deles efter kundens udtrykkelige AiiA-samtykke.",
    };
    const saved = existing
      ? await storage.update("bank_integrations", existing.id, values, companyId)
      : await storage.insert("bank_integrations", { ...values, createdAt: new Date().toISOString() });
    await storage.createAuditLog({
      companyId, userId: consumed.row.userId ?? null, userEmail: consumed.row.email ?? null,
      action: "aiia_bank_forbundet", target: `bankIntegration#${saved?.id ?? existing?.id ?? "ny"}`,
      detail: "AiiA OAuth-samtykke gennemført; tokens er krypteret i databasen.", createdAt: new Date().toISOString(),
    });
    res.redirect(303, appRedirect("connected"));
  }));
}

export function registerAiiaRoutes(app: Express): void {
  app.get("/api/bank/aiia/status", h(async (req, res) => {
    const integration = await findIntegration(tenantId(req));
    res.json({
      provider: "aiia",
      configured: configured(),
      connected: Boolean(integration && integration.status !== "afbrudt"),
      status: integration?.status ?? "ikke_forbundet",
      lastSync: integration?.lastSync ?? null,
      message: integration?.notes ?? null,
    });
  }));

  app.post("/api/bank/aiia/connect", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!configured()) return res.status(503).json({ error: "AiiA-produktionsnøgler mangler." });
    const { token: state, expiresAt } = await issueToken("aiia_oauth", req.auth!.email, {
      userId: req.auth!.userId,
      companyId: tenantId(req),
    });
    const query = new URLSearchParams({
      client_id: process.env.AIIA_CLIENT_ID!,
      scope: process.env.AIIA_SCOPES || DEFAULT_SCOPES,
      redirect_uri: redirectUri(),
      response_type: "code",
      state,
    });
    res.json({ authorizationUrl: `${baseUrl()}/v1/oauth/connect?${query}`, expiresAt });
  }));

  app.post("/api/bank/aiia/sync", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    res.json(await syncAiiaCompany(tenantId(req)));
  }));
}

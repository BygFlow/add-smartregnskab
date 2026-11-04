import { createHash, randomBytes } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  companies,
  companyIdentityVerifications,
  mitidOidcStates,
} from "@shared/schema";
import { tenantId } from "./auth";
import { decryptField, encryptField } from "./crypto";
import { db, storage } from "./storage";
import { MITID_BUSINESS_ACR, validCvr, validateMitidBusinessClaims } from "./mitid-claims";

const STATE_TTL_MS = 10 * 60_000;
const DISCOVERY_TTL_MS = 60 * 60_000;

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  token_endpoint_auth_methods_supported?: string[];
};

let discoveryCache: { issuerUrl: string; expiresAt: number; value: Discovery } | null = null;

const asyncRoute = (
  fn: (req: Request, res: Response) => Promise<unknown>,
) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function normalizeIssuer(value: string): string {
  return value.replace(/\/+$/, "");
}

export function mitidProviderStatus() {
  const required = ["IDURA_ISSUER_URL", "IDURA_CLIENT_ID", "IDURA_CLIENT_SECRET", "IDURA_REDIRECT_URI"];
  const missing = required.filter((name) => !env(name));
  return {
    configured: missing.length === 0,
    environment: env("IDURA_ENVIRONMENT") || "test",
    missing,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function base64url(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

async function discovery(): Promise<Discovery> {
  const issuerUrl = normalizeIssuer(env("IDURA_ISSUER_URL"));
  if (!issuerUrl) throw new Error("mitid_not_configured");
  if (discoveryCache?.issuerUrl === issuerUrl && discoveryCache.expiresAt > Date.now()) {
    return discoveryCache.value;
  }
  const response = await fetch(`${issuerUrl}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("discovery_failed");
  const value = await response.json() as Discovery;
  if (!value.issuer || !value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) {
    throw new Error("discovery_invalid");
  }
  discoveryCache = { issuerUrl, expiresAt: Date.now() + DISCOVERY_TTL_MS, value };
  return value;
}

function settingsRedirect(result: "success" | "failed", reason?: string): string {
  const base = (env("APP_BASE_URL") || "https://app.addsmartregnskab.dk").replace(/\/+$/, "");
  const query = new URLSearchParams({ mitid: result });
  if (reason) query.set("reason", reason);
  return `${base}/#/smartregnskab/app/virksomhedsindstillinger?${query.toString()}`;
}

function safeFailureReason(error: unknown): string {
  const code = error instanceof Error ? error.message : "unknown";
  const allowed = new Set([
    "provider_denied", "code_missing", "token_exchange_failed", "token_response_invalid",
    "id_token_missing", "token_validation_failed", "cvr_mismatch", "wrong_identity_scheme",
    "signatory_required", "business_role_missing", "subject_missing", "state_expired",
  ]);
  return allowed.has(code) ? code : "verification_failed";
}

async function recordAudit(
  companyId: number,
  userId: number,
  action: string,
  verificationId: number,
  detail: string,
) {
  const user = await storage.getUser(userId);
  await storage.createAuditLog({
    companyId,
    userId,
    userEmail: user?.email ?? "ukendt",
    action,
    target: `mitid_verification#${verificationId}`,
    detail,
    createdAt: new Date().toISOString(),
  });
}

async function failVerification(
  verificationId: number,
  companyId: number,
  userId: number,
  reason: string,
) {
  const now = new Date().toISOString();
  db.update(companyIdentityVerifications).set({
    status: reason === "state_expired" ? "expired" : "failed",
    failedAt: now,
    failureReason: reason,
    updatedAt: now,
  }).where(and(
    eq(companyIdentityVerifications.id, verificationId),
    eq(companyIdentityVerifications.companyId, companyId),
  )).run();
  await recordAudit(companyId, userId, "mitid_verificering_fejlet", verificationId, reason);
}

export function registerPublicMitidRoutes(app: Express) {
  app.get("/api/mitid/callback", asyncRoute(async (req, res) => {
    const rawState = String(req.query.state ?? "");
    if (!rawState) return res.redirect(303, settingsRedirect("failed", "state_missing"));

    const state = db.select().from(mitidOidcStates)
      .where(and(eq(mitidOidcStates.stateHash, sha256(rawState)), isNull(mitidOidcStates.usedAt)))
      .get();
    if (!state) return res.redirect(303, settingsRedirect("failed", "state_invalid"));

    const now = new Date();
    const used = db.update(mitidOidcStates).set({ usedAt: now.toISOString() })
      .where(and(eq(mitidOidcStates.id, state.id), isNull(mitidOidcStates.usedAt))).run();
    if (!used.changes) return res.redirect(303, settingsRedirect("failed", "state_invalid"));

    if (new Date(state.expiresAt) <= now) {
      await failVerification(state.verificationId, state.companyId, state.userId, "state_expired");
      return res.redirect(303, settingsRedirect("failed", "state_expired"));
    }

    try {
      if (req.query.error) throw new Error("provider_denied");
      const code = String(req.query.code ?? "");
      if (!code) throw new Error("code_missing");
      const codeVerifier = decryptField(state.codeVerifierEncrypted);
      const nonce = decryptField(state.nonceEncrypted);
      if (!codeVerifier || !nonce) throw new Error("token_validation_failed");

      const oidc = await discovery();
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env("IDURA_REDIRECT_URI"),
        client_id: env("IDURA_CLIENT_ID"),
        code_verifier: codeVerifier,
      });
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      };
      const methods = oidc.token_endpoint_auth_methods_supported ?? ["client_secret_post"];
      if (methods.includes("client_secret_post")) {
        params.set("client_secret", env("IDURA_CLIENT_SECRET"));
      } else if (methods.includes("client_secret_basic")) {
        headers.Authorization = `Basic ${Buffer.from(`${env("IDURA_CLIENT_ID")}:${env("IDURA_CLIENT_SECRET")}`).toString("base64")}`;
      } else {
        throw new Error("token_exchange_failed");
      }

      const tokenResponse = await fetch(oidc.token_endpoint, {
        method: "POST",
        headers,
        body: params,
        signal: AbortSignal.timeout(15_000),
      });
      if (!tokenResponse.ok) throw new Error("token_exchange_failed");
      const tokens = await tokenResponse.json() as { id_token?: string };
      if (!tokens.id_token) throw new Error("id_token_missing");

      let claims: JWTPayload;
      try {
        const verified = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(oidc.jwks_uri)), {
          issuer: oidc.issuer,
          audience: env("IDURA_CLIENT_ID"),
        });
        claims = verified.payload;
      } catch {
        throw new Error("token_validation_failed");
      }
      if (claims.nonce !== nonce) throw new Error("token_validation_failed");
      const identity = validateMitidBusinessClaims(claims, state.expectedCvr);

      const verifiedAt = new Date().toISOString();
      db.update(companyIdentityVerifications).set({
        status: "verified",
        verifiedCvr: identity.cvr,
        subjectHash: identity.subjectHash,
        identityUuidHash: identity.identityUuidHash,
        actorRole: identity.actorRole,
        assuranceLevel: identity.assuranceLevel,
        verifiedAt,
        failedAt: null,
        failureReason: null,
        evidence: JSON.stringify({
          provider: "idura",
          environment: env("IDURA_ENVIRONMENT") || "test",
          cvrMatched: true,
          companySignatory: true,
          authTime: identity.authTime,
        }),
        updatedAt: verifiedAt,
      }).where(and(
        eq(companyIdentityVerifications.id, state.verificationId),
        eq(companyIdentityVerifications.companyId, state.companyId),
      )).run();
      await recordAudit(state.companyId, state.userId, "mitid_virksomhed_verificeret", state.verificationId, `CVR ${identity.cvr}`);
      return res.redirect(303, settingsRedirect("success"));
    } catch (error) {
      const reason = safeFailureReason(error);
      await failVerification(state.verificationId, state.companyId, state.userId, reason);
      return res.redirect(303, settingsRedirect("failed", reason));
    }
  }));
}

function requireCompanyIdentityAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "leder") {
    return res.status(403).json({ error: "Kun virksomhedens administrator kan starte MitID-verificering." });
  }
  next();
}

export function registerMitidRoutes(app: Express) {
  app.get("/api/mitid/status", requireCompanyIdentityAdmin, asyncRoute(async (req, res) => {
    const companyId = tenantId(req);
    const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
    const current = db.select().from(companyIdentityVerifications)
      .where(eq(companyIdentityVerifications.companyId, companyId))
      .orderBy(desc(companyIdentityVerifications.id)).get();
    const status = mitidProviderStatus();
    res.json({
      ...status,
      verified: current?.status === "verified" && current.verifiedCvr === validCvr(company?.cvr),
      verification: current ? {
        id: current.id,
        status: current.status,
        expectedCvr: current.expectedCvr,
        verifiedCvr: current.verifiedCvr,
        actorRole: current.actorRole,
        startedAt: current.startedAt,
        verifiedAt: current.verifiedAt,
        failureReason: current.failureReason,
      } : null,
    });
  }));

  app.post("/api/mitid/start", requireCompanyIdentityAdmin, asyncRoute(async (req, res) => {
    const provider = mitidProviderStatus();
    if (!provider.configured) {
      return res.status(503).json({ error: "MitID-brokeren er ikke færdigkonfigureret.", code: "mitid_not_configured" });
    }
    const companyId = tenantId(req);
    const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
    const cvr = validCvr(company?.cvr);
    if (!cvr) {
      return res.status(400).json({ error: "Gem virksomhedens CVR-nummer på 8 cifre, før MitID-verificering startes." });
    }
    const oidc = await discovery();

    const now = new Date();
    db.delete(mitidOidcStates).where(lt(mitidOidcStates.expiresAt, now.toISOString())).run();
    const createdAt = now.toISOString();
    const verification = db.insert(companyIdentityVerifications).values({
      companyId,
      provider: "idura",
      environment: provider.environment,
      status: "pending",
      expectedCvr: cvr,
      initiatedBy: req.auth!.userId,
      startedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    }).returning().get();

    const state = base64url();
    const nonce = base64url();
    const codeVerifier = base64url(48);
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    db.insert(mitidOidcStates).values({
      stateHash: sha256(state),
      companyId,
      userId: req.auth!.userId,
      verificationId: verification.id,
      expectedCvr: cvr,
      codeVerifierEncrypted: encryptField(codeVerifier),
      nonceEncrypted: encryptField(nonce),
      expiresAt: new Date(now.getTime() + STATE_TTL_MS).toISOString(),
      createdAt,
    }).run();

    const url = new URL(oidc.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: env("IDURA_CLIENT_ID"),
      redirect_uri: env("IDURA_REDIRECT_URI"),
      scope: "openid",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      acr_values: MITID_BUSINESS_ACR,
      login_hint: `business vatid:DK${cvr}`,
      ui_locales: "da",
    }).toString();
    await recordAudit(companyId, req.auth!.userId, "mitid_verificering_startet", verification.id, `CVR ${cvr}`);
    return res.status(201).json({ authorizationUrl: url.toString(), environment: provider.environment });
  }));
}

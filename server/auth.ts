import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// ── Adgangskoder: scrypt med pr.-bruger salt ──
// Format: scrypt$<salt-hex>$<hash-hex>. Bruger Node's indbyggede crypto,
// så der ikke kræves native afhængigheder i sandkassen.

const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), KEYLEN);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ── Sessioner ──

const SESSION_DAYS = 7;

export async function createSession(userId: number): Promise<string> {
  const token = `${randomUUID()}${randomBytes(16).toString("hex")}`;
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  await storage.createSession({
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  return token;
}

/** Fjerner adgangskode-hash før en bruger sendes til klienten. */
export function safeUser(user: User) {
  const { password, ...rest } = user;
  return rest;
}

export interface AuthContext {
  userId: number;
  companyId: number;
  role: string;
  email: string;
  employeeId: number | null;
  isPlatformAdmin: boolean;
  /** Hele brugerrækken, slået op i databasen — ikke noget klienten har sendt. */
  user: User;
  /** Sessionstokenet, så det kan slettes ved log ud. */
  token: string;
  apiKeyId?: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/**
 * Kræver gyldigt token. Sætter req.auth ud fra databasen — aldrig ud fra
 * hvad klienten hævder. Dette er det, der lukker tenant-hullet.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "Log ind for at fortsætte." });

  if (token.startsWith("sk_")) {
    const hash = createHash("sha256").update(token).digest("hex");
    const record = (await storage.all("api_keys")).find((item: any) => item.keyHash === hash);
    if (!record || record.status !== "aktiv" || (record.expiresAt && new Date(record.expiresAt) <= new Date())) {
      return res.status(401).json({ error: "API-nøglen er ugyldig eller udløbet." });
    }
    const scopes = String(record.scopes || "read").split(/[\s,]+/).filter(Boolean);
    const required = ["GET", "HEAD"].includes(req.method) ? "read" : "write";
    const allowedPath = /^\/api\/(customers|invoices|quotes|accounts|journal-entries|journal-lines)(\/|\?|$)/.test(req.originalUrl);
    if (!allowedPath || (!scopes.includes(required) && !scopes.includes("*"))) {
      return res.status(403).json({ error: "API-nøglen har ikke adgang til denne handling." });
    }
    const serviceUser = (await storage.getUsers(record.companyId)).find((user) => user.active && user.role === "leder");
    if (!serviceUser) return res.status(401).json({ error: "API-nøglen mangler en aktiv kontoejer." });
    await storage.update("api_keys", record.id, { lastUsed: new Date().toISOString() }, record.companyId);
    req.auth = {
      userId: serviceUser.id, companyId: record.companyId, role: "leder", email: serviceUser.email,
      employeeId: serviceUser.employeeId ?? null, isPlatformAdmin: false, user: serviceUser, token, apiKeyId: record.id,
    };
    return next();
  }

  const session = await storage.getSession(token);
  if (!session) return res.status(401).json({ error: "Sessionen er ugyldig. Log ind igen." });
  if (new Date(session.expiresAt) < new Date()) {
    await storage.deleteSession(token);
    return res.status(401).json({ error: "Sessionen er udløbet. Log ind igen." });
  }

  const user = await storage.getUser(session.userId);
  if (!user || !user.active) {
    return res.status(401).json({ error: "Brugeren er deaktiveret." });
  }

  const isPlatformAdmin = user.role === "platform_admin";

  // Spærrede virksomheder mister adgang — men platformadmins kommer altid ind,
  // ellers kunne vi ikke genåbne en spærret konto.
  if (!isPlatformAdmin) {
    const company = await storage.getCompany(user.companyId);
    if (!company) return res.status(401).json({ error: "Virksomheden findes ikke." });
    if (company.status === "spaerret" || company.status === "opsagt") {
      return res.status(402).json({
        error: "Abonnementet er ikke aktivt. Kontakt ADD SmartRegnskab for at genåbne adgangen.",
        code: "abonnement_spaerret",
      });
    }
  }

  req.auth = {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    employeeId: user.employeeId ?? null,
    isPlatformAdmin,
    user,
    token,
  };
  next();
}

/**
 * Det firma, forespørgslen må se. En almindelig bruger kan KUN se sit eget,
 * uanset hvad de sender med. Kun platformadmins kan pege på et andet firma.
 */
export function tenantId(req: Request): number {
  const auth = req.auth;
  if (!auth) throw new Error("tenantId() kaldt uden requireAuth");
  if (auth.isPlatformAdmin) {
    const asked = Number(req.query.companyId ?? req.body?.companyId);
    if (Number.isFinite(asked) && asked > 0) return asked;
  }
  return auth.companyId;
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Ikke logget ind." });
    if (req.auth.isPlatformAdmin) return next();
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Du har ikke rettigheder til denne handling." });
    }
    next();
  };
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isPlatformAdmin) {
    return res.status(403).json({ error: "Kun ADD SmartRegnskab-administratorer har adgang hertil." });
  }
  next();
}

/** Baseline, default-deny policy for non-manager accounts. Individual routes
 * still enforce object ownership; this guard prevents newly added CRUD routes
 * from accidentally becoming available to every authenticated role. */
export function enforceBaselineAccess(req: Request, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (!role) return res.status(401).json({ error: "Ikke logget ind." });
  if (role === "platform_admin" || role === "leder") return next();

  const path = req.originalUrl.split("?")[0];
  const isRead = req.method === "GET" || req.method === "HEAD";
  const startsWithAny = (prefixes: string[]) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (role === "holdleder") {
    const financeAndPlatform = [
      "/api/platform", "/api/billing", "/api/payment", "/api/subscription",
      "/api/accounts", "/api/journal-entries", "/api/journal-lines", "/api/vat-periods",
      "/api/accounting", "/api/regnskabssystem", "/api/api-keys", "/api/backup-settings",
      "/api/backups", "/api/gdpr", "/api/users", "/api/ai-regnskab", "/api/vouchers",
      "/api/document-inbox", "/api/payroll", "/api/vat", "/api/bank", "/api/budget",
      "/api/reconciliation", "/api/einvoice", "/api/audit-package", "/api/cloud-providers",
      "/api/ai-governance", "/api/regulatory-monitor", "/api/regulatory-changes",
    ];
    if (startsWithAny(financeAndPlatform)) {
      return res.status(403).json({ error: "Denne funktion kræver lederadgang." });
    }
    return next();
  }

  if (role === "assistent") {
    const readable = [
      "/api/auth/me", "/api/company", "/api/tasks", "/api/time-entries", "/api/absences",
      "/api/shifts", "/api/attachments", "/api/notifications", "/api/messages",
      "/api/task-sessions", "/api/conversations", "/api/samtykke", "/api/materials",
      "/api/material-usage", "/api/quality-inspections", "/api/customer-requests",
    ];
    const writable = [
      /^\/api\/auth\/(logout|password)$/,
      /^\/api\/tasks\/\d+\/notes$/,
      /^\/api\/task-sessions\/(start|\d+\/(pause|resume|end))$/,
      /^\/api\/absences(?:\/\d+)?$/,
      /^\/api\/attachments(?:\/\d+)?$/,
      /^\/api\/conversations(?:\/\d+\/(messages|read))?$/,
      /^\/api\/samtykke$/,
      /^\/api\/material-usage(?:\/\d+)?$/,
    ];
    if ((isRead && startsWithAny(readable)) || writable.some((pattern) => pattern.test(path))) return next();
    return res.status(403).json({ error: "Denne funktion kræver lederadgang." });
  }

  if (role === "kunde") {
    const readable = [
      "/api/auth/me", "/api/tasks", "/api/shifts", "/api/invoices", "/api/quotes",
      "/api/attachments", "/api/notifications", "/api/conversations", "/api/customer-self-service",
    ];
    const writable = [
      /^\/api\/auth\/(logout|password)$/,
      /^\/api\/quotes\/\d+\/respond$/,
      /^\/api\/conversations(?:\/\d+\/(messages|read))?$/,
      /^\/api\/customer-self-service(?:\/\d+)?$/,
    ];
    if ((isRead && startsWithAny(readable)) || writable.some((pattern) => pattern.test(path))) return next();
    return res.status(403).json({ error: "Du har ikke adgang til denne funktion." });
  }

  return res.status(403).json({ error: "Ukendt eller ugyldig brugerrolle." });
}

// ── Planbegrænsninger ──

/** Blokerer en funktion, hvis virksomhedens pakke ikke indeholder den. */
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.isPlatformAdmin) return next();
    const cid = tenantId(req);
    const plan = await storage.getCompanyPlan(cid);
    if (!plan) {
      return res.status(402).json({ error: "Ingen aktiv pakke fundet.", code: "ingen_pakke" });
    }
    let features: string[] = [];
    try {
      features = JSON.parse(plan.features);
    } catch {
      features = [];
    }
    if (!features.includes(feature)) {
      return res.status(402).json({
        error: `Funktionen er ikke inkluderet i pakken ${plan.name}. Opgradér for at få adgang.`,
        code: "pakke_begraensning",
        feature,
        planName: plan.name,
      });
    }
    next();
  };
}

/** Håndhæver loftet på antal ansatte/kunder, før der oprettes flere. */
export async function checkLimit(
  companyId: number,
  kind: "employees" | "customers",
): Promise<{ ok: true } | { ok: false; message: string; limit: number; planName: string }> {
  const plan = await storage.getCompanyPlan(companyId);
  if (!plan) return { ok: true };
  const limit = kind === "employees" ? plan.maxEmployees : plan.maxCustomers;
  if (limit < 0) return { ok: true };
  const current =
    kind === "employees"
      ? (await storage.getEmployees(companyId)).length
      : (await storage.getCustomers(companyId)).length;
  if (current >= limit) {
    const label = kind === "employees" ? "ansatte" : "kunder";
    return {
      ok: false,
      limit,
      planName: plan.name,
      message: `Pakken ${plan.name} tillader højst ${limit} ${label}. Opgradér for at oprette flere.`,
    };
  }
  return { ok: true };
}

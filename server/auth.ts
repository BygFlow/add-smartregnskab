import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { professionalMemberships } from "@shared/schema";
import { db } from "./storage";
import { and, eq } from "drizzle-orm";

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

export function sessionStorageKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = `${randomUUID()}${randomBytes(16).toString("hex")}`;
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  const user = await storage.getUser(userId);
  await storage.createSession({
    token: sessionStorageKey(token),
    userId,
    activeCompanyId: user?.companyId ?? null,
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
  homeCompanyId: number;
  role: string;
  professionalMembership: typeof professionalMemberships.$inferSelect | null;
  permissions: string[];
  email: string;
  employeeId: number | null;
  isPlatformAdmin: boolean;
  /** Hele brugerrækken, slået op i databasen — ikke noget klienten har sendt. */
  user: User;
  /** Sessionstokenet, så det kan slettes ved log ud. */
  token: string;
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

  const storedToken = sessionStorageKey(token);
  const session = await storage.getSession(storedToken);
  if (!session) return res.status(401).json({ error: "Sessionen er ugyldig. Log ind igen." });
  if (new Date(session.expiresAt) < new Date()) {
    await storage.deleteSession(storedToken);
    return res.status(401).json({ error: "Sessionen er udløbet. Log ind igen." });
  }

  const user = await storage.getUser(session.userId);
  if (!user || !user.active) {
    return res.status(401).json({ error: "Brugeren er deaktiveret." });
  }

  const isPlatformAdmin = user.role === "platform_admin";
  let activeCompanyId = session.activeCompanyId ?? user.companyId;
  let professionalMembership: typeof professionalMemberships.$inferSelect | null = null;
  if (!isPlatformAdmin && activeCompanyId !== user.companyId) {
    professionalMembership = await db.select().from(professionalMemberships).where(and(
      eq(professionalMemberships.userId, user.id),
      eq(professionalMemberships.companyId, activeCompanyId),
      eq(professionalMemberships.status, "active"),
    )).get() ?? null;
    if (!professionalMembership
      || (professionalMembership.accessExpiresAt && new Date(professionalMembership.accessExpiresAt) <= new Date())) {
      await storage.updateSessionCompany(storedToken, user.companyId);
      activeCompanyId = user.companyId;
      professionalMembership = null;
    }
  } else if (!isPlatformAdmin && ["bogholder", "revisor", "revisor_admin"].includes(user.role)) {
    professionalMembership = await db.select().from(professionalMemberships).where(and(
      eq(professionalMemberships.userId, user.id),
      eq(professionalMemberships.companyId, activeCompanyId),
      eq(professionalMemberships.status, "active"),
    )).get() ?? null;
  }
  let permissions: string[] = [];
  try { permissions = professionalMembership ? JSON.parse(professionalMembership.permissions) : []; } catch { permissions = []; }

  // Spærrede virksomheder mister adgang — men platformadmins kommer altid ind,
  // ellers kunne vi ikke genåbne en spærret konto.
  if (!isPlatformAdmin) {
    const company = await storage.getCompany(activeCompanyId);
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
    companyId: activeCompanyId,
    homeCompanyId: user.companyId,
    role: professionalMembership?.professionalRole ?? user.role,
    professionalMembership,
    permissions,
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
    const professionalRole = ["bogholder", "revisor", "revisor_admin"].includes(req.auth.role);
    const accountingRoleAccepted = professionalRole && roles.some((role) => role === "leder" || role === "holdleder");
    if (!roles.includes(req.auth.role) && !accountingRoleAccepted) {
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

/**
 * Platformadministration er adskilt fra kundernes bogforing.
 *
 * En platformadministrator maa administrere abonnement, drift og teknisk
 * metadata, men maa ikke bruge sin platformrolle som en universalnogle til
 * kundernes bilag, bankdata, posteringer eller rapporter. Listen er bevidst
 * fail-closed for kunde-API'er: nye kundeendpoints er spaerret, indtil de
 * udtrykkeligt er vurderet som platformadministration.
 */
export function platformCustomerDataGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isPlatformAdmin) return next();

  const path = req.path;
  const allowed =
    path.startsWith("/auth/")
    || path === "/company"
    || path === "/plans"
    || path.startsWith("/security")
    || path.startsWith("/platform/")
    || path === "/platform"
    || path.startsWith("/operations/")
    || path.startsWith("/support-cases")
    || path.startsWith("/system/info");

  // Dataeksport og datasletning indeholder eller paavirker kundens indhold og
  // kraever derfor en senere, dokumenteret kundegodkendelsesproces.
  const sensitivePlatformOperation =
    /^\/platform\/companies\/\d+\/export-data$/.test(path)
    || /^\/platform\/companies\/\d+\/data$/.test(path)
    || path === "/platform/filer/migrer";

  if (!allowed || sensitivePlatformOperation) {
    return res.status(403).json({
      error: "Platformadministratoren har ikke adgang til virksomhedens bogforingsdata. Kunden skal selv give en tidsbegraenset adgang.",
      code: "platform_customer_data_blocked",
    });
  }
  next();
}

const PROFESSIONAL_ROLES = ["bogholder", "revisor", "revisor_admin"];

/** Fail-closed adgangsvagt for eksterne fagbrugere. */
export function professionalAccessGuard(req: Request, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth || !PROFESSIONAL_ROLES.includes(auth.role)) return next();
  if (!auth.professionalMembership) {
    const recoveryPaths = ["/auth/me", "/auth/logout", "/security", "/professional/clients", "/professional/switch-company"];
    if (recoveryPaths.some((prefix) => req.path.startsWith(prefix))) return next();
    return res.status(403).json({ error: "Din faglige klientadgang er ikke aktiv.", code: "fagadgang_mangler" });
  }
  if (auth.professionalMembership.requiresTwoFactor === 1 && auth.user.twoFactorEnabled !== 1) {
    const allowed = ["/auth/me", "/auth/logout", "/security", "/professional/clients", "/professional/switch-company"];
    if (!allowed.some((prefix) => req.path.startsWith(prefix))) {
      return res.status(403).json({ error: "Tofaktorgodkendelse skal aktiveres, før klientdata kan åbnes.", code: "mfa_kraeves" });
    }
  }
  const permissions = new Set(auth.permissions);
  const privileged = ["/users", "/platform", "/subscription", "/api-keys", "/backup"];
  if (privileged.some((prefix) => req.path.startsWith(prefix)) && !permissions.has("users:manage")) {
    return res.status(403).json({ error: "Fagprofilen må ikke administrere virksomhedens brugere eller platform." });
  }
  if (req.method === "DELETE" && !permissions.has("accounting:delete")) {
    return res.status(403).json({ error: "Sletning kræver en særskilt klienttilladelse." });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)
      && !req.path.startsWith("/professional")
      && !req.path.startsWith("/auditor-portal")
      && !permissions.has("accounting:write")) {
    return res.status(403).json({ error: "Denne fagprofil har skrivebeskyttet adgang." });
  }
  next();
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

import type { Express, NextFunction, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  auditLogs, companies, companyAccessMemberships, professionalApprovals, professionalMemberships, users,
} from "@shared/schema";
import { db, storage } from "./storage";
import { requireRole, sessionStorageKey, tenantId } from "./auth";
import { issueToken } from "./security";
import { queueAndSend } from "./messaging";

const ROLES = new Set(["bogholder", "revisor", "revisor_admin"]);
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  bogholder: ["accounting:read", "accounting:write", "approvals:request", "documents:manage"],
  revisor: ["accounting:read", "approvals:decide", "documents:manage", "audit:read"],
  revisor_admin: ["accounting:read", "accounting:write", "approvals:request", "approvals:decide", "documents:manage", "audit:read", "users:manage"],
};

function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (error: any) {
      if (res.headersSent) return next(error);
      res.status(400).json({ error: String(error?.message ?? error) });
    }
  };
}

function cleanPermissions(role: string, raw: unknown): string[] {
  const allowed = new Set([
    "accounting:read", "accounting:write", "accounting:delete", "approvals:request",
    "approvals:decide", "documents:manage", "audit:read", "users:manage",
  ]);
  const requested = Array.isArray(raw) ? raw.map(String).filter((p) => allowed.has(p)) : DEFAULT_PERMISSIONS[role];
  return Array.from(new Set(requested?.length ? requested : DEFAULT_PERMISSIONS[role]));
}

async function audit(req: Request, action: string, target: string, detail?: string) {
  await db.insert(auditLogs).values({
    companyId: tenantId(req), userId: req.auth!.userId, userEmail: req.auth!.email,
    action, target, detail: detail ?? null, createdAt: new Date().toISOString(),
  });
}

export function registerProfessionalRoutes(app: Express) {
  app.get("/api/professional/clients", h(async (req, res) => {
    const memberships = await db.select().from(professionalMemberships)
      .where(and(eq(professionalMemberships.userId, req.auth!.userId), eq(professionalMemberships.status, "active"))).all();
    const rows = await Promise.all(memberships.map(async (membership) => ({
      ...membership,
      permissions: JSON.parse(membership.permissions || "[]"),
      company: await storage.getCompany(membership.companyId),
      active: membership.companyId === req.auth!.companyId,
    })));
    if (memberships.length > 0 && !rows.some((row) => row.companyId === req.auth!.user.companyId)) {
      const home = await storage.getCompany(req.auth!.user.companyId);
      rows.unshift({
        id: 0, userId: req.auth!.userId, companyId: req.auth!.user.companyId,
        professionalRole: req.auth!.user.role, permissions: [], status: "active",
        requiresTwoFactor: 0, accessExpiresAt: null, createdBy: null, createdAt: "", updatedAt: "",
        company: home, active: req.auth!.companyId === req.auth!.user.companyId,
      });
    }
    res.json({ clients: rows, activeCompanyId: req.auth!.companyId, professionalRole: req.auth!.role });
  }));

  app.post("/api/professional/switch-company", h(async (req, res) => {
    const companyId = Number(req.body?.companyId);
    if (companyId === req.auth!.user.companyId) {
      await storage.updateSessionCompany(sessionStorageKey(req.auth!.token), companyId);
      return res.json({ ok: true, companyId });
    }
    const membership = await db.select().from(professionalMemberships).where(and(
      eq(professionalMemberships.userId, req.auth!.userId),
      eq(professionalMemberships.companyId, companyId),
      eq(professionalMemberships.status, "active"),
    )).get();
    const companyMembership = await db.select().from(companyAccessMemberships).where(and(
      eq(companyAccessMemberships.userId, req.auth!.userId),
      eq(companyAccessMemberships.companyId, companyId),
      eq(companyAccessMemberships.status, "active"),
    )).get();
    if (!companyMembership && (!membership || (membership.accessExpiresAt && new Date(membership.accessExpiresAt).getTime() <= Date.now()))) {
      return res.status(403).json({ error: "Du har ikke aktiv adgang til denne klient." });
    }
    await storage.updateSessionCompany(sessionStorageKey(req.auth!.token), companyId);
    await audit(req, companyMembership ? "skift_selskab" : "skift_klient", companyMembership ? "company_access_membership" : "professional_membership", String(companyId));
    res.json({ ok: true, companyId });
  }));

  app.get("/api/professional/team", requireRole("leder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    if (ROLES.has(req.auth!.role) && !req.auth!.permissions.includes("users:manage")) return res.status(403).json({ error: "Brugeradministration er ikke tilladt." });
    const memberships = await db.select().from(professionalMemberships)
      .where(eq(professionalMemberships.companyId, tenantId(req))).orderBy(desc(professionalMemberships.createdAt)).all();
    const rows = await Promise.all(memberships.map(async (m) => {
      const user = await storage.getUser(m.userId);
      return { ...m, permissions: JSON.parse(m.permissions || "[]"), user: user ? { id: user.id, name: user.name, email: user.email, twoFactorEnabled: user.twoFactorEnabled } : null };
    }));
    res.json(rows);
  }));

  app.post("/api/professional/invite", requireRole("leder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    if (ROLES.has(req.auth!.role) && !req.auth!.permissions.includes("users:manage")) return res.status(403).json({ error: "Brugeradministration er ikke tilladt." });
    const companyId = tenantId(req);
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim();
    const role = String(req.body?.role ?? "revisor");
    if (!email.includes("@") || !ROLES.has(role)) return res.status(400).json({ error: "Angiv gyldig e-mail og fagrolle." });
    const permissions = cleanPermissions(role, req.body?.permissions);
    const expiresAt = req.body?.accessExpiresAt ? String(req.body.accessExpiresAt) : null;
    const existing = await storage.getUserByEmail(email);
    const now = new Date().toISOString();
    if (existing) {
      await db.insert(professionalMemberships).values({
        userId: existing.id, companyId, professionalRole: role, permissions: JSON.stringify(permissions),
        status: "active", requiresTwoFactor: 1, accessExpiresAt: expiresAt,
        createdBy: req.auth!.userId, createdAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: [professionalMemberships.userId, professionalMemberships.companyId],
        set: { professionalRole: role, permissions: JSON.stringify(permissions), status: "active", accessExpiresAt: expiresAt, updatedAt: now },
      });
      await queueAndSend({ companyId, channel: "email", recipient: email,
        subject: "Ny klientadgang i ADD SmartRegnskab",
        body: `Hej ${existing.name}\n\nDu har fået ${role}-adgang. Log ind og aktivér tofaktorgodkendelse for at åbne klienten.`, relatedType: "professional_access" });
    } else {
      const { token } = await issueToken("invitation", email, { companyId, payload: {
        role, name: name || email, professionalAccess: true, professionalRole: role,
        permissions, accessExpiresAt: expiresAt, invitedBy: req.auth!.userId,
      }});
      const base = process.env.APP_BASE_URL ?? "";
      await queueAndSend({ companyId, channel: "email", recipient: email,
        subject: "Invitation til ADD SmartRegnskab fagportal",
        body: `Hej\n\nDu er inviteret som ${role}. Opret din adgang her:\n${base}/#/invitation?token=${token}\n\nLinket virker i 24 timer.`, relatedType: "professional_invitation" });
    }
    await audit(req, "inviter_fagbruger", "professional_membership", `${email}:${role}`);
    res.status(201).json({ ok: true, email, role });
  }));

  app.patch("/api/professional/team/:id", requireRole("leder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    if (ROLES.has(req.auth!.role) && !req.auth!.permissions.includes("users:manage")) return res.status(403).json({ error: "Brugeradministration er ikke tilladt." });
    const id = Number(req.params.id);
    const current = await db.select().from(professionalMemberships).where(and(
      eq(professionalMemberships.id, id), eq(professionalMemberships.companyId, tenantId(req)),
    )).get();
    if (!current) return res.status(404).json({ error: "Fagadgangen findes ikke." });
    const role = ROLES.has(String(req.body?.role)) ? String(req.body.role) : current.professionalRole;
    const status = ["active", "suspended", "revoked"].includes(String(req.body?.status)) ? String(req.body.status) : current.status;
    const updated = await db.update(professionalMemberships).set({
      professionalRole: role, status,
      permissions: JSON.stringify(cleanPermissions(role, req.body?.permissions ?? JSON.parse(current.permissions))),
      accessExpiresAt: req.body?.accessExpiresAt === undefined ? current.accessExpiresAt : req.body.accessExpiresAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(professionalMemberships.id, id)).returning().get();
    if (status !== "active") await storage.deleteUserSessions(current.userId);
    await audit(req, "opdater_fagadgang", "professional_membership", `${id}:${status}`);
    res.json(updated);
  }));

  app.get("/api/professional/approvals", h(async (req, res) => {
    res.json(await db.select().from(professionalApprovals)
      .where(eq(professionalApprovals.companyId, tenantId(req))).orderBy(desc(professionalApprovals.createdAt)).all());
  }));

  app.post("/api/professional/approvals", h(async (req, res) => {
    if (["bogholder", "revisor", "revisor_admin"].includes(req.auth!.role) && !req.auth!.permissions.includes("approvals:request")) {
      return res.status(403).json({ error: "Du må ikke oprette godkendelsesanmodninger." });
    }
    const now = new Date().toISOString();
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Titel er påkrævet." });
    const item = await db.insert(professionalApprovals).values({
      companyId: tenantId(req), requestedBy: req.auth!.userId,
      assignedTo: req.body?.assignedTo ? Number(req.body.assignedTo) : null,
      approvalType: String(req.body?.approvalType ?? "bogfoering"),
      resourceType: req.body?.resourceType ? String(req.body.resourceType) : null,
      resourceId: req.body?.resourceId ? String(req.body.resourceId) : null,
      title, description: req.body?.description ? String(req.body.description) : null,
      status: "pending", dueDate: req.body?.dueDate ? String(req.body.dueDate) : null,
      createdAt: now, updatedAt: now,
    }).returning().get();
    await audit(req, "opret_godkendelse", "professional_approval", String(item.id));
    res.status(201).json(item);
  }));

  app.patch("/api/professional/approvals/:id/decision", h(async (req, res) => {
    const id = Number(req.params.id);
    const decision = String(req.body?.decision ?? "");
    if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "Vælg godkend eller afvis." });
    const current = await db.select().from(professionalApprovals).where(and(
      eq(professionalApprovals.id, id), eq(professionalApprovals.companyId, tenantId(req)),
    )).get();
    if (!current) return res.status(404).json({ error: "Godkendelsen findes ikke." });
    if (current.status !== "pending") return res.status(409).json({ error: "Godkendelsen er allerede afsluttet." });
    if (current.requestedBy === req.auth!.userId) return res.status(409).json({ error: "Du kan ikke godkende din egen handling." });
    const canDecide = req.auth!.role === "leder" || req.auth!.role === "platform_admin" || req.auth!.permissions.includes("approvals:decide");
    if (!canDecide) return res.status(403).json({ error: "Du har ikke godkendelsesret." });
    if (current.assignedTo && current.assignedTo !== req.auth!.userId && !["leder", "platform_admin"].includes(req.auth!.role)) {
      return res.status(403).json({ error: "Godkendelsen er tildelt en anden bruger." });
    }
    const now = new Date().toISOString();
    const updated = await db.update(professionalApprovals).set({
      status: decision, decisionNote: String(req.body?.note ?? ""), decidedBy: req.auth!.userId,
      decidedAt: now, updatedAt: now,
    }).where(eq(professionalApprovals.id, id)).returning().get();
    await audit(req, decision === "approved" ? "godkend" : "afvis", "professional_approval", String(id));
    res.json(updated);
  }));
}

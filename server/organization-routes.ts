import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditLogs, companyAccessMemberships, companyUnits, dimensionDefinitions, dimensionValues,
} from "@shared/schema";
import { db, storage } from "./storage";
import { requireRole, tenantId } from "./auth";

function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (error: any) {
      if (res.headersSent) return next(error);
      res.status(400).json({ error: String(error?.message ?? error) });
    }
  };
}

const digits8 = (value: unknown) => String(value ?? "").replace(/\D/g, "");

async function context(req: Request) {
  const home = await storage.getCompany(req.auth!.homeCompanyId);
  if (!home) throw new Error("Hjemvirksomheden findes ikke.");
  const ownerId = home.subscriptionOwnerId || home.id;
  const all = await storage.getCompanies();
  const companies = all.filter((company) => (company.subscriptionOwnerId || company.id) === ownerId);
  return { home, ownerId, companies };
}

async function audit(req: Request, action: string, target: string, detail?: string) {
  await db.insert(auditLogs).values({
    companyId: tenantId(req), userId: req.auth!.userId, userEmail: req.auth!.email,
    action, target, detail: detail ?? null, createdAt: new Date().toISOString(),
  });
}

export function registerOrganizationRoutes(app: Express) {
  app.get("/api/organization", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const { ownerId, companies } = await context(req);
    const companyIds = companies.map((company) => company.id);
    const units = companyIds.length
      ? await db.select().from(companyUnits).where(inArray(companyUnits.companyId, companyIds)).all()
      : [];
    const plan = await storage.getCompanyPlan(ownerId);
    res.json({
      ownerCompanyId: ownerId,
      activeCompanyId: req.auth!.companyId,
      companies,
      units,
      limits: { companies: companies.length, maxCompanies: plan?.maxCompanies ?? 1 },
    });
  }));

  app.post("/api/organization/companies", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!req.auth!.isPlatformAdmin && req.auth!.user.role !== "leder" && req.auth!.companyMembership?.role !== "leder") {
      return res.status(403).json({ error: "Kun virksomhedens leder kan oprette et juridisk selskab." });
    }
    const { home, ownerId, companies } = await context(req);
    const plan = await storage.getCompanyPlan(ownerId);
    const maxCompanies = plan?.maxCompanies ?? 1;
    if (maxCompanies !== -1 && companies.length >= maxCompanies) {
      return res.status(409).json({ error: `Pakken tillader ${maxCompanies} virksomhed${maxCompanies === 1 ? "" : "er"}. Opgradér pakken for at tilføje flere juridiske selskaber.` });
    }
    const name = String(req.body?.name ?? "").trim();
    const cvr = digits8(req.body?.cvr);
    const parentCompanyId = req.body?.parentCompanyId ? Number(req.body.parentCompanyId) : ownerId;
    const parent = companies.find((company) => company.id === parentCompanyId);
    if (!name || cvr.length !== 8) return res.status(400).json({ error: "Angiv selskabsnavn og et gyldigt CVR-nummer på 8 cifre." });
    if (!parent) return res.status(400).json({ error: "Moderselskabet skal være en del af samme kundeorganisation." });
    if ((await storage.getCompanies()).some((company) => company.cvr === cvr)) return res.status(409).json({ error: "CVR-nummeret findes allerede i ADD SmartRegnskab." });
    const ownershipPercent = req.body?.ownershipPercent === "" || req.body?.ownershipPercent == null
      ? null : Number(req.body.ownershipPercent);
    if (ownershipPercent != null && (!Number.isFinite(ownershipPercent) || ownershipPercent < 0 || ownershipPercent > 100)) {
      return res.status(400).json({ error: "Ejerandelen skal være mellem 0 og 100 procent." });
    }
    if (!home.subscriptionOwnerId || home.groupRole === "standalone") {
      await storage.updateCompany(ownerId, {
        subscriptionOwnerId: ownerId,
        groupRole: home.groupRole === "standalone" ? "parent" : home.groupRole,
      });
    }
    const company = await storage.createCompany({
      name, cvr, address: req.body?.address || null, email: req.body?.email || home.email,
      phone: req.body?.phone || null, status: home.status, kind: "kunde", createdAt: new Date().toISOString(),
      parentCompanyId, subscriptionOwnerId: ownerId,
      groupRole: String(req.body?.groupRole || "subsidiary"), ownershipPercent,
    } as any);
    await db.insert(companyAccessMemberships).values({
      userId: req.auth!.userId, companyId: company.id, role: "leder", status: "active", createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: [companyAccessMemberships.userId, companyAccessMemberships.companyId] });
    await audit(req, "opret_selskab", "company", `${company.name} (${company.cvr})`);
    res.status(201).json(company);
  }));

  app.patch("/api/organization/companies/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!req.auth!.isPlatformAdmin && req.auth!.user.role !== "leder" && req.auth!.companyMembership?.role !== "leder") {
      return res.status(403).json({ error: "Kun virksomhedens leder kan ændre selskabsstrukturen." });
    }
    const { ownerId, companies } = await context(req);
    const id = Number(req.params.id);
    const company = companies.find((item) => item.id === id);
    if (!company) return res.status(404).json({ error: "Selskabet findes ikke i denne kundeorganisation." });
    const parentCompanyId = req.body?.parentCompanyId === null ? null : Number(req.body?.parentCompanyId ?? company.parentCompanyId);
    if (parentCompanyId === id) return res.status(400).json({ error: "Et selskab kan ikke være sit eget moderselskab." });
    if (parentCompanyId && !companies.some((item) => item.id === parentCompanyId)) return res.status(400).json({ error: "Moderselskabet skal være i samme kundeorganisation." });
    const ownershipPercent = req.body?.ownershipPercent == null ? company.ownershipPercent : Number(req.body.ownershipPercent);
    const updated = await storage.updateCompany(id, {
      parentCompanyId: id === ownerId ? null : parentCompanyId,
      groupRole: String(req.body?.groupRole ?? company.groupRole),
      ownershipPercent,
    });
    await audit(req, "opdater_selskabsstruktur", "company", String(id));
    res.json(updated);
  }));

  app.post("/api/organization/units", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!req.auth!.isPlatformAdmin && req.auth!.user.role !== "leder" && req.auth!.companyMembership?.role !== "leder") {
      return res.status(403).json({ error: "Kun virksomhedens leder kan oprette en afdeling eller SE-enhed." });
    }
    const { companies } = await context(req);
    const companyId = Number(req.body?.companyId);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return res.status(404).json({ error: "Den juridiske virksomhed findes ikke i denne kundeorganisation." });
    const name = String(req.body?.name ?? "").trim();
    const unitType = req.body?.unitType === "se_unit" ? "se_unit" : "department";
    const seNumber = unitType === "se_unit" ? digits8(req.body?.seNumber) : null;
    if (!name) return res.status(400).json({ error: "Angiv enhedens navn." });
    if (unitType === "se_unit" && seNumber?.length !== 8) return res.status(400).json({ error: "Et SE-nummer skal bestå af 8 cifre." });
    if (seNumber && (await db.select().from(companyUnits).all()).some((unit) => unit.seNumber === seNumber)) {
      return res.status(409).json({ error: "SE-nummeret er allerede registreret." });
    }

    let definition = await db.select().from(dimensionDefinitions).where(and(
      eq(dimensionDefinitions.companyId, companyId), eq(dimensionDefinitions.code, "AFD"),
    )).get();
    if (!definition) {
      definition = await db.insert(dimensionDefinitions).values({
        companyId, name: "afdeling", code: "AFD", description: "Afdelinger og SE-enheder", isActive: true, createdAt: new Date().toISOString(),
      }).returning().get();
    }
    const code = seNumber || `AFD-${Date.now().toString(36).toUpperCase()}`;
    const dimensionValue = await db.insert(dimensionValues).values({ companyId, dimensionId: definition.id, code, name, parentId: null, isActive: true }).returning().get();
    const unit = await db.insert(companyUnits).values({
      companyId, name, seNumber, unitType, dimensionValueId: dimensionValue.id, active: 1, createdAt: new Date().toISOString(),
    }).returning().get();
    await audit(req, "opret_se_enhed", "company_unit", `${name}${seNumber ? ` (${seNumber})` : ""}`);
    res.status(201).json(unit);
  }));
}

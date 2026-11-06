import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, inArray, ne } from "drizzle-orm";
import {
  attachments, auditLogs, bankTransactions, companies, companyAccessMemberships, companyUnits,
  dimensionDefinitions, dimensionValues, documentInbox, invoices, journalEntries, payrollEntries,
  subscriptions, users,
} from "@shared/schema";
import { db, storage } from "./storage";
import { requireRole, tenantId } from "./auth";
import { ensureNemhandelRegistrationNotice } from "./nemhandel-registration-notice";

function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (error: any) {
      if (res.headersSent) return next(error);
      res.status(400).json({ error: String(error?.message ?? error) });
    }
  };
}

const digits8 = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalizedCompanyName = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("da-DK");

async function hasCompanyBusinessData(companyId: number) {
  const tables = [journalEntries, invoices, documentInbox, bankTransactions, payrollEntries, attachments] as const;
  for (const table of tables) {
    if (await db.select({ id: table.id }).from(table).where(eq(table.companyId, companyId)).get()) return true;
  }
  return false;
}

function wouldCreateCompanyCycle(
  companies: Array<{ id: number; parentCompanyId?: number | null }>,
  companyId: number,
  parentCompanyId: number | null,
) {
  if (parentCompanyId == null) return false;
  const byId = new Map(companies.map((company) => [company.id, company]));
  const visited = new Set<number>([companyId]);
  let current: number | null = parentCompanyId;
  while (current != null) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = byId.get(current)?.parentCompanyId ?? null;
  }
  return false;
}

async function context(req: Request) {
  // Brug altid den virksomhed, som den godkendte session aktuelt arbejder i.
  // Det er afgørende for fagbrugere, som kan skifte mellem flere klienter.
  const home = await storage.getCompany(tenantId(req));
  if (!home) throw new Error("Den aktive virksomhed findes ikke.");
  const ownerId = home.subscriptionOwnerId || home.id;
  const all = await storage.getCompanies();
  const organizationCompanies = all.filter((company) => (company.subscriptionOwnerId || company.id) === ownerId);
  const companies = organizationCompanies.filter((company) => company.groupRole !== "se_registration");
  const accountingScopes = organizationCompanies.filter((company) => company.groupRole === "se_registration");
  return { home, ownerId, companies, accountingScopes, organizationCompanies };
}

async function grantSeScopeAccess(parentCompanyId: number, accountingCompanyId: number, currentUserId: number, currentRole: string) {
  const directUsers = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.companyId, parentCompanyId)).all();
  const parentMemberships = await db.select().from(companyAccessMemberships).where(and(
    eq(companyAccessMemberships.companyId, parentCompanyId),
    eq(companyAccessMemberships.status, "active"),
  )).all();
  const roles = new Map<number, string>([[currentUserId, currentRole]]);
  for (const user of directUsers) roles.set(user.id, roles.get(user.id) || user.role);
  for (const membership of parentMemberships) roles.set(membership.userId, membership.role || "leder");
  const createdAt = new Date().toISOString();
  for (const [userId, role] of Array.from(roles.entries())) {
    await db.insert(companyAccessMemberships).values({
      userId, companyId: accountingCompanyId, role, status: "active", createdAt,
    }).onConflictDoNothing({ target: [companyAccessMemberships.userId, companyAccessMemberships.companyId] });
  }
}

async function audit(req: Request, action: string, target: string, detail?: string) {
  await db.insert(auditLogs).values({
    companyId: tenantId(req), userId: req.auth!.userId, userEmail: req.auth!.email,
    action, target, detail: detail ?? null, createdAt: new Date().toISOString(),
  });
}

export function registerOrganizationRoutes(app: Express) {
  app.get("/api/organization", requireRole("leder", "holdleder", "bogholder", "revisor", "revisor_admin", "platform_admin"), h(async (req, res) => {
    const { ownerId, companies, accountingScopes, organizationCompanies } = await context(req);
    const companyIds = companies.map((company) => company.id);
    const units = companyIds.length
      ? await db.select().from(companyUnits).where(inArray(companyUnits.companyId, companyIds)).all()
      : [];
    const plan = await storage.getCompanyPlan(ownerId);
    res.json({
      ownerCompanyId: ownerId,
      activeCompanyId: req.auth!.companyId,
      companies,
      accountingScopes,
      units,
      limits: { companies: organizationCompanies.length, legalCompanies: companies.length, maxCompanies: plan?.maxCompanies ?? 1 },
    });
  }));

  app.post("/api/organization/companies", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!req.auth!.isPlatformAdmin && req.auth!.user.role !== "leder" && req.auth!.companyMembership?.role !== "leder") {
      return res.status(403).json({ error: "Kun virksomhedens leder kan oprette et juridisk selskab." });
    }
    const { home, ownerId, companies, organizationCompanies } = await context(req);
    const plan = await storage.getCompanyPlan(ownerId);
    const maxCompanies = plan?.maxCompanies ?? 1;
    if (maxCompanies !== -1 && organizationCompanies.length >= maxCompanies) {
      return res.status(409).json({ error: `Pakken tillader ${maxCompanies} regnskabsprofil${maxCompanies === 1 ? "" : "er"}. Opgradér pakken for at tilføje et selskab eller særskilt SE-regnskab.` });
    }
    const name = String(req.body?.name ?? "").trim();
    const cvr = digits8(req.body?.cvr);
    // An explicit null means a separate legal company sharing the subscription,
    // not a subsidiary of the subscription owner.
    const parentCompanyId = req.body?.parentCompanyId === null
      ? null : req.body?.parentCompanyId ? Number(req.body.parentCompanyId) : ownerId;
    const parent = parentCompanyId == null ? null : companies.find((company) => company.id === parentCompanyId);
    if (!name || cvr.length !== 8) return res.status(400).json({ error: "Angiv selskabsnavn og et gyldigt CVR-nummer på 8 cifre." });
    if (parentCompanyId != null && !parent) return res.status(400).json({ error: "Moderselskabet skal være en del af samme kundeorganisation." });
    if ((await storage.getCompanies()).some((company) => company.cvr === cvr)) {
      return res.status(409).json({ error: "CVR-nummeret findes allerede i ADD SmartRegnskab.", code: "COMPANY_EXISTS" });
    }
    const ownershipPercent = req.body?.ownershipPercent === "" || req.body?.ownershipPercent == null
      ? null : Number(req.body.ownershipPercent);
    if (ownershipPercent != null && (!Number.isFinite(ownershipPercent) || ownershipPercent < 0 || ownershipPercent > 100)) {
      return res.status(400).json({ error: "Ejerandelen skal være mellem 0 og 100 procent." });
    }
    const groupRole = String(req.body?.groupRole || (parentCompanyId == null ? "standalone" : "subsidiary"));
    if (parentCompanyId == null && groupRole !== "standalone" && groupRole !== "holding") {
      return res.status(400).json({ error: "Vælg et internt moderselskab for denne selskabstype." });
    }
    if (!home.subscriptionOwnerId || (parentCompanyId != null && home.groupRole === "standalone")) {
      await storage.updateCompany(ownerId, {
        subscriptionOwnerId: ownerId,
        groupRole: parentCompanyId != null && home.groupRole === "standalone" ? "parent" : home.groupRole,
      });
    }
    const company = await storage.createCompany({
      name, cvr, address: req.body?.address || null, email: req.body?.email || home.email,
      phone: req.body?.phone || null, status: home.status, kind: "kunde", createdAt: new Date().toISOString(),
      parentCompanyId, subscriptionOwnerId: ownerId,
      groupRole, ownershipPercent: parentCompanyId == null ? null : ownershipPercent,
    } as any);
    await db.insert(companyAccessMemberships).values({
      userId: req.auth!.userId, companyId: company.id, role: "leder", status: "active", createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: [companyAccessMemberships.userId, companyAccessMemberships.companyId] });
    await audit(req, "opret_selskab", "company", `${company.name} (${company.cvr})`);
    await ensureNemhandelRegistrationNotice(company.id, req.auth!.userId);
    res.status(201).json(company);
  }));

  app.post("/api/organization/companies/attach-existing-holding", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!req.auth!.isPlatformAdmin && req.auth!.user.role !== "leder" && req.auth!.companyMembership?.role !== "leder") {
      return res.status(403).json({ error: "Kun virksomhedens leder kan tilknytte et holdingselskab." });
    }
    const { home, ownerId, organizationCompanies } = await context(req);
    const cvr = digits8(req.body?.cvr);
    const expectedName = normalizedCompanyName(req.body?.name);
    if (cvr.length !== 8 || !expectedName) {
      return res.status(400).json({ error: "Angiv holdingselskabets navn og et gyldigt CVR-nummer på 8 cifre." });
    }
    const allCompanies = await storage.getCompanies();
    const holding = allCompanies.find((company) => digits8(company.cvr) === cvr);
    if (!holding) return res.status(404).json({ error: "Holdingselskabet findes ikke i ADD SmartRegnskab." });
    if ((holding.subscriptionOwnerId || holding.id) === ownerId) {
      return res.status(200).json({ holding, child: await storage.getCompany(ownerId), alreadyAttached: true });
    }
    if (normalizedCompanyName(holding.name) !== expectedName || holding.groupRole !== "holding") {
      return res.status(409).json({ error: "Den eksisterende virksomhed matcher ikke det angivne holdingselskab." });
    }

    const activeMemberships = await db.select().from(companyAccessMemberships).where(and(
      eq(companyAccessMemberships.companyId, holding.id),
      eq(companyAccessMemberships.status, "active"),
    )).all();
    const currentLegalCompanies = organizationCompanies.filter((company) => company.groupRole !== "se_registration");
    const children = allCompanies.filter((company) => company.parentCompanyId === holding.id);
    const legacyOwnerId = holding.subscriptionOwnerId || holding.id;
    const legacyDuplicateChildren = children.length > 0 && children.every((child) =>
      (child.subscriptionOwnerId || child.id) === legacyOwnerId
      && currentLegalCompanies.some((current) =>
        current.id !== child.id
        && digits8(current.cvr) === digits8(child.cvr)
        && normalizedCompanyName(current.name) === normalizedCompanyName(child.name),
      ),
    );
    const alreadyAuthorized = activeMemberships.some((membership) => membership.userId === req.auth!.userId);
    if (!req.auth!.isPlatformAdmin && !alreadyAuthorized && !legacyDuplicateChildren) {
      return res.status(403).json({ error: "Din bruger har ikke adgang til det eksisterende holdingselskab, og det kan ikke genkendes som en tom ældre dublet." });
    }
    const directUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, holding.id)).all();
    const directSubscription = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.companyId, holding.id)).get();
    const unit = await db.select({ id: companyUnits.id }).from(companyUnits).where(eq(companyUnits.companyId, holding.id)).get();
    if (directUsers.length || directSubscription || (children.length && !legacyDuplicateChildren) || unit || await hasCompanyBusinessData(holding.id)) {
      return res.status(409).json({ error: "Holdingselskabet indeholder allerede brugere, abonnement, andre selskaber eller regnskabsdata og kan derfor ikke flyttes automatisk." });
    }

    const plan = await storage.getCompanyPlan(ownerId);
    const maxCompanies = plan?.maxCompanies ?? 1;
    if (maxCompanies !== -1 && organizationCompanies.length >= maxCompanies) {
      return res.status(409).json({ error: `Pakken tillader ${maxCompanies} regnskabsprofil${maxCompanies === 1 ? "" : "er"}. Opgradér pakken for at tilknytte holdingselskabet.` });
    }

    db.transaction((tx) => {
      if (legacyDuplicateChildren) {
        for (const child of children) {
          // Bevar den gamle dublet og dens data, men fjern den forældede
          // ejerrelation, så den flyttede holding ikke spænder over to konti.
          tx.update(companies).set({
            parentCompanyId: null,
            groupRole: "standalone",
            ownershipPercent: null,
          }).where(eq(companies.id, child.id)).run();
        }
      }
      tx.update(companyAccessMemberships).set({ status: "revoked" }).where(and(
        eq(companyAccessMemberships.companyId, holding.id),
        ne(companyAccessMemberships.userId, req.auth!.userId),
      )).run();
      tx.update(companies).set({
        subscriptionOwnerId: ownerId,
        parentCompanyId: null,
        groupRole: "holding",
        ownershipPercent: null,
        status: home.status,
      }).where(eq(companies.id, holding.id)).run();
      tx.update(companies).set({
        parentCompanyId: holding.id,
        groupRole: "subsidiary",
        ownershipPercent: 100,
      }).where(eq(companies.id, ownerId)).run();
      tx.insert(companyAccessMemberships).values({
        userId: req.auth!.userId,
        companyId: holding.id,
        role: "leder",
        status: "active",
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing({ target: [companyAccessMemberships.userId, companyAccessMemberships.companyId] }).run();
    });

    const attachedHolding = await storage.getCompany(holding.id);
    const child = await storage.getCompany(ownerId);
    await audit(req, "tilknyt_eksisterende_holding", "company", `${holding.name} (${holding.cvr}) -> ${child?.name || ownerId}${legacyDuplicateChildren ? "; gammel dublet frigjort" : ""}`);
    res.json({ holding: attachedHolding, child, alreadyAttached: false });
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
    if (wouldCreateCompanyCycle(companies, id, parentCompanyId)) {
      return res.status(400).json({ error: "Selskabsstrukturen må ikke indeholde en cirkel." });
    }
    const ownershipPercent = req.body?.ownershipPercent == null ? company.ownershipPercent : Number(req.body.ownershipPercent);
    const groupRole = String(req.body?.groupRole ?? company.groupRole);
    if (parentCompanyId == null && groupRole !== "standalone" && groupRole !== "holding" && groupRole !== "parent") {
      return res.status(400).json({ error: "Et selskab uden internt moderselskab skal være selvstændigt, holding eller moderselskab." });
    }
    const updated = await storage.updateCompany(id, {
      // Abonnementsejeren er en faktureringsrolle, ikke nødvendigvis det juridiske
      // moderselskab. Et driftsselskab kan derfor fortsat eje abonnementet, selv om
      // en holding placeres over det i koncernstrukturen.
      parentCompanyId,
      groupRole,
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
    const existingUnit = seNumber
      ? (await db.select().from(companyUnits).all()).find((unit) => unit.seNumber === seNumber)
      : undefined;

    if (existingUnit) {
      // existingUnit kan kun være fundet, når seNumber er sat ovenfor.
      const verifiedSeNumber = seNumber as string;
      if (existingUnit.companyId === companyId) {
        return res.status(200).json(existingUnit);
      }

      // Tidligere versioner kunne efterlade en SE-enhed under en gammel kopi af
      // samme juridiske virksomhed. Genknyt kun automatisk, når CVR-numrene er
      // identiske. Dermed kan et SE-nummer aldrig flyttes mellem to forskellige
      // juridiske virksomheder af en almindelig leder.
      const existingCompany = await storage.getCompany(existingUnit.companyId);
      if (!existingCompany?.cvr || digits8(existingCompany.cvr) !== digits8(company.cvr)) {
        return res.status(409).json({ error: "SE-nummeret er allerede registreret under en anden juridisk virksomhed." });
      }

      let definition = await db.select().from(dimensionDefinitions).where(and(
        eq(dimensionDefinitions.companyId, companyId), eq(dimensionDefinitions.code, "AFD"),
      )).get();
      if (!definition) {
        definition = await db.insert(dimensionDefinitions).values({
          companyId, name: "afdeling", code: "AFD", description: "Afdelinger og SE-enheder", isActive: true, createdAt: new Date().toISOString(),
        }).returning().get();
      }
      let dimensionValue = await db.select().from(dimensionValues).where(and(
        eq(dimensionValues.companyId, companyId), eq(dimensionValues.code, verifiedSeNumber),
      )).get();
      if (!dimensionValue) {
        dimensionValue = await db.insert(dimensionValues).values({
          companyId, dimensionId: definition.id, code: verifiedSeNumber, name, parentId: null, isActive: true,
        }).returning().get();
      }
      const restoredUnit = await db.update(companyUnits).set({
        companyId, name, unitType: "se_unit", dimensionValueId: dimensionValue.id, active: 1,
      }).where(eq(companyUnits.id, existingUnit.id)).returning().get();
      await audit(req, "genknyt_se_enhed", "company_unit", `${name} (${seNumber})`);
      return res.status(200).json(restoredUnit);
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

  app.post("/api/organization/units/:id/accounting-scope", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!req.auth!.isPlatformAdmin && req.auth!.user.role !== "leder" && req.auth!.companyMembership?.role !== "leder") {
      return res.status(403).json({ error: "Kun virksomhedens leder kan oprette et særskilt SE-regnskab." });
    }
    const { ownerId, companies, accountingScopes, organizationCompanies } = await context(req);
    const unitId = Number(req.params.id);
    const unit = await db.select().from(companyUnits).where(eq(companyUnits.id, unitId)).get();
    const parent = unit ? companies.find((company) => company.id === unit.companyId) : undefined;
    if (!unit || !parent) return res.status(404).json({ error: "SE-enheden findes ikke i denne kundeorganisation." });
    if (unit.unitType !== "se_unit" || !unit.seNumber) {
      return res.status(409).json({ error: "Kun en SE-enhed kan få et særskilt moms- og lønregnskab." });
    }

    let accountingCompany = unit.accountingCompanyId
      ? accountingScopes.find((company) => company.id === unit.accountingCompanyId)
      : undefined;
    if (!accountingCompany) {
      accountingCompany = accountingScopes.find((company) =>
        company.parentCompanyId === parent.id && digits8(company.cvr) === digits8(unit.seNumber),
      );
    }
    if (!accountingCompany) {
      const plan = await storage.getCompanyPlan(ownerId);
      const maxProfiles = plan?.maxCompanies ?? 1;
      if (maxProfiles !== -1 && organizationCompanies.length >= maxProfiles) {
        return res.status(409).json({ error: `Pakken tillader ${maxProfiles} regnskabsprofil${maxProfiles === 1 ? "" : "er"}. Opgradér pakken for at oprette det særskilte SE-regnskab.` });
      }
      accountingCompany = await storage.createCompany({
        name: unit.name,
        cvr: unit.seNumber,
        address: parent.address,
        phone: parent.phone,
        email: parent.email,
        website: parent.website,
        status: parent.status,
        kind: "kunde",
        createdAt: new Date().toISOString(),
        parentCompanyId: parent.id,
        subscriptionOwnerId: ownerId,
        groupRole: "se_registration",
        ownershipPercent: null,
        vatRate: parent.vatRate,
        vatMode: parent.vatMode,
        currency: parent.currency,
        retentionTimeEntries: parent.retentionTimeEntries,
        retentionGps: parent.retentionGps,
        retentionAbsences: parent.retentionAbsences,
        retentionPhotos: parent.retentionPhotos,
        paymentTerms: parent.paymentTerms,
      } as any);
    }
    await grantSeScopeAccess(parent.id, accountingCompany.id, req.auth!.userId, req.auth!.role);
    const updatedUnit = await db.update(companyUnits).set({
      accountingCompanyId: accountingCompany.id,
    }).where(eq(companyUnits.id, unit.id)).returning().get();
    await audit(req, "opret_se_regnskab", "company_unit", `${unit.name} (SE ${unit.seNumber})`);
    res.status(unit.accountingCompanyId ? 200 : 201).json({ unit: updatedUnit, accountingCompany });
  }));
}

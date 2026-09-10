import { db } from "./storage";
import { companies, plans, users } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

const DEFAULT_PLANS = [
  { name: "Start", slug: "start", description: "Bogføring, kontoplan, bilag og fakturering.", monthlyPrice: 199, pricePerEmployee: 0, maxEmployees: 3, maxCustomers: 100, features: ["regnskab", "fakturering", "bilag", "moms"], sortOrder: 1 },
  { name: "Virksomhed", slug: "virksomhed", description: "Bankafstemning, budget, løn og automatisering.", monthlyPrice: 499, pricePerEmployee: 0, maxEmployees: 15, maxCustomers: -1, features: ["regnskab", "fakturering", "bilag", "moms", "bank", "budget", "loen", "automation"], sortOrder: 2 },
  { name: "Professionel", slug: "professionel", description: "Komplet regnskab, revision, integrationer og backup.", monthlyPrice: 999, pricePerEmployee: 0, maxEmployees: -1, maxCustomers: -1, features: ["regnskab", "fakturering", "bilag", "moms", "bank", "budget", "loen", "automation", "revision", "api_integration", "backup", "gdpr_vaerktoejer"], sortOrder: 3 },
  { name: "Enterprise", slug: "enterprise", description: "Alle funktioner, koncern, API, kontrolspor og SLA.", monthlyPrice: 1999, pricePerEmployee: 0, maxEmployees: -1, maxCustomers: -1, features: ["regnskab", "fakturering", "bilag", "moms", "bank", "budget", "loen", "automation", "revision", "api_integration", "backup", "gdpr_vaerktoejer", "konsolidering", "support_sla"], sortOrder: 4 },
] as const;

export function seedSystemData(): void {
  if (db.select().from(plans).all().length === 0) {
    db.transaction((tx) => {
      for (const plan of DEFAULT_PLANS) {
        tx.insert(plans).values({ ...plan, features: JSON.stringify(plan.features), active: 1 }).run();
      }
    });
  }

  // Hold den systemejede platformskonto synkroniseret med den juridiske
  // udbyder. Kundernes virksomhedsoplysninger berøres aldrig.
  const platformIdentity = {
    name: process.env.PLATFORM_COMPANY_NAME?.trim() || "ADD SmartDrift ApS",
    cvr: process.env.PLATFORM_COMPANY_CVR?.trim() || "46761898",
    address: process.env.PLATFORM_COMPANY_ADDRESS?.trim() || "Lynæs Søpark 49, 3390 Hundested",
  };
  const existingPlatform = db.select().from(companies).all().find((company) => company.kind === "platform");
  if (existingPlatform) {
    db.update(companies).set(platformIdentity).where(eq(companies.id, existingPlatform.id)).run();
  }

  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 12) {
    throw new Error("PLATFORM_ADMIN_EMAIL og PLATFORM_ADMIN_PASSWORD (mindst 12 tegn) skal sættes sammen.");
  }
  if (db.select().from(users).all().some((user) => user.role === "platform_admin")) return;

  db.transaction((tx) => {
    const company = tx.insert(companies).values({
      ...platformIdentity,
      email,
      status: "aktiv",
      kind: "platform",
      createdAt: new Date().toISOString(),
    }).returning().get();
    tx.insert(users).values({
      companyId: company.id,
      name: "Platform Administrator",
      email,
      password: hashPassword(password),
      emailVerified: 1,
      role: "platform_admin",
      active: 1,
    }).run();
  });
}

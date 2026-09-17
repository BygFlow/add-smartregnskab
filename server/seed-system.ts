import { db } from "./storage";
import { companies, plans, users } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

const DEFAULT_PLANS = [
  {
    name: "Start", slug: "start",
    description: "Gratis grundpakke til selvstændige, der vil i gang med digital bogføring.",
    monthlyPrice: 0, pricePerEmployee: 0, maxUsers: 1, maxEmployees: 0, maxCustomers: -1,
    features: ["regnskab", "kontoplan", "bilag", "fakturering", "moms", "rapporter", "bank_csv", "revisoradgang"],
    sortOrder: 1,
  },
  {
    name: "Virksomhed", slug: "virksomhed",
    description: "Automatiseret bogføring, bank, betalinger og økonomistyring til virksomheder i vækst.",
    monthlyPrice: 199, pricePerEmployee: 0, maxUsers: 3, maxEmployees: 10, maxCustomers: -1,
    features: [
      "regnskab", "kontoplan", "bilag", "fakturering", "moms", "rapporter", "bank_csv", "revisoradgang",
      "bank", "ai_bogforing", "automation", "faste_fakturaer", "debitorstyring", "budget", "cashflow",
      "nemhandel", "betalinger", "loen",
    ],
    sortOrder: 2,
  },
  {
    name: "Professionel", slug: "professionel",
    description: "Fuld økonomifunktion med avanceret kontrol, revision, integrationer og sikker backup.",
    monthlyPrice: 399, pricePerEmployee: 0, maxUsers: 10, maxEmployees: 50, maxCustomers: -1,
    features: [
      "regnskab", "kontoplan", "bilag", "fakturering", "moms", "rapporter", "bank_csv", "revisoradgang",
      "bank", "ai_bogforing", "automation", "faste_fakturaer", "debitorstyring", "budget", "cashflow",
      "nemhandel", "betalinger", "loen", "revision", "periodeafslutning", "aarsrapport", "saft",
      "api_integration", "backup", "gdpr_vaerktoejer", "dimensioner",
    ],
    sortOrder: 3,
  },
  {
    name: "Enterprise", slug: "enterprise",
    description: "Alle funktioner, koncernregnskab, udvidet API, kontrolspor og prioriteret SLA.",
    monthlyPrice: 699, pricePerEmployee: 0, maxUsers: -1, maxEmployees: -1, maxCustomers: -1,
    features: [
      "regnskab", "kontoplan", "bilag", "fakturering", "moms", "rapporter", "bank_csv", "revisoradgang",
      "bank", "ai_bogforing", "automation", "faste_fakturaer", "debitorstyring", "budget", "cashflow",
      "nemhandel", "betalinger", "loen", "revision", "periodeafslutning", "aarsrapport", "saft",
      "api_integration", "backup", "gdpr_vaerktoejer", "dimensioner", "konsolidering", "workflow_builder",
      "dedikeret_onboarding", "support_sla",
    ],
    sortOrder: 4,
  },
] as const;

const LEGACY_PLAN_FEATURES: Record<string, string[][]> = {
  start: [
    ["regnskab", "fakturering", "bilag", "moms"],
    ["opgaver", "tidsregistrering", "kunder", "fakturering"],
  ],
  virksomhed: [
    ["regnskab", "fakturering", "bilag", "moms", "bank", "budget", "loen", "automation"],
  ],
  drift: [[
    "opgaver", "tidsregistrering", "kunder", "fakturering", "vagtplan", "fravaer", "fotodokumentation",
    "loen_eksport", "regnskab_eksport", "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler",
    "api_integration", "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "gdpr_vaerktoejer",
  ]],
  professionel: [
    ["regnskab", "fakturering", "bilag", "moms", "bank", "budget", "loen", "automation", "revision", "api_integration", "backup", "gdpr_vaerktoejer"],
    [
      "opgaver", "tidsregistrering", "kunder", "fakturering", "vagtplan", "fravaer", "fotodokumentation",
      "loen_eksport", "regnskab_eksport", "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler",
      "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "regnskab", "backup",
    ],
  ],
  enterprise: [
    ["regnskab", "fakturering", "bilag", "moms", "bank", "budget", "loen", "automation", "revision", "api_integration", "backup", "gdpr_vaerktoejer", "konsolidering", "support_sla"],
    [
      "opgaver", "tidsregistrering", "kunder", "fakturering", "vagtplan", "fravaer", "fotodokumentation",
      "loen_eksport", "regnskab_eksport", "geofence", "api_integration", "revisionsspor", "tilbud", "materialer",
      "kvalitetskontrol", "noegler", "gdpr_vaerktoejer", "skabeloner", "rengoringsservice", "rengoringsaftaler",
      "rengoringsplaner", "regnskab", "backup", "support_sla",
    ],
  ],
};

const LEGACY_PLAN_PRICES: Record<string, number[]> = {
  start: [199],
  virksomhed: [499],
  drift: [499],
  professionel: [999],
  enterprise: [1999],
};

function sameFeatureSet(raw: string, expected: string[]): boolean {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      && parsed.length === expected.length
      && expected.every((feature) => parsed.includes(feature));
  } catch {
    return false;
  }
}

export function seedSystemData(): void {
  const existingPlans = db.select().from(plans).all();
  if (existingPlans.length === 0) {
    db.transaction((tx) => {
      for (const plan of DEFAULT_PLANS) {
        tx.insert(plans).values({ ...plan, features: JSON.stringify(plan.features), active: 1 }).run();
      }
    });
  } else {
    // Opgradér kun de tidligere standardpakker. Pakker som en administrator
    // selv har ændret, bliver bevidst ikke overskrevet.
    db.transaction((tx) => {
      for (const plan of DEFAULT_PLANS) {
        const exists = existingPlans.some((item) => item.slug === plan.slug || (plan.slug === "virksomhed" && item.slug === "drift"));
        if (!exists) tx.insert(plans).values({ ...plan, features: JSON.stringify(plan.features), active: 1 }).run();
      }
      for (const current of existingPlans) {
        const targetSlug = current.slug === "drift" ? "virksomhed" : current.slug;
        const plan = DEFAULT_PLANS.find((item) => item.slug === targetSlug);
        const legacyVariants = LEGACY_PLAN_FEATURES[current.slug];
        const usesLegacyFeatures = legacyVariants?.some((legacy) => sameFeatureSet(current.features, legacy)) ?? false;
        const usesLegacyPrice = LEGACY_PLAN_PRICES[current.slug]?.includes(Number(current.monthlyPrice)) ?? false;
        if (!plan || (!usesLegacyFeatures && !usesLegacyPrice)) continue;
        tx.update(plans).set({
          name: plan.name,
          description: plan.description,
          ...(usesLegacyFeatures ? { features: JSON.stringify(plan.features) } : {}),
          ...(usesLegacyPrice ? {
            monthlyPrice: plan.monthlyPrice,
            pricePerEmployee: plan.pricePerEmployee,
            maxUsers: plan.maxUsers,
            maxEmployees: plan.maxEmployees,
            maxCustomers: plan.maxCustomers,
          } : {}),
          sortOrder: plan.sortOrder,
        }).where(eq(plans.id, current.id)).run();
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
    const company = existingPlatform
      ? tx.update(companies).set({ ...platformIdentity, email, status: "aktiv" })
          .where(eq(companies.id, existingPlatform.id)).returning().get()
      : tx.insert(companies).values({
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

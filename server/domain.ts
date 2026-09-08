import { storage } from "./storage";
import type { Task, Customer, Absence } from "@shared/schema";

// ══════════════════════════════════════════════════
//  Geofence — var medarbejderen faktisk på adressen?
// ══════════════════════════════════════════════════

/** Afstand i meter mellem to koordinater (haversine). */
export function distanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export interface GeofenceResult {
  status: "indenfor" | "udenfor" | "ingen_gps" | "ukendt";
  distance: number | null;
  message: string | null;
}

/**
 * Sammenholder et check-in med kundens adresse. Returnerer "ukendt", hvis
 * kunden ikke har koordinater — vi påstår ikke noget, vi ikke kan vide.
 */
export async function evaluateGeofence(
  companyId: number,
  taskId: number | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
  directCustomerId?: number | null,
): Promise<GeofenceResult> {
  if (lat == null || lng == null) {
    return { status: "ingen_gps", distance: null, message: "Registreret uden GPS." };
  }

  // Enten peger vi på en opgave (og bruger dens kunde), eller direkte på en kunde.
  let customerId: number | null = directCustomerId ?? null;
  if (!customerId) {
    if (!taskId) return { status: "ukendt", distance: null, message: null };
    const task = await storage.getTask(taskId, companyId);
    if (!task?.customerId) return { status: "ukendt", distance: null, message: null };
    customerId = task.customerId;
  }

  const customer = await storage.getCustomer(customerId, companyId);
  if (!customer || customer.lat == null || customer.lng == null) {
    return { status: "ukendt", distance: null, message: null };
  }

  const dist = distanceMeters(lat, lng, customer.lat, customer.lng);
  const radius = customer.geofenceRadius || 150;
  if (dist <= radius) {
    return { status: "indenfor", distance: dist, message: `${dist} m fra ${customer.name}.` };
  }
  return {
    status: "udenfor",
    distance: dist,
    message: `Check-in var ${dist} m fra ${customer.name} (grænse ${radius} m).`,
  };
}

// ══════════════════════════════════════════════════
//  Gentagende opgaver — genererer faktisk rækkerne
// ══════════════════════════════════════════════════

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

const MAX_GENERATED = 180; // sikkerhedsloft, så et forkert slutdato ikke laver 10.000 rækker

/**
 * Opretter de kommende forekomster af en tilbagevendende opgave.
 * Kaldes når opgaven gemmes. Returnerer antal oprettede opgaver.
 */
export async function generateRecurrences(parent: Task): Promise<number> {
  if (parent.recurrence === "ingen" || !parent.recurrenceEndDate) return 0;
  if (parent.parentTaskId) return 0; // undgå kæder af kæder

  const step = (iso: string): string => {
    if (parent.recurrence === "daglig") return addDays(iso, 1);
    if (parent.recurrence === "ugentlig") return addDays(iso, 7);
    if (parent.recurrence === "maanedlig") return addMonths(iso, 1);
    return iso;
  };

  // Undgå dubletter, hvis opgaven gemmes to gange
  const existing = new Set(
    (await storage.getTasks(parent.companyId))
      .filter((t) => t.parentTaskId === parent.id)
      .map((t) => t.date),
  );

  let created = 0;
  let cursor = step(parent.date);

  while (cursor <= parent.recurrenceEndDate && created < MAX_GENERATED) {
    if (!existing.has(cursor)) {
      await storage.createTask({
        companyId: parent.companyId,
        title: parent.title,
        customerId: parent.customerId,
        employeeId: parent.employeeId,
        date: cursor,
        startTime: parent.startTime,
        endTime: parent.endTime,
        status: "planlagt",
        priority: parent.priority,
        description: parent.description,
        checklist: parent.checklist,
        recurrence: "ingen", // kun forælderen bærer reglen
        recurrenceEndDate: null,
        parentTaskId: parent.id,
      });
      created++;
    }
    const next = step(cursor);
    if (next === cursor) break; // værn mod uendelig løkke
    cursor = next;
  }
  return created;
}

// ══════════════════════════════════════════════════
//  Fravær — påvirker lønnen
// ══════════════════════════════════════════════════

export const ABSENCE_LABELS: Record<string, string> = {
  ferie: "Ferie",
  sygdom: "Sygdom",
  barn_syg: "Barns 1. sygedag",
  barsel: "Barsel",
  omsorgsdag: "Omsorgsdag",
  andet: "Andet fravær",
};

/** Lønarter pr. fraværstype — bruges i lønsynk og eksport. */
export const ABSENCE_WAGE_CODES: Record<string, string> = {
  ferie: "Ferie",
  sygdom: "Sygeløn",
  barn_syg: "Barns sygedag",
  barsel: "Barselsorlov",
  omsorgsdag: "Omsorgsdag",
  andet: "Øvrigt fravær",
};

function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    const day = new Date(`${cursor}T00:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) out.push(cursor); // spring weekender
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

/** Godkendte fraværstimer i en periode, grupperet pr. ansat og type. */
export async function absenceHours(
  companyId: number,
  from: string,
  to: string,
): Promise<Array<{ employeeId: number; type: string; hours: number; days: number }>> {
  const all = await storage.getAbsences(companyId);
  const map = new Map<string, { employeeId: number; type: string; hours: number; days: number }>();

  for (const a of all) {
    if (a.status !== "godkendt" || !a.paid) continue;
    // Kun de dage der overlapper med den ønskede periode
    const start = a.startDate > from ? a.startDate : from;
    const end = a.endDate < to ? a.endDate : to;
    if (start > end) continue;

    const days = weekdaysBetween(start, end);
    if (!days.length) continue;

    const key = `${a.employeeId}:${a.type}`;
    const prev = map.get(key) ?? { employeeId: a.employeeId, type: a.type, hours: 0, days: 0 };
    prev.hours += days.length * a.hoursPerDay;
    prev.days += days.length;
    map.set(key, prev);
  }
  return Array.from(map.values());
}

/** Er den ansatte fraværende på en given dato? Bruges af vagtplanen. */
export async function absenceOnDate(
  companyId: number,
  employeeId: number,
  date: string,
): Promise<Absence | undefined> {
  const all = await storage.getAbsences(companyId);
  return all.find(
    (a) =>
      a.employeeId === employeeId &&
      a.status === "godkendt" &&
      a.startDate <= date &&
      a.endDate >= date,
  );
}

// ══════════════════════════════════════════════════
//  Fakturaer — moms, forfald, rykkere
// ══════════════════════════════════════════════════

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface InvoiceTotals {
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export function computeTotals(
  lines: Array<{ amount: number; vatRate?: number }>,
  defaultVatRate = 25,
): InvoiceTotals {
  let net = 0;
  let vat = 0;
  for (const l of lines) {
    net += l.amount;
    vat += l.amount * ((l.vatRate ?? defaultVatRate) / 100);
  }
  return { netAmount: round2(net), vatAmount: round2(vat), totalAmount: round2(net + vat) };
}

export function dueDateFrom(issueDate: string, terms: number): string {
  return addDays(issueDate, terms);
}

/** Fakturaer der er sendt, ikke betalt, og hvor forfaldsdatoen er overskredet. */
export async function overdueInvoices(companyId: number, today: string) {
  const list = await storage.getInvoices(companyId);
  return list.filter(
    (i) => i.status === "sendt" && !i.paidAt && i.dueDate && i.dueDate < today,
  );
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00Z`).getTime();
  const d2 = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((d2 - d1) / 86400_000);
}

// ══════════════════════════════════════════════════
//  Abonnementsfakturering — ADD SmartRegnskab → virksomheden
// ══════════════════════════════════════════════════

export { addDays, addMonths };

export interface BillingPreview {
  planName: string;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  employeeCount: number;
  basePrice: number;
  perEmployee: number;
  employeeCharge: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * Beregner en periodes abonnementspris: fast pakkepris plus pris pr. ansat.
 */
export async function previewBilling(companyId: number): Promise<BillingPreview | null> {
  const sub = await storage.getSubscriptionByCompany(companyId);
  if (!sub) return null;
  const plan = await storage.getPlan(sub.planId);
  if (!plan) return null;

  const employeeCount = (await storage.getEmployees(companyId)).length;
  const employeeCharge = round2(employeeCount * plan.pricePerEmployee);
  let net = round2(plan.monthlyPrice + employeeCharge);

  // Årlig betaling: 12 måneder med 2 måneders rabat
  if (sub.billingCycle === "aarlig") net = round2(net * 10);

  const vat = round2(net * 0.25);
  return {
    planName: plan.name,
    billingCycle: sub.billingCycle,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    employeeCount,
    basePrice: plan.monthlyPrice,
    perEmployee: plan.pricePerEmployee,
    employeeCharge,
    netAmount: net,
    vatAmount: vat,
    totalAmount: round2(net + vat),
  };
}

/** Udsteder abonnementsfaktura for indeværende periode og ruller perioden frem. */
export async function issueSubscriptionInvoice(companyId: number, today: string) {
  const sub = await storage.getSubscriptionByCompany(companyId);
  if (!sub) throw new Error("Virksomheden har ikke et abonnement.");
  const preview = await previewBilling(companyId);
  if (!preview) throw new Error("Kunne ikke beregne abonnementsprisen.");

  const existing = await storage.getPlatformInvoices();
  const seq = existing.length + 1;
  const months = sub.billingCycle === "aarlig" ? 12 : 1;

  const invoice = await storage.createPlatformInvoice({
    companyId,
    subscriptionId: sub.id,
    invoiceNumber: `RA-${new Date(today).getFullYear()}-${String(seq).padStart(4, "0")}`,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    planName: preview.planName,
    employeeCount: preview.employeeCount,
    netAmount: preview.netAmount,
    vatAmount: preview.vatAmount,
    totalAmount: preview.totalAmount,
    status: "udstedt",
    issueDate: today,
    dueDate: addDays(today, 14),
    paidAt: null,
  });

  // Rul abonnementsperioden frem
  const nextStart = sub.currentPeriodEnd;
  await storage.updateSubscription(sub.id, {
    currentPeriodStart: nextStart,
    currentPeriodEnd: addMonths(nextStart, months),
    status: sub.status === "proeve" ? "aktiv" : sub.status,
  });

  return invoice;
}

/** Samlet månedlig omsætning på tværs af aktive abonnementer. */
export async function platformMetrics(today: string) {
  const allCompanies = await storage.getCompanies();
  const companies = allCompanies.filter((c) => (c as any).kind !== "platform");
  const subs = await storage.getSubscriptions();
  const allPlans = await storage.getPlans();
  const planById = new Map(allPlans.map((p) => [p.id, p]));

  let mrr = 0;
  let activeCount = 0;
  let trialCount = 0;
  let arrearsCount = 0;
  let blockedCount = 0;
  let totalEmployees = 0;

  for (const c of companies) {
    if (c.status === "spaerret") blockedCount++;
    if (c.status === "i_restance") arrearsCount++;
    const employees = (await storage.getEmployees(c.id)).length;
    totalEmployees += employees;

    const sub = subs.find((s) => s.companyId === c.id);
    if (!sub) continue;
    const plan = planById.get(sub.planId);
    if (!plan) continue;

    if (sub.status === "proeve") { trialCount++; continue; }
    if (sub.status !== "aktiv") continue;
    activeCount++;

    const monthly = plan.monthlyPrice + employees * plan.pricePerEmployee;
    // Årsabonnementer regnes om til en månedlig værdi (10 mdr. betalt over 12)
    mrr += sub.billingCycle === "aarlig" ? (monthly * 10) / 12 : monthly;
  }

  const invoices = await storage.getPlatformInvoices();
  const outstanding = invoices
    .filter((i) => i.status !== "betalt")
    .reduce((s, i) => s + i.totalAmount, 0);

  return {
    companyCount: companies.length,
    activeCount,
    trialCount,
    arrearsCount,
    blockedCount,
    totalEmployees,
    mrr: round2(mrr),
    arr: round2(mrr * 12),
    outstanding: round2(outstanding),
    invoiceCount: invoices.length,
  };
}

// ══════════════════════════════════════════════════
//  MOMS — konfigurerbar pr. virksomhed
// ══════════════════════════════════════════════════

export interface VatSetup {
  rate: number;          // procentsats der skal bruges på linjerne
  mode: string;          // dansk, eu_omvendt, eksport_fritaget, momsfri
  note: string | null;   // lovpligtig påtegning på fakturaen
  reverseCharge: boolean;
}

/**
 * Slår virksomhedens momsopsætning op. Dansk salg giver den almindelige sats,
 * mens EU-handel med omvendt betalingspligt og eksport uden for EU giver 0 %
 * plus en påtegning, som momsbekendtgørelsen kræver står på fakturaen.
 */
export async function vatSetupFor(companyId: number): Promise<VatSetup> {
  const company = await storage.getCompany(companyId);
  const mode = company?.vatMode ?? "dansk";
  const rate = company?.vatRate ?? 25;
  switch (mode) {
    case "eu_omvendt":
      return {
        rate: 0,
        mode,
        reverseCharge: true,
        note: "Omvendt betalingspligt — køber afregner momsen (reverse charge, jf. momslovens § 46).",
      };
    case "eksport_fritaget":
      return {
        rate: 0,
        mode,
        reverseCharge: false,
        note: "Momsfri levering til land uden for EU, jf. momslovens § 34.",
      };
    case "momsfri":
      return {
        rate: 0,
        mode,
        reverseCharge: false,
        note: "Virksomheden er ikke momsregistreret. Der opkræves ikke moms.",
      };
    default:
      return { rate, mode: "dansk", reverseCharge: false, note: null };
  }
}

export const VAT_MODE_LABELS: Record<string, string> = {
  dansk: "Dansk moms",
  eu_omvendt: "EU — omvendt betalingspligt",
  eksport_fritaget: "Eksport uden for EU (momsfri)",
  momsfri: "Ikke momsregistreret",
};

// ══════════════════════════════════════════════════
//  KONTRAKTPRIS — hvad skal kunden betale for perioden
// ══════════════════════════════════════════════════

export interface ContractCharge {
  model: string;
  description: string;
  hours: number;
  includedHours: number;
  overtimeHours: number;
  baseAmount: number;
  overtimeAmount: number;
  netAmount: number;
}

/**
 * Beregner periodens beløb ud fra kundens aftale i stedet for en løs timepris.
 * Ved fast månedspris faktureres grundbeløbet, og kun timer ud over det
 * aftalte antal afregnes til overtidssatsen.
 */
export function contractCharge(
  contract: { pricingModel: string; agreedRate: number; hoursIncluded?: number | null; overtimeRate?: number | null },
  hours: number,
  visits = 0,
  squareMeters = 0,
): ContractCharge {
  const rate = contract.agreedRate ?? 0;
  const included = contract.hoursIncluded ?? 0;
  const overtimeRate = contract.overtimeRate ?? rate;

  switch (contract.pricingModel) {
    case "fast_maaned": {
      const overtimeHours = Math.max(0, round2(hours - included));
      const overtimeAmount = round2(overtimeHours * overtimeRate);
      return {
        model: "fast_maaned",
        description: `Fast månedspris (${included} timer inkl.)`,
        hours: round2(hours),
        includedHours: included,
        overtimeHours,
        baseAmount: round2(rate),
        overtimeAmount,
        netAmount: round2(rate + overtimeAmount),
      };
    }
    case "pr_besoeg": {
      const amount = round2(visits * rate);
      return {
        model: "pr_besoeg",
        description: `${visits} besøg × ${rate} kr.`,
        hours: round2(hours), includedHours: 0, overtimeHours: 0,
        baseAmount: amount, overtimeAmount: 0, netAmount: amount,
      };
    }
    case "pr_m2": {
      const amount = round2(squareMeters * rate);
      return {
        model: "pr_m2",
        description: `${squareMeters} m² × ${rate} kr.`,
        hours: round2(hours), includedHours: 0, overtimeHours: 0,
        baseAmount: amount, overtimeAmount: 0, netAmount: amount,
      };
    }
    default: {
      const amount = round2(hours * rate);
      return {
        model: "timepris",
        description: `${round2(hours)} timer × ${rate} kr.`,
        hours: round2(hours), includedHours: 0, overtimeHours: 0,
        baseAmount: amount, overtimeAmount: 0, netAmount: amount,
      };
    }
  }
}

export const PRICING_MODEL_LABELS: Record<string, string> = {
  timepris: "Timepris",
  fast_maaned: "Fast månedspris",
  pr_besoeg: "Pris pr. besøg",
  pr_m2: "Pris pr. m²",
};

// ══════════════════════════════════════════════════
//  KVALITETSKONTROL — vægtet score
// ══════════════════════════════════════════════════

export const INSPECTION_AREAS = [
  { key: "gulve", label: "Gulve og trapper", weight: 25 },
  { key: "sanitet", label: "Toiletter og sanitet", weight: 25 },
  { key: "inventar", label: "Inventar og flader", weight: 20 },
  { key: "koekken", label: "Køkken og kantine", weight: 15 },
  { key: "affald", label: "Affald og forbrugsvarer", weight: 10 },
  { key: "indtryk", label: "Samlet indtryk", weight: 5 },
];

/**
 * Vægtet score på 0-100. Hvert område bedømmes 0-5 som i INSTA 800-traditionen,
 * og resultatet afgør, om besøget er godkendt, har anmærkning eller falder igennem.
 */
export function scoreInspection(scores: Array<{ area: string; score: number; weight?: number }>) {
  let weighted = 0;
  let totalWeight = 0;
  for (const s of scores) {
    const weight = s.weight ?? INSPECTION_AREAS.find((a) => a.key === s.area)?.weight ?? 10;
    weighted += Math.max(0, Math.min(5, s.score)) * weight;
    totalWeight += weight;
  }
  const total = totalWeight === 0 ? 0 : round2((weighted / (totalWeight * 5)) * 100);
  const result = total >= 90 ? "godkendt" : total >= 75 ? "anmaerkning" : "ikke_godkendt";
  return { totalScore: total, result };
}

export const INSPECTION_RESULT_LABELS: Record<string, string> = {
  godkendt: "Godkendt",
  anmaerkning: "Anmærkning",
  ikke_godkendt: "Ikke godkendt",
};

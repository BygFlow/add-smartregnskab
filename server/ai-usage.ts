import { and, eq, gte, lt, sql } from "drizzle-orm";
import { aiUsageEvents, aiUsageSettings } from "@shared/schema";
import { db, storage } from "./storage";
import { previewBilling } from "./domain";

function monthBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function aiUsageOverview(companyId: number) {
  const company = await storage.getCompany(companyId);
  if (!company) throw new Error("Virksomheden blev ikke fundet.");
  const ownerId = company.subscriptionOwnerId || company.id;
  const billing = await previewBilling(ownerId);
  const { start, end } = monthBounds();
  const totals = db.select({
    credits: sql<number>`coalesce(sum(${aiUsageEvents.credits}), 0)`,
    cost: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostDkk}), 0)`,
    inputTokens: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens}), 0)`,
    outputTokens: sql<number>`coalesce(sum(${aiUsageEvents.outputTokens}), 0)`,
  }).from(aiUsageEvents).where(and(
    eq(aiUsageEvents.subscriptionOwnerId, ownerId),
    gte(aiUsageEvents.createdAt, start),
    lt(aiUsageEvents.createdAt, end),
  )).get();
  const settings = db.select().from(aiUsageSettings)
    .where(eq(aiUsageSettings.subscriptionOwnerId, ownerId)).get();
  const includedCredits = billing?.aiCreditsIncluded ?? 0;
  const costCap = settings?.hardCostCapOverride ?? billing?.aiCostCapDkk ?? 0;
  const usedCredits = Number(totals?.credits || 0);
  const estimatedCostDkk = Math.round(Number(totals?.cost || 0) * 100) / 100;
  const creditPercent = includedCredits > 0 ? Math.round((usedCredits / includedCredits) * 100) : 0;
  const costPercent = costCap > 0 ? Math.round((estimatedCostDkk / costCap) * 100) : 0;
  const percent = Math.max(creditPercent, costPercent);
  return {
    periodStart: start.slice(0, 10), periodEnd: end.slice(0, 10),
    includedCredits, usedCredits, remainingCredits: Math.max(0, includedCredits - usedCredits),
    estimatedCostDkk, costCapDkk: costCap,
    inputTokens: Number(totals?.inputTokens || 0), outputTokens: Number(totals?.outputTokens || 0),
    percent, warningLevel: percent >= 100 ? "stoppet" : percent >= 95 ? "kritisk" : percent >= 80 ? "advarsel" : "normal",
    allowed: includedCredits > usedCredits && costCap > estimatedCostDkk,
    aiAddonEnabled: billing?.aiAddonEnabled ?? false,
    aiAddonAvailable: Boolean((await storage.getCompanyPlan(ownerId))?.aiAddonCredits),
    autoTopupEnabled: Boolean(settings?.autoTopupEnabled),
    topupCatalog: [
      { credits: 500, price: 79 }, { credits: 1500, price: 199 }, { credits: 5000, price: 549 },
    ],
  };
}

export async function authorizeAiUsage(companyId: number, credits: number, estimatedCostDkk: number) {
  const overview = await aiUsageOverview(companyId);
  const allowed = overview.includedCredits > 0
    && overview.usedCredits + Math.max(1, credits) <= overview.includedCredits
    && overview.estimatedCostDkk + Math.max(0, estimatedCostDkk) <= overview.costCapDkk;
  return { ...overview, allowed };
}

export async function recordAiUsage(input: {
  companyId: number; userId?: number | null; actionType: string; model?: string | null;
  inputTokens?: number; outputTokens?: number; credits?: number; estimatedCostDkk?: number;
  externalRequestId?: string | null;
}) {
  const company = await storage.getCompany(input.companyId);
  if (!company) throw new Error("Virksomheden blev ikke fundet.");
  const credits = Math.max(1, Math.trunc(input.credits ?? 1));
  const cost = Math.max(0, input.estimatedCostDkk ?? 0);
  const authorization = await authorizeAiUsage(input.companyId, credits, cost);
  if (!authorization.allowed) throw new Error("AI-grænsen er nået. Ingen ekstra omkostning er oprettet.");
  return db.insert(aiUsageEvents).values({
    companyId: input.companyId,
    subscriptionOwnerId: company.subscriptionOwnerId || company.id,
    userId: input.userId ?? null,
    actionType: input.actionType,
    model: input.model ?? null,
    inputTokens: Math.max(0, Math.trunc(input.inputTokens ?? 0)),
    outputTokens: Math.max(0, Math.trunc(input.outputTokens ?? 0)),
    credits,
    estimatedCostDkk: cost,
    externalRequestId: input.externalRequestId ?? null,
    createdAt: new Date().toISOString(),
  }).returning().get();
}

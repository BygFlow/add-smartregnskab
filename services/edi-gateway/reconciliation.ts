import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { ediGatewayDocuments, ediGatewayTenants } from "../../shared/schema";
import { sproomChildDocumentState, type SproomDocumentState } from "../../server/einvoice";
import { db } from "./storage";

export type DeliveryState = "submitted" | "delivered" | "failed" | "needs_review";

/** Only a confirmed Sproom reception/approval is delivery; 302 (Sent) is not. */
export function classifySproomState(state: Pick<SproomDocumentState, "statusCode">): DeliveryState {
  const code = state.statusCode;
  if ([401, 402, 404].includes(code)) return "delivered";
  if (code === 405 || (code >= 901 && code <= 999) || code >= 10900000) return "failed";
  if ([201, 203, 205, 206, 207, 221, 222].includes(code)) return "needs_review";
  return "submitted";
}

export async function reconcileSproomDocuments(limit = 50): Promise<{ checked: number; changed: number; errors: number }> {
  if (!process.env.SPROOM_API_TOKEN) throw new Error("Sproom API-token mangler.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error("Ugyldigt afstemningsantal.");
  const pending = db.select().from(ediGatewayDocuments).where(and(
    eq(ediGatewayDocuments.direction, "outbound"),
    inArray(ediGatewayDocuments.status, ["submitted", "needs_review"]),
    isNotNull(ediGatewayDocuments.providerMessageId),
  )).orderBy(asc(ediGatewayDocuments.updatedAt)).limit(limit).all();
  let checked = 0, changed = 0, errors = 0;
  for (const row of pending) {
    const tenant = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.id, row.tenantId)).get();
    if (!tenant) { errors++; continue; }
    try {
      const state = await sproomChildDocumentState(row.providerMessageId!, tenant.sproomChildId);
      const next = classifySproomState(state);
      checked++;
      // A transient or late status must never undo an already confirmed delivery.
      const current = db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get();
      if (!current || !["submitted", "needs_review"].includes(current.status)) continue;
      if (current.status === "needs_review" && next === "submitted") continue;
      if (current.status === next) continue;
      const error = next === "failed" || next === "needs_review"
        ? `${state.statusCode}: ${String(state.message || state.state || "Kræver manuel kontrol").slice(0, 900)}` : null;
      db.update(ediGatewayDocuments).set({ status: next, error, updatedAt: new Date().toISOString() })
        .where(eq(ediGatewayDocuments.id, row.id)).run();
      changed++;
    } catch (error) {
      errors++;
      console.error(`Sproom-statusafstemning fejlede for dokument ${row.id}:`, error instanceof Error ? error.message : "Ukendt fejl");
    }
  }
  return { checked, changed, errors };
}

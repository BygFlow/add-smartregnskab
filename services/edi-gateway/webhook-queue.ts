import { createHash } from "node:crypto";
import { gatewaySqlite } from "./storage";
import { handleGatewaySproomWebhook } from "./routes";

type QueuedEvent = { id: number; body_json: string; attempts: number };
type QueueResult = { status: number; result: object };

/** Called only after RSA verification of the exact raw request bytes. */
export function enqueueVerifiedWebhook(raw: string, body: any): QueueResult {
  const type = String(body?.webhookType || "");
  if (!["documentReceived", "documentStatusChanged"].includes(type)) return { status: 200, result: { accepted: true, ignored: true } };
  const childId = String(body?.companyId || "");
  const documentId = String(body?.documentId || "");
  if (!/^[0-9a-f-]{36}$/i.test(childId) || !/^[0-9a-f-]{36}$/i.test(documentId)) {
    return { status: 400, result: { error: "Ugyldigt Sproom-companyId eller documentId." } };
  }
  const tenants = gatewaySqlite.prepare("SELECT active, receive_enabled FROM edi_gateway_tenants WHERE sproom_child_id = ?").all(childId) as Array<{ active: number; receive_enabled: number }>;
  if (!tenants.length) return { status: 404, result: { error: "Sproom-child-profilen er ikke tilsluttet." } };
  if (type === "documentReceived" && tenants.filter(tenant => tenant.active && tenant.receive_enabled).length !== 1) {
    return { status: 503, result: { error: "Indgående EDI kræver præcis én aktiv modtager." } };
  }
  const hash = createHash("sha256").update(raw, "utf8").digest("hex");
  const inserted = gatewaySqlite.prepare(`INSERT INTO edi_gateway_webhook_events
    (body_hash, body_json, received_at) VALUES (?, ?, ?)
    ON CONFLICT(body_hash) DO NOTHING`).run(hash, raw, new Date().toISOString());
  const row = gatewaySqlite.prepare("SELECT id FROM edi_gateway_webhook_events WHERE body_hash = ?").get(hash) as { id: number };
  return { status: 202, result: { accepted: true, queued: true, duplicate: inserted.changes === 0, id: row.id } };
}

function claim(): QueuedEvent | null {
  return gatewaySqlite.transaction(() => {
    const now = Date.now();
    const row = gatewaySqlite.prepare(`SELECT id, body_json, attempts FROM edi_gateway_webhook_events
      WHERE (status = 'pending' AND next_attempt_at <= ?)
         OR (status = 'processing' AND locked_until <= ?)
      ORDER BY id LIMIT 1`).get(now, now) as QueuedEvent | undefined;
    if (!row) return null;
    gatewaySqlite.prepare(`UPDATE edi_gateway_webhook_events SET status = 'processing', attempts = attempts + 1,
      locked_until = ? WHERE id = ?`).run(now + 5 * 60_000, row.id);
    return { ...row, attempts: row.attempts + 1 };
  }).immediate();
}

export async function drainWebhookQueue(limit = 50): Promise<{ processed: number; retried: number }> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error("Ugyldigt kø-antal.");
  let processed = 0, retried = 0;
  for (let i = 0; i < limit; i++) {
    const event = claim();
    if (!event) break;
    try {
      const result = await handleGatewaySproomWebhook(JSON.parse(event.body_json));
      if (!result || result.status < 200 || result.status > 299) throw new Error(`EDI-behandling svarede ${result?.status || 404}.`);
      gatewaySqlite.prepare(`UPDATE edi_gateway_webhook_events SET status = 'done', locked_until = 0,
        completed_at = ?, last_error = NULL WHERE id = ? AND status = 'processing'`).run(new Date().toISOString(), event.id);
      processed++;
    } catch (error) {
      const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(6, event.attempts - 1));
      gatewaySqlite.prepare(`UPDATE edi_gateway_webhook_events SET status = 'pending', locked_until = 0,
        next_attempt_at = ?, last_error = ? WHERE id = ? AND status = 'processing'`)
        .run(Date.now() + delay, error instanceof Error ? error.message.slice(0, 500) : "Ukendt EDI-fejl", event.id);
      retried++;
    }
  }
  return { processed, retried };
}

export function webhookQueueStatus() {
  const row = gatewaySqlite.prepare(`SELECT
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
    MIN(CASE WHEN status != 'done' THEN received_at END) AS oldestPendingAt
    FROM edi_gateway_webhook_events`).get() as { pending: number | null; processing: number | null; done: number | null; oldestPendingAt: string | null };
  return { pending: row.pending || 0, processing: row.processing || 0, done: row.done || 0, oldestPendingAt: row.oldestPendingAt };
}

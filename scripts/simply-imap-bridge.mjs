import "dotenv/config";
import { createHash, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const MAX_MESSAGE_BYTES = 11_000_000;
const MAX_ATTACHMENT_BYTES = 7_000_000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);

function addressCandidates(parsed) {
  const addresses = [
    ...(parsed.to?.value ?? []), ...(parsed.cc?.value ?? []),
  ].map((entry) => entry.address?.trim().toLowerCase()).filter(Boolean);
  for (const key of ["delivered-to", "x-original-to", "envelope-to"]) {
    const value = parsed.headers.get(key);
    if (typeof value === "string") addresses.push(value.trim().replace(/^<|>$/g, "").toLowerCase());
  }
  return [...new Set(addresses)];
}

export function extractDeliveries(parsed, domain, uid) {
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const addressPattern = new RegExp(`^bilag-[a-f0-9]{32}@${escapedDomain}$`, "i");
  const recipients = addressCandidates(parsed).filter((address) => addressPattern.test(address));
  if (recipients.length !== 1) return { deliveries: [], reason: "Forventede præcis én gyldig bilagsmodtager." };
  const sender = parsed.from?.value?.[0]?.address?.trim().toLowerCase() ?? "";
  const deliveries = [];
  for (const [index, attachment] of parsed.attachments.entries()) {
    if (ALLOWED_TYPES.has(attachment.contentType) && attachment.content.length > MAX_ATTACHMENT_BYTES) {
      return { deliveries: [], reason: "Et PDF- eller billedbilag er for stort." };
    }
    if (!ALLOWED_TYPES.has(attachment.contentType) || attachment.content.length > MAX_ATTACHMENT_BYTES) continue;
    if (attachment.related || (attachment.contentDisposition === "inline" && attachment.cid)) continue;
    const identity = `${parsed.messageId || `imap-uid-${uid}`}:${index}:${createHash("sha256").update(attachment.content).digest("hex")}`;
    deliveries.push({
      recipient: recipients[0], sender, messageId: `simply:${createHash("sha256").update(identity).digest("hex")}`,
      fileName: attachment.filename || `bilag-${index + 1}`,
      dataUrl: `data:${attachment.contentType};base64,${attachment.content.toString("base64")}`,
    });
  }
  return deliveries.length ? { deliveries, reason: null } : { deliveries, reason: "Ingen understøttede PDF- eller billedbilag." };
}

export function signedHeaders(body, secret, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
  return { "content-type": "application/json", "x-document-timestamp": timestamp, "x-document-signature": signature };
}

function configuration() {
  const user = process.env.SIMPLY_DOCUMENT_IMAP_USER?.trim();
  const password = process.env.SIMPLY_DOCUMENT_IMAP_PASSWORD;
  const domain = process.env.DOCUMENT_INBOUND_DOMAIN?.trim().toLowerCase();
  const secret = process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET?.trim();
  const baseUrl = process.env.DOCUMENT_INBOUND_API_URL?.trim();
  if (!user || !password || !domain || !secret || !baseUrl) throw new Error("Bilagsmail mangler IMAP-, domæne-, webhook- eller API-konfiguration.");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") throw new Error("Bilags-API skal bruge HTTPS.");
  return { user, password, domain, secret, endpoint: new URL("/api/document-receiving/inbound", url).toString() };
}

export async function pollOnce(config = configuration(), {
  clientFactory = (options) => new ImapFlow(options), fetchImpl = fetch,
  parseImpl = simpleParser, warn = console.warn,
} = {}) {
  const client = clientFactory({ host: "mail.simply.com", port: 993, secure: true,
    auth: { user: config.user, pass: config.password }, logger: false });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Rejected messages stay unread for human review, but \Flagged keeps
      // them from permanently occupying the first batch on every run.
      const uids = await client.search({ seen: false, flagged: false }, { uid: true });
      for (const uid of uids.slice(0, 25)) {
        try {
          const meta = await client.fetchOne(uid, { size: true }, { uid: true });
          if (!meta?.size) {
            warn(`Bilagsmail UID ${uid}: besked mangler størrelse; forsøges igen.`);
            continue;
          }
          if (meta.size > MAX_MESSAGE_BYTES) {
            warn(`Bilagsmail UID ${uid}: besked er for stor og markeret til kontrol.`);
            await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
            continue;
          }
          const message = await client.fetchOne(uid, { source: true }, { uid: true });
          if (!message?.source) continue;
          const parsed = await parseImpl(message.source);
          const { deliveries, reason } = extractDeliveries(parsed, config.domain, uid);
          if (reason) {
            warn(`Bilagsmail UID ${uid}: ${reason} Markerede til kontrol.`);
            await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
            continue;
          }
          let allAccepted = true;
          let permanentRejection = false;
          for (const delivery of deliveries) {
            const body = Buffer.from(JSON.stringify(delivery));
            const response = await fetchImpl(config.endpoint, { method: "POST", body,
              headers: signedHeaders(body, config.secret), signal: AbortSignal.timeout(30_000) });
            if (!response.ok) {
              allAccepted = false;
              permanentRejection = [400, 404, 413, 422].includes(response.status);
              warn(`Bilagsmail UID ${uid}: modtage-API svarede ${response.status}; ${permanentRejection ? "markeret til kontrol" : "forsøges igen"}.`);
              break;
            }
          }
          // This is a dedicated machine mailbox; only acknowledge after every
          // attachment was durably accepted. Retries are idempotent server-side.
          if (allAccepted) await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          else if (permanentRejection) await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
        } catch (error) {
          warn(`Bilagsmail UID ${uid} kræver kontrol:`, error instanceof Error ? error.message : "Ukendt fejl");
        }
      }
    } finally { lock.release(); }
  } finally { await client.logout(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  pollOnce().catch((error) => {
    console.error("Simply-bilagsmail kunne ikke hentes:", error instanceof Error ? error.message : "Ukendt fejl");
    process.exitCode = 1;
  });
}

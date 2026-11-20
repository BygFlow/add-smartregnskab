import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { bankTransactions, documentInbox, platformSyncMappings, auditLogs } from "@shared/schema";
import { db } from "./storage";
import { saveFile, deleteFile, readFile } from "./files";

const sourceId = z.string().min(8).max(120).regex(/^launch:[a-zA-Z0-9:_-]+$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T12:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const money = z.number().finite().min(-1_000_000_000).max(1_000_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001);
const Bank = z.object({ sourceId, date, description: z.string().min(1).max(300), amount: money, balance: money.nullable(), reference: z.string().max(160).nullable() }).strict();
const Document = z.object({ sourceId, fileName: z.string().min(1).max(180), contentType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), checksum: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().min(4).max(5_592_408) }).strict();
const now = () => new Date().toISOString();
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function mapping(companyId: number, type: string, id: string) {
  return db.select().from(platformSyncMappings).where(and(eq(platformSyncMappings.companyId, companyId), eq(platformSyncMappings.sourcePlatform, "add_launch"), eq(platformSyncMappings.syncType, type), eq(platformSyncMappings.sourceId, id))).get();
}
function remember(companyId: number, type: string, id: string, targetId: number, fingerprint: string) {
  db.insert(platformSyncMappings).values({ companyId, sourcePlatform: "add_launch", targetPlatform: "add_smartregnskab", syncType: type, sourceId: id, targetId: targetId + ":" + fingerprint, status: "synkroniseret", lastSyncedAt: now() }).run();
}
function replay(row: typeof platformSyncMappings.$inferSelect, fingerprint: string) {
  const [id, previousHash] = row.targetId.split(":");
  if (previousHash !== fingerprint) throw new Error("Kilde-id er allerede modtaget med andre data.");
  const targetId = Number(id);
  if (!Number.isSafeInteger(targetId) || targetId < 1) throw new Error("Den tidligere overførsel kunne ikke bekræftes.");
  return targetId;
}

export function importLaunchBankTransaction(companyId: number, input: unknown) {
  const value = Bank.parse(input), fingerprint = hash(JSON.stringify(value));
  return db.transaction(tx => {
    const old = mapping(companyId, "launch_bank", value.sourceId);
    if (old) {
      const id = replay(old, fingerprint);
      if (!tx.select().from(bankTransactions).where(and(eq(bankTransactions.id, id), eq(bankTransactions.companyId, companyId))).get()) throw new Error("Den tidligere bankpostering findes ikke længere.");
      return { id, duplicate: true };
    }
    const row = tx.insert(bankTransactions).values({ companyId, date: value.date, description: value.description, amount: value.amount, balance: value.balance, provider: "add_launch", accountRef: value.reference, externalId: value.sourceId, matchedType: null, matchedId: null, status: "afventer", importedAt: now() }).returning().get();
    remember(companyId, "launch_bank", value.sourceId, row.id, fingerprint);
    return { id: row.id, duplicate: false };
  });
}

// Original receipts enter the inbox for review; this does not run OCR or post a journal.
export async function importLaunchDocument(companyId: number, input: unknown) {
  const value = Document.parse(input);
  const bytes = Buffer.from(value.base64, "base64");
  if (bytes.toString("base64") !== value.base64) throw new Error("Ugyldig bilagsfil.");
  if (!bytes.length || bytes.length > 4 * 1024 * 1024 || hash(bytes) !== value.checksum) throw new Error("Bilagsfilens størrelse eller kontrolsum stemmer ikke.");
  const fingerprint = hash(JSON.stringify({ sourceId: value.sourceId, fileName: value.fileName, contentType: value.contentType, checksum: value.checksum }));
  const previous = mapping(companyId, "launch_document", value.sourceId);
  if (previous) {
    const id = replay(previous, fingerprint), document = db.select().from(documentInbox).where(and(eq(documentInbox.id, id), eq(documentInbox.companyId, companyId))).get();
    if (!document || document.status === "papirkurv") throw new Error("Det tidligere bilag er fjernet; automatisk genoprettelse er stoppet.");
    return { ok: true, id, duplicate: true, checksum: value.checksum };
  }
  const saved = await saveFile({ companyId, fileName: value.fileName, mimeType: value.contentType, buffer: bytes });
  let keep = false;
  try {
    if (hash(await readFile(saved.storage, saved.storageKey)) !== value.checksum) throw new Error("Den gemte bilagsfil kunne ikke verificeres.");
    const result = db.transaction(tx => {
      // Two requests may both have saved a file; only one may claim the source id.
      const concurrent = mapping(companyId, "launch_document", value.sourceId);
      if (concurrent) {
        const id = replay(concurrent, fingerprint), document = tx.select().from(documentInbox).where(and(eq(documentInbox.id, id), eq(documentInbox.companyId, companyId))).get();
        if (!document || document.status === "papirkurv") throw new Error("Det tidligere bilag er fjernet; automatisk genoprettelse er stoppet.");
        return { id, duplicate: true };
      }
      const identical = tx.select().from(documentInbox).where(and(eq(documentInbox.companyId, companyId), eq(documentInbox.contentHash, value.checksum))).get();
      if (identical?.status === "papirkurv") throw new Error("Et identisk bilag er fjernet; kontrollér papirkurven.");
      const document = identical || tx.insert(documentInbox).values({ companyId, fileName: value.fileName, fileType: value.contentType, ...saved, contentHash: value.checksum, externalMessageId: value.sourceId, source: "add_launch", ocrStatus: "afventer", status: "ny", createdAt: now() }).returning().get();
      remember(companyId, "launch_document", value.sourceId, document.id, fingerprint);
      tx.insert(auditLogs).values({ companyId, userId: null, userEmail: "ADD Connect:add_launch", action: "add_launch_document_imported", target: "document:" + document.id, detail: JSON.stringify({ sourceId: value.sourceId, checksum: value.checksum, duplicate: Boolean(identical) }), createdAt: now() }).run();
      return { id: document.id, duplicate: Boolean(identical) };
    });
    keep = !result.duplicate;
    return { ok: true, ...result, checksum: value.checksum };
  } finally { if (!keep) await deleteFile(saved.storage, saved.storageKey); }
}

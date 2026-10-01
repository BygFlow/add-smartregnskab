import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { bookkeepingArchiveInventory, linkedOriginals, readVerifiedOriginal } from "./bookkeeping-archive-inventory";
import { storeLockedArchiveObject, type ArchiveReceipt } from "./bookkeeping-archive-object";
import type { ArchiveBucketConfig } from "./bookkeeping-archive-readiness";

type Store = (input: Parameters<typeof storeLockedArchiveObject>[0]) => Promise<ArchiveReceipt>;

/** Manual original-only capture. No scheduler calls this and it is not a complete bookkeeping archive. */
export async function captureBookkeepingOriginals(input: {
  snapshot: Database.Database;
  companyId: number;
  referenceDate: string;
  readOriginal: (storage: string, storageKey: string) => Promise<Buffer>;
  config: ArchiveBucketConfig;
  encryptionSecret: string;
  now?: Date;
}, store: Store = storeLockedArchiveObject) {
  const inventory = bookkeepingArchiveInventory(input.snapshot, input.companyId, input.referenceDate);
  if (inventory.issues.length) {
    throw new Error(`Arkivering stoppet af uafklarede bilag eller posteringer: ${inventory.issues.join(", ")}.`);
  }
  const documents = linkedOriginals(input.snapshot, input.companyId, inventory.period.start, inventory.period.end);
  if (!documents.length) throw new Error("Der er ingen tilknyttede originalbilag i regnskabsåret.");
  const prefix = `companies/${input.companyId}/fiscal-years/${inventory.period.start}`;
  const receipts: Array<{ documentId: number; sourceSha256: string; receipt: ArchiveReceipt }> = [];
  for (const row of documents) {
    const bytes = await readVerifiedOriginal(row, input.companyId, input.readOriginal);
    const sourceSha256 = row.content_hash!.toLowerCase();
    const receipt = await store({ config: input.config,
      key: `${prefix}/originals/document-${row.id}-${sourceSha256}.bin`,
      plain: bytes, retainUntil: inventory.period.retainUntil,
      encryptionSecret: input.encryptionSecret, now: input.now });
    if (!receipt.verified || receipt.bucket !== input.config.bucket || receipt.sha256 !== sourceSha256
        || receipt.plainBytes !== bytes.length || !receipt.versionId) {
      throw new Error(`Arkivlagerets kvittering for bilag #${row.id} er ikke verificeret.`);
    }
    receipts.push({ documentId: row.id, sourceSha256, receipt });
  }
  const manifest = {
    format: "add-smartregnskab-originals-v1",
    scope: "originals_only",
    completeBookkeepingArchive: false,
    companyId: input.companyId,
    period: inventory.period,
    inventoryCounts: inventory.counts,
    originals: receipts,
  };
  const manifestReceipt = await store({ config: input.config,
    key: `${prefix}/manifests/originals-${randomUUID()}.json`,
    plain: Buffer.from(JSON.stringify(manifest), "utf8"),
    retainUntil: inventory.period.retainUntil,
    encryptionSecret: input.encryptionSecret, now: input.now });
  if (!manifestReceipt.verified || manifestReceipt.bucket !== input.config.bucket || !manifestReceipt.versionId) {
    throw new Error("Arkivlagerets manifestkvittering er ikke verificeret.");
  }
  return { scope: "originals_only" as const, completeBookkeepingArchive: false as const,
    companyId: input.companyId, period: inventory.period, originals: receipts, manifestReceipt };
}

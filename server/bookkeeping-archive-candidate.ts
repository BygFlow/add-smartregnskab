import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { captureBookkeepingOriginals } from "./bookkeeping-archive-capture";
import { verifyBookkeepingOriginals } from "./bookkeeping-archive-inventory";
import { readLockedArchiveObject, storeLockedArchiveObject, type ArchiveReceipt } from "./bookkeeping-archive-object";
import { buildBookkeepingRecordBundle, captureBookkeepingRecordCandidate,
  verifyBookkeepingRecordCandidateReceipt } from "./bookkeeping-archive-records";
import type { ArchiveBucketConfig } from "./bookkeeping-archive-readiness";

type Store = (input: Parameters<typeof storeLockedArchiveObject>[0]) => Promise<ArchiveReceipt>;
type Read = (input: Parameters<typeof readLockedArchiveObject>[0]) => Promise<Buffer>;

/** Manual candidate only: no endpoint or scheduler enables real production capture. */
export async function captureBookkeepingArchiveCandidate(input: {
  snapshot: Database.Database;
  companyId: number;
  referenceDate: string;
  readOriginal: (storage: string, storageKey: string) => Promise<Buffer>;
  config: ArchiveBucketConfig;
  encryptionSecret: string;
  now?: Date;
}, store: Store = storeLockedArchiveObject) {
  // Fail before the first immutable upload if the schema, references or original bytes are already inconsistent.
  const records = buildBookkeepingRecordBundle(input.snapshot, input.companyId, input.referenceDate);
  const originalsPreflight = await verifyBookkeepingOriginals(
    input.snapshot, input.companyId, input.referenceDate, input.readOriginal,
  );
  if (records.bundle.documents.length !== originalsPreflight.verifiedOriginals.length) {
    throw new Error("Regnskabsdata og originalbilag har forskellige antal.");
  }
  const recordResult = await captureBookkeepingRecordCandidate(input, store);
  const originalsResult = await captureBookkeepingOriginals(input, store);
  if (recordResult.period.start !== originalsResult.period.start
      || recordResult.period.end !== originalsResult.period.end
      || records.bundle.documents.length !== originalsResult.originals.length) {
    throw new Error("Arkivdelene stemmer ikke med samme virksomhed og regnskabsår.");
  }
  const manifest = {
    format: "add-smartregnskab-bookkeeping-candidate-v1",
    scope: "bookkeeping_candidate_only",
    completeBookkeepingArchive: false,
    companyId: input.companyId,
    period: recordResult.period,
    recordReceipt: recordResult.receipt,
    originalsManifestReceipt: originalsResult.manifestReceipt,
    coverageCaveats: recordResult.coverageCaveats,
  };
  const objectKey = `companies/${input.companyId}/fiscal-years/${recordResult.period.start}/manifests/candidate-${randomUUID()}.json`;
  const manifestReceipt = await store({ config: input.config, key: objectKey,
    plain: Buffer.from(JSON.stringify(manifest), "utf8"),
    retainUntil: recordResult.period.retainUntil,
    encryptionSecret: input.encryptionSecret, now: input.now });
  if (!manifestReceipt.verified || manifestReceipt.bucket !== input.config.bucket
      || manifestReceipt.objectKey !== objectKey || !manifestReceipt.versionId) {
    throw new Error("Arkivets samlede kandidatmanifest blev ikke verificeret.");
  }
  return { scope: "bookkeeping_candidate_only" as const, completeBookkeepingArchive: false as const,
    companyId: input.companyId, period: recordResult.period, manifestReceipt };
}

/** Isolated readback of the candidate chain; it does not assert statutory completeness. */
export async function verifyBookkeepingArchiveCandidate(input: {
  config: ArchiveBucketConfig;
  encryptionSecret: string;
  companyId: number;
  fiscalYearStart: string;
  manifestReceipt: ArchiveReceipt;
}, read: Read = readLockedArchiveObject) {
  const prefix = `companies/${input.companyId}/fiscal-years/${input.fiscalYearStart}/`;
  if (!input.manifestReceipt.objectKey.startsWith(`${prefix}manifests/candidate-`)) {
    throw new Error("Kandidatmanifestet peger på forkert virksomhed eller regnskabsår.");
  }
  const readReceipt = (receipt: ArchiveReceipt) => read({ config: input.config, receipt,
    encryptionSecret: input.encryptionSecret });
  let manifest: Record<string, any>;
  try { manifest = JSON.parse((await readReceipt(input.manifestReceipt)).toString("utf8")); }
  catch { throw new Error("Kandidatmanifestet kunne ikke læses."); }
  if (manifest.format !== "add-smartregnskab-bookkeeping-candidate-v1"
      || manifest.completeBookkeepingArchive !== false || manifest.companyId !== input.companyId
      || manifest.period?.start !== input.fiscalYearStart
      || !manifest.recordReceipt || !manifest.originalsManifestReceipt) {
    throw new Error("Kandidatmanifestets indhold er ugyldigt.");
  }
  const recordCheck = await verifyBookkeepingRecordCandidateReceipt({
    config: input.config, receipt: manifest.recordReceipt, encryptionSecret: input.encryptionSecret,
    companyId: input.companyId, fiscalYearStart: input.fiscalYearStart,
  }, read);
  const originalsReceipt = manifest.originalsManifestReceipt as ArchiveReceipt;
  if (!originalsReceipt.objectKey?.startsWith(`${prefix}manifests/originals-`)) {
    throw new Error("Originalmanifestet peger på forkert virksomhed eller regnskabsår.");
  }
  let originals: Record<string, any>;
  try { originals = JSON.parse((await readReceipt(originalsReceipt)).toString("utf8")); }
  catch { throw new Error("Originalmanifestet kunne ikke læses."); }
  if (originals.format !== "add-smartregnskab-originals-v1"
      || originals.completeBookkeepingArchive !== false || originals.companyId !== input.companyId
      || originals.period?.start !== input.fiscalYearStart
      || !Array.isArray(originals.originals)
      || originals.originals.length !== recordCheck.counts.linkedOriginals) {
    throw new Error("Originalmanifestet stemmer ikke med regnskabsdata.");
  }
  for (const item of originals.originals) {
    const receipt = item.receipt as ArchiveReceipt;
    if (!Number.isSafeInteger(item.documentId) || !receipt?.objectKey?.startsWith(`${prefix}originals/document-${item.documentId}-`)
        || receipt.sha256 !== item.sourceSha256) {
      throw new Error("Et originalbilags kvittering er ugyldig.");
    }
    await readReceipt(receipt);
  }
  return { verified: true as const, scope: "bookkeeping_candidate_only" as const,
    completeBookkeepingArchive: false as const, companyId: input.companyId,
    period: manifest.period, originalCount: originals.originals.length };
}

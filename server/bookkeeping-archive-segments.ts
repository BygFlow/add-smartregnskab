import { createHash, randomUUID } from "node:crypto";
import type { ArchiveBucketConfig } from "./bookkeeping-archive-readiness";
import {
  readLockedArchiveObject, storeLockedArchiveObject, type ArchiveReceipt,
} from "./bookkeeping-archive-object";

const DEFAULT_PART_BYTES = 8 * 1024 * 1024;
const MAX_PART_BYTES = 16 * 1024 * 1024;
const MAX_PARTS = 100_000;
const PREFIX = /^companies\/([1-9]\d*)\/fiscal-years\/(\d{4}-\d{2}-\d{2})\/real-data\/([a-f0-9-]{36})$/i;
const SHA256 = /^[a-f0-9]{64}$/i;

type Store = typeof storeLockedArchiveObject;
type Read = typeof readLockedArchiveObject;
type Manifest = {
  format: "smartregnskab-segmented-archive-v1";
  companyId: number;
  fiscalYearStart: string;
  sourceSha256: string;
  sourceBytes: number;
  partBytes: number;
  parts: ArchiveReceipt[];
};

function assertPrefix(prefix: string) {
  const match = PREFIX.exec(prefix);
  if (!match || prefix.includes("..")) throw new Error("Ugyldigt virksomhedsafgrænset arkivpræfiks.");
  return { companyId: Number(match[1]), fiscalYearStart: match[2] };
}

/** Gemmer en vilkårligt lang byte-strøm som begrænsede, individuelt låste objekter.
 * Manifestet skrives sidst; en afbrudt kørsel må ikke få en godkendt kvittering. */
export async function storeSegmentedArchive(input: {
  config: ArchiveBucketConfig;
  prefix: string;
  source: AsyncIterable<Buffer>;
  retainUntil: string;
  encryptionSecret: string;
  partBytes?: number;
  expectedSourceSha256?: string;
  expectedSourceBytes?: number;
  now?: Date;
}, store: Store = storeLockedArchiveObject) {
  const identity = assertPrefix(input.prefix);
  const partBytes = input.partBytes ?? DEFAULT_PART_BYTES;
  if (!Number.isSafeInteger(partBytes) || partBytes < 1 || partBytes > MAX_PART_BYTES) {
    throw new Error("Arkivdelen skal være mellem 1 byte og 16 MB.");
  }
  const sourceHash = createHash("sha256");
  const parts: ArchiveReceipt[] = [];
  let pending = Buffer.alloc(0);
  let sourceBytes = 0;
  const savePart = async (plain: Buffer) => {
    if (parts.length >= MAX_PARTS) throw new Error("Arkivet har for mange dele.");
    const index = String(parts.length).padStart(6, "0");
    const receipt = await store({
      config: input.config, key: `${input.prefix}/parts/${index}-${randomUUID()}.bin`,
      plain, retainUntil: input.retainUntil, encryptionSecret: input.encryptionSecret, now: input.now,
    });
    if (!receipt.verified || receipt.plainBytes !== plain.length || receipt.bucket !== input.config.bucket) {
      throw new Error("En arkivdel blev ikke verificeret.");
    }
    parts.push(receipt);
  };
  for await (const value of input.source) {
    if (!Buffer.isBuffer(value)) throw new Error("Arkivkilden skal levere byte-buffere.");
    sourceBytes += value.length;
    if (!Number.isSafeInteger(sourceBytes)) throw new Error("Arkivkilden er for stor til sikker byteoptælling.");
    sourceHash.update(value);
    let offset = 0;
    while (offset < value.length) {
      const take = Math.min(partBytes - pending.length, value.length - offset);
      const slice = value.subarray(offset, offset + take);
      pending = pending.length ? Buffer.concat([pending, slice]) : Buffer.from(slice);
      offset += take;
      if (pending.length === partBytes) {
        await savePart(pending);
        pending = Buffer.alloc(0);
      }
    }
  }
  if (pending.length) await savePart(pending);
  if (!parts.length) throw new Error("Et tomt regnskabsår må ikke arkiveres.");
  const calculatedSourceSha256 = sourceHash.digest("hex");
  if (input.expectedSourceSha256 !== undefined
      && (!SHA256.test(input.expectedSourceSha256)
        || calculatedSourceSha256 !== input.expectedSourceSha256)) {
    throw new Error("Arkivkildens checksum ændrede sig før manifestet blev offentliggjort.");
  }
  if (input.expectedSourceBytes !== undefined
      && (!Number.isSafeInteger(input.expectedSourceBytes) || input.expectedSourceBytes < 1
        || sourceBytes !== input.expectedSourceBytes)) {
    throw new Error("Arkivkildens byteantal ændrede sig før manifestet blev offentliggjort.");
  }
  const manifest: Manifest = {
    format: "smartregnskab-segmented-archive-v1", ...identity,
    sourceSha256: calculatedSourceSha256, sourceBytes, partBytes, parts,
  };
  const manifestReceipt = await store({
    config: input.config, key: `${input.prefix}/manifest-${randomUUID()}.json`,
    plain: Buffer.from(JSON.stringify(manifest), "utf8"), retainUntil: input.retainUntil,
    encryptionSecret: input.encryptionSecret, now: input.now,
  });
  if (!manifestReceipt.verified || manifestReceipt.bucket !== input.config.bucket) {
    throw new Error("Arkivmanifestet blev ikke verificeret.");
  }
  return { receipt: manifestReceipt, sourceSha256: manifest.sourceSha256,
    sourceBytes, partCount: parts.length };
}

/** Kontrollerer manifest, alle låste objektversioner og den samlede kildestrøm.
 * En valgfri sink kan skrive bytes til en isoleret gendannelsesfil uden samlet buffer. */
export async function readSegmentedArchive(input: {
  config: ArchiveBucketConfig;
  receipt: ArchiveReceipt;
  encryptionSecret: string;
  expectedCompanyId: number;
  expectedFiscalYearStart: string;
  sink?: (part: Buffer) => Promise<void>;
}, read: Read = readLockedArchiveObject) {
  const manifestKey = input.receipt.objectKey;
  const prefix = manifestKey.replace(/\/manifest-[a-f0-9-]{36}\.json$/i, "");
  if (prefix === manifestKey) throw new Error("Arkivkvitteringen peger ikke på et segmentmanifest.");
  const identity = assertPrefix(prefix);
  if (identity.companyId !== input.expectedCompanyId || identity.fiscalYearStart !== input.expectedFiscalYearStart) {
    throw new Error("Arkivmanifestet tilhører en anden virksomhed eller et andet år.");
  }
  const manifestBytes = await read({ config: input.config, receipt: input.receipt,
    encryptionSecret: input.encryptionSecret });
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as Manifest;
  if (manifest.format !== "smartregnskab-segmented-archive-v1"
      || manifest.companyId !== identity.companyId || manifest.fiscalYearStart !== identity.fiscalYearStart
      || !SHA256.test(manifest.sourceSha256 || "")
      || !Number.isSafeInteger(manifest.sourceBytes) || manifest.sourceBytes < 1
      || !Number.isSafeInteger(manifest.partBytes) || manifest.partBytes < 1 || manifest.partBytes > MAX_PART_BYTES
      || !Array.isArray(manifest.parts) || manifest.parts.length < 1 || manifest.parts.length > MAX_PARTS) {
    throw new Error("Arkivmanifestet er ugyldigt.");
  }
  const hash = createHash("sha256");
  let count = 0;
  for (let index = 0; index < manifest.parts.length; index++) {
    const receipt = manifest.parts[index];
    const partPrefix = `${prefix}/parts/${String(index).padStart(6, "0")}-`;
    if (receipt.bucket !== input.config.bucket || !receipt.objectKey?.startsWith(partPrefix)
        || !/^[-a-f0-9]{36}\.bin$/i.test(receipt.objectKey.slice(partPrefix.length))
        || !receipt.versionId || !SHA256.test(receipt.sha256 || "")
        || !Number.isSafeInteger(receipt.plainBytes) || receipt.plainBytes < 1
        || receipt.plainBytes > manifest.partBytes
        || new Date(receipt.retainUntil).getTime() < new Date(input.receipt.retainUntil).getTime()) {
      throw new Error(`Arkivmanifestets del ${index} er ugyldig.`);
    }
    const plain = await read({ config: input.config, receipt, encryptionSecret: input.encryptionSecret });
    if (plain.length !== receipt.plainBytes || plain.length !== (index === manifest.parts.length - 1
      ? manifest.sourceBytes - index * manifest.partBytes : manifest.partBytes)) {
      throw new Error(`Arkivdel ${index} har forkert størrelse.`);
    }
    count += plain.length;
    hash.update(plain);
    await input.sink?.(plain);
  }
  if (count !== manifest.sourceBytes || hash.digest("hex") !== manifest.sourceSha256) {
    throw new Error("Arkivets samlede checksum eller byteantal stemmer ikke.");
  }
  return { verified: true, companyId: identity.companyId, fiscalYearStart: identity.fiscalYearStart,
    sourceSha256: manifest.sourceSha256, sourceBytes: count, partCount: manifest.parts.length };
}

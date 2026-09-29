import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  GetObjectCommand, GetObjectRetentionCommand, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import type { ArchiveBucketConfig } from "./bookkeeping-archive-readiness";

type ArchiveCommand = PutObjectCommand | GetObjectRetentionCommand | GetObjectCommand;
type ArchiveSender = (command: ArchiveCommand) => Promise<any>;
export type ArchiveReceipt = { bucket: string; objectKey: string; versionId: string; sha256: string;
  plainBytes: number; retainUntil: string; verified: boolean };

function encryptionKey(secret: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(secret)) throw new Error("ARCHIVE_ENCRYPTION_KEY skal være 32 bytes i hexadecimal form.");
  return Buffer.from(secret, "hex");
}

/** Beskytter ét allerede udvalgt bogføringsobjekt. Udvælgelse og planlægning ligger udenfor. */
export async function storeLockedArchiveObject(input: {
  config: ArchiveBucketConfig;
  key: string;
  plain: Buffer;
  retainUntil: string;
  encryptionSecret: string;
  now?: Date;
}, injectedSender?: ArchiveSender) {
  if (!/^(?:companies\/\d+|gateway-cvr\/\d{8})\/fiscal-years\/\d{4}-\d{2}-\d{2}\/[-a-zA-Z0-9_/\.]+$/.test(input.key)
      || input.key.includes("..") || input.key.endsWith("/")) {
    throw new Error("Arkivnøglen skal være årsspecifik og uden usikre stisegmenter.");
  }
  if (!input.plain.length) throw new Error("Et tomt bogføringsobjekt må ikke arkiveres.");
  const retainUntil = new Date(input.retainUntil);
  const now = input.now ?? new Date();
  if (!Number.isFinite(retainUntil.getTime()) || retainUntil.getTime() <= now.getTime()) {
    throw new Error("Opbevaringsdatoen skal ligge i fremtiden.");
  }
  const key = encryptionKey(input.encryptionSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(input.plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const sha256 = createHash("sha256").update(input.plain).digest("hex");
  const client = injectedSender ? null : new S3Client({
    region: input.config.region,
    endpoint: input.config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: input.config.accessKeyId, secretAccessKey: input.config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const send: ArchiveSender = injectedSender ?? ((command) => client!.send(command as PutObjectCommand));
  try {
    const uploaded = await send(new PutObjectCommand({
      Bucket: input.config.bucket,
      Key: input.key,
      Body: encrypted,
      ContentLength: encrypted.length,
      ContentType: "application/octet-stream",
      Metadata: { sha256, encryption: "aes-256-gcm", iv: iv.toString("hex"), tag: tag.toString("hex") },
      ObjectLockMode: "COMPLIANCE",
      ObjectLockRetainUntilDate: retainUntil,
    }));
    if (!uploaded.VersionId) throw new Error("Arkivlageret bekræftede ikke en objektversion.");
    const versionId = uploaded.VersionId as string;
    const retention = await send(new GetObjectRetentionCommand({
      Bucket: input.config.bucket, Key: input.key, VersionId: versionId,
    }));
    if (retention.Retention?.Mode !== "COMPLIANCE"
        || !retention.Retention.RetainUntilDate
        || new Date(retention.Retention.RetainUntilDate).getTime() < retainUntil.getTime()) {
      throw new Error("Arkivlageret bekræftede ikke den krævede Compliance-retention.");
    }
    const stored = await send(new GetObjectCommand({
      Bucket: input.config.bucket, Key: input.key, VersionId: versionId,
    }));
    if (!stored.Body) throw new Error("Arkivobjektet kunne ikke læses tilbage.");
    if (stored.Metadata?.sha256 !== sha256 || stored.Metadata?.encryption !== "aes-256-gcm"
        || stored.Metadata?.iv !== iv.toString("hex") || stored.Metadata?.tag !== tag.toString("hex")) {
      throw new Error("Arkivobjektets krypteringsmetadata stemmer ikke med kilden.");
    }
    const storedBytes = Buffer.from(await stored.Body.transformToByteArray());
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const verifiedPlain = Buffer.concat([decipher.update(storedBytes), decipher.final()]);
    if (createHash("sha256").update(verifiedPlain).digest("hex") !== sha256) {
      throw new Error("Arkivobjektets SHA-256 stemmer ikke med kilden.");
    }
    return { bucket: input.config.bucket, objectKey: input.key, versionId, sha256,
      plainBytes: input.plain.length, retainUntil: retainUntil.toISOString(), verified: true };
  } finally {
    client?.destroy();
  }
}

/** Læser en bestemt, låst objektversion tilbage og kontrollerer dens originale bytes. */
export async function readLockedArchiveObject(input: {
  config: ArchiveBucketConfig;
  receipt: ArchiveReceipt;
  encryptionSecret: string;
}, injectedSender?: ArchiveSender): Promise<Buffer> {
  if (input.receipt.bucket !== input.config.bucket || !input.receipt.objectKey || !input.receipt.versionId
      || !/^[a-f0-9]{64}$/i.test(input.receipt.sha256)
      || !Number.isSafeInteger(input.receipt.plainBytes) || input.receipt.plainBytes <= 0
      || !Number.isFinite(new Date(input.receipt.retainUntil).getTime())) {
    throw new Error("Arkivkvitteringen er ugyldig eller peger på en anden bucket.");
  }
  const key = encryptionKey(input.encryptionSecret);
  const client = injectedSender ? null : new S3Client({
    region: input.config.region, endpoint: input.config.endpoint, forcePathStyle: true,
    credentials: { accessKeyId: input.config.accessKeyId, secretAccessKey: input.config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
  });
  const send: ArchiveSender = injectedSender ?? ((command) => client!.send(command as GetObjectCommand));
  try {
    const retention = await send(new GetObjectRetentionCommand({
      Bucket: input.config.bucket, Key: input.receipt.objectKey, VersionId: input.receipt.versionId,
    }));
    if (retention.Retention?.Mode !== "COMPLIANCE" || !retention.Retention.RetainUntilDate
        || new Date(retention.Retention.RetainUntilDate).getTime() < new Date(input.receipt.retainUntil).getTime()) {
      throw new Error("Arkivobjektets Compliance-retention er utilstrækkelig.");
    }
    const stored = await send(new GetObjectCommand({
      Bucket: input.config.bucket, Key: input.receipt.objectKey, VersionId: input.receipt.versionId,
    }));
    const metadata = stored.Metadata || {};
    if (!stored.Body || metadata.encryption !== "aes-256-gcm"
        || !/^[a-f0-9]{24}$/i.test(metadata.iv || "") || !/^[a-f0-9]{32}$/i.test(metadata.tag || "")
        || metadata.sha256 !== input.receipt.sha256) {
      throw new Error("Arkivobjektets krypteringsmetadata mangler eller stemmer ikke.");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(metadata.iv, "hex"));
    decipher.setAuthTag(Buffer.from(metadata.tag, "hex"));
    const encrypted = Buffer.from(await stored.Body.transformToByteArray());
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    if (plain.length !== input.receipt.plainBytes
        || createHash("sha256").update(plain).digest("hex") !== input.receipt.sha256) {
      throw new Error("Arkivobjektets indhold stemmer ikke med manifestet.");
    }
    return plain;
  } finally {
    client?.destroy();
  }
}


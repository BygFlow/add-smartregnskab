import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

function encryptionKey() {
  const encoded = process.env.EDI_GATEWAY_BACKUP_ENCRYPTION_KEY || "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("EDI_GATEWAY_BACKUP_ENCRYPTION_KEY skal være 32 tilfældige bytes i base64.");
  return key;
}

export function encryptEdiSnapshot(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { body, metadata: { encryption: "aes-256-gcm", iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), sha256: createHash("sha256").update(plain).digest("hex") } };
}

export function decryptEdiSnapshot(body, metadata) {
  if (metadata?.encryption !== "aes-256-gcm" || !/^[a-f0-9]{24}$/.test(metadata.iv || "") || !/^[a-f0-9]{32}$/.test(metadata.tag || "")) {
    throw new Error("EDI-backuppen mangler gyldig krypteringsmetadata.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(metadata.iv, "hex"));
  decipher.setAuthTag(Buffer.from(metadata.tag, "hex"));
  const plain = Buffer.concat([decipher.update(body), decipher.final()]);
  if (createHash("sha256").update(plain).digest("hex") !== metadata.sha256) throw new Error("EDI-backuppens kontrolsum stemmer ikke.");
  return plain;
}

function verifySqliteBytes(bytes) {
  const root = mkdtempSync(join(tmpdir(), "edi-offsite-verify-"));
  const path = join(root, "restore-check.db");
  let database;
  try {
    writeFileSync(path, bytes, { mode: 0o600 });
    database = new Database(path, { readonly: true, fileMustExist: true });
    if (database.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("EDI-gendannelsens integritetskontrol fejlede.");
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
    if (!["edi_gateway_tenants", "edi_gateway_documents", "edi_gateway_webhook_events"].every(name => tables.includes(name))) {
      throw new Error("EDI-gendannelsen mangler obligatoriske tabeller.");
    }
  } finally {
    database?.close();
    if (dirname(realpathSync(root)) === realpathSync(tmpdir())) rmSync(root, { recursive: true, force: true });
  }
}

/** Upload, download and decrypt a snapshot before reporting success. No remote object is deleted. */
export async function uploadVerifiedEdiBackup(localPath, s3) {
  const bucket = String(process.env.S3_BUCKET || "").trim();
  if (!bucket) throw new Error("S3_BUCKET mangler.");
  const absolute = resolve(localPath);
  const prefix = String(process.env.EDI_GATEWAY_S3_PREFIX || "smartregnskab/edi-gateway").replace(/^\/+|\/+$/g, "");
  if (!prefix || prefix.includes("..")) throw new Error("Ugyldigt EDI_GATEWAY_S3_PREFIX.");
  const key = `${prefix}/${basename(absolute)}.aes256gcm`;
  const plain = readFileSync(absolute);
  const encrypted = encryptEdiSnapshot(plain);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: encrypted.body, ContentLength: encrypted.body.length,
    ContentType: "application/octet-stream", Metadata: { ...encrypted.metadata, product: "add-smartregnskab-edi-gateway" } }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (Number(head.ContentLength) !== encrypted.body.length || head.Metadata?.sha256 !== encrypted.metadata.sha256) {
    throw new Error("EDI-offsite-backup bestod ikke fjernkontrollen.");
  }
  const remote = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!remote.Body) throw new Error("EDI-offsite-backuppen kunne ikke hentes igen.");
  const restored = decryptEdiSnapshot(Buffer.from(await remote.Body.transformToByteArray()), remote.Metadata);
  if (restored.length !== plain.length) throw new Error("EDI-gendannelsens størrelse stemmer ikke.");
  verifySqliteBytes(restored);
  return { key, sizeBytes: statSync(absolute).size, sha256: encrypted.metadata.sha256, restored: true };
}

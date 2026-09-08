import { mkdir, readFile as readDiskFile, rm, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { attachments } from "@shared/schema";
import { db } from "./storage";

// ── Persistent file storage path ──
// I produktion sættes FILE_STORAGE_DIR til en persistent disk.
// Lokalt fallback til projektets uploads-mappe.
const UPLOAD_ROOT = process.env.FILE_STORAGE_DIR || "/home/user/workspace/addsmartregnskab/uploads";
try { mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch {}
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const S3_EXPIRY_SECONDS = 15 * 60;

type Backend = "disk" | "s3";

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function s3Config(): S3Config | null {
  const { S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    bucket: S3_BUCKET,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

/** Det valgte lager er S3 kun når alle nødvendige nøgler er konfigureret. */
export function storageBackend(): Backend {
  return s3Config() ? "s3" : "disk";
}

function assertValidFile(mimeType: string, buffer: Buffer): void {
  const signatures: Record<string, (data: Buffer) => boolean> = {
    "application/pdf": (data) => data.subarray(0, 5).toString("ascii") === "%PDF-",
    "image/jpeg": (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    "image/png": (data) => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/gif": (data) => ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii")),
    "image/webp": (data) => data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP",
  };
  const validSignature = signatures[mimeType];
  if (!validSignature) {
    throw new Error("Kun billedfiler og PDF-filer må uploades.");
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("Filen er for stor. Maksimal filstørrelse er 10 MB.");
  }
  if (!validSignature(buffer)) {
    throw new Error("Filens indhold matcher ikke den oplyste filtype.");
  }
}

function extensionFromName(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (ext) return ext;
  const fromMime: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
  };
  return fromMime[mimeType] ?? "bin";
}

function safeKey(storageKey: string): string {
  const normal = path.posix.normalize(storageKey.replaceAll("\\", "/"));
  if (!normal || normal === "." || normal.startsWith("../") || path.posix.isAbsolute(normal)) {
    throw new Error("Ugyldig filsti.");
  }
  return normal;
}

function diskPath(storageKey: string): string {
  const filePath = path.resolve(UPLOAD_ROOT, safeKey(storageKey));
  if (!filePath.startsWith(`${UPLOAD_ROOT}${path.sep}`)) throw new Error("Ugyldig filsti.");
  return filePath;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function timestampParts(date = new Date()): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString();
  const dateStamp = iso.slice(0, 10).replaceAll("-", "");
  return { amzDate: `${dateStamp}T${iso.slice(11, 19).replaceAll(":", "")}Z`, dateStamp };
}

function s3RequestParts(config: S3Config, storageKey: string) {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const canonicalUri = `/${safeKey(storageKey).split("/").map(awsEncode).join("/")}`;
  return { host, canonicalUri, service: "s3", algorithm: "AWS4-HMAC-SHA256" };
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, dateStamp), region), service), "aws4_request");
}

function authorization(
  config: S3Config,
  method: string,
  storageKey: string,
  payloadHash: string,
  now = new Date(),
): { host: string; canonicalUri: string; amzDate: string; authorization: string } {
  const { host, canonicalUri, service, algorithm } = s3RequestParts(config, storageKey);
  const { amzDate, dateStamp } = timestampParts(now);
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = [algorithm, amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp, config.region, service))
    .update(stringToSign).digest("hex");
  return {
    host,
    canonicalUri,
    amzDate,
    authorization: `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function s3Fetch(method: "PUT" | "GET" | "DELETE", storageKey: string, body?: Buffer): Promise<Response> {
  const config = s3Config();
  if (!config) throw new Error("S3 er ikke konfigureret.");
  const payloadHash = sha256(body ?? Buffer.alloc(0));
  const signed = authorization(config, method, storageKey, payloadHash);
  const response = await fetch(`https://${signed.host}${signed.canonicalUri}`, {
    method,
    headers: {
      host: signed.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": signed.amzDate,
      authorization: signed.authorization,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Kunne ikke ${method === "GET" ? "hente" : method === "PUT" ? "gemme" : "slette"} filen i S3 (${response.status}).`);
  }
  return response;
}

/** Gemmer binære data uden at lægge base64-indhold i databasen. */
export async function saveFile({
  companyId,
  fileName,
  mimeType,
  buffer,
}: {
  companyId: number;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ storage: Backend; storageKey: string; sizeBytes: number }> {
  assertValidFile(mimeType, buffer);
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("Ugyldigt virksomheds-id.");
  const storage = storageBackend();
  const storageKey = `${companyId}/${randomUUID()}.${extensionFromName(fileName, mimeType)}`;

  if (storage === "disk") {
    const target = diskPath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer, { flag: "wx" });
  } else {
    await s3Fetch("PUT", storageKey, buffer);
  }
  return { storage, storageKey, sizeBytes: buffer.length };
}

/** Henter en fil fra det lager, som rækken selv angiver. */
export async function readFile(storage: string, storageKey: string): Promise<Buffer> {
  if (storage === "disk") return readDiskFile(diskPath(storageKey));
  if (storage === "s3") return Buffer.from(await (await s3Fetch("GET", storageKey)).arrayBuffer());
  throw new Error("Ukendt fillager.");
}

/** Sletter en fil; en manglende diskfil betragtes som allerede slettet. */
export async function deleteFile(storage: string, storageKey: string): Promise<void> {
  if (storage === "disk") {
    await rm(diskPath(storageKey), { force: true });
    return;
  }
  if (storage === "s3") {
    await s3Fetch("DELETE", storageKey);
    return;
  }
  throw new Error("Ukendt fillager.");
}

/** Opretter en 15-minutters, læsebegrænset S3-adresse. Diskfiler serveres af applikationen. */
export async function presignedUrl(storage: string, storageKey: string): Promise<string | null> {
  if (storage === "disk") return null;
  if (storage !== "s3") throw new Error("Ukendt fillager.");
  const config = s3Config();
  if (!config) throw new Error("S3 er ikke konfigureret.");

  const { host, canonicalUri, service, algorithm } = s3RequestParts(config, storageKey);
  const { amzDate, dateStamp } = timestampParts();
  const scope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(S3_EXPIRY_SECONDS),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
  const canonicalRequest = ["GET", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [algorithm, amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp, config.region, service))
    .update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Dekoder en ældre data-URL og validerer dens MIME-type og størrelse. */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new Error("Den gemte fil har et ugyldigt dataformat.");
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  assertValidFile(mimeType, buffer);
  return { buffer, mimeType };
}

/** Flytter ældre base64-bilag til det aktuelt valgte filsystem. */
export async function migrateLegacyAttachments(): Promise<number> {
  const legacy = db.select().from(attachments).where(isNotNull(attachments.dataUrl)).all();
  let migrated = 0;
  for (const attachment of legacy) {
    if (!attachment.dataUrl) continue;
    const { buffer, mimeType } = decodeDataUrl(attachment.dataUrl);
    const saved = await saveFile({
      companyId: attachment.companyId,
      fileName: attachment.fileName,
      mimeType,
      buffer,
    });
    db.update(attachments)
      .set({ storage: saved.storage, storageKey: saved.storageKey, sizeBytes: saved.sizeBytes, dataUrl: null })
      .where(eq(attachments.id, attachment.id))
      .run();
    migrated++;
  }
  return migrated;
}

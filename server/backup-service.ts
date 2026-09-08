import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type BackupResult = { key: string; size: number; checksum: string; verified: boolean; localPath: string };
type ManifestFile = { key: string; relativePath: string; size: number; checksum: string };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Miljøvariablen ${name} mangler.`);
  return value;
}

function client() {
  return new S3Client({
    region: required("S3_REGION"),
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") },
  });
}

export function externalBackupConfigured() {
  return ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].every((name) => Boolean(process.env[name]?.trim()));
}

function filesBelow(root: string, current = root): string[] {
  if (!existsSync(current)) return [];
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(current, entry.name);
    return entry.isDirectory() ? filesBelow(root, path) : entry.isFile() ? [path] : [];
  });
}

export async function createExternalBackup(): Promise<BackupResult> {
  if (!externalBackupConfigured()) throw new Error("Ekstern S3-backup er ikke konfigureret.");
  const databasePath = resolve(process.env.DATABASE_PATH || "data.db");
  const backupDir = resolve(process.env.BACKUP_DIR || "./backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const localPath = join(backupDir, `smartregnskab-${stamp}.db`);
  const source = new Database(databasePath, { readonly: true, fileMustExist: true });
  try { await source.backup(localPath); } finally { source.close(); }
  const verification = new Database(localPath, { readonly: true, fileMustExist: true });
  try {
    const check = verification.pragma("quick_check", { simple: true });
    if (check !== "ok") throw new Error(`SQLite-integritetskontrol fejlede: ${String(check)}`);
  } finally { verification.close(); }
  const checksum = createHash("sha256").update(readFileSync(localPath)).digest("hex");
  const size = statSync(localPath).size;
  const prefix = (process.env.S3_BACKUP_PREFIX || "smartregnskab/backups").replace(/^\/+|\/+$/g, "");
  const snapshotPrefix = `${prefix}/snapshots/${stamp}`;
  const databaseKey = `${snapshotPrefix}/database/${basename(localPath)}`;
  const bucket = required("S3_BUCKET");
  const s3 = client();
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: databaseKey, Body: createReadStream(localPath), ContentType: "application/vnd.sqlite3",
    ServerSideEncryption: "AES256", Metadata: { sha256: checksum, product: "add-smartregnskab", created: new Date().toISOString() },
  }));
  const fileRoot = resolve(process.env.FILE_STORAGE_DIR || "./uploads");
  const uploadedFiles: ManifestFile[] = [];
  for (const path of filesBelow(fileRoot)) {
    const relativePath = path.slice(fileRoot.length).replace(/^[/\\]+/, "").replaceAll("\\", "/");
    const fileChecksum = createHash("sha256").update(readFileSync(path)).digest("hex");
    const fileSize = statSync(path).size;
    const fileKey = `${snapshotPrefix}/files/${relativePath}`;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileKey, Body: createReadStream(path), ServerSideEncryption: "AES256", Metadata: { sha256: fileChecksum, product: "add-smartregnskab" } }));
    uploadedFiles.push({ key: fileKey, relativePath, size: fileSize, checksum: fileChecksum });
  }
  const manifest = { format: 1, product: "ADD SmartRegnskab", createdAt: new Date().toISOString(), database: { key: databaseKey, size, checksum }, files: uploadedFiles };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const manifestChecksum = createHash("sha256").update(manifestBytes).digest("hex");
  const key = `${snapshotPrefix}/manifest.json`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: manifestBytes, ContentType: "application/json", ServerSideEncryption: "AES256", Metadata: { sha256: manifestChecksum, product: "add-smartregnskab" } }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: databaseKey }));
  const manifestHead = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const verified = Number(head.ContentLength) === size && head.Metadata?.sha256 === checksum && Number(manifestHead.ContentLength) === manifestBytes.length && manifestHead.Metadata?.sha256 === manifestChecksum;
  if (!verified) throw new Error("Backup blev uploadet, men fjernverifikationen fejlede.");
  return { key, size, checksum, verified, localPath };
}

export async function verifyExternalBackup(key: string) {
  if (!externalBackupConfigured()) throw new Error("Ekstern S3-backup er ikke konfigureret.");
  if (!key.startsWith((process.env.S3_BACKUP_PREFIX || "smartregnskab/backups").replace(/^\/+|\/+$/g, "") + "/") || !key.endsWith("/manifest.json")) throw new Error("Ugyldig backupnøgle.");
  const bucket = required("S3_BUCKET");
  const s3 = client();
  const manifestObject = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!manifestObject.Body) throw new Error("Backupmanifestet er tomt.");
  const manifestBytes = Buffer.from(await manifestObject.Body.transformToByteArray());
  const manifestChecksum = createHash("sha256").update(manifestBytes).digest("hex");
  if (manifestObject.Metadata?.sha256 && manifestObject.Metadata.sha256 !== manifestChecksum) throw new Error("Backupmanifestets kontrolsum stemmer ikke.");
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as { database: ManifestFile; files: ManifestFile[] };
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: manifest.database.key }));
  if (!object.Body) throw new Error("Databasen i backuppen er tom.");
  const tempPath = join(tmpdir(), `smartregnskab-restore-check-${Date.now()}.db`);
  try {
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (checksum !== manifest.database.checksum || (object.Metadata?.sha256 && object.Metadata.sha256 !== checksum)) throw new Error("Backupens SHA-256 kontrolsum stemmer ikke.");
    for (const file of manifest.files || []) {
      const remote = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: file.key }));
      if (!remote.Body) throw new Error(`Bilaget ${file.relativePath} mangler i backuppen.`);
      const fileBytes = Buffer.from(await remote.Body.transformToByteArray());
      const fileChecksum = createHash("sha256").update(fileBytes).digest("hex");
      if (fileBytes.length !== file.size || fileChecksum !== file.checksum) throw new Error(`Bilaget ${file.relativePath} bestod ikke integritetskontrollen.`);
    }
    writeFileSync(tempPath, bytes, { mode: 0o600 });
    const restored = new Database(tempPath, { readonly: true, fileMustExist: true });
    try {
      const quickCheck = restored.pragma("quick_check", { simple: true });
      if (quickCheck !== "ok") throw new Error(`Gendannelseskontrollen fejlede: ${String(quickCheck)}`);
      const tables = restored.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as { count: number };
      const companies = restored.prepare("SELECT COUNT(*) AS count FROM companies").get() as { count: number };
      return { verified: true, checksum, size: bytes.length, fileCount: (manifest.files || []).length, tableCount: tables.count, companyCount: companies.count, checkedAt: new Date().toISOString() };
    } finally { restored.close(); }
  } finally { try { rmSync(tempPath, { force: true }); } catch {} }
}

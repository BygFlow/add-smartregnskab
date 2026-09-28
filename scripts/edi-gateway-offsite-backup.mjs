#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import { uploadVerifiedEdiBackup } from "../services/edi-gateway/offsite-backup.mjs";

const required = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "EDI_GATEWAY_BACKUP_ENCRYPTION_KEY"];
if (required.some(name => !process.env[name])) {
  console.error("EDI-offsite-backup mangler S3-konfiguration eller særskilt krypteringsnøgle.");
  process.exit(1);
}
const local = spawnSync(process.execPath, ["scripts/edi-gateway-backup.mjs"], { cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: process.env, encoding: "utf8" });
if (local.status !== 0) {
  console.error(local.stderr || local.stdout || "Lokal EDI-backup fejlede.");
  process.exit(1);
}
try {
  const snapshot = JSON.parse(local.stdout.trim());
  const s3 = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  const result = await uploadVerifiedEdiBackup(snapshot.destination, s3);
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  console.error(`EDI-offsite-backup fejlede: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const required = ["EDI_GATEWAY_DATABASE_PATH", "EDI_GATEWAY_BACKUP_DIR", "EDI_GATEWAY_BACKUP_ENCRYPTION_KEY",
  "S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];

export function missingOffsiteBackupConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  return required.filter(name => !env[name]);
}

/** Runs in the gateway service: a Render cron job cannot access its persistent disk. */
export function startGatewayBackupScheduler(): void {
  if (process.env.EDI_GATEWAY_OFFSITE_BACKUP_ENABLED !== "true") return;
  const missing = missingOffsiteBackupConfig();
  if (missing.length) throw new Error(`EDI-offsite-backup mangler: ${missing.join(", ")}`);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { stdout } = await execFileAsync(process.execPath, ["scripts/edi-gateway-offsite-backup.mjs"], {
        cwd: process.cwd(), env: process.env, timeout: 20 * 60_000, maxBuffer: 1024 * 1024,
      });
      const result = JSON.parse(stdout.trim()) as { ok?: boolean; restored?: boolean; sizeBytes?: number };
      if (!result.ok || !result.restored) throw new Error("Offsite-backup blev ikke verificeret.");
      console.info("EDI-offsite-backup verificeret:", { sizeBytes: result.sizeBytes, at: new Date().toISOString() });
    } catch (error) {
      console.error("EDI-offsite-backup fejlede:", error instanceof Error ? error.message : "Ukendt fejl");
    } finally { running = false; }
  };
  const first = setTimeout(() => void run(), 5 * 60_000);
  first.unref();
  const daily = setInterval(() => void run(), 24 * 60 * 60_000);
  daily.unref();
}

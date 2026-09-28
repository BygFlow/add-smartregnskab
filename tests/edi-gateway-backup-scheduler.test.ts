import assert from "node:assert/strict";
import test from "node:test";
import { missingOffsiteBackupConfig } from "../services/edi-gateway/backup-scheduler";

test("gateway backup scheduler refuses partial offsite configuration", () => {
  assert.deepEqual(missingOffsiteBackupConfig({}), ["EDI_GATEWAY_DATABASE_PATH", "EDI_GATEWAY_BACKUP_DIR",
    "EDI_GATEWAY_BACKUP_ENCRYPTION_KEY", "S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
  const configured = Object.fromEntries(missingOffsiteBackupConfig({}).map(name => [name, "test-value"]));
  assert.deepEqual(missingOffsiteBackupConfig(configured), []);
});

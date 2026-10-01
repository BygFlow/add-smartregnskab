import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { S3Client } from "@aws-sdk/client-s3";

test("backup reads its remote objects before retention may run", async () => {
  const root = await mkdtemp(join(tmpdir(), "smart-backup-readback-"));
  const databasePath = join(root, "source.db");
  const uploadRoot = join(root, "uploads");
  const backupRoot = join(root, "backups");
  await mkdir(join(uploadRoot, "1"), { recursive: true });
  await writeFile(join(uploadRoot, "1", "receipt.pdf"), "%PDF-1.4\ntest receipt");
  const db = new Database(databasePath);
  db.exec("CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO companies VALUES (1, 'Test');");
  db.close();

  const names = ["DATABASE_PATH", "FILE_STORAGE_DIR", "BACKUP_DIR", "S3_BUCKET", "S3_REGION",
    "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BACKUP_PREFIX", "ENCRYPTION_KEY"];
  const old = new Map(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    DATABASE_PATH: databasePath, FILE_STORAGE_DIR: uploadRoot, BACKUP_DIR: backupRoot,
    S3_BUCKET: "test-bucket", S3_REGION: "eu-central-1", S3_ACCESS_KEY_ID: "test-key",
    S3_SECRET_ACCESS_KEY: "test-secret", S3_BACKUP_PREFIX: "smartregnskab/backups",
    ENCRYPTION_KEY: "test-encryption-key",
  });
  const objects = new Map<string, { body: Buffer; metadata: Record<string, string> }>();
  const originalSend = S3Client.prototype.send;
  let corruptDatabaseRead = false;
  let pruneChecks = 0;
  (S3Client.prototype as any).send = async (command: any) => {
    const key = command.input.Key as string;
    if (command.constructor.name === "PutObjectCommand") {
      objects.set(key, { body: Buffer.from(command.input.Body), metadata: command.input.Metadata });
      return {};
    }
    if (command.constructor.name === "HeadObjectCommand") {
      const object = objects.get(key);
      if (!object) throw new Error("Missing test object");
      return { ContentLength: object.body.length, Metadata: object.metadata };
    }
    if (command.constructor.name === "GetObjectCommand") {
      const object = objects.get(key);
      if (!object) throw new Error("Missing test object");
      const body = corruptDatabaseRead && key.includes("/database/") ? Buffer.from("corrupt") : object.body;
      return { Metadata: object.metadata, Body: { transformToByteArray: async () => body } };
    }
    if (command.constructor.name === "ListObjectsV2Command") {
      pruneChecks++;
      return { Contents: [], IsTruncated: false };
    }
    throw new Error(`Unexpected S3 command ${command.constructor.name}`);
  };

  try {
    const { createExternalBackup } = await import("../server/backup-service");
    const result = await createExternalBackup();
    assert.equal(result.verified, true);
    assert.ok(pruneChecks > 0, "retention may run after successful readback");
    const beforeFailure = pruneChecks;
    corruptDatabaseRead = true;
    await assert.rejects(() => createExternalBackup(), /authenticate data|integrity|decrypt/i);
    assert.equal(pruneChecks, beforeFailure, "failed readback must not prune snapshots");
  } finally {
    S3Client.prototype.send = originalSend;
    for (const [name, value] of old) value === undefined ? delete process.env[name] : process.env[name] = value;
    await rm(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { decryptEdiSnapshot, encryptEdiSnapshot, uploadVerifiedEdiBackup } from "../services/edi-gateway/offsite-backup.mjs";

test("encrypted offsite backup is downloaded, restored and checked before success", async () => {
  const root = mkdtempSync(join(tmpdir(), "edi-offsite-test-"));
  const original = { key: process.env.EDI_GATEWAY_BACKUP_ENCRYPTION_KEY, bucket: process.env.S3_BUCKET,
    prefix: process.env.EDI_GATEWAY_S3_PREFIX };
  process.env.EDI_GATEWAY_BACKUP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.S3_BUCKET = "test-bucket";
  process.env.EDI_GATEWAY_S3_PREFIX = "test/edi";
  try {
    const path = join(root, "snapshot.db");
    const db = new Database(path);
    db.exec(`CREATE TABLE edi_gateway_tenants (id INTEGER PRIMARY KEY);
      CREATE TABLE edi_gateway_documents (id INTEGER PRIMARY KEY);
      CREATE TABLE edi_gateway_webhook_events (id INTEGER PRIMARY KEY);`);
    db.close();
    let object;
    const s3 = { async send(command) {
      const name = command.constructor.name;
      if (name === "PutObjectCommand") {
        object = { body: command.input.Body, metadata: command.input.Metadata, key: command.input.Key };
        return {};
      }
      if (name === "HeadObjectCommand") return { ContentLength: object.body.length, Metadata: object.metadata };
      if (name === "GetObjectCommand") return { Metadata: object.metadata,
        Body: { async transformToByteArray() { return object.body; } } };
      throw new Error(`Unexpected S3 command: ${name}`);
    } };
    const result = await uploadVerifiedEdiBackup(path, s3);
    assert.equal(result.restored, true);
    assert.equal(result.key, "test/edi/snapshot.db.aes256gcm");
    assert.notEqual(object.body.subarray(0, 16).toString(), "SQLite format 3\0");
    const encrypted = encryptEdiSnapshot(Buffer.from("sensitive"));
    assert.equal(decryptEdiSnapshot(encrypted.body, encrypted.metadata).toString(), "sensitive");
    encrypted.body[0] ^= 1;
    assert.throws(() => decryptEdiSnapshot(encrypted.body, encrypted.metadata));
  } finally {
    for (const [name, value] of Object.entries({ EDI_GATEWAY_BACKUP_ENCRYPTION_KEY: original.key,
      S3_BUCKET: original.bucket, EDI_GATEWAY_S3_PREFIX: original.prefix })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    assert.equal(dirname(realpathSync(root)), realpathSync(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

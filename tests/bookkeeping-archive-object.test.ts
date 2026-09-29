import test from "node:test";
import assert from "node:assert/strict";
import { GetObjectCommand, GetObjectRetentionCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { storeLockedArchiveObject } from "../server/bookkeeping-archive-object";
import type { ArchiveBucketConfig } from "../server/bookkeeping-archive-readiness";

const config: ArchiveBucketConfig = {
  bucket: "accounting-archive", backupBucket: "rolling-backup", region: "eu-central",
  endpoint: "https://nbg1.your-objectstorage.com", accessKeyId: "test", secretAccessKey: "test",
};
const input = {
  config,
  key: "companies/42/fiscal-years/2026-04-01/journal/entry-1.json",
  plain: Buffer.from('{"entry":1}'),
  retainUntil: "2032-03-31T23:59:59.999Z",
  encryptionSecret: "a".repeat(64),
  now: new Date("2026-09-29T00:00:00Z"),
};

test("archive upload is encrypted, compliance-locked, versioned and read back", async () => {
  let encrypted = Buffer.alloc(0);
  let metadata: Record<string, string> | undefined;
  const commands: string[] = [];
  const result = await storeLockedArchiveObject(input, async (command) => {
    commands.push(command.constructor.name);
    if (command instanceof PutObjectCommand) {
      assert.equal(command.input.ObjectLockMode, "COMPLIANCE");
      assert.equal(command.input.ObjectLockRetainUntilDate?.toISOString(), input.retainUntil);
      encrypted = command.input.Body as Buffer;
      metadata = command.input.Metadata;
      assert.notDeepEqual(encrypted, input.plain);
      assert.equal(command.input.Metadata?.encryption, "aes-256-gcm");
      return { VersionId: "version-1" };
    }
    assert.equal(command.input.VersionId, "version-1");
    if (command instanceof GetObjectRetentionCommand) {
      return { Retention: { Mode: "COMPLIANCE", RetainUntilDate: new Date(input.retainUntil) } };
    }
    if (command instanceof GetObjectCommand) {
      return { Metadata: metadata, Body: { transformToByteArray: async () => encrypted } };
    }
    throw new Error("Unexpected command");
  });
  assert.deepEqual(commands, ["PutObjectCommand", "GetObjectRetentionCommand", "GetObjectCommand"]);
  assert.equal(result.verified, true);
  assert.equal(result.versionId, "version-1");
});

test("archive upload fails closed without encryption or confirmed retention", async () => {
  await assert.rejects(() => storeLockedArchiveObject({ ...input, encryptionSecret: "short" }, async () => ({})), /ARCHIVE_ENCRYPTION_KEY/);
  await assert.rejects(() => storeLockedArchiveObject({ ...input, key: "../escape" }, async () => ({})), /Arkivnøglen/);
  await assert.rejects(() => storeLockedArchiveObject(input, async (command) => {
    if (command instanceof PutObjectCommand) return { VersionId: "version-2" };
    return { Retention: { Mode: "GOVERNANCE", RetainUntilDate: new Date(input.retainUntil) } };
  }), /Compliance-retention/);
});

test("gateway CVR objects use the same encrypted Compliance-lock path", async () => {
  let encrypted = Buffer.alloc(0);
  let metadata: Record<string, string> | undefined;
  const result = await storeLockedArchiveObject({ ...input,
    key: "gateway-cvr/12345678/fiscal-years/2026-04-01/originals/xml-1.xml",
  }, async (command) => {
    if (command instanceof PutObjectCommand) {
      encrypted = command.input.Body as Buffer;
      metadata = command.input.Metadata;
      assert.equal(command.input.ObjectLockMode, "COMPLIANCE");
      return { VersionId: "gateway-version" };
    }
    if (command instanceof GetObjectRetentionCommand) {
      return { Retention: { Mode: "COMPLIANCE", RetainUntilDate: new Date(input.retainUntil) } };
    }
    return { Metadata: metadata, Body: { transformToByteArray: async () => encrypted } };
  });
  assert.equal(result.verified, true);
  await assert.rejects(() => storeLockedArchiveObject({ ...input,
    key: "gateway-cvr/12345678/../originals/xml-1.xml",
  }, async () => ({})), /Arkivnøglen/);
});


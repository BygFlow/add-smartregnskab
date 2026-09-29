import assert from "node:assert/strict";
import test from "node:test";
import { archiveBucketConfig, archivePeriod, checkArchiveBucket } from "../server/bookkeeping-archive-readiness";

const env = {
  ARCHIVE_S3_BUCKET: "books-archive-test",
  S3_BUCKET: "rolling-backup-test",
  ARCHIVE_S3_REGION: "eu-central",
  ARCHIVE_S3_ENDPOINT: "https://nbg1.your-objectstorage.com",
  ARCHIVE_S3_ACCESS_KEY_ID: "test-key",
  ARCHIVE_S3_SECRET_ACCESS_KEY: "test-secret",
};

test("archive refuses the rolling backup bucket and non-HTTPS endpoint", () => {
  assert.throws(() => archiveBucketConfig({ ...env, ARCHIVE_S3_BUCKET: env.S3_BUCKET }), /anden bucket/);
  assert.throws(() => archiveBucketConfig({ ...env, ARCHIVE_S3_ENDPOINT: "http://example.test" }), /HTTPS/);
  assert.throws(() => archiveBucketConfig({ ...env, ARCHIVE_S3_ENDPOINT: "https://example.test" }), /Nürnberg/);
  assert.throws(() => archiveBucketConfig({ ...env, ARCHIVE_S3_REGION: "other" }), /eu-central/);
});

test("archive readiness requires Object Lock and does not modify the bucket", async () => {
  const config = archiveBucketConfig(env);
  let reads = 0;
  await assert.rejects(checkArchiveBucket(config, async (command) => {
    assert.equal(command.input.Bucket, config.bucket);
    reads++;
    return { ObjectLockConfiguration: { ObjectLockEnabled: "Disabled" } };
  }), /Object Lock/);
  const ready = await checkArchiveBucket(config, async (command) => {
    assert.equal(command.input.Bucket, config.bucket);
    reads++;
    return { ObjectLockConfiguration: { ObjectLockEnabled: "Enabled" } };
  });
  assert.equal(reads, 2);
  assert.deepEqual(ready, { ready: true, bucket: config.bucket, objectLockEnabled: true });
});

test("five-year retention follows the company's fiscal year, not the calendar year", () => {
  assert.deepEqual(archivePeriod("2025-04-01", "2026-02-15"), {
    start: "2025-04-01", end: "2026-03-31", retainUntil: "2031-03-31T23:59:59.999Z",
  });
  assert.deepEqual(archivePeriod("2026-01-01", "2026-09-29"), {
    start: "2026-01-01", end: "2026-12-31", retainUntil: "2031-12-31T23:59:59.999Z",
  });
  assert.deepEqual(archivePeriod("2023-03-01", "2024-02-29"), {
    start: "2023-03-01", end: "2024-02-29", retainUntil: "2029-03-01T23:59:59.999Z",
  });
  assert.throws(() => archivePeriod("", "2026-09-29"), /skal være/);
  assert.throws(() => archivePeriod("2026-02-29", "2026-09-29"), /Ugyldig/);
});


import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ArchiveBucketConfig } from "../server/bookkeeping-archive-readiness";
import type { ArchiveReceipt, storeLockedArchiveObject, readLockedArchiveObject } from "../server/bookkeeping-archive-object";
import { readSegmentedArchive, storeSegmentedArchive } from "../server/bookkeeping-archive-segments";

const config: ArchiveBucketConfig = {
  bucket: "locked-archive", backupBucket: "rolling-backup", region: "eu-central",
  endpoint: "https://nbg1.your-objectstorage.com", accessKeyId: "test", secretAccessKey: "test",
};
const prefix = "companies/7/fiscal-years/2026-01-01/real-data/9a3c63f1-c70b-4d8a-a781-a4cb0aba53ef";
const retainUntil = "2031-12-31T23:59:59.999Z";
const encryptionSecret = "a".repeat(64);

function fakeLockedStore() {
  const objects = new Map<string, Buffer>();
  const store = (async ({ key, plain, config: usedConfig, retainUntil: retention }: Parameters<typeof storeLockedArchiveObject>[0]) => {
    assert.equal(usedConfig.bucket, config.bucket);
    assert.equal(retention, retainUntil);
    objects.set(key, Buffer.from(plain));
    return { bucket: config.bucket, objectKey: key, versionId: "version-1",
      sha256: createHash("sha256").update(plain).digest("hex"), plainBytes: plain.length,
      retainUntil, verified: true } satisfies ArchiveReceipt;
  }) as typeof storeLockedArchiveObject;
  const read = (async ({ receipt }: Parameters<typeof readLockedArchiveObject>[0]) => {
    const bytes = objects.get(receipt.objectKey);
    if (!bytes) throw new Error("Arkivobjektet mangler.");
    return Buffer.from(bytes);
  }) as typeof readLockedArchiveObject;
  return { objects, store, read };
}

test("segmenteret arkiv låser hver del og genskaber byte-strømmen i rækkefølge", async () => {
  const fake = fakeLockedStore();
  const original = Buffer.from("abcdefghijklmnopqrstuvwx");
  const stored = await storeSegmentedArchive({
    config, prefix, source: (async function* () {
      yield original.subarray(0, 3);
      yield original.subarray(3, 18);
      yield original.subarray(18);
    })(), retainUntil, encryptionSecret, partBytes: 5,
  }, fake.store);
  assert.equal(stored.partCount, 5);
  assert.equal(fake.objects.size, 6, "five parts and one locked manifest");
  const recovered: Buffer[] = [];
  const result = await readSegmentedArchive({ config, receipt: stored.receipt,
    encryptionSecret, expectedCompanyId: 7, expectedFiscalYearStart: "2026-01-01",
    sink: async (part) => { recovered.push(part); },
  }, fake.read);
  assert.equal(result.sourceSha256, stored.sourceSha256);
  assert.deepEqual(Buffer.concat(recovered), original);
  await assert.rejects(readSegmentedArchive({ config, receipt: stored.receipt,
    encryptionSecret, expectedCompanyId: 8, expectedFiscalYearStart: "2026-01-01",
  }, fake.read), /anden virksomhed/);
});

test("segmenteret gendannelse afviser manglende, ombyttede og ændrede dele", async () => {
  const fake = fakeLockedStore();
  const stored = await storeSegmentedArchive({ config, prefix,
    source: (async function* () { yield Buffer.from("abcdefghijkl"); })(),
    retainUntil, encryptionSecret, partBytes: 4,
  }, fake.store);
  const manifestBytes = fake.objects.get(stored.receipt.objectKey)!;
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const read = () => readSegmentedArchive({ config, receipt: stored.receipt,
    encryptionSecret, expectedCompanyId: 7, expectedFiscalYearStart: "2026-01-01",
  }, fake.read);
  fake.objects.delete(manifest.parts[1].objectKey);
  await assert.rejects(read(), /mangler/);
  fake.objects.set(manifest.parts[1].objectKey, Buffer.from("efgh"));
  [manifest.parts[0], manifest.parts[1]] = [manifest.parts[1], manifest.parts[0]];
  fake.objects.set(stored.receipt.objectKey, Buffer.from(JSON.stringify(manifest)));
  await assert.rejects(read(), /ugyldig/);
  [manifest.parts[0], manifest.parts[1]] = [manifest.parts[1], manifest.parts[0]];
  fake.objects.set(stored.receipt.objectKey, Buffer.from(JSON.stringify(manifest)));
  fake.objects.set(manifest.parts[1].objectKey, Buffer.from("xxxx"));
  await assert.rejects(read(), /samlede checksum/);
});

test("tomt segmentarkiv kan ikke få et manifest", async () => {
  const fake = fakeLockedStore();
  await assert.rejects(storeSegmentedArchive({ config, prefix,
    source: (async function* () {})(), retainUntil, encryptionSecret,
  }, fake.store), /tomt regnskabsår/);
  assert.equal(fake.objects.size, 0);
});

test("ændret kilde får ikke et offentliggjort manifest", async () => {
  const fake = fakeLockedStore();
  await assert.rejects(storeSegmentedArchive({ config, prefix,
    source: (async function* () { yield Buffer.from("ny årsudgave"); })(),
    retainUntil, encryptionSecret, partBytes: 4,
    expectedSourceSha256: createHash("sha256").update("forberedt årsudgave").digest("hex"),
    expectedSourceBytes: Buffer.byteLength("forberedt årsudgave"),
  }, fake.store), /før manifestet blev offentliggjort/);
  assert.ok(fake.objects.size > 0, "afbrudte låste dele kan ikke slettes sikkert");
  assert.equal([...fake.objects.keys()].some((key) => key.includes("/manifest-")), false);
});

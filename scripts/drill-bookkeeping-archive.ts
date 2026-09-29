import { randomUUID } from "node:crypto";
import { archiveBucketConfig, archivePeriod, checkArchiveBucket, type ArchiveBucketConfig } from "../server/bookkeeping-archive-readiness";
import { readLockedArchiveObject, storeLockedArchiveObject } from "../server/bookkeeping-archive-object";

export async function runSyntheticArchiveDrill(config: ArchiveBucketConfig, encryptionSecret: string) {
  if (!/^[0-9a-f]{64}$/i.test(encryptionSecret)) {
    throw new Error("ARCHIVE_ENCRYPTION_KEY skal være 32 bytes i hexadecimal form.");
  }
  await checkArchiveBucket(config);

  const now = new Date();
  const period = archivePeriod(`${now.getUTCFullYear()}-01-01`, now.toISOString().slice(0, 10));
  const plain = Buffer.from(JSON.stringify({
    kind: "synthetic-bookkeeping-archive-drill",
    containsCustomerData: false,
    id: randomUUID(),
    createdAt: now.toISOString(),
  }), "utf8");
  const receipt = await storeLockedArchiveObject({
    config,
    key: `companies/0/fiscal-years/${period.start}/drills/${randomUUID()}.json`,
    plain,
    retainUntil: period.retainUntil,
    encryptionSecret,
    now,
  });
  const restored = await readLockedArchiveObject({ config, receipt, encryptionSecret });
  if (!restored.equals(plain)) throw new Error("Den isolerede gendannelse gav ikke de oprindelige bytes.");
  return {
    verified: true,
    bucket: receipt.bucket,
    objectKey: receipt.objectKey,
    versionId: receipt.versionId,
    sha256: receipt.sha256,
    retainUntil: receipt.retainUntil,
  };
}

if (process.argv[1] && /(?:drill-bookkeeping-archive\.(?:ts|js)|archive-drill\.cjs)$/.test(process.argv[1])) {
  (async () => {
    if (process.env.ARCHIVE_LIVE_DRILL !== "YES") {
      throw new Error("Sæt ARCHIVE_LIVE_DRILL=YES for en bevidst, permanent låst syntetisk test.");
    }
    const result = await runSyntheticArchiveDrill(archiveBucketConfig(), process.env.ARCHIVE_ENCRYPTION_KEY || "");
    console.log(JSON.stringify(result));
  })().catch((error) => {
    console.error(error instanceof Error ? error.message : "Arkivtesten fejlede.");
    process.exitCode = 1;
  });
}


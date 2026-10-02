import { GetObjectLockConfigurationCommand, S3Client } from "@aws-sdk/client-s3";

export type ArchiveBucketConfig = {
  bucket: string;
  backupBucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Ingen kalenderårs-fallback: et juridisk selskabs regnskabsår skal være angivet. */
export function archivePeriod(fiscalYearStart: string, referenceDate: string) {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fiscalYearStart);
  const referenceMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(referenceDate);
  if (!startMatch || !referenceMatch) throw new Error("Regnskabsårets start og referencedato skal være YYYY-MM-DD.");
  const validDate = (value: string) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(fiscalYearStart) || !validDate(referenceDate)) throw new Error("Ugyldig regnskabsdato.");
  const monthDay = `${startMatch[2]}-${startMatch[3]}`;
  if (monthDay === "02-29") throw new Error("Regnskabsåret må ikke starte 29. februar.");
  const referenceYear = Number(referenceMatch[1]);
  const startYear = referenceDate >= `${referenceYear}-${monthDay}` ? referenceYear : referenceYear - 1;
  const start = `${startYear}-${monthDay}`;
  const nextStart = new Date(`${startYear + 1}-${monthDay}T00:00:00Z`);
  const end = new Date(nextStart.getTime() - 86_400_000).toISOString().slice(0, 10);
  const retainDate = new Date(`${end}T23:59:59.999Z`);
  retainDate.setUTCFullYear(retainDate.getUTCFullYear() + 5);
  const retainUntil = retainDate.toISOString();
  return { start, end, retainUntil };
}

export function archiveBucketConfig(env: NodeJS.ProcessEnv = process.env): ArchiveBucketConfig {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} mangler; femårsarkivet er ikke klar.`);
    return value;
  };
  const config = {
    bucket: required("ARCHIVE_S3_BUCKET"),
    backupBucket: required("S3_BUCKET"),
    region: required("ARCHIVE_S3_REGION"),
    endpoint: required("ARCHIVE_S3_ENDPOINT"),
    accessKeyId: required("ARCHIVE_S3_ACCESS_KEY_ID"),
    secretAccessKey: required("ARCHIVE_S3_SECRET_ACCESS_KEY"),
  };
  if (config.bucket === config.backupBucket) {
    throw new Error("Femårsarkivet skal bruge en anden bucket end den rullende backup.");
  }
  let endpoint: URL;
  try { endpoint = new URL(config.endpoint); } catch { throw new Error("Arkivets S3-endpoint er ugyldigt."); }
  if (endpoint.protocol !== "https:") throw new Error("Arkivets S3-endpoint skal bruge HTTPS.");
  if (endpoint.hostname !== "nbg1.your-objectstorage.com" || endpoint.pathname !== "/"
      || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("Arkivets S3-endpoint skal pege på Hetzner Nürnberg uden ekstra URL-data.");
  }
  if (config.region !== "eu-central") throw new Error("Arkivets S3-region skal være eu-central.");
  return config;
}

/** A bucket and a synthetic drill do not prove that real bookkeeping records are archived. */
export function bookkeepingArchiveStatus(env: NodeJS.ProcessEnv = process.env) {
  let configured = false;
  try {
    archiveBucketConfig(env);
    configured = /^[0-9a-f]{64}$/i.test(env.ARCHIVE_ENCRYPTION_KEY || "");
  } catch {
    // Readiness must not expose credentials or treat partial configuration as ready.
  }
  return {
    configured,
    objectLockVerification: "not_checked_by_status" as const,
    capture: "manual_candidate_not_scheduled" as const,
    productionCoverage: "not_verified" as const,
    restoreDrill: "not_verified" as const,
    ready: false as const,
  };
}

/** Kun en readiness-kontrol. Den uploader ikke data og ændrer ikke bucketens indstillinger. */
export async function checkArchiveBucket(
  config: ArchiveBucketConfig,
  sender?: (command: GetObjectLockConfigurationCommand) => Promise<{
    ObjectLockConfiguration?: { ObjectLockEnabled?: string };
  }>,
) {
  const s3 = sender ? null : new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  try {
    const response = await (sender || ((command) => s3!.send(command)))(
      new GetObjectLockConfigurationCommand({ Bucket: config.bucket }),
    );
    if (response.ObjectLockConfiguration?.ObjectLockEnabled !== "Enabled") {
      throw new Error("Object Lock er ikke aktiveret på arkiv-bucketen.");
    }
    return { ready: true, bucket: config.bucket, objectLockEnabled: true };
  } finally {
    s3?.destroy();
  }
}


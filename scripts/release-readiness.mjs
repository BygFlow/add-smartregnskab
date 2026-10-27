import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const checks = [];
const add = (id, ok, category, detail) => checks.push({ id, ok, category, detail });
const requiredFiles = [
  "docs/REGISTRERING-ERHVERVSSTYRELSEN.md", "docs/DRIFT-OG-BACKUP.md",
  "docs/NEMHANDEL-DRIFT.md", "docs/GDPR-OG-DATABEHANDLING.md",
  "docs/SIKKERHED-OG-HÆNDELSESBEREDSKAB.md", "docs/UNDERDATABEHANDLERE.md",
  "docs/AI-GOVERNANCE.md", "docs/ABONNEMENTSVILKAAR-UDKAST.md",
  "docs/SLA-OG-SUPPORT.md", "docs/SLETNING-OG-EXIT.md", "docs/MYNDIGHEDSBILAG.md",
  "docs/REGISTRERINGS-CHECKLISTE.md", "docs/PILOT-OG-ACCEPTTEST.md",
  "docs/ONBOARDING-OG-OPSÆTNING.md", "docs/SUPPORTCENTER.md", "docs/PRISER-OG-PAKKER.md",
  "docs/INTEGRATIONSADAPTERE.md", "docs/SIKKERHEDSREVIEW-3.6.0.md", "docs/LOVSTATUS-2026-09-10.md",
  "docs/FAGPORTAL-3.7.0.md", "server/professional-routes.ts",
  "docs/AIIA-QUICKPAY-DRIFT.md", "server/aiia.ts", "server/payments.ts",
  "server/saft.ts", "server/backup-service.ts", "server/einvoice.ts", "server/einvoice-routes.ts",
  "server/import-adapters.ts", "server/migration-routes.ts", "server/readiness-routes.ts",
  "docs/SAF-T-XSD-VALIDERING-2026-10-17.md",
  "docs/BOGFOERINGSLOVEN-CHECKLISTE.md",
  "docs/RELEASE-3.16.3-DRIFTSBEVIS.md",
];
for (const file of requiredFiles) add(`file:${file}`, existsSync(file), "code", existsSync(file) ? "findes" : "mangler");

// The named Clean entry in ADD Connect is an intentional integration, not a
// rebranding of SmartRegnskab. Keep the guard for all other product code.
const grep = spawnSync("git", ["grep", "-In", "SmartDrift Clean", "--", ".", ":(exclude)migrations/meta/*", ":(exclude)scripts/release-readiness.mjs", ":(exclude)server/add-connect.ts"], { encoding: "utf8" });
const trackedText = grep.status === 1 ? "" : String(grep.stdout || grep.stderr || "");
add("brand-separation", trackedText.trim() === "", "code", trackedText.trim() || "Kun den tilsigtede ADD Connect-integration må navngive SmartDrift Clean; SmartRegnskab er fortsat et separat produkt.");

const sproom = String(process.env.EINVOICE_PROVIDER || "").toLowerCase() === "sproom";
const productionEnv = [
  ["external-backup", ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]],
  ["bookkeeping-archive-config", ["ARCHIVE_S3_BUCKET", "ARCHIVE_S3_REGION", "ARCHIVE_S3_ENDPOINT", "ARCHIVE_S3_ACCESS_KEY_ID", "ARCHIVE_S3_SECRET_ACCESS_KEY", "ARCHIVE_ENCRYPTION_KEY"]],
  ["einvoice-access-point", sproom ? ["SPROOM_API_TOKEN", "SPROOM_PARENT_CVR"] : ["EINVOICE_PROVIDER_URL", "EINVOICE_PROVIDER_API_KEY"]],
  ["einvoice-validator", ["EINVOICE_VALIDATOR_URL"]],
  ["einvoice-inbound", sproom ? [] : ["EINVOICE_WEBHOOK_SECRET"]],
  ["subscription-payments", ["QUICKPAY_API_KEY", "QUICKPAY_PRIVATE_KEY"]],
  ["automatic-bankdata", ["AIIA_CLIENT_ID", "AIIA_CLIENT_SECRET"]],
];
for (const [id, names] of productionEnv) {
  if (names.length === 0) continue;
  const missing = names.filter((name) => !process.env[name]);
  add(id, missing.length === 0, "external", missing.length ? `Mangler ${missing.join(", ")}` : "konfigureret");
}
if (sproom) {
  const webhookKeyConfigured = Boolean(process.env.SPROOM_WEBHOOK_PUBLIC_KEY || process.env.SPROOM_WEBHOOK_PUBLIC_KEY_BASE64);
  add("einvoice-inbound", webhookKeyConfigured, "external", webhookKeyConfigured ? "konfigureret" : "Mangler SPROOM_WEBHOOK_PUBLIC_KEY eller SPROOM_WEBHOOK_PUBLIC_KEY_BASE64");
  const provisioningEnabled = /^(1|true|yes)$/i.test(String(process.env.SPROOM_AUTOMATIC_PROVISIONING || ""));
  add("sproom-master-activation", provisioningEnabled, "external", provisioningEnabled ? "aktiveret" : "Afventer Sprooms bekræftede ISV/masteradgang og afsluttet stagingtest");
  const nemhandelEnabled = /^(1|true|yes)$/i.test(String(process.env.SPROOM_AUTO_REGISTER_NEMHANDEL || ""));
  add("sproom-nemhandel-registration", nemhandelEnabled, "external", nemhandelEnabled ? "aktiveret" : "Afventer vellykket registrerings- og modtagelsestest i staging");
}

// Den syntetiske Object-Lock-test beviser kun selve lageret. Før rigtige
// bilag og posteringer arkiveres og gendannes, må registreringsklarhed ikke
// rapporteres som opnået, selv hvis alle miljøvariabler er sat.
add("bookkeeping-archive-real-data", false, "external", "Det segmenterede årsudtræk, det standard-lukkede ugejob og gendannelsesvalideringen består lokalt, inklusive et syntetisk arkiv over 100 MB. Det er ikke kørt mod den faktiske produktionsbucket og rigtige produktionsdata; fem års Object Lock og automatisk produktionsgendannelse er derfor endnu ikke bevist.");

const codeFailed = checks.some((check) => check.category === "code" && !check.ok);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), readyForTechnicalRelease: !codeFailed, readyForRegisteredOperation: checks.every((check) => check.ok), checks }, null, 2));
if (codeFailed) process.exitCode = 1;

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
  "server/saft.ts", "server/backup-service.ts", "server/einvoice.ts", "server/einvoice-routes.ts",
];
for (const file of requiredFiles) add(`file:${file}`, existsSync(file), "code", existsSync(file) ? "findes" : "mangler");

const grep = spawnSync("git", ["grep", "-In", "SmartDrift Clean", "--", ".", ":(exclude)migrations/meta/*", ":(exclude)scripts/release-readiness.mjs"], { encoding: "utf8" });
const trackedText = grep.status === 1 ? "" : String(grep.stdout || grep.stderr || "");
add("brand-separation", trackedText.trim() === "", "code", trackedText.trim() || "Ingen SmartDrift Clean-referencer i produktkoden; SmartRegnskab er fortsat et separat produkt.");

const productionEnv = [
  ["external-backup", ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]],
  ["einvoice-access-point", ["EINVOICE_PROVIDER_URL", "EINVOICE_PROVIDER_API_KEY"]],
  ["einvoice-validator", ["EINVOICE_VALIDATOR_URL"]],
  ["einvoice-inbound", ["EINVOICE_WEBHOOK_SECRET"]],
  ["subscription-payments", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]],
];
for (const [id, names] of productionEnv) {
  const missing = names.filter((name) => !process.env[name]);
  add(id, missing.length === 0, "external", missing.length ? `Mangler ${missing.join(", ")}` : "konfigureret");
}

const codeFailed = checks.some((check) => check.category === "code" && !check.ok);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), readyForTechnicalRelease: !codeFailed, readyForRegisteredOperation: checks.every((check) => check.ok), checks }, null, 2));
if (codeFailed) process.exitCode = 1;

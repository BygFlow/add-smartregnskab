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
  "docs/RELEASE-3.15.4-DRIFTSBEVIS.md",
];
for (const file of requiredFiles) add(`file:${file}`, existsSync(file), "code", existsSync(file) ? "findes" : "mangler");

// ADD Connect must name the separate Clean product to connect it. That is not
// SmartRegnskab branding, so exclude only the integration catalogue itself.
const grep = spawnSync("git", ["grep", "-In", "SmartDrift Clean", "--", ".", ":(exclude)migrations/meta/*", ":(exclude)scripts/release-readiness.mjs", ":(exclude)server/add-connect.ts"], { encoding: "utf8" });
const trackedText = grep.status === 1 ? "" : String(grep.stdout || grep.stderr || "");
add("brand-separation", trackedText.trim() === "", "code", trackedText.trim() || "Clean nævnes kun som et separat produkt i ADD Connect-kataloget.");
const connectCatalogue = existsSync("server/add-connect.ts") ? readFileSync("server/add-connect.ts", "utf8") : "";
add("cross-product-integration", connectCatalogue.includes('id: "smartdrift_clean"'), "code", "Clean er registreret som separat produkt i ADD Connect.");

const sproom = String(process.env.EINVOICE_PROVIDER || "").toLowerCase() === "sproom";
const productionEnv = [
  ["external-backup", ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]],
  ["einvoice-access-point", sproom ? ["SPROOM_API_TOKEN", "SPROOM_COMPANY_MAP"] : ["EINVOICE_PROVIDER_URL", "EINVOICE_PROVIDER_API_KEY"]],
  ["einvoice-validator", ["EINVOICE_VALIDATOR_URL"]],
  ["einvoice-inbound", sproom ? ["SPROOM_WEBHOOK_PUBLIC_KEY_BASE64"] : ["EINVOICE_WEBHOOK_SECRET"]],
  ["subscription-payments", ["QUICKPAY_API_KEY", "QUICKPAY_PRIVATE_KEY"]],
  ["automatic-bankdata", ["AIIA_CLIENT_ID", "AIIA_CLIENT_SECRET"]],
];
for (const [id, names] of productionEnv) {
  const missing = names.filter((name) => !process.env[name]);
  add(id, missing.length === 0, "external", missing.length ? `Ikke konfigureret i dette kørselsmiljø: ${missing.join(", ")}` : "Konfiguration til stede; adgang og godkendelse er ikke verificeret af dette tjek.");
}

// Credentials and files cannot prove legal authorization or an end-to-end
// production test. These gates require separate evidence and owner sign-off.
for (const [id, detail] of [
  ["provider-approvals", "Sproom, Mastercard/AiiA og Clearhaus/QuickPay: aftaler, produktionsadgang og ende-til-ende-test skal dokumenteres."],
  ["external-restore", "En krypteret ekstern backup skal gendannes og verificeres i et isoleret miljø."],
  ["legal-registration", "Juridisk gennemgang og relevant registreringsbekræftelse skal dokumenteres."],
  ["independent-security", "Uvildig sikkerhedstest og håndtering af fund skal dokumenteres."],
  ["pilot-signoff", "Pilotens kritiske regnskabsflows og kundens sign-off skal dokumenteres."],
]) add(id, false, "manual", `Kræver særskilt verificering og ejerens godkendelse. ${detail}`);

const codeFailed = checks.some((check) => check.category === "code" && !check.ok);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), readyForTechnicalRelease: !codeFailed, readyForRegisteredOperation: checks.every((check) => check.ok), checks }, null, 2));
if (codeFailed) process.exitCode = 1;

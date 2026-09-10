import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const version = "3.6.0";
const destination = join("artifacts", `myndighedspakke-${version}`);
const files = [
  "docs/REGISTRERINGS-CHECKLISTE.md", "docs/REGISTRERING-ERHVERVSSTYRELSEN.md", "docs/MYNDIGHEDSBILAG.md",
  "docs/DRIFT-OG-BACKUP.md", "docs/NEMHANDEL-DRIFT.md", "docs/GDPR-OG-DATABEHANDLING.md",
  "docs/SIKKERHED-OG-HÆNDELSESBEREDSKAB.md", "docs/SIKKERHEDSREVIEW-3.6.0.md", "docs/UNDERDATABEHANDLERE.md",
  "docs/AI-GOVERNANCE.md", "docs/SLETNING-OG-EXIT.md", "docs/PILOT-OG-ACCEPTTEST.md",
  "docs/ONBOARDING-OG-OPSÆTNING.md", "docs/SUPPORTCENTER.md", "docs/INTEGRATIONSADAPTERE.md",
  "docs/LOVSTATUS-2026-09-10.md",
];
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
const manifest = files.map((file) => {
  const body = readFileSync(file);
  const target = join(destination, file.replace("docs/", ""));
  cpSync(file, target);
  return { file: target.replace(/\\/g, "/"), bytes: body.length, sha256: createHash("sha256").update(body).digest("hex") };
});
writeFileSync(join(destination, "MANIFEST.json"), JSON.stringify({ product: "ADD SmartRegnskab", provider: "ADD SmartDrift ApS", cvr: "46761898", address: "Lynæs Søpark 49, 3390 Hundested", version, generatedAt: new Date().toISOString(), files: manifest }, null, 2));
console.log(destination);

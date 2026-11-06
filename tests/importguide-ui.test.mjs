import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("Importguide exposes the real validated migration flow", () => {
  const root = process.cwd();
  const importguide = readFileSync(
    join(root, "client", "src", "pages", "regnskab-tabs", "importguide.tsx"),
    "utf8",
  );
  const wizard = readFileSync(
    join(root, "client", "src", "pages", "regnskab-tabs", "migration-wizard.tsx"),
    "utf8",
  );

  assert.match(importguide, /<MigrationWizard companyId=\{companyId\}/);
  assert.match(importguide, /Afdelinger og SE-enheder under selskabet/);
  assert.doesNotMatch(importguide, /\/api\/import-jobs2/);

  assert.match(wizard, /type="file"/);
  assert.match(wizard, /Validér og forhåndsvis/);
  assert.match(wizard, /Godkend og importér/);
  assert.match(wizard, /<EconomicReadonlyImport companyId=\{companyId\}/);
});

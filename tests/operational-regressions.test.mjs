import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("S3-compatible file storage honors the configured endpoint", () => {
  const files = read("server/files.ts");
  assert.match(files, /S3_ENDPOINT/);
  assert.match(files, /S3_FORCE_PATH_STYLE/);
  assert.match(files, /new URL\(config\.endpoint\)/);
  assert.match(files, /endpoint\.protocol/);
});

test("PWA updates do not pin authenticated users to an old shell", () => {
  const sw = read("public/sw.js");
  const main = read("client/src/main.tsx");
  assert.match(sw, /smartregnskab-v3\.15\.4/);
  assert.match(sw, /event\.request\.mode === "navigate"/);
  assert.match(sw, /cache: "no-store"/);
  assert.match(main, /updateViaCache: "none"/);
});

test("API documentation links to real key management instead of a sandbox mock", () => {
  const page = read("client/src/pages/regnskab-tabs/api-webhooks.tsx");
  assert.match(page, /smartregnskab\/app\/api_keys_mgmt/);
  assert.match(page, /open-api-key-management-btn/);
  assert.doesNotMatch(page, /ikke aktiveret i denne sandbox|dialog \(mock\)/);
});

test("SAF-T export reports the deployed application version", () => {
  const saft = read("server/saft.ts");
  assert.match(saft, /process\.env\.APP_VERSION \|\| "3\.15\.4"/);
  assert.match(saft, /<SoftwareVersion>\$\{SOFTWARE_VERSION\}<\/SoftwareVersion>/);
  assert.doesNotMatch(saft, /<SoftwareVersion>3\.5\.1<\/SoftwareVersion>/);
});

test("customer backup screen exposes status instead of simulated production actions", () => {
  const page = read("client/src/pages/regnskab-tabs/backup-regnskab.tsx");
  assert.match(page, /backup-protection\/status/);
  assert.doesNotMatch(page, /restore-dry-run|\/api\/backups|openAuthedFile/);
});

test("client avoids known privacy and accessibility regressions", () => {
  const nativeBridge = read("client/src/lib/native-bridge.ts");
  const html = read("client/index.html");
  assert.doesNotMatch(nativeBridge, /console\.log\(['"]Push token:/);
  assert.doesNotMatch(html, /maximum-scale/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|api\.fontshare\.com/);
});

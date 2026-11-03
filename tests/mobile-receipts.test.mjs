import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile receipt route uses the existing tenant-isolated document flow", () => {
  const app = read("client/src/App.tsx");
  const mobile = read("client/src/pages/mobile-receipts.tsx");
  assert.match(app, /MobileReceipts/);
  assert.match(app, /location === "\/mobil-bilag"/);
  assert.match(mobile, /\/api\/organization/);
  assert.match(mobile, /\/api\/professional\/switch-company|switchCompany/);
  assert.match(mobile, /\/api\/document-receiving\/upload/);
  assert.match(mobile, /\/api\/document-receiving\/\$\{id\}\/approve/);
  assert.match(mobile, /Maks\. 7 MB/);
});

test("receipt capture stays private and accounting always requires human approval", () => {
  const bridge = read("client/src/lib/native-bridge.ts");
  const intake = read("server/document-intake.ts");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(bridge, /saveToGallery: false/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /ACCESS_(FINE|COARSE)_LOCATION/);
  assert.match(intake, /manualApprovalRequired: true/);
  assert.match(intake, /AI-autobogføring er deaktiveret/);
  assert.doesNotMatch(intake, /actor: "AI \(kundens tilvalg\)"/);
});

test("Capacitor's allow-listed production API supports credentialed CORS", () => {
  const server = read("server/index.ts");
  const config = read("capacitor.config.ts");
  assert.match(server, /allowedOrigins\.add\("capacitor:\/\/localhost"\)/);
  assert.match(server, /allowedOrigins\.add\("https:\/\/localhost"\)/);
  assert.match(server, /Access-Control-Allow-Credentials", "true"/);
  assert.match(config, /iosScheme: 'capacitor'/);
  assert.match(config, /androidScheme: 'https'/);
  assert.match(read("client/src/lib/queryClient.ts"), /Capacitor\.isNativePlatform\(\) \? "https:\/\/app\.addsmartregnskab\.dk"/);
  assert.match(read(".env.example"), /capacitor:\/\/localhost/);
  assert.match(read(".env.example"), /https:\/\/localhost/);
});

test("the native accounting shell respects iPhone and Android safe areas", () => {
  const html = read("client/index.html");
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const config = read("capacitor.config.ts");
  assert.match(html, /viewport-fit=cover/);
  assert.match(shell, /env\(safe-area-inset-top\)/);
  assert.match(shell, /env\(safe-area-inset-bottom\)/);
  assert.match(shell, /min-h-\[100dvh\]/);
  assert.match(config, /contentInset: 'never'/);
  assert.doesNotMatch(config, /backgroundColor: '#ffffff'/);
});

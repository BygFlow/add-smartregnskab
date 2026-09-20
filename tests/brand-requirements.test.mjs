import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartRegnskab implements its product-family brand requirements", () => {
  const brand = read("client/src/components/smartregnskab-brand.tsx");
  const login = read("client/src/pages/regnskab-login.tsx");
  const theme = read("client/src/index.css");
  const favicon = read("public/favicon.svg");
  const androidIcon = read("android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml");
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const serverEntry = read("server/index.ts");
  const marketing = read("client/src/pages/marketing.tsx");
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");

  assert.match(brand, /ADD SmartRegnskab/);
  assert.match(brand, /TIL DIN VIRKSOMHED/);
  assert.match(brand, /Mere tid til det, der skaber værdi/);
  assert.match(brand, /En del af ADD SmartDrift ApS/);
  assert.doesNotMatch(brand, /Overblik der skaber vækst/);
  assert.match(login, /login-brand-regnskab/);
  assert.match(theme, /--primary: 158 48% 28%/);
  assert.doesNotMatch(theme, /\.login-brand\s*\{[^}]*display:\s*flex/s);
  assert.match(favicon, /#9CDD3F/);
  assert.match(androidIcon, /#9CDD3F/);
  assert.match(login, /platform@addsmartregnskab\.dk/);
  assert.doesNotMatch(shell, /rengøringsservice|rengøringsaftaler|rengøringsplaner|vagtplan|geofence/i);
  assert.doesNotMatch(serverEntry, /seedDatabase|ALLOW_DEMO_SEED/);
  assert.match(serverEntry, /https:\/\/www\.googletagmanager\.com/);
  assert.match(marketing, /Hjælpecenter/);
  assert.match(marketing, /Bilag og udgifter/);
  assert.match(marketing, /AI hjælper\. Du godkender\./);
  assert.match(marketing, /Kun nødvendige/);
  assert.match(marketing, /regnskabsprogram-smaa-virksomheder/);
  assert.match(marketing, /Guides og checklister/);
  assert.match(marketing, /VITE_GA_MEASUREMENT_ID/);
  assert.doesNotMatch(marketing, /Simply\.com mail|S3-kompatibel backup/);
  assert.match(sitemap, /regnskab-haandvaerkere/);
  assert.match(sitemap, /guide\/professionelle-fakturaer/);
  assert.match(robots, /Disallow: \/api\//);
});

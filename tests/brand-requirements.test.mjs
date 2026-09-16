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
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartRegnskab implements its product-family brand requirements", () => {
  const brand = read("client/src/components/smartregnskab-brand.tsx");
  const login = read("client/src/pages/regnskab-login.tsx");
  const theme = read("client/src/index.css");

  assert.match(brand, /ADD SmartRegnskab/);
  assert.match(brand, /Overblik der skaber vækst\./);
  assert.match(brand, /Mere tid til det, der skaber værdi\./);
  assert.match(brand, /En del af ADD SmartDrift ApS/);
  assert.match(login, /login-brand-regnskab/);
  assert.match(theme, /--primary: 158 48% 28%/);
  assert.doesNotMatch(theme, /\.login-brand\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(login, /ADD SmartDrift Clean|ADD SmartDrift Pro/);
});

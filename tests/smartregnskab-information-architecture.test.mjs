import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartRegnskab exposes core settings without hiding them among advanced modules", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const router = read("client/src/pages/regnskabssystem.tsx");
  const settings = read("client/src/pages/regnskab-tabs/indstillinger.tsx");

  assert.match(shell, /label: "Indstillinger"/);
  assert.match(shell, /Virksomhedsoplysninger/);
  assert.match(shell, /Regnskab & moms/);
  assert.match(shell, /Fakturaindstillinger/);
  assert.match(shell, /Backup & data/);
  assert.match(shell, /Avancerede moduler/);
  assert.match(shell, /Fakturering og betaling/);
  assert.match(shell, /Regnskab og afslutning/);
  assert.match(shell, /Integration og data/);
  assert.match(router, /value="virksomhedsindstillinger"/);
  assert.match(router, /value="faktura_indstillinger"/);
  assert.match(settings, /Opsæt virksomheden ét sted/);
});

test("company and invoice settings persist through the tenant-scoped company endpoint", () => {
  const company = read("client/src/pages/regnskab-tabs/virksomhedsindstillinger.tsx");
  const invoice = read("client/src/pages/regnskab-tabs/faktura-indstillinger.tsx");

  assert.match(company, /PATCH", "\/api\/company"/);
  assert.match(company, /CVR-nummeret skal bestå af 8 cifre/);
  assert.match(invoice, /PATCH", "\/api\/company"/);
  assert.match(invoice, /invoiceNextNumber/);
  assert.match(invoice, /Standard betalingsfrist/);
  assert.match(invoice, /Allerede udstedte fakturanumre ændres ikke/);
});

test("optional products are collected in Appmarked instead of normal accounting navigation", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const marketplace = read("client/src/pages/regnskab-tabs/appmarked.tsx");

  assert.match(marketplace, /Tilkøb og tillægsmoduler/);
  assert.match(marketplace, /Kundeportal/);
  assert.match(marketplace, /Lagerregnskab/);
  assert.match(marketplace, /Revisorportal/);
  assert.match(marketplace, /API og webhooks/);
  assert.doesNotMatch(shell, /item\("kunde_portal_indstillinger"/);
  assert.doesNotMatch(shell, /item\("lagerregnskab"/);
  assert.doesNotMatch(shell, /item\("revisorportal"/);
  assert.doesNotMatch(shell, /item\("api_webhooks"/);
});

test("regnskabsopsætning uses precise guidance instead of a generic beta blocker", () => {
  const profile = read("client/src/pages/regnskab-tabs/branche-profil.tsx");
  assert.match(profile, /Regnskab og moms/);
  assert.match(profile, /Regnskabsår og moms påvirker indberetning/);
  assert.doesNotMatch(profile, /BETA — Ændringer i branche-profilen kræver revisor-godkendelse/);
});

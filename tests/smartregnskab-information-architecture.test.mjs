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
  assert.match(shell, /E-fakturering/);
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
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const page = read("client/src/pages/regnskabssystem.tsx");

  assert.match(marketplace, /Tilkøb og tillægsmoduler/);
  assert.match(catalog, /Kundeportal/);
  assert.match(catalog, /Lagerregnskab/);
  assert.match(catalog, /Revisorportal/);
  assert.match(catalog, /API og webhooks/);
  assert.doesNotMatch(shell, /item\("kunde_portal_indstillinger"/);
  assert.doesNotMatch(shell, /item\("lagerregnskab"/);
  assert.doesNotMatch(shell, /item\("revisorportal"/);
  assert.doesNotMatch(shell, /item\("api_webhooks"/);
  assert.doesNotMatch(shell, /item\("bank_payments"/);
  assert.doesNotMatch(shell, /item\("budget_scenarier"/);
  assert.match(page, /getSmartRegnskabAddonForRoute\(activeTab\)/);
  assert.match(page, /notice-addon-locked/);
  assert.match(page, /\["lagerregnskab", "Lagerregnskab"\]/);
  assert.match(page, /\["kundeportal", "Kundeportal"\]/);
});

test("regnskabsopsætning uses precise guidance instead of a generic beta blocker", () => {
  const profile = read("client/src/pages/regnskab-tabs/branche-profil.tsx");
  assert.match(profile, /Regnskab og moms/);
  assert.match(profile, /Regnskabsår og moms påvirker indberetning/);
  assert.doesNotMatch(profile, /BETA — Ændringer i branche-profilen kræver revisor-godkendelse/);
});

test("core VAT and paid international VAT rules are separated consistently", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const router = read("client/src/pages/regnskabssystem.tsx");
  const coreVat = read("client/src/pages/regnskab-tabs/valuta-moms.tsx");
  const internationalVat = read("client/src/pages/regnskab-tabs/avanceret-moms.tsx");
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const routes = read("server/extended-routes-2.ts");

  assert.match(router, /EU, import og valuta/);
  assert.match(router, /EU-moms, reverse charge, importmoms/);
  assert.doesNotMatch(shell, /item\("momsafstemning"/);
  assert.doesNotMatch(shell, /item\("skattekonto"/);
  assert.doesNotMatch(shell, /item\("valuta_moms"/);
  assert.match(router, /Åbn momsafstemning/);
  assert.match(router, /Åbn skattekonto/);
  assert.match(coreVat, /const VAT_TYPES = \["eu_moms", "reverse_charge", "import_moms"\]/);
  assert.doesNotMatch(coreVat, /const VAT_TYPES = \[[^\]]*"oss"/);
  assert.match(internationalVat, /const VAT_TYPES = \["oss", "intrastat", "delvist_fradrag", "momsregistrering_udland"\]/);
  assert.match(catalog, /name: "International moms og specialregler"/);
  assert.match(catalog, /protectedRoutes: \["avanceret_moms"\]/);
  assert.doesNotMatch(catalog, /protectedRoutes: \["avanceret_moms", "valuta_moms"\]/);
  assert.match(routes, /requireFeature\("avanceret_moms"\)/);
});

test("period close is the single navigation hub for year-end work", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const router = read("client/src/pages/regnskabssystem.tsx");

  assert.match(shell, /item\("periode", "Periode & årsafslutning"/);
  assert.doesNotMatch(shell, /item\("aarafslutning"/);
  assert.doesNotMatch(shell, /item\("arsrapport"/);
  assert.doesNotMatch(shell, /item\("periodisering"/);
  assert.doesNotMatch(shell, /item\("afstemningscenter"/);
  assert.match(router, /Åbn periodisering/);
  assert.match(router, /Åbn afstemningscenter/);
  assert.match(router, /Åbn årsafslutning/);
  assert.match(router, /Åbn årsrapport/);
  assert.match(router, /\/smartregnskab\/app\/aarafslutning/);
  assert.match(router, /\/smartregnskab\/app\/arsrapport/);
});

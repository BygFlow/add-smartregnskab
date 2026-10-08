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
  assert.match(catalog, /name: "Årsrapport"/);
  assert.match(catalog, /feature: "aarsrapport"/);
  assert.match(catalog, /protectedRoutes: \["arsrapport"\]/);
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
  assert.doesNotMatch(router, /Åbn årsrapport/);
  assert.match(router, /\/smartregnskab\/app\/aarafslutning/);
});

test("annual report add-on is enforced by both client and API", () => {
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const routes = read("server/extended-routes.ts");

  assert.match(catalog, /route: "arsrapport", protectedRoutes: \["arsrapport"\]/);
  assert.match(routes, /app\.get\("\/api\/annual-reports", requireFeature\("aarsrapport"\)/);
  assert.match(routes, /app\.post\("\/api\/annual-reports", requireFeature\("aarsrapport"\)/);
  assert.match(routes, /app\.patch\("\/api\/annual-reports\/:id", requireFeature\("aarsrapport"\)/);
});

test("core payroll expense posting stays separate from the payroll add-on", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const router = read("client/src/pages/regnskabssystem.tsx");
  const routes = read("server/routes.ts");
  const extendedRoutes = read("server/extended-routes.ts");
  const extendedRoutes2 = read("server/extended-routes-2.ts");

  assert.match(shell, /item\("lon", "Lønudgifter"/);
  assert.match(catalog, /name: "Løn og lønindberetning"/);
  assert.match(catalog, /feature: "loen"/);
  assert.match(catalog, /Almindelig bogføring af lønudgifter er altid inkluderet/);
  assert.match(catalog, /protectedRoutes: \["lonindberetning", "lonmotor_regnskab"\]/);
  assert.match(router, /SmartRegnskab beregner ikke løn i grundpakken/);
  assert.match(router, /Registrer godkendt løngrundlag/);
  assert.doesNotMatch(router, /Auto-generer løn/);
  assert.doesNotMatch(routes, /app\.get\("\/api\/payroll-entries", requireFeature\("loen"\)/);
  assert.match(routes, /app\.post\("\/api\/payroll-entries", requireRole\("leder", "platform_admin"\)/);
  assert.match(routes, /app\.post\("\/api\/payroll-entries\/:id\/post", requireRole\("leder", "platform_admin"\)/);
  assert.match(routes, /sourceType: "løn"/);
  assert.match(routes, /debit: amount, credit: 0/);
  assert.match(routes, /debit: 0, credit: amount/);
  assert.match(routes, /app\.post\("\/api\/payroll-entries\/auto-generate", requireFeature\("loen"\)/);
  assert.match(extendedRoutes, /app\.get\("\/api\/payroll-reports", requireFeature\("loen"\)/);
  assert.match(extendedRoutes, /app\.post\("\/api\/payroll-reports", requireFeature\("loen"\)/);
  assert.match(extendedRoutes, /app\.patch\("\/api\/payroll-reports\/:id", requireFeature\("loen"\)/);
  assert.match(extendedRoutes2, /\/api\/payroll-calculations[\s\S]*requireFeature\("loen"\)/);
  assert.match(extendedRoutes2, /\/api\/payroll-engine[\s\S]*requireFeature\("loen"\)/);
});

test("manual payment bookkeeping stays core while payment runs are enforced as an add-on", () => {
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const routes = read("server/routes.ts");
  const extendedRoutes2 = read("server/extended-routes-2.ts");

  assert.match(catalog, /name: "Betalingskørsler"/);
  assert.match(catalog, /feature: "betalinger"/);
  assert.match(catalog, /Manuel betalingsregistrering og bankafstemning er fortsat en del af grundregnskabet/);
  assert.match(catalog, /protectedRoutes: \["betaling", "bank_payments"\]/);
  assert.match(routes, /app\.get\("\/api\/payment-runs", requireFeature\("betalinger"\)/);
  assert.match(routes, /app\.post\("\/api\/payment-runs", requireFeature\("betalinger"\), requireRole\("leder", "platform_admin"\)/);
  assert.match(routes, /app\.patch\("\/api\/payment-runs\/:id", requireFeature\("betalinger"\), requireRole\("leder", "platform_admin"\)/);
  assert.match(routes, /app\.delete\("\/api\/payment-runs\/:id", requireFeature\("betalinger"\), requireRole\("leder", "platform_admin"\)/);
  assert.match(extendedRoutes2, /\/api\/bank-payments[\s\S]*requireFeature\("betalinger"\)/);
});

test("the product catalog stays core while inventory accounting is an enforced add-on", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const routes = read("server/extended-routes.ts");

  assert.match(shell, /item\("produktkartotek", "Produkter & ydelser"/);
  assert.doesNotMatch(shell, /item\("lagerregnskab"/);
  assert.match(catalog, /name: "Lagerregnskab"/);
  assert.match(catalog, /feature: "lagerregnskab"/);
  assert.match(catalog, /Det almindelige produktkartotek med varer, ydelser og fakturapriser er altid inkluderet/);
  assert.match(catalog, /protectedRoutes: \["lagerregnskab"\]/);
  assert.match(routes, /app\.get\("\/api\/inventory-accounts", requireFeature\("lagerregnskab"\)/);
  assert.match(routes, /app\.post\("\/api\/inventory-accounts", requireFeature\("lagerregnskab"\), requireRole\("leder", "platform_admin"\)/);
  assert.match(routes, /app\.patch\("\/api\/inventory-accounts\/:id", requireFeature\("lagerregnskab"\), requireRole\("leder", "platform_admin"\)/);
  assert.match(routes, /app\.delete\("\/api\/inventory-accounts\/:id", requireFeature\("lagerregnskab"\), requireRole\("leder", "platform_admin"\)/);
});

test("the audit trail stays core while the auditor collaboration portal is an enforced add-on", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const routes = read("server/extended-routes.ts");
  const extendedRoutes2 = read("server/extended-routes-2.ts");
  const auth = read("server/auth.ts");
  const auditorPortal = read("client/src/pages/regnskab-tabs/revisorportal.tsx");
  const professionalRoutes = read("server/professional-routes.ts");
  const publicPages = read("client/src/pages/offentlig.tsx");

  assert.match(shell, /item\("revision", "Revisionsspor"/);
  assert.doesNotMatch(shell, /item\("revisorportal"/);
  assert.match(catalog, /name: "Revisorportal"/);
  assert.match(catalog, /feature: "revision"/);
  assert.match(catalog, /Revisionsspor, SAF-T og almindelig regnskabseksport er fortsat inkluderet/);
  assert.match(catalog, /protectedRoutes: \["revisorportal", "revisionspakke"\]/);
  assert.match(routes, /const tenantId = authTenantId/);
  assert.doesNotMatch(routes, /req\.query\.companyId \|\| 1/);
  assert.match(routes, /app\.get\("\/api\/auditor-portal", requireFeature\("revision"\), requireRole\("leder", "bogholder", "revisor", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /app\.post\("\/api\/auditor-portal", requireFeature\("revision"\), requireRole\("leder", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /app\.patch\("\/api\/auditor-portal\/:id", requireFeature\("revision"\), requireRole\("leder", "revisor", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /app\.delete\("\/api\/auditor-portal\/:id", requireFeature\("revision"\), requireRole\("leder", "revisor_admin", "platform_admin"\)/);
  assert.match(extendedRoutes2, /app\.get\("\/api\/audit-package", requireFeature\("revision"\)/);
  assert.match(extendedRoutes2, /app\.post\("\/api\/audit-package", requireFeature\("revision"\), requireRole\("leder", "revisor_admin", "platform_admin"\)/);
  assert.match(extendedRoutes2, /app\.patch\("\/api\/audit-package\/:id", requireFeature\("revision"\), requireRole\("leder", "revisor", "revisor_admin", "platform_admin"\)/);
  assert.match(extendedRoutes2, /app\.delete\("\/api\/audit-package\/:id", requireFeature\("revision"\), requireRole\("leder", "revisor_admin", "platform_admin"\)/);
  assert.match(auth, /!req\.path\.startsWith\("\/audit-package"\)/);

  assert.match(auditorPortal, /Revisoren skal logge ind med sin egen konto/);
  assert.match(auditorPortal, /fuld læseadgang til regnskabsmaterialet/);
  assert.match(auditorPortal, /Tofaktorgodkendelse er obligatorisk/);
  assert.match(auditorPortal, /href="#\/smartregnskab\/app\/fagportal"/);
  assert.match(auditorPortal, /canManageAccess && <CreateDialog/);
  assert.match(professionalRoutes, /app\.post\("\/api\/professional\/invite"/);
  assert.match(professionalRoutes, /requiresTwoFactor: 1/);
  assert.match(professionalRoutes, /Opret din adgang her/);
  assert.match(publicPages, /export function Invitation\(\)/);
  assert.match(publicPages, /Din konto er oprettet\. Log ind nu\./);
});

test("company administration stays core while group consolidation is an enforced add-on", () => {
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const page = read("client/src/pages/regnskab-tabs/konsolidering.tsx");
  const routes = read("server/extended-routes-2.ts");

  assert.match(shell, /item\("selskabsstruktur", "Selskaber & SE-enheder"/);
  assert.doesNotMatch(shell, /item\("konsolidering"/);
  assert.match(catalog, /name: "Koncern"/);
  assert.match(catalog, /feature: "konsolidering"/);
  assert.match(catalog, /Almindelig administration af selskaber, afdelinger og SE-enheder er fortsat inkluderet/);
  assert.match(catalog, /protectedRoutes: \["konsolidering"\]/);
  assert.match(routes, /app\.get\("\/api\/consolidation", requireFeature\("konsolidering"\), requireRole\("leder", "bogholder", "revisor", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /app\.post\("\/api\/consolidation", requireFeature\("konsolidering"\), requireRole\("leder", "bogholder", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /app\.patch\("\/api\/consolidation\/:id", requireFeature\("konsolidering"\), requireRole\("leder", "bogholder", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /app\.delete\("\/api\/consolidation\/:id", requireFeature\("konsolidering"\), requireRole\("leder", "bogholder", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /activeCompany\.subscriptionOwnerId \|\| activeCompany\.id/);
  assert.match(routes, /Konsolidering kræver mindst to juridiske virksomheder/);
  assert.match(routes, /En bogført konsolideringspost er låst/);
  assert.match(routes, /En bogført konsolideringspost kan ikke slettes/);
  assert.match(page, /Afdelinger og SE-enheder tæller ikke som selvstændige juridiske virksomheder/);
  assert.match(page, /disabled=\{entry\.status === "bogført"\}/);
});

test("external accounting API is tenant-bound, scoped, idempotent and books only final invoices", () => {
  const catalog = read("client/src/lib/smartregnskab-addons.ts");
  const routes = read("server/routes.ts");
  const api = read("server/external-accounting-api.ts");
  const docs = read("client/src/pages/regnskab-tabs/api-webhooks.tsx");
  const keyRoutes = read("server/extended-routes-2.ts");

  assert.match(catalog, /protectedRoutes: \["api_webhooks", "api_keys_mgmt"\]/);
  assert.ok(routes.indexOf("registerExternalAccountingApi(app)") < routes.indexOf('app.use("/api", requireAuth)'));
  assert.match(api, /createHash\("sha256"\)\.update\(rawKey\)/);
  assert.match(api, /requireScope\("read"\)/);
  assert.match(api, /requireScope\("write"\)/);
  assert.match(api, /Idempotency-Key-headeren er påkrævet/);
  assert.match(api, /documentType === "invoice"/);
  assert.match(api, /journalEntryId/);
  assert.match(api, /deliverWebhook\(cid, "invoice\.created"/);
  assert.match(keyRoutes, /app\.post\("\/api\/api-keys\/generate", requireFeature\("api_integration"\)/);
  assert.match(keyRoutes, /status: "tilbagekaldt"/);
  assert.match(docs, /POST \/api\/external\/v1\/invoices/);
  assert.match(docs, /Idempotency-Key/);
  assert.doesNotMatch(docs, /api\.smartregnskab\.dk/);
});

test("customer portal exposes only the signed-in customer's private files and invoices", () => {
  const app = read("client/src/App.tsx");
  const portal = read("client/src/pages/customer-portal.tsx");
  const manager = read("client/src/pages/regnskab-tabs/portal-dokumenter.tsx");
  const routes = read("server/extended-routes-3.ts");
  const schema = read("shared/schema.ts");
  const storage = read("server/storage.ts");

  assert.match(app, /user\.role === "kunde"/);
  assert.match(app, /<CustomerPortal/);
  assert.match(portal, /Privat kundeportal/);
  assert.match(portal, /\/api\/portal-documents\/\$\{document\.id\}\/file/);
  assert.match(manager, /\/api\/file-objects/);
  assert.match(manager, /fileObjectId/);
  assert.match(routes, /row\.customerId === req\.auth\?\.user\?\.customerId/);
  assert.match(routes, /document\.customerId !== req\.auth\?\.user\?\.customerId/);
  assert.match(routes, /createHash\("sha256"\)\.update\(bytes\)/);
  assert.match(routes, /requireFeature\("kundeportal"\)/);
  assert.match(schema, /fileObjectId: integer\("file_object_id"\)/);
  assert.match(storage, /addColumn\("portal_documents", "file_object_id"/);
});

test("workflow builder validates definitions and only performs safe test runs", () => {
  const routes = read("server/extended-routes-3.ts");
  const page = read("client/src/pages/regnskab-tabs/workflow-builder.tsx");

  assert.match(routes, /workflowStepTypes = new Set/);
  assert.match(routes, /app\.post\("\/api\/workflow-definitions", requireFeature\("workflow_builder"\)/);
  assert.match(routes, /app\.get\("\/api\/workflow-runs", requireFeature\("workflow_builder"\)/);
  assert.doesNotMatch(routes, /app\.post\("\/api\/workflow-runs"/);
  assert.match(routes, /Ingen fakturaer, betalinger eller bogføringer blev udført/);
  assert.match(page, /Testkørsler udfører aldrig fakturaer, betalinger eller bogføringer/);
});

test("international VAT is server-calculated and non-draft rows are locked", () => {
  const routes = read("server/extended-routes-2.ts");
  const page = read("client/src/pages/regnskab-tabs/avanceret-moms.tsx");

  assert.match(routes, /advancedVatTypes = new Set\(\["oss", "intrastat", "delvist_fradrag", "momsregistrering_udland"\]\)/);
  assert.match(routes, /const vatAmount = Math\.round/);
  assert.match(routes, /status: "kladde"/);
  assert.match(routes, /existing\.status !== "kladde"/);
  assert.match(page, /Beløb beregnes og valideres igen på serveren/);
  assert.match(page, /disabled=\{entry\.status !== "kladde"\}/);
});

test("migration is a guarded preview-commit service with signed preview and rollback", () => {
  const routes = read("server/migration-routes.ts");
  const jobs = read("server/extended-routes-2.ts");
  const catalog = read("client/src/lib/smartregnskab-addons.ts");

  assert.match(catalog, /name: "Datamigrering og onboarding", category: "Engangsydelse"/);
  assert.match(routes, /\/api\/migration\/preview", requireFeature\("dedikeret_onboarding"\)/);
  assert.match(routes, /\/api\/migration\/commit", requireFeature\("dedikeret_onboarding"\)/);
  assert.match(routes, /tokenFor\(cid, value\.source, value\.entity, value\.content\)/);
  assert.match(routes, /createdIds/);
  assert.match(routes, /\/rollback", requireFeature\("dedikeret_onboarding"\)/);
  assert.match(jobs, /app\.get\("\/api\/migration-jobs", requireFeature\("dedikeret_onboarding"\)/);
  assert.doesNotMatch(jobs, /app\.post\("\/api\/migration-jobs"/);
});

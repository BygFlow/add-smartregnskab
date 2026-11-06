import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ordinary companies and groups share one safe organization model", () => {
  const schema = read("shared/schema.ts");
  const routes = read("server/organization-routes.ts");
  const domain = read("server/domain.ts");
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const page = read("client/src/pages/regnskab-tabs/selskabsstruktur.tsx");
  const migration = read("migrations/0009_flawless_darkstar.sql");

  assert.match(schema, /subscriptionOwnerId/);
  assert.match(schema, /companyAccessMemberships/);
  assert.match(schema, /companyUnits/);
  assert.match(routes, /Pakken tillader.*virksomhed/);
  assert.match(routes, /storage\.getCompany\(tenantId\(req\)\)/);
  assert.match(routes, /app\.get\("\/api\/organization", requireRole\("leder", "holdleder", "bogholder", "revisor", "revisor_admin", "platform_admin"\)/);
  assert.match(routes, /Abonnementsejeren er en faktureringsrolle, ikke nødvendigvis det juridiske/);
  assert.match(routes, /wouldCreateCompanyCycle\(companies, id, parentCompanyId\)/);
  assert.doesNotMatch(routes, /parentCompanyId: id === ownerId \? null : parentCompanyId/);
  assert.match(routes, /req\.body\?\.parentCompanyId === null/);
  assert.match(routes, /parentCompanyId != null && !parent/);
  assert.match(routes, /ownershipPercent: parentCompanyId == null \? null : ownershipPercent/);
  assert.match(routes, /SE-nummeret er allerede registreret/);
  assert.match(routes, /digits8\(existingCompany\.cvr\) !== digits8\(company\.cvr\)/);
  assert.match(routes, /genknyt_se_enhed/);
  assert.match(routes, /db\.update\(companyUnits\)/);
  assert.match(domain, /organizationPostingUsage/);
  assert.match(domain, /organizationCompanies\.map/);
  assert.match(shell, /Selskaber & SE-enheder/);
  assert.match(page, /Ét ApS eller A\/S er ét juridisk regnskab/);
  assert.match(page, /Afdelinger og SE-numre hører under det valgte CVR/);
  assert.match(page, /Bogføres og indberettes i det juridiske regnskab for/);
  assert.match(page, /Gå til regnskab/);
  assert.match(page, /Åbn hovedregnskab/);
  assert.match(page, /Ingen intern ejerrelation/);
  assert.match(page, /parentCompanyId: companyForm\.parentCompanyId === "none" \? null/);
  assert.match(migration, /CREATE TABLE `company_access_memberships`/);
  assert.match(migration, /CREATE TABLE `company_units`/);
});

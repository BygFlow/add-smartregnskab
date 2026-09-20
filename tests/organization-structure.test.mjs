import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ordinary companies and groups share one safe organization model", () => {
  const schema = read("shared/schema.ts");
  const routes = read("server/organization-routes.ts");
  const auth = read("server/auth.ts");
  const shell = read("client/src/pages/regnskabs-shell.tsx");
  const page = read("client/src/pages/regnskab-tabs/selskabsstruktur.tsx");
  const migration = read("migrations/0009_flawless_darkstar.sql");

  assert.match(schema, /subscriptionOwnerId/);
  assert.match(schema, /companyAccessMemberships/);
  assert.match(schema, /companyUnits/);
  assert.match(routes, /Pakken tillader.*virksomhed/);
  assert.match(routes, /SE-nummeret er allerede registreret/);
  assert.match(auth, /organizationCompanyIds/);
  assert.match(auth, /Promise\.all\(organizationCompanyIds/);
  assert.match(shell, /Selskaber & SE-enheder/);
  assert.match(page, /Ét ApS eller A\/S er ét juridisk regnskab/);
  assert.match(page, /Afdelinger og SE-numre hører under det valgte CVR/);
  assert.match(migration, /CREATE TABLE `company_access_memberships`/);
  assert.match(migration, /CREATE TABLE `company_units`/);
});

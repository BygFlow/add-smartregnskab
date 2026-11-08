import test from "node:test";
import assert from "node:assert/strict";
import { accountingReportScopes } from "../server/accounting-report-scope";

const companies = [
  { id: 1, name: "Drift ApS", cvr: "11111111", groupRole: "subsidiary" },
  { id: 2, name: "Rengøring", cvr: "22222222", parentCompanyId: 1, groupRole: "se_registration" },
  { id: 3, name: "Datterselskab ApS", cvr: "33333333", parentCompanyId: 1, groupRole: "subsidiary" },
];

test("juridiske årsrapporter medtager SE-regnskaber, men ikke datterselskaber", () => {
  assert.deepEqual(accountingReportScopes(1, "aarskontrol", companies).map((company) => company.id), [1, 2]);
  assert.deepEqual(accountingReportScopes(1, "resultatopgoerelse", companies).map((company) => company.id), [1, 2]);
});

test("momsrapporten og et åbent SE-regnskab forbliver afgrænset", () => {
  assert.deepEqual(accountingReportScopes(1, "momsrapport", companies).map((company) => company.id), [1]);
  assert.deepEqual(accountingReportScopes(2, "aarskontrol", companies).map((company) => company.id), [2]);
});

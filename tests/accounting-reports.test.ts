import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountingReport } from "../server/accounting-reports";

const accounts = [
  { id: 1, accountNumber: "1010", name: "Salg", type: "indtaegt" },
  { id: 2, accountNumber: "3410", name: "Husleje", type: "udgift" },
  { id: 3, accountNumber: "5820", name: "Bankkonto", type: "aktiv" },
  { id: 4, accountNumber: "6902", name: "Udgående moms", type: "passiv", vatCode: "U25" },
];

const entries = [
  { id: 10, entryNumber: "1", date: "2024-01-05", status: "bogført" },
  { id: 11, entryNumber: "2", date: "2025-01-05", status: "bogført" },
];

const lines = [
  { journalEntryId: 10, accountId: 1, debit: 0, credit: 1_000 },
  { journalEntryId: 10, accountId: 3, debit: 1_000, credit: 0 },
  { journalEntryId: 11, accountId: 2, debit: 100, credit: 0 },
  { journalEntryId: 11, accountId: 3, debit: 0, credit: 100 },
];

test("årskontrol bruger bogførte linjer og vælger seneste bogføringsår", () => {
  const report = buildAccountingReport({
    type: "aarskontrol",
    companyName: "Test ApS",
    accounts,
    entries,
    lines,
    bankTransactions: [],
    vatPeriods: [],
  });

  assert.equal(report.year, 2025);
  assert.deepEqual(report.availableYears, [2025, 2024]);
  assert.equal(report.controls?.[0]?.status, "ok");
  assert.equal(report.controls?.[0]?.metrics.find((metric) => metric.label === "Debet i alt")?.value, 100);
  assert.equal(report.controls?.[1]?.status, "warning");
  assert.match(report.controls?.[1]?.summary ?? "", /kontoudtog/i);
  assert.equal(report.controls?.[2]?.status, "warning");
  assert.match(report.controls?.[2]?.summary ?? "", /momsperioder/i);
});

test("resultat og balance beregnes fra det valgte års posteringer", () => {
  const result = buildAccountingReport({
    type: "resultatopgoerelse",
    requestedYear: 2024,
    accounts,
    entries,
    lines,
    bankTransactions: [],
    vatPeriods: [],
  });
  const balance = buildAccountingReport({
    type: "balance",
    requestedYear: 2024,
    accounts,
    entries,
    lines,
    bankTransactions: [],
    vatPeriods: [],
  });

  assert.equal(result.sections?.[0]?.total, 1_000);
  assert.equal(result.sections?.[1]?.total, 0);
  assert.equal(result.sections?.[2]?.total, 1_000);
  assert.equal(balance.sections?.[0]?.total, 1_000);
  assert.equal(balance.sections?.[2]?.total, 1_000);
  assert.equal(balance.sections?.[3]?.lines[0]?.amount, 0);
});

test("en ubalanceret postering markeres som fejl", () => {
  const report = buildAccountingReport({
    type: "aarskontrol",
    requestedYear: 2024,
    accounts,
    entries,
    lines: lines.filter((line) => !(line.journalEntryId === 10 && line.accountId === 3)),
    bankTransactions: [],
    vatPeriods: [],
  });

  assert.equal(report.controls?.[0]?.status, "error");
  assert.equal(report.controls?.[0]?.metrics.find((metric) => metric.label === "Forskel")?.value, -1_000);
});

test("indsendt årsrapport er officielt facit uden at overskrive bogføringen", () => {
  const report = buildAccountingReport({
    type: "resultatopgoerelse",
    requestedYear: 2024,
    accounts,
    entries,
    lines,
    bankTransactions: [],
    vatPeriods: [],
    annualReports: [{
      year: 2024,
      result: -134_428,
      taxResult: 37_662,
      balanceTotal: 183_252,
      equity: -94_428,
      status: "indsendt",
      xbrlStatus: "indsendt",
      submittedToErhvervsstyrelsen: 1,
      auditorPackage: JSON.stringify({
        grossProfit: -127_377,
        operatingResult: -171_711,
        resultBeforeTax: -172_090,
        liabilitiesTotal: 277_680,
      }),
    }],
  });

  assert.equal(report.sections?.[2]?.title, "Bogført resultat");
  assert.equal(report.sections?.[2]?.total, 1_000);
  assert.equal(report.sections?.[3]?.title, "Indsendt årsrapport · Officielt resultat");
  assert.equal(report.sections?.[3]?.total, -134_428);
  assert.equal(report.filedAnnualReport?.bookkeepingResult, 1_000);
  assert.equal(report.filedAnnualReport?.reconciliationDifference, -135_428);
  assert.match(report.notice ?? "", /facit/i);
});

test("årsrapportår er tilgængeligt selv uden bogførte posteringer", () => {
  const report = buildAccountingReport({
    type: "aarskontrol",
    requestedYear: 2024,
    companyName: "Holding ApS",
    accounts: [],
    entries: [],
    lines: [],
    bankTransactions: [],
    vatPeriods: [],
    annualReports: [{
      year: 2024,
      result: -4_875,
      taxResult: 1_375,
      balanceTotal: 41_375,
      equity: 35_125,
      status: "indsendt",
      xbrlStatus: "indsendt",
      submittedToErhvervsstyrelsen: 1,
      auditorPackage: JSON.stringify({ resultBeforeTax: -6_250, liabilitiesTotal: 6_250 }),
    }],
  });

  assert.equal(report.year, 2024);
  assert.deepEqual(report.availableYears, [2024]);
  assert.equal(report.controls?.[0]?.title, "Indsendt årsrapport");
  assert.equal(report.controls?.[0]?.metrics.find((metric) => metric.label === "Årets resultat")?.value, -4_875);
  assert.equal(report.controls?.[1]?.title, "Afstemning mod årsrapport");
  assert.equal(report.controls?.[1]?.status, "warning");
});

test("årskontrol advarer om mulige dubletbanklinjer på tværs af SE-regnskaber", () => {
  const report = buildAccountingReport({
    type: "aarskontrol",
    requestedYear: 2025,
    companyName: "Drift ApS",
    accountingScopes: [
      { id: 1, name: "Drift ApS", registrationNumber: "11111111" },
      { id: 2, name: "Rengøring", registrationNumber: "22222222" },
    ],
    accounts,
    entries,
    lines,
    bankTransactions: [
      { companyId: 1, date: "2025-04-10", description: "Aconto løn", amount: -3_000, status: "matchet" },
      { companyId: 2, date: "2025-04-10", description: " ACONTO  LØN ", amount: -3_000, status: "matchet" },
    ],
    vatPeriods: [],
  });

  const bankControl = report.controls?.find((control) => control.key === "bank");
  assert.equal(bankControl?.status, "warning");
  assert.equal(bankControl?.metrics.find((metric) => metric.label === "Mulige dubletter på tværs af regnskaber")?.value, 1);
  assert.match(bankControl?.summary ?? "", /dubletbankpostering/i);
  assert.deepEqual(report.duplicateBankTransactions, [{
    date: "2025-04-10",
    description: "Aconto løn",
    amount: -3_000,
    scopeNames: ["Drift ApS", "Rengøring"],
    duplicateCount: 1,
  }]);
});

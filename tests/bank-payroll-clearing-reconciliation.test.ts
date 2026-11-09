import assert from "node:assert/strict";
import test from "node:test";
import { findSafePayrollClearingPostings } from "../server/bank-payroll-clearing-reconciliation";

const accounts = [
  { id: 96, accountNumber: "5820", active: 1 },
  { id: 97, accountNumber: "5825", active: 1 },
];

test("klassificerer dokumenterede lønkontantstrømme uden at kalde dem lønomkostning", () => {
  const rows = findSafePayrollClearingPostings([
    { id: 1, date: "2025-11-10", description: "Overførselsservice", amount: -4_475, accountRef: "9507", status: "afventer" },
    { id: 2, date: "2025-07-01", description: "Aconto Løn til Dragena Dan", amount: -4_000, accountRef: "9507", status: "afventer" },
    { id: 3, date: "2025-12-19", description: "Aconto Løn til Aurel", amount: -5_500, accountRef: "6477", status: "afventer" },
    { id: 4, date: "2025-11-28", description: "Feriepenge", amount: -978.44, accountRef: "9507", status: "afventer" },
  ], accounts, []);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.kind === "payroll_clearing"));
  assert.deepEqual(rows.map((row) => row.bankAccountId), [97, 97, 96, 97]);
});

test("klassificerer kun eksplicitte Multi Service-overførsler som mellemregning", () => {
  const rows = findSafePayrollClearingPostings([
    { id: 10, date: "2025-09-03", description: "ADD Multi Service ApS", amount: -5_000, accountRef: "9507", status: "afventer" },
    { id: 11, date: "2025-06-26", description: "Løn Skat Moms Konto ADD Multi Service ApS", amount: -5_000, accountRef: "9507", status: "afventer" },
    { id: 12, date: "2025-09-10", description: "Transfer", amount: -500, accountRef: "9507", status: "afventer" },
  ], accounts, []);
  assert.deepEqual(rows.map((row) => row.kind), ["intercompany_outflow", "intercompany_outflow"]);
});

test("kræver eksakt samme-dags lønbatch før positiv SE-reference er finansiering", () => {
  const base = { id: 20, date: "2025-11-10", description: "4514759251111", amount: 4_475, accountRef: "9507", status: "afventer" };
  assert.deepEqual(findSafePayrollClearingPostings([base], accounts, []), []);
  const rows = findSafePayrollClearingPostings([
    base,
    { id: 21, date: "2025-11-10", description: "Overførselsservice", amount: -4_475, accountRef: "9507", status: "afventer" },
  ], accounts, []);
  assert.equal(rows.find((row) => row.transactionId === 20)?.kind, "intercompany_funding");
});

test("afviser andre år, ukendte konti, behandlede rækker, generiske køb og tidligere bogføring", () => {
  const variants = [
    { id: 30, date: "2024-11-10", description: "Overførselsservice", amount: -100, accountRef: "9507", status: "afventer" },
    { id: 31, date: "2025-11-10", description: "Overførselsservice", amount: -100, accountRef: "ukendt", status: "afventer" },
    { id: 32, date: "2025-11-10", description: "Overførselsservice", amount: -100, accountRef: "9507", status: "matchet" },
    { id: 33, date: "2025-11-10", description: "Silvan", amount: -100, accountRef: "9507", status: "afventer" },
    { id: 34, date: "2025-11-10", description: "Overførselsservice", amount: -100, accountRef: "9507", status: "afventer" },
  ];
  assert.deepEqual(findSafePayrollClearingPostings(variants, accounts, [
    { sourceType: "bank_payroll_clearing", sourceId: 34 },
  ]), []);
  assert.deepEqual(findSafePayrollClearingPostings([
    { ...variants[4], id: 35 },
  ], [...accounts, { id: 98, accountNumber: "5825", active: 1 }], []), []);
});

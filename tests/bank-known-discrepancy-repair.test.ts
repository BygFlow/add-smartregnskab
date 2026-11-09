import test from "node:test";
import assert from "node:assert/strict";
import { findKnownBankDiscrepancyRepairPlan } from "../server/bank-known-discrepancy-repair";

const accounts = [
  { id: 1, accountNumber: "5820", active: 1 },
  { id: 2, accountNumber: "5825", active: 1 },
  { id: 3, accountNumber: "5600", active: 1 },
  { id: 4, accountNumber: "2210", active: 1 },
];
const transactions = [
  { id: 10, date: "2025-08-18", description: "FAKTURA 515 TIEMROTH", amount: 30126.39, accountRef: "0112", status: "afventer" },
  { id: 11, date: "2025-06-27", description: "Overførselsservice", amount: -22622, accountRef: "4483", status: "afventer" },
];
const entries = [
  { id: 100, date: "2025-08-18", entryNumber: "ECON-10034", description: "Indbet. fak. 515", reference: "515", sourceType: "saft_import", status: "bogført" },
  { id: 101, date: "2025-06-27", entryNumber: "ECON-20004", description: "Løn", reference: "20004", sourceType: "saft_import", status: "bogført" },
];
const lines = [
  { journalEntryId: 100, accountId: 1, debit: 30126.29, credit: 0 },
  { journalEntryId: 100, accountId: 3, debit: 0, credit: 30126.29 },
  { journalEntryId: 101, accountId: 1, debit: 0, credit: 22622 },
  { journalEntryId: 101, accountId: 4, debit: 22622, credit: 0 },
];

test("finder faktura 515-øredifferencen og juni-lønnen på forkert bankkonto", () => {
  const plan = findKnownBankDiscrepancyRepairPlan(transactions, entries, lines, accounts);
  assert.equal(plan.safe, true);
  assert.equal(plan.invoice515?.overpayment, 0.10);
  assert.equal(plan.payrollJune?.amount, 22622);
  assert.equal(plan.operatingBankAccountId, 1);
  assert.equal(plan.payrollBankAccountId, 2);
});

test("afviser faktura 515 hvis bankbeløbet ikke er præcis 30.126,39", () => {
  const plan = findKnownBankDiscrepancyRepairPlan(transactions.map((row) => row.id === 10 ? { ...row, amount: 30126.38 } : row), entries, lines, accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /Faktura 515/);
});

test("afviser juni-lønnen hvis importen allerede bruger 5825", () => {
  const changed = lines.map((line) => line.journalEntryId === 101 && line.accountId === 1 ? { ...line, accountId: 2 } : line);
  const plan = findKnownBankDiscrepancyRepairPlan(transactions, entries, changed, accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /Nettoløn 27. juni/);
});

test("afviser en bankpost der allerede er matchet", () => {
  const plan = findKnownBankDiscrepancyRepairPlan(transactions.map((row) => row.id === 11 ? { ...row, status: "matchet", matchedType: "journal_entry", matchedId: 101 } : row), entries, lines, accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /Nettoløn 27. juni/);
});

test("afviser ubalanceret lønpost", () => {
  const changed = lines.map((line) => line.journalEntryId === 101 && line.accountId === 4 ? { ...line, debit: 22621.99 } : line);
  const plan = findKnownBankDiscrepancyRepairPlan(transactions, entries, changed, accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /balanceret lønpost/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { findKnownBankChargeRepairPlan } from "../server/bank-known-charge-repair";

const accounts = [
  { id: 1, accountNumber: "5820", name: "Bankkonto", active: 1 },
  { id: 2, accountNumber: "3629", name: "Bank - gebyrer", active: 1 },
  { id: 3, accountNumber: "4410", name: "Renteudgift, bank", active: 1 },
];

const transactions = [
  { id: 10, date: "2025-09-30", description: "Rente", amount: -21.30, accountRef: "0112", status: "afventer" },
  { id: 11, date: "2025-12-02", description: "Rejection fee - BS", amount: -250, accountRef: "0112", status: "afventer" },
  { id: 12, date: "2025-12-30", description: "Rente", amount: -4.88, accountRef: "0112", status: "afventer" },
];

test("finder præcis de tre dokumenterede bankomkostninger", () => {
  const plan = findKnownBankChargeRepairPlan(transactions, accounts);
  assert.equal(plan.safe, true);
  assert.equal(plan.rows.length, 3);
  assert.equal(plan.interestExpense, 26.18);
  assert.equal(plan.rejectionFee, 250);
  assert.equal(plan.total, 276.18);
});

test("afviser hvis en forventet bankpost mangler", () => {
  const plan = findKnownBankChargeRepairPlan(transactions.slice(0, 2), accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /2025-12-30/);
});

test("afviser et andet beløb på afvisningsgebyret", () => {
  const changed = transactions.map((row) => row.id === 11 ? { ...row, amount: -249.99 } : row);
  const plan = findKnownBankChargeRepairPlan(changed, accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /Rejection fee/);
});

test("afviser en bankpost der allerede er matchet", () => {
  const changed = transactions.map((row) => row.id === 10 ? { ...row, status: "matchet" } : row);
  const plan = findKnownBankChargeRepairPlan(changed, accounts);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /2025-09-30/);
});

test("afviser dubleret eller forkert navngivet konto", () => {
  const plan = findKnownBankChargeRepairPlan(transactions, [
    ...accounts,
    { id: 4, accountNumber: "4410", name: "Renteudgift, bank", active: 1 },
  ]);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /konto 4410/);
});

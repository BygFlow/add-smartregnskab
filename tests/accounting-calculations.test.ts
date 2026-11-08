import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAccountBalances,
  calculatePeriodProfitLoss,
  journalEntryAmount,
} from "../server/accounting-calculations";

test("kontosaldi beregnes fra bogførte linjer og ignorerer kladder", () => {
  const accounts = [
    { id: 1, accountNumber: "5820", balance: 999 },
    { id: 2, accountNumber: "1010", balance: 0 },
    { id: 3, accountNumber: "9999", balance: 125 },
  ];
  const entries = [
    { id: 10, date: "2025-01-01", status: "bogført" },
    { id: 11, date: "2025-01-02", status: "kladde" },
  ];
  const lines = [
    { journalEntryId: 10, accountId: 1, debit: 1250, credit: 0 },
    { journalEntryId: 10, accountId: 2, debit: 0, credit: 1250 },
    { journalEntryId: 11, accountId: 1, debit: 9000, credit: 0 },
  ];

  assert.deepEqual(calculateAccountBalances(accounts, entries, lines).map((account) => account.balance), [1250, -1250, 125]);
  assert.equal(journalEntryAmount(10, lines), 1250);
});

test("dashboardtal beregnes fra bogførte linjer i den valgte periode", () => {
  const accounts = [
    { id: 1, accountNumber: "3000", type: "indtaegt", balance: 999999 },
    { id: 2, accountNumber: "4000", type: "udgift", balance: 999999 },
    { id: 3, accountNumber: "5820", type: "aktiv", balance: 999999 },
  ];
  const entries = [
    { id: 20, date: "2026-03-01", status: "bogført" },
    { id: 21, date: "2025-12-31", status: "bogført" },
    { id: 22, date: "2026-04-01", status: "kladde" },
  ];
  const lines = [
    { journalEntryId: 20, accountId: 1, debit: 0, credit: 1000 },
    { journalEntryId: 20, accountId: 2, debit: 250, credit: 0 },
    { journalEntryId: 20, accountId: 3, debit: 750, credit: 0 },
    { journalEntryId: 21, accountId: 1, debit: 0, credit: 5000 },
    { journalEntryId: 22, accountId: 2, debit: 9000, credit: 0 },
  ];

  assert.deepEqual(calculatePeriodProfitLoss(accounts, entries, lines, "2026-01-01", "2026-12-31"), {
    revenue: 1000,
    expenses: 250,
    result: 750,
  });
});

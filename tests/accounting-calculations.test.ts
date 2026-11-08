import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAccountBalances,
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

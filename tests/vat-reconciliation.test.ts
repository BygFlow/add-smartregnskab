import test from "node:test";
import assert from "node:assert/strict";
import { calculateJournalVatReconciliation, parseVatReconciliationPeriod } from "../server/vat-reconciliation";

test("momsperioder afgrænses korrekt", () => {
  assert.deepEqual(parseVatReconciliationPeriod("2025-Q2"), {
    normalizedPeriod: "2025-Q2",
    start: "2025-04-01",
    end: "2025-06-30",
  });
  assert.deepEqual(parseVatReconciliationPeriod("2025-H2"), {
    normalizedPeriod: "2025-H2",
    start: "2025-07-01",
    end: "2025-12-31",
  });
});

test("momsafstemning bruger bogførte momskonti og kun den valgte periode", () => {
  const result = calculateJournalVatReconciliation({
    period: "2025-Q1",
    accounts: [
      { id: 1, accountNumber: "6901", name: "Indgående moms", type: "aktiv" },
      { id: 2, accountNumber: "6902", name: "Udgående moms", type: "passiv" },
      { id: 3, accountNumber: "6903", name: "Momsafregning", type: "passiv" },
      { id: 4, accountNumber: "7000", name: "Skattekonto", type: "aktiv" },
    ],
    entries: [
      { id: 10, date: "2025-01-15", status: "bogført" },
      { id: 11, date: "2025-04-01", status: "bogført" },
      { id: 12, date: "2025-02-01", status: "kladde" },
    ],
    lines: [
      { journalEntryId: 10, accountId: 1, debit: 250, credit: 0 },
      { journalEntryId: 10, accountId: 2, debit: 0, credit: 500 },
      { journalEntryId: 10, accountId: 4, debit: 100, credit: 0 },
      { journalEntryId: 11, accountId: 2, debit: 0, credit: 9_999 },
      { journalEntryId: 12, accountId: 1, debit: 9_999, credit: 0 },
    ],
  });

  assert.equal(result.outputVat, 500);
  assert.equal(result.inputVat, 250);
  assert.equal(result.netVat, 250);
  assert.equal(result.taxAccount, 100);
  assert.equal(result.difference, 150);
  assert.equal(result.entryCount, 1);
  assert.deepEqual(result.ignoredVatAccounts, []);
});

test("ukendte balance-momskonti kræver manuel kontrol", () => {
  const result = calculateJournalVatReconciliation({
    period: "2025",
    accounts: [{ id: 1, accountNumber: "6999", name: "Moms mellemregning", type: "passiv" }],
    entries: [{ id: 10, date: "2025-05-01", status: "bogført" }],
    lines: [{ journalEntryId: 10, accountId: 1, debit: 0, credit: 20 }],
  });
  assert.deepEqual(result.ignoredVatAccounts, ["6999 · Moms mellemregning"]);
  assert.equal(result.recognizedLineCount, 0);
});

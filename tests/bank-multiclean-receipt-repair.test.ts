import test from "node:test";
import assert from "node:assert/strict";
import { findMultiCleanReceiptRepairPlan } from "../server/bank-multiclean-receipt-repair";

const accounts = [
  { id: 1, accountNumber: "5820", active: 1 },
  { id: 2, accountNumber: "5600", active: 1 },
];

const transactions = [
  { id: 2916, date: "2025-08-06", description: "NORDIC 211", amount: 10_410.47, accountRef: "6477", status: "afventer" },
  { id: 2854, date: "2025-09-05", description: "RENGØRING KONTOR", amount: 1_476.10, accountRef: "6477", status: "afventer" },
  { id: 2815, date: "2025-09-23", description: "215", amount: 6_173.53, accountRef: "6477", status: "afventer" },
  { id: 2755, date: "2025-11-18", description: "220 ADD MULTICLEAN", amount: 16_574.50, accountRef: "6477", status: "afventer" },
];

const sourceEntries = [
  [101, "2025-08-06", 9_771.88, "184", "Indbet. fak. 184", "receipt"],
  [102, "2025-09-10", 638.59, "", "Indbet. fak.", "receipt"],
  [103, "2025-09-05", 2_724.70, "10122", "Indbet. fak. 209 og 219", "receipt"],
  [104, "2025-08-01", 1_248.60, "219", "Indbet. fak. 219", "receipt"],
  [105, "2025-09-23", 5_534.94, "222", "Indbet. fak. 222", "receipt"],
  [106, "2025-11-18", 15_642.38, "254", "Indbet. fak. 254", "receipt"],
  [107, "2025-11-18", 12_415.81, "266", "Indbet. fak. 266", "receipt"],
  [108, "2026-02-01", 12_415.81, "266", "Tilbageført indbet. fak. 266", "reversal"],
] as const;

const entries = sourceEntries.map(([id, date, , reference, description]) => ({
  id, date, reference, description, entryNumber: `ECON-${id}`, sourceType: "saft_import", status: "bogført",
}));
const lines = sourceEntries.flatMap(([id, , amount, , , direction]) => direction === "receipt"
  ? [
      { journalEntryId: id, accountId: 1, debit: amount, credit: 0 },
      { journalEntryId: id, accountId: 2, debit: 0, credit: amount },
    ]
  : [
      { journalEntryId: id, accountId: 1, debit: 0, credit: amount },
      { journalEntryId: id, accountId: 2, debit: amount, credit: 0 },
    ]);

test("finder de fire dokumenterede MultiClean-samlebetalinger og 2026-neutraliseringen", () => {
  const plan = findMultiCleanReceiptRepairPlan(transactions, entries, lines, accounts);
  assert.equal(plan.safe, true);
  assert.deepEqual(plan.rows.map((row) => [row.transactionId, row.amount, row.reversalEntryIds]), [
    [2916, 10_410.47, [101, 102]],
    [2854, 1_476.10, [103, 104]],
    [2815, 6_173.53, [105]],
    [2755, 16_574.50, [106, 107]],
  ]);
  assert.deepEqual(plan.neutralizeEntryIds, [108]);
});

test("afviser planen hvis en kildepost allerede er anvendt", () => {
  const plan = findMultiCleanReceiptRepairPlan(
    [...transactions, { id: 999, status: "matchet", matchedType: "journal_entry", matchedId: 105 }],
    entries,
    lines,
    accounts,
  );
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /nordic-215/i);
});

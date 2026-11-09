import test from "node:test";
import assert from "node:assert/strict";
import { findCustomerReceiptDuplicateRepairPlan } from "../server/bank-customer-receipt-duplicate-repair";

const accounts = [
  { id: 1, accountNumber: "5820", active: 1 },
  { id: 2, accountNumber: "5600", active: 1 },
];

function receiptEntry(id: number, date: string, amount: number, invoiceReference: string) {
  const absoluteAmount = Math.abs(amount);
  const bankLine = amount >= 0
    ? { journalEntryId: id, accountId: 1, debit: absoluteAmount, credit: 0 }
    : { journalEntryId: id, accountId: 1, debit: 0, credit: absoluteAmount };
  const receivableLine = amount >= 0
    ? { journalEntryId: id, accountId: 2, debit: 0, credit: absoluteAmount }
    : { journalEntryId: id, accountId: 2, debit: absoluteAmount, credit: 0 };
  return {
    entry: {
      id,
      date,
      entryNumber: `ECON-${id}`,
      description: `Indbet. fak. ${invoiceReference}`,
      reference: invoiceReference,
      sourceType: "saft_import",
      status: "bogført",
    },
    lines: [bankLine, receivableLine],
  };
}

test("finder de to urettede Multi Service-dubletter og bevarer den tidligste postering", () => {
  const transactions = [
    { id: 12, date: "2025-10-09", amount: 165_167.44, accountRef: "0112", status: "afventer" },
    { id: 13, date: "2025-10-09", amount: 22_787.71, accountRef: "0112", status: "afventer" },
  ];
  const source = [
    receiptEntry(201, "2025-10-09", 165_167.44, "523"),
    receiptEntry(202, "2025-10-09", 165_167.44, "523"),
    receiptEntry(301, "2025-10-09", 22_787.71, "525"),
    receiptEntry(302, "2025-10-09", 22_787.71, "525"),
  ];
  const plan = findCustomerReceiptDuplicateRepairPlan(
    transactions,
    source.map((row) => row.entry),
    source.flatMap((row) => row.lines),
    accounts,
  );

  assert.equal(plan.safe, true);
  assert.deepEqual(plan.rows.map((row) => [row.invoiceReference, row.keepEntryId, row.duplicateEntryId]), [
    ["523", 201, 202],
    ["525", 301, 302],
  ]);
  assert.equal(plan.rows.reduce((sum, row) => sum + row.amount, 0), 187_955.15);
});

test("rører ikke faktura 503, som allerede er netto-korrigeret i 2025-kilden", () => {
  const first = receiptEntry(101, "2025-06-11", 11_950, "503");
  const second = receiptEntry(102, "2025-06-11", 11_950, "503");
  const reversal = receiptEntry(103, "2025-06-11", -11_950, "503");
  const plan = findCustomerReceiptDuplicateRepairPlan(
    [{ id: 11, date: "2025-06-11", amount: 11_950, accountRef: "0112", status: "afventer" }],
    [first.entry, second.entry, reversal.entry],
    [...first.lines, ...second.lines, ...reversal.lines],
    accounts,
  );
  assert.equal(plan.safe, false);
  assert.deepEqual(plan.rows, []);
  assert.match(plan.reasons.join(" "), /ingen af de dokumenterede kundebetalingsdubletter/i);
});

test("finder MultiClean-dubletten og bevarer den allerede matchede postering", () => {
  const first = receiptEntry(401, "2025-08-12", 595, "207");
  const second = receiptEntry(402, "2025-08-12", 595, "207");
  const importedReversal = receiptEntry(403, "2026-02-01", -595, "207");
  const plan = findCustomerReceiptDuplicateRepairPlan(
    [{
      id: 14,
      date: "2025-08-12",
      amount: 595,
      accountRef: "6477",
      status: "matchet",
      matchedType: "journal_entry",
      matchedId: 402,
    }],
    [first.entry, second.entry, importedReversal.entry],
    [...first.lines, ...second.lines, ...importedReversal.lines],
    accounts,
  );

  assert.equal(plan.safe, true);
  assert.equal(plan.rows[0].keepEntryId, 402);
  assert.equal(plan.rows[0].duplicateEntryId, 401);
  assert.equal(plan.rows[0].neutralizeEntryId, 403);
  assert.equal(plan.rows[0].transactionWasMatched, true);
});

test("afviser en dublet hvis der findes to reelle bankbetalinger", () => {
  const first = receiptEntry(401, "2025-08-12", 595, "207");
  const second = receiptEntry(402, "2025-08-12", 595, "207");
  const importedReversal = receiptEntry(403, "2026-02-01", -595, "207");
  const plan = findCustomerReceiptDuplicateRepairPlan(
    [
      { id: 14, date: "2025-08-12", amount: 595, accountRef: "6477", status: "afventer" },
      { id: 15, date: "2025-08-12", amount: 595, accountRef: "6477", status: "afventer" },
    ],
    [first.entry, second.entry, importedReversal.entry],
    [...first.lines, ...second.lines, ...importedReversal.lines],
    accounts,
  );

  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /forventede én bankpost, fandt 2/i);
});

test("afviser hvis den mulige dublet er anvendt eller allerede tilbageført", () => {
  const first = receiptEntry(401, "2025-08-12", 595, "207");
  const second = receiptEntry(402, "2025-08-12", 595, "207");
  const importedReversal = receiptEntry(403, "2026-02-01", -595, "207");
  const usedPlan = findCustomerReceiptDuplicateRepairPlan(
    [
      { id: 14, date: "2025-08-12", amount: 595, accountRef: "6477", status: "afventer" },
      { id: 99, status: "matchet", matchedType: "journal_entry", matchedId: 402 },
    ],
    [first.entry, second.entry, importedReversal.entry],
    [...first.lines, ...second.lines, ...importedReversal.lines],
    accounts,
  );
  assert.equal(usedPlan.safe, false);
  assert.match(usedPlan.reasons.join(" "), /allerede knyttet til en bankpost/i);

  const reversedPlan = findCustomerReceiptDuplicateRepairPlan(
    [{ id: 14, date: "2025-08-12", amount: 595, accountRef: "6477", status: "afventer" }],
    [
      first.entry,
      second.entry,
      importedReversal.entry,
      {
        id: 500,
        date: "2025-08-12",
        sourceType: "bank_customer_receipt_duplicate_reversal",
        sourceId: 402,
        status: "bogført",
      },
    ],
    [...first.lines, ...second.lines, ...importedReversal.lines],
    accounts,
  );
  assert.equal(reversedPlan.safe, false);
  assert.match(reversedPlan.reasons.join(" "), /allerede tilbageført/i);
});

test("afviser MultiClean-rettelsen hvis den dokumenterede 2026-tilbageførsel mangler", () => {
  const first = receiptEntry(401, "2025-08-12", 595, "207");
  const second = receiptEntry(402, "2025-08-12", 595, "207");
  const plan = findCustomerReceiptDuplicateRepairPlan(
    [{ id: 14, date: "2025-08-12", amount: 595, accountRef: "6477", status: "afventer" }],
    [first.entry, second.entry],
    [...first.lines, ...second.lines],
    accounts,
  );
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /forventede den dokumenterede importtilbageførsel/i);
});

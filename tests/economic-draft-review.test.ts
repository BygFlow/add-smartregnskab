import assert from "node:assert/strict";
import test from "node:test";
import { reviewEconomicJournalDrafts } from "../server/economic-draft-review";

const accounts = [{ id: 10 }, { id: 20 }];
const draft = { id: 1, entryNumber: "ECON-KLADDE-1", date: "2025-01-02", description: "Test", reference: "INV-1", sourceType: "economic_kladde", status: "kladde" };
const balancedLines = [
  { id: 1, journalEntryId: 1, accountId: 10, debit: 125, credit: 0, vatCode: "I25" },
  { id: 2, journalEntryId: 1, accountId: 20, debit: 0, credit: 125, vatCode: null },
];

test("balanced economic drafts are approved for posting", () => {
  const result = reviewEconomicJournalDrafts([draft], balancedLines, accounts);
  assert.equal(result.canPost, true);
  assert.equal(result.drafts, 1);
  assert.equal(result.posted, 0);
  assert.equal(result.lines, 2);
  assert.equal(result.totalDebit, 125);
  assert.equal(result.totalCredit, 125);
  assert.deepEqual(result.issues, []);
});

test("unbalanced drafts and missing accounts block posting", () => {
  const result = reviewEconomicJournalDrafts([draft], [
    { ...balancedLines[0], debit: 100 },
    { ...balancedLines[1], accountId: 99 },
  ], accounts);
  assert.equal(result.canPost, false);
  assert.ok(result.issues.some((issue) => issue.reason.includes("balancerer ikke")));
  assert.ok(result.issues.some((issue) => issue.reason.includes("findes ikke")));
});

test("an exact match against a posted entry blocks posting", () => {
  const posted = { ...draft, id: 2, entryNumber: "SAFT-1", sourceType: "saft_import", status: "bogført" };
  const postedLines = balancedLines.map((line, index) => ({ ...line, id: line.id + 10, journalEntryId: 2 + index * 0 }));
  const result = reviewEconomicJournalDrafts([draft, posted], [...balancedLines, ...postedLines], accounts);
  assert.equal(result.canPost, false);
  assert.equal(result.exactPostedDuplicates.length, 1);
  assert.equal(result.posted, 0);
});

test("posted economic imports are reported as completed", () => {
  const postedImport = { ...draft, status: "bogført" };
  const result = reviewEconomicJournalDrafts([postedImport], balancedLines, accounts);
  assert.equal(result.drafts, 0);
  assert.equal(result.posted, 1);
  assert.equal(result.canPost, false);
});

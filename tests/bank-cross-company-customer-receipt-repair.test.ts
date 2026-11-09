import test from "node:test";
import assert from "node:assert/strict";
import { findCrossCompanyCustomerReceiptRepairPlan } from "../server/bank-cross-company-customer-receipt-repair";

const specs = [
  [1, "2025-03-18", 1300, "13800707", "Fra Jørgen Holst", "138"],
  [2, "2025-03-26", 1870, "13800707", "Fra IHILP APS", "140"],
  [3, "2025-06-11", 1320.13, "0112", "SY CONSULTANCY", "152"],
  [4, "2025-11-03", 3300, "0112", "FAKTURA 247", "247"],
  [5, "2025-11-28", 3300, "0112", "FAKTURA 262", "262"],
  [6, "2025-12-16", 2625, "0112", "PHILLIP CHRISTIAN DA", "286"],
] as const;

const multiServiceAccounts = [
  { id: 10, accountNumber: "5820", active: 1 },
  { id: 11, accountNumber: "6840", active: 1 },
];
const multiCleanAccounts = [
  { id: 20, accountNumber: "5820", active: 1 },
  { id: 21, accountNumber: "5600", active: 1 },
  { id: 22, accountNumber: "6837", active: 1 },
];
const multiServiceTransactions = specs.map(([id, date, amount, accountRef, description]) => ({
  id, date, amount, accountRef, description, status: "afventer",
}));
const multiCleanEntries = specs.map(([id, date, , , , invoice]) => ({
  id: 100 + id,
  date,
  entryNumber: `ECON-${10000 + id}`,
  description: `Indbet. fak. ${invoice}`,
  reference: invoice,
  sourceType: "saft_import",
  status: "bogført",
}));
const multiCleanLines = specs.flatMap(([id, , amount]) => ([
  { journalEntryId: 100 + id, accountId: 20, debit: amount, credit: 0 },
  { journalEntryId: 100 + id, accountId: 21, debit: 0, credit: amount },
]));

function build(overrides: Partial<Parameters<typeof findCrossCompanyCustomerReceiptRepairPlan>[0]> = {}) {
  return findCrossCompanyCustomerReceiptRepairPlan({
    multiServiceTransactions,
    multiServiceAccounts,
    multiCleanTransactions: [],
    multiCleanEntries,
    multiCleanLines,
    multiCleanAccounts,
    ...overrides,
  });
}

test("finder præcis de seks dokumenterede kundebetalinger på tværs af virksomheder", () => {
  const plan = build();
  assert.equal(plan.safe, true);
  assert.equal(plan.rows.length, 6);
  assert.equal(plan.total, 13715.13);
  assert.deepEqual(plan.rows.map((row) => row.invoiceReference), ["138", "140", "152", "247", "262", "286"]);
});

test("afviser hvis en bankpost allerede er matchet", () => {
  const plan = build({
    multiServiceTransactions: multiServiceTransactions.map((row) => row.id === 4 ? { ...row, status: "matchet" } : row),
  });
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /mc-247/);
});

test("afviser hvis en importeret betaling har forkert modkonto", () => {
  const plan = build({
    multiCleanLines: multiCleanLines.map((line) => line.journalEntryId === 103 && line.accountId === 21 ? { ...line, accountId: 22 } : line),
  });
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /mc-152/);
});

test("afviser hvis en importeret betaling allerede bruges af en bankpost", () => {
  const plan = build({
    multiCleanTransactions: [{ id: 900, status: "matchet", matchedType: "journal_entry", matchedId: 105 }],
  });
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /mc-262/);
});

test("afviser dublerede bankkandidater", () => {
  const plan = build({
    multiServiceTransactions: [...multiServiceTransactions, { ...multiServiceTransactions[5], id: 99 }],
  });
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /fandt 2/);
});

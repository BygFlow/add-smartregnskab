import test from "node:test";
import assert from "node:assert/strict";
import { findCrossCompanyJemFixRepairPlan } from "../server/bank-cross-company-expense-repair";

const multiServiceAccounts = [
  { id: 1, accountNumber: "1310", active: 1 },
  { id: 2, accountNumber: "6903", active: 1 },
  { id: 3, accountNumber: "6836", active: 1 },
  { id: 4, accountNumber: "6840", active: 1 },
];
const multiCleanAccounts = [
  { id: 11, accountNumber: "5820", active: 1 },
  { id: 12, accountNumber: "6837", active: 1 },
];
const multiServiceEntries = [{
  id: 100,
  date: "2025-09-03",
  entryNumber: "ECON-50746",
  description: "Jem & Fix",
  sourceType: "saft_import",
  status: "bogført",
}];
const multiServiceLines = [
  { journalEntryId: 100, accountId: 1, debit: 633.36, credit: 0 },
  { journalEntryId: 100, accountId: 2, debit: 158.34, credit: 0 },
  { journalEntryId: 100, accountId: 3, debit: 0, credit: 791.70 },
];
const multiCleanTransactions = [{
  id: 2855,
  date: "2025-09-04",
  description: "JEM & FIX",
  amount: -791.70,
  accountRef: "6477",
  status: "afventer",
}];

test("finder den dokumenterede tværgående Jem & Fix-betaling", () => {
  const plan = findCrossCompanyJemFixRepairPlan({
    multiCleanTransactions,
    multiCleanAccounts,
    multiServiceEntries,
    multiServiceLines,
    multiServiceAccounts,
  });
  assert.equal(plan.safe, true);
  assert.equal(plan.bankTransactionId, 2855);
  assert.equal(plan.sourceEntryId, 100);
  assert.equal(plan.multiServicePrivateAccountId, 3);
  assert.equal(plan.multiServiceIntercompanyAccountId, 4);
  assert.equal(plan.multiCleanBankAccountId, 11);
  assert.equal(plan.multiCleanIntercompanyAccountId, 12);
});

test("afviser hvis SAF-T-posten ikke har den dokumenterede momsfordeling", () => {
  const plan = findCrossCompanyJemFixRepairPlan({
    multiCleanTransactions,
    multiCleanAccounts,
    multiServiceEntries,
    multiServiceLines: multiServiceLines.map((line) => line.accountId === 2 ? { ...line, debit: 158.35 } : line),
    multiServiceAccounts,
  });
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /50746/);
});

test("afviser hvis bankposten allerede er matchet", () => {
  const plan = findCrossCompanyJemFixRepairPlan({
    multiCleanTransactions: multiCleanTransactions.map((transaction) => ({ ...transaction, status: "matchet" })),
    multiCleanAccounts,
    multiServiceEntries,
    multiServiceLines,
    multiServiceAccounts,
  });
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /bankpost/);
});

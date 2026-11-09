import assert from "node:assert/strict";
import test from "node:test";
import { findSafeInterestPostings } from "../server/bank-interest-reconciliation";

const accounts = [
  { id: 10, accountNumber: "4310", name: "Renteindtægt, bank", type: "indtaegt", active: 1 },
  { id: 11, accountNumber: "5820", name: "Bankkonto", type: "aktiv", active: 1 },
  { id: 12, accountNumber: "5825", name: "Bank løn og moms", type: "aktiv", active: 1 },
];

test("finder kun positive, åbne renter på kendte bankkonti", () => {
  const rows = findSafeInterestPostings([
    { id: 1, date: "2025-09-30", description: "Interest", amount: 2.36, accountRef: "6477", status: "afventer" },
    { id: 2, date: "2025-09-30", description: "Rente", amount: 1.73, accountRef: "9507", status: "afventer" },
    { id: 3, date: "2025-09-30", description: "Interest", amount: -1.2, accountRef: "6477", status: "afventer" },
    { id: 4, date: "2025-09-30", description: "Overførselsservice", amount: 2.36, accountRef: "6477", status: "afventer" },
    { id: 5, date: "2025-09-30", description: "Interest", amount: 2.36, accountRef: "ukendt", status: "afventer" },
    { id: 6, date: "2025-09-30", description: "Interest", amount: 2.36, accountRef: "6477", status: "matchet" },
  ], accounts, []);

  assert.deepEqual(rows.map((row) => ({ id: row.transactionId, bank: row.bankAccountId, amount: row.amount })), [
    { id: 1, bank: 11, amount: 2.36 },
    { id: 2, bank: 12, amount: 1.73 },
  ]);
});

test("allerede bogførte renter og tvetydig rentekonto afvises", () => {
  const transaction = { id: 7, date: "2025-12-31", description: "Interest", amount: 0.37, accountRef: "6477", status: "afventer" };
  assert.deepEqual(findSafeInterestPostings([transaction], accounts, [{ sourceType: "bank_interest", sourceId: 7 }]), []);
  assert.deepEqual(findSafeInterestPostings([transaction], [...accounts, { ...accounts[0], id: 99 }], []), []);
});

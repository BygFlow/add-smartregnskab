import assert from "node:assert/strict";
import test from "node:test";
import { findSafePayableSettlements } from "../server/bank-payable-reconciliation";

const accounts = [
  { id: 55, accountNumber: "5820", name: "Bankkonto" },
  { id: 57, accountNumber: "6800", name: "Kreditorer" },
  { id: 119, accountNumber: "5825", name: "Bank løn og skat" },
  { id: 200, accountNumber: "2510", name: "Varekøb" },
];

const invoice = {
  id: 100,
  date: "2025-08-13",
  entryNumber: "ECON-100",
  description: "BAUHAUS DANMARK",
  sourceType: "economic_kladde",
  status: "bogført",
};

const invoiceLines = [
  { journalEntryId: 100, accountId: 200, description: "Bauhaus", debit: 1_511.37, credit: 0 },
  { journalEntryId: 100, accountId: 57, description: "Bauhaus", debit: 0, credit: 1_511.37 },
];

test("finder en entydig ubetalt kreditorpost og den rigtige bankkonto", () => {
  const matches = findSafePayableSettlements(
    [{ id: 10, date: "2025-08-14", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" }],
    [invoice],
    invoiceLines,
    accounts,
  );
  assert.deepEqual(matches, [{ transactionId: 10, invoiceJournalEntryId: 100, payableAccountId: 57, bankAccountId: 55, amount: 1_511.37 }]);
});

test("løn- og skattekonto 4483 føres mod konto 5825", () => {
  const matches = findSafePayableSettlements(
    [{ id: 11, date: "2025-08-14", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "4483" }],
    [invoice],
    invoiceLines,
    accounts,
  );
  assert.equal(matches[0]?.bankAccountId, 119);
});

test("springer en faktura over når kreditor allerede er udlignet", () => {
  const matches = findSafePayableSettlements(
    [{ id: 10, date: "2025-08-14", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" }],
    [invoice, { ...invoice, id: 101, date: "2025-08-14", description: "Betaling Bauhaus", sourceType: "bank" }],
    [...invoiceLines, { journalEntryId: 101, accountId: 57, debit: 1_511.37, credit: 0 }],
    accounts,
  );
  assert.deepEqual(matches, []);
});

test("accepterer dokumenteret leverandørbetaling op til 90 dage men ikke generisk tekst", () => {
  const matches = findSafePayableSettlements(
    [
      { id: 10, date: "2025-10-21", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" },
      { id: 11, date: "2025-10-21", description: "Overførsel", amount: -1_511.37, status: "afventer", accountRef: "0112" },
    ],
    [invoice],
    invoiceLines,
    accounts,
  );
  assert.deepEqual(matches.map((match) => match.transactionId), [10]);
});

test("afviser tvetydige fakturaer og gensidigt delt faktura", () => {
  const duplicateInvoice = { ...invoice, id: 101, entryNumber: "ECON-101" };
  const duplicateLines = invoiceLines.map((line) => ({ ...line, journalEntryId: 101 }));
  const matches = findSafePayableSettlements(
    [
      { id: 10, date: "2025-08-14", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" },
      { id: 11, date: "2025-08-15", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" },
    ],
    [invoice, duplicateInvoice],
    [...invoiceLines, ...duplicateLines],
    accounts,
  );
  assert.deepEqual(matches, []);
});

test("vælger den entydigt nærmeste gentagne månedsfaktura", () => {
  const olderInvoice = { ...invoice, id: 101, date: "2025-07-24", description: "Håndværker.dk" };
  const recentInvoice = { ...invoice, id: 102, date: "2025-08-08", description: "Håndværker.dk" };
  const repeatedLines = [olderInvoice, recentInvoice].flatMap((entry) => [
    { journalEntryId: entry.id, accountId: 200, description: "Håndværker.dk", debit: 1_360, credit: 0 },
    { journalEntryId: entry.id, accountId: 57, description: "Håndværker.dk", debit: 0, credit: 1_360 },
  ]);
  const matches = findSafePayableSettlements(
    [{ id: 12, date: "2025-08-09", description: "Haandvaerker.dk", amount: -1_360, status: "afventer", accountRef: "0112" }],
    [olderInvoice, recentInvoice],
    repeatedLines,
    accounts,
  );
  assert.deepEqual(matches.map((match) => match.invoiceJournalEntryId), [102]);
});

test("afviser gentagne fakturaer når nærmeste dato er uafgjort", () => {
  const before = { ...invoice, id: 101, date: "2025-08-08", description: "Håndværker.dk" };
  const after = { ...invoice, id: 102, date: "2025-08-10", description: "Håndværker.dk" };
  const repeatedLines = [before, after].flatMap((entry) => [
    { journalEntryId: entry.id, accountId: 200, description: "Håndværker.dk", debit: 1_360, credit: 0 },
    { journalEntryId: entry.id, accountId: 57, description: "Håndværker.dk", debit: 0, credit: 1_360 },
  ]);
  const matches = findSafePayableSettlements(
    [{ id: 12, date: "2025-08-09", description: "Haandvaerker.dk", amount: -1_360, status: "afventer", accountRef: "0112" }],
    [before, after],
    repeatedLines,
    accounts,
  );
  assert.deepEqual(matches, []);
});

test("afviser ukendt konto, forkert år og mere end 90 dages forskel", () => {
  const matches = findSafePayableSettlements(
    [
      { id: 10, date: "2025-12-01", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "ukendt" },
      { id: 11, date: "2024-08-14", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" },
      { id: 12, date: "2025-12-01", description: "Bauhaus", amount: -1_511.37, status: "afventer", accountRef: "0112" },
    ],
    [invoice],
    invoiceLines,
    accounts,
  );
  assert.deepEqual(matches, []);
});

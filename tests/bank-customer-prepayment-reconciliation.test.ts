import assert from "node:assert/strict";
import test from "node:test";
import { findSafeCustomerPrepayments } from "../server/bank-customer-prepayment-reconciliation";

const accounts = [
  { id: 95, accountNumber: "5600", active: 1 },
  { id: 96, accountNumber: "5820", active: 1 },
  { id: 97, accountNumber: "5825", active: 1 },
  { id: 400, accountNumber: "1010", active: 1 },
];

const invoice = {
  id: 545,
  date: "2025-07-16",
  entryNumber: "ECON-2025-20250716-202",
  description: "Kundefaktura 202",
  reference: "202",
  sourceType: "saft_import",
  status: "bogført",
};

const payment = {
  id: 588,
  date: "2025-07-16",
  entryNumber: "ECON-BETALING-202",
  description: "Betaling faktura 202",
  reference: "202",
  sourceType: "saft_import",
  status: "bogført",
};

const lines = [
  { journalEntryId: 545, accountId: 95, debit: 3_500, credit: 0 },
  { journalEntryId: 545, accountId: 400, debit: 0, credit: 3_500 },
  { journalEntryId: 588, accountId: 96, debit: 3_500, credit: 0 },
  { journalEntryId: 588, accountId: 95, debit: 0, credit: 3_500 },
];

const settledReceipt = {
  id: 2923,
  date: "2025-07-16",
  description: "FAKTURA202",
  amount: 3_500,
  accountRef: "6477",
  status: "matchet",
  matchedType: "journal_entry",
  matchedId: 588,
};

const extraReceipt = {
  id: 2922,
  date: "2025-07-16",
  description: "FAKTURA202",
  amount: 3_500,
  accountRef: "6477",
  status: "afventer",
};

test("finder en dokumenteret dobbeltbetaling til en allerede udlignet faktura", () => {
  assert.deepEqual(findSafeCustomerPrepayments(
    [extraReceipt, settledReceipt], [invoice, payment], lines, accounts,
  ), [{
    transactionId: 2922,
    invoiceJournalEntryId: 545,
    settledByJournalEntryId: 588,
    receivableAccountId: 95,
    bankAccountId: 96,
    amount: 3_500,
    invoiceReference: "202",
    date: "2025-07-16",
  }]);
});

test("accepterer formatet F: 242 og løn-/momskontoens bankmapping", () => {
  const otherInvoice = { ...invoice, id: 726, reference: "242" };
  const otherPayment = { ...payment, id: 740, reference: "242" };
  const otherLines = lines.map((line) => ({
    ...line,
    journalEntryId: line.journalEntryId === 545 ? 726 : 740,
    accountId: line.accountId === 96 ? 97 : line.accountId,
    debit: line.debit === 3_500 ? 11_418.75 : line.debit,
    credit: line.credit === 3_500 ? 11_418.75 : line.credit,
  }));
  const result = findSafeCustomerPrepayments([
    { ...extraReceipt, id: 2793, description: "F: 242", amount: 11_418.75, accountRef: "9507" },
    { ...settledReceipt, id: 2794, description: "F:242", amount: 11_418.75, accountRef: "9507", matchedId: 740 },
  ], [otherInvoice, otherPayment], otherLines, accounts);
  assert.equal(result[0]?.invoiceReference, "242");
  assert.equal(result[0]?.bankAccountId, 97);
});

test("afviser uklare, allerede behandlede, tilbagebetalte og ikke-udlignede indbetalinger", () => {
  const variants = [
    { ...extraReceipt, id: 1, description: "Overførsel" },
    { ...extraReceipt, id: 2, status: "matchet" },
    { ...extraReceipt, id: 3, date: "2024-07-16" },
    { ...extraReceipt, id: 4, accountRef: "ukendt" },
  ];
  assert.deepEqual(findSafeCustomerPrepayments(variants, [invoice, payment], lines, accounts), []);
  assert.deepEqual(findSafeCustomerPrepayments([
    extraReceipt,
    settledReceipt,
    { id: 3000, date: "2025-07-17", description: "Retur", amount: -3_500, accountRef: "6477", status: "afventer" },
  ], [invoice, payment], lines, accounts), []);
  assert.deepEqual(findSafeCustomerPrepayments([extraReceipt], [invoice, payment], lines, accounts), []);
});

test("afviser anden dato, tvetydig faktura, manglende banklinje og tidligere bogføring", () => {
  const anotherDay = { ...settledReceipt, date: "2025-07-17" };
  assert.deepEqual(findSafeCustomerPrepayments([extraReceipt, anotherDay], [invoice, payment], lines, accounts), []);
  assert.deepEqual(findSafeCustomerPrepayments(
    [extraReceipt, settledReceipt], [invoice, { ...invoice, id: 546 }, payment], [
      ...lines,
      { journalEntryId: 546, accountId: 95, debit: 3_500, credit: 0 },
    ], accounts,
  ), []);
  assert.deepEqual(findSafeCustomerPrepayments(
    [extraReceipt, settledReceipt], [invoice, payment], lines.filter((line) => !(line.journalEntryId === 588 && line.accountId === 96)), accounts,
  ), []);
  assert.deepEqual(findSafeCustomerPrepayments(
    [extraReceipt, settledReceipt], [invoice, payment, { ...payment, id: 900, sourceType: "bank_customer_prepayment", sourceId: 2922 }], lines, accounts,
  ), []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { findBankDocumentCandidates, findSafeBankDocumentMatches, normalizeBankDocumentType } from "../server/bank-document-match";

const tx = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  amount: -100,
  status: "afventer",
  matchedType: null,
  matchedId: null,
  ...overrides,
});

test("danske og engelske dokumenttyper normaliseres", () => {
  assert.equal(normalizeBankDocumentType("faktura"), "invoice");
  assert.equal(normalizeBankDocumentType("bilag"), "voucher");
  assert.equal(normalizeBankDocumentType("journal"), null);
});

test("bilag kræver udgående bankbeløb og præcist beløb i øre", () => {
  const vouchers = [
    { id: 10, voucherNumber: "B10", supplier: "Leverandør", date: "2025-06-11", amount: 100, status: "bogfoert" },
    { id: 11, voucherNumber: "B11", supplier: "Forkert beløb", date: "2025-06-11", amount: 100.01, status: "bogfoert" },
  ];
  assert.deepEqual(findBankDocumentCandidates(tx(), "voucher", [tx()], [], vouchers).map((row) => row.id), [10]);
  assert.deepEqual(findBankDocumentCandidates(tx({ amount: 100 }), "voucher", [tx({ amount: 100 })], [], vouchers), []);
});

test("faktura kræver indgående bankbeløb", () => {
  const invoices = [{ id: 20, invoiceNumber: "F20", issueDate: "2025-06-01", dueDate: "2025-06-15", totalAmount: 250, status: "sendt" }];
  assert.deepEqual(findBankDocumentCandidates(tx({ amount: 250 }), "invoice", [tx({ amount: 250 })], invoices, []).map((row) => row.id), [20]);
  assert.deepEqual(findBankDocumentCandidates(tx({ amount: -250 }), "invoice", [tx({ amount: -250 })], invoices, []), []);
});

test("et dokument der allerede er matchet kan ikke genbruges", () => {
  const transactions = [tx(), tx({ id: 2, matchedType: "bilag", matchedId: 10, status: "matchet" })];
  const vouchers = [{ id: 10, voucherNumber: "B10", supplier: "Leverandør", date: "2025-06-11", amount: 100, status: "bogfoert" }];
  assert.deepEqual(findBankDocumentCandidates(tx(), "voucher", transactions, [], vouchers), []);
});

test("flere dokumenter med samme beløb returneres til et eksplicit brugervalg", () => {
  const vouchers = [
    { id: 10, voucherNumber: "B10", supplier: "A", date: "2025-06-11", amount: 100, status: "bogfoert" },
    { id: 11, voucherNumber: "B11", supplier: "B", date: "2025-06-10", amount: 100, status: "bogfoert" },
  ];
  assert.deepEqual(findBankDocumentCandidates(tx(), "voucher", [tx()], [], vouchers).map((row) => row.id), [10, 11]);
});

test("auto-match kræver et eksplicit og entydigt fakturanummer", () => {
  const invoices = [
    { id: 20, invoiceNumber: "247", issueDate: "2025-10-20", dueDate: "2025-11-03", totalAmount: 3300, status: "sendt" },
  ];
  assert.deepEqual(findSafeBankDocumentMatches([
    tx({ id: 2, date: "2025-11-03", description: "FAKTURA 247", amount: 3300 }),
  ], invoices, []), [{ transactionId: 2, documentId: 20, type: "invoice" }]);
  assert.deepEqual(findSafeBankDocumentMatches([
    tx({ id: 2, date: "2025-11-03", description: "Kundeindbetaling", amount: 3300 }),
  ], invoices, []), []);
});

test("auto-match af bilag kræver leverandørnavn og højst fire dages afstand", () => {
  const vouchers = [
    { id: 10, voucherNumber: "B10", supplier: "Jem & Fix", date: "2025-11-01", amount: 339, status: "bogfoert" },
  ];
  assert.deepEqual(findSafeBankDocumentMatches([
    tx({ id: 2, date: "2025-11-02", description: "Jem & Fix", amount: -339 }),
  ], [], vouchers), [{ transactionId: 2, documentId: 10, type: "voucher" }]);
  assert.deepEqual(findSafeBankDocumentMatches([
    tx({ id: 2, date: "2025-11-10", description: "Jem & Fix", amount: -339 }),
  ], [], vouchers), []);
});

test("auto-match springer tvetydige dokumentbeløb over", () => {
  const invoices = [
    { id: 20, invoiceNumber: "202", issueDate: "2025-09-01", totalAmount: 3500, status: "sendt" },
  ];
  assert.deepEqual(findSafeBankDocumentMatches([
    tx({ id: 2, date: "2025-09-10", description: "FAKTURA 202", amount: 3500 }),
    tx({ id: 3, date: "2025-09-10", description: "FAKTURA 202", amount: 3500 }),
  ], invoices, []), []);
});

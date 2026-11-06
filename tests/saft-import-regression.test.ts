import assert from "node:assert/strict";
import test from "node:test";
import { parseSaft } from "../server/saft";

test("SAF-T import preserves voucher references and VAT codes", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:DK">
    <Header><AuditFileVersion>2.1</AuditFileVersion></Header>
    <MasterFiles><GeneralLedgerAccounts>
      <Account><AccountID>1010</AccountID><AccountDescription>Salg</AccountDescription><AccountType>Sale</AccountType></Account>
      <Account><AccountID>5600</AccountID><AccountDescription>Debitorer</AccountDescription><AccountType>Asset</AccountType></Account>
    </GeneralLedgerAccounts></MasterFiles>
    <GeneralLedgerEntries><Journal><Transaction>
      <TransactionID>ECON-2024-20240821-120</TransactionID><TransactionDate>2024-08-21</TransactionDate><Description>Faktura</Description>
      <Line><AccountID>1010</AccountID><SourceDocumentID>120</SourceDocumentID><Description>Salg</Description><CreditAmount><Amount>100.00</Amount></CreditAmount><TaxInformation><TaxCode>U25</TaxCode><TaxAmount><Amount>0.00</Amount></TaxAmount></TaxInformation></Line>
      <Line><AccountID>5600</AccountID><SourceDocumentID>120</SourceDocumentID><Description>Debitor</Description><DebitAmount><Amount>100.00</Amount></DebitAmount></Line>
    </Transaction></Journal></GeneralLedgerEntries>
  </AuditFile>`;

  const preview = parseSaft(xml);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.entries[0].reference, "120");
  assert.equal(preview.entries[0].lines[0].vatCode, "U25");
  assert.equal(preview.accounts.find((account) => account.accountNumber === "1010")?.vatCode, "U25");
});

import { XMLParser } from "fast-xml-parser";
import { and, eq } from "drizzle-orm";
import { db } from "./storage";
import { accounts, companies, journalEntries, journalLines } from "@shared/schema";

export const SAFT_VERSION = "2.1";
export const STANDARD_ACCOUNT_VERSION = "20260101";
const NS = "urn:StandardAuditFile-Taxation-Financial:DK";

type Row = Record<string, any>;
type ImportPreview = {
  version: string;
  accounts: Array<{ accountNumber: string; name: string; standardAccountNumber?: string; type: string }>;
  entries: Array<{ entryNumber: string; date: string; description: string; createdBy?: string; lines: Array<{ accountNumber: string; description: string; debit: number; credit: number }> }>;
  totalDebit: number;
  totalCredit: number;
  errors: string[];
};

const arr = <T>(value: T | T[] | undefined | null): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
const esc = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const money = (value: unknown) => Number(value || 0).toFixed(2);
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? "")) ? String(value).slice(0, 10) : "";
const accountType = (type: string) => ({ aktiv: "Asset", passiv: "Liability", indtaegt: "Sale", udgift: "Expense" }[type] ?? "Other");
const internalAccountType = (type: string) => ({ Asset: "aktiv", Liability: "passiv", Sale: "indtaegt", Expense: "udgift" }[type] ?? "mellemregning");

function addressParts(address: string | null | undefined) {
  const raw = String(address ?? "").trim();
  const postal = raw.match(/(?:,\s*)?(\d{4})\s+([^,]+)$/);
  if (!postal) return null;
  const street = raw.slice(0, postal.index).replace(/,\s*$/, "").trim();
  return street ? { street, postalCode: postal[1], city: postal[2].trim() } : null;
}

function amountXml(kind: "DebitAmount" | "CreditAmount", value: number, currency: string) {
  return `<${kind}><Amount>${money(value)}</Amount><CurrencyCode>${esc(currency)}</CurrencyCode><CurrencyAmount>${money(value)}</CurrencyAmount><ExchangeRate>1.000000</ExchangeRate></${kind}>`;
}

export function saftPreflight(company: Row | undefined, accountRows: Row[], entryRows: Row[], lineRows: Row[]) {
  const errors: string[] = [];
  if (!company) errors.push("Virksomheden findes ikke.");
  if (!/^\d{8}$/.test(String(company?.cvr ?? "").replace(/\D/g, ""))) errors.push("CVR-nummer skal bestå af 8 cifre.");
  if (!addressParts(company?.address)) errors.push("Adresse skal indeholde vej, 4-cifret postnummer og by.");
  if (!company?.iban && !company?.bankAccount) errors.push("IBAN eller bankkonto skal udfyldes på virksomheden.");
  if (!accountRows.length) errors.push("Kontoplanen er tom.");
  const unmapped = accountRows.filter((account) => account.active !== 0 && !String(account.standardAccountNumber || "").trim());
  if (unmapped.length) errors.push(`${unmapped.length} aktiv(e) konto/konti mangler mapping til den fællesoffentlige standardkontoplan.`);
  const accountIds = new Set(accountRows.map((a) => a.id));
  for (const line of lineRows) if (!accountIds.has(line.accountId)) errors.push(`Posteringslinje ${line.id} henviser til en ukendt konto.`);
  for (const entry of entryRows) {
    const lines = lineRows.filter((line) => line.journalEntryId === entry.id);
    if (!lines.length) errors.push(`Postering ${entry.entryNumber} har ingen linjer.`);
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    if (Math.abs(debit - credit) > 0.005) errors.push(`Postering ${entry.entryNumber} balancerer ikke (${money(debit)} / ${money(credit)}).`);
  }
  return Array.from(new Set(errors));
}

export async function generateSaft(companyId: number, startDate: string, endDate: string, userId: string) {
  if (!isoDate(startDate) || !isoDate(endDate) || startDate > endDate) throw new Error("Vælg en gyldig fra- og til-dato.");
  const company = db.select().from(companies).where(eq(companies.id, companyId)).get() as Row | undefined;
  const accountRows = db.select().from(accounts).where(eq(accounts.companyId, companyId)).all() as Row[];
  const allEntries = db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId)).all() as Row[];
  const posted = allEntries.filter((entry) => ["bogført", "bogfort", "afstemt"].includes(entry.status));
  const selectedEntries = posted.filter((entry) => entry.date >= startDate && entry.date <= endDate).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const allLines = db.select().from(journalLines).where(eq(journalLines.companyId, companyId)).all() as Row[];
  const selectedIds = new Set(selectedEntries.map((entry) => entry.id));
  const selectedLines = allLines.filter((line) => selectedIds.has(line.journalEntryId));
  const errors = saftPreflight(company, accountRows, selectedEntries, selectedLines);
  if (errors.length) throw new Error(errors.join(" "));

  const currency = String(company!.currency || "DKK").toUpperCase();
  const address = addressParts(company!.address)!;
  const cvr = String(company!.cvr).replace(/\D/g, "");
  const beforeIds = new Set(posted.filter((entry) => entry.date < startDate).map((entry) => entry.id));
  const throughIds = new Set(posted.filter((entry) => entry.date <= endDate).map((entry) => entry.id));
  const balance = (accountId: number, ids: Set<number>) => allLines
    .filter((line) => line.accountId === accountId && ids.has(line.journalEntryId))
    .reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
  const balanceXml = (prefix: "Opening" | "Closing", value: number) => value >= 0
    ? `<${prefix}DebitBalance>${money(value)}</${prefix}DebitBalance>`
    : `<${prefix}CreditBalance>${money(Math.abs(value))}</${prefix}CreditBalance>`;
  const bankXml = company!.iban
    ? `<IBANNumber>${esc(String(company!.iban).replace(/\s/g, ""))}</IBANNumber>${company!.swift ? `<BIC>${esc(company!.swift)}</BIC>` : ""}`
    : (() => { const digits = String(company!.bankAccount).replace(/\D/g, ""); return `<BankAccountNumber>${esc(digits.slice(4))}</BankAccountNumber><SortCode>${esc(digits.slice(0, 4))}</SortCode>`; })();

  const accountXml = accountRows.map((account) => {
    const opening = balance(account.id, beforeIds);
    const closing = balance(account.id, throughIds);
    return `<Account><AccountID>${esc(account.accountNumber)}</AccountID><AccountDescription>${esc(account.name)}</AccountDescription>${account.standardAccountNumber ? `<StandardAccountID>${esc(account.standardAccountNumber)}</StandardAccountID>` : ""}<AccountType>${accountType(account.type)}</AccountType>${isoDate(account.createdAt) ? `<AccountCreationDate>${isoDate(account.createdAt)}</AccountCreationDate>` : ""}${balanceXml("Opening", opening)}${balanceXml("Closing", closing)}</Account>`;
  }).join("");

  let totalDebit = 0;
  let totalCredit = 0;
  const transactions = selectedEntries.map((entry) => {
    const lines = selectedLines.filter((line) => line.journalEntryId === entry.id);
    const lineXml = lines.map((line, index) => {
      const account = accountRows.find((item) => item.id === line.accountId)!;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      totalDebit += debit;
      totalCredit += credit;
      return `<Line><RecordID>${esc(`${entry.id}-${index + 1}`)}</RecordID><AccountID>${esc(account.accountNumber)}</AccountID>${entry.reference ? `<SourceDocumentID>${esc(entry.reference)}</SourceDocumentID>` : ""}<Description>${esc(line.description || entry.description)}</Description>${debit > 0 ? amountXml("DebitAmount", debit, currency) : amountXml("CreditAmount", credit, currency)}</Line>`;
    }).join("");
    const date = isoDate(entry.date);
    const created = isoDate(entry.createdAt) || date;
    return `<Transaction><TransactionID>${esc(entry.entryNumber)}</TransactionID><Period>${Number(date.slice(5, 7))}</Period><PeriodYear>${Number(date.slice(0, 4))}</PeriodYear><TransactionDate>${date}</TransactionDate>${entry.createdBy ? `<SourceID>${esc(entry.createdBy)}</SourceID>` : ""}<TransactionType>${esc(entry.sourceType || "normal")}</TransactionType><Description>${esc(entry.description)}</Description><SystemEntryDate>${created}</SystemEntryDate><GLPostingDate>${date}</GLPostingDate><SystemID>${esc(String(entry.id))}</SystemID>${lineXml}</Transaction>`;
  }).join("");

  const created = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Header><AuditFileVersion>${SAFT_VERSION}</AuditFileVersion><AuditFileCountry>DK</AuditFileCountry><AuditFileDateCreated>${created}</AuditFileDateCreated><SoftwareCompanyName>ADD Multiservice ApS</SoftwareCompanyName><SoftwareID>ADD SmartRegnskab</SoftwareID><SoftwareVersion>3.2.1</SoftwareVersion><Company><CVR>${cvr}</CVR><Name>${esc(company!.name)}</Name><Address><StreetName>${esc(address.street)}</StreetName><City>${esc(address.city)}</City><PostalCode>${address.postalCode}</PostalCode><Country>DK</Country><AddressType>StreetAddress</AddressType></Address>${company!.phone || company!.email ? `<Contact>${company!.phone ? `<Telephone>${esc(company!.phone)}</Telephone>` : ""}${company!.email ? `<Email>${esc(company!.email)}</Email>` : ""}</Contact>` : ""}<TaxRegistration><TaxRegistrationNumber>DK${cvr}</TaxRegistrationNumber><TaxType>VAT</TaxType><TaxAuthority>Skattestyrelsen</TaxAuthority><Country>DK</Country></TaxRegistration><BankAccount>${bankXml}<CurrencyCode>${currency}</CurrencyCode></BankAccount></Company><DefaultCurrencyCode>${currency}</DefaultCurrencyCode><SelectionCriteria><CompanyEntity>${esc(company!.name)}</CompanyEntity><SelectionStartDate>${startDate}</SelectionStartDate><SelectionEndDate>${endDate}</SelectionEndDate><PeriodStart>${Number(startDate.slice(5, 7))}</PeriodStart><PeriodStartYear>${Number(startDate.slice(0, 4))}</PeriodStartYear><PeriodEnd>${Number(endDate.slice(5, 7))}</PeriodEnd><PeriodEndYear>${Number(endDate.slice(0, 4))}</PeriodEndYear></SelectionCriteria><HeaderComment>Genereret af ADD SmartRegnskab</HeaderComment><TaxAccountingBasis>Regnskabsdata</TaxAccountingBasis><TaxEntity>${cvr}</TaxEntity><UserID>${esc(userId)}</UserID></Header><MasterFiles><GeneralLedgerAccounts><NameOfStandardAccount>Standardkontoplanen</NameOfStandardAccount><VersionOfStandardAccount>${STANDARD_ACCOUNT_VERSION}</VersionOfStandardAccount>${accountXml}</GeneralLedgerAccounts></MasterFiles><GeneralLedgerEntries><NumberOfEntries>${selectedEntries.length}</NumberOfEntries><TotalDebit>${money(totalDebit)}</TotalDebit><TotalCredit>${money(totalCredit)}</TotalCredit><Journal><JournalID>GL</JournalID><Description>Finanskladde</Description><Type>GL</Type>${transactions}</Journal></GeneralLedgerEntries></AuditFile>`;
  return { xml: xml.replace("<SoftwareCompanyName>ADD Multiservice ApS</SoftwareCompanyName>", "<SoftwareCompanyName>ADD MultiService ApS</SoftwareCompanyName>").replace("<SoftwareVersion>3.2.1</SoftwareVersion>", "<SoftwareVersion>3.4.0</SoftwareVersion>"), filename: `SAF-T-${cvr}-${startDate}-${endDate}.xml`, summary: { version: SAFT_VERSION, accounts: accountRows.length, entries: selectedEntries.length, lines: selectedLines.length, totalDebit, totalCredit } };
}

export function parseSaft(xml: string): ImportPreview {
  const errors: string[] = [];
  if (Buffer.byteLength(xml, "utf8") > 25 * 1024 * 1024) throw new Error("SAF-T-filen må højst være 25 MB.");
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false, numberParseOptions: { leadingZeros: false, hex: false } });
  let root: any;
  try { root = parser.parse(xml)?.AuditFile; } catch { throw new Error("XML-filen kunne ikke læses."); }
  if (!root?.Header || !root?.MasterFiles) throw new Error("Filen er ikke en gyldig dansk SAF-T-fil.");
  const version = String(root.Header.AuditFileVersion ?? "");
  if (!["2.0", "2.1"].includes(version)) errors.push(`SAF-T-version ${version || "mangler"} understøttes ikke. Brug 2.0 eller 2.1.`);
  const accountNodes = arr(root.MasterFiles?.GeneralLedgerAccounts).flatMap((ledger: any) => arr(ledger?.Account));
  const importedAccounts = accountNodes.map((account: any) => ({
    accountNumber: String(account.AccountID ?? "").trim(), name: String(account.AccountDescription ?? "").trim(),
    standardAccountNumber: account.StandardAccountID ? String(account.StandardAccountID) : undefined,
    type: internalAccountType(String(account.AccountType ?? "Other")),
  })).filter((account) => account.accountNumber && account.name);
  const entries = arr(root.GeneralLedgerEntries?.Journal).flatMap((journal: any) => arr(journal.Transaction)).map((transaction: any) => {
    const lines = arr(transaction.Line).map((line: any) => ({
      accountNumber: String(line.AccountID ?? "").trim(), description: String(line.Description ?? transaction.Description ?? "SAF-T-import"),
      debit: Number(line.DebitAmount?.Amount ?? 0), credit: Number(line.CreditAmount?.Amount ?? 0),
    }));
    return { entryNumber: String(transaction.TransactionID ?? "").trim(), date: isoDate(transaction.TransactionDate), description: String(transaction.Description ?? "SAF-T-import"), createdBy: transaction.SourceID ? String(transaction.SourceID) : undefined, lines };
  });
  for (const entry of entries) {
    if (!entry.entryNumber || !entry.date || !entry.lines.length) errors.push("En transaktion mangler nummer, dato eller linjer.");
    const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(debit - credit) > 0.005) errors.push(`Transaktion ${entry.entryNumber || "uden nummer"} balancerer ikke.`);
  }
  const accountNumbers = new Set(importedAccounts.map((account) => account.accountNumber));
  for (const line of entries.flatMap((entry) => entry.lines)) if (!accountNumbers.has(line.accountNumber)) errors.push(`Konto ${line.accountNumber || "mangler"} findes ikke i SAF-T-kontoplanen.`);
  const totalDebit = entries.flatMap((entry) => entry.lines).reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = entries.flatMap((entry) => entry.lines).reduce((sum, line) => sum + line.credit, 0);
  return { version, accounts: importedAccounts, entries, totalDebit, totalCredit, errors: Array.from(new Set(errors)) };
}

export function commitSaftImport(companyId: number, preview: ImportPreview) {
  if (preview.errors.length) throw new Error(preview.errors.join(" "));
  let accountsCreated = 0;
  let entriesCreated = 0;
  db.transaction((tx) => {
    const existingAccounts = tx.select().from(accounts).where(eq(accounts.companyId, companyId)).all();
    const byNumber = new Map(existingAccounts.map((account) => [account.accountNumber, account]));
    for (const account of preview.accounts) {
      if (!byNumber.has(account.accountNumber)) {
        const created = tx.insert(accounts).values({ ...account, companyId, balance: 0, active: 1, createdAt: new Date().toISOString() }).returning().get();
        byNumber.set(account.accountNumber, created);
        accountsCreated++;
      }
    }
    for (const entry of preview.entries) {
      const exists = tx.select().from(journalEntries).where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.entryNumber, entry.entryNumber))).get();
      if (exists) continue;
      const created = tx.insert(journalEntries).values({ companyId, entryNumber: entry.entryNumber, date: entry.date, description: entry.description, sourceType: "saft_import", status: "bogført", createdBy: entry.createdBy || "SAF-T", createdAt: new Date().toISOString() }).returning().get();
      for (const line of entry.lines) tx.insert(journalLines).values({ companyId, journalEntryId: created.id, accountId: byNumber.get(line.accountNumber)!.id, description: line.description, debit: line.debit, credit: line.credit }).run();
      entriesCreated++;
    }
  });
  return { accountsCreated, entriesCreated };
}

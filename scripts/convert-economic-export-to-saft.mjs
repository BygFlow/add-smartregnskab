import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { XMLParser } from "fast-xml-parser";

const NS = "urn:StandardAuditFile-Taxation-Financial:DK";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = String(text).replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parseDanishNumber(value) {
  const normalized = String(value ?? "").trim().replaceAll(".", "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`Ugyldigt beløb: ${value}`);
  return Math.round(number * 100) / 100;
}

function isoDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) throw new Error(`Ugyldig dato: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function amountXml(kind, value) {
  return `<${kind}><Amount>${money(value)}</Amount><CurrencyCode>DKK</CurrencyCode><CurrencyAmount>${money(value)}</CurrencyAmount><ExchangeRate>1.000000</ExchangeRate></${kind}>`;
}

function balanceXml(prefix, value) {
  return value >= 0
    ? `<${prefix}DebitBalance>${money(value)}</${prefix}DebitBalance>`
    : `<${prefix}CreditBalance>${money(Math.abs(value))}</${prefix}CreditBalance>`;
}

function accountType(account) {
  if (account.Type === "1") return account.DebetKredit === "Kredit" ? "Sale" : "Expense";
  if (account.Type === "2") return account.DebetKredit === "Kredit" ? "Liability" : "Asset";
  throw new Error(`Konto ${account.KontoNr} (${account.Navn}) er ikke en bogføringskonto.`);
}

function companyHeader(sourceXml) {
  const parser = new XMLParser({ removeNSPrefix: true, processEntities: false, numberParseOptions: { leadingZeros: false, hex: false } });
  const header = parser.parse(sourceXml)?.AuditFile?.Header;
  const company = header?.Company || {};
  const address = company.Address || {};
  const contact = company.Contact || {};
  const registration = String(company.RegistrationNumber || company.CVR || "").replace(/\D/g, "");
  return {
    created: String(header?.AuditFileDateCreated || new Date().toISOString().slice(0, 10)),
    registration,
    name: String(company.Name || "Ukendt virksomhed"),
    street: [address.StreetName, address.Number].filter(Boolean).join(" "),
    city: String(address.City || ""),
    postalCode: String(address.PostalCode || ""),
    phone: String(contact.Telephone || ""),
    email: String(contact.Email || ""),
  };
}

export async function convertEconomicExportToSaft(sourceDirectory, options = {}) {
  const read = async (name) => {
    const contents = await readFile(resolve(sourceDirectory, name));
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(contents);
    } catch {
      return new TextDecoder("windows-1252").decode(contents);
    }
  };
  const [accountText, postingText, vatText, sourceSaft] = await Promise.all([
    read("Konto.csv"),
    read("Postering.csv"),
    read("MomsKode.csv"),
    read("SAF-T.xml"),
  ]);
  const allAccounts = parseCsv(accountText);
  const allPostings = parseCsv(postingText).map((posting) => ({
    ...posting,
    isoDate: isoDate(posting.Dato),
    amount: parseDanishNumber(posting.BeloebDKK),
    vatCode: String(posting.MomsKode || "").trim().slice(0, 9),
  }));
  const requestedYear = options.year == null ? null : String(options.year).trim();
  if (requestedYear && !/^\d{4}$/.test(requestedYear)) {
    throw new Error(`Ugyldigt regnskabsår: ${options.year}.`);
  }
  const postings = requestedYear
    ? allPostings.filter((posting) => posting.isoDate.startsWith(`${requestedYear}-`))
    : allPostings;
  if (!postings.length) throw new Error("Postering.csv indeholder ingen posteringer.");
  const postingDates = postings.map((posting) => posting.isoDate).sort();
  const fiscalYears = [...new Set(postingDates.map((date) => date.slice(0, 4)))];
  if (fiscalYears.length !== 1) {
    throw new Error(`Eksporten skal indeholde præcis ét regnskabsår, men indeholder: ${fiscalYears.join(", ")}.`);
  }
  const fiscalYear = fiscalYears[0];
  const firstDate = postingDates[0];
  const lastDate = postingDates.at(-1);

  const usedNumbers = new Set(postings.map((posting) => posting.KontoNr));
  const accounts = allAccounts.filter((account) => usedNumbers.has(account.KontoNr));
  const foundNumbers = new Set(accounts.map((account) => account.KontoNr));
  const missingAccounts = [...usedNumbers].filter((number) => !foundNumbers.has(number));
  if (missingAccounts.length) throw new Error(`Konti mangler i Konto.csv: ${missingAccounts.join(", ")}`);

  const groups = new Map();
  for (const posting of postings) {
    const key = `${posting.isoDate}|${posting.BilagsNr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(posting);
  }
  const transactions = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (const [key, lines] of transactions) {
    const balance = lines.reduce((sum, line) => sum + line.amount, 0);
    if (Math.abs(balance) > 0.005) throw new Error(`Bilag ${key} balancerer ikke (${money(balance)}).`);
  }

  const vatRows = parseCsv(vatText);
  const vatByCode = new Map(vatRows.map((row) => [String(row.MomsKode || "").trim(), row]));
  const vatCodes = [...new Set(postings.map((posting) => posting.vatCode).filter(Boolean))].sort();
  const taxTable = vatCodes.map((code) => {
    const row = vatByCode.get(code);
    return `<TaxCodeDetails><TaxCode>${esc(code)}</TaxCode><EffectiveDate>1900-01-01</EffectiveDate><Description>${esc(row?.MomsNavn || `Momskode ${code}`)}</Description><TaxPercentage>${money(parseDanishNumber(row?.MomsSats || 0))}</TaxPercentage><Country>DK</Country></TaxCodeDetails>`;
  }).join("");

  const accountXml = accounts.sort((a, b) => Number(a.KontoNr) - Number(b.KontoNr)).map((account) => {
    const balance = postings.filter((posting) => posting.KontoNr === account.KontoNr).reduce((sum, posting) => sum + posting.amount, 0);
    return `<Account><AccountID>${esc(account.KontoNr)}</AccountID><AccountDescription>${esc(account.Navn)}</AccountDescription><AccountType>${accountType(account)}</AccountType><OpeningDebitBalance>0.00</OpeningDebitBalance>${balanceXml("Closing", balance)}</Account>`;
  }).join("");

  let totalDebit = 0;
  let totalCredit = 0;
  const transactionXml = transactions.map(([key, lines]) => {
    const [date, voucherNumber] = key.split("|");
    const descriptions = [...new Set(lines.map((line) => String(line.Tekst || "").trim()).filter(Boolean))];
    const description = descriptions.join(" / ").slice(0, 250) || `Bilag ${voucherNumber}`;
    const lineXml = lines.sort((a, b) => Number(a.LoebeNr) - Number(b.LoebeNr)).map((line) => {
      const debit = line.amount > 0 ? line.amount : 0;
      const credit = line.amount < 0 ? Math.abs(line.amount) : 0;
      totalDebit += debit;
      totalCredit += credit;
      const amount = debit > 0 ? amountXml("DebitAmount", debit) : amountXml("CreditAmount", credit);
      const tax = line.vatCode
        ? `<TaxInformation><TaxType>VAT</TaxType><TaxCode>${esc(line.vatCode)}</TaxCode><TaxAmount><Amount>0.00</Amount><CurrencyCode>DKK</CurrencyCode><CurrencyAmount>0.00</CurrencyAmount><ExchangeRate>1.000000</ExchangeRate></TaxAmount></TaxInformation>`
        : "";
      return `<Line><RecordID>${esc(line.LoebeNr)}</RecordID><AccountID>${esc(line.KontoNr)}</AccountID><SourceDocumentID>${esc(voucherNumber)}</SourceDocumentID><Description>${esc(line.Tekst || description)}</Description>${amount}${tax}</Line>`;
    }).join("");
    const transactionId = `ECON-${date.slice(0, 4)}-${date.replaceAll("-", "")}-${voucherNumber}`;
    return `<Transaction><TransactionID>${esc(transactionId)}</TransactionID><Period>${Number(date.slice(5, 7))}</Period><PeriodYear>${Number(date.slice(0, 4))}</PeriodYear><TransactionDate>${date}</TransactionDate><SourceID>e-conomic</SourceID><TransactionType>migration</TransactionType><Description>${esc(description)}</Description><SystemEntryDate>${date}</SystemEntryDate><GLPostingDate>${date}</GLPostingDate><SystemID>${esc(transactionId)}</SystemID>${lineXml}</Transaction>`;
  }).join("");

  const company = companyHeader(sourceSaft);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Header><AuditFileVersion>2.1</AuditFileVersion><AuditFileCountry>DK</AuditFileCountry><AuditFileDateCreated>${esc(company.created)}</AuditFileDateCreated><SoftwareCompanyName>e-conomic / ADD SmartRegnskab migrering</SoftwareCompanyName><SoftwareID>ADD SmartRegnskab</SoftwareID><SoftwareVersion>3.16.4</SoftwareVersion><Company><CVR>${esc(company.registration)}</CVR><Name>${esc(company.name)}</Name><Address><StreetName>${esc(company.street)}</StreetName><City>${esc(company.city)}</City><PostalCode>${esc(company.postalCode)}</PostalCode><Country>DK</Country><AddressType>StreetAddress</AddressType></Address><Contact>${company.phone ? `<Telephone>${esc(company.phone)}</Telephone>` : ""}${company.email ? `<Email>${esc(company.email)}</Email>` : ""}</Contact><TaxRegistration><TaxRegistrationNumber>DK${esc(company.registration)}</TaxRegistrationNumber><TaxType>VAT</TaxType><TaxAuthority>Skattestyrelsen</TaxAuthority><Country>DK</Country></TaxRegistration></Company><DefaultCurrencyCode>DKK</DefaultCurrencyCode><SelectionCriteria><CompanyEntity>${esc(company.name)}</CompanyEntity><SelectionStartDate>${firstDate}</SelectionStartDate><SelectionEndDate>${lastDate}</SelectionEndDate><PeriodStart>${Number(firstDate.slice(5, 7))}</PeriodStart><PeriodStartYear>${firstDate.slice(0, 4)}</PeriodStartYear><PeriodEnd>${Number(lastDate.slice(5, 7))}</PeriodEnd><PeriodEndYear>${lastDate.slice(0, 4)}</PeriodEndYear></SelectionCriteria><HeaderComment>Konverteret sikkert fra e-conomic eksport. Kildedata er ikke ændret.</HeaderComment><TaxAccountingBasis>Regnskabsdata</TaxAccountingBasis><TaxEntity>${esc(company.registration)}</TaxEntity><UserID>e-conomic</UserID></Header><MasterFiles><GeneralLedgerAccounts><NameOfStandardAccount>Kontoplan</NameOfStandardAccount><VersionOfStandardAccount>20260101</VersionOfStandardAccount>${accountXml}</GeneralLedgerAccounts><TaxTable><TaxTableEntry><TaxType>VAT</TaxType><Description>Moms</Description>${taxTable}</TaxTableEntry></TaxTable></MasterFiles><GeneralLedgerEntries><NumberOfEntries>${transactions.length}</NumberOfEntries><TotalDebit>${money(totalDebit)}</TotalDebit><TotalCredit>${money(totalCredit)}</TotalCredit><Journal><JournalID>ECONOMIC-${fiscalYear}</JournalID><Description>e-conomic ${fiscalYear}</Description><Type>GL</Type>${transactionXml}</Journal></GeneralLedgerEntries></AuditFile>`;
  return {
    xml,
    summary: {
      company: company.name,
      cvr: company.registration,
      accounts: accounts.length,
      entries: transactions.length,
      lines: postings.length,
      totalDebit,
      totalCredit,
      firstDate,
      lastDate,
      vatCodes,
    },
  };
}

async function main() {
  const sourceDirectory = process.argv[2];
  const outputFile = process.argv[3];
  const yearFlagIndex = process.argv.indexOf("--year");
  const year = yearFlagIndex >= 0 ? process.argv[yearFlagIndex + 1] : undefined;
  if (!sourceDirectory || !outputFile || (yearFlagIndex >= 0 && !year)) {
    throw new Error("Brug: node scripts/convert-economic-export-to-saft.mjs <udpakket mappe> <output.xml> [--year ÅÅÅÅ]");
  }
  const result = await convertEconomicExportToSaft(sourceDirectory, { year });
  await writeFile(resolve(outputFile), result.xml, "utf8");
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export type MigrationSource = "economic" | "dinero" | "billy" | "excel" | "csv";
export type MigrationEntity = "customers" | "suppliers" | "accounts";

type ImportRow = Record<string, string | number | boolean | null>;

const aliases: Record<MigrationEntity, Record<string, string[]>> = {
  customers: {
    name: ["name", "navn", "kundenavn", "customername", "contactname"],
    customerNumber: ["customernumber", "kundenummer", "kundeno", "number"],
    cvr: ["cvr", "cvrnummer", "vatnumber", "vatno"],
    ean: ["ean", "gl", "gln", "eannummer"],
    address: ["address", "adresse", "street", "vej"],
    phone: ["phone", "telefon", "phonenumber"],
    email: ["email", "mail", "contactemail"],
    invoiceEmail: ["invoiceemail", "fakturaemail", "billingemail"],
    contactPerson: ["contactperson", "kontaktperson", "att"],
    paymentTerms: ["paymentterms", "betalingsbetingelser", "terms"],
  },
  suppliers: {
    name: ["name", "navn", "leverandoernavn", "leverandørnavn", "suppliername"],
    supplierNumber: ["suppliernumber", "leverandoernummer", "leverandørnummer", "number"],
    cvr: ["cvr", "cvrnummer", "vatnumber", "vatno"],
    ean: ["ean", "gl", "gln", "eannummer"],
    address: ["address", "adresse", "street", "vej"],
    phone: ["phone", "telefon", "phonenumber"],
    email: ["email", "mail", "contactemail"],
    invoiceEmail: ["invoiceemail", "fakturaemail", "billingemail"],
    contactPerson: ["contactperson", "kontaktperson", "att"],
    paymentTerms: ["paymentterms", "betalingsbetingelser", "terms"],
    bankAccount: ["bankaccount", "bankkonto", "kontonummer"],
  },
  accounts: {
    accountNumber: ["accountnumber", "kontonummer", "accountno", "konto", "number"],
    standardAccountNumber: ["standardaccountnumber", "standardkontonummer", "standardkonto"],
    name: ["name", "navn", "kontonavn", "accountname"],
    type: ["type", "kontotype", "accounttype"],
    vatCode: ["vatcode", "momskode", "moms", "vattype"],
    balance: ["balance", "saldo", "openingbalance", "aabningssaldo"],
    active: ["active", "aktiv", "enabled"],
  },
};

function normalizedHeader(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  return candidates.map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ";";
}

function parseDelimited(content: string): string[][] {
  const clean = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(clean.split("\n", 1)[0] || "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === '"') {
      if (quoted && clean[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if (ch === "\n" && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("CSV-filen indeholder et uafsluttet anførselstegn.");
  return rows;
}

function asNumber(value: string): number {
  const cleaned = value.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapAccountType(value: string): string {
  const type = normalizedHeader(value);
  if (["revenue", "income", "indtaegt", "salg"].includes(type)) return "indtaegt";
  if (["expense", "cost", "udgift", "omkostning"].includes(type)) return "udgift";
  if (["liability", "equity", "passiv", "gaeld"].includes(type)) return "passiv";
  if (["clearing", "mellemregning"].includes(type)) return "mellemregning";
  return "aktiv";
}

export function previewImport(content: string, entity: MigrationEntity) {
  if (!content.trim()) throw new Error("Indsæt indholdet fra en CSV-fil.");
  if (Buffer.byteLength(content, "utf8") > 5 * 1024 * 1024) throw new Error("Filen må højst fylde 5 MB.");
  const matrix = parseDelimited(content);
  if (matrix.length < 2) throw new Error("Filen skal indeholde en overskriftsrække og mindst én datarække.");
  if (matrix.length > 20_001) throw new Error("En import må højst indeholde 20.000 datarækker.");
  const headers = matrix[0].map(normalizedHeader);
  const mapping = aliases[entity];
  const matched = Object.fromEntries(Object.entries(mapping).map(([field, names]) => [field, headers.findIndex((header) => names.map(normalizedHeader).includes(header))]));
  const required = entity === "accounts" ? ["accountNumber", "name"] : ["name"];
  const missing = required.filter((field) => matched[field] < 0);
  if (missing.length) throw new Error(`Påkrævede kolonner mangler: ${missing.join(", ")}.`);
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (let index = 1; index < matrix.length; index += 1) {
    const source = matrix[index];
    const output: ImportRow = {};
    for (const [field, column] of Object.entries(matched)) if (column >= 0 && source[column]?.trim()) output[field] = source[column].trim();
    const rowNumber = index + 1;
    if (!output.name) { errors.push(`Række ${rowNumber}: navn mangler.`); continue; }
    if (entity === "accounts") {
      if (!output.accountNumber) { errors.push(`Række ${rowNumber}: kontonummer mangler.`); continue; }
      output.type = mapAccountType(String(output.type || "aktiv"));
      output.balance = asNumber(String(output.balance || "0"));
      output.active = !["0", "false", "nej", "no"].includes(normalizedHeader(String(output.active ?? "true")));
      if (output.standardAccountNumber && !/^\d{4}$/.test(String(output.standardAccountNumber))) errors.push(`Række ${rowNumber}: standardkontonummer skal være 4 cifre.`);
    }
    const key = entity === "accounts" ? String(output.accountNumber).toLowerCase() : String(output.cvr || output.email || output.name).toLowerCase();
    if (seen.has(key)) { errors.push(`Række ${rowNumber}: dublet i filen (${key}).`); continue; }
    seen.add(key);
    rows.push(output);
  }
  return { rows, errors, totalRows: matrix.length - 1, validRows: rows.length, matchedFields: Object.keys(matched).filter((field) => matched[field] >= 0), sample: rows.slice(0, 5) };
}

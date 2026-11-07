export type MigrationSource = "economic" | "dinero" | "billy" | "excel" | "csv";
export type MigrationEntity = "customers" | "suppliers" | "accounts" | "journal_entries";

type ImportRow = Record<string, unknown>;

const aliases: Record<Exclude<MigrationEntity, "journal_entries">, Record<string, string[]>> = {
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

type EconomicCashRow = Record<string, string>;
type JournalLinePreview = {
  accountNumber: string;
  description: string;
  debit: number;
  credit: number;
  vatCode: string | null;
};

const vatDefinitions: Record<string, { account: string; type: 1 | 2 | 3; rate: number; contra?: string }> = {
  I25: { account: "6903", type: 2, rate: 25 },
  IV25: { account: "6903", type: 3, rate: 25, contra: "6906" },
  IY25: { account: "6903", type: 3, rate: 25, contra: "6907" },
  OBPK: { account: "6906", type: 3, rate: 25, contra: "6902" },
  REP: { account: "6903", type: 2, rate: 5.26 },
  "TLF.": { account: "6903", type: 2, rate: 12.5 },
  U25: { account: "6902", type: 1, rate: 25 },
};

function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function economicDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

function addSignedLine(lines: JournalLinePreview[], accountNumber: string, signedAmount: number, description: string, vatCode = "") {
  const code = vatCode.trim().toUpperCase();
  const vat = code ? vatDefinitions[code] : undefined;
  if (code && !vat) throw new Error(`ukendt momskode ${code}`);
  const add = (account: string, signed: number, lineVatCode: string | null) => {
    const amount = cents(Math.abs(signed));
    if (amount === 0) return;
    lines.push({ accountNumber: account, description, debit: signed > 0 ? amount : 0, credit: signed < 0 ? amount : 0, vatCode: lineVatCode });
  };
  const signed = cents(signedAmount);
  if (!vat || vat.rate === 0) return add(accountNumber, signed, code || null);
  if (vat.type === 3) {
    add(accountNumber, signed, code);
    const vatAmount = cents(signed * vat.rate / 100);
    add(vat.account, vatAmount, code);
    add(vat.contra || vat.account, -vatAmount, code);
    return;
  }
  const vatAmount = cents(signed * vat.rate / (100 + vat.rate));
  add(accountNumber, cents(signed - vatAmount), code);
  add(vat.account, vatAmount, code);
}

function economicJournalPreview(content: string) {
  const matrix = parseDelimited(content);
  if (matrix.length < 2) throw new Error("Filen skal indeholde en overskriftsrække og mindst én datarække.");
  if (matrix.length > 20_001) throw new Error("En import må højst indeholde 20.000 datarækker.");
  const headers = matrix[0].map((value) => value.trim());
  const required = ["PosteringsType", "Dato", "KontoNr", "BilagsNr", "Tekst", "BeloebDKK", "MomsKode", "Modkonto", "ModkontoMomsKode", "Godkendt"];
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`Påkrævede e-conomic-kolonner mangler: ${missing.join(", ")}.`);
  const rows = matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""]))) as EconomicCashRow[];
  const groups = new Map<string, EconomicCashRow[]>();
  for (const row of rows) {
    if (!row.BilagsNr) continue;
    const group = groups.get(row.BilagsNr) || [];
    group.push(row);
    groups.set(row.BilagsNr, group);
  }
  const entries: ImportRow[] = [];
  const warnings: string[] = [];
  for (const [voucherNumber, group] of Array.from(groups.entries())) {
    const types = Array.from(new Set(group.map((row: EconomicCashRow) => row.PosteringsType).filter(Boolean)));
    if (!group.every((row) => row.Godkendt === "1")) {
      warnings.push(`Bilag ${voucherNumber}: ikke alle linjer er godkendt; sprunget over.`);
      continue;
    }
    if (types.length !== 1 || !["Leverandørfaktura", "Finansbilag"].includes(types[0])) {
      warnings.push(`Bilag ${voucherNumber}: posteringstypen ${types.join(" + ") || "mangler"} importeres ikke automatisk.`);
      continue;
    }
    const dates = Array.from(new Set(group.map((row: EconomicCashRow) => economicDate(row.Dato)).filter((date): date is string => Boolean(date))));
    if (dates.length !== 1) {
      warnings.push(`Bilag ${voucherNumber}: datoen er uklar; sprunget over.`);
      continue;
    }
    try {
      const lines: JournalLinePreview[] = [];
      const description = group.find((row) => row.KontoNr)?.Tekst || group[0].Tekst || `e-conomic bilag ${voucherNumber}`;
      if (types[0] === "Leverandørfaktura") {
        const headerRows = group.filter((row) => row.KontoNr);
        if (headerRows.length !== 1) throw new Error("forventede én leverandørhovedlinje");
        const header = headerRows[0];
        const gross = asNumber(header.BeloebDKK);
        if (!header.KontoNr || gross === 0) throw new Error("kreditorkonto eller beløb mangler");
        addSignedLine(lines, header.KontoNr, gross, description, header.MomsKode);
        const allocations = header.Modkonto
          ? [{ account: header.Modkonto, amount: gross, vatCode: header.ModkontoMomsKode, text: header.Tekst }]
          : group.filter((row) => row.Modkonto).map((row) => ({ account: row.Modkonto, amount: asNumber(row.BeloebDKK), vatCode: row.ModkontoMomsKode, text: row.Tekst }));
        if (!allocations.length) throw new Error("modkonto mangler");
        if (Math.abs(cents(allocations.reduce((sum, item) => sum + item.amount, 0) - gross)) > 0.005) throw new Error("fordelingen stemmer ikke med fakturabeløbet");
        for (const allocation of allocations) addSignedLine(lines, allocation.account, -allocation.amount, allocation.text || description, allocation.vatCode);
      } else {
        if (group.length !== 1) throw new Error("finansbilaget har flere linjer end forventet");
        const row = group[0];
        const amount = asNumber(row.BeloebDKK);
        if (!row.KontoNr || !row.Modkonto || amount === 0) throw new Error("konto, modkonto eller beløb mangler");
        addSignedLine(lines, row.KontoNr, amount, description, row.MomsKode);
        addSignedLine(lines, row.Modkonto, -amount, description, row.ModkontoMomsKode);
      }
      const debit = cents(lines.reduce((sum, line) => sum + line.debit, 0));
      const credit = cents(lines.reduce((sum, line) => sum + line.credit, 0));
      if (lines.length < 2 || Math.abs(debit - credit) > 0.005) throw new Error(`debet ${debit.toFixed(2)} og kredit ${credit.toFixed(2)} balancerer ikke`);
      entries.push({
        entryNumber: `ECON-KLADDE-${voucherNumber}`,
        date: dates[0],
        description,
        reference: group.find((row) => row.FakturaNr)?.FakturaNr || voucherNumber,
        sourceType: "economic_kladde",
        status: "kladde",
        lines,
      });
    } catch (error) {
      warnings.push(`Bilag ${voucherNumber}: ${error instanceof Error ? error.message : "kunne ikke valideres"}; sprunget over.`);
    }
  }
  const errors = entries.length ? [] : ["Ingen godkendte, balancerede kladdeposter kunne importeres."];
  return {
    rows: entries,
    errors,
    warnings,
    totalRows: groups.size,
    validRows: entries.length,
    matchedFields: required,
    sample: entries.slice(0, 5),
  };
}

export function previewImport(content: string, entity: MigrationEntity) {
  if (!content.trim()) throw new Error("Indsæt indholdet fra en CSV-fil.");
  if (Buffer.byteLength(content, "utf8") > 5 * 1024 * 1024) throw new Error("Filen må højst fylde 5 MB.");
  if (entity === "journal_entries") return economicJournalPreview(content);
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
      output.active = ["0", "false", "nej", "no"].includes(normalizedHeader(String(output.active ?? "true"))) ? 0 : 1;
      if (output.standardAccountNumber && !/^\d{4}$/.test(String(output.standardAccountNumber))) errors.push(`Række ${rowNumber}: standardkontonummer skal være 4 cifre.`);
    }
    const key = entity === "accounts" ? String(output.accountNumber).toLowerCase() : String(output.cvr || output.email || output.name).toLowerCase();
    if (seen.has(key)) { errors.push(`Række ${rowNumber}: dublet i filen (${key}).`); continue; }
    seen.add(key);
    rows.push(output);
  }
  return { rows, errors, totalRows: matrix.length - 1, validRows: rows.length, matchedFields: Object.keys(matched).filter((field) => matched[field] >= 0), sample: rows.slice(0, 5) };
}

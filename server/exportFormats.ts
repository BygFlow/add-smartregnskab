// ── Eksportformater ──
// Hvert format matcher importspecifikationen hos det pågældende løn-/regnskabssystem.

import type { PayrollLine, InvoiceLine } from "./connectors";

const BOM = "\ufeff";

function csv(rows: (string | number)[][], delimiter = ";"): string {
  // Citér kun når værdien indeholder selve separatoren, citationstegn eller linjeskift.
  // Et dansk decimalkomma må IKKE citéres i semikolon-filer — det bryder import i flere systemer.
  const needsQuote = (s: string) => s.includes(delimiter) || s.includes('"') || /[\r\n]/.test(s);
  return BOM + rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(delimiter)).join("\r\n") + "\r\n";
}

function dk(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export type ExportFormatDef = {
  id: string;
  label: string;
  kind: "loen" | "regnskab";
  providers: string[];
  extension: string;
  description: string;
};

export const EXPORT_FORMATS: ExportFormatDef[] = [
  { id: "generisk_loen_csv", label: "Generisk lønfil (CSV)", kind: "loen", providers: ["Alle"], extension: "csv", description: "Bred CSV med alle felter — kan tilpasses de fleste systemer." },
  { id: "danloen_csv", label: "Danløn importfil (CSV)", kind: "loen", providers: ["Danløn"], extension: "csv", description: "Medarbejdernr., lønart og antal — Danløns timeimport." },
  { id: "dataloen_csv", label: "Dataløn / Bluegarden (CSV)", kind: "loen", providers: ["Dataløn (Bluegarden)"], extension: "csv", description: "Fastbredde-lignende CSV med lønartsnummer og enhed." },
  { id: "zenegy_csv", label: "Zenegy timeimport (CSV)", kind: "loen", providers: ["Zenegy"], extension: "csv", description: "Zenegys kolonnenavne på engelsk med decimalpunkt." },
  { id: "generisk_regnskab_csv", label: "Generisk regnskabsfil (CSV)", kind: "regnskab", providers: ["Alle"], extension: "csv", description: "Fakturaoversigt med moms og forfaldsdato." },
  { id: "economic_csv", label: "e-conomic fakturaimport (CSV)", kind: "regnskab", providers: ["e-conomic"], extension: "csv", description: "Kolonner efter e-conomics kladdeimport." },
  { id: "dinero_csv", label: "Dinero fakturaimport (CSV)", kind: "regnskab", providers: ["Dinero"], extension: "csv", description: "Dineros fakturaformat med kontonummer." },
  { id: "billy_csv", label: "Billy fakturaimport (CSV)", kind: "regnskab", providers: ["Billy"], extension: "csv", description: "Billys kolonneopsætning med momssats." },
];

export function formatsFor(kind: "loen" | "regnskab"): ExportFormatDef[] {
  return EXPORT_FORMATS.filter((f) => f.kind === kind);
}

export function getFormat(id: string | undefined, kind: "loen" | "regnskab"): ExportFormatDef {
  const found = EXPORT_FORMATS.find((f) => f.id === id && f.kind === kind);
  return found || formatsFor(kind)[0];
}

// ── Lønformater ──
export function buildPayrollFile(formatId: string, lines: PayrollLine[]): string {
  switch (formatId) {
    case "danloen_csv":
      return csv([
        ["Medarbejdernr", "Lønart", "Antal", "Periode"],
        ...lines.map((l) => [l.employeeNo, l.wageCode, dk(l.hours), l.period]),
      ]);
    case "dataloen_csv":
      return csv([
        ["Medarbejdernummer", "Lønartsnummer", "Enhed", "Antal", "Lønperiode"],
        ...lines.map((l) => [l.employeeNo, l.wageCode, l.unit, dk(l.hours), l.period]),
      ]);
    case "zenegy_csv":
      return csv([
        ["EmployeeNumber", "EmployeeName", "SalaryTypeCode", "Unit", "Quantity", "Period"],
        ...lines.map((l) => [l.employeeNo, l.name, l.wageCode, l.unit, l.hours.toFixed(2), l.period]),
      ], ",");
    default:
      return csv([
        ["Medarbejdernr.", "Navn", "Løntype", "Enhed", "Antal", "Timer (decimal)", "Periode"],
        ...lines.map((l) => [l.employeeNo, l.name, l.wageCode, l.unit, dk(l.hours), l.hours.toFixed(2), l.period]),
      ]);
  }
}

// ── Regnskabsformater ──
export function buildAccountingFile(formatId: string, invoices: InvoiceLine[]): string {
  switch (formatId) {
    case "economic_csv":
      return csv([
        ["Bilagsnummer", "Kundenummer", "Kundenavn", "Fakturadato", "Forfaldsdato", "Nettobeløb", "Momsbeløb", "Valuta"],
        ...invoices.map((i) => [i.invoiceNo, i.customerNo || "", i.customer, i.date, i.dueDate, dk(i.amount), dk(i.vat), "DKK"]),
      ]);
    case "dinero_csv":
      return csv([
        ["Fakturanummer", "Kontonummer", "Kunde", "Dato", "Beløb ekskl. moms", "Momssats", "Beløb inkl. moms", "Betalingsfrist"],
        ...invoices.map((i) => [i.invoiceNo, i.customerNo || "", i.customer, i.date, dk(i.amount), "25%", dk(i.total), i.dueDate]),
      ]);
    case "billy_csv":
      return csv([
        ["InvoiceNo", "ContactName", "EntryDate", "DueDate", "NetAmount", "VatRate", "GrossAmount", "Currency"],
        ...invoices.map((i) => [i.invoiceNo, i.customer, i.date, i.dueDate, i.amount.toFixed(2), "0.25", i.total.toFixed(2), "DKK"]),
      ], ",");
    default:
      return csv([
        ["Bilagsnr.", "Dato", "Kunde", "Beløb", "Moms (25%)", "I alt", "Status", "Forfaldsdato"],
        ...invoices.map((i) => [i.invoiceNo, i.date, i.customer, dk(i.amount), dk(i.vat), dk(i.total), "", i.dueDate]),
      ]);
  }
}

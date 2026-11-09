type BankTransactionRow = { id: number; date?: string | null; description?: string | null; amount?: number | null; accountRef?: string | null; status?: string | null; matchedType?: string | null; matchedId?: number | null };
type AccountRow = { id: number; accountNumber?: string | null; active?: number | boolean | null };
type JournalEntryRow = { id: number; date?: string | null; entryNumber?: string | null; description?: string | null; reference?: string | null; sourceType?: string | null; status?: string | null };
type JournalLineRow = { journalEntryId: number; accountId: number; debit?: number | null; credit?: number | null };

export type KnownBankDiscrepancyRepairPlan = {
  safe: boolean;
  invoice515: { transactionId: number; sourceEntryId: number; date: string; bankAmount: number; invoiceAmount: number; overpayment: number } | null;
  payrollJune: { transactionId: number; sourceEntryId: number; date: string; amount: number } | null;
  operatingBankAccountId: number | null;
  payrollBankAccountId: number | null;
  receivableAccountId: number | null;
  reasons: string[];
};

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae").replaceAll("ø", "o").replaceAll("å", "a")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function sameAmount(left: unknown, right: unknown) { return Math.abs(Number(left) - Number(right)) < 0.005; }
function isPosted(value: unknown) { return ["bogfort", "afstemt"].includes(normalized(value)); }
function isImported(value: unknown) { return ["saft import", "economic kladde"].includes(normalized(value)); }

function exactAccount(accounts: AccountRow[], number: string, reasons: string[]) {
  const rows = accounts.filter((row) => row.active !== 0 && row.active !== false && String(row.accountNumber ?? "") === number);
  if (rows.length !== 1) reasons.push(`Forventede én aktiv konto ${number}, fandt ${rows.length}.`);
  return rows.length === 1 ? rows[0] : null;
}

function net(lines: JournalLineRow[], accountId: number) {
  return lines.filter((line) => line.accountId === accountId).reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
}

export function findKnownBankDiscrepancyRepairPlan(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
): KnownBankDiscrepancyRepairPlan {
  const reasons: string[] = [];
  const operatingBank = exactAccount(accounts, "5820", reasons);
  const payrollBank = exactAccount(accounts, "5825", reasons);
  const receivable = exactAccount(accounts, "5600", reasons);
  if (!operatingBank || !payrollBank || !receivable) return { safe: false, invoice515: null, payrollJune: null, operatingBankAccountId: operatingBank?.id ?? null, payrollBankAccountId: payrollBank?.id ?? null, receivableAccountId: receivable?.id ?? null, reasons };

  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const current = linesByEntry.get(line.journalEntryId) ?? [];
    current.push(line);
    linesByEntry.set(line.journalEntryId, current);
  }
  const usedEntryIds = new Set(transactions
    .filter((row) => normalized(row.status) === "matchet" && ["journal", "journal entry"].includes(normalized(row.matchedType)))
    .map((row) => Number(row.matchedId)).filter((id) => Number.isInteger(id) && id > 0));

  const invoiceBankRows = transactions.filter((row) => normalized(row.status) === "afventer"
    && String(row.date ?? "").slice(0, 10) === "2025-08-18"
    && sameAmount(row.amount, 30_126.39)
    && String(row.accountRef ?? "").replace(/\s+/g, "") === "0112"
    && normalized(row.description).includes("515"));
  if (invoiceBankRows.length !== 1) reasons.push(`Faktura 515: forventede én bankpost på 30.126,39 kr., fandt ${invoiceBankRows.length}.`);
  const invoiceEntries = entries.filter((entry) => {
    if (!isPosted(entry.status) || !isImported(entry.sourceType) || usedEntryIds.has(entry.id)) return false;
    if (String(entry.date ?? "").slice(0, 10) !== "2025-08-18" || !/(?:^|\D)515(?:\D|$)/.test(normalized(`${entry.entryNumber} ${entry.reference} ${entry.description}`))) return false;
    const entryLines = (linesByEntry.get(entry.id) ?? []).filter((line) => Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005);
    return entryLines.length === 2
      && entryLines.every((line) => [operatingBank.id, receivable.id].includes(line.accountId))
      && sameAmount(net(entryLines, operatingBank.id), 30_126.29)
      && sameAmount(net(entryLines, receivable.id), -30_126.29);
  });
  if (invoiceEntries.length !== 1) reasons.push(`Faktura 515: forventede én importeret bank/debitorpost på 30.126,29 kr., fandt ${invoiceEntries.length}.`);

  const payrollBankRows = transactions.filter((row) => normalized(row.status) === "afventer"
    && String(row.date ?? "").slice(0, 10) === "2025-06-27"
    && sameAmount(row.amount, -22_622)
    && String(row.accountRef ?? "").replace(/\s+/g, "") === "4483"
    && normalized(row.description).includes("overforselsservice"));
  if (payrollBankRows.length !== 1) reasons.push(`Nettoløn 27. juni: forventede én bankpost på -22.622,00 kr., fandt ${payrollBankRows.length}.`);
  const payrollEntries = entries.filter((entry) => {
    if (!isPosted(entry.status) || !isImported(entry.sourceType) || usedEntryIds.has(entry.id)) return false;
    if (String(entry.date ?? "").slice(0, 10) !== "2025-06-27" || !/(?:^|\D)20004(?:\D|$)/.test(normalized(`${entry.entryNumber} ${entry.reference}`))) return false;
    const entryLines = linesByEntry.get(entry.id) ?? [];
    const operatingLines = entryLines.filter((line) => line.accountId === operatingBank.id && sameAmount(line.credit, 22_622) && sameAmount(line.debit, 0));
    const payrollLines = entryLines.filter((line) => line.accountId === payrollBank.id && (Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005));
    const balance = entryLines.reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
    return operatingLines.length === 1 && payrollLines.length === 0 && sameAmount(balance, 0);
  });
  if (payrollEntries.length !== 1) reasons.push(`Nettoløn 27. juni: forventede én balanceret lønpost 20004 med banklinje på 5820, fandt ${payrollEntries.length}.`);

  return {
    safe: reasons.length === 0,
    invoice515: invoiceBankRows.length === 1 && invoiceEntries.length === 1 ? { transactionId: invoiceBankRows[0].id, sourceEntryId: invoiceEntries[0].id, date: "2025-08-18", bankAmount: 30_126.39, invoiceAmount: 30_126.29, overpayment: 0.10 } : null,
    payrollJune: payrollBankRows.length === 1 && payrollEntries.length === 1 ? { transactionId: payrollBankRows[0].id, sourceEntryId: payrollEntries[0].id, date: "2025-06-27", amount: 22_622 } : null,
    operatingBankAccountId: operatingBank.id,
    payrollBankAccountId: payrollBank.id,
    receivableAccountId: receivable.id,
    reasons,
  };
}

type BankTransactionRow = {
  id: number;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  accountRef?: string | null;
  status?: string | null;
  matchedType?: string | null;
  matchedId?: number | null;
};

type AccountRow = {
  id: number;
  accountNumber?: string | null;
  active?: number | boolean | null;
};

type JournalEntryRow = {
  id: number;
  date?: string | null;
  entryNumber?: string | null;
  description?: string | null;
  reference?: string | null;
  sourceType?: string | null;
  sourceId?: number | null;
  status?: string | null;
};

type JournalLineRow = {
  journalEntryId: number;
  accountId: number;
  debit?: number | null;
  credit?: number | null;
};

export type SafeCustomerPrepayment = {
  transactionId: number;
  invoiceJournalEntryId: number;
  settledByJournalEntryId: number;
  receivableAccountId: number;
  bankAccountId: number;
  amount: number;
  invoiceReference: string;
  date: string;
};

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameAmount(left: unknown, right: unknown) {
  return Math.abs(Number(left) - Number(right)) < 0.01;
}

function invoiceReference(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/(?:faktura|f)\s*[:#-]?\s*(\d{1,10})\b/i);
  return match?.[1]?.replace(/^0+(?=\d)/, "") ?? null;
}

function normalizedReference(value: unknown) {
  const digits = String(value ?? "").match(/\d+/g)?.join("") ?? "";
  return digits.replace(/^0+(?=\d)/, "");
}

function bankLedgerNumber(accountRef: unknown) {
  const ref = String(accountRef ?? "").replace(/\s+/g, "");
  if (["9507", "4483"].includes(ref)) return "5825";
  if (["6477", "0112", "9278", "13800707"].includes(ref)) return "5820";
  return null;
}

function isPosted(status: unknown) {
  return ["bogfort", "afstemt"].includes(normalized(status));
}

function isJournalMatch(value: unknown) {
  return ["journal", "journal entry"].includes(normalized(value));
}

/**
 * Finds a second, real receipt for an invoice that has already been settled by
 * another bank transaction. This deliberately requires the same account,
 * date, amount and invoice reference plus complete bank/receivable journal
 * lines. Ambiguous receipts are left for manual review.
 */
export function findSafeCustomerPrepayments(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
  year = "2025",
): SafeCustomerPrepayment[] {
  const activeAccounts = accounts.filter((account) => account.active !== 0 && account.active !== false);
  const accountByNumber = new Map(activeAccounts.map((account) => [String(account.accountNumber ?? ""), account]));
  const receivableAccounts = activeAccounts.filter((account) => String(account.accountNumber ?? "") === "5600");
  if (receivableAccounts.length !== 1) return [];
  const receivable = receivableAccounts[0];

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const entryLines = linesByEntry.get(line.journalEntryId) ?? [];
    entryLines.push(line);
    linesByEntry.set(line.journalEntryId, entryLines);
  }

  const alreadyPosted = new Set(entries
    .filter((entry) => normalized(entry.sourceType) === "bank customer prepayment")
    .map((entry) => Number(entry.sourceId))
    .filter((id) => Number.isInteger(id) && id > 0));

  const invoiceEntries = entries.filter((entry) => {
    if (!isPosted(entry.status)) return false;
    const sourceType = normalized(entry.sourceType);
    return ["saft import", "economic kladde"].includes(sourceType);
  });

  return transactions.flatMap((transaction) => {
    const amount = Number(transaction.amount);
    const reference = invoiceReference(transaction.description);
    const date = String(transaction.date ?? "").slice(0, 10);
    const bankNumber = bankLedgerNumber(transaction.accountRef);
    const bankAccount = bankNumber ? accountByNumber.get(bankNumber) : undefined;
    if (normalized(transaction.status) !== "afventer"
      || alreadyPosted.has(transaction.id)
      || !(amount > 0)
      || !date.startsWith(`${year}-`)
      || !reference
      || !bankAccount) return [];

    const matchingInvoices = invoiceEntries.filter((entry) => {
      if (normalizedReference(entry.reference) !== reference) return false;
      const entryLines = linesByEntry.get(entry.id) ?? [];
      return entryLines.filter((line) => line.accountId === receivable.id
        && sameAmount(line.debit, amount)
        && sameAmount(line.credit, 0)).length === 1;
    });
    if (matchingInvoices.length !== 1) return [];
    const invoice = matchingInvoices[0];

    const settledReceipts = transactions.filter((other) => {
      if (other.id === transaction.id
        || normalized(other.status) !== "matchet"
        || !isJournalMatch(other.matchedType)
        || !sameAmount(other.amount, amount)
        || String(other.accountRef ?? "").replace(/\s+/g, "") !== String(transaction.accountRef ?? "").replace(/\s+/g, "")
        || String(other.date ?? "").slice(0, 10) !== date) return false;
      const paymentEntry = entryById.get(Number(other.matchedId));
      if (!paymentEntry || !isPosted(paymentEntry.status)) return false;
      const paymentReference = normalizedReference(paymentEntry.reference)
        || invoiceReference(paymentEntry.description)
        || invoiceReference(other.description);
      if (paymentReference !== reference) return false;
      const paymentLines = linesByEntry.get(paymentEntry.id) ?? [];
      const bankDebits = paymentLines.filter((line) => line.accountId === bankAccount.id
        && sameAmount(line.debit, amount)
        && sameAmount(line.credit, 0));
      const receivableCredits = paymentLines.filter((line) => line.accountId === receivable.id
        && sameAmount(line.credit, amount)
        && sameAmount(line.debit, 0));
      return bankDebits.length === 1 && receivableCredits.length === 1;
    });
    if (settledReceipts.length !== 1) return [];

    const hasRefund = transactions.some((other) =>
      other.id !== transaction.id
      && String(other.accountRef ?? "").replace(/\s+/g, "") === String(transaction.accountRef ?? "").replace(/\s+/g, "")
      && String(other.date ?? "").slice(0, 10) >= date
      && sameAmount(other.amount, -amount),
    );
    if (hasRefund) return [];

    return [{
      transactionId: transaction.id,
      invoiceJournalEntryId: invoice.id,
      settledByJournalEntryId: Number(settledReceipts[0].matchedId),
      receivableAccountId: receivable.id,
      bankAccountId: bankAccount.id,
      amount,
      invoiceReference: reference,
      date,
    }];
  }).sort((left, right) => left.transactionId - right.transactionId);
}

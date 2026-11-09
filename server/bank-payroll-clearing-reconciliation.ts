type BankTransactionRow = {
  id: number;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  accountRef?: string | null;
  status?: string | null;
};

type AccountRow = {
  id: number;
  accountNumber?: string | null;
  active?: number | boolean | null;
};

type JournalEntryRow = {
  sourceType?: string | null;
  sourceId?: number | null;
};

export type SafePayrollClearingPosting = {
  transactionId: number;
  bankAccountId: number;
  amount: number;
  date: string;
  description: string;
  kind: "payroll_clearing" | "intercompany_outflow" | "intercompany_funding";
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

function bankLedgerNumber(accountRef: unknown) {
  const ref = String(accountRef ?? "").replace(/\s+/g, "");
  if (["9507", "4483"].includes(ref)) return "5825";
  if (["6477", "0112", "9278", "13800707"].includes(ref)) return "5820";
  return null;
}

const PAYROLL_DESCRIPTIONS = new Set([
  "overforselsservice",
  "lon overforslerne",
  "aconto lon",
  "aconto lon til dragena dan",
  "aconto lon til aurel",
  "aconto lon til aurel dan",
  "aurel dan aconto lon",
  "feriepenge",
]);

const INTERCOMPANY_OUTFLOW_DESCRIPTIONS = new Set([
  "add multi service aps",
  "lon skat moms konto add multi service aps",
]);

/**
 * Classifies only bank rows whose text documents payroll cash, explicit
 * Multi Service intercompany transfers or the exact same-day funding of an
 * Overførselsservice payroll batch. Payroll rows go to a temporary clearing
 * account: no wage expense, withholding tax or official payroll filing is
 * inferred from the bank text.
 */
export function findSafePayrollClearingPostings(
  transactions: BankTransactionRow[],
  accounts: AccountRow[],
  entries: JournalEntryRow[],
  year = "2025",
): SafePayrollClearingPosting[] {
  const activeAccounts = accounts.filter((account) => account.active !== 0 && account.active !== false);
  const accountsByNumber = new Map<string, AccountRow[]>();
  for (const account of activeAccounts) {
    const key = String(account.accountNumber ?? "");
    accountsByNumber.set(key, [...(accountsByNumber.get(key) ?? []), account]);
  }

  const alreadyPosted = new Set(entries
    .filter((entry) => ["bank_payroll_clearing", "bank_intercompany_settlement"].includes(String(entry.sourceType ?? "")))
    .map((entry) => Number(entry.sourceId))
    .filter((id) => Number.isInteger(id) && id > 0));

  return transactions.flatMap((transaction) => {
    const amount = Number(transaction.amount);
    const date = String(transaction.date ?? "").slice(0, 10);
    const description = String(transaction.description ?? "").trim();
    const descriptionKey = normalized(description);
    const bankNumber = bankLedgerNumber(transaction.accountRef);
    const bankAccounts = bankNumber ? (accountsByNumber.get(bankNumber) ?? []) : [];
    if (normalized(transaction.status) !== "afventer"
      || alreadyPosted.has(transaction.id)
      || !Number.isFinite(amount)
      || amount === 0
      || !date.startsWith(`${year}-`)
      || bankAccounts.length !== 1) return [];

    let kind: SafePayrollClearingPosting["kind"] | null = null;
    if (amount < 0 && PAYROLL_DESCRIPTIONS.has(descriptionKey)) {
      kind = "payroll_clearing";
    } else if (amount < 0 && INTERCOMPANY_OUTFLOW_DESCRIPTIONS.has(descriptionKey)) {
      kind = "intercompany_outflow";
    } else if (amount > 0 && /^45147592\d{5}$/.test(descriptionKey)) {
      const hasPayrollBatch = transactions.some((other) =>
        other.id !== transaction.id
        && normalized(other.status) === "afventer"
        && String(other.date ?? "").slice(0, 10) === date
        && String(other.accountRef ?? "").replace(/\s+/g, "") === String(transaction.accountRef ?? "").replace(/\s+/g, "")
        && normalized(other.description) === "overforselsservice"
        && Math.abs(Number(other.amount) + amount) < 0.01,
      );
      if (hasPayrollBatch) kind = "intercompany_funding";
    }
    if (!kind) return [];

    return [{
      transactionId: transaction.id,
      bankAccountId: bankAccounts[0].id,
      amount: Math.abs(amount),
      date,
      description,
      kind,
    }];
  }).sort((left, right) => left.transactionId - right.transactionId);
}

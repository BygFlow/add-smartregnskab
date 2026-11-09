export type InterestBankTransaction = {
  id: number;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  accountRef?: string | null;
  status?: string | null;
};

export type InterestAccount = {
  id: number;
  accountNumber?: string | null;
  name?: string | null;
  type?: string | null;
  active?: number | boolean | null;
};

export type InterestJournalEntry = {
  sourceType?: string | null;
  sourceId?: number | null;
};

export type SafeInterestPosting = {
  transactionId: number;
  date: string;
  description: string;
  amount: number;
  bankAccountId: number;
  interestAccountId: number;
};

function normalizedAccountRef(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toLocaleLowerCase("da-DK");
}

function bankLedgerNumber(accountRef: unknown) {
  const ref = normalizedAccountRef(accountRef);
  if (["9507", "4483"].includes(ref)) return "5825";
  if (["6477", "0112", "9278", "13800707"].includes(ref)) return "5820";
  return null;
}

function isInterestDescription(value: unknown) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("da-DK");
  return ["interest", "rente", "bankrente", "renteindtægt", "renteindtaegt"].includes(normalized);
}

export function findSafeInterestPostings(
  transactions: InterestBankTransaction[],
  accounts: InterestAccount[],
  entries: InterestJournalEntry[],
): SafeInterestPosting[] {
  const accountByNumber = new Map(accounts
    .filter((account) => account.active !== 0 && account.active !== false)
    .map((account) => [String(account.accountNumber ?? ""), account]));
  const interestAccounts = accounts.filter((account) =>
    account.active !== 0
    && account.active !== false
    && String(account.accountNumber ?? "") === "4310"
    && String(account.type ?? "").toLocaleLowerCase("da-DK") === "indtaegt"
    && /rente.*bank|bank.*rente/i.test(String(account.name ?? "")),
  );
  if (interestAccounts.length !== 1) return [];

  const alreadyPosted = new Set(entries
    .filter((entry) => entry.sourceType === "bank_interest" && Number(entry.sourceId) > 0)
    .map((entry) => Number(entry.sourceId)));
  const interestAccount = interestAccounts[0];

  return transactions.flatMap((transaction) => {
    const amount = Number(transaction.amount);
    const bankNumber = bankLedgerNumber(transaction.accountRef);
    const bankAccount = bankNumber ? accountByNumber.get(bankNumber) : undefined;
    if (transaction.status !== "afventer"
      || alreadyPosted.has(transaction.id)
      || !isInterestDescription(transaction.description)
      || !(amount > 0)
      || !transaction.date
      || !bankAccount) return [];
    return [{
      transactionId: transaction.id,
      date: transaction.date,
      description: `Bankrente ${transaction.accountRef ?? ""}`.trim(),
      amount,
      bankAccountId: bankAccount.id,
      interestAccountId: interestAccount.id,
    }];
  });
}

type AccountLike = {
  id: number;
  accountNumber: string;
  name?: string | null;
  type?: string | null;
  balance?: number | null;
};

type EntryLike = {
  id: number;
  date: string;
  status?: string | null;
};

type LineLike = {
  journalEntryId: number;
  accountId: number;
  debit?: number | null;
  credit?: number | null;
};

const POSTED_STATUSES = new Set(["bogført", "bogfort", "afstemt"]);

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isPostedStatus(status?: string | null): boolean {
  return POSTED_STATUSES.has(String(status || "").toLowerCase());
}

export function calculateAccountBalances<T extends AccountLike>(
  accounts: T[],
  entries: EntryLike[],
  lines: LineLike[],
): Array<T & { balance: number }> {
  const postedEntryIds = new Set(entries.filter((entry) => isPostedStatus(entry.status)).map((entry) => entry.id));
  const totals = new Map<number, number>();
  const lineCounts = new Map<number, number>();

  for (const line of lines) {
    if (!postedEntryIds.has(line.journalEntryId)) continue;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    totals.set(line.accountId, (totals.get(line.accountId) || 0) + debit - credit);
    lineCounts.set(line.accountId, (lineCounts.get(line.accountId) || 0) + 1);
  }

  return accounts.map((account) => ({
    ...account,
    // Eksisterende startsaldi bevares kun på konti uden bogføringslinjer.
    balance: lineCounts.has(account.id)
      ? roundMoney(totals.get(account.id) || 0)
      : roundMoney(Number(account.balance || 0)),
  }));
}

export function journalEntryAmount(entryId: number, lines: LineLike[]): number {
  const entryLines = lines.filter((line) => line.journalEntryId === entryId);
  const debits = entryLines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credits = entryLines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  return roundMoney(Math.max(debits, credits));
}

export function calculatePeriodProfitLoss<T extends AccountLike>(
  accounts: T[],
  entries: EntryLike[],
  lines: LineLike[],
  startDate: string,
  endDate: string,
): { revenue: number; expenses: number; result: number } {
  const periodEntries = entries.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  const periodEntryIds = new Set(periodEntries.map((entry) => entry.id));
  const periodLines = lines.filter((line) => periodEntryIds.has(line.journalEntryId));
  const periodAccounts = calculateAccountBalances(
    accounts.map((account) => ({ ...account, balance: 0 })),
    periodEntries,
    periodLines,
  );
  const revenue = roundMoney(-periodAccounts
    .filter((account) => account.type === "indtaegt")
    .reduce((sum, account) => sum + account.balance, 0));
  const expenses = roundMoney(periodAccounts
    .filter((account) => account.type === "udgift")
    .reduce((sum, account) => sum + account.balance, 0));

  return { revenue, expenses, result: roundMoney(revenue - expenses) };
}

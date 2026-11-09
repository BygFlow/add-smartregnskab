import { isStrongMerchantMatch } from "./bank-auto-match";

type BankTransactionRow = {
  id: number;
  date: string;
  description?: string | null;
  amount: number;
  status?: string | null;
  matchedType?: string | null;
  matchedId?: number | null;
  accountRef?: string | null;
};

type AccountRow = {
  id: number;
  accountNumber?: string | null;
  name?: string | null;
};

type JournalEntryRow = {
  id: number;
  date: string;
  entryNumber?: string | null;
  description?: string | null;
  sourceType?: string | null;
  sourceId?: number | null;
  status?: string | null;
};

type JournalLineRow = {
  journalEntryId: number;
  accountId: number;
  description?: string | null;
  debit?: number | null;
  credit?: number | null;
};

export type SafePayableSettlement = {
  transactionId: number;
  invoiceJournalEntryId: number;
  payableAccountId: number;
  bankAccountId: number;
  amount: number;
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

function sameAmount(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

function dayNumber(value: unknown) {
  const time = Date.parse(`${String(value ?? "").slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(time) ? Math.round(time / 86_400_000) : Number.NaN;
}

function bankAccountNumber(accountRef: unknown) {
  const ref = String(accountRef ?? "").replace(/\s+/g, "");
  if (ref === "4483") return "5825";
  if (["0112", "9278", "13800707"].includes(ref)) return "5820";
  return null;
}

function isPayableAccount(account: AccountRow) {
  return account.accountNumber === "6800" || normalized(account.name).includes("kreditor");
}

/**
 * Finds imported supplier invoices that can be settled from a pending bank
 * payment without guessing. The amount and supplier must be unique in both
 * directions, the posting must be close to the bank date, and no existing
 * payable clearing may already exist.
 */
export function findSafePayableSettlements(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
  year = "2025",
): SafePayableSettlement[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const accountByNumber = new Map(accounts.map((account) => [String(account.accountNumber ?? ""), account]));
  const payableAccountIds = new Set(accounts.filter(isPayableAccount).map((account) => account.id));
  if (!payableAccountIds.size) return [];

  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const entryLines = linesByEntry.get(line.journalEntryId) ?? [];
    entryLines.push(line);
    linesByEntry.set(line.journalEntryId, entryLines);
  }

  const postedEntries = entries.filter((entry) => ["bogfort", "afstemt"].includes(normalized(entry.status)));
  const reversedEntryIds = new Set(postedEntries
    .filter((entry) => normalized(entry.sourceType) === "tilbageforsel")
    .map((entry) => Number(entry.sourceId))
    .filter((id) => Number.isInteger(id) && id > 0));
  const alreadyBankMatchedEntryIds = new Set(transactions
    .filter((transaction) => ["journal", "journal entry"].includes(normalized(transaction.matchedType)))
    .map((transaction) => Number(transaction.matchedId))
    .filter((id) => Number.isInteger(id) && id > 0));

  const candidatesByTransaction = transactions
    .filter((transaction) => normalized(transaction.status) === "afventer")
    .filter((transaction) => Number(transaction.amount) < 0)
    .filter((transaction) => String(transaction.date).startsWith(`${year}-`))
    .map((transaction) => {
      const bankNumber = bankAccountNumber(transaction.accountRef);
      const bankAccount = bankNumber ? accountByNumber.get(bankNumber) : undefined;
      if (!bankAccount) return { transaction, candidates: [] as SafePayableSettlement[] };
      const paymentDay = dayNumber(transaction.date);
      const amount = Math.abs(Number(transaction.amount));
      const candidates: Array<{ settlement: SafePayableSettlement; distance: number }> = [];

      for (const entry of postedEntries) {
        const sourceType = normalized(entry.sourceType);
        if (!["saft import", "economic kladde"].includes(sourceType)) continue;
        if (reversedEntryIds.has(entry.id) || alreadyBankMatchedEntryIds.has(entry.id)) continue;
        const invoiceDay = dayNumber(entry.date);
        const daysFromInvoice = paymentDay - invoiceDay;
        if (!Number.isFinite(daysFromInvoice) || daysFromInvoice < -7 || daysFromInvoice > 90) continue;
        const entryLines = linesByEntry.get(entry.id) ?? [];
        const payableLines = entryLines.filter((line) =>
          payableAccountIds.has(line.accountId)
          && sameAmount(Number(line.credit || 0), amount)
          && sameAmount(Number(line.debit || 0), 0),
        );
        if (payableLines.length !== 1) continue;
        if (!isStrongMerchantMatch(transaction.description, entry.description)
          && !entryLines.some((line) => isStrongMerchantMatch(transaction.description, line.description))) continue;

        const payableLine = payableLines[0];
        const alreadyCleared = postedEntries.some((otherEntry) => {
          if (otherEntry.id === entry.id) return false;
          const clearingDay = dayNumber(otherEntry.date);
          if (!Number.isFinite(clearingDay) || clearingDay < invoiceDay - 7 || clearingDay > paymentDay + 7) return false;
          return (linesByEntry.get(otherEntry.id) ?? []).some((line) =>
            line.accountId === payableLine.accountId
            && sameAmount(Number(line.debit || 0), amount)
            && sameAmount(Number(line.credit || 0), 0),
          );
        });
        if (alreadyCleared) continue;
        candidates.push({
          settlement: {
            transactionId: transaction.id,
            invoiceJournalEntryId: entry.id,
            payableAccountId: payableLine.accountId,
            bankAccountId: bankAccount.id,
            amount,
          },
          distance: Math.abs(daysFromInvoice),
        });
      }
      const sorted = candidates.sort((left, right) => left.distance - right.distance
        || left.settlement.invoiceJournalEntryId - right.settlement.invoiceJournalEntryId);
      const nearest = !sorted.length
        ? []
        : sorted.length === 1 || sorted[0].distance < sorted[1].distance
          ? [sorted[0].settlement]
          : [];
      return { transaction, candidates: nearest };
    })
    .filter(({ candidates }) => candidates.length > 0);

  const transactionIdsByInvoice = new Map<number, number[]>();
  for (const { transaction, candidates } of candidatesByTransaction) {
    for (const candidate of candidates) {
      const ids = transactionIdsByInvoice.get(candidate.invoiceJournalEntryId) ?? [];
      ids.push(transaction.id);
      transactionIdsByInvoice.set(candidate.invoiceJournalEntryId, ids);
    }
  }

  return candidatesByTransaction
    .filter(({ candidates }) => candidates.length === 1)
    .map(({ candidates }) => candidates[0])
    .filter((candidate) => transactionIdsByInvoice.get(candidate.invoiceJournalEntryId)?.length === 1)
    .filter((candidate) => accountById.has(candidate.payableAccountId) && accountById.has(candidate.bankAccountId))
    .sort((left, right) => left.transactionId - right.transactionId);
}

type BankTransactionRow = {
  date: string;
  description?: string | null;
  amount: number;
};

type AccountRow = {
  id: number;
  accountNumber?: string | null;
  name?: string | null;
  type?: string | null;
};

type JournalEntryRow = {
  id: number;
  date: string;
  description?: string | null;
  sourceType?: string | null;
  status?: string | null;
};

type JournalLineRow = {
  journalEntryId: number;
  accountId: number;
  description?: string | null;
  debit?: number | null;
  credit?: number | null;
};

function normalizedText(value: unknown) {
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

export function isBankLedgerAccount(account: AccountRow) {
  const name = normalizedText(account.name);
  const type = normalizedText(account.type);
  if (/(^| )(gebyr|rente|omkostning|fee|interest)( |$)/.test(name)) return false;
  if (type && !["aktiv", "asset"].includes(type)) return false;

  return account.accountNumber === "5820"
    || name === "bank"
    || name === "cash at bank"
    || /(^| )(bankkonto|driftskonto|erhvervskonto|checkkonto|likvidkonto)( |$)/.test(name);
}

function sameAmount(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

/**
 * Finds a single, safe SAF-T journal-entry match for one imported bank row.
 * Date and signed bank amount must agree. Description is only used to resolve
 * otherwise ambiguous candidates; ambiguity is never guessed away.
 */
export function findUniqueSaftJournalMatch(
  transaction: BankTransactionRow,
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
  usedJournalEntryIds: ReadonlySet<number> = new Set(),
) {
  const bankAccountIds = new Set(accounts.filter(isBankLedgerAccount).map((account) => account.id));
  if (!bankAccountIds.size) return null;

  const entriesById = new Map(entries
    .filter((entry) => normalizedText(entry.sourceType) === "saft import")
    .filter((entry) => ["bogfort", "afstemt"].includes(normalizedText(entry.status)))
    .filter((entry) => String(entry.date).slice(0, 10) === String(transaction.date).slice(0, 10))
    .filter((entry) => !usedJournalEntryIds.has(entry.id))
    .map((entry) => [entry.id, entry]));

  const candidates = new Map<number, { id: number; descriptions: string[] }>();
  for (const line of lines) {
    const entry = entriesById.get(line.journalEntryId);
    if (!entry || !bankAccountIds.has(line.accountId)) continue;
    const signedBankAmount = Number(line.debit || 0) - Number(line.credit || 0);
    if (!sameAmount(signedBankAmount, Number(transaction.amount))) continue;
    const existing = candidates.get(entry.id) ?? { id: entry.id, descriptions: [] };
    existing.descriptions.push(normalizedText(line.description));
    existing.descriptions.push(normalizedText(entry.description));
    candidates.set(entry.id, existing);
  }

  const uniqueCandidates = Array.from(candidates.values());
  if (uniqueCandidates.length === 1) return uniqueCandidates[0].id;
  if (uniqueCandidates.length < 2) return null;

  const transactionDescription = normalizedText(transaction.description);
  if (!transactionDescription) return null;
  const exactDescriptionCandidates = uniqueCandidates.filter((candidate) =>
    candidate.descriptions.some((description) => description === transactionDescription),
  );
  return exactDescriptionCandidates.length === 1 ? exactDescriptionCandidates[0].id : null;
}

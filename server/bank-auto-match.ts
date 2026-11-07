type BankTransactionRow = {
  id?: number;
  date: string;
  description?: string | null;
  amount: number;
  status?: string | null;
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
  entryNumber?: string | null;
  description?: string | null;
  reference?: string | null;
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
    .replace(/&amp;|&#38;|&#x26;/gi, "&")
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
    || /(^| )bank( |$)/.test(name)
    || name === "cash at bank"
    || /(^| )(bankkonto|driftskonto|erhvervskonto|checkkonto|likvidkonto)( |$)/.test(name);
}

function sameAmount(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

function dateOnly(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

function daysAfter(later: unknown, earlier: unknown) {
  const laterTime = Date.parse(`${dateOnly(later)}T00:00:00Z`);
  const earlierTime = Date.parse(`${dateOnly(earlier)}T00:00:00Z`);
  if (!Number.isFinite(laterTime) || !Number.isFinite(earlierTime)) return Number.NaN;
  return Math.round((laterTime - earlierTime) / 86_400_000);
}

function merchantTokens(value: unknown) {
  const ignoredSuffixes = new Set([
    "a", "s", "as", "aps", "danmark", "denmark", "hiller", "hilleroed", "hillerod",
    "og", "and", "amp",
  ]);
  return normalizedText(value)
    .split(" ")
    .filter((part) => part && !ignoredSuffixes.has(part));
}

function merchantKey(value: unknown) {
  return merchantTokens(value).join("");
}

function differsByAtMostOneCharacter(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) differences += 1;
  return differences <= 1;
}

export function isStrongMerchantMatch(left: unknown, right: unknown) {
  const leftKey = merchantKey(left);
  const rightKey = merchantKey(right);
  const genericKeys = new Set([
    "aconto", "acontolon", "bank", "betaling", "incomesorter", "interest", "lon",
    "overforsel", "payment", "privat", "rente", "transfer",
  ]);
  if (leftKey.length < 5 || rightKey.length < 5 || genericKeys.has(leftKey) || genericKeys.has(rightKey)) return false;
  if (leftKey === rightKey || leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey)) return true;
  if (differsByAtMostOneCharacter(leftKey, rightKey)) return true;

  const genericBrandTokens = new Set([
    "betaling", "butik", "faktura", "farvehandel", "gruppen", "indbet", "kort", "kunde", "service", "shop",
  ]);
  const rightTokens = new Set(merchantTokens(right));
  return merchantTokens(left).some((token) =>
    token.length >= 5 && !genericBrandTokens.has(token) && rightTokens.has(token),
  );
}

export type SaftJournalCandidate = {
  id: number;
  date: string;
  entryNumber: string | null;
  description: string | null;
  reference: string | null;
  lineDescription: string | null;
  amount: number;
};

/**
 * Returns every safe, unused imported journal entry whose bank line has the
 * same date and signed amount as the imported bank row. Both SAF-T entries and
 * posted e-conomic migration entries are eligible. The caller can present
 * ambiguous candidates for a deliberate manual choice without creating a new
 * accounting entry.
 */
export function findSaftJournalCandidates(
  transaction: BankTransactionRow,
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
  usedJournalEntryIds: ReadonlySet<number> = new Set(),
): SaftJournalCandidate[] {
  const bankAccountIds = new Set(accounts.filter(isBankLedgerAccount).map((account) => account.id));
  if (!bankAccountIds.size) return [];

  const allowedSourceTypes = new Set(["saft import", "economic kladde"]);
  const entriesById = new Map(entries
    .filter((entry) => allowedSourceTypes.has(normalizedText(entry.sourceType)))
    .filter((entry) => ["bogfort", "afstemt"].includes(normalizedText(entry.status)))
    .filter((entry) => String(entry.date).slice(0, 10) === String(transaction.date).slice(0, 10))
    .filter((entry) => !usedJournalEntryIds.has(entry.id))
    .map((entry) => [entry.id, entry]));

  const candidates = new Map<number, SaftJournalCandidate>();
  for (const line of lines) {
    const entry = entriesById.get(line.journalEntryId);
    if (!entry || !bankAccountIds.has(line.accountId)) continue;
    const signedBankAmount = Number(line.debit || 0) - Number(line.credit || 0);
    if (!sameAmount(signedBankAmount, Number(transaction.amount))) continue;
    if (!candidates.has(entry.id)) {
      candidates.set(entry.id, {
        id: entry.id,
        date: String(entry.date).slice(0, 10),
        entryNumber: entry.entryNumber ?? null,
        description: entry.description ?? null,
        reference: entry.reference ?? null,
        lineDescription: line.description ?? null,
        amount: signedBankAmount,
      });
    }
  }

  return Array.from(candidates.values()).sort((left, right) =>
    String(left.entryNumber ?? left.id).localeCompare(String(right.entryNumber ?? right.id), "da", { numeric: true }),
  );
}

/**
 * Finds a single, safe imported journal-entry match for one imported bank row.
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
  const uniqueCandidates = findSaftJournalCandidates(transaction, entries, lines, accounts, usedJournalEntryIds)
    .map((candidate) => ({
      id: candidate.id,
      descriptions: [normalizedText(candidate.lineDescription), normalizedText(candidate.description)],
    }));
  if (uniqueCandidates.length === 1) return uniqueCandidates[0].id;
  if (uniqueCandidates.length < 2) return null;

  const transactionDescription = normalizedText(transaction.description);
  if (!transactionDescription) return null;
  const exactDescriptionCandidates = uniqueCandidates.filter((candidate) =>
    candidate.descriptions.some((description) => description === transactionDescription),
  );
  return exactDescriptionCandidates.length === 1 ? exactDescriptionCandidates[0].id : null;
}

export type SafeImportedJournalMatch = {
  transactionId: number;
  journalEntryId: number;
};

/**
 * Returns only reciprocal one-to-one matches. A bank row and an imported,
 * posted journal entry must be each other's sole exact date-and-amount
 * candidate. This prevents repeated payroll amounts or duplicate bank rows
 * from being assigned in an arbitrary order.
 */
export function findSafeImportedJournalMatches(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
  usedJournalEntryIds: ReadonlySet<number> = new Set(),
): SafeImportedJournalMatch[] {
  const candidatesByTransaction = transactions
    .filter((transaction) => Number.isInteger(transaction.id) && normalizedText(transaction.status) === "afventer")
    .map((transaction) => ({
      transactionId: Number(transaction.id),
      candidates: findSaftJournalCandidates(transaction, entries, lines, accounts, usedJournalEntryIds),
    }))
    .filter(({ candidates }) => candidates.length > 0);

  const transactionIdsByJournalEntry = new Map<number, number[]>();
  for (const { transactionId, candidates } of candidatesByTransaction) {
    for (const candidate of candidates) {
      const transactionIds = transactionIdsByJournalEntry.get(candidate.id) ?? [];
      transactionIds.push(transactionId);
      transactionIdsByJournalEntry.set(candidate.id, transactionIds);
    }
  }

  return candidatesByTransaction
    .filter(({ candidates }) => candidates.length === 1)
    .filter(({ candidates }) => transactionIdsByJournalEntry.get(candidates[0].id)?.length === 1)
    .map(({ transactionId, candidates }) => ({ transactionId, journalEntryId: candidates[0].id }))
    .sort((left, right) => left.transactionId - right.transactionId);
}

/**
 * Finds reciprocal one-to-one matches where the bank date follows the posted
 * imported journal date by one to four days. Besides signed amount equality,
 * a strong, non-generic merchant-name match is mandatory. This covers normal
 * card settlement delays, including a long weekend, without guessing repeated
 * payroll or transfer rows.
 */
export function findSafeDelayedImportedJournalMatches(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
  usedJournalEntryIds: ReadonlySet<number> = new Set(),
): SafeImportedJournalMatch[] {
  const bankAccountIds = new Set(accounts.filter(isBankLedgerAccount).map((account) => account.id));
  if (!bankAccountIds.size) return [];

  const allowedSourceTypes = new Set(["saft import", "economic kladde"]);
  const eligibleEntries = entries
    .filter((entry) => allowedSourceTypes.has(normalizedText(entry.sourceType)))
    .filter((entry) => ["bogfort", "afstemt"].includes(normalizedText(entry.status)))
    .filter((entry) => !usedJournalEntryIds.has(entry.id));
  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const entryLines = linesByEntry.get(line.journalEntryId) ?? [];
    entryLines.push(line);
    linesByEntry.set(line.journalEntryId, entryLines);
  }

  const candidatesByTransaction = transactions
    .filter((transaction) => Number.isInteger(transaction.id) && normalizedText(transaction.status) === "afventer")
    .map((transaction) => {
      const candidateIds = new Set<number>();
      for (const entry of eligibleEntries) {
        const lagDays = daysAfter(transaction.date, entry.date);
        if (lagDays < 1 || lagDays > 4) continue;
        for (const line of linesByEntry.get(entry.id) ?? []) {
          if (!bankAccountIds.has(line.accountId)) continue;
          const signedBankAmount = Number(line.debit || 0) - Number(line.credit || 0);
          if (!sameAmount(signedBankAmount, Number(transaction.amount))) continue;
          if (!isStrongMerchantMatch(transaction.description, line.description ?? entry.description)
            && !isStrongMerchantMatch(transaction.description, entry.description)) continue;
          candidateIds.add(entry.id);
        }
      }
      return { transactionId: Number(transaction.id), candidateIds: Array.from(candidateIds) };
    })
    .filter(({ candidateIds }) => candidateIds.length > 0);

  const transactionIdsByEntry = new Map<number, number[]>();
  for (const { transactionId, candidateIds } of candidatesByTransaction) {
    for (const entryId of candidateIds) {
      const transactionIds = transactionIdsByEntry.get(entryId) ?? [];
      transactionIds.push(transactionId);
      transactionIdsByEntry.set(entryId, transactionIds);
    }
  }

  return candidatesByTransaction
    .filter(({ candidateIds }) => candidateIds.length === 1)
    .filter(({ candidateIds }) => transactionIdsByEntry.get(candidateIds[0])?.length === 1)
    .map(({ transactionId, candidateIds }) => ({ transactionId, journalEntryId: candidateIds[0] }))
    .sort((left, right) => left.transactionId - right.transactionId);
}

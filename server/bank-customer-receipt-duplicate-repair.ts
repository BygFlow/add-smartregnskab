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

type DuplicateReceiptSpec = {
  key: string;
  date: string;
  amount: number;
  invoiceReference: string;
  accountRef: string;
  requiredImportedReversalDate?: string;
};

export type CustomerReceiptDuplicateRepairRow = {
  key: string;
  transactionId: number;
  transactionWasMatched: boolean;
  keepEntryId: number;
  duplicateEntryId: number;
  neutralizeEntryId: number | null;
  amount: number;
  invoiceReference: string;
};

export type CustomerReceiptDuplicateRepairPlan = {
  safe: boolean;
  rows: CustomerReceiptDuplicateRepairRow[];
  reasons: string[];
};

const SPECS: DuplicateReceiptSpec[] = [
  { key: "multiservice-523", date: "2025-10-09", amount: 165_167.44, invoiceReference: "523", accountRef: "0112" },
  { key: "multiservice-525", date: "2025-10-09", amount: 22_787.71, invoiceReference: "525", accountRef: "0112" },
  {
    key: "multiclean-207",
    date: "2025-08-12",
    amount: 595.00,
    invoiceReference: "207",
    accountRef: "6477",
    requiredImportedReversalDate: "2026-02-01",
  },
];

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
  return Math.abs(Number(left) - Number(right)) < 0.005;
}

function isPosted(status: unknown) {
  return ["bogfort", "afstemt"].includes(normalized(status));
}

function isImported(sourceType: unknown) {
  return ["saft import", "economic kladde"].includes(normalized(sourceType));
}

function isJournalMatch(value: unknown) {
  return ["journal", "journal entry"].includes(normalized(value));
}

function entryReferencesInvoice(entry: JournalEntryRow, invoiceReference: string) {
  const value = normalized(`${entry.reference ?? ""} ${entry.description ?? ""} ${entry.entryNumber ?? ""}`);
  return new RegExp(`(?:^|\\D)${invoiceReference}(?:\\D|$)`).test(value);
}

function netForAccount(lines: JournalLineRow[], accountId: number) {
  return lines
    .filter((line) => line.accountId === accountId)
    .reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
}

/**
 * Finds three documented customer-receipt duplicates in the imported 2025
 * journals. Invoice 503 is intentionally excluded because voucher 10020
 * already contains its exact imported 2025 reversal. Each plan row requires
 * exactly one real bank receipt and exactly two otherwise identical
 * bank/receivable journal entries. The later unused entry is reversed; the
 * earlier entry remains as the bank match. MultiClean invoice 207 additionally
 * requires its documented 2026 imported reversal, which is neutralized so the
 * 2025 correction cannot distort 2026. No revenue or VAT line is changed.
 */
export function findCustomerReceiptDuplicateRepairPlan(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
): CustomerReceiptDuplicateRepairPlan {
  const reasons: string[] = [];
  const rows: CustomerReceiptDuplicateRepairRow[] = [];
  const activeAccounts = accounts.filter((account) => account.active !== 0 && account.active !== false);
  const bankAccounts = activeAccounts.filter((account) => String(account.accountNumber ?? "") === "5820");
  const receivableAccounts = activeAccounts.filter((account) => String(account.accountNumber ?? "") === "5600");
  if (bankAccounts.length !== 1) reasons.push(`Forventede én aktiv bankkonto 5820, fandt ${bankAccounts.length}.`);
  if (receivableAccounts.length !== 1) reasons.push(`Forventede én aktiv debitorkonto 5600, fandt ${receivableAccounts.length}.`);
  if (reasons.length) return { safe: false, rows, reasons };

  const bankAccountId = bankAccounts[0].id;
  const receivableAccountId = receivableAccounts[0].id;
  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const current = linesByEntry.get(line.journalEntryId) ?? [];
    current.push(line);
    linesByEntry.set(line.journalEntryId, current);
  }
  const matchedTransactionsByEntry = new Map<number, BankTransactionRow[]>();
  for (const transaction of transactions) {
    if (normalized(transaction.status) !== "matchet" || !isJournalMatch(transaction.matchedType)) continue;
    const entryId = Number(transaction.matchedId);
    const current = matchedTransactionsByEntry.get(entryId) ?? [];
    current.push(transaction);
    matchedTransactionsByEntry.set(entryId, current);
  }

  let applicableSpecs = 0;
  for (const spec of SPECS) {
    const bankCandidates = transactions.filter((transaction) =>
      String(transaction.date ?? "").slice(0, 10) === spec.date
      && sameAmount(transaction.amount, spec.amount)
      && String(transaction.accountRef ?? "").replace(/\s+/g, "") === spec.accountRef
      && ["afventer", "matchet"].includes(normalized(transaction.status)),
    );
    const entryCandidates = entries.filter((entry) => {
      if (!isPosted(entry.status) || !isImported(entry.sourceType)) return false;
      if (String(entry.date ?? "").slice(0, 10) !== spec.date) return false;
      if (!entryReferencesInvoice(entry, spec.invoiceReference)) return false;
      const entryLines = (linesByEntry.get(entry.id) ?? [])
        .filter((line) => Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005);
      if (entryLines.length !== 2 || entryLines.some((line) => ![bankAccountId, receivableAccountId].includes(line.accountId))) return false;
      return sameAmount(netForAccount(entryLines, bankAccountId), spec.amount)
        && sameAmount(netForAccount(entryLines, receivableAccountId), -spec.amount);
    });
    const importedReversalCandidates = entries.filter((entry) => {
      if (!isPosted(entry.status) || !isImported(entry.sourceType)) return false;
      if (!entryReferencesInvoice(entry, spec.invoiceReference)) return false;
      const entryLines = (linesByEntry.get(entry.id) ?? [])
        .filter((line) => Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005);
      if (entryLines.length !== 2 || entryLines.some((line) => ![bankAccountId, receivableAccountId].includes(line.accountId))) return false;
      return sameAmount(netForAccount(entryLines, bankAccountId), -spec.amount)
        && sameAmount(netForAccount(entryLines, receivableAccountId), spec.amount);
    });

    if (!bankCandidates.length && !entryCandidates.length) continue;
    applicableSpecs += 1;
    if (bankCandidates.length !== 1) {
      reasons.push(`${spec.key}: forventede én bankpost, fandt ${bankCandidates.length}.`);
      continue;
    }
    if (entryCandidates.length !== 2) {
      reasons.push(`${spec.key}: forventede to identiske importerede betalinger, fandt ${entryCandidates.length}.`);
      continue;
    }
    const requiredReversals = spec.requiredImportedReversalDate
      ? importedReversalCandidates.filter((entry) => String(entry.date ?? "").slice(0, 10) === spec.requiredImportedReversalDate)
      : [];
    if (spec.requiredImportedReversalDate && requiredReversals.length !== 1) {
      reasons.push(`${spec.key}: forventede den dokumenterede importtilbageførsel ${spec.requiredImportedReversalDate}, fandt ${requiredReversals.length}.`);
      continue;
    }
    if (!spec.requiredImportedReversalDate && importedReversalCandidates.length) {
      reasons.push(`${spec.key}: fandt en uventet importtilbageførsel.`);
      continue;
    }

    const transaction = bankCandidates[0];
    const matchedEntryId = normalized(transaction.status) === "matchet" && isJournalMatch(transaction.matchedType)
      ? Number(transaction.matchedId)
      : null;
    if (matchedEntryId && !entryCandidates.some((entry) => entry.id === matchedEntryId)) {
      reasons.push(`${spec.key}: bankposten er matchet til en anden postering.`);
      continue;
    }

    const sortedEntries = [...entryCandidates].sort((left, right) => left.id - right.id);
    const keepEntry = matchedEntryId
      ? sortedEntries.find((entry) => entry.id === matchedEntryId)!
      : sortedEntries[0];
    const duplicateEntry = sortedEntries.find((entry) => entry.id !== keepEntry.id)!;
    if ((matchedTransactionsByEntry.get(duplicateEntry.id) ?? []).length) {
      reasons.push(`${spec.key}: den mulige dublet er allerede knyttet til en bankpost.`);
      continue;
    }
    const existingReversal = entries.filter((entry) =>
      normalized(entry.sourceType) === "bank customer receipt duplicate reversal"
      && Number(entry.sourceId) === duplicateEntry.id,
    );
    if (existingReversal.length) {
      reasons.push(`${spec.key}: dubletten er allerede tilbageført.`);
      continue;
    }
    const neutralizeEntryId = requiredReversals[0]?.id ?? null;
    if (neutralizeEntryId && (matchedTransactionsByEntry.get(neutralizeEntryId) ?? []).length) {
      reasons.push(`${spec.key}: importtilbageførslen er allerede knyttet til en bankpost.`);
      continue;
    }
    const existingNeutralizer = neutralizeEntryId ? entries.filter((entry) =>
      normalized(entry.sourceType) === "bank customer receipt duplicate neutralizer"
      && Number(entry.sourceId) === neutralizeEntryId,
    ) : [];
    if (existingNeutralizer.length) {
      reasons.push(`${spec.key}: importtilbageførslen er allerede neutraliseret.`);
      continue;
    }
    rows.push({
      key: spec.key,
      transactionId: transaction.id,
      transactionWasMatched: normalized(transaction.status) === "matchet",
      keepEntryId: keepEntry.id,
      duplicateEntryId: duplicateEntry.id,
      neutralizeEntryId,
      amount: spec.amount,
      invoiceReference: spec.invoiceReference,
    });
  }

  if (!applicableSpecs) reasons.push("Ingen af de dokumenterede kundebetalingsdubletter findes i dette regnskab.");
  return { safe: reasons.length === 0 && rows.length === applicableSpecs && rows.length > 0, rows, reasons };
}

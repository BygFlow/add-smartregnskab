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
  status?: string | null;
};

type JournalLineRow = {
  journalEntryId: number;
  accountId: number;
  debit?: number | null;
  credit?: number | null;
};

type ComponentSpec = {
  date: string;
  amount: number;
  direction?: "receipt" | "reversal";
  reference?: string;
};

type ReceiptSpec = {
  key: string;
  date: string;
  amount: number;
  accountRef: string;
  descriptionTokens: string[];
  reference: string;
  components: ComponentSpec[];
};

export type MultiCleanReceiptRepairRow = {
  key: string;
  transactionId: number;
  transactionDate: string;
  amount: number;
  reference: string;
  bankAccountId: number;
  receivableAccountId: number;
  reversalEntryIds: number[];
};

export type MultiCleanReceiptRepairPlan = {
  safe: boolean;
  rows: MultiCleanReceiptRepairRow[];
  neutralizeEntryIds: number[];
  reasons: string[];
};

const RECEIPTS: ReceiptSpec[] = [
  {
    key: "nordic-211",
    date: "2025-08-06",
    amount: 10_410.47,
    accountRef: "6477",
    descriptionTokens: ["nordic", "211"],
    reference: "Nordic 211 / faktura 184 + rente og gebyr",
    components: [
      { date: "2025-08-06", amount: 9_771.88, reference: "184" },
      { date: "2025-09-10", amount: 638.59 },
    ],
  },
  {
    key: "rengoering-kontor",
    date: "2025-09-05",
    amount: 1_476.10,
    accountRef: "6477",
    descriptionTokens: ["rengoring", "kontor"],
    reference: "Rykker 209 + faktura 219",
    components: [
      { date: "2025-09-05", amount: 2_724.70 },
      { date: "2025-08-01", amount: 1_248.60, reference: "219" },
    ],
  },
  {
    key: "nordic-215",
    date: "2025-09-23",
    amount: 6_173.53,
    accountRef: "6477",
    descriptionTokens: ["215"],
    reference: "Nordic 215 / faktura 222 + kundetilgodehavende",
    components: [
      { date: "2025-09-23", amount: 5_534.94, reference: "222" },
    ],
  },
  {
    key: "nordic-220",
    date: "2025-11-18",
    amount: 16_574.50,
    accountRef: "6477",
    descriptionTokens: ["220", "add", "multiclean"],
    reference: "Nordic 220 / faktura 254 + rente og gebyr",
    components: [
      { date: "2025-11-18", amount: 15_642.38, reference: "254" },
      { date: "2025-11-18", amount: 12_415.81, reference: "266" },
    ],
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

function entryReference(entry: JournalEntryRow) {
  return normalized(`${entry.reference ?? ""} ${entry.description ?? ""} ${entry.entryNumber ?? ""}`);
}

function netForAccount(lines: JournalLineRow[], accountId: number) {
  return lines
    .filter((line) => line.accountId === accountId)
    .reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
}

/**
 * Builds a fail-closed repair plan for four verified MultiClean receipts.
 * The source SAF-T rows are never deleted. They are reversed, and one exact
 * bank/debtor settlement is created per real bank row so the audit trail and
 * the bank reconciliation both remain complete.
 */
export function findMultiCleanReceiptRepairPlan(
  transactions: BankTransactionRow[],
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  accounts: AccountRow[],
): MultiCleanReceiptRepairPlan {
  const reasons: string[] = [];
  const activeAccounts = accounts.filter((account) => account.active !== 0 && account.active !== false);
  const bankAccounts = activeAccounts.filter((account) => String(account.accountNumber ?? "") === "5820");
  const receivableAccounts = activeAccounts.filter((account) => String(account.accountNumber ?? "") === "5600");
  if (bankAccounts.length !== 1) reasons.push(`Forventede én aktiv bankkonto 5820, fandt ${bankAccounts.length}.`);
  if (receivableAccounts.length !== 1) reasons.push(`Forventede én aktiv debitorkonto 5600, fandt ${receivableAccounts.length}.`);
  if (reasons.length) return { safe: false, rows: [], neutralizeEntryIds: [], reasons };

  const bankAccountId = bankAccounts[0].id;
  const receivableAccountId = receivableAccounts[0].id;
  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const current = linesByEntry.get(line.journalEntryId) ?? [];
    current.push(line);
    linesByEntry.set(line.journalEntryId, current);
  }
  const usedEntryIds = new Set(transactions
    .filter((transaction) => normalized(transaction.status) === "matchet" && isJournalMatch(transaction.matchedType))
    .map((transaction) => Number(transaction.matchedId))
    .filter((id) => Number.isInteger(id) && id > 0));
  const reservedEntries = new Set<number>();
  const rows: MultiCleanReceiptRepairRow[] = [];

  const findComponents = (spec: ComponentSpec) => entries.filter((entry) => {
    if (!isPosted(entry.status) || !isImported(entry.sourceType) || String(entry.date ?? "").slice(0, 10) !== spec.date) return false;
    if (usedEntryIds.has(entry.id) || reservedEntries.has(entry.id)) return false;
    if (spec.reference && !entryReference(entry).match(new RegExp(`(?:^|\\D)${spec.reference}(?:\\D|$)`))) return false;
    const entryLines = (linesByEntry.get(entry.id) ?? []).filter((line) => Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005);
    if (!entryLines.length || entryLines.some((line) => ![bankAccountId, receivableAccountId].includes(line.accountId))) return false;
    const bankNet = netForAccount(entryLines, bankAccountId);
    const receivableNet = netForAccount(entryLines, receivableAccountId);
    const sign = spec.direction === "reversal" ? -1 : 1;
    return sameAmount(bankNet, spec.amount * sign)
      && sameAmount(receivableNet, spec.amount * -sign)
      && sameAmount(bankNet + receivableNet, 0);
  });

  for (const receipt of RECEIPTS) {
    const transactionText = normalized(receipt.descriptionTokens.join(" "));
    const candidates = transactions.filter((transaction) => {
      const description = normalized(transaction.description);
      return normalized(transaction.status) === "afventer"
        && String(transaction.date ?? "").slice(0, 10) === receipt.date
        && sameAmount(transaction.amount, receipt.amount)
        && String(transaction.accountRef ?? "").replace(/\s+/g, "") === receipt.accountRef
        && receipt.descriptionTokens.every((token) => description.includes(normalized(token)));
    });
    if (candidates.length !== 1) {
      reasons.push(`${transactionText}: forventede én afventende bankpost, fandt ${candidates.length}.`);
      continue;
    }

    const reversalEntryIds: number[] = [];
    for (const component of receipt.components) {
      const componentCandidates = findComponents(component);
      if (componentCandidates.length !== 1) {
        reasons.push(`${receipt.key}: komponent ${component.date} / ${component.amount.toFixed(2)} gav ${componentCandidates.length} entydige SAF-T-poster.`);
        continue;
      }
      reversalEntryIds.push(componentCandidates[0].id);
      reservedEntries.add(componentCandidates[0].id);
    }
    if (reversalEntryIds.length !== receipt.components.length) continue;
    rows.push({
      key: receipt.key,
      transactionId: candidates[0].id,
      transactionDate: receipt.date,
      amount: receipt.amount,
      reference: receipt.reference,
      bankAccountId,
      receivableAccountId,
      reversalEntryIds,
    });
  }

  const neutralizerCandidates = findComponents({
    date: "2026-02-01",
    amount: 12_415.81,
    direction: "reversal",
    reference: "266",
  });
  if (neutralizerCandidates.length > 1) reasons.push(`Nordic 266: fandt ${neutralizerCandidates.length} mulige 2026-tilbageførsler.`);

  return {
    safe: reasons.length === 0 && rows.length === RECEIPTS.length,
    rows,
    neutralizeEntryIds: neutralizerCandidates.length === 1 ? [neutralizerCandidates[0].id] : [],
    reasons,
  };
}

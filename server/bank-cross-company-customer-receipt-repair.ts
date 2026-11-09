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

type ReceiptSpec = {
  key: string;
  date: string;
  amount: number;
  bankAccountRef: string;
  bankDescriptionTokens: string[];
  invoiceReference: string;
};

export type CrossCompanyCustomerReceiptRepairRow = {
  key: string;
  transactionId: number;
  sourceEntryId: number;
  date: string;
  amount: number;
  invoiceReference: string;
};

export type CrossCompanyCustomerReceiptRepairPlan = {
  safe: boolean;
  rows: CrossCompanyCustomerReceiptRepairRow[];
  total: number;
  multiServiceBankAccountId: number | null;
  multiServiceIntercompanyAccountId: number | null;
  multiCleanImportedBankAccountId: number | null;
  multiCleanReceivableAccountId: number | null;
  multiCleanIntercompanyAccountId: number | null;
  reasons: string[];
};

const RECEIPTS: ReceiptSpec[] = [
  { key: "mc-138", date: "2025-03-18", amount: 1_300.00, bankAccountRef: "13800707", bankDescriptionTokens: ["jorgen", "holst"], invoiceReference: "138" },
  { key: "mc-140", date: "2025-03-26", amount: 1_870.00, bankAccountRef: "13800707", bankDescriptionTokens: ["ihilp"], invoiceReference: "140" },
  { key: "mc-152", date: "2025-06-11", amount: 1_320.13, bankAccountRef: "0112", bankDescriptionTokens: ["sy", "consultancy"], invoiceReference: "152" },
  { key: "mc-247", date: "2025-11-03", amount: 3_300.00, bankAccountRef: "0112", bankDescriptionTokens: ["faktura", "247"], invoiceReference: "247" },
  { key: "mc-262", date: "2025-11-28", amount: 3_300.00, bankAccountRef: "0112", bankDescriptionTokens: ["faktura", "262"], invoiceReference: "262" },
  { key: "mc-286", date: "2025-12-16", amount: 2_625.00, bankAccountRef: "0112", bankDescriptionTokens: ["phillip", "christian"], invoiceReference: "286" },
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

function isPosted(value: unknown) {
  return ["bogfort", "afstemt"].includes(normalized(value));
}

function isImported(value: unknown) {
  return ["saft import", "economic kladde"].includes(normalized(value));
}

function exactAccount(accounts: AccountRow[], accountNumber: string, reasons: string[], scope: string) {
  const candidates = accounts.filter((account) => account.active !== 0
    && account.active !== false
    && String(account.accountNumber ?? "") === accountNumber);
  if (candidates.length !== 1) {
    reasons.push(`${scope}: forventede én aktiv konto ${accountNumber}, fandt ${candidates.length}.`);
    return null;
  }
  return candidates[0];
}

function netForAccount(lines: JournalLineRow[], accountId: number) {
  return lines.filter((line) => line.accountId === accountId)
    .reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
}

/**
 * Fail-closed plan for six MultiClean customer receipts that were paid into
 * Multi Service's real bank accounts. The imported MultiClean bank/debtor
 * settlement is reversed and replaced by intercompany/debtor. Multi Service
 * receives bank/intercompany. Revenue and VAT are never reposted.
 */
export function findCrossCompanyCustomerReceiptRepairPlan(input: {
  multiServiceTransactions: BankTransactionRow[];
  multiServiceAccounts: AccountRow[];
  multiCleanTransactions: BankTransactionRow[];
  multiCleanEntries: JournalEntryRow[];
  multiCleanLines: JournalLineRow[];
  multiCleanAccounts: AccountRow[];
}): CrossCompanyCustomerReceiptRepairPlan {
  const reasons: string[] = [];
  const msBank = exactAccount(input.multiServiceAccounts, "5820", reasons, "Multi Service");
  const msIntercompany = exactAccount(input.multiServiceAccounts, "6840", reasons, "Multi Service");
  const mcImportedBank = exactAccount(input.multiCleanAccounts, "5820", reasons, "MultiClean");
  const mcReceivable = exactAccount(input.multiCleanAccounts, "5600", reasons, "MultiClean");
  const mcIntercompany = exactAccount(input.multiCleanAccounts, "6837", reasons, "MultiClean");
  if (reasons.length) return {
    safe: false, rows: [], total: 0,
    multiServiceBankAccountId: msBank?.id ?? null,
    multiServiceIntercompanyAccountId: msIntercompany?.id ?? null,
    multiCleanImportedBankAccountId: mcImportedBank?.id ?? null,
    multiCleanReceivableAccountId: mcReceivable?.id ?? null,
    multiCleanIntercompanyAccountId: mcIntercompany?.id ?? null,
    reasons,
  };

  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of input.multiCleanLines) {
    const current = linesByEntry.get(line.journalEntryId) ?? [];
    current.push(line);
    linesByEntry.set(line.journalEntryId, current);
  }
  const usedEntryIds = new Set(input.multiCleanTransactions
    .filter((transaction) => normalized(transaction.status) === "matchet"
      && ["journal", "journal entry"].includes(normalized(transaction.matchedType)))
    .map((transaction) => Number(transaction.matchedId))
    .filter((id) => Number.isInteger(id) && id > 0));
  const rows: CrossCompanyCustomerReceiptRepairRow[] = [];
  const reservedEntries = new Set<number>();

  for (const receipt of RECEIPTS) {
    const bankCandidates = input.multiServiceTransactions.filter((transaction) => {
      const description = normalized(transaction.description);
      return normalized(transaction.status) === "afventer"
        && String(transaction.date ?? "").slice(0, 10) === receipt.date
        && sameAmount(transaction.amount, receipt.amount)
        && String(transaction.accountRef ?? "").replace(/\s+/g, "") === receipt.bankAccountRef
        && receipt.bankDescriptionTokens.every((token) => description.includes(normalized(token)));
    });
    if (bankCandidates.length !== 1) {
      reasons.push(`${receipt.key}: forventede én afventende Multi Service-bankpost, fandt ${bankCandidates.length}.`);
      continue;
    }

    const invoicePattern = new RegExp(`(?:^|\\D)${receipt.invoiceReference}(?:\\D|$)`);
    const entryCandidates = input.multiCleanEntries.filter((entry) => {
      if (!isPosted(entry.status) || !isImported(entry.sourceType) || usedEntryIds.has(entry.id) || reservedEntries.has(entry.id)) return false;
      if (String(entry.date ?? "").slice(0, 10) !== receipt.date) return false;
      if (!invoicePattern.test(normalized(`${entry.entryNumber ?? ""} ${entry.reference ?? ""} ${entry.description ?? ""}`))) return false;
      const nonZeroLines = (linesByEntry.get(entry.id) ?? []).filter((line) => Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005);
      if (nonZeroLines.length !== 2 || nonZeroLines.some((line) => ![mcImportedBank!.id, mcReceivable!.id].includes(line.accountId))) return false;
      const bankNet = netForAccount(nonZeroLines, mcImportedBank!.id);
      const debtorNet = netForAccount(nonZeroLines, mcReceivable!.id);
      return sameAmount(bankNet, receipt.amount)
        && sameAmount(debtorNet, -receipt.amount)
        && sameAmount(bankNet + debtorNet, 0);
    });
    if (entryCandidates.length !== 1) {
      reasons.push(`${receipt.key}: forventede én importeret MultiClean-bank/debitorpost, fandt ${entryCandidates.length}.`);
      continue;
    }
    reservedEntries.add(entryCandidates[0].id);
    rows.push({
      key: receipt.key,
      transactionId: bankCandidates[0].id,
      sourceEntryId: entryCandidates[0].id,
      date: receipt.date,
      amount: receipt.amount,
      invoiceReference: receipt.invoiceReference,
    });
  }

  return {
    safe: reasons.length === 0 && rows.length === RECEIPTS.length,
    rows,
    total: Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
    multiServiceBankAccountId: msBank?.id ?? null,
    multiServiceIntercompanyAccountId: msIntercompany?.id ?? null,
    multiCleanImportedBankAccountId: mcImportedBank?.id ?? null,
    multiCleanReceivableAccountId: mcReceivable?.id ?? null,
    multiCleanIntercompanyAccountId: mcIntercompany?.id ?? null,
    reasons,
  };
}

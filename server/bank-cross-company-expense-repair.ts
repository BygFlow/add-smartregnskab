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

export type CrossCompanyExpenseRepairPlan = {
  safe: boolean;
  amount: number;
  bankTransactionId: number | null;
  bankDate: string;
  sourceEntryId: number | null;
  sourceDate: string;
  multiServicePrivateAccountId: number | null;
  multiServiceIntercompanyAccountId: number | null;
  multiCleanBankAccountId: number | null;
  multiCleanIntercompanyAccountId: number | null;
  reasons: string[];
};

const SPEC = {
  amount: 791.70,
  bankDate: "2025-09-04",
  sourceDate: "2025-09-03",
  bankAccountRef: "6477",
  sourceEntryNumber: "50746",
  expenseAccount: "1310",
  expenseAmount: 633.36,
  vatAccount: "6903",
  vatAmount: 158.34,
  privateAccount: "6836",
  multiServiceIntercompanyAccount: "6840",
  multiCleanBankAccount: "5820",
  multiCleanIntercompanyAccount: "6837",
} as const;

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

function isActive(account: AccountRow) {
  return account.active !== 0 && account.active !== false;
}

function isPosted(status: unknown) {
  return ["bogfort", "afstemt"].includes(normalized(status));
}

function isImported(sourceType: unknown) {
  return ["saft import", "economic kladde"].includes(normalized(sourceType));
}

function exactAccount(accounts: AccountRow[], accountNumber: string, reasons: string[], scope: string) {
  const candidates = accounts.filter((account) => isActive(account) && String(account.accountNumber ?? "") === accountNumber);
  if (candidates.length !== 1) {
    reasons.push(`${scope}: forventede én aktiv konto ${accountNumber}, fandt ${candidates.length}.`);
    return null;
  }
  return candidates[0];
}

/**
 * Fail-closed plan for the documented Jem & Fix purchase. The expense and VAT
 * were already posted in Multi Service on voucher 50746, while the cash left
 * MultiClean's operational Lunar account ·6477 the following day. The repair
 * may therefore only reclassify the existing counterpart and match the bank;
 * it must never repost expense or VAT.
 */
export function findCrossCompanyJemFixRepairPlan(input: {
  multiCleanTransactions: BankTransactionRow[];
  multiCleanAccounts: AccountRow[];
  multiServiceEntries: JournalEntryRow[];
  multiServiceLines: JournalLineRow[];
  multiServiceAccounts: AccountRow[];
}): CrossCompanyExpenseRepairPlan {
  const reasons: string[] = [];
  const multiServicePrivate = exactAccount(input.multiServiceAccounts, SPEC.privateAccount, reasons, "Multi Service");
  const multiServiceIntercompany = exactAccount(input.multiServiceAccounts, SPEC.multiServiceIntercompanyAccount, reasons, "Multi Service");
  const multiCleanBank = exactAccount(input.multiCleanAccounts, SPEC.multiCleanBankAccount, reasons, "MultiClean");
  const multiCleanIntercompany = exactAccount(input.multiCleanAccounts, SPEC.multiCleanIntercompanyAccount, reasons, "MultiClean");

  const bankCandidates = input.multiCleanTransactions.filter((transaction) => {
    const description = normalized(transaction.description);
    return normalized(transaction.status) === "afventer"
      && String(transaction.date ?? "").slice(0, 10) === SPEC.bankDate
      && sameAmount(transaction.amount, -SPEC.amount)
      && String(transaction.accountRef ?? "").replace(/\s+/g, "") === SPEC.bankAccountRef
      && description.includes("jem")
      && description.includes("fix");
  });
  if (bankCandidates.length !== 1) {
    reasons.push(`MultiClean: forventede én afventende Jem & Fix-bankpost på -${SPEC.amount.toFixed(2)}, fandt ${bankCandidates.length}.`);
  }

  const accountNumberById = new Map(input.multiServiceAccounts.map((account) => [account.id, String(account.accountNumber ?? "")]));
  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of input.multiServiceLines) {
    const current = linesByEntry.get(line.journalEntryId) ?? [];
    current.push(line);
    linesByEntry.set(line.journalEntryId, current);
  }

  const sourceCandidates = input.multiServiceEntries.filter((entry) => {
    if (!isPosted(entry.status) || !isImported(entry.sourceType) || String(entry.date ?? "").slice(0, 10) !== SPEC.sourceDate) return false;
    const entryText = normalized(`${entry.entryNumber ?? ""} ${entry.reference ?? ""} ${entry.description ?? ""}`);
    if (!entryText.includes(SPEC.sourceEntryNumber) || !entryText.includes("jem") || !entryText.includes("fix")) return false;
    const nonZeroLines = (linesByEntry.get(entry.id) ?? []).filter((line) =>
      Math.abs(Number(line.debit || 0)) >= 0.005 || Math.abs(Number(line.credit || 0)) >= 0.005,
    );
    if (nonZeroLines.length !== 3) return false;
    const byAccount = new Map(nonZeroLines.map((line) => [accountNumberById.get(line.accountId), line]));
    const expense = byAccount.get(SPEC.expenseAccount);
    const vat = byAccount.get(SPEC.vatAccount);
    const privateCounterpart = byAccount.get(SPEC.privateAccount);
    return Boolean(expense && vat && privateCounterpart)
      && sameAmount(expense?.debit, SPEC.expenseAmount)
      && sameAmount(expense?.credit, 0)
      && sameAmount(vat?.debit, SPEC.vatAmount)
      && sameAmount(vat?.credit, 0)
      && sameAmount(privateCounterpart?.debit, 0)
      && sameAmount(privateCounterpart?.credit, SPEC.amount)
      && sameAmount(nonZeroLines.reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0), 0);
  });
  if (sourceCandidates.length !== 1) {
    reasons.push(`Multi Service: forventede én bogført SAF-T-post 50746 med præcis udgift, moms og modpost, fandt ${sourceCandidates.length}.`);
  }

  return {
    safe: reasons.length === 0,
    amount: SPEC.amount,
    bankTransactionId: bankCandidates.length === 1 ? bankCandidates[0].id : null,
    bankDate: SPEC.bankDate,
    sourceEntryId: sourceCandidates.length === 1 ? sourceCandidates[0].id : null,
    sourceDate: SPEC.sourceDate,
    multiServicePrivateAccountId: multiServicePrivate?.id ?? null,
    multiServiceIntercompanyAccountId: multiServiceIntercompany?.id ?? null,
    multiCleanBankAccountId: multiCleanBank?.id ?? null,
    multiCleanIntercompanyAccountId: multiCleanIntercompany?.id ?? null,
    reasons,
  };
}

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
  name?: string | null;
  active?: number | boolean | null;
};

export type KnownBankChargeRepairRow = {
  transactionId: number;
  date: string;
  amount: number;
  description: string;
  bankAccountId: number;
  expenseAccountId: number;
  expenseAccountNumber: "3629" | "4410";
  kind: "rejection_fee" | "bank_interest_expense";
};

export type KnownBankChargeRepairPlan = {
  safe: boolean;
  rows: KnownBankChargeRepairRow[];
  total: number;
  interestExpense: number;
  rejectionFee: number;
  reasons: string[];
};

const EXPECTED = [
  { date: "2025-09-30", amount: -21.30, description: "Rente", expenseAccountNumber: "4410" as const, kind: "bank_interest_expense" as const },
  { date: "2025-12-02", amount: -250.00, description: "Rejection fee - BS", expenseAccountNumber: "3629" as const, kind: "rejection_fee" as const },
  { date: "2025-12-30", amount: -4.88, description: "Rente", expenseAccountNumber: "4410" as const, kind: "bank_interest_expense" as const },
];

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae").replaceAll("ø", "o").replaceAll("å", "a")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function sameAmount(left: unknown, right: unknown) {
  return Math.abs(Number(left) - Number(right)) < 0.005;
}

function exactAccount(
  accounts: AccountRow[],
  number: string,
  namePattern: RegExp,
  reasons: string[],
) {
  const rows = accounts.filter((row) => row.active !== 0
    && row.active !== false
    && String(row.accountNumber ?? "") === number
    && namePattern.test(normalized(row.name)));
  if (rows.length !== 1) reasons.push(`Forventede én aktiv konto ${number} med korrekt kontonavn, fandt ${rows.length}.`);
  return rows.length === 1 ? rows[0] : null;
}

export function findKnownBankChargeRepairPlan(
  transactions: BankTransactionRow[],
  accounts: AccountRow[],
): KnownBankChargeRepairPlan {
  const reasons: string[] = [];
  const bank = exactAccount(accounts, "5820", /bankkonto|bank konto/, reasons);
  const bankFees = exactAccount(accounts, "3629", /bank.*gebyr|gebyr.*bank/, reasons);
  const bankInterest = exactAccount(accounts, "4410", /renteudgift.*bank|bank.*renteudgift/, reasons);
  if (!bank || !bankFees || !bankInterest) {
    return { safe: false, rows: [], total: 0, interestExpense: 0, rejectionFee: 0, reasons };
  }

  const rows: KnownBankChargeRepairRow[] = [];
  for (const expected of EXPECTED) {
    const matches = transactions.filter((row) => normalized(row.status) === "afventer"
      && String(row.date ?? "").slice(0, 10) === expected.date
      && sameAmount(row.amount, expected.amount)
      && String(row.accountRef ?? "").replace(/\s+/g, "") === "0112"
      && normalized(row.description) === normalized(expected.description));
    if (matches.length !== 1) {
      reasons.push(`${expected.date} ${expected.description}: forventede én åben bankpost på ${Math.abs(expected.amount).toFixed(2)} kr., fandt ${matches.length}.`);
      continue;
    }
    const expense = expected.expenseAccountNumber === "3629" ? bankFees : bankInterest;
    rows.push({
      transactionId: matches[0].id,
      date: expected.date,
      amount: Math.abs(expected.amount),
      description: expected.description,
      bankAccountId: bank.id,
      expenseAccountId: expense.id,
      expenseAccountNumber: expected.expenseAccountNumber,
      kind: expected.kind,
    });
  }

  if (new Set(rows.map((row) => row.transactionId)).size !== rows.length) {
    reasons.push("Den samme bankpost blev fundet til mere end én rettelse.");
  }
  const interestExpense = rows.filter((row) => row.kind === "bank_interest_expense").reduce((sum, row) => sum + row.amount, 0);
  const rejectionFee = rows.filter((row) => row.kind === "rejection_fee").reduce((sum, row) => sum + row.amount, 0);
  return {
    safe: reasons.length === 0 && rows.length === EXPECTED.length,
    rows,
    total: interestExpense + rejectionFee,
    interestExpense,
    rejectionFee,
    reasons,
  };
}

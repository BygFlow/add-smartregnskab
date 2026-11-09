type BankTransactionRow = {
  id?: number;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  balance?: number | null;
  provider?: string | null;
  accountRef?: string | null;
  externalId?: string | null;
  status?: string | null;
};

export type DanskeMarchCompletionRow = {
  date: string;
  description: string;
  amount: number;
  balance: number;
  provider: "danske-bank";
  accountRef: "13800707";
  externalId: string;
};

export type DanskeMarchCompletionPlan = {
  safe: boolean;
  alreadyComplete: boolean;
  rows: DanskeMarchCompletionRow[];
  existing2025Count: number;
  expectedFinalCount: number;
  endingBalance: number;
  reasons: string[];
};

const ACCOUNT_REF = "13800707";
const BASE_COUNT = 214;
const FINAL_COUNT = 231;
const ENDING_BALANCE = 1_046.58;

function externalId(row: Omit<DanskeMarchCompletionRow, "externalId">) {
  return [
    row.provider,
    row.accountRef,
    row.date,
    row.amount.toFixed(2),
    row.balance.toFixed(2),
    row.description,
  ].join("|");
}

function row(date: string, description: string, amount: number, balance: number): DanskeMarchCompletionRow {
  const value = { date, description, amount, balance, provider: "danske-bank" as const, accountRef: ACCOUNT_REF as "13800707" };
  return { ...value, externalId: externalId(value) };
}

/**
 * Executed rows shown on the customer's official Danske Bank quarterly
 * statement no. 4 for 1 January through 31 March 2025. The earlier CSV export
 * ends on 27 March at DKK 11,354.70 and therefore lacks these rows. Three
 * reservations shown as "Venter" in a separate activity view are deliberately
 * excluded because they do not appear as executed rows in the statement.
 */
export const DANSKE_MARCH_2025_COMPLETION_ROWS: DanskeMarchCompletionRow[] = [
  row("2025-03-27", "Til Dragana dan", -275.33, 11_079.37),
  row("2025-03-28", "Bauhaus Danmark", -620.86, 10_458.51),
  row("2025-03-28", "FACEBK *B2JVNKY442", -472.00, 9_986.51),
  row("2025-03-28", "Til Dragana dan", -100.00, 9_886.51),
  row("2025-03-31", "Til Dragana dan", -100.00, 9_786.51),
  row("2025-03-31", "Elgiganten Hilleroed", -499.00, 9_287.51),
  row("2025-03-31", "Bauhaus Danmark", -719.95, 8_567.56),
  row("2025-03-31", "GOOGLE *ADS717109759", -4_000.00, 4_567.56),
  row("2025-03-31", "GOOGLE*ADS7171097593", -2_012.78, 2_554.78),
  row("2025-03-31", "OPENAI *CHATGPT SUBS", -138.72, 2_416.06),
  row("2025-03-31", "Udl. kortbetaling, 1.50% af DKK -138.72 - OPENAI *CHATGPT SUBS", -2.08, 2_413.98),
  row("2025-03-31", "Til Dragana dan", -100.00, 2_313.98),
  row("2025-03-31", "Til Aurel Dan", -500.00, 1_813.98),
  row("2025-03-31", "Til Aurel Dan", -200.00, 1_613.98),
  row("2025-03-31", "Til Dragana dan", -100.00, 1_513.98),
  row("2025-03-31", "Gebyrer ifølge nota", -453.00, 1_060.98),
  row("2025-03-31", "Rente", -14.40, ENDING_BALANCE),
];

function sameAmount(left: unknown, right: unknown) {
  return Math.abs(Number(left) - Number(right)) < 0.005;
}

function exactRow(transaction: BankTransactionRow, expected: DanskeMarchCompletionRow) {
  return String(transaction.date ?? "").slice(0, 10) === expected.date
    && String(transaction.description ?? "") === expected.description
    && sameAmount(transaction.amount, expected.amount)
    && sameAmount(transaction.balance, expected.balance)
    && String(transaction.accountRef ?? "").replace(/\s+/g, "") === ACCOUNT_REF
    && String(transaction.provider ?? "") === expected.provider
    && String(transaction.externalId ?? "") === expected.externalId;
}

export function findDanskeMarchCompletionPlan(transactions: BankTransactionRow[]): DanskeMarchCompletionPlan {
  const reasons: string[] = [];
  const accountRows = transactions.filter((transaction) =>
    String(transaction.accountRef ?? "").replace(/\s+/g, "") === ACCOUNT_REF
    && String(transaction.date ?? "").startsWith("2025-"),
  );
  const completedMatches = DANSKE_MARCH_2025_COMPLETION_ROWS.map((expected) =>
    accountRows.filter((transaction) => exactRow(transaction, expected)).length,
  );
  const completeCount = completedMatches.filter((count) => count === 1).length;
  const duplicateCount = completedMatches.filter((count) => count > 1).length;

  if (duplicateCount) reasons.push(`${duplicateCount} dokumenterede Danske-poster findes mere end én gang.`);
  if (completeCount === DANSKE_MARCH_2025_COMPLETION_ROWS.length && accountRows.length === FINAL_COUNT && !duplicateCount) {
    return {
      safe: true,
      alreadyComplete: true,
      rows: [],
      existing2025Count: accountRows.length,
      expectedFinalCount: FINAL_COUNT,
      endingBalance: ENDING_BALANCE,
      reasons,
    };
  }
  if (completeCount > 0) reasons.push(`Kun ${completeCount} af 17 supplerende Danske-poster findes; delvis import afvises.`);
  if (accountRows.length !== BASE_COUNT) reasons.push(`Forventede ${BASE_COUNT} eksisterende 2025-poster på konto 13800707, fandt ${accountRows.length}.`);

  const anchor = accountRows.filter((transaction) =>
    String(transaction.date ?? "").slice(0, 10) === "2025-03-27"
    && String(transaction.description ?? "") === "Til Aurel Dan"
    && sameAmount(transaction.amount, -2_000)
    && sameAmount(transaction.balance, 11_354.70),
  );
  if (anchor.length !== 1) reasons.push(`Forventede én CSV-slutpost på 11.354,70 kr., fandt ${anchor.length}.`);

  const laterRows = accountRows.filter((transaction) => String(transaction.date ?? "").slice(0, 10) > "2025-03-27");
  if (laterRows.length) reasons.push(`Fandt ${laterRows.length} andre Danske-poster efter CSV-perioden.`);

  return {
    safe: reasons.length === 0,
    alreadyComplete: false,
    rows: reasons.length === 0 ? DANSKE_MARCH_2025_COMPLETION_ROWS : [],
    existing2025Count: accountRows.length,
    expectedFinalCount: FINAL_COUNT,
    endingBalance: ENDING_BALANCE,
    reasons,
  };
}

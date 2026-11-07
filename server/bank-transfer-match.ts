export type BankTransferRow = {
  id: number;
  date: string;
  amount: number;
  status?: string | null;
  accountRef?: string | null;
  description?: string | null;
};

function normalizedAccountRef(value: unknown) {
  return String(value ?? "").trim();
}

function sameDate(left: unknown, right: unknown) {
  return String(left ?? "").slice(0, 10) === String(right ?? "").slice(0, 10);
}

function oppositeAmount(left: unknown, right: unknown) {
  return Math.abs(Number(left ?? 0) + Number(right ?? 0)) < 0.01;
}

function isPending(row: BankTransferRow) {
  return row.status === "afventer" || row.status === "pending" || row.status === "unmatched";
}

/**
 * Finds possible counterparts for a deliberate manual bank-to-bank match.
 * A manual match may repair older imports without an account reference, but a
 * known account may never be matched against itself.
 */
export function findInternalTransferCandidates(
  transaction: BankTransferRow,
  transactions: BankTransferRow[],
) {
  if (!isPending(transaction)) return [];
  const sourceAccountRef = normalizedAccountRef(transaction.accountRef);
  return transactions
    .filter((candidate) => candidate.id !== transaction.id)
    .filter(isPending)
    .filter((candidate) => sameDate(candidate.date, transaction.date))
    .filter((candidate) => oppositeAmount(candidate.amount, transaction.amount))
    .filter((candidate) => {
      const candidateAccountRef = normalizedAccountRef(candidate.accountRef);
      return !(sourceAccountRef && candidateAccountRef && sourceAccountRef === candidateAccountRef);
    })
    .sort((left, right) => left.id - right.id);
}

/**
 * Returns reciprocal, one-to-one transfer pairs that are safe to bulk match.
 * Bulk matching is deliberately stricter than manual matching: both rows must
 * have distinct, known bank-account references, and neither row may have a
 * second possible counterpart.
 */
export function findSafeInternalTransferPairs(transactions: BankTransferRow[]) {
  const pendingWithAccount = transactions.filter((transaction) =>
    isPending(transaction) && normalizedAccountRef(transaction.accountRef),
  );
  const candidateIds = new Map<number, number[]>();
  for (const transaction of pendingWithAccount) {
    const sourceAccountRef = normalizedAccountRef(transaction.accountRef);
    const matches = pendingWithAccount
      .filter((candidate) => candidate.id !== transaction.id)
      .filter((candidate) => normalizedAccountRef(candidate.accountRef) !== sourceAccountRef)
      .filter((candidate) => sameDate(candidate.date, transaction.date))
      .filter((candidate) => oppositeAmount(candidate.amount, transaction.amount))
      .map((candidate) => candidate.id);
    candidateIds.set(transaction.id, matches);
  }

  const byId = new Map(pendingWithAccount.map((transaction) => [transaction.id, transaction]));
  const pairs: Array<[BankTransferRow, BankTransferRow]> = [];
  const used = new Set<number>();
  for (const transaction of pendingWithAccount) {
    if (used.has(transaction.id)) continue;
    const matches = candidateIds.get(transaction.id) ?? [];
    if (matches.length !== 1) continue;
    const counterpartId = matches[0];
    if ((candidateIds.get(counterpartId) ?? []).length !== 1
      || candidateIds.get(counterpartId)?.[0] !== transaction.id) continue;
    const counterpart = byId.get(counterpartId);
    if (!counterpart) continue;
    used.add(transaction.id);
    used.add(counterpart.id);
    pairs.push(transaction.id < counterpart.id
      ? [transaction, counterpart]
      : [counterpart, transaction]);
  }
  return pairs.sort((left, right) => left[0].id - right[0].id);
}

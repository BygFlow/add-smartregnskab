export type BankTransferRow = {
  id: number;
  date: string;
  amount: number;
  status?: string | null;
  accountRef?: string | null;
  description?: string | null;
  matchedType?: string | null;
  matchedId?: number | null;
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

function dayDistance(left: unknown, right: unknown) {
  const leftTime = Date.parse(`${String(left ?? "").slice(0, 10)}T00:00:00Z`);
  const rightTime = Date.parse(`${String(right ?? "").slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(leftTime - rightTime) / 86_400_000;
}

function normalizedDescription(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSafeReversalDescription(row: BankTransferRow) {
  const description = normalizedDescription(row.description);
  if (description.length < 2) return false;
  return !/(^| )(transfer|overforsel|income sorter|lon|aconto|privat|digitalt marketing|add multi|udlign|overtr)( |$)/.test(description);
}

function isPending(row: BankTransferRow) {
  return row.status === "afventer" || row.status === "pending" || row.status === "unmatched";
}

function isMatchedToJournal(row: BankTransferRow) {
  return row.status === "matchet" && ["journal", "journal_entry"].includes(String(row.matchedType ?? ""));
}

function isDescribedAsInternalTransfer(row: BankTransferRow) {
  const description = String(row.description ?? "").toLocaleLowerCase("da-DK");
  return /(transfer|overf.rsel|income sorter|l.n skat moms konto|digitalt marketing|add multi service|add multiclean service|udlign|overtr)/i.test(description);
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

/**
 * Finds the remaining side of an internal transfer when the opposite bank row
 * is already reconciled to an imported journal entry. The journal link is
 * preserved; only the still-pending counterpart receives a bank-transfer link.
 * Both descriptions must identify an internal movement, and the relationship
 * must be reciprocal and one-to-one across distinct, known bank accounts.
 */
export function findSafeInternalTransferCounterparts(transactions: BankTransferRow[]) {
  const pendingWithAccount = transactions.filter((transaction) =>
    isPending(transaction)
      && normalizedAccountRef(transaction.accountRef)
      && isDescribedAsInternalTransfer(transaction),
  );
  const matchedJournalRows = transactions.filter((transaction) =>
    isMatchedToJournal(transaction)
      && normalizedAccountRef(transaction.accountRef)
      && isDescribedAsInternalTransfer(transaction),
  );

  const candidatesForPending = new Map<number, BankTransferRow[]>();
  for (const pending of pendingWithAccount) {
    const sourceAccountRef = normalizedAccountRef(pending.accountRef);
    const matches = matchedJournalRows
      .filter((candidate) => normalizedAccountRef(candidate.accountRef) !== sourceAccountRef)
      .filter((candidate) => sameDate(candidate.date, pending.date))
      .filter((candidate) => oppositeAmount(candidate.amount, pending.amount));
    candidatesForPending.set(pending.id, matches);
  }

  const pendingForMatched = new Map<number, BankTransferRow[]>();
  for (const matched of matchedJournalRows) {
    const sourceAccountRef = normalizedAccountRef(matched.accountRef);
    const matches = pendingWithAccount
      .filter((candidate) => normalizedAccountRef(candidate.accountRef) !== sourceAccountRef)
      .filter((candidate) => sameDate(candidate.date, matched.date))
      .filter((candidate) => oppositeAmount(candidate.amount, matched.amount));
    pendingForMatched.set(matched.id, matches);
  }

  const results: Array<{ pending: BankTransferRow; journalMatched: BankTransferRow }> = [];
  for (const pending of pendingWithAccount) {
    const matches = candidatesForPending.get(pending.id) ?? [];
    if (matches.length !== 1) continue;
    const journalMatched = matches[0];
    const reciprocal = pendingForMatched.get(journalMatched.id) ?? [];
    if (reciprocal.length !== 1 || reciprocal[0].id !== pending.id) continue;
    results.push({ pending, journalMatched });
  }
  return results.sort((left, right) => left.pending.id - right.pending.id);
}

/**
 * Finds unambiguous payment/reversal pairs on the same bank account. A pair is
 * only accepted when the normalized merchant text and amount are exact,
 * settlement dates are one to four days apart, and both sides have exactly one
 * reciprocal candidate. Generic transfers, payroll and private movements are
 * deliberately excluded.
 */
export function findSafeBankReversalPairs(transactions: BankTransferRow[]) {
  const pending = transactions.filter((transaction) =>
    isPending(transaction)
      && normalizedAccountRef(transaction.accountRef)
      && isSafeReversalDescription(transaction),
  );
  const candidates = new Map<number, BankTransferRow[]>();
  for (const transaction of pending) {
    const accountRef = normalizedAccountRef(transaction.accountRef);
    const description = normalizedDescription(transaction.description);
    const matches = pending
      .filter((candidate) => candidate.id !== transaction.id)
      .filter((candidate) => normalizedAccountRef(candidate.accountRef) === accountRef)
      .filter((candidate) => normalizedDescription(candidate.description) === description)
      .filter((candidate) => oppositeAmount(candidate.amount, transaction.amount))
      .filter((candidate) => {
        const days = dayDistance(candidate.date, transaction.date);
        return days >= 1 && days <= 4;
      });
    candidates.set(transaction.id, matches);
  }

  const pairs: Array<[BankTransferRow, BankTransferRow]> = [];
  const used = new Set<number>();
  for (const transaction of pending) {
    if (used.has(transaction.id)) continue;
    const matches = candidates.get(transaction.id) ?? [];
    if (matches.length !== 1) continue;
    const counterpart = matches[0];
    const reciprocal = candidates.get(counterpart.id) ?? [];
    if (reciprocal.length !== 1 || reciprocal[0].id !== transaction.id) continue;
    used.add(transaction.id);
    used.add(counterpart.id);
    pairs.push(transaction.id < counterpart.id
      ? [transaction, counterpart]
      : [counterpart, transaction]);
  }
  return pairs.sort((left, right) => left[0].id - right[0].id);
}

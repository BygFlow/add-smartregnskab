type JournalEntry = {
  id: number;
  entryNumber?: string | null;
  date?: string | null;
  description?: string | null;
  reference?: string | null;
  sourceType?: string | null;
  status?: string | null;
};

type JournalLine = {
  id?: number;
  journalEntryId: number;
  accountId: number;
  debit?: number | null;
  credit?: number | null;
  vatCode?: string | null;
};

type Account = { id: number };

export type EconomicDraftIssue = {
  entryId: number;
  entryNumber: string;
  reason: string;
};

const postedStatuses = new Set(["bogført", "bogfort", "afstemt", "posted"]);
const allowedVatCodes = new Set(["", "I25", "IV25", "IY25", "OBPK", "REP", "TLF.", "U25"]);
const cents = (value: unknown) => Math.round(Number(value || 0) * 100);
const normalized = (value: unknown) => String(value || "").trim().toLowerCase();

function linesByEntry(lines: JournalLine[]) {
  const grouped = new Map<number, JournalLine[]>();
  for (const line of lines) {
    const group = grouped.get(Number(line.journalEntryId)) || [];
    group.push(line);
    grouped.set(Number(line.journalEntryId), group);
  }
  return grouped;
}

function signature(entry: JournalEntry, lines: JournalLine[]) {
  const reference = normalized(entry.reference) || normalized(entry.description);
  const normalizedLines = lines
    .map((line) => [Number(line.accountId), cents(line.debit), cents(line.credit)])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
  return JSON.stringify([String(entry.date || "").slice(0, 10), reference, normalizedLines]);
}

export function reviewEconomicJournalDrafts(entries: JournalEntry[], lines: JournalLine[], accounts: Account[]) {
  const drafts = entries.filter((entry) => entry.sourceType === "economic_kladde" && normalized(entry.status) === "kladde");
  const draftIds = new Set(drafts.map((entry) => entry.id));
  const accountIds = new Set(accounts.map((account) => Number(account.id)));
  const grouped = linesByEntry(lines);
  const issues: EconomicDraftIssue[] = [];
  const exactPostedDuplicates: Array<{ entryId: number; entryNumber: string; postedEntryId: number }> = [];
  const internalDuplicates: Array<{ entryId: number; entryNumber: string; duplicateEntryId: number }> = [];
  const postedSignatures = new Map<string, number>();
  const draftSignatures = new Map<string, number>();
  const entryNumbers = new Map<string, number>();
  let lineCount = 0;
  let totalDebitCents = 0;
  let totalCreditCents = 0;

  for (const entry of entries) {
    const key = normalized(entry.entryNumber);
    if (key) entryNumbers.set(key, (entryNumbers.get(key) || 0) + 1);
    if (draftIds.has(entry.id) || !postedStatuses.has(normalized(entry.status))) continue;
    const entryLines = grouped.get(entry.id) || [];
    if (entryLines.length >= 2) postedSignatures.set(signature(entry, entryLines), entry.id);
  }

  for (const entry of drafts) {
    const entryNumber = String(entry.entryNumber || entry.id);
    const entryLines = grouped.get(entry.id) || [];
    lineCount += entryLines.length;
    if (entryLines.length < 2) issues.push({ entryId: entry.id, entryNumber, reason: "Posteringen har færre end to linjer." });
    const debit = entryLines.reduce((sum, line) => sum + cents(line.debit), 0);
    const credit = entryLines.reduce((sum, line) => sum + cents(line.credit), 0);
    totalDebitCents += debit;
    totalCreditCents += credit;
    if (debit !== credit) issues.push({ entryId: entry.id, entryNumber, reason: "Debet og kredit balancerer ikke." });
    for (const line of entryLines) {
      const debitCents = cents(line.debit);
      const creditCents = cents(line.credit);
      if (!accountIds.has(Number(line.accountId))) issues.push({ entryId: entry.id, entryNumber, reason: `Konto ${line.accountId} findes ikke.` });
      if (debitCents < 0 || creditCents < 0 || (debitCents > 0 && creditCents > 0) || (debitCents === 0 && creditCents === 0)) {
        issues.push({ entryId: entry.id, entryNumber, reason: `Posteringslinje ${line.id || ""} har et ugyldigt beløb.` });
      }
      const vatCode = String(line.vatCode || "").trim().toUpperCase();
      if (!allowedVatCodes.has(vatCode)) issues.push({ entryId: entry.id, entryNumber, reason: `Ukendt momskode ${vatCode}.` });
    }
    if ((entryNumbers.get(normalized(entry.entryNumber)) || 0) > 1) issues.push({ entryId: entry.id, entryNumber, reason: "Bilagsnummeret findes flere gange." });
    const entrySignature = signature(entry, entryLines);
    const postedEntryId = postedSignatures.get(entrySignature);
    if (postedEntryId) exactPostedDuplicates.push({ entryId: entry.id, entryNumber, postedEntryId });
    const duplicateEntryId = draftSignatures.get(entrySignature);
    if (duplicateEntryId) internalDuplicates.push({ entryId: entry.id, entryNumber, duplicateEntryId });
    else draftSignatures.set(entrySignature, entry.id);
  }

  if (exactPostedDuplicates.length) {
    for (const duplicate of exactPostedDuplicates) issues.push({ entryId: duplicate.entryId, entryNumber: duplicate.entryNumber, reason: `Matcher allerede bogført postering ${duplicate.postedEntryId}.` });
  }
  if (internalDuplicates.length) {
    for (const duplicate of internalDuplicates) issues.push({ entryId: duplicate.entryId, entryNumber: duplicate.entryNumber, reason: `Matcher kladde ${duplicate.duplicateEntryId}.` });
  }

  return {
    drafts: drafts.length,
    lines: lineCount,
    totalDebit: totalDebitCents / 100,
    totalCredit: totalCreditCents / 100,
    years: Array.from(new Set(drafts.map((entry) => String(entry.date || "").slice(0, 4)).filter(Boolean))).sort(),
    issues,
    exactPostedDuplicates,
    internalDuplicates,
    canPost: drafts.length > 0 && issues.length === 0,
    draftIds: drafts.map((entry) => entry.id),
  };
}

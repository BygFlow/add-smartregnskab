const DAY_MS = 24 * 60 * 60 * 1000;

type InboxDocument = {
  id: number;
  invoiceDate?: string | null;
  createdAt?: string | null;
  amount?: number | null;
};

type BankTransaction = {
  id: number;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  status?: string | null;
  matchedId?: number | null;
};

export type BankMatchSuggestion = {
  transactionId: number;
  date: string;
  description: string | null;
  amount: number;
  daysAfterInvoice: number;
  confidence: "hoej" | "middel" | "lav";
};

function dayValue(value: string | null | undefined): number | null {
  const day = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== day) return null;
  return parsed;
}

function compareDocuments(left: InboxDocument, right: InboxDocument): number {
  const leftDay = dayValue(left.invoiceDate);
  const rightDay = dayValue(right.invoiceDate);
  if (leftDay != null && rightDay != null && leftDay !== rightDay) return leftDay - rightDay;
  if (leftDay != null && rightDay == null) return -1;
  if (leftDay == null && rightDay != null) return 1;
  const leftReceived = dayValue(left.createdAt) ?? Number.MAX_SAFE_INTEGER;
  const rightReceived = dayValue(right.createdAt) ?? Number.MAX_SAFE_INTEGER;
  return leftReceived - rightReceived || left.id - right.id;
}

function findBankSuggestion(document: InboxDocument, transactions: BankTransaction[], used: Set<number>): BankMatchSuggestion | null {
  const invoiceDay = dayValue(document.invoiceDate);
  const documentAmount = Number(document.amount);
  if (invoiceDay == null || !Number.isFinite(documentAmount) || documentAmount <= 0) return null;

  const candidates = transactions.flatMap((transaction) => {
    const bankDay = dayValue(transaction.date);
    const bankAmount = Number(transaction.amount);
    if (used.has(transaction.id) || transaction.status !== "afventer" || transaction.matchedId != null
      || bankDay == null || !Number.isFinite(bankAmount)
      || Math.abs(Math.abs(bankAmount) - documentAmount) >= 0.01) return [];
    const daysAfterInvoice = Math.round((bankDay - invoiceDay) / DAY_MS);
    if (daysAfterInvoice < -3 || daysAfterInvoice > 60) return [];
    return [{ transaction, daysAfterInvoice }];
  }).sort((left, right) => Math.abs(left.daysAfterInvoice) - Math.abs(right.daysAfterInvoice)
    || left.transaction.id - right.transaction.id);

  const best = candidates[0];
  if (!best || !best.transaction.date || best.transaction.amount == null) return null;
  used.add(best.transaction.id);
  return {
    transactionId: best.transaction.id,
    date: best.transaction.date,
    description: best.transaction.description ?? null,
    amount: best.transaction.amount,
    daysAfterInvoice: best.daysAfterInvoice,
    confidence: Math.abs(best.daysAfterInvoice) <= 7 ? "hoej" : Math.abs(best.daysAfterInvoice) <= 30 ? "middel" : "lav",
  };
}

export function prepareDocumentInbox<T extends InboxDocument>(documents: T[], transactions: BankTransaction[]) {
  const ordered = [...documents].sort(compareDocuments);
  const used = new Set<number>();
  return ordered.map((document) => ({ ...document, bankMatch: findBankSuggestion(document, transactions, used) }));
}

type BankTransactionLike = {
  id: number;
  date?: string | null;
  description?: string | null;
  amount: number;
  status?: string | null;
  matchedType?: string | null;
  matchedId?: number | null;
};

type InvoiceLike = {
  id: number;
  invoiceNumber?: string | null;
  issueDate: string;
  dueDate?: string | null;
  totalAmount: number;
  status?: string | null;
};

type VoucherLike = {
  id: number;
  voucherNumber?: string | null;
  supplier?: string | null;
  date: string;
  amount: number;
  description?: string | null;
  status?: string | null;
};

export type BankDocumentType = "invoice" | "voucher";

export type BankDocumentCandidate = {
  id: number;
  type: BankDocumentType;
  number: string;
  label: string;
  date: string;
  dueDate?: string | null;
  amount: number;
  status?: string | null;
};

export type SafeBankDocumentMatch = {
  transactionId: number;
  documentId: number;
  type: BankDocumentType;
};

const cents = (value: number | null | undefined) => Math.round(Number(value ?? 0) * 100);

function normalizedText(value: unknown) {
  return String(value ?? "")
    .replace(/&amp;|&#38;|&#x26;/gi, "&")
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

function daysApart(left: unknown, right: unknown) {
  const leftTime = Date.parse(`${String(left ?? "").slice(0, 10)}T00:00:00Z`);
  const rightTime = Date.parse(`${String(right ?? "").slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / 86_400_000));
}

function exactInvoiceReference(description: unknown, invoiceNumber: unknown) {
  const descriptionText = normalizedText(description);
  const numberText = normalizedText(invoiceNumber).replace(/\s+/g, "");
  if (!descriptionText || !/^\d{1,8}$/.test(numberText)) return false;
  if (descriptionText === numberText) return true;
  if (!/(^| )(f|fak|faktura|indbet)( |$)/.test(descriptionText)) return false;
  const references: string[] = descriptionText.match(/\b\d{1,8}\b/g) ?? [];
  return references.includes(numberText);
}

function merchantTokens(value: unknown) {
  const ignored = new Set(["a", "s", "as", "aps", "danmark", "denmark", "og", "and", "amp"]);
  return normalizedText(value).split(" ").filter((token) => token && !ignored.has(token));
}

function strongMerchantMatch(left: unknown, right: unknown) {
  const generic = new Set(["betaling", "bilag", "butik", "faktura", "kort", "service", "transfer", "overforsel"]);
  const leftTokens = merchantTokens(left);
  const rightTokens = new Set(merchantTokens(right));
  return leftTokens.some((token) => token.length >= 3 && !generic.has(token) && rightTokens.has(token));
}

export function normalizeBankDocumentType(value: unknown): BankDocumentType | null {
  if (value === "invoice" || value === "faktura") return "invoice";
  if (value === "voucher" || value === "bilag") return "voucher";
  return null;
}

function usedDocumentIds(
  transactions: BankTransactionLike[],
  type: BankDocumentType,
  exceptTransactionId: number,
) {
  const aliases = type === "invoice" ? new Set(["invoice", "faktura"]) : new Set(["voucher", "bilag"]);
  return new Set(transactions
    .filter((row) => row.id !== exceptTransactionId && aliases.has(String(row.matchedType)) && row.matchedId)
    .map((row) => Number(row.matchedId)));
}

export function findBankDocumentCandidates(
  transaction: BankTransactionLike,
  type: BankDocumentType,
  transactions: BankTransactionLike[],
  invoices: InvoiceLike[],
  vouchers: VoucherLike[],
): BankDocumentCandidate[] {
  const usedIds = usedDocumentIds(transactions, type, transaction.id);
  const transactionCents = cents(transaction.amount);

  if (type === "invoice") {
    if (transactionCents <= 0) return [];
    return invoices
      .filter((invoice) => !usedIds.has(invoice.id) && cents(invoice.totalAmount) === transactionCents)
      .map((invoice) => ({
        id: invoice.id,
        type,
        number: invoice.invoiceNumber || String(invoice.id),
        label: `Faktura ${invoice.invoiceNumber || invoice.id}`,
        date: invoice.issueDate,
        dueDate: invoice.dueDate,
        amount: Number(invoice.totalAmount),
        status: invoice.status,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }

  if (transactionCents >= 0) return [];
  return vouchers
    .filter((voucher) => !usedIds.has(voucher.id) && Math.abs(cents(voucher.amount)) === Math.abs(transactionCents))
    .map((voucher) => ({
      id: voucher.id,
      type,
      number: voucher.voucherNumber || String(voucher.id),
      label: voucher.supplier || voucher.description || `Bilag ${voucher.voucherNumber || voucher.id}`,
      date: voucher.date,
      amount: Math.abs(Number(voucher.amount)),
      status: voucher.status,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

/**
 * Finds only reciprocal one-to-one document matches with semantic evidence.
 * Invoices require an explicit invoice number in the bank text. Vouchers
 * require a strong supplier/description match within four days. Amount and
 * direction are already enforced by findBankDocumentCandidates.
 */
export function findSafeBankDocumentMatches(
  transactions: BankTransactionLike[],
  invoices: InvoiceLike[],
  vouchers: VoucherLike[],
): SafeBankDocumentMatch[] {
  const pending = transactions.filter((row) => row.status === "afventer");
  const evidenceByTransaction = pending.map((transaction) => {
    const type: BankDocumentType = cents(transaction.amount) > 0 ? "invoice" : "voucher";
    const candidates = findBankDocumentCandidates(transaction, type, transactions, invoices, vouchers)
      .filter((candidate) => {
        if (type === "invoice") {
          const invoice = invoices.find((row) => row.id === candidate.id);
          return !!invoice && exactInvoiceReference(transaction.description, invoice.invoiceNumber);
        }
        const voucher = vouchers.find((row) => row.id === candidate.id);
        return !!voucher
          && daysApart(transaction.date, voucher.date) <= 4
          && (strongMerchantMatch(transaction.description, voucher.supplier)
            || strongMerchantMatch(transaction.description, voucher.description));
      });
    return { transactionId: transaction.id, type, candidates };
  }).filter(({ candidates }) => candidates.length > 0);

  const transactionIdsByDocument = new Map<string, number[]>();
  for (const evidence of evidenceByTransaction) {
    for (const candidate of evidence.candidates) {
      const key = `${evidence.type}:${candidate.id}`;
      const transactionIds = transactionIdsByDocument.get(key) ?? [];
      transactionIds.push(evidence.transactionId);
      transactionIdsByDocument.set(key, transactionIds);
    }
  }

  return evidenceByTransaction
    .filter(({ candidates }) => candidates.length === 1)
    .filter(({ type, candidates }) => transactionIdsByDocument.get(`${type}:${candidates[0].id}`)?.length === 1)
    .map(({ transactionId, type, candidates }) => ({
      transactionId,
      documentId: candidates[0].id,
      type,
    }))
    .sort((left, right) => left.transactionId - right.transactionId);
}

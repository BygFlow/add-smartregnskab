type BankTransactionLike = {
  id: number;
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

const cents = (value: number | null | undefined) => Math.round(Number(value ?? 0) * 100);

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

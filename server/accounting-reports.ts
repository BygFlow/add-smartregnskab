type AccountRow = {
  id: number;
  accountNumber: string;
  name: string;
  type: string;
  vatCode?: string | null;
};

type EntryRow = {
  id: number;
  entryNumber: string;
  date: string;
  status: string;
};

type LineRow = {
  journalEntryId: number;
  accountId: number;
  debit: number;
  credit: number;
  vatCode?: string | null;
};

type BankTransactionRow = {
  date: string;
  amount: number;
  balance?: number | null;
  status: string;
};

type VatPeriodRow = {
  period: string;
  outputVat: number;
  inputVat: number;
  netVat: number;
  status: string;
};

type ReportMetric = {
  label: string;
  value: number | string;
  format?: "money" | "number" | "text";
};

type ReportControl = {
  key: "ledger" | "bank" | "vat";
  title: string;
  status: "ok" | "warning" | "error";
  summary: string;
  metrics: ReportMetric[];
};

export type AccountingReportInput = {
  type: string;
  requestedYear?: number | null;
  companyName?: string | null;
  accounts: AccountRow[];
  entries: EntryRow[];
  lines: LineRow[];
  bankTransactions: BankTransactionRow[];
  vatPeriods: VatPeriodRow[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const numberValue = (value: unknown) => Number(value || 0);
const yearFromDate = (value: string) => Number(String(value || "").slice(0, 4));

function reportLines(
  accountRows: AccountRow[],
  totals: Map<number, { debit: number; credit: number }>,
  sign: "debit" | "credit",
) {
  return accountRows
    .map((account) => {
      const amount = totals.get(account.id) ?? { debit: 0, credit: 0 };
      const value = sign === "debit" ? amount.debit - amount.credit : amount.credit - amount.debit;
      return {
        label: `${account.accountNumber} · ${account.name}`,
        amount: round2(value),
      };
    })
    .filter((line) => Math.abs(line.amount) > 0.004)
    .sort((a, b) => a.label.localeCompare(b.label, "da"));
}

export function availableAccountingYears(entries: EntryRow[]) {
  return Array.from(new Set(entries
    .filter((entry) => entry.status !== "kladde")
    .map((entry) => yearFromDate(entry.date))
    .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2200)))
    .sort((a, b) => b - a);
}

export function buildAccountingReport(input: AccountingReportInput) {
  const availableYears = availableAccountingYears(input.entries);
  const year = input.requestedYear && availableYears.includes(input.requestedYear)
    ? input.requestedYear
    : (availableYears[0] ?? input.requestedYear ?? new Date().getFullYear());
  const entries = input.entries.filter((entry) => entry.status !== "kladde" && yearFromDate(entry.date) === year);
  const entryIds = new Set(entries.map((entry) => entry.id));
  const lines = input.lines.filter((line) => entryIds.has(line.journalEntryId));
  const totals = new Map<number, { debit: number; credit: number }>();
  const entryTotals = new Map<number, { debit: number; credit: number; lineCount: number }>();

  for (const line of lines) {
    const debit = numberValue(line.debit);
    const credit = numberValue(line.credit);
    const accountTotal = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
    accountTotal.debit += debit;
    accountTotal.credit += credit;
    totals.set(line.accountId, accountTotal);
    const entryTotal = entryTotals.get(line.journalEntryId) ?? { debit: 0, credit: 0, lineCount: 0 };
    entryTotal.debit += debit;
    entryTotal.credit += credit;
    entryTotal.lineCount++;
    entryTotals.set(line.journalEntryId, entryTotal);
  }

  const totalDebit = round2(lines.reduce((sum, line) => sum + numberValue(line.debit), 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + numberValue(line.credit), 0));
  const difference = round2(totalDebit - totalCredit);
  const entriesMissingLines = entries.filter((entry) => !entryTotals.get(entry.id)?.lineCount).length;
  const unbalancedEntries = entries.filter((entry) => {
    const total = entryTotals.get(entry.id);
    return total ? Math.abs(total.debit - total.credit) > 0.005 : false;
  }).length;

  const incomeAccounts = input.accounts.filter((account) => account.type === "indtaegt");
  const expenseAccounts = input.accounts.filter((account) => account.type === "udgift");
  const assetAccounts = input.accounts.filter((account) => account.type === "aktiv");
  const liabilityAccounts = input.accounts.filter((account) => account.type === "passiv");
  const incomeLines = reportLines(incomeAccounts, totals, "credit");
  const expenseLines = reportLines(expenseAccounts, totals, "debit");
  const assetLines = reportLines(assetAccounts, totals, "debit");
  const liabilityLines = reportLines(liabilityAccounts, totals, "credit");
  const revenue = round2(incomeLines.reduce((sum, line) => sum + line.amount, 0));
  const expenses = round2(expenseLines.reduce((sum, line) => sum + line.amount, 0));
  const result = round2(revenue - expenses);
  const assets = round2(assetLines.reduce((sum, line) => sum + line.amount, 0));
  const liabilities = round2(liabilityLines.reduce((sum, line) => sum + line.amount, 0));

  // Kun selve momskontiene indgår i momssaldoen. En udgifts- eller salgskonto
  // med en momskode er ikke i sig selv en momskonto.
  const vatAccounts = input.accounts.filter((account) =>
    ["aktiv", "passiv"].includes(account.type) && /moms|\bvat\b/i.test(account.name));
  const vatAccountLines = vatAccounts.map((account) => {
    const amount = totals.get(account.id) ?? { debit: 0, credit: 0 };
    return {
      label: `${account.accountNumber} · ${account.name}`,
      amount: round2(amount.debit - amount.credit),
    };
  }).filter((line) => Math.abs(line.amount) > 0.004);
  const vatPeriods = input.vatPeriods.filter((period) => String(period.period).startsWith(String(year)));
  const outputVat = round2(vatPeriods.reduce((sum, period) => sum + numberValue(period.outputVat), 0));
  const inputVat = round2(vatPeriods.reduce((sum, period) => sum + numberValue(period.inputVat), 0));
  const netVat = round2(vatPeriods.reduce((sum, period) => sum + numberValue(period.netVat), 0));

  const base = {
    type: input.type,
    generatedAt: new Date().toISOString(),
    companyName: input.companyName ?? "Virksomhed",
    period: String(year),
    year,
    availableYears,
  };

  if (input.type === "resultatopgoerelse") {
    return {
      ...base,
      sections: [
        { title: "Indtægter", lines: incomeLines, total: revenue },
        { title: "Udgifter", lines: expenseLines, total: expenses },
        { title: "Årets resultat", lines: [], total: result },
      ],
    };
  }

  if (input.type === "balance") {
    return {
      ...base,
      sections: [
        { title: "Aktiver", lines: assetLines, total: assets },
        { title: "Passiver", lines: liabilityLines, total: liabilities },
        { title: "Årets resultat", lines: [], total: result },
        { title: "Balancekontrol", lines: [{ label: "Forskel", amount: round2(assets - liabilities - result) }], total: undefined },
      ],
    };
  }

  if (input.type === "momsrapport") {
    return {
      ...base,
      sections: [
        { title: "Momskonti i bogføringen (debet minus kredit)", lines: vatAccountLines, total: round2(vatAccountLines.reduce((sum, line) => sum + line.amount, 0)) },
        { title: "Registrerede momsperioder", lines: [
          { label: "Udgående moms", amount: outputVat },
          { label: "Indgående moms", amount: inputVat },
        ], total: netVat },
      ],
      notice: vatPeriods.length ? null : "Der er endnu ingen momsperioder eller indberetningskvitteringer registreret for året.",
    };
  }

  const bankAccounts = input.accounts.filter((account) =>
    ["aktiv", "passiv"].includes(account.type) && /bankkonto|bank\b|kassebeholdning|kassekredit|kontant/i.test(account.name));
  const bankAccountLines = bankAccounts.map((account) => {
    const amount = totals.get(account.id) ?? { debit: 0, credit: 0 };
    return {
      label: `${account.accountNumber} · ${account.name}`,
      amount: round2(amount.debit - amount.credit),
    };
  }).filter((line) => Math.abs(line.amount) > 0.004);
  const bankTransactions = input.bankTransactions.filter((transaction) => yearFromDate(transaction.date) === year);
  const pendingBankTransactions = bankTransactions.filter((transaction) => transaction.status === "afventer").length;
  const ledgerOk = entries.length > 0 && entriesMissingLines === 0 && unbalancedEntries === 0 && Math.abs(difference) <= 0.005;
  const controls: ReportControl[] = [
    {
      key: "ledger",
      title: "Bogføring",
      status: ledgerOk ? "ok" : "error",
      summary: ledgerOk
        ? `${entries.length} bogførte posteringer balancerer for ${year}.`
        : "Bogføringen balancerer ikke endnu. Ret manglende eller ubalancerede posteringer før årsafslutning.",
      metrics: [
        { label: "Posteringer", value: entries.length, format: "number" },
        { label: "Posteringslinjer", value: lines.length, format: "number" },
        { label: "Debet i alt", value: totalDebit, format: "money" },
        { label: "Kredit i alt", value: totalCredit, format: "money" },
        { label: "Forskel", value: difference, format: "money" },
        { label: "Ubalancerede posteringer", value: unbalancedEntries + entriesMissingLines, format: "number" },
      ],
    },
    {
      key: "bank",
      title: "Bankafstemning",
      status: bankTransactions.length > 0 && pendingBankTransactions === 0 ? "ok" : "warning",
      summary: bankTransactions.length === 0
        ? "Bogføringen indeholder bankkonti, men et eksternt kontoudtog skal importeres, før banksaldoen kan bekræftes."
        : pendingBankTransactions > 0
          ? `${pendingBankTransactions} bankpostering(er) afventer afstemning.`
          : "Alle importerede bankposteringer for året er afstemt.",
      metrics: [
        ...bankAccountLines.map((line) => ({ label: line.label, value: line.amount, format: "money" as const })),
        { label: "Importerede bankposteringer", value: bankTransactions.length, format: "number" },
        { label: "Afventer afstemning", value: pendingBankTransactions, format: "number" },
      ],
    },
    {
      key: "vat",
      title: "Momsafstemning",
      status: vatPeriods.length > 0 && vatPeriods.every((period) => ["indberettet", "betalt"].includes(period.status)) ? "ok" : "warning",
      summary: vatPeriods.length === 0
        ? "Momskontiene findes i bogføringen, men momsperioder og indberetningskvitteringer skal registreres, før momsen kan bekræftes."
        : vatPeriods.every((period) => ["indberettet", "betalt"].includes(period.status))
          ? "Alle registrerede momsperioder for året er indberettet eller betalt."
          : "En eller flere momsperioder er endnu ikke indberettet eller betalt.",
      metrics: [
        { label: "Momskonti med bevægelse", value: vatAccountLines.length, format: "number" },
        { label: "Registrerede momsperioder", value: vatPeriods.length, format: "number" },
        { label: "Bogført momssaldo", value: round2(vatAccountLines.reduce((sum, line) => sum + line.amount, 0)), format: "money" },
      ],
    },
  ];

  return {
    ...base,
    controls,
    summary: {
      revenue,
      expenses,
      result,
      assets,
      liabilities,
      totalDebit,
      totalCredit,
      difference,
    },
  };
}

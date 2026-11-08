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
  companyId?: number | null;
  date: string;
  description?: string | null;
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

type AnnualReportRow = {
  year: number;
  result: number;
  taxResult: number;
  balanceTotal: number;
  equity: number;
  xbrlStatus?: string | null;
  auditorPackage?: string | null;
  status?: string | null;
  submittedToErhvervsstyrelsen?: number | boolean | null;
};

type FiledAnnualReportDetails = {
  periodStart?: string;
  periodEnd?: string;
  publishedAt?: string;
  grossProfit?: number;
  operatingResult?: number;
  resultBeforeTax?: number;
  taxBenefit?: number;
  liabilitiesTotal?: number;
  sourceLabel?: string;
  sourceUrl?: string;
};

type ReportMetric = {
  label: string;
  value: number | string;
  format?: "money" | "number" | "text";
};

type ReportControl = {
  key: "ledger" | "bank" | "vat" | "filed-annual-report" | "annual-report-reconciliation";
  title: string;
  status: "ok" | "warning" | "error";
  summary: string;
  metrics: ReportMetric[];
};

type DuplicateBankTransaction = {
  date: string;
  description: string;
  amount: number;
  scopeNames: string[];
  duplicateCount: number;
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
  annualReports?: AnnualReportRow[];
  accountingScopes?: Array<{ id: number; name: string; registrationNumber?: string | null }>;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const numberValue = (value: unknown) => Number(value || 0);
const yearFromDate = (value: string) => Number(String(value || "").slice(0, 4));

function filedAnnualReportDetails(raw: string | null | undefined): FiledAnnualReportDetails {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as FiledAnnualReportDetails : {};
  } catch {
    return {};
  }
}

function isFiledAnnualReport(report: AnnualReportRow) {
  return Boolean(report.submittedToErhvervsstyrelsen)
    || report.status === "indsendt"
    || report.xbrlStatus === "indsendt";
}

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
  const availableYears = Array.from(new Set([
    ...availableAccountingYears(input.entries),
    ...(input.annualReports ?? [])
      .filter(isFiledAnnualReport)
      .map((report) => Number(report.year))
      .filter((reportYear) => Number.isInteger(reportYear) && reportYear >= 1900 && reportYear <= 2200),
  ])).sort((a, b) => b - a);
  const year = input.requestedYear && availableYears.includes(input.requestedYear)
    ? input.requestedYear
    : (availableYears[0] ?? input.requestedYear ?? new Date().getFullYear());
  const filedAnnualReport = (input.annualReports ?? [])
    .find((report) => Number(report.year) === year && isFiledAnnualReport(report));
  const filedDetails = filedAnnualReportDetails(filedAnnualReport?.auditorPackage);
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
  const filedResult = filedAnnualReport ? round2(numberValue(filedAnnualReport.result)) : null;
  const exactReconciliationDifference = filedResult == null ? null : round2(filedResult - result);
  // Public annual reports are filed in whole DKK. Preserve øre in the ledger,
  // but treat a difference below 50 øre as the same filed whole-krone amount.
  const matchesFiledReport = exactReconciliationDifference != null
    && Math.abs(exactReconciliationDifference) < 0.5;
  const reconciliationDifference = matchesFiledReport ? 0 : exactReconciliationDifference;
  const filedReportSummary = filedAnnualReport ? {
    year,
    result: filedResult,
    taxResult: round2(numberValue(filedAnnualReport.taxResult)),
    balanceTotal: round2(numberValue(filedAnnualReport.balanceTotal)),
    equity: round2(numberValue(filedAnnualReport.equity)),
    bookkeepingResult: result,
    reconciliationDifference,
    matchesBookkeeping: matchesFiledReport,
    ...filedDetails,
  } : null;

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
    filedAnnualReport: filedReportSummary,
    accountingScopes: input.accountingScopes ?? [],
  };

  if (input.type === "resultatopgoerelse") {
    if (filedAnnualReport && filedResult != null) {
      const filedLines = [
        filedDetails.grossProfit == null ? null : { label: "Bruttoresultat", amount: round2(filedDetails.grossProfit) },
        filedDetails.operatingResult == null ? null : { label: "Driftsresultat", amount: round2(filedDetails.operatingResult) },
        filedDetails.resultBeforeTax == null ? null : { label: "Resultat før skat", amount: round2(filedDetails.resultBeforeTax) },
        { label: "Skat af årets resultat", amount: round2(numberValue(filedAnnualReport.taxResult)) },
      ].filter((line): line is { label: string; amount: number } => line != null);
      return {
        ...base,
        notice: matchesFiledReport
          ? "Bogføringen stemmer med den indsendte årsrapport."
          : `Den indsendte årsrapport er facit. Bogføringen afviger med ${Math.abs(reconciliationDifference ?? 0).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr. og bevares særskilt til dokumenteret afstemning.`,
        sections: [
          { title: "Bogføring · Indtægter", lines: incomeLines, total: revenue },
          { title: "Bogføring · Udgifter", lines: expenseLines, total: expenses },
          { title: "Bogført resultat", lines: [], total: result },
          { title: "Indsendt årsrapport · Officielt resultat", lines: filedLines, total: filedResult },
        ],
      };
    }
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
    if (filedAnnualReport && filedResult != null) {
      const officialLiabilities = filedDetails.liabilitiesTotal == null
        ? round2(numberValue(filedAnnualReport.balanceTotal) - numberValue(filedAnnualReport.equity))
        : round2(filedDetails.liabilitiesTotal);
      return {
        ...base,
        notice: "De officielle totaler nedenfor følger den indsendte årsrapport. De bogførte konti vises separat som revisionsspor.",
        sections: [
          { title: "Bogføring · Aktiver", lines: assetLines, total: assets },
          { title: "Bogføring · Passiver", lines: liabilityLines, total: liabilities },
          { title: "Bogført resultat", lines: [], total: result },
          { title: "Indsendt årsrapport · Officiel balance", lines: [
            { label: "Aktiver i alt", amount: round2(numberValue(filedAnnualReport.balanceTotal)) },
            { label: "Egenkapital", amount: round2(numberValue(filedAnnualReport.equity)) },
            { label: "Gæld i alt", amount: officialLiabilities },
            { label: "Årets resultat", amount: filedResult },
          ], total: round2(numberValue(filedAnnualReport.balanceTotal)) },
        ],
      };
    }
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
  const duplicateBankTransactions = (() => {
    if ((input.accountingScopes?.length ?? 0) < 2) return [] as DuplicateBankTransaction[];
    const grouped = new Map<string, {
      date: string;
      description: string;
      amount: number;
      byCompany: Map<number, number>;
    }>();
    const scopeNameById = new Map((input.accountingScopes ?? []).map((scope) => [scope.id, scope.name]));
    for (const transaction of bankTransactions) {
      const companyId = Number(transaction.companyId);
      if (!Number.isInteger(companyId)) continue;
      const description = String(transaction.description || "").trim().toLocaleLowerCase("da-DK").replace(/\s+/g, " ");
      const amount = round2(numberValue(transaction.amount));
      const key = `${transaction.date}|${amount.toFixed(2)}|${description}`;
      const group = grouped.get(key) ?? {
        date: transaction.date,
        description: String(transaction.description || "").trim() || "(uden tekst)",
        amount,
        byCompany: new Map<number, number>(),
      };
      group.byCompany.set(companyId, (group.byCompany.get(companyId) ?? 0) + 1);
      grouped.set(key, group);
    }
    return Array.from(grouped.values())
      .filter((group) => group.byCompany.size > 1)
      .map((group) => {
        const counts = Array.from(group.byCompany.values());
        return {
          date: group.date,
          description: group.description,
          amount: group.amount,
          scopeNames: Array.from(group.byCompany.keys()).map((companyId) => scopeNameById.get(companyId) ?? `Regnskab ${companyId}`),
          duplicateCount: Math.min(...counts) * (counts.length - 1),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, "da"));
  })();
  const crossScopeDuplicateBankRows = duplicateBankTransactions.reduce((sum, row) => sum + row.duplicateCount, 0);
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
      status: bankTransactions.length > 0 && pendingBankTransactions === 0 && crossScopeDuplicateBankRows === 0 ? "ok" : "warning",
      summary: bankTransactions.length === 0
        ? "Bogføringen indeholder bankkonti, men et eksternt kontoudtog skal importeres, før banksaldoen kan bekræftes."
        : crossScopeDuplicateBankRows > 0
          ? `${crossScopeDuplicateBankRows} mulig(e) dubletbankpostering(er) findes på tværs af hoved- og SE-regnskabet. De skal kontrolleres før årsafslutning.`
        : pendingBankTransactions > 0
          ? `${pendingBankTransactions} bankpostering(er) afventer afstemning.`
          : "Alle importerede bankposteringer for året er afstemt.",
      metrics: [
        ...bankAccountLines.map((line) => ({ label: line.label, value: line.amount, format: "money" as const })),
        { label: "Importerede bankposteringer", value: bankTransactions.length, format: "number" },
        { label: "Afventer afstemning", value: pendingBankTransactions, format: "number" },
        { label: "Mulige dubletter på tværs af regnskaber", value: crossScopeDuplicateBankRows, format: "number" },
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

  if (filedAnnualReport && filedResult != null) {
    controls.unshift({
      key: "filed-annual-report",
      title: "Indsendt årsrapport",
      status: "ok",
      summary: `De officielle ${year}-tal er registreret som indsendt til Erhvervsstyrelsen.`,
      metrics: [
        { label: "Årets resultat", value: filedResult, format: "money" },
        { label: "Skat", value: round2(numberValue(filedAnnualReport.taxResult)), format: "money" },
        { label: "Aktiver i alt", value: round2(numberValue(filedAnnualReport.balanceTotal)), format: "money" },
        { label: "Egenkapital", value: round2(numberValue(filedAnnualReport.equity)), format: "money" },
      ],
    });
    controls.splice(1, 0, {
      key: "annual-report-reconciliation",
      title: "Afstemning mod årsrapport",
      status: matchesFiledReport ? "ok" : "warning",
      summary: matchesFiledReport
        ? "Bogført resultat stemmer med den indsendte årsrapport."
        : "Det importerede bogføringsresultat afviger fra den indsendte årsrapport. Årsrapportens tal vises som officielt facit uden at overskrive revisionssporet.",
      metrics: [
        { label: "Bogført resultat", value: result, format: "money" },
        { label: "Officielt resultat", value: filedResult, format: "money" },
        { label: "Difference", value: reconciliationDifference ?? 0, format: "money" },
      ],
    });
  }

  return {
    ...base,
    controls,
    duplicateBankTransactions,
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

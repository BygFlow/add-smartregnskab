type VatPeriodBounds = {
  normalizedPeriod: string;
  start: string;
  end: string;
};

type VatEntry = {
  id: number;
  date: string;
  status: string;
};

type VatLine = {
  journalEntryId: number;
  accountId: number;
  debit?: number | null;
  credit?: number | null;
};

type VatAccount = {
  id: number;
  accountNumber?: string | null;
  name: string;
  type?: string | null;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const amount = (value: unknown) => Number(value || 0);

export function parseVatReconciliationPeriod(raw: unknown): VatPeriodBounds {
  const period = String(raw ?? "").trim().toUpperCase();
  let match = /^(\d{4})$/.exec(period);
  if (match) {
    return { normalizedPeriod: match[1], start: `${match[1]}-01-01`, end: `${match[1]}-12-31` };
  }

  match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      normalizedPeriod: `${match[1]}-${match[2]}`,
      start: `${match[1]}-${match[2]}-01`,
      end: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  match = /^(\d{4})-?Q([1-4])$/.exec(period);
  if (match) {
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(Date.UTC(Number(match[1]), endMonth, 0)).getUTCDate();
    return {
      normalizedPeriod: `${match[1]}-Q${match[2]}`,
      start: `${match[1]}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${match[1]}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  match = /^(\d{4})-?H([12])$/.exec(period);
  if (match) {
    return match[2] === "1"
      ? { normalizedPeriod: `${match[1]}-H1`, start: `${match[1]}-01-01`, end: `${match[1]}-06-30` }
      : { normalizedPeriod: `${match[1]}-H2`, start: `${match[1]}-07-01`, end: `${match[1]}-12-31` };
  }

  throw Object.assign(new Error("Ugyldig momsperiode. Brug ÅÅÅÅ, ÅÅÅÅ-MM, ÅÅÅÅ-Q1 eller ÅÅÅÅ-H1."), { status: 400 });
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase("da-DK")
    .replaceAll("å", "aa")
    .replaceAll("ø", "oe")
    .replaceAll("æ", "ae");
}

export function calculateJournalVatReconciliation(input: {
  period: unknown;
  entries: VatEntry[];
  lines: VatLine[];
  accounts: VatAccount[];
}) {
  const bounds = parseVatReconciliationPeriod(input.period);
  const periodEntries = input.entries.filter((entry) =>
    entry.status !== "kladde" && entry.date >= bounds.start && entry.date <= bounds.end);
  const entryIds = new Set(periodEntries.map((entry) => entry.id));
  const accounts = new Map(input.accounts.map((account) => [account.id, account]));
  const ignoredVatAccounts = new Set<string>();
  let outputVat = 0;
  let inputVat = 0;
  let taxAccount = 0;
  let recognizedLineCount = 0;

  for (const line of input.lines) {
    if (!entryIds.has(line.journalEntryId)) continue;
    const account = accounts.get(line.accountId);
    if (!account) continue;
    const name = normalizedName(account.name);
    const debitMinusCredit = amount(line.debit) - amount(line.credit);

    if (/skattekonto/.test(name)) {
      taxAccount += debitMinusCredit;
      continue;
    }
    if (/indgaaende moms|koebsmoms|input vat/.test(name)) {
      inputVat += debitMinusCredit;
      recognizedLineCount++;
      continue;
    }
    if (/udgaaende moms|salgsmoms|output vat/.test(name)) {
      outputVat -= debitMinusCredit;
      recognizedLineCount++;
      continue;
    }
    if (/moms|\bvat\b/.test(name) && ["aktiv", "passiv"].includes(String(account.type))) {
      ignoredVatAccounts.add(`${account.accountNumber ?? "?"} · ${account.name}`);
    }
  }

  outputVat = round2(outputVat);
  inputVat = round2(inputVat);
  taxAccount = round2(taxAccount);
  const netVat = round2(outputVat - inputVat);

  return {
    ...bounds,
    outputVat,
    inputVat,
    netVat,
    taxAccount,
    difference: round2(netVat - taxAccount),
    entryCount: periodEntries.length,
    recognizedLineCount,
    ignoredVatAccounts: Array.from(ignoredVatAccounts).sort((a, b) => a.localeCompare(b, "da")),
  };
}

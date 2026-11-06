export type BankCsvRow = {
  date: string;
  description: string;
  amount: number;
  balance: number;
  provider?: string;
  accountRef?: string;
  externalId?: string;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function headerKey(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o");
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: string | undefined): string {
  const input = String(value ?? "").trim();
  const danish = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);
  if (danish) return `${danish[3]}-${danish[2]}-${danish[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  return iso ? input : "";
}

function accountReference(sourceName: string): string {
  return /DanskeBusinessOne-(\d+)/i.exec(sourceName)?.[1] ?? "";
}

function stableExternalId(row: Omit<BankCsvRow, "externalId">): string {
  return [
    row.provider ?? "csv",
    row.accountRef ?? "",
    row.date,
    row.amount.toFixed(2),
    row.balance.toFixed(2),
    row.description,
  ].join("|");
}

export function parseBankCsv(text: string, sourceName = "bank.csv"): BankCsvRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = parseCsvLine(lines[0]);
  const headers = first.map(headerKey);
  const hasHeader = headers.some((value) => ["dato", "date", "tekst", "beskrivelse", "belob", "amount", "saldo", "balance"].includes(value));
  const rows = hasHeader ? lines.slice(1) : lines;
  const column = (aliases: string[], fallback: number) => {
    const index = headers.findIndex((value) => aliases.includes(value));
    return index >= 0 ? index : fallback;
  };
  const dateIndex = column(["dato", "date", "bogforingsdato"], 0);
  const descriptionIndex = column(["tekst", "beskrivelse", "description"], 1);
  const amountIndex = column(["belob", "amount"], 2);
  const balanceIndex = column(["saldo", "balance"], 3);
  const statusIndex = hasHeader ? column(["status"], -1) : -1;
  const accountRef = accountReference(sourceName);
  const provider = headers.includes("afstemt") || /DanskeBusinessOne/i.test(sourceName) ? "danske-bank" : "csv";

  const parsed: BankCsvRow[] = [];
  for (const line of rows) {
    const cells = parseCsvLine(line);
    const status = statusIndex >= 0 ? headerKey(cells[statusIndex] ?? "") : "";
    if (status && !["udfort", "completed", "bogfort", "gennemfort"].includes(status)) continue;

    const date = normalizeDate(cells[dateIndex]);
    const description = String(cells[descriptionIndex] ?? "").trim();
    if (!date || !description) continue;

    const row: BankCsvRow = {
      date,
      description,
      amount: parseNumber(cells[amountIndex]),
      balance: parseNumber(cells[balanceIndex]),
      provider,
      accountRef: accountRef || undefined,
    };
    row.externalId = stableExternalId(row);
    parsed.push(row);
  }
  return parsed;
}

export async function readBankCsvFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

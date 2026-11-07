import assert from "node:assert/strict";
import test from "node:test";
import { previewImport } from "../server/import-adapters";

const header = "KassekladdePosteringsNr;PosteringsType;Dato;KontoNr;BilagsNr;Tekst;BeloebDKK;Valuta;Beloeb;ProjektNr;AktivitetsNr;KundeNr;LeverandoerNr;FakturaNr;ForfaldsDato;MomsKode;KassekladdeNr;Modkonto;ModkontoMomsKode;Godkendt;Afdeling;Enhed1Nr;Enhed2Nr;Antal;Antal2";

function preview(...rows: string[]) {
  return previewImport([header, ...rows].join("\n"), "journal_entries");
}

test("godkendt leverandørfaktura bliver en balanceret kladde med købsmoms", () => {
  const result = preview('"1";"Leverandørfaktura";"05-05-2025";"6800";"30001";"Flügger Denmark";"-235,23";"DKK";"-235,23";"";"";"";"55828417";"16577758";"04-06-2025";"";"8";"1310";"I25";"1";"";"";"";"";""');
  assert.equal(result.errors.length, 0);
  assert.equal(result.validRows, 1);
  const entry = result.rows[0] as any;
  assert.equal(entry.entryNumber, "ECON-KLADDE-30001");
  assert.equal(entry.status, "kladde");
  assert.deepEqual(entry.lines.map((line: any) => [line.accountNumber, line.debit, line.credit]), [
    ["6800", 0, 235.23],
    ["1310", 188.18, 0],
    ["6903", 47.05, 0],
  ]);
});

test("flerlinjet leverandørfaktura bevarer fordelingen og balancerer", () => {
  const result = preview(
    '"1";"Leverandørfaktura";"11-03-2025";"6800";"30000";"DI";"-3347,25";"DKK";"-3347,25";"";"";"";"55828418";"2020490";"30-04-2025";"";"8";"";"I25";"1";"";"";"";"";""',
    '"2";"Leverandørfaktura";"11-03-2025";"";"30000";"Kontingent uden moms";"-271,00";"DKK";"-271,00";"";"";"";"";"";"";"";"8";"3663";"";"1";"";"";"";"";""',
    '"3";"Leverandørfaktura";"11-03-2025";"";"30000";"Kontingent med moms";"-3076,25";"DKK";"-3076,25";"";"";"";"";"";"";"";"8";"3662";"I25";"1";"";"";"";"";""',
  );
  const entry = result.rows[0] as any;
  assert.equal(result.validRows, 1);
  assert.equal(entry.lines.reduce((sum: number, line: any) => sum + line.debit, 0), 3347.25);
  assert.equal(entry.lines.reduce((sum: number, line: any) => sum + line.credit, 0), 3347.25);
});

test("omvendt betalingspligt opretter både moms og modpost", () => {
  const result = preview('"1";"Leverandørfaktura";"01-06-2025";"6800";"30100";"Udenlandsk software";"-100,00";"DKK";"-100,00";"";"";"";"1";"INV-1";"01-07-2025";"";"8";"3604";"IY25";"1";"";"";"";"";""');
  const entry = result.rows[0] as any;
  assert.deepEqual(entry.lines.map((line: any) => [line.accountNumber, line.debit, line.credit]), [
    ["6800", 0, 100],
    ["3604", 100, 0],
    ["6903", 25, 0],
    ["6907", 0, 25],
  ]);
});

test("ikke-godkendte og betalingsposter bliver ikke importeret", () => {
  const result = preview(
    '"1";"Finansbilag";"18-02-2025";"3620";"30044";"Hi3G";"323,03";"DKK";"323,03";"";"";"";"";"";"";"I25";"8";"6836";"";"0";"";"";"";"";""',
    '"2";"Leverandørbetaling";"18-02-2025";"6800";"30045";"Betaling";"100,00";"DKK";"100,00";"";"";"";"1";"INV-2";"";"";"8";"5820";"";"1";"";"";"";"";""',
  );
  assert.equal(result.validRows, 0);
  assert.equal((result as any).warnings.length, 2);
  assert.equal(result.errors.length, 1);
});

test("kontoplanimport bruger SQLite-kompatible heltal til aktiv-status", () => {
  const result = previewImport("AccountNumber;Name;Active\n1335;Fremmed arbejde;true", "accounts");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0]?.active, 1);
});

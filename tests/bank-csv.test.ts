import assert from "node:assert/strict";
import test from "node:test";
import { parseBankCsv } from "../client/src/lib/bank-csv";

test("Danske Bank CSV bliver normaliseret og kun gennemførte poster importeres", () => {
  const text = [
    '"Dato";"Tekst";"Beløb";"Saldo";"Status";"Afstemt"',
    '"22.07.2024";"Faktura 709";"8.609,38";"8.691,33";"Udført";"Nej"',
    '"23.07.2024";"Dækningsløs betaling";"-250,00";"8.441,33";"Afvist";"Nej"',
  ].join("\n");

  const rows = parseBankCsv(text, "DanskeBusinessOne-13424713-20241122.csv");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    date: "2024-07-22",
    description: "Faktura 709",
    amount: 8609.38,
    balance: 8691.33,
    provider: "danske-bank",
    accountRef: "13424713",
    externalId: "danske-bank|13424713|2024-07-22|8609.38|8691.33|Faktura 709",
  });
});

test("anførselstegn og semikolon i bankteksten bevares", () => {
  const rows = parseBankCsv(
    'Dato;Beskrivelse;Beløb;Saldo\n06.11.2024;"Kort; køb";-1.234,50;5.000,00',
    "bank.csv",
  );
  assert.equal(rows[0]?.description, "Kort; køb");
  assert.equal(rows[0]?.amount, -1234.5);
  assert.equal(rows[0]?.date, "2024-11-06");
});

test("danske bogstaver normaliseres i overskrifter og status", () => {
  const rows = parseBankCsv(
    '"Dato";"Tekst";"Beløb";"Saldo";"Status"\n"06.11.2024";"Køb";"-75,00";"925,00";"Udført"',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.amount, -75);
});

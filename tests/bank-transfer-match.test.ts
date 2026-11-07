import assert from "node:assert/strict";
import test from "node:test";
import {
  findInternalTransferCandidates,
  findSafeInternalTransferCounterparts,
  findSafeInternalTransferPairs,
} from "../server/bank-transfer-match";

const pending = (id: number, amount: number, accountRef: string | null, date = "2025-12-05") => ({
  id,
  date,
  amount,
  accountRef,
  status: "afventer",
});

test("finder en manuel modpost med samme dato og modsat beløb", () => {
  const rows = [pending(1, -3_245.93, "0112"), pending(2, 3_245.93, "9278")];
  assert.deepEqual(findInternalTransferCandidates(rows[0], rows).map((row) => row.id), [2]);
});

test("samme bankkonto kan ikke matches som intern overførsel", () => {
  const rows = [pending(1, -500, "0112"), pending(2, 500, "0112")];
  assert.deepEqual(findInternalTransferCandidates(rows[0], rows), []);
  assert.deepEqual(findSafeInternalTransferPairs(rows), []);
});

test("bulk-match kræver entydige, gensidige kandidater på forskellige konti", () => {
  const rows = [
    pending(1, -3_245.93, "0112"),
    pending(2, 3_245.93, "9278"),
    pending(3, -13_000, "0112", "2025-12-23"),
    pending(4, 13_000, "4483", "2025-12-23"),
  ];
  assert.deepEqual(findSafeInternalTransferPairs(rows).map((pair) => pair.map((row) => row.id)), [[1, 2], [3, 4]]);
});

test("bulk-match springer tvetydige beløb over", () => {
  const rows = [
    pending(1, -200, "0112"),
    pending(2, 200, "4483"),
    pending(3, 200, "4483"),
  ];
  assert.deepEqual(findSafeInternalTransferPairs(rows), []);
});

test("ældre importer uden kontoreference vises kun til manuel kontrol", () => {
  const rows = [pending(1, -1_000, null), pending(2, 1_000, null)];
  assert.deepEqual(findInternalTransferCandidates(rows[0], rows).map((row) => row.id), [2]);
  assert.deepEqual(findSafeInternalTransferPairs(rows), []);
});

test("rækker på forskellige datoer eller med afsluttet status matches ikke", () => {
  const rows = [
    pending(1, -1_000, "0112"),
    pending(2, 1_000, "4483", "2025-12-06"),
    { ...pending(3, 1_000, "4483"), status: "matchet" },
  ];
  assert.deepEqual(findInternalTransferCandidates(rows[0], rows), []);
  assert.deepEqual(findSafeInternalTransferPairs(rows), []);
});

test("finder entydig intern modpost når den anden side allerede er SAF-T-afstemt", () => {
  const rows = [
    { ...pending(1, -20_000, "0112"), description: "Løn Skat Moms Konto ADD Multi Service ApS", status: "matchet", matchedType: "journal_entry", matchedId: 99 },
    { ...pending(2, 20_000, "4483"), description: "Income sorter" },
  ];
  assert.deepEqual(findSafeInternalTransferCounterparts(rows).map((match) => [match.pending.id, match.journalMatched.id]), [[2, 1]]);
});

test("journal-linket må ikke bruges til en tvetydig eller ubeskrevet modpost", () => {
  const journalMatched = { ...pending(1, -500, "0112"), description: "Løn Skat Moms Konto ADD Multi Service ApS", status: "matchet", matchedType: "journal_entry", matchedId: 99 };
  assert.deepEqual(findSafeInternalTransferCounterparts([
    journalMatched,
    { ...pending(2, 500, "4483"), description: "Income sorter" },
    { ...pending(3, 500, "9278"), description: "Income sorter" },
  ]), []);
  assert.deepEqual(findSafeInternalTransferCounterparts([
    journalMatched,
    { ...pending(4, 500, "4483"), description: "Ukendt indbetaling" },
  ]), []);
});

test("kun en bogført journal-match kan være anker for en intern modpost", () => {
  const rows = [
    { ...pending(1, -1_200, "0112"), description: "Transfer", status: "matchet", matchedType: "invoice", matchedId: 7 },
    { ...pending(2, 1_200, "4483"), description: "Income sorter" },
  ];
  assert.deepEqual(findSafeInternalTransferCounterparts(rows), []);
});

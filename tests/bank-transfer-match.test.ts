import assert from "node:assert/strict";
import test from "node:test";
import { findInternalTransferCandidates, findSafeInternalTransferPairs } from "../server/bank-transfer-match";

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

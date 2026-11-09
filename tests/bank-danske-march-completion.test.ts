import test from "node:test";
import assert from "node:assert/strict";
import {
  DANSKE_MARCH_2025_COMPLETION_ROWS,
  findDanskeMarchCompletionPlan,
} from "../server/bank-danske-march-completion";

function baseRows() {
  const rows = Array.from({ length: 213 }, (_, index) => ({
    id: index + 1,
    date: "2025-01-03",
    description: `Eksisterende post ${index + 1}`,
    amount: 0,
    balance: 0,
    provider: "danske-bank",
    accountRef: "13800707",
    externalId: `existing-${index + 1}`,
    status: "afventer",
  }));
  rows.push({
    id: 214,
    date: "2025-03-27",
    description: "Til Aurel Dan",
    amount: -2_000,
    balance: 11_354.70,
    provider: "danske-bank",
    accountRef: "13800707",
    externalId: "existing-anchor",
    status: "afventer",
  });
  return rows;
}

test("planlægger præcis de 15 udførte poster og slutter på 1.513,98 kr.", () => {
  const plan = findDanskeMarchCompletionPlan(baseRows());
  assert.equal(plan.safe, true);
  assert.equal(plan.alreadyComplete, false);
  assert.equal(plan.rows.length, 15);
  assert.equal(plan.expectedFinalCount, 229);
  assert.equal(plan.endingBalance, 1_513.98);
  assert.equal(plan.rows.reduce((sum, row) => sum + row.amount, 0), -9_840.72);
  assert.equal(plan.rows.at(-1)?.balance, 1_513.98);
});

test("er idempotent når alle poster allerede findes", () => {
  const plan = findDanskeMarchCompletionPlan([...baseRows(), ...DANSKE_MARCH_2025_COMPLETION_ROWS]);
  assert.equal(plan.safe, true);
  assert.equal(plan.alreadyComplete, true);
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.existing2025Count, 229);
});

test("afviser en delvis import", () => {
  const plan = findDanskeMarchCompletionPlan([...baseRows(), DANSKE_MARCH_2025_COMPLETION_ROWS[0]]);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /delvis import/);
});

test("afviser hvis CSV-slutposten ikke passer", () => {
  const rows = baseRows();
  rows[rows.length - 1] = { ...rows.at(-1)!, balance: 11_354.71 };
  const plan = findDanskeMarchCompletionPlan(rows);
  assert.equal(plan.safe, false);
  assert.match(plan.reasons.join(" "), /11\.354,70/);
});

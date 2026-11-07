import assert from "node:assert/strict";
import test from "node:test";
import { findSaftJournalCandidates, findUniqueSaftJournalMatch, isBankLedgerAccount } from "../server/bank-auto-match";

const accounts = [
  { id: 1, accountNumber: "5820", name: "Bankkonto", type: "aktiv" },
  { id: 2, accountNumber: "3629", name: "Bank - gebyrer", type: "udgift" },
];

const entry = {
  id: 10,
  date: "2024-12-27",
  description: "Lev. serv. betal 14648",
  sourceType: "saft_import",
  status: "bogført",
};

test("SAF-T banklinje matches med korrekt fortegn, dato og bankkonto", () => {
  const matchedId = findUniqueSaftJournalMatch(
    { date: "2024-12-27", description: "Lev. serv. betal 14648", amount: -713.55 },
    [entry],
    [{ journalEntryId: 10, accountId: 1, description: "Lev. serv. betal 14648", debit: 0, credit: 713.55 }],
    accounts,
  );
  assert.equal(matchedId, 10);
});

test("positiv bankpost matches en debitering på bankkontoen", () => {
  const matchedId = findUniqueSaftJournalMatch(
    { date: "2024-12-27", description: "Indbetaling", amount: 2_800 },
    [{ ...entry, description: "Indbetaling" }],
    [{ journalEntryId: 10, accountId: 1, debit: 2_800, credit: 0 }],
    accounts,
  );
  assert.equal(matchedId, 10);
});

test("udgiftskonti med ordet bank behandles ikke som bankkonti", () => {
  assert.equal(isBankLedgerAccount(accounts[1]), false);
  const matchedId = findUniqueSaftJournalMatch(
    { date: "2024-12-27", description: "Bankgebyr", amount: -100 },
    [entry],
    [{ journalEntryId: 10, accountId: 2, debit: 0, credit: 100 }],
    accounts,
  );
  assert.equal(matchedId, null);
});

test("aktiv bankkonto til løn og skat genkendes som bankkonto", () => {
  assert.equal(isBankLedgerAccount({
    id: 3,
    accountNumber: "5825",
    name: "Bank løn og skat",
    type: "aktiv",
  }), true);
});

test("kun bogførte importerede posteringer kan auto-matches", () => {
  const lines = [{ journalEntryId: 10, accountId: 1, debit: 0, credit: 713.55 }];
  assert.equal(findUniqueSaftJournalMatch(
    { date: "2024-12-27", amount: -713.55 },
    [{ ...entry, sourceType: "manual" }], lines, accounts,
  ), null);
  assert.equal(findUniqueSaftJournalMatch(
    { date: "2024-12-27", amount: -713.55 },
    [{ ...entry, status: "kladde" }], lines, accounts,
  ), null);
});

test("bogført e-conomic-kladde med en præcis banklinje kan auto-matches", () => {
  const matchedId = findUniqueSaftJournalMatch(
    { date: "2025-07-10", description: "BYGMA FREDERIKS", amount: -15_865.07 },
    [{
      ...entry,
      id: 2102,
      date: "2025-07-10",
      description: "BYGMA FREDERIKS",
      sourceType: "economic_kladde",
    }],
    [{
      journalEntryId: 2102,
      accountId: 1,
      description: "BYGMA FREDERIKS",
      debit: 0,
      credit: 15_865.07,
    }],
    accounts,
  );
  assert.equal(matchedId, 2102);
});

test("tvetydige beløb matches kun når beskrivelsen peger entydigt på én postering", () => {
  const duplicate = { ...entry, id: 11, description: "Anden betaling" };
  const lines = [
    { journalEntryId: 10, accountId: 1, description: entry.description, debit: 0, credit: 713.55 },
    { journalEntryId: 11, accountId: 1, description: duplicate.description, debit: 0, credit: 713.55 },
  ];
  assert.equal(findUniqueSaftJournalMatch(
    { date: "2024-12-27", description: "Ukendt", amount: -713.55 },
    [entry, duplicate], lines, accounts,
  ), null);
  assert.equal(findUniqueSaftJournalMatch(
    { date: "2024-12-27", description: "Anden betaling", amount: -713.55 },
    [entry, duplicate], lines, accounts,
  ), 11);
});

test("en allerede anvendt postering matches ikke igen", () => {
  assert.equal(findUniqueSaftJournalMatch(
    { date: "2024-12-27", amount: -713.55 },
    [entry],
    [{ journalEntryId: 10, accountId: 1, debit: 0, credit: 713.55 }],
    accounts,
    new Set([10]),
  ), null);
});

test("manuel afstemning viser alle ledige, ens SAF-T-kandidater", () => {
  const duplicate = { ...entry, id: 11, entryNumber: "2024-0011", description: "Løn Aurel Dan" };
  const candidates = findSaftJournalCandidates(
    { date: "2024-12-27", description: "Til Aurel Dan", amount: -713.55 },
    [{ ...entry, entryNumber: "2024-0010" }, duplicate],
    [
      { journalEntryId: 10, accountId: 1, description: "Til Aurel Dan", debit: 0, credit: 713.55 },
      { journalEntryId: 11, accountId: 1, description: "Til Aurel Dan", debit: 0, credit: 713.55 },
    ],
    accounts,
  );
  assert.deepEqual(candidates.map((candidate) => candidate.id), [10, 11]);
  assert.equal(candidates[1].entryNumber, "2024-0011");
});

test("manuel afstemning skjuler en SAF-T-postering der allerede er brugt", () => {
  const candidates = findSaftJournalCandidates(
    { date: "2024-12-27", amount: -713.55 },
    [entry, { ...entry, id: 11 }],
    [
      { journalEntryId: 10, accountId: 1, debit: 0, credit: 713.55 },
      { journalEntryId: 11, accountId: 1, debit: 0, credit: 713.55 },
    ],
    accounts,
    new Set([10]),
  );
  assert.deepEqual(candidates.map((candidate) => candidate.id), [11]);
});

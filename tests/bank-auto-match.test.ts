import assert from "node:assert/strict";
import test from "node:test";
import {
  findSafeDelayedImportedJournalMatches,
  findSafeImportedJournalMatches,
  findSaftJournalCandidates,
  findUniqueSaftJournalMatch,
  isBankLedgerAccount,
  isStrongMerchantMatch,
} from "../server/bank-auto-match";

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

test("en postering med både betaling og tilbageførsel kan ikke bruges som enkelt bankmatch", () => {
  const candidates = findSaftJournalCandidates(
    { id: 100, date: "2025-06-11", description: "Faktura 503", amount: 11_950, status: "afventer" },
    [
      { ...entry, id: 20, date: "2025-06-11", description: "Indbet. fak. 503" },
      { ...entry, id: 21, date: "2025-06-11", description: "Indbet. fak. 503" },
    ],
    [
      { journalEntryId: 20, accountId: 1, description: "Indbet. fak. 503", debit: 11_950, credit: 0 },
      { journalEntryId: 21, accountId: 1, description: "Indbet. fak. 503", debit: 11_950, credit: 0 },
      { journalEntryId: 21, accountId: 1, description: "Tilbageført fak. 503", debit: 0, credit: 11_950 },
    ],
    accounts,
  );
  assert.deepEqual(candidates.map((candidate) => candidate.id), [20]);
});

test("en bogført postering der er tilbageført kan ikke bruges som bankmatch", () => {
  const candidates = findSaftJournalCandidates(
    { id: 100, date: "2025-10-09", description: "Faktura 523", amount: 165_167.44, status: "afventer" },
    [
      { ...entry, id: 30, date: "2025-10-09", description: "Indbet. fak. 523" },
      { ...entry, id: 31, date: "2025-10-09", description: "Indbet. fak. 523" },
      { ...entry, id: 32, date: "2025-10-09", sourceType: "tilbageførsel", sourceId: 31 },
    ],
    [
      { journalEntryId: 30, accountId: 1, description: "Indbet. fak. 523", debit: 165_167.44, credit: 0 },
      { journalEntryId: 31, accountId: 1, description: "Indbet. fak. 523", debit: 165_167.44, credit: 0 },
      { journalEntryId: 32, accountId: 1, description: "Tilbageførsel", debit: 0, credit: 165_167.44 },
    ],
    accounts,
  );
  assert.deepEqual(candidates.map((candidate) => candidate.id), [30]);
});

test("sikker auto-afstemning kræver et gensidigt entydigt match", () => {
  const matches = findSafeImportedJournalMatches(
    [
      { id: 100, date: "2025-07-10", description: "BYGMA", amount: -15_865.07, status: "afventer" },
      { id: 101, date: "2025-07-11", description: "Q8", amount: -1_626.45, status: "afventer" },
    ],
    [
      { ...entry, id: 20, date: "2025-07-10", description: "BYGMA" },
      { ...entry, id: 21, date: "2025-07-11", description: "Q8" },
    ],
    [
      { journalEntryId: 20, accountId: 1, description: "BYGMA", debit: 0, credit: 15_865.07 },
      { journalEntryId: 21, accountId: 1, description: "Q8", debit: 0, credit: 1_626.45 },
    ],
    accounts,
  );
  assert.deepEqual(matches, [
    { transactionId: 100, journalEntryId: 20 },
    { transactionId: 101, journalEntryId: 21 },
  ]);
});

test("sikker auto-afstemning springer delte kandidater og dublerede banklinjer over", () => {
  const matches = findSafeImportedJournalMatches(
    [
      { id: 100, date: "2025-07-10", amount: -1_000, status: "afventer" },
      { id: 101, date: "2025-07-10", amount: -1_000, status: "afventer" },
    ],
    [{ ...entry, id: 20, date: "2025-07-10" }],
    [{ journalEntryId: 20, accountId: 1, debit: 0, credit: 1_000 }],
    accounts,
  );
  assert.deepEqual(matches, []);
});

test("forsinket kortafregning kræver samme beløb, stærkt leverandørnavn og højst fire dage", () => {
  const matches = findSafeDelayedImportedJournalMatches(
    [
      { id: 100, date: "2025-05-17", description: "Bauhaus", amount: -1_051.47, status: "afventer" },
      { id: 101, date: "2025-05-17", description: "FL?GGER HILLER?", amount: -2_481.12, status: "afventer" },
    ],
    [
      { ...entry, id: 20, date: "2025-05-16", description: "BAUHAUS DANMARK" },
      { ...entry, id: 21, date: "2025-05-16", description: "Flügger" },
    ],
    [
      { journalEntryId: 20, accountId: 1, description: "BAUHAUS DANMARK", debit: 0, credit: 1_051.47 },
      { journalEntryId: 21, accountId: 1, description: "Flügger", debit: 0, credit: 2_481.12 },
    ],
    accounts,
  );
  assert.deepEqual(matches, [
    { transactionId: 100, journalEntryId: 20 },
    { transactionId: 101, journalEntryId: 21 },
  ]);
});

test("forsinket kortafregning accepterer en entydig fire-dages weekendforskydning", () => {
  const matches = findSafeDelayedImportedJournalMatches(
    [{ id: 100, date: "2025-03-17", description: "Bauhaus Danmark", amount: -239.13, status: "afventer" }],
    [{ ...entry, id: 20, date: "2025-03-13", description: "BAUHAUS DANMARK" }],
    [{ journalEntryId: 20, accountId: 1, description: "BAUHAUS DANMARK", debit: 0, credit: 239.13 }],
    accounts,
  );
  assert.deepEqual(matches, [{ transactionId: 100, journalEntryId: 20 }]);
});

test("entydig bogføringsdato efter bankdato matches med samme fakturanummer", () => {
  const matches = findSafeDelayedImportedJournalMatches(
    [{ id: 21, date: "2025-04-10", description: "137", amount: 42_064.86, status: "afventer" }],
    [{ ...entry, id: 31, date: "2025-04-13", description: "Indbet. fak. 137" }],
    [{ journalEntryId: 31, accountId: 1, description: "Indbet. fak. 137", debit: 42_064.86, credit: 0 }],
    accounts,
  );
  assert.deepEqual(matches, [{ transactionId: 21, journalEntryId: 31 }]);
});

test("kendte korte brands matches kun som entydige nærdato-par", () => {
  const matches = findSafeDelayedImportedJournalMatches(
    [
      { id: 22, date: "2025-06-11", description: "10-4.DK", amount: -50_524.50, status: "afventer" },
      { id: 23, date: "2025-05-15", description: "F24 Tank", amount: -950, status: "afventer" },
      { id: 24, date: "2025-07-13", description: "Uno-X", amount: -88.64, status: "afventer" },
    ],
    [
      { ...entry, id: 32, date: "2025-06-10", description: "10-4 Tømmerhandel" },
      { ...entry, id: 33, date: "2025-05-14", description: "Q8 DANMARK" },
      { ...entry, id: 34, date: "2025-07-12", description: "Uno-X" },
    ],
    [
      { journalEntryId: 32, accountId: 1, description: "10-4 Tømmerhandel", debit: 0, credit: 50_524.50 },
      { journalEntryId: 33, accountId: 1, description: "Q8 DANMARK", debit: 0, credit: 950 },
      { journalEntryId: 34, accountId: 1, description: "Uno-X", debit: 0, credit: 88.64 },
    ],
    accounts,
  );
  assert.deepEqual(matches, [
    { transactionId: 22, journalEntryId: 32 },
    { transactionId: 23, journalEntryId: 33 },
    { transactionId: 24, journalEntryId: 34 },
  ]);
});

test("leverandørmatch normaliserer HTML, bindeord og filialtekst", () => {
  assert.equal(isStrongMerchantMatch("Jem & Fix", "Jem &amp; Fix"), true);
  assert.equal(isStrongMerchantMatch("Jem & Fix", "Jem og fix stolpebeton"), true);
  assert.equal(isStrongMerchantMatch("916 STARK FREDERIKSV", "STARK"), true);
  assert.equal(isStrongMerchantMatch("Nord Service", "Syd Service"), false);
});

test("forsinket match afviser generiske tekster, for lang forsinkelse og genbrug", () => {
  assert.equal(isStrongMerchantMatch("Transfer", "Transfer"), false);
  const matches = findSafeDelayedImportedJournalMatches(
    [
      { id: 100, date: "2025-05-17", description: "Transfer", amount: -1_000, status: "afventer" },
      { id: 101, date: "2025-05-21", description: "Bauhaus", amount: -2_000, status: "afventer" },
      { id: 102, date: "2025-05-17", description: "Bauhaus", amount: -3_000, status: "afventer" },
    ],
    [
      { ...entry, id: 20, date: "2025-05-16", description: "Transfer" },
      { ...entry, id: 21, date: "2025-05-16", description: "Bauhaus" },
      { ...entry, id: 22, date: "2025-05-16", description: "Bauhaus" },
    ],
    [
      { journalEntryId: 20, accountId: 1, description: "Transfer", debit: 0, credit: 1_000 },
      { journalEntryId: 21, accountId: 1, description: "Bauhaus", debit: 0, credit: 2_000 },
      { journalEntryId: 22, accountId: 1, description: "Bauhaus", debit: 0, credit: 3_000 },
    ],
    accounts,
    new Set([22]),
  );
  assert.deepEqual(matches, []);
});

import assert from "node:assert/strict";
import test from "node:test";
import { prepareDocumentInbox } from "../server/document-inbox-order";

test("bilag sorteres efter fakturadato og bilag uden dato placeres sidst", () => {
  const result = prepareDocumentInbox([
    { id: 3, invoiceDate: null, createdAt: "2026-01-01T10:00:00Z", amount: 100 },
    { id: 4, invoiceDate: "2026-02-31", createdAt: "2026-01-02T10:00:00Z", amount: 100 },
    { id: 2, invoiceDate: "2026-02-01", createdAt: "2026-02-02T10:00:00Z", amount: 200 },
    { id: 1, invoiceDate: "2026-01-01", createdAt: "2026-02-03T10:00:00Z", amount: 300 },
  ], []);
  assert.deepEqual(result.map((item) => item.id), [1, 2, 3, 4]);
});

test("bankforslag kræver samme beløb, åben bankpost og en nærliggende dato", () => {
  const result = prepareDocumentInbox([
    { id: 1, invoiceDate: "2026-01-10", createdAt: "2026-01-10T10:00:00Z", amount: 1250 },
    { id: 2, invoiceDate: "2026-02-10", createdAt: "2026-02-10T10:00:00Z", amount: 1250 },
  ], [
    { id: 10, date: "2026-01-15", description: "Leverandør A", amount: -1250, status: "afventer", matchedId: null },
    { id: 11, date: "2026-02-20", description: "Leverandør B", amount: -1250, status: "afventer", matchedId: null },
    { id: 12, date: "2026-01-11", description: "Allerede matchet", amount: -1250, status: "matchet", matchedId: 9 },
  ]);
  assert.equal(result[0].bankMatch?.transactionId, 10);
  assert.equal(result[0].bankMatch?.confidence, "hoej");
  assert.equal(result[1].bankMatch?.transactionId, 11);
  assert.equal(result[1].bankMatch?.confidence, "middel");
});

test("samme bankpost foreslås aldrig til to bilag", () => {
  const result = prepareDocumentInbox([
    { id: 1, invoiceDate: "2026-03-01", amount: 500 },
    { id: 2, invoiceDate: "2026-03-02", amount: 500 },
  ], [{ id: 20, date: "2026-03-04", amount: -500, status: "afventer", matchedId: null }]);
  assert.equal(result.filter((item) => item.bankMatch?.transactionId === 20).length, 1);
});

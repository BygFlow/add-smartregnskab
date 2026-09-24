import assert from "node:assert/strict";
import test from "node:test";
import { auditActionLabel, auditChangeLabels, auditEntityLabel, auditModuleLabel } from "../shared/audit-display";

test("document audit entries show their filename and actual status transition", () => {
  const entry = {
    action: "bilag_til_papirkurv",
    target: "document_inbox#12",
    detail: JSON.stringify({ fileName: "faktura-12.pdf", fromStatus: "arkiveret", toStatus: "papirkurv" }),
  };
  assert.equal(auditModuleLabel(entry), "Bilag");
  assert.equal(auditActionLabel(entry.action), "Flyttet til papirkurv");
  assert.equal(auditEntityLabel(entry), "faktura-12.pdf");
  assert.deepEqual(auditChangeLabels(entry), ["Arkiveret", "Papirkurv"]);
});

test("older audit entries and non-JSON detail remain readable", () => {
  const restored = { action: "bilag_gendannet", target: "document_inbox#2" };
  assert.equal(auditEntityLabel(restored), "document_inbox#2");
  assert.deepEqual(auditChangeLabels(restored), ["Papirkurv", "Ny"]);
  const booked = { action: "bilag_bogført", target: "journal_entry#4", detail: "Bilag #2; hash test" };
  assert.equal(auditModuleLabel(booked), "Bilag");
  assert.equal(auditEntityLabel(booked), "journal_entry#4");
  assert.deepEqual(auditChangeLabels(booked), ["—", "—"]);
});

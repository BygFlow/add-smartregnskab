import assert from "node:assert/strict";
import test from "node:test";
import { validateMitidBusinessClaims, validCvr } from "../server/mitid-claims";

test("accepterer kun tegningsberettiget MitID Erhverv med forventet CVR", () => {
  const identity = validateMitidBusinessClaims({
    sub: "private-subject",
    uuid: "private-uuid",
    identityscheme: "dkmitid",
    cvrNumberIdentifier: "46761898",
    companySignatory: "true",
    acr: "urn:grn:authn:dk:mitid:business",
    auth_time: 1_793_750_400,
    cprNumberIdentifier: "skal-aldrig-gemmes",
  }, "46761898");

  assert.equal(identity.cvr, "46761898");
  assert.equal(identity.actorRole, "company_signatory");
  assert.equal(identity.subjectHash.length, 64);
  assert.equal(identity.identityUuidHash?.length, 64);
  assert.equal("cprNumberIdentifier" in identity, false);
});

test("afviser medarbejder uden tegningsret", () => {
  assert.throws(() => validateMitidBusinessClaims({
    sub: "subject",
    identityscheme: "dkmitid",
    cvrNumberIdentifier: "46761898",
    employee: true,
  }, "46761898"), /signatory_required/);
});

test("afviser et andet CVR", () => {
  assert.throws(() => validateMitidBusinessClaims({
    sub: "subject",
    identityscheme: "dkmitid",
    cvrNumberIdentifier: "12345678",
    companySignatory: true,
  }, "46761898"), /cvr_mismatch/);
});

test("CVR-normalisering kræver præcis otte cifre", () => {
  assert.equal(validCvr("46 761 898"), "46761898");
  assert.equal(validCvr("123"), null);
});

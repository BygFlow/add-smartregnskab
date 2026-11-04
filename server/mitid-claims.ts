import { createHash } from "node:crypto";
import type { JWTPayload } from "jose";

export const MITID_BUSINESS_ACR = "urn:grn:authn:dk:mitid:business";

export type VerifiedBusinessIdentity = {
  cvr: string;
  subjectHash: string;
  identityUuidHash: string | null;
  actorRole: "company_signatory";
  assuranceLevel: string;
  authTime: number | null;
};

export function validCvr(value: unknown): string | null {
  const cvr = String(value ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(cvr) ? cvr : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function truthyClaim(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * Validerer kun de virksomhedsclaims, vi har behov for. CPR og rå tokenclaims
 * returneres aldrig fra funktionen og kan derfor ikke ende i databasen.
 */
export function validateMitidBusinessClaims(
  claims: JWTPayload,
  expectedCvr: string,
): VerifiedBusinessIdentity {
  const cvr = validCvr(claims.cvrNumberIdentifier);
  if (!cvr || cvr !== expectedCvr) throw new Error("cvr_mismatch");

  const identityScheme = String(claims.identityscheme ?? "").toLowerCase();
  if (identityScheme && identityScheme !== "dkmitid") throw new Error("wrong_identity_scheme");

  if (!truthyClaim(claims.companySignatory)) {
    throw new Error(truthyClaim(claims.employee) ? "signatory_required" : "business_role_missing");
  }

  const subject = String(claims.sub ?? "");
  if (!subject) throw new Error("subject_missing");
  const uuid = String(claims.uuid ?? "");
  const acr = String(claims.acr ?? MITID_BUSINESS_ACR);

  return {
    cvr,
    subjectHash: sha256(subject),
    identityUuidHash: uuid ? sha256(uuid) : null,
    actorRole: "company_signatory",
    assuranceLevel: acr,
    authTime: typeof claims.auth_time === "number" ? claims.auth_time : null,
  };
}

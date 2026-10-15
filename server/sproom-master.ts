import type { SproomChildCompany } from "@shared/schema";
import {
  linkSproomChildCompany,
  normalizeDanishCvr,
  requestSproomOnboarding,
  sproomConnectionForCompany,
  sproomConnectionForCvr,
  updateSproomConnection,
  type SproomProduct,
} from "./sproom-registry";

type ProvisionInput = {
  companyId: number;
  companyName: string;
  cvr: unknown;
  userEmail: string;
  sourceProducts?: SproomProduct[];
  consentAt: string;
  consentBy: string;
};

export type SproomProvisionAction =
  | "already_connected"
  | "await_master_activation"
  | "child_created"
  | "enrollment_requested"
  | "await_enrollment";

export type SproomProvisionResult = {
  action: SproomProvisionAction;
  connection: SproomChildCompany;
};

const enabled = (name: string) => /^(1|true|yes)$/i.test(String(process.env[name] || ""));
const baseUrl = () => String(process.env.SPROOM_API_URL || "https://sproom.net/api").replace(/\/$/, "");
const masterToken = () => String(process.env.SPROOM_API_TOKEN || "").trim();

function verifyMasterIdentity() {
  const parent = normalizeDanishCvr(process.env.SPROOM_PARENT_CVR || process.env.PLATFORM_COMPANY_CVR);
  const platform = process.env.PLATFORM_COMPANY_CVR ? normalizeDanishCvr(process.env.PLATFORM_COMPANY_CVR) : parent;
  if (parent !== platform) throw new Error("Sproom parent-CVR matcher ikke ADD SmartDrift ApS' platform-CVR. Automatisk onboarding er stoppet.");
  return parent;
}

async function masterRequest(path: string, init: RequestInit = {}) {
  const token = masterToken();
  if (!token) throw new Error("Sproom-mastertoken mangler.");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json, */*");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  return { response, body: await response.text() };
}

function json(body: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function identifier(body: string, location: string | null, keys: string[]): string {
  const parsed = json(body);
  const direct = keys.map((key) => String(parsed[key] || "").trim()).find(Boolean);
  if (direct) return direct;
  const fromLocation = String(location || "").split(/[/?#]/).filter(Boolean).at(-1) || "";
  if (/^[a-zA-Z0-9_-]{6,160}$/.test(fromLocation)) return fromLocation;
  return body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || "";
}

function safeProviderError(body: string, fallback: string): string {
  const parsed = json(body);
  return String(parsed.message || parsed.error || parsed.title || fallback).replace(/\s+/g, " ").slice(0, 500);
}

async function startEnrollment(input: ProvisionInput, childCompanyId?: string): Promise<SproomProvisionResult> {
  const userEmail = String(input.userEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    const connection = updateSproomConnection({
      companyId: input.companyId,
      ...(childCompanyId ? { externalCompanyId: childCompanyId } : {}),
      status: "tilmelding_fejlet",
      lastError: "En gyldig e-mail til virksomhedens tegningsberettigede mangler.",
    });
    throw Object.assign(new Error("Virksomheden findes allerede hos Sproom. Udfyld en gyldig e-mail til den tegningsberettigede og prøv igen."), { connection });
  }
  const payload = {
    childCompanyName: input.companyName.trim(),
    organizationIdentifier: { schemeId: "DK:CVR", value: normalizeDanishCvr(input.cvr) },
    userEmail,
    parentCompanyName: String(process.env.SPROOM_PARENT_NAME || "ADD SmartDrift ApS").trim(),
    shouldSendEmail: true,
  };
  const { response, body } = await masterRequest("/child-companies/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const reason = safeProviderError(body, `Sproom svarede ${response.status}`);
    updateSproomConnection({ companyId: input.companyId, ...(childCompanyId ? { externalCompanyId: childCompanyId } : {}), status: "tilmelding_fejlet", lastError: reason });
    if (response.status === 403) throw new Error("Sproom har endnu ikke aktiveret Integration Service/masteradgang på parent-kontoen.");
    throw new Error(`Sproom kunne ikke starte tilmeldingen (${response.status}): ${reason}`);
  }
  // Sproom returns an authentication link. It can contain a one-time credential,
  // so it is deliberately neither logged nor persisted; Sproom sends it to the
  // authorised user because shouldSendEmail is true.
  const connection = updateSproomConnection({
    companyId: input.companyId,
    ...(childCompanyId ? { externalCompanyId: childCompanyId } : {}),
    status: "afventer_tilmelding",
    enrollmentId: null,
    lastError: null,
  });
  return { action: "enrollment_requested", connection };
}

export async function provisionSproomChildCompany(input: ProvisionInput): Promise<SproomProvisionResult> {
  let connection = requestSproomOnboarding(input);
  if (connection.status === "forbundet" && connection.externalCompanyId) {
    if (enabled("SPROOM_AUTO_REGISTER_NEMHANDEL") && connection.nemhandelStatus !== "aktiv") {
      connection = await registerSproomNemhandel(input.companyId);
    }
    return { action: "already_connected", connection };
  }
  if (connection.status === "afventer_tilmelding" && connection.externalCompanyId) return { action: "await_enrollment", connection };

  const automatic = enabled("SPROOM_AUTOMATIC_PROVISIONING");
  if (!automatic || String(process.env.EINVOICE_PROVIDER || "").toLowerCase() !== "sproom" || !masterToken()) {
    return { action: "await_master_activation", connection };
  }
  verifyMasterIdentity();

  if (connection.externalCompanyId && connection.status === "tilmelding_fejlet") {
    return startEnrollment(input, connection.externalCompanyId);
  }

  const cvr = normalizeDanishCvr(input.cvr);
  const { response, body } = await masterRequest("/child-companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: input.companyName.trim(),
      organizationIdentifier: { schemeId: "DK:CVR", value: cvr },
    }),
  });
  const childCompanyId = identifier(body, response.headers.get("location"), ["companyId", "childCompanyId", "id"]);
  if (response.ok) {
    if (!childCompanyId) throw new Error("Sproom oprettede virksomheden, men returnerede ikke et child-company-ID.");
    connection = linkSproomChildCompany({
      companyId: input.companyId,
      externalCompanyId: childCompanyId,
      sourceProducts: input.sourceProducts,
      nemhandelStatus: enabled("SPROOM_AUTO_REGISTER_NEMHANDEL") ? "afventer_registrering" : "afventer_aktivering",
      peppolStatus: "kræver_verifikation",
    });
    if (enabled("SPROOM_AUTO_REGISTER_NEMHANDEL")) connection = await registerSproomNemhandel(input.companyId);
    return { action: "child_created", connection };
  }
  if (response.status === 409) {
    // A conflicting existing profile is enrolled by CVR. Sproom may omit its
    // company ID until the existing owner has accepted the enrollment.
    return startEnrollment(input, childCompanyId || undefined);
  }
  const reason = safeProviderError(body, `Sproom svarede ${response.status}`);
  updateSproomConnection({ companyId: input.companyId, status: "oprettelse_fejlet", lastError: reason });
  throw new Error(`Sproom kunne ikke oprette child-company (${response.status}): ${reason}`);
}

async function childToken(externalCompanyId: string): Promise<string> {
  const { response, body } = await masterRequest(`/child-companies/${encodeURIComponent(externalCompanyId)}/token`);
  if (!response.ok) throw new Error(`Sproom kunne ikke udstede virksomhedstoken (${response.status}): ${safeProviderError(body, "Ukendt fejl")}`);
  const parsed = json(body);
  const token = String(parsed.token || parsed.accessToken || parsed.access_token || body.replace(/^"|"$/g, "")).trim();
  if (!token) throw new Error("Sproom returnerede ikke et virksomhedstoken.");
  return token;
}

export async function registerSproomNemhandel(companyId: number): Promise<SproomChildCompany> {
  const connection = sproomConnectionForCompany(companyId);
  if (!connection?.externalCompanyId || connection.status !== "forbundet") throw new Error("Sproom child-company er endnu ikke forbundet.");
  if (!enabled("SPROOM_AUTO_REGISTER_NEMHANDEL")) {
    return updateSproomConnection({ companyId, nemhandelStatus: "afventer_aktivering", lastError: null });
  }
  try {
    const token = await childToken(connection.externalCompanyId);
    const response = await fetch(`${baseUrl()}/registrations/nemhandel`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ profiles: ["Nes5Customer"], endpointId: { schemeId: "DK:CVR", value: connection.cvr } }),
    });
    const body = await response.text();
    if (!response.ok) {
      const reason = safeProviderError(body, `Sproom svarede ${response.status}`);
      return updateSproomConnection({ companyId, nemhandelStatus: response.status === 409 ? "kræver_kontrol" : "fejlet", lastError: reason });
    }
    const networkId = identifier(body, response.headers.get("location"), ["networkId", "networkID", "id"]);
    return updateSproomConnection({ companyId, nemhandelStatus: "aktiv", nemhandelNetworkId: networkId, lastError: null });
  } catch (error) {
    return updateSproomConnection({ companyId, nemhandelStatus: "fejlet", lastError: error instanceof Error ? error.message : "NemHandel-registreringen fejlede." });
  }
}

export async function acceptSproomEnrollment(input: { cvr: unknown; externalCompanyId: unknown }): Promise<SproomChildCompany> {
  const cvr = normalizeDanishCvr(input.cvr);
  const connection = sproomConnectionForCvr(cvr);
  if (!connection) throw new Error("Sproom-tilmeldingen matcher ikke en godkendt kundeorganisation.");
  const linked = linkSproomChildCompany({
    companyId: connection.companyId,
    externalCompanyId: input.externalCompanyId,
    nemhandelStatus: enabled("SPROOM_AUTO_REGISTER_NEMHANDEL") ? "afventer_registrering" : "afventer_aktivering",
    peppolStatus: "kræver_verifikation",
  });
  return enabled("SPROOM_AUTO_REGISTER_NEMHANDEL") ? registerSproomNemhandel(linked.companyId) : linked;
}

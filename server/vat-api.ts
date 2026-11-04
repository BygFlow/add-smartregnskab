import { randomUUID } from "node:crypto";
import { createClientAsync, WSSecurityCert, type Client } from "soap";

export const VAT_API_FIELDS = [
  "MomsAngivelseAfgiftTilsvarBeloeb",
  "MomsAngivelseCO2AfgiftBeloeb",
  "MomsAngivelseEUKoebBeloeb",
  "MomsAngivelseEUSalgBeloebVarerBeloeb",
  "MomsAngivelseIkkeEUSalgBeloebVarerBeloeb",
  "MomsAngivelseElAfgiftBeloeb",
  "MomsAngivelseEksportOmsaetningBeloeb",
  "MomsAngivelseGasAfgiftBeloeb",
  "MomsAngivelseKoebsMomsBeloeb",
  "MomsAngivelseKulAfgiftBeloeb",
  "MomsAngivelseMomsEUKoebBeloeb",
  "MomsAngivelseMomsEUYdelserBeloeb",
  "MomsAngivelseOlieAfgiftBeloeb",
  "MomsAngivelseSalgsMomsBeloeb",
  "MomsAngivelseVandAfgiftBeloeb",
  "MomsAngivelseEUKoebYdelseBeloeb",
  "MomsAngivelseEUSalgYdelseBeloeb",
] as const;

export type VatApiField = typeof VAT_API_FIELDS[number];
export type VatApiAmounts = Partial<Record<VatApiField, number>>;

type ServiceName = "calendar" | "draft" | "receipt";

const ENV_BY_SERVICE: Record<ServiceName, { wsdl: string; endpoint: string; operation: string }> = {
  calendar: {
    wsdl: "SKAT_MOMS_API_CALENDAR_WSDL",
    endpoint: "SKAT_MOMS_API_CALENDAR_ENDPOINT",
    operation: "VirksomhedKalenderHent",
  },
  draft: {
    wsdl: "SKAT_MOMS_API_DRAFT_WSDL",
    endpoint: "SKAT_MOMS_API_DRAFT_ENDPOINT",
    operation: "ModtagMomsangivelseForeloebig",
  },
  receipt: {
    wsdl: "SKAT_MOMS_API_RECEIPT_WSDL",
    endpoint: "SKAT_MOMS_API_RECEIPT_ENDPOINT",
    operation: "MomsangivelseKvitteringHent",
  },
};

const env = (name: string) => String(process.env[name] ?? "").trim();
const pem = (name: string) => env(name).replace(/\\n/g, "\n");
const digits8 = (value: unknown, label = "SE-nummer") => {
  const normalized = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(normalized)) throw new Error(`${label} skal bestå af 8 cifre.`);
  return normalized;
};
const isoDate = (value: unknown, label: string) => {
  const normalized = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error(`${label} skal være en gyldig dato i formatet ÅÅÅÅ-MM-DD.`);
  }
  return normalized;
};
const transaction = () => ({
  TransaktionIdentifikator: randomUUID().toUpperCase(),
  TransaktionTid: new Date().toISOString(),
});

export function vatApiProviderStatus() {
  const endpoints = Object.fromEntries(Object.entries(ENV_BY_SERVICE).map(([service, names]) => [service, {
    wsdl: Boolean(env(names.wsdl)),
    endpoint: Boolean(env(names.endpoint)),
  }]));
  const certificateConfigured = Boolean(pem("SKAT_MOMS_API_PRIVATE_KEY_PEM") && pem("SKAT_MOMS_API_CERT_PEM"));
  const providerCvr = env("SKAT_MOMS_API_PROVIDER_CVR").replace(/\D/g, "");
  const configured = certificateConfigured
    && /^\d{8}$/.test(providerCvr)
    && Object.values(endpoints).every((value) => value.wsdl && value.endpoint);
  return {
    configured,
    environment: env("SKAT_MOMS_API_ENVIRONMENT") || "ikke_konfigureret",
    providerCvrConfigured: /^\d{8}$/.test(providerCvr),
    certificateConfigured,
    endpoints,
    humanApprovalRequired: true,
    finalApprovalLocation: "TastSelv Erhverv",
  };
}

export function buildVatCalendarRequest(input: { seNumber: string; from: string; to: string }) {
  const from = isoDate(input.from, "Fra-dato");
  const to = isoDate(input.to, "Til-dato");
  if (from > to) throw new Error("Fra-dato må ikke ligge efter til-dato.");
  return {
    HovedOplysninger: transaction(),
    VirksomhedSENummerIdentifikator: digits8(input.seNumber),
    AngivelseTypeNavn: "Moms",
    AngivelseBetalingFristHentFra: {
      SoegeDatoFraDate: from,
      SoegeDatoTilDate: to,
    },
  };
}

export function buildVatDraftRequest(input: {
  seNumber: string;
  periodFrom: string;
  periodTo: string;
  amounts: VatApiAmounts;
}) {
  const periodFrom = isoDate(input.periodFrom, "Periodens startdato");
  const periodTo = isoDate(input.periodTo, "Periodens slutdato");
  if (periodFrom > periodTo) throw new Error("Periodens startdato må ikke ligge efter slutdatoen.");
  const unknown = Object.keys(input.amounts ?? {}).filter((key) => !VAT_API_FIELDS.includes(key as VatApiField));
  if (unknown.length) throw new Error(`Ukendte moms-felter: ${unknown.join(", ")}.`);
  const orderedAmounts: Record<string, number> = {};
  for (const field of VAT_API_FIELDS) {
    const value = input.amounts?.[field];
    if (value == null) continue;
    const amount = Number(value);
    if (!Number.isFinite(amount) || Math.abs(amount) > 9_999_999_999_999) {
      throw new Error(`${field} indeholder et ugyldigt beløb.`);
    }
    orderedAmounts[field] = Math.round(amount * 100) / 100;
  }
  if (!("MomsAngivelseAfgiftTilsvarBeloeb" in orderedAmounts)) {
    throw new Error("Moms i alt (MomsAngivelseAfgiftTilsvarBeloeb) er påkrævet.");
  }
  return {
    HovedOplysninger: transaction(),
    Angivelse: {
      AngiverVirksomhedSENummer: {
        VirksomhedSENummerIdentifikator: digits8(input.seNumber),
      },
      Angivelsesoplysninger: {
        AngivelsePeriodeFraDato: periodFrom,
        AngivelsePeriodeTilDato: periodTo,
      },
      Angivelsesafgifter: orderedAmounts,
    },
  };
}

export function buildVatReceiptRequest(input: { seNumber: string; providerTransactionId: string }) {
  const providerTransactionId = String(input.providerTransactionId ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,100}$/.test(providerTransactionId)) {
    throw new Error("Transaktions-id fra momsudkastet er ugyldigt.");
  }
  return {
    HovedOplysninger: transaction(),
    TransaktionIdentifier: providerTransactionId,
    Angiver: { VirksomhedSENummerIdentifikator: digits8(input.seNumber) },
  };
}

function findValue(value: unknown, wanted: Set<string>): unknown {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/^.*:/, "").toLowerCase();
    if (wanted.has(normalized)) return child;
    const nested = findValue(child, wanted);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export function normalizeVatDraftResponse(response: unknown) {
  const providerTransactionId = findValue(response, new Set(["transaktionidentifier"]));
  const deepLink = findValue(response, new Set(["urlindicator", "dybtlink"]));
  const rawLink = typeof deepLink === "string"
    ? deepLink
    : String(findValue(deepLink, new Set(["urlindicator"])) ?? "");
  let safeLink: string | null = null;
  try {
    const parsed = new URL(rawLink);
    if (parsed.protocol === "https:" && (parsed.hostname === "skat.dk" || parsed.hostname.endsWith(".skat.dk"))) {
      safeLink = parsed.toString();
    }
  } catch { /* Et ugyldigt link må aldrig sendes videre til browseren. */ }
  return {
    providerTransactionId: providerTransactionId == null ? null : String(providerTransactionId),
    deepLink: safeLink,
  };
}

export function normalizeVatReceiptResponse(response: unknown) {
  const receipt = findValue(response, new Set([
    "momsangivelsekvitteringdokument",
    "kvitteringdokument",
    "dokument",
  ]));
  const paymentId = findValue(response, new Set(["betalingsidentifikator", "betalingsid"]));
  const dueDate = findValue(response, new Set(["betalingsfristdate", "betalingsfrist"]));
  return {
    receiptBase64: typeof receipt === "string" ? receipt : null,
    paymentId: paymentId == null ? null : String(paymentId),
    dueDate: dueDate == null ? null : String(dueDate),
    received: Boolean(receipt || paymentId || dueDate),
  };
}

async function clientFor(service: ServiceName): Promise<{ client: Client; operation: string }> {
  const status = vatApiProviderStatus();
  if (!status.configured) {
    throw new Error("SKAT Moms API er ikke fuldt konfigureret med test-/produktionsendpoints og OCES3-certifikat.");
  }
  const names = ENV_BY_SERVICE[service];
  const client = await createClientAsync(env(names.wsdl), {
    disableCache: true,
    wsdl_options: { timeout: 20_000 },
  }, env(names.endpoint));
  client.setSecurity(new WSSecurityCert(
    pem("SKAT_MOMS_API_PRIVATE_KEY_PEM"),
    pem("SKAT_MOMS_API_CERT_PEM"),
    env("SKAT_MOMS_API_CERT_PASSPHRASE"),
    {
      hasTimeStamp: true,
      signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      signerOptions: { idMode: "wssecurity" },
    },
  ));
  return { client, operation: `${names.operation}Async` };
}

async function invoke(service: ServiceName, request: Record<string, unknown>) {
  const { client, operation } = await clientFor(service);
  const method = client[operation];
  if (typeof method !== "function") throw new Error(`SKAT WSDL mangler operationen ${operation}.`);
  const result = await method.call(client, request);
  return Array.isArray(result) ? result[0] : result;
}

export async function getVatCalendar(input: { seNumber: string; from: string; to: string }) {
  return invoke("calendar", buildVatCalendarRequest(input));
}

export async function createVatDraft(input: {
  seNumber: string;
  periodFrom: string;
  periodTo: string;
  amounts: VatApiAmounts;
}) {
  return normalizeVatDraftResponse(await invoke("draft", buildVatDraftRequest(input)));
}

export async function getVatReceipt(input: { seNumber: string; providerTransactionId: string }) {
  return normalizeVatReceiptResponse(await invoke("receipt", buildVatReceiptRequest(input)));
}

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

import { storage } from "./storage";
import { queueAndSend } from "./messaging";
import { addDays, addMonths, issueSubscriptionInvoice, round2 } from "./domain";
import type {
  Company,
  Payment,
  PaymentMethod,
  PlatformInvoice,
  Subscription,
} from "@shared/schema";

type PaymentProviderId = "stripe" | "mobilepay" | "betalingsservice";
type PaymentStatus = "afventer" | "gennemfoert" | "fejlet" | "simuleret";

interface SetupIntentInput {
  companyId: number;
  paymentMethodId?: number | null;
}

interface ProviderChargeInput {
  company: Company;
  invoice: PlatformInvoice;
  paymentMethod: PaymentMethod;
  attempt: number;
}

interface ProviderRefundInput {
  providerRef: string;
  amount: number;
  currency: "DKK";
}

interface ProviderResult {
  ok: boolean;
  status: PaymentStatus;
  providerRef: string | null;
  simulated: boolean;
  failureReason?: string;
  fileRecord?: string;
}

export interface PaymentProvider {
  id: string;
  label: string;
  readonly configured: boolean;
  createSetupIntent(input: SetupIntentInput): Promise<ProviderResult>;
  charge(input: ProviderChargeInput): Promise<ProviderResult>;
  refund(input: ProviderRefundInput): Promise<ProviderResult>;
  verifyWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
  ): { valid: boolean; eventId: string; eventType: string; data: Record<string, unknown> };
}

export interface ChargeInvoiceOptions {
  paymentMethodId?: number;
}

export interface ChargeInvoiceResult {
  ok: boolean;
  pending: boolean;
  simulated: boolean;
  payment: Payment | null;
  message: string;
}

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const MOBILEPAY_AUTH_URL =
  "https://api.mobilepay.dk/merchant-authentication-openapi/connect/token";
const MOBILEPAY_SUBSCRIPTIONS_API_BASE =
  "https://api.mobilepay.dk/subscriptions/api/v1";
const FIVE_MINUTES_SECONDS = 5 * 60;

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return now().slice(0, 10);
}

function asDkk(amount: number): number {
  return round2(amount);
}

/** Stripe forventer hele øre; afrunding foretages før konverteringen. */
function toOre(amount: number): number {
  return Math.round(asDkk(amount) * 100);
}

function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function simulatedReference(provider: string, seed: string): string {
  return `sim_${provider}_${stableHash(seed).slice(0, 24)}`;
}

function simulatedResult(provider: string, seed: string): ProviderResult {
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      status: "fejlet",
      providerRef: null,
      simulated: false,
      failureReason: `Betalingsudbyderen ${provider} er ikke konfigureret.`,
    };
  }
  return {
    ok: true,
    status: "simuleret",
    providerRef: simulatedReference(provider, seed),
    simulated: true,
  };
}

function parseJsonObject(rawBody: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function secureEqual(expected: Buffer, received: Buffer): boolean {
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function providerError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const root = payload as Record<string, unknown>;
  const error = root.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = stringValue((error as Record<string, unknown>).message);
    if (message) return message;
  }
  return stringValue(root.message) ?? fallback;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  return parseJsonObject(text);
}

async function stripeRequest(
  path: string,
  fields: Record<string, string | number | boolean | undefined>,
  idempotencyKey?: string,
): Promise<{ ok: boolean; payload: Record<string, unknown>; error?: string }> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) body.set(key, String(value));
  }

  try {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body.toString(),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, payload }
      : { ok: false, payload, error: providerError(payload, `Stripe svarede ${response.status}.`) };
  } catch (error: unknown) {
    return {
      ok: false,
      payload: {},
      error: `Netværksfejl hos Stripe: ${error instanceof Error ? error.message : "ukendt fejl"}`,
    };
  }
}

function stripeWebhookVerification(
  rawBody: string,
  signatureHeader: string | undefined,
): { valid: boolean; eventId: string; eventType: string; data: Record<string, unknown> } {
  const parsed = parseJsonObject(rawBody);
  const data = (parsed.data && typeof parsed.data === "object"
    ? parsed.data
    : {}) as Record<string, unknown>;
  const object = (data.object && typeof data.object === "object"
    ? data.object
    : {}) as Record<string, unknown>;
  const eventId =
    stringValue(parsed.id) ?? `stripe_${stableHash(rawBody).slice(0, 32)}`;
  const eventType = stringValue(parsed.type) ?? "ukendt";
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !signatureHeader) return { valid: false, eventId, eventType, data: parsed };

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const item of signatureHeader.split(",")) {
    const [key, value] = item.trim().split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  const ts = Number(timestamp);
  if (!timestamp || !Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > FIVE_MINUTES_SECONDS) {
    return { valid: false, eventId, eventType, data: parsed };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();
  const valid = signatures.some((signature) => {
    if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
    return secureEqual(expected, Buffer.from(signature, "hex"));
  });

  // `object` læses her for at validere den forventede Stripe-payloadform uden
  // at kassere fremtidige eventtyper.
  void object;
  return { valid, eventId, eventType, data: parsed };
}

async function mobilePayAccessToken(): Promise<{ token?: string; error?: string }> {
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.MOBILEPAY_CLIENT_ID!,
      client_secret: process.env.MOBILEPAY_CLIENT_SECRET!,
    });
    const response = await fetch(MOBILEPAY_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const payload = await readJson(response);
    const token = stringValue(payload.access_token);
    if (!response.ok || !token) {
      return { error: providerError(payload, `MobilePay svarede ${response.status}.`) };
    }
    return { token };
  } catch (error: unknown) {
    return {
      error: `Netværksfejl hos MobilePay: ${error instanceof Error ? error.message : "ukendt fejl"}`,
    };
  }
}

async function mobilePayRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; payload: Record<string, unknown>; error?: string }> {
  const access = await mobilePayAccessToken();
  if (!access.token) return { ok: false, payload: {}, error: access.error };

  try {
    const response = await fetch(`${MOBILEPAY_SUBSCRIPTIONS_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, payload }
      : { ok: false, payload, error: providerError(payload, `MobilePay svarede ${response.status}.`) };
  } catch (error: unknown) {
    return {
      ok: false,
      payload: {},
      error: `Netværksfejl hos MobilePay: ${error instanceof Error ? error.message : "ukendt fejl"}`,
    };
  }
}

function mobilePayWebhookVerification(
  rawBody: string,
  signatureHeader: string | undefined,
): { valid: boolean; eventId: string; eventType: string; data: Record<string, unknown> } {
  const data = parseJsonObject(rawBody);
  const eventId =
    stringValue(data.id) ??
    stringValue(data.eventId) ??
    `mobilepay_${stableHash(rawBody).slice(0, 32)}`;
  const eventType = stringValue(data.type) ?? stringValue(data.eventType) ?? "ukendt";
  const secret = process.env.MOBILEPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return { valid: false, eventId, eventType, data };

  const provided = signatureHeader
    .trim()
    .replace(/^sha256=/i, "")
    .replace(/^signature=/i, "");
  try {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
    const received = Buffer.from(provided, "base64");
    return { valid: secureEqual(expected, received), eventId, eventType, data };
  } catch {
    return { valid: false, eventId, eventType, data };
  }
}

const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe",
  get configured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  },
  async createSetupIntent(input) {
    if (!this.configured) return simulatedResult(this.id, `setup:${input.companyId}`);
    const response = await stripeRequest("/setup_intents", {
      usage: "off_session",
      "metadata[company_id]": input.companyId,
    });
    return response.ok
      ? {
          ok: true,
          status: "gennemfoert",
          providerRef: stringValue(response.payload.id) ?? null,
          simulated: false,
        }
      : {
          ok: false,
          status: "fejlet",
          providerRef: null,
          simulated: false,
          failureReason: response.error ?? "Kunne ikke oprette Stripe-opsætning.",
        };
  },
  async charge(input) {
    if (!this.configured) {
      return simulatedResult(this.id, `charge:${input.invoice.id}:${input.attempt}`);
    }
    const response = await stripeRequest(
      "/payment_intents",
      {
        amount: toOre(input.invoice.totalAmount),
        currency: "dkk",
        payment_method: input.paymentMethod.providerRef,
        confirm: true,
        off_session: true,
        description: `ADD SmartRegnskab abonnementsfaktura ${input.invoice.invoiceNumber}`,
        "metadata[company_id]": input.company.id,
        "metadata[platform_invoice_id]": input.invoice.id,
        "metadata[invoice_number]": input.invoice.invoiceNumber,
      },
      `addsmartregnskab-${input.invoice.id}-${input.attempt}`,
    );
    const providerRef = stringValue(response.payload.id) ?? null;
    const status = stringValue(response.payload.status);
    if (response.ok && status === "succeeded") {
      return { ok: true, status: "gennemfoert", providerRef, simulated: false };
    }
    return {
      ok: false,
      status: "fejlet",
      providerRef,
      simulated: false,
      failureReason:
        response.error ??
        providerError(response.payload, `Stripe-betalingen fik status ${status ?? "ukendt"}.`),
    };
  },
  async refund(input) {
    if (!this.configured) {
      return simulatedResult(this.id, `refund:${input.providerRef}:${toOre(input.amount)}`);
    }
    const response = await stripeRequest("/refunds", {
      payment_intent: input.providerRef,
      amount: toOre(input.amount),
    });
    return response.ok
      ? {
          ok: true,
          status: "gennemfoert",
          providerRef: stringValue(response.payload.id) ?? input.providerRef,
          simulated: false,
        }
      : {
          ok: false,
          status: "fejlet",
          providerRef: input.providerRef,
          simulated: false,
          failureReason: response.error ?? "Kunne ikke refundere hos Stripe.",
        };
  },
  verifyWebhook: stripeWebhookVerification,
};

const mobilePayProvider: PaymentProvider = {
  id: "mobilepay",
  label: "MobilePay Subscriptions",
  get configured(): boolean {
    return Boolean(
      process.env.MOBILEPAY_CLIENT_ID &&
        process.env.MOBILEPAY_CLIENT_SECRET &&
        process.env.MOBILEPAY_WEBHOOK_SECRET,
    );
  },
  async createSetupIntent(input) {
    if (!this.configured) return simulatedResult(this.id, `setup:${input.companyId}`);
    const response = await mobilePayRequest("/subscriptions", {
      externalReference: `addsmartregnskab-company-${input.companyId}`,
      description: "ADD SmartRegnskab abonnement",
    });
    return response.ok
      ? {
          ok: true,
          status: "gennemfoert",
          providerRef:
            stringValue(response.payload.id) ??
            stringValue(response.payload.subscriptionId) ??
            null,
          simulated: false,
        }
      : {
          ok: false,
          status: "fejlet",
          providerRef: null,
          simulated: false,
          failureReason: response.error ?? "Kunne ikke oprette MobilePay-aftale.",
        };
  },
  async charge(input) {
    if (!this.configured) {
      return simulatedResult(this.id, `charge:${input.invoice.id}:${input.attempt}`);
    }
    const response = await mobilePayRequest("/payments", {
      amount: toOre(input.invoice.totalAmount),
      currencyCode: "DKK",
      paymentToken: input.paymentMethod.providerRef,
      externalReference: `addsmartregnskab-invoice-${input.invoice.id}-attempt-${input.attempt}`,
      description: `ADD SmartRegnskab abonnementsfaktura ${input.invoice.invoiceNumber}`,
    });
    const providerRef =
      stringValue(response.payload.id) ??
      stringValue(response.payload.paymentId) ??
      stringValue(response.payload.reference) ??
      null;
    const status = stringValue(response.payload.status)?.toLowerCase();
    if (response.ok && (!status || ["succeeded", "completed", "approved"].includes(status))) {
      return { ok: true, status: "gennemfoert", providerRef, simulated: false };
    }
    return {
      ok: false,
      status: "fejlet",
      providerRef,
      simulated: false,
      failureReason:
        response.error ??
        providerError(response.payload, `MobilePay-betalingen fik status ${status ?? "ukendt"}.`),
    };
  },
  async refund(input) {
    if (!this.configured) {
      return simulatedResult(this.id, `refund:${input.providerRef}:${toOre(input.amount)}`);
    }
    const response = await mobilePayRequest(`/payments/${encodeURIComponent(input.providerRef)}/refunds`, {
      amount: toOre(input.amount),
      currencyCode: "DKK",
    });
    return response.ok
      ? {
          ok: true,
          status: "gennemfoert",
          providerRef: stringValue(response.payload.id) ?? input.providerRef,
          simulated: false,
        }
      : {
          ok: false,
          status: "fejlet",
          providerRef: input.providerRef,
          simulated: false,
          failureReason: response.error ?? "Kunne ikke refundere hos MobilePay.",
        };
  },
  verifyWebhook: mobilePayWebhookVerification,
};

const betalingsserviceProvider: PaymentProvider = {
  id: "betalingsservice",
  label: "Nets Betalingsservice",
  get configured(): boolean {
    return Boolean(process.env.BETALINGSSERVICE_PBS_NUMBER);
  },
  async createSetupIntent(input) {
    if (!this.configured) return simulatedResult(this.id, `setup:${input.companyId}`);
    // Betalingsservice opretter ikke et online setup-intent. Aftalen etableres
    // i Nets' filflow; referencen er derfor kun en intern, sporbar markør.
    return {
      ok: true,
      status: "afventer",
      providerRef: `bs_setup_${input.companyId}`,
      simulated: false,
    };
  },
  async charge(input) {
    if (!this.configured) {
      return simulatedResult(this.id, `charge:${input.invoice.id}:${input.attempt}`);
    }

    /*
     * Nets/BS Leverandørservice er filbaseret og har ingen live charge-API.
     * Denne betalingsoplysning skal med i den daglige bank-/Nets-fil, hvorefter
     * faktisk afregning først bekræftes via filretur eller afstemning.
     */
    const fileRecord = [
      "BETALINGSOPLYSNINGER",
      process.env.BETALINGSSERVICE_PBS_NUMBER,
      input.invoice.dueDate,
      toOre(input.invoice.totalAmount),
      input.invoice.invoiceNumber,
      input.paymentMethod.providerRef,
    ].join(";");
    return {
      ok: true,
      status: "afventer",
      providerRef: `bs_${stableHash(fileRecord).slice(0, 24)}`,
      simulated: false,
      fileRecord,
    };
  },
  async refund(input) {
    if (!this.configured) {
      return simulatedResult(this.id, `refund:${input.providerRef}:${toOre(input.amount)}`);
    }
    // Kreditering skal også sendes i en Nets-fil og kan ikke påstås gennemført nu.
    return {
      ok: true,
      status: "afventer",
      providerRef: `bs_refund_${stableHash(`${input.providerRef}:${toOre(input.amount)}`).slice(0, 24)}`,
      simulated: false,
    };
  },
  verifyWebhook(rawBody) {
    const data = parseJsonObject(rawBody);
    return {
      valid: false,
      eventId: stringValue(data.id) ?? `betalingsservice_${stableHash(rawBody).slice(0, 32)}`,
      eventType: stringValue(data.type) ?? "filretur",
      data,
    };
  },
};

const providers: Record<PaymentProviderId, PaymentProvider> = {
  stripe: stripeProvider,
  mobilepay: mobilePayProvider,
  betalingsservice: betalingsserviceProvider,
};

function getProvider(provider: string): PaymentProvider | undefined {
  return providers[provider as PaymentProviderId];
}

function missingEnvironment(provider: PaymentProviderId): string[] {
  const names: Record<PaymentProviderId, string[]> = {
    stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    mobilepay: [
      "MOBILEPAY_CLIENT_ID",
      "MOBILEPAY_CLIENT_SECRET",
      "MOBILEPAY_WEBHOOK_SECRET",
    ],
    betalingsservice: ["BETALINGSSERVICE_PBS_NUMBER"],
  };
  return names[provider].filter((name) => !process.env[name]);
}

export function paymentProviderStatus(): Array<{
  id: string;
  label: string;
  configured: boolean;
  missingEnv: string[];
}> {
  return (Object.keys(providers) as PaymentProviderId[]).map((id) => ({
    id,
    label: providers[id].label,
    configured: providers[id].configured,
    missingEnv: missingEnvironment(id),
  }));
}

async function writeAudit(
  companyId: number | null,
  action: string,
  target: string,
  detail: string,
): Promise<void> {
  await storage.createAuditLog({
    companyId,
    userId: null,
    userEmail: null,
    action,
    target,
    detail,
    createdAt: now(),
  });
}

async function notify(
  companyId: number,
  title: string,
  message: string,
  type: "info" | "warning" | "success",
): Promise<void> {
  await storage.createNotification({
    companyId,
    userId: null,
    title,
    message,
    type,
    read: false,
    createdAt: now(),
  });
}

async function settleInvoice(
  invoice: PlatformInvoice,
  payment: Payment,
  simulated: boolean,
): Promise<void> {
  const paidAt = now();
  await storage.updatePlatformInvoice(invoice.id, { status: "betalt", paidAt });
  const company = await storage.getCompany(invoice.companyId);
  if (company && (company.status === "spaerret" || company.status === "i_restance")) {
    await storage.updateCompany(company.id, { status: "aktiv" });
  }
  const subscription = await storage.getSubscriptionByCompany(invoice.companyId);
  if (subscription) {
    await storage.updateSubscription(subscription.id, {
      dunningStage: 0,
      lastPaymentAttempt: paidAt,
    });
  }
  const description = simulated
    ? `Simuleret betaling for ${invoice.invoiceNumber} er registreret. Ingen reel opkrævning er foretaget.`
    : `Betaling for ${invoice.invoiceNumber} er registreret.`;
  await writeAudit(
    invoice.companyId,
    simulated ? "betaling_simuleret" : "betaling_gennemfoert",
    `platform_invoice:${invoice.id}`,
    `${description} Betalingsforsøg ${payment.id}.`,
  );
  await notify(
    invoice.companyId,
    simulated ? "Simuleret betaling registreret" : "Betaling gennemført",
    description,
    simulated ? "info" : "success",
  );
}

async function recordFailedAttempt(
  invoice: PlatformInvoice,
  payment: Payment,
  reason: string,
): Promise<void> {
  await storage.updatePayment(payment.id, {
    status: "fejlet",
    failureReason: reason,
    settledAt: null,
  });
  if (invoice.dueDate < today() && invoice.status !== "betalt") {
    await storage.updatePlatformInvoice(invoice.id, { status: "forfalden" });
  }
  const subscription = await storage.getSubscriptionByCompany(invoice.companyId);
  if (subscription) {
    // Selve trinskiftet sker i runDunning, så en afvisning ikke springer
    // 3/7/14-dagesfristerne over.
    await storage.updateSubscription(subscription.id, { lastPaymentAttempt: now() });
  }
  await writeAudit(
    invoice.companyId,
    "betaling_fejlet",
    `platform_invoice:${invoice.id}`,
    `Betalingsforsøg ${payment.id} fejlede: ${reason}`,
  );
  await notify(
    invoice.companyId,
    "Betaling kunne ikke gennemføres",
    `Vi kunne ikke gennemføre betalingen for ${invoice.invoiceNumber}: ${reason}`,
    "warning",
  );
}

function invoiceById(invoices: PlatformInvoice[], id: number): PlatformInvoice | undefined {
  return invoices.find((invoice) => invoice.id === id);
}

async function findPaymentMethod(
  companyId: number,
  requestedId?: number,
): Promise<PaymentMethod | undefined> {
  if (requestedId !== undefined) {
    const method = await storage.getPaymentMethod(requestedId, companyId);
    return method?.status === "aktiv" ? method : undefined;
  }
  return storage.getDefaultPaymentMethod(companyId);
}

export async function chargeInvoice(
  platformInvoiceId: number,
  opts: ChargeInvoiceOptions = {},
): Promise<ChargeInvoiceResult> {
  const invoices = await storage.getPlatformInvoices();
  const invoice = invoiceById(invoices, platformInvoiceId);
  if (!invoice) {
    return {
      ok: false,
      pending: false,
      simulated: false,
      payment: null,
      message: "Abonnementsfakturaen findes ikke.",
    };
  }
  if (invoice.status === "betalt") {
    return {
      ok: false,
      pending: false,
      simulated: false,
      payment: null,
      message: "Abonnementsfakturaen er allerede betalt.",
    };
  }

  const company = await storage.getCompany(invoice.companyId);
  if (!company) {
    return {
      ok: false,
      pending: false,
      simulated: false,
      payment: null,
      message: "Virksomheden til abonnementsfakturaen findes ikke.",
    };
  }
  const method = await findPaymentMethod(company.id, opts.paymentMethodId);
  if (!method) {
    return {
      ok: false,
      pending: false,
      simulated: false,
      payment: null,
      message: "Der er ikke valgt et aktivt betalingsmiddel.",
    };
  }
  const provider = getProvider(method.provider);
  if (!provider) {
    return {
      ok: false,
      pending: false,
      simulated: false,
      payment: null,
      message: `Betalingsudbyderen "${method.provider}" understøttes ikke.`,
    };
  }

  const previous = await storage.getPaymentsForInvoice(invoice.id);
  const pendingBs = previous.find(
    (payment) => payment.provider === "betalingsservice" && payment.status === "afventer",
  );
  if (pendingBs) {
    return {
      ok: true,
      pending: true,
      simulated: false,
      payment: pendingBs,
      message: "Betalingsservice-opkrævningen afventer stadig bankfilens retur.",
    };
  }

  const payment = await storage.createPayment({
    companyId: company.id,
    platformInvoiceId: invoice.id,
    paymentMethodId: method.id,
    provider: provider.id,
    providerRef: null,
    amount: asDkk(invoice.totalAmount),
    currency: "DKK",
    status: "afventer",
    failureReason: null,
    attempt: previous.length + 1,
    createdAt: now(),
    settledAt: null,
  });

  const result = await provider.charge({
    company,
    invoice,
    paymentMethod: method,
    attempt: payment.attempt,
  });

  if (!result.ok) {
    const reason = result.failureReason ?? "Betalingsudbyderen afviste opkrævningen.";
    const failedPayment = (await storage.updatePayment(payment.id, {
      providerRef: result.providerRef,
      status: "fejlet",
      failureReason: reason,
      settledAt: null,
    }))!;
    await recordFailedAttempt(invoice, failedPayment, reason);
    return {
      ok: false,
      pending: false,
      simulated: result.simulated,
      payment: failedPayment,
      message: reason,
    };
  }

  const savedPayment = (await storage.updatePayment(payment.id, {
    providerRef: result.providerRef,
    status: result.status,
    failureReason: result.fileRecord ?? null,
    settledAt: result.status === "gennemfoert" ? now() : null,
  }))!;
  if (result.status === "afventer") {
    await writeAudit(
      company.id,
      "betalingsservice_afventer",
      `platform_invoice:${invoice.id}`,
      "Betalingsoplysning er oprettet til Nets/BS-fil; den er ikke betalt endnu.",
    );
    await notify(
      company.id,
      "Betaling afventer bankfil",
      `Opkrævningen for ${invoice.invoiceNumber} er klargjort til Betalingsservice og afventer bankfilens retur.`,
      "info",
    );
    return {
      ok: true,
      pending: true,
      simulated: false,
      payment: savedPayment,
      message: "Betalingsoplysningen afventer bankfilens retur.",
    };
  }

  await settleInvoice(invoice, savedPayment, result.simulated);
  return {
    ok: true,
    pending: false,
    simulated: result.simulated,
    payment: savedPayment,
    message: result.simulated
      ? "Simuleret betaling er registreret; ingen reel opkrævning er foretaget."
      : "Betalingen er gennemført.",
  };
}

function overdueDays(invoice: PlatformInvoice, todayIso: string): number {
  const dueAt = Date.parse(`${invoice.dueDate}T00:00:00Z`);
  const nowAt = Date.parse(`${todayIso}T00:00:00Z`);
  return Number.isFinite(dueAt) && Number.isFinite(nowAt)
    ? Math.floor((nowAt - dueAt) / 86_400_000)
    : -1;
}

function eligibleDunningStage(
  invoice: PlatformInvoice,
  currentStage: number,
  todayIso: string,
): 1 | 2 | 3 | null {
  if (currentStage === 0 && addDays(invoice.dueDate, 3) <= todayIso) return 1;
  if (currentStage === 1 && addDays(invoice.dueDate, 7) <= todayIso) return 2;
  if (currentStage === 2 && addDays(invoice.dueDate, 14) <= todayIso) return 3;
  return null;
}

function dunningMessage(
  company: Company,
  invoice: PlatformInvoice,
  stage: 1 | 2 | 3,
  todayIso: string,
): {
  subject: string;
  body: string;
} {
  const amount = asDkk(invoice.totalAmount).toFixed(2).replace(".", ",");
  const days = overdueDays(invoice, todayIso);
  if (stage === 1) {
    return {
      subject: `Venlig påmindelse om faktura ${invoice.invoiceNumber}`,
      body:
        `Hej ${company.name}\n\n` +
        `Vi mangler fortsat betaling af abonnementsfaktura ${invoice.invoiceNumber} på ${amount} kr. ` +
        `Den havde forfald ${invoice.dueDate}.\n\n` +
        "Hvis du allerede har betalt, kan du se bort fra denne påmindelse.\n\n" +
        "Med venlig hilsen\nADD SmartRegnskab",
    };
  }
  if (stage === 2) {
    return {
      subject: `Vigtig betalingspåmindelse: faktura ${invoice.invoiceNumber}`,
      body:
        `Hej ${company.name}\n\n` +
        `Faktura ${invoice.invoiceNumber} på ${amount} kr. er stadig ikke betalt (${days} dage efter forfald). ` +
        "Virksomheden er nu registreret i restance. Opdatér venligst betalingsmidlet eller kontakt os.\n\n" +
        "Med venlig hilsen\nADD SmartRegnskab",
    };
  }
  return {
    subject: `Adgang spærres: faktura ${invoice.invoiceNumber}`,
    body:
      `Hej ${company.name}\n\n` +
      `Vi har stadig ikke modtaget betaling af faktura ${invoice.invoiceNumber} på ${amount} kr. ` +
      "Adgangen til ADD SmartRegnskab er derfor spærret, indtil betalingen er registreret.\n\n" +
      "Med venlig hilsen\nADD SmartRegnskab",
  };
}

export async function runDunning(
  todayIso: string,
): Promise<{ stage1: number; stage2: number; stage3: number; charged: number; failed: number }> {
  const result = { stage1: 0, stage2: 0, stage3: 0, charged: 0, failed: 0 };
  const [subscriptions, invoices] = await Promise.all([
    storage.getSubscriptions(),
    storage.getPlatformInvoices(),
  ]);

  for (const subscription of subscriptions) {
    if (subscription.status === "opsagt") continue;
    const open = invoices
      .filter(
        (invoice) =>
          invoice.subscriptionId === subscription.id &&
          invoice.status !== "betalt" &&
          invoice.dueDate <= todayIso,
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (!open) continue;

    const nextStage = eligibleDunningStage(open, subscription.dunningStage, todayIso);
    if (!nextStage) continue;
    const company = await storage.getCompany(subscription.companyId);
    if (!company) continue;

    await storage.updateSubscription(subscription.id, { dunningStage: nextStage });
    if (nextStage === 2) await storage.updateCompany(company.id, { status: "i_restance" });
    if (nextStage === 3) await storage.updateCompany(company.id, { status: "spaerret" });

    if (nextStage === 1) result.stage1++;
    if (nextStage === 2) result.stage2++;
    if (nextStage === 3) result.stage3++;

    const email = dunningMessage(company, open, nextStage, todayIso);
    if (company.email) {
      await queueAndSend({
        companyId: company.id,
        channel: "email",
        recipient: company.email,
        subject: email.subject,
        body: email.body,
        relatedType: "rykker",
        relatedId: open.id,
      });
    }
    await writeAudit(
      company.id,
      `rykker_trin_${nextStage}`,
      `platform_invoice:${open.id}`,
      `Rykkertrin ${nextStage} er aktiveret for faktura ${open.invoiceNumber}.`,
    );
    await notify(company.id, email.subject, email.body, nextStage === 1 ? "info" : "warning");

    const method = await storage.getDefaultPaymentMethod(company.id);
    if (!method) continue;
    const charged = await chargeInvoice(open.id);
    if (charged.ok && !charged.pending) result.charged++;
    else if (!charged.ok) result.failed++;
  }
  return result;
}

export async function renewSubscriptions(
  todayIso: string,
): Promise<{ issued: number; charged: number; failed: number; skippedTrial: number }> {
  const result = { issued: 0, charged: 0, failed: 0, skippedTrial: 0 };
  const subscriptions = await storage.getSubscriptions();

  for (const subscription of subscriptions) {
    if (subscription.autoRenew !== 1 || subscription.status === "opsagt") continue;
    if (subscription.currentPeriodEnd > todayIso) continue;
    if (subscription.status === "proeve" && subscription.trialEndsAt && subscription.trialEndsAt > todayIso) {
      result.skippedTrial++;
      continue;
    }

    try {
      // issueSubscriptionInvoice flytter selv perioden én eller tolv måneder frem
      // med domænets kalenderlogik (addMonths), inklusive månedsskifte.
      const invoice = await issueSubscriptionInvoice(subscription.companyId, todayIso);
      result.issued++;
      const charged = await chargeInvoice(invoice.id);
      if (charged.ok && !charged.pending) result.charged++;
      if (!charged.ok) result.failed++;
    } catch (error: unknown) {
      result.failed++;
      await writeAudit(
        subscription.companyId,
        "abonnement_fornyelse_fejlet",
        `subscription:${subscription.id}`,
        error instanceof Error ? error.message : "Ukendt fejl ved abonnementsfornyelse.",
      );
    }
  }
  return result;
}

function webhookObject(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data.data;
  if (nested && typeof nested === "object") {
    const object = (nested as Record<string, unknown>).object;
    if (object && typeof object === "object") return object as Record<string, unknown>;
  }
  const direct = data.object;
  return direct && typeof direct === "object" ? (direct as Record<string, unknown>) : data;
}

function webhookProviderReference(data: Record<string, unknown>): string | undefined {
  const object = webhookObject(data);
  return (
    stringValue(object.payment_intent) ??
    stringValue(object.paymentIntentId) ??
    stringValue(object.paymentId) ??
    stringValue(object.reference) ??
    stringValue(object.id)
  );
}

function webhookFailureReason(data: Record<string, unknown>): string {
  const object = webhookObject(data);
  const error = object.last_payment_error ?? object.error ?? data.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    return stringValue((error as Record<string, unknown>).message) ?? "Betalingen blev afvist.";
  }
  return stringValue(object.failureReason) ?? "Betalingen blev afvist.";
}

async function setWebhookPaymentSucceeded(payment: Payment): Promise<void> {
  const invoices = await storage.getPlatformInvoices(payment.companyId);
  const invoice = payment.platformInvoiceId
    ? invoiceById(invoices, payment.platformInvoiceId)
    : undefined;
  await storage.updatePayment(payment.id, {
    status: "gennemfoert",
    failureReason: null,
    settledAt: now(),
  });
  if (invoice && invoice.status !== "betalt") {
    await settleInvoice(invoice, payment, false);
  }
}

async function setWebhookPaymentFailed(payment: Payment, reason: string): Promise<void> {
  const invoices = await storage.getPlatformInvoices(payment.companyId);
  const invoice = payment.platformInvoiceId
    ? invoiceById(invoices, payment.platformInvoiceId)
    : undefined;
  if (invoice) await recordFailedAttempt(invoice, payment, reason);
  else {
    await storage.updatePayment(payment.id, {
      status: "fejlet",
      failureReason: reason,
      settledAt: null,
    });
  }
}

async function detachPaymentMethod(provider: string, providerRef: string): Promise<number> {
  const companies = await storage.getCompanies();
  let detached = 0;
  for (const company of companies) {
    const methods = await storage.getPaymentMethods(company.id);
    for (const method of methods) {
      if (method.provider !== provider || method.providerRef !== providerRef) continue;
      await storage.updatePaymentMethod(method.id, { status: "fjernet", isDefault: 0 });
      await notify(
        company.id,
        "Betalingsmiddel er fjernet",
        "Et gemt betalingsmiddel er fjernet eller udløbet. Vælg venligst et nyt betalingsmiddel.",
        "warning",
      );
      detached++;
    }
  }
  return detached;
}

function isSuccessEvent(eventType: string): boolean {
  return [
    "payment_intent.succeeded",
    "payment.succeeded",
    "payment.completed",
    "payment.completed.v1",
  ].includes(eventType.toLowerCase());
}

function isFailureEvent(eventType: string): boolean {
  return [
    "payment_intent.payment_failed",
    "payment.failed",
    "payment.declined",
    "payment.failed.v1",
  ].includes(eventType.toLowerCase());
}

function isRefundEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return normalized === "charge.refunded" || normalized === "payment.refunded" || normalized === "refund.completed";
}

function isPaymentMethodEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return (
    normalized === "payment_method.detached" ||
    normalized === "payment_method.expired" ||
    normalized === "paymentmethod.detached"
  );
}

export async function handleWebhook(
  provider: string,
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<{
  duplicate: boolean;
  processed: boolean;
  valid: boolean;
  action: string;
  simulated: boolean;
}> {
  const handler = getProvider(provider);
  if (!handler) {
    return {
      duplicate: false,
      processed: false,
      valid: false,
      action: "ukendt_udbyder",
      simulated: false,
    };
  }
  const verified = handler.verifyWebhook(rawBody, signatureHeader);
  const existing = await storage.getWebhookEvent(verified.eventId);
  if (existing) {
    return {
      duplicate: true,
      processed: Boolean(existing.processed),
      valid: Boolean(existing.signatureValid),
      action: "duplikat",
      simulated: false,
    };
  }

  const event = await storage.createWebhookEvent({
    provider: handler.id,
    eventId: verified.eventId,
    eventType: verified.eventType,
    payload: rawBody,
    signatureValid: verified.valid ? 1 : 0,
    processed: 0,
    error: verified.valid ? null : "Ugyldig eller for gammel webhook-signatur.",
    receivedAt: now(),
  });
  if (!verified.valid) {
    return {
      duplicate: false,
      processed: false,
      valid: false,
      action: "ugyldig_signatur",
      simulated: false,
    };
  }

  try {
    const type = verified.eventType;
    const reference = webhookProviderReference(verified.data);
    let action = "ignoreret";

    if (isSuccessEvent(type)) {
      if (!reference) throw new Error("Webhookpen mangler en betalingsreference.");
      const payment = await storage.getPaymentByProviderRef(reference);
      if (!payment) throw new Error("Ingen intern betaling matcher webhookpens reference.");
      await setWebhookPaymentSucceeded(payment);
      action = "betaling_gennemfoert";
    } else if (isFailureEvent(type)) {
      if (!reference) throw new Error("Webhookpen mangler en betalingsreference.");
      const payment = await storage.getPaymentByProviderRef(reference);
      if (!payment) throw new Error("Ingen intern betaling matcher webhookpens reference.");
      await setWebhookPaymentFailed(payment, webhookFailureReason(verified.data));
      action = "betaling_fejlet";
    } else if (isRefundEvent(type)) {
      if (!reference) throw new Error("Webhookpen mangler en betalingsreference.");
      const payment = await storage.getPaymentByProviderRef(reference);
      if (!payment) throw new Error("Ingen intern betaling matcher webhookpens reference.");
      await storage.updatePayment(payment.id, {
        status: "refunderet",
        settledAt: null,
      });
      if (payment.platformInvoiceId) {
        const invoices = await storage.getPlatformInvoices(payment.companyId);
        const invoice = invoiceById(invoices, payment.platformInvoiceId);
        if (invoice) await storage.updatePlatformInvoice(invoice.id, { status: "udstedt", paidAt: null });
      }
      await notify(
        payment.companyId,
        "Betaling refunderet",
        "En betaling er blevet refunderet. Abonnementsfakturaen er åbnet igen.",
        "warning",
      );
      action = "refunderet";
    } else if (isPaymentMethodEvent(type)) {
      if (!reference) throw new Error("Webhookpen mangler en betalingsmiddelreference.");
      const detached = await detachPaymentMethod(handler.id, reference);
      action = detached > 0 ? "betalingsmiddel_fjernet" : "betalingsmiddel_ikke_fundet";
    }

    await storage.updateWebhookEvent(event.id, { processed: 1, error: null });
    return {
      duplicate: false,
      processed: true,
      valid: true,
      action,
      simulated: false,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Ukendt fejl under behandling af webhook.";
    await storage.updateWebhookEvent(event.id, { processed: 0, error: message });
    return {
      duplicate: false,
      processed: false,
      valid: true,
      action: "fejl",
      simulated: false,
    };
  }
}

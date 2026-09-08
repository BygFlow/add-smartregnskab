import { storage } from "./storage";
import type { OutboxMessage } from "@shared/schema";

/**
 * Udgående beskeder. Alt lægges først i en kø i databasen, så der altid er et
 * revisionsspor over hvad der er forsøgt sendt til hvem.
 *
 * Reel afsendelse sker kun hvis der er sat nøgler i miljøet:
 *   RESEND_API_KEY + MAIL_FROM   → e-mail via Resend
 *   SMS_API_URL + SMS_API_KEY    → SMS via udbyderens HTTP-API
 * Uden nøgler fejler beskeden i production. I development får den status
 * "simuleret", så lokale flows kan afprøves uden at sende noget.
 */

const TIMEOUT_MS = 12_000;

function now(): string {
  return new Date().toISOString();
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export function smsConfigured(): boolean {
  return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);
}

async function sendEmail(msg: OutboxMessage): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await withTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [msg.recipient],
        subject: msg.subject ?? "Besked fra ADD SmartDrift Clean",
        text: msg.body,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Mailudbyder svarede ${res.status}. ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, error: "Mailudbyderen svarede ikke i tide." };
    return { ok: false, error: `Netværksfejl: ${e?.message ?? "ukendt"}` };
  }
}

async function sendSms(msg: OutboxMessage): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await withTimeout(process.env.SMS_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: msg.recipient, message: msg.body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `SMS-udbyder svarede ${res.status}. ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, error: "SMS-udbyderen svarede ikke i tide." };
    return { ok: false, error: `Netværksfejl: ${e?.message ?? "ukendt"}` };
  }
}

export interface QueueInput {
  companyId: number;
  channel: "email" | "sms";
  recipient: string;
  subject?: string | null;
  body: string;
  relatedType?: string | null;
  relatedId?: number | null;
}

/** Lægger beskeden i kø og forsøger straks at sende den. */
export async function queueAndSend(input: QueueInput): Promise<OutboxMessage> {
  const msg = await storage.createMessage({
    companyId: input.companyId,
    channel: input.channel,
    recipient: input.recipient,
    subject: input.subject ?? null,
    body: input.body,
    status: "i_koe",
    relatedType: input.relatedType ?? null,
    relatedId: input.relatedId ?? null,
    error: null,
    createdAt: now(),
    sentAt: null,
  });

  const configured = input.channel === "email" ? emailConfigured() : smsConfigured();
  if (!configured) {
    const label = input.channel === "email" ? "e-mail" : "SMS";
    const production = process.env.NODE_ENV === "production";
    return (await storage.updateMessage(msg.id, {
      status: production ? "fejl" : "simuleret",
      error: `Ingen ${label}-udbyder er opsat. Beskeden er gemt, men ikke afsendt.`,
      sentAt: null,
    }))!;
  }

  const result = input.channel === "email" ? await sendEmail(msg) : await sendSms(msg);
  return (await storage.updateMessage(msg.id, {
    status: result.ok ? "sendt" : "fejl",
    error: result.error ?? null,
    sentAt: result.ok ? now() : null,
  }))!;
}

// ── Skabeloner ──

export function invoiceEmail(opts: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
}): { subject: string; body: string } {
  return {
    subject: `Faktura ${opts.invoiceNumber} fra ${opts.companyName}`,
    body:
      `Hej ${opts.customerName}\n\n` +
      `Vedhæftet finder du faktura ${opts.invoiceNumber} på ${opts.total} kr. inkl. moms.\n` +
      `Betalingsfristen er ${opts.dueDate}.\n\n` +
      `Har du spørgsmål til fakturaen, er du velkommen til at svare på denne mail.\n\n` +
      `Med venlig hilsen\n${opts.companyName}`,
  };
}

export function reminderEmail(opts: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  daysOverdue: number;
  reminderNumber: number;
}): { subject: string; body: string } {
  const ordinal = opts.reminderNumber === 1 ? "Rykker" : `${opts.reminderNumber}. rykker`;
  return {
    subject: `${ordinal}: faktura ${opts.invoiceNumber} fra ${opts.companyName}`,
    body:
      `Hej ${opts.customerName}\n\n` +
      `Vi kan se, at faktura ${opts.invoiceNumber} på ${opts.total} kr. inkl. moms endnu ikke er registreret som betalt. ` +
      `Fristen var ${opts.dueDate}, altså ${opts.daysOverdue} dage siden.\n\n` +
      `Har du allerede betalt, må du se dette som en krydsning i posten — send os gerne en kvittering.\n\n` +
      `Med venlig hilsen\n${opts.companyName}`,
  };
}

export function shiftSms(opts: {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  place: string | null;
}): string {
  const where = opts.place ? ` hos ${opts.place}` : "";
  return `Hej ${opts.employeeName}. Du er sat på vagt ${opts.date} kl. ${opts.startTime}-${opts.endTime}${where}. Mvh ADD SmartDrift Clean`;
}

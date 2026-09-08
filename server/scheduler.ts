import { storage } from "./storage";
import { generateRecurrences, overdueInvoices, daysBetween, round2, addDays } from "./domain";
import { queueAndSend, reminderEmail, emailConfigured } from "./messaging";
import { kr, dkDate } from "./documents";
import { runDunning, renewSubscriptions } from "./payments";
import { applyRetention } from "./gdpr";
import { monitorRegulatorySources } from "./regulatory-monitor";

/**
 * Automatiske job.
 *
 * Alt det, en leder ellers skulle huske hver morgen, kører her af sig selv:
 * gentagne opgaver lægges frem, forfaldne fakturaer får rykker, abonnementer
 * fornyes og opkræves, og data der er for gamle bliver ryddet efter
 * virksomhedens egen opbevaringspolitik.
 *
 * Hver kørsel skrives i `job_runs`, så man bagefter kan se hvad der skete —
 * også når noget fejlede. Jobbene kører med setInterval i samme proces som
 * serveren. Det er nok til én server; kører man flere instanser, skal
 * jobbene i stedet startes af én planlægger udefra (se DRIFT.md).
 */

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export interface JobResult {
  job: string;
  affected: number;
  detail: string;
}

/** Kører et job og skriver altid en linje i loggen — også hvis det fejler. */
async function track(job: string, fn: () => Promise<JobResult>): Promise<JobResult> {
  const startedAt = nowIso();
  try {
    const result = await fn();
    await storage.createJobRun({
      job, status: "koert", affected: result.affected,
      detail: result.detail, startedAt, finishedAt: nowIso(),
    });
    return result;
  } catch (e: any) {
    const detail = `Fejl: ${String(e?.message ?? e).slice(0, 400)}`;
    await storage.createJobRun({
      job, status: "fejlet", affected: 0, detail, startedAt, finishedAt: nowIso(),
    });
    return { job, affected: 0, detail };
  }
}

// ══════════════════════════════════════════════════
//  JOB 1 — gentagne opgaver
// ══════════════════════════════════════════════════

/**
 * Ruller faste aftaler frem. En ugentlig opgave hos en kunde skal ligge klar
 * i kalenderen, uden at nogen opretter den manuelt hver uge.
 */
export async function jobRecurringTasks(): Promise<JobResult> {
  const companies = await storage.getCompanies();
  let created = 0;
  const perCompany: string[] = [];

  for (const company of companies) {
    if (company.status === "spaerret" || company.status === "opsagt") continue;
    const tasks = await storage.getTasks(company.id);
    let n = 0;
    for (const task of tasks) {
      if (task.recurrence === "ingen" || task.parentTaskId) continue;
      n += await generateRecurrences(task);
    }
    if (n > 0) {
      created += n;
      perCompany.push(`${company.name}: ${n}`);
    }
  }
  return {
    job: "gentagne_opgaver",
    affected: created,
    detail: created === 0 ? "Ingen nye opgaver skulle lægges frem." : perCompany.join(", "),
  };
}

// ══════════════════════════════════════════════════
//  JOB 2 — rykkere på kundefakturaer
// ══════════════════════════════════════════════════

/**
 * Sender rykker på forfaldne kundefakturaer. Første rykker efter 3 dage,
 * derefter tidligst hver 10. dag og højst tre rykkere, så kunden ikke bliver
 * oversvømmet af mails.
 */
export async function jobInvoiceReminders(): Promise<JobResult> {
  const companies = await storage.getCompanies();
  let sent = 0;
  const lines: string[] = [];

  for (const company of companies) {
    if (company.status === "spaerret" || company.status === "opsagt") continue;
    const overdue = await overdueInvoices(company.id, today());

    for (const inv of overdue) {
      const daysOverdue = daysBetween(inv.dueDate!, today());
      if (daysOverdue < 3) continue;

      const count = inv.reminderCount ?? 0;
      if (count >= 3) continue;
      if (inv.lastReminderAt) {
        const since = daysBetween(inv.lastReminderAt.slice(0, 10), today());
        if (since < 10) continue;
      }

      const customer = await storage.getCustomer(inv.customerId, company.id);
      if (!customer?.email) continue;

      const n = count + 1;
      const tpl = reminderEmail({
        companyName: company.name,
        customerName: customer.name,
        invoiceNumber: inv.invoiceNumber,
        total: kr(inv.totalAmount),
        dueDate: dkDate(inv.dueDate),
        daysOverdue,
        reminderNumber: n,
      });
      await queueAndSend({
        companyId: company.id, channel: "email", recipient: customer.email,
        subject: tpl.subject, body: tpl.body, relatedType: "invoice", relatedId: inv.id,
      });
      await storage.updateInvoice(inv.id, {
        status: "forfalden", reminderCount: n, lastReminderAt: nowIso(),
      });
      sent++;
      lines.push(`${inv.invoiceNumber} (rykker ${n})`);
    }
  }
  return {
    job: "faktura_rykkere",
    affected: sent,
    detail: sent === 0 ? "Ingen fakturaer var klar til rykker." : lines.join(", "),
  };
}

// ══════════════════════════════════════════════════
//  JOB 3 — abonnementer: fornyelse og rykkerforløb
// ══════════════════════════════════════════════════

export async function jobSubscriptions(): Promise<JobResult> {
  const renew = await renewSubscriptions(today());
  const dunning = await runDunning(today());
  const affected = renew.issued + renew.charged + dunning.stage1 + dunning.stage2 + dunning.stage3;
  return {
    job: "abonnement_fornyelse",
    affected,
    detail:
      `Fornyet: ${renew.issued} fakturaer, ${renew.charged} betalt, ${renew.failed} fejlede, `
      + `${renew.skippedTrial} i prøveperiode. Rykkere: trin 1: ${dunning.stage1}, `
      + `trin 2: ${dunning.stage2}, spærret: ${dunning.stage3}.`,
  };
}

// ══════════════════════════════════════════════════
//  JOB 4 — prøveperioder der udløber
// ══════════════════════════════════════════════════

/** Minder virksomheden om, at prøveperioden snart slutter — 3 dage før. */
export async function jobTrialReminders(): Promise<JobResult> {
  const companies = await storage.getCompanies();
  let sent = 0;
  for (const company of companies) {
    const sub = await storage.getSubscriptionByCompany(company.id);
    if (!sub || sub.status !== "proeve" || !sub.trialEndsAt) continue;
    const days = daysBetween(today(), sub.trialEndsAt);
    if (days !== 3 && days !== 0) continue;

    const method = await storage.getDefaultPaymentMethod(company.id);
    const emne = days === 0
      ? "Din prøveperiode hos ADD SmartDrift Clean slutter i dag"
      : "Din prøveperiode hos ADD SmartDrift Clean slutter om 3 dage";
    const krav = method
      ? "Vi opkræver automatisk det første abonnement på dit registrerede betalingsmiddel."
      : "Tilføj et betalingsmiddel under Abonnement, så adgangen fortsætter uden pause.";

    if (company.email) {
      await queueAndSend({
        companyId: company.id, channel: "email", recipient: company.email,
        subject: emne,
        body: `Hej ${company.name}\n\nProeveperioden slutter ${dkDate(sub.trialEndsAt)}.\n\n${krav}\n\nMed venlig hilsen\nADD SmartDrift Clean`,
        relatedType: "abonnement", relatedId: sub.id,
      });
      sent++;
    }
    await storage.createNotification({
      companyId: company.id,
      title: emne,
      message: krav,
      type: days === 0 ? "warning" : "info",
      read: false,
      createdAt: nowIso(),
    } as any);
  }
  return {
    job: "proeveperiode_paamindelse",
    affected: sent,
    detail: sent === 0 ? "Ingen prøveperioder udløber lige nu." : `${sent} påmindelser sendt.`,
  };
}

// ══════════════════════════════════════════════════
//  JOB 5 — GDPR-oprydning
// ══════════════════════════════════════════════════

export async function jobRetention(): Promise<JobResult> {
  const result = await applyRetention();
  const affected =
    (result.timeEntriesDeleted ?? 0) + (result.gpsStripped ?? 0)
    + (result.absencesDeleted ?? 0) + (result.photosDeleted ?? 0);
  return {
    job: "gdpr_oprydning",
    affected,
    detail:
      `Slettede tidsposter: ${result.timeEntriesDeleted ?? 0}, `
      + `fjernet GPS: ${result.gpsStripped ?? 0}, `
      + `slettede fraværsposter: ${result.absencesDeleted ?? 0}, `
      + `slettede fotos og bilag: ${result.photosDeleted ?? 0}.`,
  };
}

// ══════════════════════════════════════════════════
//  JOB 6 — udløbne sessioner og tokens
// ══════════════════════════════════════════════════

export async function jobCleanup(): Promise<JobResult> {
  const sessions = await storage.deleteExpiredSessions(nowIso());
  const tokens = await storage.deleteExpiredAuthTokens(nowIso());
  return {
    job: "oprydning",
    affected: sessions + tokens,
    detail: `${sessions} udløbne sessioner og ${tokens} udløbne tokens blev fjernet.`,
  };
}

// ══════════════════════════════════════════════════
//  JOB 7 — beskedkøen forsøges igen
// ══════════════════════════════════════════════════

/**
 * Mails og SMS'er, der fejlede på grund af en kortvarig netværksfejl, får et
 * nyt forsøg. Højst tre forsøg pr. besked, så en permanent fejl ikke kører i ring.
 */
export async function jobOutbox(): Promise<JobResult> {
  if (!emailConfigured()) {
    return { job: "beskedkoe", affected: 0, detail: "Ingen mailudbyder er sat op — køen står i simuleringstilstand." };
  }
  const companies = await storage.getCompanies();
  let retried = 0;
  for (const company of companies) {
    const messages = await storage.getMessages(company.id, 200);
    for (const msg of messages) {
      if (msg.status !== "fejl") continue;
      // Kun ét ekstra forsøg pr. besked — en permanent fejl skal ikke køre i ring.
      if ((msg.error ?? "").includes("[genforsøgt]")) continue;
      const resent = await queueAndSend({
        companyId: msg.companyId,
        channel: msg.channel as "email" | "sms",
        recipient: msg.recipient,
        subject: msg.subject,
        body: msg.body,
        relatedType: msg.relatedType,
        relatedId: msg.relatedId,
      });
      await storage.updateMessage(msg.id, {
        error: `${msg.error ?? ""} [genforsøgt ${resent.status}]`.trim(),
      });
      retried++;
    }
  }
  return {
    job: "beskedkoe",
    affected: retried,
    detail: retried === 0 ? "Ingen fejlede beskeder i køen." : `${retried} beskeder blev forsøgt igen.`,
  };
}

export async function jobRegulatoryMonitor(): Promise<JobResult> {
  const result = await monitorRegulatorySources();
  return {
    job: "regelovervaagning",
    affected: result.changed,
    detail: `${result.checked} officielle kilder kontrolleret, ${result.changed} ændring(er) sendt til faglig godkendelse, ${result.failed} fejl.`,
  };
}

// ══════════════════════════════════════════════════
//  PLANLÆGGER
// ══════════════════════════════════════════════════

const JOBS: Record<string, { label: string; everyMinutes: number; run: () => Promise<JobResult> }> = {
  regelovervaagning: { label: "Kontrollér officielle lov- og regelkilder", everyMinutes: 60 * 24, run: jobRegulatoryMonitor },
};

export function jobOverview() {
  return Object.entries(JOBS).map(([id, j]) => ({
    id, label: j.label, everyMinutes: j.everyMinutes,
  }));
}

/** Kører et enkelt job med det samme — bruges fra platformens driftsside. */
export async function runJobNow(job: string): Promise<JobResult | null> {
  const entry = JOBS[job];
  if (!entry) return null;
  return track(job, entry.run);
}

let timers: NodeJS.Timeout[] = [];

/**
 * Starter planlæggeren. Hvert job får en lille forskudt start, så de ikke
 * rammer databasen samtidig, og `unref()` sikrer, at timerne ikke holder
 * processen i live ved nedlukning.
 */
export function startScheduler(): void {
  if (process.env.DISABLE_JOBS === "1") {
    console.log("Automatiske job er slået fra (DISABLE_JOBS=1).");
    return;
  }
  stopScheduler();
  let offset = 0;
  for (const [id, entry] of Object.entries(JOBS)) {
    offset += 20_000;
    const start = setTimeout(() => {
      void track(id, entry.run);
      const timer = setInterval(() => void track(id, entry.run), entry.everyMinutes * 60_000);
      timer.unref?.();
      timers.push(timer);
    }, offset);
    start.unref?.();
    timers.push(start);
  }
  console.log(`Automatiske job er startet: ${Object.keys(JOBS).join(", ")}`);
}

export function stopScheduler(): void {
  for (const t of timers) clearTimeout(t as any);
  timers = [];
}

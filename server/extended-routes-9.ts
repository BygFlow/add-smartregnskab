import { type Express } from "express";
import { db } from "./storage";
import { eq, and } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId, requireRole } from "./auth";
import { queueAndSend, emailConfigured, invoiceEmail, reminderEmail } from "./messaging";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const STRIPE_API_BASE = "https://api.stripe.com/v1";

async function stripeRequest(
  path: string,
  fields: Record<string, string | number | boolean | undefined>,
  idempotencyKey?: string,
): Promise<{ ok: boolean; payload: any; error?: string }> {
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
    const payload = await response.json().catch(() => ({}));
    return response.ok
      ? { ok: true, payload }
      : { ok: false, payload, error: payload?.error?.message ?? `Stripe svarede ${response.status}` };
  } catch (error: any) {
    return { ok: false, payload: {}, error: `Netværksfejl: ${error?.message ?? "ukendt"}` };
  }
}

function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function registerExtendedRoutes9(app: Express) {

  // ════════════════════════════════════════
  //  STRIPE CHECKOUT SESSION
  // ════════════════════════════════════════
  app.post("/api/billing/create-checkout-session", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!stripeConfigured()) {
      return res.status(503).json({
        error: "Stripe er ikke konfigureret. Sæt STRIPE_SECRET_KEY og STRIPE_WEBHOOK_SECRET.",
        configured: false,
      });
    }

    const cid = tenantId(req);
    const company = await storage_getCompany(cid);
    if (!company) return res.status(404).json({ error: "Virksomhed ikke fundet" });

    const sub = await storage_getSubscription(cid);
    const plan = sub ? await storage_getPlan(sub.planId) : null;
    if (!plan) return res.status(400).json({ error: "Ingen pakke valgt" });

    const baseUrl = process.env.APP_BASE_URL || `https://${req.headers.host}`;
    const employeeCount = (await db.select().from(schema.employees).where(eq(schema.employees.companyId, cid)).all()).length;
    const amount = Math.round((plan.monthlyPrice + plan.pricePerEmployee * employeeCount) * 100); // øre

    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "dkk",
      "line_items[0][price_data][unit_amount]": amount,
      "line_items[0][price_data][product_data][name]": `${plan.name} — første måned`,
      "line_items[0][price_data][product_data][description]": `Abonnement for ${employeeCount} ansatte`,
      success_url: `${baseUrl}/#/abonnement?status=success`,
      cancel_url: `${baseUrl}/#/abonnement?status=cancel`,
      client_reference_id: String(cid),
      customer_email: company.email || undefined,
      "metadata[companyId]": String(cid),
      "metadata[planId]": String(plan.id),
      "metadata[type]": "subscription_payment",
      locale: "da",
    }, `checkout-${cid}-${Date.now()}`);

    if (!session.ok) {
      return res.status(400).json({ error: session.error ?? "Kunne ikke oprette checkout session" });
    }

    res.json({ url: session.payload.url, sessionId: session.payload.id });
  }));

  // ════════════════════════════════════════
  //  STRIPE CUSTOMER PORTAL
  // ════════════════════════════════════════
  app.post("/api/billing/create-portal-session", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (!stripeConfigured()) {
      return res.status(503).json({ error: "Stripe er ikke konfigureret", configured: false });
    }

    const cid = tenantId(req);
    const company = await storage_getCompany(cid);
    if (!company) return res.status(404).json({ error: "Virksomhed ikke fundet" });

    // Find Stripe customer ID from payment methods
    const paymentMethods = db.select().from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.companyId, cid)).all();
    const stripeCustomerRef = paymentMethods.find(pm => pm.provider === "stripe")?.providerRef;

    if (!stripeCustomerRef) {
      return res.status(400).json({ error: "Ingen Stripe-kunde fundet. Gennemfør først en betaling." });
    }

    const baseUrl = process.env.APP_BASE_URL || `https://${req.headers.host}`;
    const session = await stripeRequest("/billing_portal/sessions", {
      customer: stripeCustomerRef,
      return_url: `${baseUrl}/#/abonnement`,
    }, `portal-${cid}-${Date.now()}`);

    if (!session.ok) {
      return res.status(400).json({ error: session.error ?? "Kunne ikke oprette portal session" });
    }

    res.json({ url: session.payload.url });
  }));

  // ════════════════════════════════════════
  //  BILLING STATUS
  // ════════════════════════════════════════
  app.get("/api/billing/status", h(async (req, res) => {
    const cid = tenantId(req);
    const sub = await storage_getSubscription(cid);
    const plan = sub ? await storage_getPlan(sub.planId) : null;
    const paymentMethods = db.select().from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.companyId, cid)).all();

    res.json({
      stripeConfigured: stripeConfigured(),
      emailConfigured: emailConfigured(),
      subscription: sub ? {
        status: sub.status,
        billingCycle: sub.billingCycle,
        currentPeriodEnd: sub.currentPeriodEnd,
        autoRenew: sub.autoRenew,
        dunningStage: sub.dunningStage,
      } : null,
      plan: plan ? { name: plan.name, monthlyPrice: plan.monthlyPrice } : null,
      hasPaymentMethod: paymentMethods.length > 0,
      paymentMethods: paymentMethods.map(pm => ({
        provider: pm.provider,
        brand: pm.brand,
        last4: pm.last4,
        isDefault: pm.isDefault === 1,
        status: pm.status,
      })),
    });
  }));

  // ════════════════════════════════════════
  //  EMAIL NOTIFICATION MANAGEMENT
  // ════════════════════════════════════════
  app.get("/api/messages/outbox", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.messageOutbox)
      .where(eq(schema.messageOutbox.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/messages/send", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { channel, recipient, subject, body, relatedType, relatedId } = req.body;
    if (!channel || !recipient || !body) {
      return res.status(400).json({ error: "Kanal, modtager og besked er påkrævet" });
    }
    const msg = await queueAndSend({
      companyId: cid,
      channel,
      recipient,
      subject: subject ?? null,
      body,
      relatedType: relatedType ?? null,
      relatedId: relatedId ?? null,
    });
    res.json(msg);
  }));

  // ════════════════════════════════════════
  //  NOTIFICATION PREFERENCES
  // ════════════════════════════════════════
  app.get("/api/notification-preferences", h(async (req, res) => {
    const cid = tenantId(req);
    const company = await storage_getCompany(cid);
    try {
      const prefs = JSON.parse((company as any)?.notificationPrefs ?? "{}");
      res.json({
        invoiceEmail: prefs.invoiceEmail ?? true,
        reminderEmail: prefs.reminderEmail ?? true,
        shiftSms: prefs.shiftSms ?? false,
        taskAssignmentEmail: prefs.taskAssignmentEmail ?? true,
        absenceEmail: prefs.absenceEmail ?? true,
        trialEndingEmail: prefs.trialEndingEmail ?? true,
        paymentFailedEmail: prefs.paymentFailedEmail ?? true,
        weeklyReportEmail: prefs.weeklyReportEmail ?? false,
        ...prefs,
      });
    } catch {
      res.json({
        invoiceEmail: true,
        reminderEmail: true,
        shiftSms: false,
        taskAssignmentEmail: true,
        absenceEmail: true,
        trialEndingEmail: true,
        paymentFailedEmail: true,
        weeklyReportEmail: false,
      });
    }
  }));

  app.patch("/api/notification-preferences", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const company = await storage_getCompany(cid);
    if (!company) return res.status(404).json({ error: "Virksomhed ikke fundet" });
    const existing = (() => { try { return JSON.parse((company as any)?.notificationPrefs ?? "{}"); } catch { return {}; } })();
    const updated = { ...existing, ...req.body };
    db.update(schema.companies).set({ notificationPrefs: JSON.stringify(updated) } as any)
      .where(eq(schema.companies.id, cid)).run();
    res.json(updated);
  }));

  // ════════════════════════════════════════
  //  SEND NOTIFICATION (template-based)
  // ════════════════════════════════════════
  app.post("/api/notifications/send", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { template, recipient, data } = req.body;
    if (!template || !recipient) {
      return res.status(400).json({ error: "Skabelon og modtager er påkrævet" });
    }

    let subject = "";
    let body = "";
    const d = data || {};

    switch (template) {
      case "welcome":
        subject = `Velkommen til ADD SmartRegnskab`;
        body = `Hej ${d.companyName ?? ""}\n\nVelkommen til ADD SmartRegnskab — din platform til styring af rengøringsvirksomhed.\n\nDu kan nu oprette opgaver, vagtplaner, fakturaer og meget mere.\n\nLog ind på ${process.env.APP_BASE_URL ?? "platformen"} for at komme i gang.\n\nMed venlig hilsen\nADD SmartRegnskab`;
        break;
      case "trial_ending":
        subject = `Din prøveperiode udløber snart`;
        body = `Hej ${d.companyName ?? ""}\n\nDin prøveperiode på ADD SmartRegnskab udløber om ${d.daysLeft ?? 3} dage.\n\nFor at fortsætte uden afbrydelse, skal du vælge en pakke og tilknytte betaling.\n\nLog ind og gå til Abonnementer for at vælge pakke.\n\nMed venlig hilsen\nADD SmartRegnskab`;
        break;
      case "payment_failed":
        subject = `Betaling fejlet — handling påkrævet`;
        body = `Hej ${d.companyName ?? ""}\n\nVi kunne ikke gennemføre betalingen for dit abonnement.\n\nBeløb: ${d.amount ?? ""} kr.\n\nOpdater venligst dine betalingsoplysninger i Abonnementer.\n\nMed venlig hilsen\nADD SmartRegnskab`;
        break;
      case "task_assigned":
        subject = `Ny opgave tildelt: ${d.taskTitle ?? ""}`;
        body = `Hej ${d.employeeName ?? ""}\n\nDu har fået en ny opgave:\n\nOpgave: ${d.taskTitle ?? ""}\nKunde: ${d.customerName ?? ""}\nDato: ${d.date ?? ""}\nTid: ${d.startTime ?? ""}\n\nSe detaljer i ADD SmartRegnskab appen.\n\nMed venlig hilsen\n${d.companyName ?? "Virksomheden"}`;
        break;
      case "absence_notification":
        subject = `Fravær registreret: ${d.employeeName ?? ""}`;
        body = `Hej\n\n${d.employeeName ?? "En medarbejder"} har registreret fravær.\n\nDato: ${d.date ?? ""}\nÅrsag: ${d.reason ?? "Ikke angivet"}\n\nGå til Vikar & Bemanding for at finde en vikar.\n\nMed venlig hilsen\nADD SmartRegnskab`;
        break;
      case "sla_alert":
        subject = `SLA alert: ${d.alertType ?? ""}`;
        body = `Hej\n\nDer er opstået en SLA alert:\n\nType: ${d.alertType ?? ""}\nBesked: ${d.message ?? ""}\nAlvorsgrad: ${d.severity ?? ""}\n\nSe detaljer i SLA Overvågning.\n\nMed venlig hilsen\nADD SmartRegnskab`;
        break;
      case "weekly_report":
        subject = `Ugentlig rapport for ${d.week ?? ""}`;
        body = `Hej ${d.companyName ?? ""}\n\nHer er din ugentlige oversigt:\n\nOpgaver udført: ${d.tasksCompleted ?? 0}\nTimer registreret: ${d.totalHours ?? 0}\nAfvigelser: ${d.deviations ?? 0}\n\nSe detaljer i ADD SmartRegnskab.\n\nMed venlig hilsen\nADD SmartRegnskab`;
        break;
      default:
        return res.status(400).json({ error: `Ukendt skabelon: ${template}` });
    }

    const msg = await queueAndSend({
      companyId: cid,
      channel: "email",
      recipient,
      subject,
      body,
      relatedType: template,
      relatedId: d.relatedId ?? null,
    });

    res.json({ sent: msg.status === "sendt", status: msg.status, message: msg });
  }));
}

// ── Storage helpers (inline to avoid circular deps) ──
async function storage_getCompany(cid: number) {
  const row = db.select().from(schema.companies).where(eq(schema.companies.id, cid)).get();
  return row;
}
async function storage_getSubscription(cid: number) {
  const row = db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, cid)).get();
  return row;
}
async function storage_getPlan(planId: number) {
  const row = db.select().from(schema.plans).where(eq(schema.plans.id, planId)).get();
  return row;
}

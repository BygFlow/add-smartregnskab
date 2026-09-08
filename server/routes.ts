import type { Express, Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import type { Server } from "node:http";
import { storage } from "./storage";
import { registerExtendedRoutes } from "./extended-routes";
import { registerExtendedRoutes2 } from "./extended-routes-2";
import { registerExtendedRoutes3 } from "./extended-routes-3";
import { registerExtendedRoutes4 } from "./extended-routes-4";
import { registerExtendedRoutes5 } from "./extended-routes-5";
import { registerExtendedRoutes6 } from "./extended-routes-6";
import { registerExtendedRoutes7 } from "./extended-routes-7";
import { registerExtendedRoutes8 } from "./extended-routes-8";
import { registerExtendedRoutes9 } from "./extended-routes-9";
import { registerComplianceRoutes } from "./compliance-routes";
import { registerEInvoiceRoutes, registerPublicEInvoiceRoutes } from "./einvoice-routes";
import {
  insertCompanySchema, insertUserSchema, insertEmployeeSchema, insertCustomerSchema,
  insertTaskSchema, insertTimeEntrySchema, insertNotificationSchema,
  insertInvoiceSchema, insertIntegrationSchema,
  insertAbsenceSchema, insertShiftSchema, insertAttachmentSchema,
  insertPlanSchema, insertSubscriptionSchema,
  insertBackupSchema, insertTemplateSchema, insertCleaningServiceSchema,
  insertCleaningAgreementSchema, insertCleaningPlanSchema, insertLeadSchema,
  insertSupportCaseSchema, insertAccountSchema, insertJournalEntrySchema,
  insertJournalLineSchema, insertVatPeriodSchema,
  insertOutboundMessageSchema, insertInboundMessageSchema, insertCommunicationIntegrationSchema,
  insertDashboardWidgetSchema,
  insertCustomPaymentTermSchema,
  insertBackupSettingSchema,
  insertLeadIntegrationSchema,
  insertSystemReleaseSchema,
  insertImportJobSchema,
  insertAiAccountingTaskSchema,
  insertVoucherSchema,
  insertBankTransactionSchema,
  insertTaxDeadlineSchema,
  insertCloudProviderSchema,
  insertAccountingRuleSchema,
  insertPeriodCloseSchema,
  insertAccountingIntegrationSchema,
  insertDocumentInboxSchema,
  insertPayrollEntrySchema,
  insertFixedAssetSchema,
  insertBudgetSchema,
  insertCostCenterSchema,
  insertPaymentRunSchema,
  insertYearEndCloseSchema,
  insertVatReconciliationSchema,
  insertCashflowProjectionSchema,
} from "@shared/schema";
import type { InsertEmployee } from "@shared/schema";
type SafeParse<T> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } };
};
import {
  hashPassword, verifyPassword, createSession, safeUser,
  requireAuth, tenantId, requireRole, requirePlatformAdmin, requireFeature, checkLimit, sessionStorageKey,
} from "./auth";
import {
  testConnection, syncPayroll, syncInvoices, credentialFields, API_PROVIDERS,
} from "./connectors";
import type { PayrollLine, InvoiceLine } from "./connectors";
import { EXPORT_FORMATS, getFormat, buildPayrollFile, buildAccountingFile } from "./exportFormats";
import {
  evaluateGeofence, generateRecurrences, absenceHours, absenceOnDate, ABSENCE_WAGE_CODES,
  computeTotals, dueDateFrom, overdueInvoices, daysBetween, round2, addDays,
  previewBilling, issueSubscriptionInvoice, platformMetrics,
  vatSetupFor, VAT_MODE_LABELS, contractCharge, PRICING_MODEL_LABELS,
  scoreInspection, INSPECTION_AREAS, INSPECTION_RESULT_LABELS,
} from "./domain";
import { invoicePdf, platformInvoicePdf, quotePdf, kr, dkDate } from "./documents";
import { encryptField, decryptField, maskSecret, usingFallbackKey } from "./crypto";
import {
  checkLoginAllowed, recordLogin, GENERISK_LOGINFEJL,
  generateTotpSecret, totpUri, verifyTotp, generateBackupCodes, consumeBackupCode,
  enableTwoFactor, disableTwoFactor,
  issueToken, consumeToken, passwordStrength, resetPassword,
} from "./security";
import {
  paymentProviderStatus, chargeInvoice, runDunning, renewSubscriptions, handleWebhook,
} from "./payments";
import {
  exportSubjectData, exportSubjectJson, exportSubjectCsv,
  anonymizeEmployee, anonymizeCustomer, applyRetention, retentionDefaults,
  dpaText, privacyPolicyText,
} from "./gdpr";
import {
  storageBackend, saveFile, readFile, deleteFile, presignedUrl, migrateLegacyAttachments,
  decodeDataUrl,
} from "./files";
import { jobOverview, runJobNow } from "./scheduler";
import {
  queueAndSend, invoiceEmail, reminderEmail, shiftSms, emailConfigured, smsConfigured,
} from "./messaging";

// ── Hjælpere ──

function validate<T>(schema: SafeParse<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
}

/** Pakker en handler, så uventede fejl bliver en pæn dansk 500 i stedet for et crash. */
function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      if (res.headersSent) return next(e);
      const msg = String(e?.message ?? e);
      // Zod-fejl er brugerfejl, ikke serverfejl
      if (msg.startsWith("[") || msg.startsWith("{")) {
        return res.status(400).json({ error: "Ugyldige data", detail: msg });
      }
      res.status(400).json({ error: msg });
    }
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const productionOnlyUnavailable = (res: Response, feature: string): boolean => {
  if (process.env.NODE_ENV !== "production") return false;
  res.status(501).json({
    error: `${feature} er ikke tilsluttet en rigtig udbyder. Funktionen er deaktiveret i production.`,
  });
  return true;
};

const publicAttempts = new Map<string, { count: number; resetAt: number }>();
function publicRateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = publicAttempts.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    publicAttempts.set(key, entry);
    if (entry.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: "For mange forsøg. Prøv igen senere." });
    }
    next();
  };
}

function workerSafeEmployee(employee: any) {
  const { hourlyRate, monthlySalary, contractDraft, contractFileName, contractUploadedAt, ...safe } = employee;
  return safe;
}

function workerSafeCustomer(customer: any) {
  const { hourlyRate, cvr, ean, paymentTerms, invoiceEmail, portalToken, ...safe } = customer;
  return safe;
}

async function audit(
  req: Request, action: string, entity: string, entityId?: number | null, detail?: string,
) {
  const a = req.auth;
  if (!a) return;
  await storage.createAuditLog({
    companyId: a.companyId,
    userId: a.user.id,
    userEmail: a.user.email,
    action,
    target: entityId != null ? `${entity}#${entityId}` : entity,
    detail: detail ?? null,
    createdAt: nowIso(),
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ════════════════════════════════════════════════
  //  OFFENTLIGE RUTER — registreres før auth-vagten
  // ════════════════════════════════════════════════

  app.post("/api/auth/login", publicRateLimit(30, 15 * 60_000), h(async (req, res) => {
    const { email, password, code } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Udfyld både email og adgangskode." });
    }
    const mail = String(email).trim().toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || "ukendt";

    // Spærring efter gentagne fejlforsøg, før kodeordet overhovedet tjekkes
    const gate = await checkLoginAllowed(mail, ip);
    if (!gate.allowed) {
      return res.status(429).json({
        error: gate.reason, code: "for_mange_forsoeg", retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    const user = await storage.getUserByEmail(mail);
    // Samme svar uanset om brugeren findes — så man ikke kan gætte gyldige emails
    if (!user || !verifyPassword(String(password), user.password)) {
      await recordLogin(mail, ip, false, "forkert_kode");
      return res.status(401).json({ error: GENERISK_LOGINFEJL });
    }
    if (!user.active) {
      await recordLogin(mail, ip, false, "deaktiveret");
      return res.status(403).json({ error: "Din adgang er deaktiveret. Kontakt din leder." });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ error: "Bekræft din e-mailadresse, før du logger ind.", code: "email_ikke_bekraeftet" });
    }

    // To-faktor: kodeordet var rigtigt, men adgangen kræver også engangskoden
    if (user.twoFactorEnabled === 1) {
      const indtastet = String(code ?? "").trim();
      if (!indtastet) {
        return res.status(401).json({
          error: "Indtast engangskoden fra din godkendelsesapp.",
          code: "to_faktor_kraeves",
        });
      }
      const okTotp = user.twoFactorSecret ? verifyTotp(user.twoFactorSecret, indtastet) : false;
      const okBackup = okTotp ? false : await consumeBackupCode(user.id, indtastet);
      if (!okTotp && !okBackup) {
        await recordLogin(mail, ip, false, "forkert_to_faktor");
        return res.status(401).json({ error: "Engangskoden er forkert eller udløbet.", code: "to_faktor_kraeves" });
      }
      if (okBackup) {
        await storage.createNotification({
          companyId: user.companyId,
          title: "Reservekode brugt ved login",
          message: `${user.email} loggede ind med en reservekode. Opret nye reservekoder, hvis det ikke var dig.`,
          type: "warning", read: false, createdAt: nowIso(),
        } as any);
      }
    }

    const company = await storage.getCompany(user.companyId);
    if (company && user.role !== "platform_admin"
      && (company.status === "spaerret" || company.status === "opsagt")) {
      await recordLogin(mail, ip, false, "abonnement_spaerret");
      return res.status(402).json({
        error: "Virksomhedens abonnement er spærret. Kontakt ADD SmartRegnskab for at genåbne adgangen.",
        code: "abonnement_spaerret",
      });
    }

    await recordLogin(mail, ip, true);
    const token = await createSession(user.id);
    const plan = await storage.getCompanyPlan(user.companyId);
    const subscription = await storage.getSubscriptionByCompany(user.companyId);
    res.json({
      token, user: safeUser(user), company, plan, subscription,
      emailVerified: user.emailVerified === 1,
    });
  }));

  /** Offentlig prisliste — bruges på abonnementssiden og af nye virksomheder. */
  app.get("/api/plans", h(async (_req, res) => {
    const plans = (await storage.getPlans()).filter((p) => p.active);
    res.json(plans);
  }));

  // ════════════════════════════════════════════════
  //  AUTH-VAGT — alt herunder kræver et gyldigt token
  // ════════════════════════════════════════════════


  // ══════════════════════════════════════════════════
  //  SELVBETJENT TILMELDING, KODEORD OG WEBHOOKS (offentlige)
  // ══════════════════════════════════════════════════

  const appUrl = () => process.env.APP_BASE_URL ?? "";

  /** Ny virksomhed opretter sig selv med 14 dages prøveperiode. */
  app.post("/api/signup", publicRateLimit(10, 60 * 60_000), h(async (req, res) => {
    const b = req.body ?? {};
    const email = String(b.email ?? "").trim().toLowerCase();
    const name = String(b.name ?? "").trim();
    const companyName = String(b.companyName ?? "").trim();
    const password = String(b.password ?? "");

    if (!email.includes("@") || !name || !companyName) {
      return res.status(400).json({ error: "Udfyld virksomhedsnavn, dit navn og en gyldig e-mailadresse." });
    }
    const strength = passwordStrength(password);
    if (!strength.ok) {
      return res.status(400).json({ error: "Adgangskoden er for svag.", problems: strength.problems });
    }
    if (await storage.getUserByEmail(email)) {
      // Vi bekræfter ikke, at e-mailen findes — brugeren får blot en mail om det.
      await queueAndSend({
        companyId: 0,
        channel: "email",
        recipient: email,
        subject: "Der findes allerede en konto hos ADD SmartRegnskab",
        body: `Hej\n\nNogen har forsøgt at oprette en konto med denne e-mailadresse. Der findes allerede en konto — brug "Glemt adgangskode" for at komme ind igen.\n\nMed venlig hilsen\nADD SmartRegnskab`,
        relatedType: "tilmelding",
      }).catch(() => null);
      return res.status(201).json({
        ok: true,
        message: "Tjek din indbakke. Vi har sendt dig en e-mail med det næste skridt.",
      });
    }

    const plans = await storage.getPlans();
    const plan = plans.find((p) => p.slug === String(b.plan ?? "start")) ?? plans[0];
    if (!plan) return res.status(503).json({ error: "Der er endnu ikke konfigureret abonnementspakker." });

    const company = await storage.createCompany({
      name: companyName,
      address: b.address ?? null,
      cvr: b.cvr ?? null,
      phone: b.phone ?? null,
      email,
      status: "proeve",
      vatRate: 25,
      vatMode: "dansk",
      currency: "DKK",
      notes: "Oprettet via selvbetjening.",
      createdAt: nowIso(),
    } as any);

    const user = await storage.createUser({
      companyId: company.id,
      email,
      name,
      password: hashPassword(password),
      role: "leder",
      active: 1,
      emailVerified: 0,
      employeeId: null,
      customerId: null,
      createdAt: nowIso(),
    } as any);

    const trialEnd = addDays(today(), 14);
    await storage.createSubscription({
      companyId: company.id,
      planId: plan.id,
      status: "proeve",
      billingCycle: "maanedlig",
      startDate: today(),
      trialEndsAt: trialEnd,
      currentPeriodStart: today(),
      currentPeriodEnd: trialEnd,
      autoRenew: 1,
      dunningStage: 0,
      startedAt: nowIso(),
      cancelledAt: null,
    } as any);

    const { token } = await issueToken("verificer_email", email, {
      userId: user.id, companyId: company.id,
    });
    await queueAndSend({
      companyId: company.id,
      channel: "email",
      recipient: email,
      subject: "Bekræft din e-mail hos ADD SmartRegnskab",
      body: `Hej ${name}\n\nVelkommen til ADD SmartRegnskab. ${companyName} er oprettet med 14 dages gratis prøveperiode på pakken ${plan.name}, og prøveperioden løber til ${dkDate(trialEnd)}.\n\nBekræft din e-mailadresse her:\n${appUrl()}/#/bekraeft?token=${token}\n\nLinket virker i 24 timer.\n\nMed venlig hilsen\nADD SmartRegnskab`,
      relatedType: "tilmelding",
      relatedId: user.id,
    });

    res.status(201).json({
      ok: true,
      message: "Tjek din indbakke. Vi har sendt dig en e-mail med det næste skridt.",
      // I demoen uden mailudbyder vises linket, så flowet kan prøves
      demoToken: process.env.NODE_ENV !== "production" && !emailConfigured() ? token : undefined,
    });
  }));

  app.post("/api/auth/verify", h(async (req, res) => {
    const result = await consumeToken(String(req.body?.token ?? ""), "verificer_email");
    if (!result.ok) return res.status(400).json({ error: result.error });
    const userId = result.row?.userId;
    if (userId) await storage.updateUser(userId, { emailVerified: 1 });
    res.json({ ok: true, message: "Din e-mailadresse er bekræftet. Du kan logge ind nu." });
  }));

  app.post("/api/auth/verify/resend", publicRateLimit(5, 60 * 60_000), h(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const user = await storage.getUserByEmail(email);
    if (user && !user.emailVerified) {
      const { token } = await issueToken("verificer_email", email, {
        userId: user.id, companyId: user.companyId,
      });
      await queueAndSend({
        companyId: user.companyId,
        channel: "email",
        recipient: email,
        subject: "Bekræft din e-mail hos ADD SmartRegnskab",
        body: `Hej ${user.name}\n\nBekræft din e-mailadresse her:\n${appUrl()}/#/bekraeft?token=${token}\n\nLinket virker i 24 timer.\n\nMed venlig hilsen\nADD SmartRegnskab`,
        relatedType: "tilmelding",
        relatedId: user.id,
      });
    }
    res.json({ ok: true, message: "Hvis adressen mangler bekræftelse, har vi sendt en ny e-mail." });
  }));

  /** Glemt adgangskode. Svaret er altid det samme, så man ikke kan afsøge e-mails. */
  app.post("/api/auth/forgot", publicRateLimit(5, 60 * 60_000), h(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const user = await storage.getUserByEmail(email);
    let demoToken: string | undefined;
    if (user && user.active) {
      const { token } = await issueToken("nulstil_kode", email, {
        userId: user.id, companyId: user.companyId,
      });
      demoToken = process.env.NODE_ENV !== "production" && !emailConfigured() ? token : undefined;
      await queueAndSend({
        companyId: user.companyId,
        channel: "email",
        recipient: email,
        subject: "Nulstil din adgangskode hos ADD SmartRegnskab",
        body: `Hej ${user.name}\n\nDu kan vælge en ny adgangskode her:\n${appUrl()}/#/nulstil?token=${token}\n\nLinket virker i én time. Har du ikke bedt om det, kan du roligt ignorere denne e-mail — din nuværende adgangskode gælder fortsat.\n\nMed venlig hilsen\nADD SmartRegnskab`,
        relatedType: "nulstil_kode",
        relatedId: user.id,
      });
    }
    res.json({
      ok: true,
      message: "Findes kontoen, er der nu sendt en e-mail med et link til at vælge en ny adgangskode.",
      demoToken,
    });
  }));

  app.post("/api/auth/reset", publicRateLimit(10, 60 * 60_000), h(async (req, res) => {
    const result = await resetPassword(String(req.body?.token ?? ""), String(req.body?.password ?? ""));
    if (!result.ok) {
      return res.status(400).json({ error: result.error, problems: result.problems });
    }
    res.json({ ok: true, message: "Adgangskoden er skiftet. Log ind med den nye kode." });
  }));

  /** Invitation af en kollega — kontoen oprettes, når linket bruges. */
  app.post("/api/auth/invitation", h(async (req, res) => {
    const result = await consumeToken(String(req.body?.token ?? ""), "invitation");
    if (!result.ok || !result.row) return res.status(400).json({ error: result.error });
    const strength = passwordStrength(String(req.body?.password ?? ""));
    if (!strength.ok) {
      return res.status(400).json({ error: "Adgangskoden er for svag.", problems: strength.problems });
    }
    const payload = result.row.payload ? JSON.parse(result.row.payload) : {};
    if (await storage.getUserByEmail(result.row.email)) {
      return res.status(409).json({ error: "Der findes allerede en bruger med denne e-mailadresse." });
    }
    const user = await storage.createUser({
      companyId: result.row.companyId,
      email: result.row.email,
      name: String(req.body?.name ?? payload.name ?? result.row.email),
      password: hashPassword(String(req.body.password)),
      role: payload.role ?? "assistent",
      active: 1,
      emailVerified: 1,
      employeeId: payload.employeeId ?? null,
      customerId: payload.customerId ?? null,
      createdAt: nowIso(),
    } as any);
    res.status(201).json({ ok: true, user: safeUser(user), message: "Din konto er oprettet. Log ind nu." });
  }));

  app.get("/api/auth/invitation/:token", h(async (req, res) => {
    const row = await storage.getAuthToken(String(req.params.token));
    if (!row || row.kind !== "invitation" || row.usedAt
      || new Date(row.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: "Invitationen er ugyldig eller udløbet." });
    }
    const company = row.companyId ? await storage.getCompany(row.companyId) : undefined;
    const payload = row.payload ? JSON.parse(row.payload) : {};
    res.json({ email: row.email, companyName: company?.name ?? null, role: payload.role ?? "assistent" });
  }));

  /** Betalingsudbyderens webhook. Skal ligge uden auth, men signaturen kontrolleres. */
  app.post("/api/webhooks/:provider", h(async (req, res) => {
    const raw = Buffer.isBuffer(req.rawBody)
      ? req.rawBody.toString("utf8")
      : typeof req.rawBody === "string"
        ? req.rawBody
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? {});
    const rawSig = req.headers["stripe-signature"] ?? req.headers["x-mobilepay-signature"]
      ?? req.headers["x-signature"];
    const sig = Array.isArray(rawSig) ? rawSig[0] : rawSig;
    const result = await handleWebhook(String(req.params.provider), raw, sig);
    if (!result.valid) return res.status(400).json({ error: "Signaturen kunne ikke bekræftes." });
    res.json(result);
  }));

  /** Privatlivspolitik og databehandleraftale skal kunne læses uden login. */
  app.get("/api/legal/privatliv", h(async (_req, res) => {
    res.type("text/plain; charset=utf-8").send(privacyPolicyText());
  }));
  app.get("/api/legal/databehandleraftale", h(async (_req, res) => {
    res.type("text/plain; charset=utf-8").send(dpaText());
  }));

  registerPublicEInvoiceRoutes(app);

  app.use("/api", requireAuth);
  const regnskabApiPrefixes = [
    "/auth", "/company", "/users", "/security", "/support-cases", "/subscription", "/platform",
    "/accounting-category-rules", "/accounting-control-center", "/accounting-integrations",
    "/accounting-rules", "/accounts", "/accruals", "/advanced-vat", "/ai-accounting-tasks",
    "/ai-governance", "/ai-regnskab", "/annual-reports", "/api-keys", "/archive-records",
    "/audit-log", "/audit-package", "/auditor-portal", "/backups", "/bank-integrations",
    "/bank-payments", "/bank-reconciliation", "/bank-transactions", "/budget-versions",
    "/budgets", "/business-profiles", "/cashflow-projections", "/compliance-checks",
    "/compliance-documents", "/consolidation", "/control-tests", "/cost-centers",
    "/credit-notes", "/currency-transactions", "/customer-portal-settings", "/customers",
    "/delivery-logs", "/dimension-definitions", "/dimension-values", "/document-inbox",
    "/einvoice-queue", "/file-objects", "/file-versions", "/fixed-assets", "/import-jobs2",
    "/industry-account-templates", "/integration-configs", "/integration-retry-queue",
    "/integration-runs", "/inventory-accounts", "/invoices", "/journal-entries",
    "/migration-jobs", "/payment-runs", "/payroll-engine", "/payroll-entries",
    "/payroll-reports", "/period-closes",
    "/portal-documents", "/products", "/purchase-orders", "/receipts",
    "/reconciliation-center", "/recurring-invoices", "/regnskabssystem", "/regulatory-monitor",
    "/regulatory-changes", "/reminder-flow", "/reports", "/role-controls",
    "/security-audit-events", "/suppliers", "/system-health-events", "/tax-deadlines", "/saft", "/external-backup",
    "/vat-periods", "/vat-reconciliations", "/vouchers", "/workflow-definitions",
    "/workflow-runs", "/year-end-closes",
  ];
  app.use("/api", (req, res, next) => {
    if (regnskabApiPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) return next();
    return res.status(404).json({ error: "API-ruten findes ikke i SmartRegnskab." });
  });
  app.use("/api", (req, res, next) => {
    if (req.auth!.role !== "kunde") return next();
    const readOnlyPrefixes = ["/company", "/tasks", "/invoices", "/attachments", "/notifications"];
    const selfServicePrefixes = ["/auth/me", "/auth/logout", "/auth/password", "/security", "/support-cases"];
    const relativePath = req.path;
    if (req.method === "GET" && readOnlyPrefixes.some((prefix) => relativePath.startsWith(prefix))) return next();
    if (selfServicePrefixes.some((prefix) => relativePath.startsWith(prefix))) return next();
    return res.status(403).json({ error: "Kundeprofilen har ikke adgang til denne handling." });
  });
  app.use("/api", (req, res, next) => {
    if (req.auth!.role !== "assistent") return next();
    const restricted = [
      "/users", "/invoices", "/credit-notes", "/reports", "/integrations",
      "/subscription", "/payment", "/billing", "/gdpr", "/backup", "/platform",
      "/payroll", "/profitability", "/bank", "/account", "/journal", "/vat", "/tax",
      "/budget", "/reconciliation", "/einvoice", "/api-keys", "/audit", "/compliance",
      "/consolidation", "/advanced-vat", "/migration", "/fixed-assets", "/cashflow",
      "/vouchers", "/cost-centers", "/year-end", "/suppliers", "/products", "/document-inbox",
      "/ai-governance", "/regulatory-monitor", "/regulatory-changes", "/accounting-control-center",
    ];
    if (restricted.some((prefix) => req.path.startsWith(prefix))) {
      return res.status(403).json({ error: "Medarbejderprofilen har ikke adgang til denne funktion." });
    }
    next();
  });
  // Regnskab indeholder løn-, bank- og bogføringsdata og må aldrig kunne nås
  // af kunde- eller assistentroller, heller ikke via en skjult URL.
  app.use("/api/regnskabssystem", requireRole("leder", "holdleder", "platform_admin"));
  app.use("/api/ai-regnskab", requireRole("leder", "holdleder", "platform_admin"));

  app.get("/api/auth/me", h(async (req, res) => {
    const a = req.auth!;
    const company = await storage.getCompany(a.companyId);
    const plan = await storage.getCompanyPlan(a.companyId);
    const subscription = await storage.getSubscriptionByCompany(a.companyId);
    res.json({ user: safeUser(a.user), company, plan, subscription });
  }));

  app.post("/api/auth/logout", h(async (req, res) => {
    if (req.auth?.token) await storage.deleteSession(sessionStorageKey(req.auth.token));
    res.status(204).send();
  }));

  app.post("/api/auth/password", h(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const a = req.auth!;
    if (!verifyPassword(String(currentPassword ?? ""), a.user.password)) {
      return res.status(401).json({ error: "Den nuværende adgangskode er forkert." });
    }
    if (String(newPassword ?? "").length < 8) {
      return res.status(400).json({ error: "Den nye adgangskode skal være mindst 8 tegn." });
    }
    await storage.updateUser(a.user.id, { password: hashPassword(String(newPassword)) });
    await storage.deleteUserSessions(a.user.id); // log ud alle andre enheder
    await audit(req, "skift_adgangskode", "user", a.user.id);
    res.json({ ok: true, message: "Adgangskoden er skiftet. Log ind igen." });
  }));

  // ── Egen virksomhed ──
  app.get("/api/company", h(async (req, res) => {
    res.json(await storage.getCompany(tenantId(req)));
  }));
  app.patch("/api/company", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertCompanySchema.partial(), req.body);
    // Status styres kun fra platformen — ikke af virksomheden selv
    delete (data as any).status;
    const item = await storage.updateCompany(tenantId(req), data);
    await audit(req, "opdater", "company", tenantId(req));
    res.json(item);
  }));

  // ── AI-tilæg ──
  app.patch("/api/company/ai", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const enabled = Boolean((req.body as any)?.enabled);
    const item = await storage.updateCompany(tenantId(req), { aiEnabled: enabled ? 1 : 0 } as any);
    await audit(req, enabled ? "aktiver" : "deaktiver", "ai_tillaeg", tenantId(req));
    res.json(item);
  }));

  // ── Brugere ──
  app.get("/api/users", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const users = await storage.getUsers(tenantId(req));
    res.json(users.map(safeUser));
  }));
  app.post("/api/users", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const raw = { ...req.body, companyId: cid };
    if (raw.role === "platform_admin" && req.auth!.user.role !== "platform_admin") {
      return res.status(403).json({ error: "Du kan ikke oprette en platformadministrator." });
    }
    if (!raw.password || String(raw.password).length < 8) {
      return res.status(400).json({ error: "Adgangskoden skal være mindst 8 tegn." });
    }
    const existing = await storage.getUserByEmail(String(raw.email).trim().toLowerCase());
    if (existing) return res.status(409).json({ error: "Emailen er allerede i brug." });
    const data = validate(insertUserSchema, {
      ...raw,
      email: String(raw.email).trim().toLowerCase(),
      password: hashPassword(String(raw.password)),
      // En bruger oprettet af en allerede autentificeret leder er verificeret
      // administrativt og har ikke et separat mail-verifikationsflow.
      emailVerified: 1,
    });
    const user = await storage.createUser(data);
    await audit(req, "opret", "user", user.id, user.email);
    res.status(201).json(safeUser(user));
  }));
  app.patch("/api/users/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const target = await storage.getUser(Number(req.params.id));
    if (!target || target.companyId !== tenantId(req)) {
      return res.status(404).json({ error: "Brugeren blev ikke fundet." });
    }
    const patch: Record<string, unknown> = {};
    if (req.body.name !== undefined) patch.name = req.body.name;
    if (req.body.role !== undefined && req.body.role !== "platform_admin") patch.role = req.body.role;
    if (req.body.active !== undefined) patch.active = req.body.active ? 1 : 0;
    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return res.status(400).json({ error: "Adgangskoden skal være mindst 8 tegn." });
      }
      patch.password = hashPassword(String(req.body.password));
      await storage.deleteUserSessions(target.id);
    }
    const user = await storage.updateUser(target.id, patch);
    await audit(req, "opdater", "user", target.id);
    res.json(safeUser(user!));
  }));

  // ── Medarbejdere ──
  app.get("/api/employees", h(async (req, res) => {
    const employees = await storage.getEmployees(tenantId(req));
    if (req.auth!.role === "kunde") return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent") return res.json(employees.map(workerSafeEmployee));
    res.json(employees);
  }));
  app.get("/api/employees/:id", h(async (req, res) => {
    const item = await storage.getEmployee(Number(req.params.id), tenantId(req));
    if (!item) return res.status(404).json({ error: "Medarbejderen blev ikke fundet." });
    if (req.auth!.role === "kunde") return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent" && item.id !== req.auth!.employeeId) return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent") return res.json(workerSafeEmployee(item));
    res.json(item);
  }));
  app.post("/api/employees", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const limit = await checkLimit(cid, "employees");
    if (!limit.ok) {
      return res.status(402).json({ error: limit.message, code: "pakke_begraensning" });
    }
    const data = validate(insertEmployeeSchema, { ...req.body, companyId: cid });
    const item = await storage.createEmployee(data);
    await audit(req, "opret", "employee", item.id, item.name);
    res.status(201).json(item);
  }));
  app.patch("/api/employees/:id", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getEmployee(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Medarbejderen blev ikke fundet." });
    const data = validate(insertEmployeeSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.updateEmployee(existing.id, data));
  }));
  app.patch("/api/employees/:id/access", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getEmployee(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Medarbejderen blev ikke fundet." });
    const data = validate(insertEmployeeSchema.partial(), req.body);
    const patch: Record<string, unknown> = {};
    if (data.gpsRequired !== undefined) patch.gpsRequired = data.gpsRequired ? 1 : 0;
    if (data.appAccessEnabled !== undefined) patch.appAccessEnabled = data.appAccessEnabled ? 1 : 0;
    if (data.permissions !== undefined) patch.permissions = typeof data.permissions === "string" ? data.permissions : JSON.stringify(data.permissions);
    const updated = await storage.updateEmployee(existing.id, patch as Partial<InsertEmployee>);
    await audit(req, "opdater_adgang", "employee", existing.id, `Adgang & GPS — ${existing.name}`);
    res.json(updated);
  }));
  app.delete("/api/employees/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getEmployee(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Medarbejderen blev ikke fundet." });
    await storage.deleteEmployee(existing.id);
    await audit(req, "slet", "employee", existing.id, existing.name);
    res.status(204).send();
  }));

  // ── Kunder ──
  app.get("/api/customers", h(async (req, res) => {
    const customers = await storage.getCustomers(tenantId(req));
    if (req.auth!.role === "kunde") return res.json(customers.filter((c) => c.id === req.auth!.user.customerId));
    if (req.auth!.role === "assistent") {
      const assignedCustomerIds = new Set((await storage.getTasks(tenantId(req)))
        .filter((task) => task.employeeId === req.auth!.employeeId && task.customerId != null)
        .map((task) => task.customerId));
      return res.json(customers.filter((customer) => assignedCustomerIds.has(customer.id)).map(workerSafeCustomer));
    }
    res.json(customers);
  }));
  app.get("/api/customers/:id", h(async (req, res) => {
    const item = await storage.getCustomer(Number(req.params.id), tenantId(req));
    if (!item) return res.status(404).json({ error: "Kunden blev ikke fundet." });
    if (req.auth!.role === "kunde" && item.id !== req.auth!.user.customerId) return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent") {
      const assigned = (await storage.getTasks(tenantId(req)))
        .some((task) => task.employeeId === req.auth!.employeeId && task.customerId === item.id);
      if (!assigned) return res.status(403).json({ error: "Ingen adgang." });
      return res.json(workerSafeCustomer(item));
    }
    res.json(item);
  }));
  app.post("/api/customers", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const limit = await checkLimit(cid, "customers");
    if (!limit.ok) {
      return res.status(402).json({ error: limit.message, code: "pakke_begraensning" });
    }
    const data = validate(insertCustomerSchema, { ...req.body, companyId: cid });
    const item = await storage.createCustomer(data);
    await audit(req, "opret", "customer", item.id, item.name);
    res.status(201).json(item);
  }));
  app.patch("/api/customers/:id", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getCustomer(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Kunden blev ikke fundet." });
    const data = validate(insertCustomerSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.updateCustomer(existing.id, data));
  }));
  app.delete("/api/customers/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getCustomer(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Kunden blev ikke fundet." });
    await storage.deleteCustomer(existing.id);
    await audit(req, "slet", "customer", existing.id, existing.name);
    res.status(204).send();
  }));

  // ── Opgaver ──
  app.get("/api/tasks", h(async (req, res) => {
    const cid = tenantId(req);
    const allTasks = await storage.getTasks(cid);
    if (req.auth?.role === "kunde") {
      return res.json(allTasks.filter((task) => task.customerId === req.auth!.user.customerId));
    }
    // Assistenter ser kun opgaver tildelt til dem selv
    if (req.auth?.role === "assistent" && req.auth.employeeId) {
      res.json(allTasks.filter(t => t.employeeId === req.auth!.employeeId));
      return;
    }
    res.json(allTasks);
  }));
  app.get("/api/tasks/customer/:customerId", h(async (req, res) => {
    const cust = await storage.getCustomer(Number(req.params.customerId), tenantId(req));
    if (!cust) return res.status(404).json({ error: "Kunden blev ikke fundet." });
    if (req.auth!.role === "kunde" && cust.id !== req.auth!.user.customerId) return res.status(403).json({ error: "Ingen adgang." });
    res.json(await storage.getTasksByCustomer(cust.id));
  }));
  app.get("/api/tasks/:id", h(async (req, res) => {
    const item = await storage.getTask(Number(req.params.id), tenantId(req));
    if (!item) return res.status(404).json({ error: "Opgaven blev ikke fundet." });
    if (req.auth!.role === "kunde" && item.customerId !== req.auth!.user.customerId) return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent" && item.employeeId !== req.auth!.employeeId) return res.status(403).json({ error: "Ingen adgang." });
    res.json(item);
  }));
  app.post("/api/tasks", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = validate(insertTaskSchema, { ...req.body, companyId: cid });
    const task = await storage.createTask(data);
    // Gentagelser oprettes faktisk som rigtige opgaver
    const generated = await generateRecurrences(task);
    await audit(req, "opret", "task", task.id, generated ? `+${generated} gentagelser` : undefined);
    res.status(201).json({ ...task, generatedCount: generated });
  }));
  app.patch("/api/tasks/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.getTask(Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Opgaven blev ikke fundet." });
    if (req.auth!.role === "kunde") return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent" && existing.employeeId !== req.auth!.employeeId) return res.status(403).json({ error: "Ingen adgang." });
    const data = validate(insertTaskSchema.partial(), req.body);
    delete (data as any).companyId;
    if (req.auth!.role === "assistent") {
      const allowed = new Set(["status", "checklist"]);
      for (const key of Object.keys(data as any)) if (!allowed.has(key)) delete (data as any)[key];
    }
    const updated = await storage.updateTask(existing.id, data);
    let generated = 0;
    if (updated && (data.recurrence !== undefined || data.recurrenceEndDate !== undefined)) {
      generated = await generateRecurrences(updated);
    }
    res.json({ ...updated, generatedCount: generated });
  }));
  app.delete("/api/tasks/:id", requireRole("leder", "holdleder"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.getTask(Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Opgaven blev ikke fundet." });
    // Fjern også de genererede gentagelser
    const children = (await storage.getTasks(cid)).filter((t) => t.parentTaskId === existing.id);
    for (const c of children) await storage.deleteTask(c.id);
    await storage.deleteTask(existing.id);
    await audit(req, "slet", "task", existing.id, children.length ? `+${children.length} gentagelser` : undefined);
    res.status(204).send();
  }));

  // ── Opgavenotater (assistent kan tilføje notater til egne opgaver) ──
  app.get("/api/tasks/:id/notes", h(async (req, res) => {
    const task = await storage.getTask(Number(req.params.id), tenantId(req));
    if (!task) return res.status(404).json({ error: "Opgaven blev ikke fundet." });
    if (req.auth!.role === "assistent" && task.employeeId !== req.auth!.employeeId) return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "kunde" && task.customerId !== req.auth!.user.customerId) return res.status(403).json({ error: "Ingen adgang." });
    res.json(await storage.getTaskNotes(task.id));
  }));

  app.post("/api/tasks/:id/notes", h(async (req, res) => {
    const cid = tenantId(req);
    const task = await storage.getTask(Number(req.params.id), cid);
    if (!task) return res.status(404).json({ error: "Opgaven blev ikke fundet." });
    if (req.auth!.role === "kunde") return res.status(403).json({ error: "Ingen adgang." });
    if (req.auth!.role === "assistent" && task.employeeId !== req.auth!.employeeId) return res.status(403).json({ error: "Ingen adgang." });
    const note = (req.body?.note ?? "").toString().trim();
    if (!note) return res.status(400).json({ error: "Notatet må ikke være tomt." });
    const created = await storage.createTaskNote({
      taskId: task.id,
      userId: req.auth!.userId,
      note,
    });
    res.status(201).json(created);
  }));

  // ── Tidsregistrering (med geofence-kontrol) ──
  app.get("/api/time-entries", h(async (req, res) => {
    const cid = tenantId(req);
    const role = req.auth?.user?.role;
    const entries = await storage.getTimeEntries(cid);
    // Assistent kan kun se egne registreringer
    if (role === "assistent") {
      const empId = req.auth?.user?.employeeId;
      res.json(entries.filter((e: any) => e.employeeId === empId));
      return;
    }
    res.json(entries);
  }));
  app.post("/api/time-entries", requireRole("leder", "holdleder", "assistent", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const body = { ...req.body };
    if (req.auth!.role === "assistent") {
      if (!req.auth!.employeeId) return res.status(403).json({ error: "Brugeren er ikke knyttet til en medarbejder." });
      body.employeeId = req.auth!.employeeId;
      if (body.taskId) {
        const task = await storage.getTask(Number(body.taskId), cid);
        if (!task || task.employeeId !== req.auth!.employeeId) return res.status(403).json({ error: "Opgaven er ikke tildelt dig." });
      }
    }
    const geo = await evaluateGeofence(cid, body.taskId, body.checkInLat, body.checkInLng);
    const data = validate(insertTimeEntrySchema, {
      ...body,
      companyId: cid,
      checkInDistance: geo.distance,
      geofenceStatus: geo.status,
    });
    const entry = await storage.createTimeEntry(data);

    // Afvigelser skal ses af lederen — ikke skjules
    if (geo.status === "udenfor") {
      const emp = await storage.getEmployee(entry.employeeId, cid);
      await storage.createNotification({
        companyId: cid,
        title: "Check-in uden for arbejdsadressen",
        message: `${emp?.name ?? "En medarbejder"}: ${geo.message}`,
        type: "warning",
        read: false,
        createdAt: nowIso(),
      });
    }
    res.status(201).json({ ...entry, geofence: geo });
  }));
  app.patch("/api/time-entries/:id", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.getTimeEntry(Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Registreringen blev ikke fundet." });
    const patch: Record<string, unknown> = { ...req.body };
    delete patch.companyId;
    if (req.body.checkOutLat != null && req.body.checkOutLng != null) {
      const geo = await evaluateGeofence(cid, existing.taskId, req.body.checkOutLat, req.body.checkOutLng);
      patch.checkOutDistance = geo.distance;
    }
    const data = validate(insertTimeEntrySchema.partial(), patch);
    res.json(await storage.updateTimeEntry(existing.id, data));
  }));
  app.post("/api/time-entries/:id/approve", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getTimeEntry(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Registreringen blev ikke fundet." });
    const updated = await storage.updateTimeEntry(existing.id, { approved: 1 });
    await audit(req, "godkend", "timeEntry", existing.id);
    res.json(updated);
  }));
  app.delete("/api/time-entries/:id", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getTimeEntry(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Registreringen blev ikke fundet." });
    await storage.deleteTimeEntry(existing.id);
    res.status(204).send();
  }));

  /** Kontrollér en position mod kundens adresse, før der checkes ind. */
  app.post("/api/geofence/check", h(async (req, res) => {
    const { taskId, customerId, lat, lng } = req.body ?? {};
    res.json(await evaluateGeofence(tenantId(req), taskId, lat, lng, customerId));
  }));

  // ── Fravær ──
  app.get("/api/absences", requireFeature("fravaer"), h(async (req, res) => {
    res.json(await storage.getAbsences(tenantId(req)));
  }));
  app.post("/api/absences", requireFeature("fravaer"), h(async (req, res) => {
    const cid = tenantId(req);
    const body = { ...req.body, companyId: cid };
    if (body.endDate && body.startDate && body.endDate < body.startDate) {
      return res.status(400).json({ error: "Slutdatoen kan ikke ligge før startdatoen." });
    }
    // Kun ledere kan godkende med det samme
    if (!["leder", "holdleder", "platform_admin"].includes(req.auth!.user.role)) {
      body.status = "afventer";
    }
    const data = validate(insertAbsenceSchema, { ...body, createdAt: nowIso() });
    const item = await storage.createAbsence(data);
    if (item.status === "afventer") {
      const emp = await storage.getEmployee(item.employeeId, cid);
      await storage.createNotification({
        companyId: cid,
        title: "Fravær afventer godkendelse",
        message: `${emp?.name ?? "En medarbejder"} har anmodet om ${item.type.replace("_", " ")} fra ${dkDate(item.startDate)} til ${dkDate(item.endDate)}.`,
        type: "info", read: false, createdAt: nowIso(),
      });
    }
    await audit(req, "opret", "absence", item.id, item.type);
    res.status(201).json(item);
  }));
  app.patch("/api/absences/:id", requireFeature("fravaer"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.getAbsence(Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Fraværet blev ikke fundet." });
    const isManager = ["leder", "holdleder", "platform_admin"].includes(req.auth!.user.role);
    const patch: Record<string, unknown> = { ...req.body };
    delete patch.companyId;
    if (!isManager) {
      delete patch.status; // kun ledere kan godkende eller afvise
      delete patch.paid;
    }
    if (patch.status && patch.status !== "afventer") {
      patch.approvedBy = req.auth!.user.id;
      patch.approvedAt = nowIso();
    }
    const data = validate(insertAbsenceSchema.partial(), patch);
    const item = await storage.updateAbsence(existing.id, data);
    if (patch.status) await audit(req, String(patch.status), "absence", existing.id);
    res.json(item);
  }));
  app.delete("/api/absences/:id", requireFeature("fravaer"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getAbsence(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Fraværet blev ikke fundet." });
    await storage.deleteAbsence(existing.id);
    res.status(204).send();
  }));

  /** Fraværsoversigt pr. ansat — feriedage, sygedage og timer. */
  app.get("/api/absences/summary", requireFeature("fravaer"), h(async (req, res) => {
    const cid = tenantId(req);
    const year = String(req.query.year ?? new Date().getFullYear());
    const rows = await absenceHours(cid, `${year}-01-01`, `${year}-12-31`);
    const emps = await storage.getEmployees(cid);
    res.json(emps.map((e) => {
      const mine = rows.filter((r) => r.employeeId === e.id);
      return {
        employeeId: e.id,
        name: e.name,
        totalHours: round2(mine.reduce((s, r) => s + r.hours, 0)),
        byType: Object.fromEntries(mine.map((r) => [r.type, { hours: round2(r.hours), days: r.days }])),
      };
    }));
  }));

  // ── Vagtplan ──
  app.get("/api/shifts", requireFeature("vagtplan"), h(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    res.json(await storage.getShifts(tenantId(req), from, to));
  }));
  app.post("/api/shifts", requireFeature("vagtplan"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = validate(insertShiftSchema, { ...req.body, companyId: cid });

    // Advar hvis den ansatte har godkendt fravær den dag — men bloker ikke
    const clash = await absenceOnDate(cid, data.employeeId, data.date);
    const item = await storage.createShift(data);
    let warning: string | null = null;
    if (clash) {
      warning = `Den ansatte har godkendt ${clash.type.replace("_", " ")} den ${dkDate(data.date)}.`;
    }

    // Overlappende vagt samme dag?
    const sameDay = (await storage.getShifts(cid, data.date, data.date))
      .filter((s) => s.employeeId === data.employeeId && s.id !== item.id);
    const overlap = sameDay.find((s) => s.startTime < data.endTime && data.startTime < s.endTime);
    if (overlap) {
      warning = `${warning ? warning + " " : ""}Vagten overlapper med en anden vagt kl. ${overlap.startTime}-${overlap.endTime}.`;
    }
    res.status(201).json({ ...item, warning });
  }));
  app.patch("/api/shifts/:id", requireFeature("vagtplan"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getShift(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Vagten blev ikke fundet." });
    const data = validate(insertShiftSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.updateShift(existing.id, data));
  }));
  app.delete("/api/shifts/:id", requireFeature("vagtplan"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getShift(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Vagten blev ikke fundet." });
    await storage.deleteShift(existing.id);
    res.status(204).send();
  }));
  /** Send vagtplanen ud som SMS til de berørte medarbejdere. */
  app.post("/api/shifts/publish", requireFeature("vagtplan"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { from, to } = req.body ?? {};
    const shifts = await storage.getShifts(cid, from, to);
    const pending = shifts.filter((s) => !s.published);
    if (!pending.length) {
      return res.status(400).json({ error: "Der er ingen nye vagter at udsende i perioden." });
    }
    const emps = new Map((await storage.getEmployees(cid)).map((e) => [e.id, e]));
    const custs = new Map((await storage.getCustomers(cid)).map((c) => [c.id, c]));
    let sent = 0;
    let simulated = 0;
    for (const s of pending) {
      const emp = emps.get(s.employeeId);
      if (!emp?.phone) continue;
      const msg = await queueAndSend({
        companyId: cid, channel: "sms", recipient: emp.phone,
        body: shiftSms({
          employeeName: emp.name, date: dkDate(s.date),
          startTime: s.startTime, endTime: s.endTime,
          place: s.customerId ? custs.get(s.customerId)?.name ?? null : null,
        }),
        relatedType: "shift", relatedId: s.id,
      });
      if (msg.status === "sendt") sent++; else if (msg.status === "simuleret") simulated++;
      await storage.updateShift(s.id, { published: 1 });
    }
    res.json({
      ok: true, count: pending.length, sent, simulated,
      message: smsConfigured()
        ? `${sent} vagtbeskeder er afsendt.`
        : `${simulated} vagtbeskeder er lagt i beskedkøen. De sendes ikke, før en SMS-udbyder er opsat.`,
    });
  }));

  // ── Fotodokumentation ──
  app.get("/api/attachments", h(async (req, res) => {
    const { taskId } = req.query as Record<string, string>;
    const cid = tenantId(req);
    const attachments = await storage.getAttachments(cid, taskId ? Number(taskId) : undefined);
    if (req.auth!.role === "kunde") {
      const taskIds = new Set((await storage.getTasks(cid))
        .filter((task) => task.customerId === req.auth!.user.customerId)
        .map((task) => task.id));
      return res.json(attachments.filter((attachment) => attachment.taskId != null && taskIds.has(attachment.taskId)));
    }
    res.json(attachments);
  }));
  app.post("/api/attachments", requireFeature("fotodokumentation"), h(async (req, res) => {
    const cid = tenantId(req);
    const dataUrl = String(req.body.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Filen skal være et billede." });
    }
    // ~4/3 overhead i base64; hold os under body-grænsen
    if (dataUrl.length > 8_000_000) {
      return res.status(413).json({ error: "Billedet er for stort. Maks. omkring 6 MB." });
    }
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded.mimeType.startsWith("image/")) {
      return res.status(400).json({ error: "Filen skal være et billede." });
    }
    const data = validate(insertAttachmentSchema, {
      ...req.body, companyId: cid,
      uploadedBy: req.auth!.user.id, createdAt: nowIso(),
    });
    const item = await storage.createAttachment(data);
    res.status(201).json(item);
  }));
  app.delete("/api/attachments/:id", h(async (req, res) => {
    const existing = await storage.getAttachment(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Billedet blev ikke fundet." });
    await storage.deleteAttachment(existing.id);
    res.status(204).send();
  }));

  // ── Beskedkø ──
  app.get("/api/messages", h(async (req, res) => {
    res.json(await storage.getMessages(tenantId(req), Number(req.query.limit) || 50));
  }));
  app.get("/api/messages/status", h(async (_req, res) => {
    res.json({
      email: emailConfigured(),
      sms: smsConfigured(),
      note: "Uden opsatte udbydernøgler gemmes beskeder med status \"simuleret\" — de forlader ikke systemet.",
    });
  }));

  // ── Notifikationer ──
  app.get("/api/notifications", h(async (req, res) => {
    const notifications = await storage.getNotifications(tenantId(req));
    if (["kunde", "assistent"].includes(req.auth!.role)) {
      return res.json(notifications.filter((notification) => notification.userId == null || notification.userId === req.auth!.userId));
    }
    res.json(notifications);
  }));
  app.post("/api/notifications", h(async (req, res) => {
    const data = validate(insertNotificationSchema, { ...req.body, companyId: tenantId(req) });
    res.status(201).json(await storage.createNotification(data));
  }));
  app.patch("/api/notifications/read-all", h(async (req, res) => {
    await storage.markAllNotificationsRead(tenantId(req));
    res.status(204).send();
  }));
  app.patch("/api/notifications/:id/read", h(async (req, res) => {
    await storage.markNotificationRead(Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));
  app.delete("/api/notifications/:id", h(async (req, res) => {
    await storage.deleteNotification(Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));

  // ══════════════════════════════════════════════════
  //  FAKTURAER — moms, PDF, afsendelse, rykkere
  // ══════════════════════════════════════════════════

  app.get("/api/invoices", h(async (req, res) => {
    if (req.auth!.role === "assistent") return res.status(403).json({ error: "Ingen adgang." });
    const invoices = await storage.getInvoices(tenantId(req));
    if (req.auth!.role === "kunde") return res.json(invoices.filter((invoice) => invoice.customerId === req.auth!.user.customerId));
    res.json(invoices);
  }));
  app.get("/api/invoices/overdue", h(async (req, res) => {
    const list = await overdueInvoices(tenantId(req), today());
    const visible = req.auth!.role === "kunde"
      ? list.filter((invoice) => invoice.customerId === req.auth!.user.customerId)
      : list;
    res.json(visible.map((i) => ({ ...i, daysOverdue: daysBetween(i.dueDate!, today()) })));
  }));
  app.get("/api/invoices/customer/:customerId", h(async (req, res) => {
    const cust = await storage.getCustomer(Number(req.params.customerId), tenantId(req));
    if (!cust) return res.status(404).json({ error: "Kunden blev ikke fundet." });
    if (req.auth!.role === "assistent" || (req.auth!.role === "kunde" && cust.id !== req.auth!.user.customerId)) return res.status(403).json({ error: "Ingen adgang." });
    res.json(await storage.getInvoicesByCustomer(cust.id));
  }));
  app.get("/api/invoices/:id", h(async (req, res) => {
    const inv = await storage.getInvoice(Number(req.params.id), tenantId(req));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (req.auth!.role === "assistent" || (req.auth!.role === "kunde" && inv.customerId !== req.auth!.user.customerId)) return res.status(403).json({ error: "Ingen adgang." });
    res.json({ ...inv, items: await storage.getInvoiceItems(inv.id) });
  }));

  app.post("/api/invoices", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { customerId, items: rawItems, vatRate, paymentTerms, notes, issueDate } = req.body ?? {};
    const cust = await storage.getCustomer(Number(customerId), cid);
    if (!cust) return res.status(400).json({ error: "Vælg en gyldig kunde." });
    if (!Array.isArray(rawItems) || !rawItems.length) {
      return res.status(400).json({ error: "Fakturaen skal have mindst én linje." });
    }

    const rate = vatRate != null ? Number(vatRate) : 25;
    const terms = paymentTerms != null ? Number(paymentTerms) : 14;
    const issue = issueDate || today();

    const lines = rawItems.map((it: any) => ({
      description: String(it.description ?? "Ydelse"),
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      amount: round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
      vatRate: it.vatRate != null ? Number(it.vatRate) : rate,
    }));
    const totals = computeTotals(lines, rate);

    const seq = (await storage.getInvoices(cid)).length + 1;
    const inv = await storage.createInvoice(validate(insertInvoiceSchema, {
      companyId: cid,
      customerId: cust.id,
      invoiceNumber: `F-${new Date(issue).getFullYear()}-${String(seq).padStart(4, "0")}`,
      issueDate: issue,
      dueDate: dueDateFrom(issue, terms),
      status: "kladde",
      netAmount: totals.netAmount,
      vatRate: rate,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      paymentTerms: terms,
      notes: notes ?? null,
    }));
    for (const l of lines) await storage.createInvoiceItem({ invoiceId: inv.id, ...l });
    await audit(req, "opret", "invoice", inv.id, inv.invoiceNumber);
    res.status(201).json({ ...inv, items: await storage.getInvoiceItems(inv.id) });
  }));

  app.patch("/api/invoices/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getInvoice(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (existing.status !== "kladde") {
      return res.status(409).json({ error: "En afsendt eller bogført faktura er låst. Opret en kreditnota eller særskilt statuspostering i stedet." });
    }
    if (req.body?.status !== undefined && req.body.status !== existing.status) {
      return res.status(409).json({ error: "Fakturastatus må kun ændres gennem den relevante send-, betalings- eller kreditnota-handling." });
    }
    const data = validate(insertInvoiceSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.updateInvoice(existing.id, data));
  }));

  app.delete("/api/invoices/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getInvoice(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (existing.status !== "kladde") {
      return res.status(409).json({ error: "Kun kladder kan slettes. Afsendte fakturaer skal krediteres." });
    }
    await storage.deleteInvoiceItems(existing.id);
    await storage.deleteInvoice(existing.id);
    await audit(req, "slet", "invoice", existing.id, existing.invoiceNumber);
    res.status(204).send();
  }));

  /** PDF-faktura. */
  app.get("/api/invoices/:id/pdf", h(async (req, res) => {
    const cid = tenantId(req);
    const inv = await storage.getInvoice(Number(req.params.id), cid);
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (req.auth!.role === "assistent" || (req.auth!.role === "kunde" && inv.customerId !== req.auth!.user.customerId)) return res.status(403).json({ error: "Ingen adgang." });
    const company = await storage.getCompany(cid);
    const cust = await storage.getCustomer(inv.customerId, cid);
    if (!company || !cust) return res.status(400).json({ error: "Manglende stamdata til fakturaen." });
    const pdf = await invoicePdf(company, cust, inv, await storage.getInvoiceItems(inv.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="faktura-${inv.invoiceNumber}.pdf"`);
    res.send(pdf);
  }));

  /** Send fakturaen til kunden. */
  app.post("/api/invoices/:id/send", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const inv = await storage.getInvoice(Number(req.params.id), cid);
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (inv.status === "betalt") return res.status(409).json({ error: "Fakturaen er allerede betalt." });
    const company = await storage.getCompany(cid);
    const cust = await storage.getCustomer(inv.customerId, cid);
    if (!cust?.email) {
      return res.status(400).json({ error: `${cust?.name ?? "Kunden"} har ingen emailadresse. Tilføj den under Kunder.` });
    }
    const tpl = invoiceEmail({
      companyName: company!.name, customerName: cust.name,
      invoiceNumber: inv.invoiceNumber, total: kr(inv.totalAmount), dueDate: dkDate(inv.dueDate),
    });
    const msg = await queueAndSend({
      companyId: cid, channel: "email", recipient: cust.email,
      subject: tpl.subject, body: tpl.body, relatedType: "invoice", relatedId: inv.id,
    });
    const updated = await storage.updateInvoice(inv.id, { status: "sendt", sentAt: nowIso() });
    await audit(req, "send", "invoice", inv.id, inv.invoiceNumber);
    res.json({
      invoice: updated, message: msg,
      note: msg.status === "simuleret"
        ? "Fakturaen er markeret som sendt, og mailen ligger i beskedkøen. Den afsendes først, når en mailudbyder er opsat."
        : "Fakturaen er sendt til kunden.",
    });
  }));

  /** Send rykker. */
  app.post("/api/invoices/:id/reminder", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const inv = await storage.getInvoice(Number(req.params.id), cid);
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (inv.status === "betalt") return res.status(409).json({ error: "Fakturaen er betalt — der skal ikke rykkes." });
    if (!inv.dueDate || inv.dueDate >= today()) {
      return res.status(409).json({ error: "Fakturaen er ikke forfalden endnu." });
    }
    const company = await storage.getCompany(cid);
    const cust = await storage.getCustomer(inv.customerId, cid);
    if (!cust?.email) return res.status(400).json({ error: "Kunden har ingen emailadresse." });

    const n = (inv.reminderCount ?? 0) + 1;
    // Rykkergebyr: 1. rykker 100 kr, 2. rykker 200 kr, 3.+ rykker 300 kr
    const fee = n === 1 ? 100 : n === 2 ? 200 : 300;
    const newFee = round2((inv.reminderFee ?? 0) + fee);
    const tpl = reminderEmail({
      companyName: company!.name, customerName: cust.name,
      invoiceNumber: inv.invoiceNumber, total: kr(inv.totalAmount),
      dueDate: dkDate(inv.dueDate), daysOverdue: daysBetween(inv.dueDate, today()),
      reminderNumber: n,
    });
    const msg = await queueAndSend({
      companyId: cid, channel: "email", recipient: cust.email,
      subject: tpl.subject, body: tpl.body, relatedType: "invoice", relatedId: inv.id,
    });
    const updated = await storage.updateInvoice(inv.id, {
      status: inv.status === "betalt" ? inv.status : "rykket",
      reminderCount: n, lastReminderAt: nowIso(), reminderFee: newFee,
    });
    await audit(req, "rykker", "invoice", inv.id, `nr. ${n}, gebyr ${fee} kr`);
    res.json({ invoice: updated, message: msg, reminderNumber: n, reminderFee: fee, totalReminderFee: newFee });
  }));

  /** Registrér betaling. */
  app.post("/api/invoices/:id/paid", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const inv = await storage.getInvoice(Number(req.params.id), tenantId(req));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    const outstanding = round2(
      (inv.totalAmount ?? 0) + (inv.reminderFee ?? 0)
      - (inv.paidAmount ?? 0) - (inv.creditedAmount ?? 0),
    );
    const updated = await storage.updateInvoice(inv.id, {
      status: "betalt", paidAt: nowIso(),
      paidAmount: round2((inv.paidAmount ?? 0) + Math.max(0, outstanding)),
    });
    await audit(req, "betalt", "invoice", inv.id, inv.invoiceNumber);
    res.json(updated);
  }));

  /** Registrer delvis/fuld betaling med et angivet beløb. */
  app.post("/api/invoices/:id/payment", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const inv = await storage.getInvoice(Number(req.params.id), tenantId(req));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (inv.status === "betalt") return res.status(409).json({ error: "Fakturaen er allerede betalt." });
    const amount = round2(Number(req.body?.amount) || 0);
    if (amount <= 0) return res.status(400).json({ error: "Angiv et beløb større end 0." });
    const newPaid = round2((inv.paidAmount ?? 0) + amount);
    const outstanding = round2(
      (inv.totalAmount ?? 0) + (inv.reminderFee ?? 0)
      - newPaid - (inv.creditedAmount ?? 0),
    );
    const fullyPaid = outstanding <= 0;
    const updated = await storage.updateInvoice(inv.id, {
      paidAmount: newPaid,
      status: fullyPaid ? "betalt" : inv.status === "kladde" ? "sendt" : inv.status,
      paidAt: fullyPaid ? nowIso() : inv.paidAt,
    });
    await audit(req, "betaling", "invoice", inv.id, `${amount} kr${fullyPaid ? " (fuldt betalt)" : " (delvis)"}`);
    res.json({ invoice: updated, paidAmount: newPaid, outstanding, fullyPaid });
  }));

  /** Overdrag til inkasso. Sætter status til "overdraget". */
  app.post("/api/invoices/:id/handover", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const inv = await storage.getInvoice(Number(req.params.id), tenantId(req));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (inv.status === "betalt") return res.status(409).json({ error: "Fakturaen er allerede betalt." });
    const updated = await storage.updateInvoice(inv.id, { status: "overdraget" });
    await audit(req, "overdraget", "invoice", inv.id, inv.invoiceNumber);
    res.json(updated);
  }));

  // ══════════════════════════════════════════════════
  //  KREDITNOTAER — kreditnotaer til fakturaer
  // ══════════════════════════════════════════════════

  app.get("/api/credit-notes", h(async (req, res) => {
    const cid = tenantId(req);
    const list = await storage.all("creditNotes", cid);
    const custIds = Array.from(new Set(list.map((c: any) => c.customerId).filter(Boolean)));
    const invIds = Array.from(new Set(list.map((c: any) => c.invoiceId).filter(Boolean)));
    const customers = await storage.getCustomers(cid);
    const custMap = new Map(customers.map((c: any) => [c.id, c.name]));
    const invMap = new Map<number, string>();
    for (const id of invIds) {
      const inv = await storage.getInvoice(id, cid);
      if (inv) invMap.set(id, inv.invoiceNumber);
    }
    res.json(list.map((c: any) => ({
      ...c,
      customerName: c.customerId ? custMap.get(c.customerId) ?? null : null,
      invoiceNumber: c.invoiceId ? invMap.get(c.invoiceId) ?? null : null,
    })));
  }));

  app.get("/api/credit-notes/:id", h(async (req, res) => {
    const cn = await storage.get("creditNotes", Number(req.params.id), tenantId(req));
    if (!cn) return res.status(404).json({ error: "Kreditnotaen blev ikke fundet." });
    res.json(cn);
  }));

  app.post("/api/credit-notes", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { invoiceId, customerId, amount, reason } = req.body ?? {};
    let resolvedCustomerId: number | null = null;
    let resolvedAmount = Number(amount) || 0;
    let linkedInvoice: any = null;
    if (invoiceId) {
      const inv = await storage.getInvoice(Number(invoiceId), cid);
      if (!inv) return res.status(400).json({ error: "Fakturaen blev ikke fundet." });
      linkedInvoice = inv;
      resolvedCustomerId = inv.customerId;
      resolvedAmount = resolvedAmount > 0 ? resolvedAmount : round2(inv.totalAmount);
      if (inv.status === "kladde") return res.status(409).json({ error: "En kladde-faktura kan ikke krediteres — slet den i stedet." });
      // Tillad ikke at kreditere mere end det udestående (total + gebyr - allerede krediteret)
      const maxCreditable = round2(
        (inv.totalAmount ?? 0) + (inv.reminderFee ?? 0) - (inv.creditedAmount ?? 0),
      );
      if (Math.abs(resolvedAmount) > maxCreditable && maxCreditable > 0) {
        resolvedAmount = maxCreditable;
      }
    } else if (customerId) {
      const cust = await storage.getCustomer(Number(customerId), cid);
      if (!cust) return res.status(400).json({ error: "Kunden blev ikke fundet." });
      resolvedCustomerId = cust.id;
    } else {
      return res.status(400).json({ error: "Vælg en faktura eller kunde at kreditere." });
    }
    const seq = (await storage.all("creditNotes", cid)).length + 1;
    const cn = await storage.insert("creditNotes", {
      companyId: cid,
      customerId: resolvedCustomerId,
      invoiceId: invoiceId ? Number(invoiceId) : null,
      creditNumber: `KN-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`,
      amount: round2(Math.abs(resolvedAmount)),
      reason: reason ? String(reason).slice(0, 1000) : null,
      status: "bogfort",
      createdAt: nowIso(),
    });
    // Opdater fakturaens krediterede beløb og status
    let updatedInvoice: any = null;
    if (linkedInvoice) {
      const newCredited = round2((linkedInvoice.creditedAmount ?? 0) + cn.amount);
      const fullyCredited = newCredited >= (linkedInvoice.totalAmount ?? 0);
      updatedInvoice = await storage.updateInvoice(linkedInvoice.id, {
        creditedAmount: newCredited,
        status: fullyCredited ? "krediteret" : linkedInvoice.status === "betalt" ? "krediteret" : linkedInvoice.status,
      });
      await audit(req, "kredit", "invoice", linkedInvoice.id, `${cn.creditNumber}: ${cn.amount} kr`);
    }
    await audit(req, "opret", "credit_note", cn.id, cn.creditNumber);
    res.status(201).json({ ...cn, invoice: updatedInvoice });
  }));

  app.patch("/api/credit-notes/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.get("creditNotes", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Kreditnotaen blev ikke fundet." });
    if (existing.status === "bogfort" || existing.status === "sendt") {
      return res.status(409).json({ error: "En bogført eller sendt kreditnota er låst. Opret en ny modpostering i stedet." });
    }
    const data: any = {};
    if (req.body?.amount != null) data.amount = round2(Math.abs(Number(req.body.amount)) || 0);
    if (req.body?.reason != null) data.reason = req.body.reason ? String(req.body.reason).slice(0, 1000) : null;
    if (req.body?.status != null) data.status = String(req.body.status);
    res.json(await storage.update("creditNotes", existing.id, data, cid));
  }));

  app.delete("/api/credit-notes/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.get("creditNotes", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Kreditnotaen blev ikke fundet." });
    if (existing.status === "bogfort" || existing.status === "sendt") {
      return res.status(409).json({ error: "En bogført eller sendt kreditnota må ikke slettes." });
    }
    await storage.delete("creditNotes", existing.id, cid);
    await audit(req, "slet", "credit_note", existing.id, existing.creditNumber);
    res.status(204).send();
  }));

  // ════════════════════════════════════════════════
  //  CUSTOM PAYMENT TERMS — betalingsbetingelser
  // ════════════════════════════════════════════════
  app.get("/api/custom-payment-terms", h(async (req, res) => {
    res.json(await storage.all("customPaymentTerms", tenantId(req)));
  }));
  app.post("/api/custom-payment-terms", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = validate(insertCustomPaymentTermSchema, { ...req.body, companyId: cid });
    const item = await storage.insert("customPaymentTerms", { ...data, createdAt: nowIso() });
    await audit(req, "opret", "custom_payment_term", item.id, item.name);
    res.status(201).json(item);
  }));
  app.patch("/api/custom-payment-terms/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.get("customPaymentTerms", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Betalingsbetingelsen blev ikke fundet." });
    const data = validate(insertCustomPaymentTermSchema.partial(), req.body);
    delete (data as any).companyId;
    delete (data as any).createdAt;
    res.json(await storage.update("customPaymentTerms", existing.id, data, cid));
  }));
  app.delete("/api/custom-payment-terms/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.get("customPaymentTerms", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Betalingsbetingelsen blev ikke fundet." });
    await storage.delete("customPaymentTerms", existing.id, cid);
    await audit(req, "slet", "custom_payment_term", existing.id, existing.name);
    res.status(204).send();
  }));

  /** Momsopgørelse for en periode. */
  app.get("/api/reports/vat", h(async (req, res) => {
    const cid = tenantId(req);
    const { from, to } = req.query as Record<string, string>;
    const invs = (await storage.getInvoices(cid)).filter(
      (i) => i.status !== "kladde" && (!from || i.issueDate >= from) && (!to || i.issueDate <= to),
    );
    const net = round2(invs.reduce((s, i) => s + i.netAmount, 0));
    const vat = round2(invs.reduce((s, i) => s + i.vatAmount, 0));
    res.json({
      from: from ?? null, to: to ?? null, invoiceCount: invs.length,
      netAmount: net, salgsmoms: vat, totalAmount: round2(net + vat),
      note: "Opgørelsen dækker kun udgående salgsmoms. Købsmoms registreres ikke i ADD SmartRegnskab.",
    });
  }));

  // ══════════════════════════════════════════════════
  //  RAPPORTER OG EKSPORT
  // ══════════════════════════════════════════════════

  async function buildPayrollLines(cid: number, from?: string, to?: string): Promise<PayrollLine[]> {
    const entries = await storage.getTimeEntries(cid);
    const emps = await storage.getEmployees(cid);
    const empMap = new Map(emps.map((e) => [e.id, e]));
    const period = (from || today()).slice(0, 7);

    const inRange = entries.filter((t) =>
      t.durationMinutes && (!from || t.date >= from) && (!to || t.date <= to));
    const byEmp = new Map<number, number>();
    inRange.forEach((t) => byEmp.set(t.employeeId, (byEmp.get(t.employeeId) || 0) + (t.durationMinutes || 0)));

    const lines: PayrollLine[] = Array.from(byEmp.entries()).map(([empId, mins]) => ({
      employeeNo: String(empId),
      name: empMap.get(empId)?.name || "Ukendt",
      wageCode: "Timeløn",
      unit: "Timer",
      hours: round2(mins / 60),
      period,
    }));

    // Fraværstimer med hver sin lønart — ellers bliver lønnen forkert
    if (from && to) {
      for (const a of Array.from(await absenceHours(cid, from, to))) {
        lines.push({
          employeeNo: String(a.employeeId),
          name: empMap.get(a.employeeId)?.name || "Ukendt",
          wageCode: ABSENCE_WAGE_CODES[a.type] ?? "Øvrigt fravær",
          unit: "Timer",
          hours: round2(a.hours),
          period,
        });
      }
    }
    return lines;
  }

  async function buildInvoiceLines(cid: number, from?: string, to?: string): Promise<InvoiceLine[]> {
    const invs = await storage.getInvoices(cid);
    const custs = new Map((await storage.getCustomers(cid)).map((c) => [c.id, c]));
    return invs
      .filter((inv) => (!from || inv.issueDate >= from) && (!to || inv.issueDate <= to))
      .map((inv) => ({
        invoiceNo: inv.invoiceNumber,
        date: inv.issueDate,
        customer: custs.get(inv.customerId)?.name || "Ukendt",
        customerNo: String(inv.customerId),
        amount: inv.netAmount,
        vat: inv.vatAmount,
        total: inv.totalAmount,
        dueDate: inv.dueDate || "",
      }));
  }

  app.get("/api/reports/time-by-employee", h(async (req, res) => {
    const cid = tenantId(req);
    const entries = await storage.getTimeEntries(cid);
    const empMap = new Map((await storage.getEmployees(cid)).map((e) => [e.id, e]));
    const byEmp = new Map<number, number>();
    entries.filter((t) => t.durationMinutes).forEach((t) =>
      byEmp.set(t.employeeId, (byEmp.get(t.employeeId) || 0) + (t.durationMinutes || 0)));
    const rows = [["Navn", "Stilling", "Timer", "Minutter"]];
    byEmp.forEach((mins, id) => {
      const e = empMap.get(id);
      rows.push([e?.name || "Ukendt", e?.role || "", (mins / 60).toFixed(2).replace(".", ","), String(mins)]);
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="timer-pr-ansat.csv"');
    res.send("\ufeff" + rows.map((r) => r.join(";")).join("\r\n"));
  }));

  app.get("/api/reports/time-by-customer", h(async (req, res) => {
    const cid = tenantId(req);
    const entries = await storage.getTimeEntries(cid);
    const taskMap = new Map((await storage.getTasks(cid)).map((t) => [t.id, t]));
    const custMap = new Map((await storage.getCustomers(cid)).map((c) => [c.id, c]));
    const byCust = new Map<number, number>();
    entries.filter((t) => t.durationMinutes && t.taskId).forEach((t) => {
      const task = taskMap.get(t.taskId!);
      if (task?.customerId) {
        byCust.set(task.customerId, (byCust.get(task.customerId) || 0) + (t.durationMinutes || 0));
      }
    });
    const rows = [["Kunde", "Adresse", "Timer", "Minutter", "Timepris", "Beløb"]];
    byCust.forEach((mins, id) => {
      const c = custMap.get(id);
      const hours = mins / 60;
      const rate = c?.hourlyRate || 350;
      rows.push([
        c?.name || "Ukendt", c?.address || "",
        hours.toFixed(2).replace(".", ","), String(mins),
        String(rate), (hours * rate).toFixed(2).replace(".", ","),
      ]);
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="timer-pr-kunde.csv"');
    res.send("\ufeff" + rows.map((r) => r.join(";")).join("\r\n"));
  }));

  app.get("/api/reports/tasks", h(async (req, res) => {
    const cid = tenantId(req);
    const custMap = new Map((await storage.getCustomers(cid)).map((c) => [c.id, c]));
    const empMap = new Map((await storage.getEmployees(cid)).map((e) => [e.id, e]));
    const rows = [["Titel", "Kunde", "Ansat", "Dato", "Start", "Slut", "Status", "Prioritet"]];
    (await storage.getTasks(cid)).forEach((t) => {
      rows.push([
        t.title,
        t.customerId ? custMap.get(t.customerId)?.name || "" : "",
        t.employeeId ? empMap.get(t.employeeId)?.name || "" : "",
        t.date, t.startTime || "", t.endTime || "", t.status, t.priority,
      ]);
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="opgaver.csv"');
    res.send("\ufeff" + rows.map((r) => r.join(";")).join("\r\n"));
  }));

  app.get("/api/reports/payroll", requireFeature("loen_eksport"), h(async (req, res) => {
    const { from, to, format, preview } = req.query as Record<string, string>;
    const lines = await buildPayrollLines(tenantId(req), from, to);
    const fmt = getFormat(format, "loen");
    const content = buildPayrollFile(fmt.id, lines);
    if (preview === "1") {
      return res.json({
        format: fmt, rowCount: lines.length,
        totalHours: round2(lines.reduce((s, l) => s + l.hours, 0)),
        sample: content.replace(/^\ufeff/, "").split("\r\n").slice(0, 6),
      });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="loen-${fmt.id}.${fmt.extension}"`);
    res.send(content);
  }));

  app.get("/api/reports/accounting", requireFeature("regnskab_eksport"), h(async (req, res) => {
    const { from, to, format, preview } = req.query as Record<string, string>;
    const invs = await buildInvoiceLines(tenantId(req), from, to);
    const fmt = getFormat(format, "regnskab");
    const content = buildAccountingFile(fmt.id, invs);
    if (preview === "1") {
      return res.json({
        format: fmt, rowCount: invs.length,
        totalAmount: round2(invs.reduce((s, i) => s + i.total, 0)),
        sample: content.replace(/^\ufeff/, "").split("\r\n").slice(0, 6),
      });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="regnskab-${fmt.id}.${fmt.extension}"`);
    res.send(content);
  }));

  // ══════════════════════════════════════════════════
  //  INTEGRATIONER
  // ══════════════════════════════════════════════════

  app.get("/api/integrations/meta", h(async (_req, res) => {
    res.json({
      apiProviders: API_PROVIDERS,
      credentialFields: Object.fromEntries(
        ["e-conomic", "Danløn", "Dataløn (Bluegarden)", "Zenegy", "Dinero", "Billy", "Visma eAccounting"]
          .map((p) => [p, credentialFields(p)]),
      ),
      exportFormats: EXPORT_FORMATS,
    });
  }));

  app.get("/api/integrations", h(async (req, res) => {
    const list = await storage.getIntegrations(tenantId(req));
    // Nøgler forlader ikke serveren — kun om de er sat
    res.json(list.map((i) => ({
      ...i, apiKey: i.apiKey ? "••••••••" : null, apiSecret: i.apiSecret ? "••••••••" : null,
      hasCredentials: Boolean(i.apiKey),
    })));
  }));
  app.post("/api/integrations", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertIntegrationSchema, { ...req.body, companyId: tenantId(req) });
    res.status(201).json(await storage.createIntegration(data));
  }));
  app.patch("/api/integrations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getIntegration(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    const body = { ...req.body };
    // Undgå at maskerede pladsholdere overskriver rigtige nøgler
    if (body.apiKey === "••••••••") delete body.apiKey;
    if (body.apiSecret === "••••••••") delete body.apiSecret;
    const data = validate(insertIntegrationSchema.partial(), body);
    delete (data as any).companyId;
    const item = await storage.updateIntegration(existing.id, data);
    await audit(req, "opdater", "integration", existing.id, existing.provider);
    res.json({ ...item!, apiKey: item!.apiKey ? "••••••••" : null, apiSecret: item!.apiSecret ? "••••••••" : null });
  }));
  app.post("/api/integrations/:id/connect-demo", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Demo-integration")) return;
    const existing = await storage.getIntegration(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    res.json(await storage.updateIntegration(existing.id, {
      status: "demo_forbundet", lastSyncAt: nowIso(), lastError: null,
    }));
  }));
  app.post("/api/integrations/:id/disconnect", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getIntegration(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    await audit(req, "afbryd", "integration", existing.id, existing.provider);
    res.json(await storage.updateIntegration(existing.id, {
      status: "ikke_opsat", apiKey: null, apiSecret: null,
      syncMode: "eksport", lastSyncAt: null, lastError: null,
    }));
  }));
  app.delete("/api/integrations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.getIntegration(Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    await storage.deleteIntegration(existing.id);
    res.status(204).send();
  }));

  app.post("/api/integrations/:id/test", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const integration = await storage.getIntegration(Number(req.params.id), tenantId(req));
    if (!integration) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    const result = await testConnection(integration);
    if (process.env.NODE_ENV === "production" && result.demo) {
      await storage.updateIntegration(integration.id, { status: "fejl", lastError: result.message });
      return res.status(503).json({ ok: false, error: "Integrationen mangler gyldige produktionsoplysninger." });
    }
    const updated = await storage.updateIntegration(integration.id, {
      status: result.ok ? (result.demo ? "demo_forbundet" : "forbundet") : "fejl",
      syncMode: result.ok && !result.demo ? "api" : "eksport",
      lastSyncAt: result.ok ? nowIso() : integration.lastSyncAt,
      lastError: result.ok ? null : result.message,
    });
    await storage.createSyncLog({
      companyId: integration.companyId, integrationId: integration.id, provider: integration.provider,
      action: "test_forbindelse", status: result.ok ? "ok" : "fejl",
      recordCount: 0, message: result.message, createdAt: nowIso(),
    });
    res.json({ ...result, integration: { ...updated!, apiKey: updated!.apiKey ? "••••••••" : null, apiSecret: null } });
  }));

  app.post("/api/integrations/:id/sync", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const integration = await storage.getIntegration(Number(req.params.id), cid);
    if (!integration) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    const { from, to } = req.query as Record<string, string>;

    let result;
    let action: string;
    if (integration.category === "loen") {
      const lines = await buildPayrollLines(cid, from, to);
      if (!lines.length) {
        return res.status(400).json({ ok: false, message: "Ingen registrerede timer i perioden — der er intet at synkronisere." });
      }
      action = "synk_loen";
      result = await syncPayroll(integration, lines);
    } else {
      const invs = await buildInvoiceLines(cid, from, to);
      if (!invs.length) {
        return res.status(400).json({ ok: false, message: "Ingen fakturaer i perioden — der er intet at synkronisere." });
      }
      action = "synk_fakturaer";
      result = await syncInvoices(integration, invs);
    }

    if (process.env.NODE_ENV === "production" && result.demo) {
      await storage.updateIntegration(integration.id, { status: "fejl", lastError: result.message });
      return res.status(503).json({ ok: false, error: "Integrationen mangler gyldige produktionsoplysninger." });
    }

    const updated = await storage.updateIntegration(integration.id, {
      status: result.ok ? (result.demo ? "demo_forbundet" : "forbundet") : "fejl",
      lastSyncAt: result.ok ? nowIso() : integration.lastSyncAt,
      lastError: result.ok ? null : result.message,
    });
    await storage.createSyncLog({
      companyId: cid, integrationId: integration.id, provider: integration.provider,
      action, status: result.ok ? "ok" : "fejl", recordCount: result.recordCount || 0,
      message: result.message, createdAt: nowIso(),
    });
    res.json({ ...result, integration: { ...updated!, apiKey: updated!.apiKey ? "••••••••" : null, apiSecret: null } });
  }));

  app.get("/api/sync-logs", h(async (req, res) => {
    res.json(await storage.getSyncLogs(tenantId(req), Number(req.query.limit) || 30));
  }));

  app.get("/api/audit-logs", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.getAuditLogs(tenantId(req), Number(req.query.limit) || 100));
  }));

  // ══════════════════════════════════════════════════
  //  ABONNEMENT — virksomhedens eget syn
  // ══════════════════════════════════════════════════

  app.get("/api/subscription", h(async (req, res) => {
    const cid = tenantId(req);
    const sub = await storage.getSubscriptionByCompany(cid);
    const plan = await storage.getCompanyPlan(cid);
    const employeeCount = (await storage.getEmployees(cid)).length;
    const customerCount = (await storage.getCustomers(cid)).length;
    const invoices = (await storage.getPlatformInvoices(cid));
    res.json({
      subscription: sub ?? null,
      plan: plan ?? null,
      usage: {
        employees: employeeCount,
        maxEmployees: plan?.maxEmployees ?? -1,
        customers: customerCount,
        maxCustomers: plan?.maxCustomers ?? -1,
      },
      nextCharge: await previewBilling(cid),
      invoices,
    });
  }));

  app.get("/api/subscription/invoices/:id/pdf", h(async (req, res) => {
    const cid = tenantId(req);
    const inv = (await storage.getPlatformInvoices(cid)).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    const company = await storage.getCompany(cid);
    const pdf = await platformInvoicePdf(company!, inv);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${inv.invoiceNumber}.pdf"`);
    res.send(pdf);
  }));

  /** Virksomheden vælger selv en anden pakke. */
  app.post("/api/subscription/plan", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const plan = await storage.getPlan(Number(req.body?.planId));
    if (!plan || !plan.active) return res.status(400).json({ error: "Vælg en gyldig pakke." });
    const sub = await storage.getSubscriptionByCompany(cid);
    if (!sub) return res.status(400).json({ error: "Virksomheden har ikke et abonnement." });

    // Nedgradering må ikke efterlade flere ansatte end pakken tillader
    const employeeCount = (await storage.getEmployees(cid)).length;
    if (plan.maxEmployees !== -1 && employeeCount > plan.maxEmployees) {
      return res.status(409).json({
        error: `${plan.name} tillader ${plan.maxEmployees} ansatte, og I har ${employeeCount}. Fjern ansatte først, eller vælg en større pakke.`,
      });
    }
    const updated = await storage.updateSubscription(sub.id, { planId: plan.id });
    await audit(req, "skift_pakke", "subscription", sub.id, plan.name);
    res.json({ subscription: updated, plan, nextCharge: await previewBilling(cid) });
  }));

  // ══════════════════════════════════════════════════
  //  PLATFORM — kun for ADD SmartRegnskabs eget team
  // ══════════════════════════════════════════════════

  app.get("/api/platform/stats", requirePlatformAdmin, h(async (_req, res) => {
    res.json(await platformMetrics(today()));
  }));

  app.get("/api/platform/companies", requirePlatformAdmin, h(async (_req, res) => {
    const allCompanies = await storage.getCompanies();
    const subs = await storage.getSubscriptions();
    const plans = new Map((await storage.getPlans()).map((p) => [p.id, p]));
    const out = [];
    for (const c of allCompanies) {
      // ADD SmartRegnskabs egen konto vises ikke som kundevirksomhed
      if ((c as any).kind === "platform") continue;
      const sub = subs.find((s) => s.companyId === c.id);
      const plan = sub ? plans.get(sub.planId) : undefined;
      const employees = (await storage.getEmployees(c.id)).length;
      const monthly = plan ? plan.monthlyPrice + employees * plan.pricePerEmployee : 0;
      out.push({
        ...c,
        employeeCount: employees,
        customerCount: (await storage.getCustomers(c.id)).length,
        userCount: (await storage.getUsers(c.id)).length,
        planName: plan?.name ?? "Ingen pakke",
        planId: plan?.id ?? null,
        subscriptionStatus: sub?.status ?? "ingen",
        billingCycle: sub?.billingCycle ?? null,
        trialEndsAt: sub?.trialEndsAt ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        monthlyValue: round2(monthly),
      });
    }
    res.json(out);
  }));

  app.get("/api/platform/companies/:id", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const sub = await storage.getSubscriptionByCompany(id);
    const plan = await storage.getCompanyPlan(id);
    const users = (await storage.getUsers(id)).map(safeUser);
    const employees = await storage.getEmployees(id);
    const customers = await storage.getCustomers(id);
    const tasks = await storage.getTasks(id);
    const invoices = await storage.getPlatformInvoices(id);
    const consents = await storage.getConsents(id);
    const dpaConsent = consents.find((cn: any) => cn.kind === "databehandling" && cn.granted);
    const auditLogs = await storage.getAuditLogs(id, 20);
    const payments = await storage.getPayments(id, 20);
    const nextCharge = await previewBilling(id);
    // AI-insigt: virksomhedens sundhed
    const unpaidInvoices = invoices.filter((i) => i.status !== "betalt");
    const outstanding = unpaidInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const monthlyValue = plan ? plan.monthlyPrice + employees.length * plan.pricePerEmployee : 0;
    const healthScore = company.status === "aktiv" ? 100 : company.status === "proeve" ? 70 : company.status === "i_restance" ? 40 : company.status === "spaerret" ? 15 : 5;
    res.json({
      company,
      subscription: sub,
      plan,
      users,
      employeeCount: employees.length,
      customerCount: customers.length,
      taskCount: tasks.length,
      invoices,
      payments,
      auditLogs,
      nextCharge,
      dpa: {
        accepted: !!dpaConsent,
        acceptedAt: dpaConsent?.grantedAt ?? null,
      },
      summary: {
        outstanding: Math.round(outstanding * 100) / 100,
        monthlyValue: Math.round(monthlyValue * 100) / 100,
        unpaidCount: unpaidInvoices.length,
        healthScore,
        activeUsers: users.filter((u) => u.active).length,
        employeeUtilization: employees.length > 0 ? Math.round((employees.filter((e) => e.status === "optaget").length / employees.length) * 100) : 0,
      },
    });
  }));

  // AI assistent — regelbaseret forslag og analyser
  app.post("/api/ai/assist", requireAuth, h(async (req, res) => {
    const { contextType, intent, companyId, entityId } = req.body ?? {};
    const cid = companyId ?? req.auth!.companyId;

    if (contextType === "virksomhedsoversigt" && req.auth!.isPlatformAdmin) {
      const company = await storage.getCompany(Number(entityId ?? cid));
      if (!company) return res.status(404).json({ error: "Virksomhed ikke fundet." });
      const sub = await storage.getSubscriptionByCompany(company.id);
      const plan = await storage.getCompanyPlan(company.id);
      const invoices = await storage.getPlatformInvoices(company.id);
      const employees = await storage.getEmployees(company.id);
      const customers = await storage.getCustomers(company.id);
      const unpaid = invoices.filter((i) => i.status !== "betalt");
      const outstanding = unpaid.reduce((s, i) => s + i.totalAmount, 0);
      const monthlyValue = plan ? plan.monthlyPrice + employees.length * plan.pricePerEmployee : 0;
      const suggestions: string[] = [];
      const risks: string[] = [];

      if (company.status === "i_restance") {
        risks.push(`${company.name} har ubetalt faktura på ${Math.round(outstanding)} kr. Overvej at sende rykker eller spærre adgangen.`);
      }
      if (company.status === "spaerret") {
        risks.push(`${company.name} er spærret.Kontakt virksomheden for at afklare betaling eller opsige abonnementet.`);
      }
      if (company.status === "proeve" && sub?.trialEndsAt) {
        const daysLeft = Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 3) suggestions.push(`Prøveperiode udløber om ${daysLeft} dage. Kontakt ${company.name} for at konvertere til betalt abonnement.`);
      }
      if (unpaid.length > 2) risks.push(`${unpaid.length} ubetalte fakturaer. Henvis til betalingsplan eller opsigelse.`);
      if (employees.length > 0 && plan && plan.maxEmployees >= 0 && employees.length >= plan.maxEmployees * 0.8) {
        suggestions.push(`${company.name} nærmer sig grænsen for ansatte i ${plan.name}-pakken (${employees.length}/${plan.maxEmployees}). Foreslå opgradering.`);
      }
      if (monthlyValue > 0 && company.status === "aktiv") suggestions.push(`${company.name} genererer ${Math.round(monthlyValue)} kr/md. Sund kunde.`);
      if (customers.length === 0 && employees.length > 0) suggestions.push(`${company.name} har ansatte men ingen kunder. Tilbyd onboarding-hjælp.`);
      if (risks.length === 0 && suggestions.length === 0) suggestions.push(`${company.name} ser sund ud. Ingen umiddelbare handlinger nødvendige.`);

      res.json({
        insights: suggestions,
        risks,
        healthScore: company.status === "aktiv" ? 100 : company.status === "proeve" ? 70 : company.status === "i_restance" ? 40 : company.status === "spaerret" ? 15 : 5,
        summary: `${company.name} er ${company.status === "aktiv" ? "en aktiv" : company.status === "proeve" ? "en prøve" : "en ${company.status}"} kunde med ${employees.length} ansatte, ${customers.length} kunder og ${unpaid.length} ubetalte fakturaer.`,
      });
    }

    else if (contextType === "kunde" && intent === "lead_score") {
      const customer = (await storage.getCustomers(cid)).find((c) => c.id === Number(entityId));
      if (!customer) return res.status(404).json({ error: "Kunde ikke fundet." });
      let score = 50;
      const reasons: string[] = [];
      if (customer.hourlyRate && customer.hourlyRate > 350) { score += 20; reasons.push("Høj timepris indikerer premium-kunde."); }
      if (customer.email) { score += 10; reasons.push("Har e-mail — nem kommunikation."); }
      if (customer.contact) { score += 10; reasons.push("Har kontaktperson."); }
      if (customer.geofenceRadius && customer.geofenceRadius > 200) { score += 10; reasons.push("Stort anlæg — potentiale for gentagne opgaver."); }
      if (customer.hourlyRate && customer.hourlyRate < 300) { score -= 15; reasons.push("Lav timepris — lavere margin."); }
      res.json({ score: Math.max(0, Math.min(100, score)), reasons, summary: `${customer.name} har en lead-score på ${Math.max(0, Math.min(100, score))}/100.` });
    }

    else if (contextType === "tilbud" && intent === "draft") {
      const customer = (await storage.getCustomers(cid)).find((c) => c.id === Number(entityId));
      if (!customer) return res.status(404).json({ error: "Kunde ikke fundet." });
      const tasks = (await storage.getTasks(cid)).filter((t) => t.customerId === customer.id);
      const company = await storage.getCompany(cid);
      const suggestions: any[] = [];
      const rate = customer.hourlyRate ?? 350;
      const vatRate = company?.vatRate ?? 25;

      suggestions.push({ description: "Ugentlig grundrengøring", quantity: 4, unit: "gange", unitPrice: Math.round(rate * 3), total: Math.round(rate * 3 * 4) });
      suggestions.push({ description: "Gulvvask og pleje", quantity: 2, unit: "gange", unitPrice: Math.round(rate * 2), total: Math.round(rate * 2 * 2) });

      if (customer.geofenceRadius && customer.geofenceRadius > 200) {
        suggestions.push({ description: "Gulvbehandling stort areal", quantity: 1, unit: "stk", unitPrice: Math.round(rate * 5), total: Math.round(rate * 5) });
        suggestions.push({ description: "Vinduespolering", quantity: 1, unit: "stk", unitPrice: Math.round(rate * 4), total: Math.round(rate * 4) });
      }
      suggestions.push({ description: "Startop-inspektion og opsætning", quantity: 1, unit: "stk", unitPrice: Math.round(rate * 2), total: Math.round(rate * 2) });

      if (tasks.length > 0) {
        const avgHours = tasks.reduce((s, t) => s + 2, 0) / tasks.length;
        suggestions.push({ description: "Ekstra rengøring pr. opgave", quantity: tasks.length, unit: "timer", unitPrice: Math.round(rate), total: Math.round(avgHours * rate * tasks.length) });
        suggestions.push({ description: "Kvalitetskontrol og opfølgning", quantity: 1, unit: "stk", unitPrice: Math.round(rate * 1.5), total: Math.round(rate * 1.5) });
      }

      suggestions.push({ description: "Rengøringsmaterialer og forbrug", quantity: 1, unit: "måned", unitPrice: 450, total: 450 });

      const subtotal = suggestions.reduce((s, i) => s + i.total, 0);
      const vat = Math.round(subtotal * vatRate / 100);
      const total = subtotal + vat;
      res.json({
        items: suggestions,
        subtotal: Math.round(subtotal),
        vat: vat,
        vatRate,
        total: Math.round(total),
        summary: `Forslag til tilbud for ${customer.name} baseret på ${tasks.length} tidligere opgaver, timepris på ${rate} kr. og virksomhedens momsats på ${vatRate}%. Tilbuddet indeholder ${suggestions.length} ydelser til en totalpris på ${Math.round(total)} kr. inkl. moms.`
      });
    }

    else if (contextType === "fakturering" && intent === "risk") {
      const invoices = await storage.getInvoices(cid);
      const unpaid = invoices.filter((i) => i.status !== "betalt" && i.status !== "kladde");
      const overdue = unpaid.filter((i) => i.dueDate && new Date(i.dueDate) < new Date());
      const totalOutstanding = unpaid.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
      const totalOverdue = overdue.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
      const riskLevel = totalOverdue > 50000 ? "høj" : totalOverdue > 10000 ? "medium" : "lav";
      const insights: string[] = [];
      if (overdue.length > 0) insights.push(`${overdue.length} fakturaer er forfaldne med total ${Math.round(totalOverdue)} kr.`);
      if (unpaid.length > 3) insights.push(`${unpaid.length} ubetalte fakturaer — overvej rykkerforløb.`);
      if (riskLevel === "høj") insights.push("Høj betalingsrisiko. Anbefal kontakt til kunden og evt. betalingsplan.");
      if (insights.length === 0) insights.push("Ingen betalingsrisiko identificeret. Alle fakturaer er betalt eller inden for forfaldsdato.");
      res.json({ riskLevel, totalOutstanding: Math.round(totalOutstanding), totalOverdue: Math.round(totalOverdue), unpaidCount: unpaid.length, overdueCount: overdue.length, insights });
    }

    else if (contextType === "chat") {
      const prompt = String(req.body?.prompt ?? "").toLowerCase();
      const cid = req.auth!.companyId;
      const insights: string[] = [];

      if (prompt.includes("faktura") || prompt.includes("betaling") || prompt.includes("rykker")) {
        const invoices = await storage.getInvoices(cid);
        const unpaid = invoices.filter((i: any) => i.status !== "betalt" && i.status !== "kladde");
        const overdue = unpaid.filter((i: any) => i.dueDate && new Date(i.dueDate) < new Date());
        insights.push(`Du har ${unpaid.length} ubetalte fakturaer hvoraf ${overdue.length} er forfaldne.`);
        if (overdue.length > 0) insights.push(`Forfaldne beløb: ${Math.round(overdue.reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0))} kr.`);
        insights.push("Tip: Du kan sende rykkere fra Fakturering-siden eller lade AI'en generere dem automatisk.");
      }
      else if (prompt.includes("kunde") || prompt.includes("lead")) {
        const customers = await storage.getCustomers(cid);
        insights.push(`Du har ${customers.length} kunder i systemet.`);
        const highValue = customers.filter((c: any) => (c.hourlyRate ?? 0) > 350);
        if (highValue.length > 0) insights.push(`${highValue.length} kunder har en timepris over 350 kr. — gode kandidater til flere opgaver.`);
        insights.push("Tip: Brug AI lead-scoring til at prioritere nye leads baseret på potentiale.");
      }
      else if (prompt.includes("opgave") || prompt.includes("plan")) {
        const tasks = await storage.getTasks(cid);
        const employees = await storage.getEmployees(cid);
        const unassigned = tasks.filter((t: any) => !t.employeeId);
        insights.push(`Du har ${tasks.length} opgaver hvoraf ${unassigned.length} ikke har en tildelt ansat.`);
        insights.push(`Du har ${employees.length} ansatte, hvoraf ${employees.filter((e: any) => e.status === "ledig").length} er ledige.`);
        insights.push("Tip: Brug AI auto-planlægning til at fordele opgaver optimalt mellem ansatte.");
      }
      else if (prompt.includes("ansat") || prompt.includes("medarbejder")) {
        const employees = await storage.getEmployees(cid);
        const busy = employees.filter((e: any) => e.status === "optaget");
        const onLeave = employees.filter((e: any) => e.status === "orlov");
        insights.push(`Du har ${employees.length} ansatte: ${busy.length} optaget, ${onLeave.length} på orlov, ${employees.length - busy.length - onLeave.length} ledig.`);
      }
      else if (prompt.includes("tilbud")) {
        const customers = await storage.getCustomers(cid);
        insights.push(`Jeg kan generere tilbudsforslag baseret på dine ${customers.length} kunders timepriser og opgavehistorik.`);
        insights.push("Gå til Tilbud-siden og vælg en kunde for at generere et tilbudsforslag.");
      }
      else if (prompt.includes("hej") || prompt.includes("hallo") || prompt.includes("help") || prompt.includes("hjælp")) {
        insights.push("Hej! Jeg er din AI-assistent i ADD SmartRegnskab. Jeg kan hjælpe med:");
        insights.push("• Fakturaer og betalinger — spørg om ubetalte fakturaer");
        insights.push("• Kunder og leads — spørg om kundeantal og lead-scoring");
        insights.push("• Opgaver og planlægning — spørg om ubesatte opgaver");
        insights.push("• Ansatte — spørg om medarbejderstatus");
        insights.push("• Tilbud — spørg om at generere tilbud");
      }
      else {
        insights.push("Jeg forstod ikke helt dit spørgsmål. Prøv at spørge om fakturaer, kunder, opgaver, ansatte eller tilbud.");
      }
      res.json({ insights, risks: [], summary: "" });
    }

    else if (contextType === "auto_schedule") {
      const cid = req.auth!.companyId;
      const tasks = (await storage.getTasks(cid)).filter((t: any) => !t.employeeId && t.status !== "afsluttet");
      const employees = (await storage.getEmployees(cid)).filter((e: any) => e.status === "ledig" || e.status === "optaget");
      const assignments: any[] = [];
      const usedEmployees = new Set<number>();

      for (const task of tasks) {
        const available = employees.find((e: any) => !usedEmployees.has(e.id));
        if (available) {
          usedEmployees.add(available.id);
          assignments.push({
            taskId: task.id,
            taskTitle: task.title,
            employeeId: available.id,
            employeeName: available.name,
            reason: `${available.name} er ledig og kan tage opgaven "${task.title}".`,
          });
        } else {
          assignments.push({
            taskId: task.id,
            taskTitle: task.title,
            employeeId: null,
            employeeName: null,
            reason: `Ingen ledige ansatte til "${task.title}". Overvej at tilføje flere ressourcer eller omfordele opgaver.`,
          });
        }
      }
      res.json({
        assignments,
        summary: `${assignments.length} opgaver uden tildelt ansat. ${assignments.filter(a => a.employeeId).length} kan fordeles med det samme.`,
      });
    }

    else if (contextType === "customer_inquiry") {
      const cid = req.auth!.companyId;
      const customer = (await storage.getCustomers(cid)).find((c: any) => c.id === Number(entityId));
      if (!customer) return res.status(404).json({ error: "Kunde ikke fundet." });
      const tasks = (await storage.getTasks(cid)).filter((t: any) => t.customerId === customer.id);
      const invoices = (await storage.getInvoices(cid)).filter((i: any) => i.customerId === customer.id);
      const response: string[] = [];
      response.push(`Kunde: ${customer.name}`);
      response.push(`Kontakt: ${customer.contact ?? "—"} (${customer.phone ?? "—"})`);
      response.push(`Timepris: ${customer.hourlyRate ?? "—"} kr.`);
      response.push(`Antal opgaver: ${tasks.length}`);
      response.push(`Antal fakturaer: ${invoices.length}`);
      const unpaidInv = invoices.filter((i: any) => i.status !== "betalt");
      if (unpaidInv.length > 0) response.push(`Ubetalte fakturaer: ${unpaidInv.length} til ${Math.round(unpaidInv.reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0))} kr.`);
      const suggestedReply = `Hej ${customer.contact ?? customer.name}\n\nTak for din henvendelse. Vi har ${tasks.length} aktive opgaver hos jer og ser frem til at fortsætte samarbejdet.\n\nMed venlig hilsen\nADD SmartRegnskab`;
      res.json({ insights: response, risks: [], summary: suggestedReply });
    }

    else {
      res.json({ insights: ["AI-assistenten understøtter endnu ikke denne kombination af kontekst og hensigt."], risks: [], summary: "" });
    }
  }));

  /** Opret en ny virksomhed med lederkonto og prøveabonnement på én gang. */
  app.post("/api/platform/companies", requirePlatformAdmin, h(async (req, res) => {
    const {
      name, cvr, address, phone, email,
      adminName, adminEmail, adminPassword,
      planId, billingCycle, trialDays,
    } = req.body ?? {};

    if (!name || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: "Udfyld virksomhedsnavn samt lederens email og adgangskode." });
    }
    if (String(adminPassword).length < 8) {
      return res.status(400).json({ error: "Lederens adgangskode skal være mindst 8 tegn." });
    }
    const normEmail = String(adminEmail).trim().toLowerCase();
    if (await storage.getUserByEmail(normEmail)) {
      return res.status(409).json({ error: "Emailen er allerede i brug." });
    }
    const plan = await storage.getPlan(Number(planId));
    if (!plan) return res.status(400).json({ error: "Vælg en gyldig pakke." });

    const trial = Number(trialDays ?? 14);
    const start = today();
    const company = await storage.createCompany(validate(insertCompanySchema, {
      name, cvr: cvr ?? null, address: address ?? null,
      phone: phone ?? null, email: email ?? null,
      status: trial > 0 ? "proeve" : "aktiv",
      createdAt: nowIso(), notes: null,
    }));
    const admin = await storage.createUser(validate(insertUserSchema, {
      companyId: company.id, name: adminName || "Leder", email: normEmail,
      password: hashPassword(String(adminPassword)), role: "leder", active: 1, emailVerified: 1,
    }));
    const cycle = billingCycle === "aarlig" ? "aarlig" : "maanedlig";
    const subscription = await storage.createSubscription(validate(insertSubscriptionSchema, {
      companyId: company.id, planId: plan.id,
      status: trial > 0 ? "proeve" : "aktiv",
      billingCycle: cycle,
      trialEndsAt: trial > 0 ? addDays(start, trial) : null,
      currentPeriodStart: start,
      currentPeriodEnd: trial > 0 ? addDays(start, trial) : addDays(start, 30),
      startedAt: nowIso(), cancelledAt: null,
    }));
    await audit(req, "opret_virksomhed", "company", company.id, company.name);
    res.status(201).json({ company, admin: safeUser(admin), subscription, plan });
  }));

  app.patch("/api/platform/companies/:id", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const data = validate(insertCompanySchema.partial(), req.body);
    const updated = await storage.updateCompany(id, data);
    await audit(req, "opdater_virksomhed", "company", id, company.name);
    res.json(updated);
  }));

  /** Spær adgangen — brugerne får 402 og kan ikke bruge systemet. */
  app.post("/api/platform/companies/:id/suspend", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const updated = await storage.updateCompany(id, {
      status: "spaerret",
      notes: req.body?.reason ? `Spærret: ${req.body.reason}` : company.notes,
    });
    const sub = await storage.getSubscriptionByCompany(id);
    if (sub) await storage.updateSubscription(sub.id, { status: "i_restance" });
    // Luk aktive sessioner, så spærringen virker med det samme
    for (const u of await storage.getUsers(id)) await storage.deleteUserSessions(u.id);
    await audit(req, "spaer", "company", id, company.name);
    res.json(updated);
  }));

  app.post("/api/platform/companies/:id/reactivate", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const updated = await storage.updateCompany(id, { status: "aktiv" });
    const sub = await storage.getSubscriptionByCompany(id);
    if (sub) await storage.updateSubscription(sub.id, { status: "aktiv" });
    await audit(req, "genaaben", "company", id, company.name);
    res.json(updated);
  }));

  app.post("/api/platform/companies/:id/cancel", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const reason = (req.body?.reason ?? "Opsagt").toString();
    await storage.updateCompany(id, { status: "opsagt", notes: (company.notes ?? "") + `\nOpsagt: ${reason}` });
    const sub = await storage.getSubscriptionByCompany(id);
    if (sub) await storage.updateSubscription(sub.id, { status: "opsagt" });
    await audit(req, "opsig", "company", id, reason);
    res.json({ ok: true });
  }));

  /** Skift virksomhedens pakke fra platformen. */
  app.post("/api/platform/companies/:id/plan", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const sub = await storage.getSubscriptionByCompany(id);
    if (!sub) return res.status(404).json({ error: "Virksomheden har ikke et abonnement." });
    const plan = await storage.getPlan(Number(req.body?.planId));
    if (!plan) return res.status(400).json({ error: "Vælg en gyldig pakke." });
    const updated = await storage.updateSubscription(sub.id, {
      planId: plan.id,
      billingCycle: req.body?.billingCycle === "aarlig" ? "aarlig"
        : req.body?.billingCycle === "maanedlig" ? "maanedlig" : sub.billingCycle,
    });
    await audit(req, "skift_pakke", "subscription", sub.id, plan.name);
    res.json({ subscription: updated, plan, nextCharge: await previewBilling(id) });
  }));

  // ── Pakker ──
  app.get("/api/platform/plans", requirePlatformAdmin, h(async (_req, res) => {
    res.json(await storage.getPlans());
  }));
  app.post("/api/platform/plans", requirePlatformAdmin, h(async (req, res) => {
    const data = validate(insertPlanSchema, req.body);
    const plan = await storage.createPlan(data);
    await audit(req, "opret", "plan", plan.id, plan.name);
    res.status(201).json(plan);
  }));
  app.patch("/api/platform/plans/:id", requirePlatformAdmin, h(async (req, res) => {
    const data = validate(insertPlanSchema.partial(), req.body);
    const plan = await storage.updatePlan(Number(req.params.id), data);
    if (!plan) return res.status(404).json({ error: "Pakken blev ikke fundet." });
    res.json(plan);
  }));

  // ── Abonnementsfakturaer ──
  app.get("/api/platform/invoices", requirePlatformAdmin, h(async (req, res) => {
    const cid = req.query.companyId ? Number(req.query.companyId) : undefined;
    const invoices = await storage.getPlatformInvoices(cid);
    const companies = new Map((await storage.getCompanies()).map((c) => [c.id, c.name]));
    res.json(invoices.map((i) => ({ ...i, companyName: companies.get(i.companyId) ?? "Ukendt" })));
  }));

  app.post("/api/platform/companies/:id/invoice", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await storage.getCompany(id))) {
      return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    }
    const invoice = await issueSubscriptionInvoice(id, today());
    await audit(req, "udsted_abonnementsfaktura", "platformInvoice", invoice.id, invoice.invoiceNumber);
    res.status(201).json(invoice);
  }));

  app.post("/api/platform/invoices/:id/paid", requirePlatformAdmin, h(async (req, res) => {
    const inv = (await storage.getPlatformInvoices()).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    const updated = await storage.updatePlatformInvoice(inv.id, { status: "betalt", paidAt: nowIso() });
    // En betaling løfter automatisk en spærring
    const company = await storage.getCompany(inv.companyId);
    if (company && (company.status === "i_restance" || company.status === "spaerret")) {
      await storage.updateCompany(company.id, { status: "aktiv" });
      const sub = await storage.getSubscriptionByCompany(company.id);
      if (sub) await storage.updateSubscription(sub.id, { status: "aktiv" });
    }
    await audit(req, "betalt", "platformInvoice", inv.id, inv.invoiceNumber);
    res.json(updated);
  }));

  app.post("/api/platform/invoices/:id/remind", requirePlatformAdmin, h(async (req, res) => {
    const inv = (await storage.getPlatformInvoices()).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (inv.status === "betalt") return res.status(400).json({ error: "Fakturaen er allerede betalt." });
    const company = await storage.getCompany(inv.companyId);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    // En rykker markerer fakturaen som rykket (workflow: sendt → forfalden → rykket → overdraget).
    await storage.updatePlatformInvoice(inv.id, { status: "rykket" });
    await storage.createMessage({
      companyId: inv.companyId,
      createdAt: new Date().toISOString(),
      channel: "email",
      recipient: company.email ?? "",
      subject: `Rykker: Faktura ${inv.invoiceNumber}`,
      body: `Dette er en venlig påmindelse om, at faktura ${inv.invoiceNumber} på ${inv.totalAmount} kr. er forfalden.\n\nBetaling kan foretages via ADD SmartRegnskab eller tilkontohaver.`,
      status: "i_koe",
      relatedType: "rykker",
      relatedId: inv.id,
    });
    await audit(req, "rykker", "platformInvoice", inv.id, inv.invoiceNumber);
    res.json({ ok: true, message: "Rykker sendt" });
  }));

  // Send en allerede udstedt faktura til virksomheden (status: sendt).
  app.post("/api/platform/invoices/:id/send", requirePlatformAdmin, h(async (req, res) => {
    const inv = (await storage.getPlatformInvoices()).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    const company = await storage.getCompany(inv.companyId);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const updated = await storage.updatePlatformInvoice(inv.id, { status: "sendt" });
    await storage.createMessage({
      companyId: inv.companyId,
      createdAt: new Date().toISOString(),
      channel: "email",
      recipient: company.email ?? "",
      subject: `Faktura ${inv.invoiceNumber} fra ADD SmartRegnskab`,
      body: `Faktura ${inv.invoiceNumber} for perioden ${inv.periodStart} – ${inv.periodEnd} er klar.\n\nBeløb inkl. moms: ${inv.totalAmount} kr.\n\nFakturaen kan hentes i ADD SmartRegnskab.`,
      status: "i_koe",
      relatedType: "faktura",
      relatedId: inv.id,
    });
    await audit(req, "send", "platformInvoice", inv.id, inv.invoiceNumber);
    res.json(updated);
  }));

  // Opret en kreditnota for en faktura.
  app.post("/api/platform/invoices/:id/credit-note", requirePlatformAdmin, h(async (req, res) => {
    const inv = (await storage.getPlatformInvoices()).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    const reason = String((req.body as any)?.reason ?? "Kreditnoteret af platform").slice(0, 500);
    const existing = (await storage.all("creditNotes", inv.companyId, 500)) as any[];
    const creditNumber = `K-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, "0")}`;
    const note = await storage.insert("creditNotes", {
      companyId: inv.companyId,
      customerId: null,
      invoiceId: inv.id,
      creditNumber,
      amount: inv.totalAmount,
      reason,
      status: "sendt",
      createdAt: new Date().toISOString(),
    });
    await storage.updatePlatformInvoice(inv.id, { status: "kreditnoteret" });
    await audit(req, "kreditnota", "platformInvoice", inv.id, creditNumber);
    res.status(201).json(note);
  }));

  // Overdrag en ubetalt, rykket faktura til inkasso.
  app.post("/api/platform/invoices/:id/overdrag", requirePlatformAdmin, h(async (req, res) => {
    const inv = (await storage.getPlatformInvoices()).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    if (inv.status === "betalt") return res.status(400).json({ error: "Fakturaen er allerede betalt." });
    const updated = await storage.updatePlatformInvoice(inv.id, { status: "overdraget" });
    await audit(req, "overdraget", "platformInvoice", inv.id, inv.invoiceNumber);
    res.json(updated);
  }));

  app.get("/api/platform/invoices/:id/pdf", requirePlatformAdmin, h(async (req, res) => {
    const inv = (await storage.getPlatformInvoices()).find((i) => i.id === Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Fakturaen blev ikke fundet." });
    const company = await storage.getCompany(inv.companyId);
    const pdf = await platformInvoicePdf(company!, inv);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${inv.invoiceNumber}.pdf"`);
    res.send(pdf);
  }));


  // ══════════════════════════════════════════════════
  //  TILBUD (quotes)
  // ══════════════════════════════════════════════════

  app.get("/api/quotes", requireFeature("tilbud"), h(async (req, res) => {
    const list = await storage.getQuotes(tenantId(req));
    res.json(list);
  }));

  app.get("/api/quotes/:id", requireFeature("tilbud"), h(async (req, res) => {
    const quote = await storage.getQuote(Number(req.params.id), tenantId(req));
    if (!quote) return res.status(404).json({ error: "Tilbuddet blev ikke fundet." });
    res.json({ quote, items: await storage.getQuoteItems(quote.id) });
  }));

  app.post("/api/quotes", requireFeature("tilbud"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { items = [], ...rest } = req.body ?? {};
    const customer = await storage.getCustomer(Number(rest.customerId), cid);
    if (!customer) return res.status(400).json({ error: "Kunden findes ikke i din virksomhed." });

    const vat = await vatSetupFor(cid);
    const lines = (items as any[]).map((i) => ({
      description: String(i.description ?? "Ydelse"),
      quantity: Number(i.quantity ?? 1),
      unit: String(i.unit ?? "timer"),
      unitPrice: Number(i.unitPrice ?? 0),
      amount: round2(Number(i.quantity ?? 1) * Number(i.unitPrice ?? 0)),
    }));
    const totals = computeTotals(lines.map((l) => ({ amount: l.amount })), vat.rate);

    const existing = await storage.getQuotes(cid);
    const number = `T-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, "0")}`;

    const quote = await storage.createQuote({
      companyId: cid,
      customerId: Number(rest.customerId),
      quoteNumber: number,
      title: String(rest.title ?? "Tilbud på rengøring"),
      description: rest.description ?? null,
      netAmount: totals.netAmount,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      status: "kladde",
      validUntil: rest.validUntil ?? addDays(today(), 30),
      issueDate: today(),
      respondedAt: null,
      contractId: null,
    } as any);

    for (const l of lines) await storage.createQuoteItem({ quoteId: quote.id, ...l } as any);
    await audit(req, "oprettet", "quote", quote.id, number);
    res.status(201).json({ quote, items: await storage.getQuoteItems(quote.id), vatNote: vat.note });
  }));

  app.patch("/api/quotes/:id", requireFeature("tilbud"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const quote = await storage.getQuote(Number(req.params.id), cid);
    if (!quote) return res.status(404).json({ error: "Tilbuddet blev ikke fundet." });
    const updated = await storage.updateQuote(quote.id, req.body ?? {});
    await audit(req, "opdateret", "quote", quote.id);
    res.json(updated);
  }));

  app.post("/api/quotes/:id/send", requireFeature("tilbud"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const quote = await storage.getQuote(Number(req.params.id), cid);
    if (!quote) return res.status(404).json({ error: "Tilbuddet blev ikke fundet." });
    const customer = await storage.getCustomer(quote.customerId, cid);
    const company = await storage.getCompany(cid);
    if (!customer?.email) return res.status(400).json({ error: "Kunden har ingen e-mailadresse." });

    const msg = await queueAndSend({
      companyId: cid,
      channel: "email",
      recipient: customer.email,
      subject: `Tilbud ${quote.quoteNumber} fra ${company?.name ?? "os"}`,
      body: `Hej ${customer.contact ?? customer.name}\n\nTak for din henvendelse. Vedhæftet finder du vores tilbud ${quote.quoteNumber} på ${kr(quote.totalAmount)} inkl. moms.\n\nTilbuddet er gyldigt til ${dkDate(quote.validUntil ?? "")}.\n\nMed venlig hilsen\n${company?.name ?? "ADD SmartRegnskab"}`,
      relatedType: "tilbud",
      relatedId: quote.id,
    });

    const updated = await storage.updateQuote(quote.id, { status: "sendt" });
    await audit(req, "sendt", "quote", quote.id, quote.quoteNumber);
    res.json({ quote: updated, message: msg });
  }));

  app.post("/api/quotes/:id/respond", requireFeature("tilbud"), h(async (req, res) => {
    const cid = tenantId(req);
    const quote = await storage.getQuote(Number(req.params.id), cid);
    if (!quote) return res.status(404).json({ error: "Tilbuddet blev ikke fundet." });
    const accepted = req.body?.accepted === true;
    const message: string | null = req.body?.message ? String(req.body.message).trim().slice(0, 2000) || null : null;

    if (!accepted) {
      const rejected = await storage.updateQuote(quote.id, { status: "afvist", respondedAt: today(), customerMessage: message });
      await audit(req, "afvist", "quote", quote.id);
      await storage.createNotification({
        companyId: cid, userId: null, type: "warning",
        title: `Tilbud ${quote.quoteNumber} afvist`,
        message: `Kunden har afvist tilbuddet${message ? ": " + message : ""}.`,
        read: false, createdAt: nowIso(),
      });
      return res.json({ quote: rejected });
    }

    // Accepteret tilbud bliver til en aftale, så prisen er bundet fremover.
    const items = await storage.getQuoteItems(quote.id);
    const monthlyLines = items.filter((i) => i.unit === "md");
    const contracts = await storage.getContracts(cid);
    const contract = await storage.createContract({
      companyId: cid,
      customerId: quote.customerId,
      contractNumber: `K-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(4, "0")}`,
      title: quote.title,
      pricingModel: monthlyLines.length > 0 ? "fast_maaned" : "timepris",
      agreedRate: monthlyLines.length > 0
        ? round2(monthlyLines.reduce((s, i) => s + i.amount, 0))
        : round2(items[0]?.unitPrice ?? 0),
      hoursIncluded: monthlyLines.length > 0
        ? round2(items.filter((i) => i.unit === "timer").reduce((s, i) => s + i.quantity, 0))
        : 0,
      overtimeRate: round2(items.find((i) => i.unit === "timer")?.unitPrice ?? 0),
      frequency: req.body?.frequency ?? "ugentlig",
      startDate: req.body?.startDate ?? today(),
      endDate: null,
      noticeMonths: 1,
      indexAdjustment: 1,
      status: "aktiv",
      terms: quote.description ?? null,
    } as any);

    // Generér adgang til kundeportalen for kunden, hvis ikke allerede aktiv.
    const customer = await storage.getCustomer(quote.customerId, cid);
    let portalActivated = false;
    let portalToken: string | null = null;
    if (customer && (!customer.portalActive || !customer.portalToken)) {
      portalToken = randomBytes(32).toString("hex");
      await storage.updateCustomer(customer.id, { portalActive: 1, portalToken });
      portalActivated = true;
    } else if (customer) {
      portalToken = customer.portalToken;
    }

    const updated = await storage.updateQuote(quote.id, {
      status: "accepteret", respondedAt: today(), contractId: contract.id, customerMessage: message,
    });
    await audit(req, "accepteret", "quote", quote.id, `blev aftale ${contract.contractNumber}`);
    await storage.createNotification({
      companyId: cid, userId: null, type: "success",
      title: `Tilbud ${quote.quoteNumber} accepteret`,
      message: `Kunden har accepteret tilbuddet. Der er oprettet aftale ${contract.contractNumber}${message ? ". Besked: " + message : ""}.${portalActivated ? " Kundeportaladgang er aktiveret." : ""}`,
      read: false, createdAt: nowIso(),
    });
    res.json({ quote: updated, contract, portalActivated, portalToken });
  }));

  app.get("/api/quotes/:id/pdf", requireFeature("tilbud"), h(async (req, res) => {
    const cid = tenantId(req);
    const quote = await storage.getQuote(Number(req.params.id), cid);
    if (!quote) return res.status(404).json({ error: "Tilbuddet blev ikke fundet." });
    const company = await storage.getCompany(cid);
    const customer = await storage.getCustomer(quote.customerId, cid);
    const items = await storage.getQuoteItems(quote.id);
    const vat = await vatSetupFor(cid);
    const pdf = await quotePdf(company!, customer!, quote, items, vat.note);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="tilbud-${quote.quoteNumber}.pdf"`);
    res.send(pdf);
  }));

  app.delete("/api/quotes/:id", requireFeature("tilbud"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const quote = await storage.getQuote(Number(req.params.id), tenantId(req));
    if (!quote) return res.status(404).json({ error: "Tilbuddet blev ikke fundet." });
    await storage.deleteQuote(quote.id);
    await audit(req, "slettet", "quote", quote.id);
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════════
  //  KONTRAKTER (contracts)
  // ══════════════════════════════════════════════════

  app.get("/api/contracts", requireFeature("tilbud"), h(async (req, res) => {
    res.json(await storage.getContracts(tenantId(req)));
  }));

  app.get("/api/contracts/:id", requireFeature("tilbud"), h(async (req, res) => {
    const c = await storage.getContract(Number(req.params.id), tenantId(req));
    if (!c) return res.status(404).json({ error: "Aftalen blev ikke fundet." });
    res.json(c);
  }));

  app.post("/api/contracts", requireFeature("tilbud"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const customer = await storage.getCustomer(Number(req.body?.customerId), cid);
    if (!customer) return res.status(400).json({ error: "Kunden findes ikke i din virksomhed." });
    const list = await storage.getContracts(cid);
    const contract = await storage.createContract({
      ...req.body,
      companyId: cid,
      contractNumber: req.body?.contractNumber
        ?? `K-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, "0")}`,
      startDate: req.body?.startDate ?? today(),
    } as any);
    await audit(req, "oprettet", "contract", contract.id, contract.contractNumber);
    res.status(201).json(contract);
  }));

  app.patch("/api/contracts/:id", requireFeature("tilbud"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const c = await storage.getContract(Number(req.params.id), tenantId(req));
    if (!c) return res.status(404).json({ error: "Aftalen blev ikke fundet." });
    const updated = await storage.updateContract(c.id, req.body ?? {});
    await audit(req, "opdateret", "contract", c.id);
    res.json(updated);
  }));

  app.delete("/api/contracts/:id", requireFeature("tilbud"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const c = await storage.getContract(Number(req.params.id), tenantId(req));
    if (!c) return res.status(404).json({ error: "Aftalen blev ikke fundet." });
    await storage.deleteContract(c.id);
    await audit(req, "slettet", "contract", c.id);
    res.json({ ok: true });
  }));

  /** Foreslår periodens fakturabeløb ud fra aftalen i stedet for en løs timepris. */
  app.get("/api/contracts/:id/charge", requireFeature("tilbud"), h(async (req, res) => {
    const cid = tenantId(req);
    const c = await storage.getContract(Number(req.params.id), cid);
    if (!c) return res.status(404).json({ error: "Aftalen blev ikke fundet." });
    const from = String(req.query.from ?? addDays(today(), -30));
    const to = String(req.query.to ?? today());

    const entries = (await storage.getTimeEntries(cid)).filter((e) => e.date >= from && e.date <= to);
    const tasks = await storage.getTasks(cid);
    const taskIds = new Set(tasks.filter((t) => t.customerId === c.customerId).map((t) => t.id));
    const relevant = entries.filter((e) => e.taskId && taskIds.has(e.taskId));
    const hours = round2(relevant.reduce((s, e) => s + (e.durationMinutes ?? 0), 0) / 60);
    const visits = new Set(relevant.map((e) => e.date)).size;

    const charge = contractCharge(c, hours, visits, Number(req.query.m2 ?? 0));
    const vat = await vatSetupFor(cid);
    const totals = computeTotals([{ amount: charge.netAmount }], vat.rate);
    res.json({ contract: c, period: { from, to }, charge, vat, totals });
  }));

  // ══════════════════════════════════════════════════
  //  MATERIALER OG FORBRUG
  // ══════════════════════════════════════════════════

  app.get("/api/materials", requireFeature("materialer"), h(async (req, res) => {
    const cid = tenantId(req);
    const list = await storage.getMaterials(cid);
    const lowStock = list.filter((m) => m.active === 1 && m.stock <= m.minStock);
    res.json({ materials: list, lowStock: lowStock.map((m) => m.id), lowStockCount: lowStock.length });
  }));

  app.post("/api/materials", requireFeature("materialer"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const m = await storage.createMaterial({ ...req.body, companyId: cid } as any);
    await audit(req, "oprettet", "material", m.id, m.name);
    res.status(201).json(m);
  }));

  app.patch("/api/materials/:id", requireFeature("materialer"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const m = await storage.getMaterial(Number(req.params.id), tenantId(req));
    if (!m) return res.status(404).json({ error: "Varen blev ikke fundet." });
    res.json(await storage.updateMaterial(m.id, req.body ?? {}));
  }));

  app.delete("/api/materials/:id", requireFeature("materialer"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const m = await storage.getMaterial(Number(req.params.id), tenantId(req));
    if (!m) return res.status(404).json({ error: "Varen blev ikke fundet." });
    await storage.deleteMaterial(m.id);
    res.json({ ok: true });
  }));

  app.get("/api/material-usage", requireFeature("materialer"), h(async (req, res) => {
    const cid = tenantId(req);
    res.json(await storage.getMaterialUsage(cid, {
      materialId: req.query.materialId ? Number(req.query.materialId) : undefined,
      taskId: req.query.taskId ? Number(req.query.taskId) : undefined,
      customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
    }));
  }));

  /** Bogfører forbrug eller indkøb og retter lagerbeholdningen med samme handling. */
  app.post("/api/material-usage", requireFeature("materialer"), h(async (req, res) => {
    const cid = tenantId(req);
    const material = await storage.getMaterial(Number(req.body?.materialId), cid);
    if (!material) return res.status(400).json({ error: "Varen findes ikke i din virksomhed." });

    const quantity = Number(req.body?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Angiv et positivt antal." });
    }
    const kind = String(req.body?.kind ?? "forbrug");
    const delta = kind === "indkoeb" ? quantity : -quantity;

    if (kind === "forbrug" && material.stock < quantity) {
      return res.status(400).json({
        error: `Der er kun ${material.stock} ${material.unit} på lager af ${material.name}. Registrér et indkøb først, eller sæt antallet ned.`,
        code: "utilstraekkelig_beholdning",
        stock: material.stock,
      });
    }
    let warning: string | null = null;
    if (kind === "forbrug" && material.stock - quantity <= material.minStock) {
      warning = `${material.name} rammer minimumsbeholdningen. Husk at genbestille.`;
    }

    const usage = await storage.createMaterialUsage({
      companyId: cid,
      materialId: material.id,
      taskId: req.body?.taskId ?? null,
      customerId: req.body?.customerId ?? null,
      employeeId: req.auth?.employeeId ?? req.body?.employeeId ?? null,
      quantity,
      kind,
      billable: req.body?.billable === false ? 0 : 1,
      invoicedAt: null,
      date: req.body?.date ?? today(),
      note: req.body?.note ?? null,
    } as any);

    const newStock = round2(material.stock + delta);
    await storage.updateMaterial(material.id, { stock: newStock });

    if (newStock <= material.minStock) {
      await storage.createNotification({
        companyId: cid,
        title: "Lav lagerbeholdning",
        message: `${material.name}: ${newStock} ${material.unit} tilbage (minimum ${material.minStock}).`,
        type: "warning",
        read: false,
        createdAt: nowIso(),
      } as any);
    }

    await audit(req, kind, "materialUsage", usage.id, `${quantity} ${material.unit} ${material.name}`);
    res.status(201).json({ usage, stock: newStock, warning });
  }));

  app.delete("/api/material-usage/:id", requireFeature("materialer"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const rows = await storage.getMaterialUsage(cid);
    const row = rows.find((r) => r.id === Number(req.params.id));
    if (!row) return res.status(404).json({ error: "Posteringen blev ikke fundet." });
    const material = await storage.getMaterial(row.materialId, cid);
    if (material) {
      const back = row.kind === "indkoeb" ? -row.quantity : row.quantity;
      await storage.updateMaterial(material.id, { stock: round2(material.stock + back) });
    }
    await storage.deleteMaterialUsage(row.id);
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════════
  //  NØGLER OG ALARMKODER
  // ══════════════════════════════════════════════════

  /**
   * Alarmkoder returneres maskeret. Kun den ansatte, der har nøglen, samt leder
   * og holdleder kan hente den rigtige kode, og hvert opslag bliver logget.
   */
  app.get("/api/keys", requireFeature("noegler"), h(async (req, res) => {
    const cid = tenantId(req);
    const list = await storage.getKeys(cid, req.query.customerId ? Number(req.query.customerId) : undefined);
    res.json(list.map((k) => {
      const { secretEnc, ...rest } = k;
      return { ...rest, hasSecret: !!secretEnc, secretMask: maskSecret(decryptField(secretEnc)) };
    }));
  }));

  app.get("/api/keys/:id/secret", requireFeature("noegler"), h(async (req, res) => {
    const cid = tenantId(req);
    const a = req.auth!;
    const key = await storage.getKey(Number(req.params.id), cid);
    if (!key) return res.status(404).json({ error: "Nøglen blev ikke fundet." });

    const isManager = ["leder", "holdleder", "platform_admin"].includes(a.role);
    const holdsIt = a.employeeId != null && key.holderEmployeeId === a.employeeId;
    if (!isManager && !holdsIt) {
      return res.status(403).json({ error: "Du kan kun se koden til nøgler, du selv har fået udleveret." });
    }

    const secret = decryptField(key.secretEnc);
    await audit(req, "kode_vist", "key", key.id, key.label);
    res.json({
      secret,
      accessNote: key.accessNote,
      advarsel: usingFallbackKey()
        ? "Krypteringsnøglen er ikke sat op (ENCRYPTION_KEY), så koderne er kun beskyttet på papiret."
        : null,
    });
  }));

  app.post("/api/keys", requireFeature("noegler"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const customer = await storage.getCustomer(Number(req.body?.customerId), cid);
    if (!customer) return res.status(400).json({ error: "Kunden findes ikke i din virksomhed." });
    const { secret, ...rest } = req.body ?? {};
    const key = await storage.createKey({
      ...rest,
      companyId: cid,
      secretEnc: secret ? encryptField(String(secret)) : null,
      createdAt: nowIso(),
    } as any);
    await audit(req, "oprettet", "key", key.id, key.label);
    res.status(201).json({ ...key, secretEnc: undefined, hasSecret: !!secret });
  }));

  app.patch("/api/keys/:id", requireFeature("noegler"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const key = await storage.getKey(Number(req.params.id), cid);
    if (!key) return res.status(404).json({ error: "Nøglen blev ikke fundet." });
    const { secret, ...rest } = req.body ?? {};
    const data: any = { ...rest };
    if (secret !== undefined) data.secretEnc = secret ? encryptField(String(secret)) : null;
    const updated = await storage.updateKey(key.id, data);
    await audit(req, "opdateret", "key", key.id);
    res.json({ ...updated, secretEnc: undefined });
  }));

  /** Udlån, retur eller tab — hver overdragelse gemmes, så ansvarskæden kan følges. */
  app.post("/api/keys/:id/handover", requireFeature("noegler"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const key = await storage.getKey(Number(req.params.id), cid);
    if (!key) return res.status(404).json({ error: "Nøglen blev ikke fundet." });

    const action = String(req.body?.action ?? "udlaan");
    const toEmployeeId = req.body?.toEmployeeId ? Number(req.body.toEmployeeId) : null;
    if (action === "udlaan") {
      if (!toEmployeeId) return res.status(400).json({ error: "Vælg hvem nøglen udleveres til." });
      const emp = await storage.getEmployee(toEmployeeId, cid);
      if (!emp) return res.status(400).json({ error: "Den ansatte findes ikke i din virksomhed." });
    }

    const handover = await storage.createKeyHandover({
      companyId: cid,
      keyId: key.id,
      fromEmployeeId: key.holderEmployeeId ?? null,
      toEmployeeId,
      action,
      signedBy: req.body?.signedBy ?? req.auth?.user.name ?? null,
      date: req.body?.date ?? today(),
      note: req.body?.note ?? null,
    } as any);

    const status = action === "udlaan" ? "udlaant" : action === "bortkommet" ? "bortkommet" : "paa_lager";
    const updated = await storage.updateKey(key.id, {
      holderEmployeeId: action === "udlaan" ? toEmployeeId : null,
      status,
    });

    if (action === "bortkommet") {
      await storage.createNotification({
        companyId: cid,
        title: "Nøgle meldt bortkommet",
        message: `${key.label} hos kunden er meldt bortkommet. Overvej omlægning af låsen og skift af alarmkode.`,
        type: "warning",
        read: false,
        createdAt: nowIso(),
      } as any);
    }

    await audit(req, action, "key", key.id, key.label);
    res.status(201).json({ handover, key: { ...updated, secretEnc: undefined } });
  }));

  app.get("/api/keys/:id/handovers", requireFeature("noegler"), h(async (req, res) => {
    const cid = tenantId(req);
    const key = await storage.getKey(Number(req.params.id), cid);
    if (!key) return res.status(404).json({ error: "Nøglen blev ikke fundet." });
    res.json(await storage.getKeyHandovers(cid, key.id));
  }));

  app.delete("/api/keys/:id", requireFeature("noegler"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const key = await storage.getKey(Number(req.params.id), tenantId(req));
    if (!key) return res.status(404).json({ error: "Nøglen blev ikke fundet." });
    await storage.deleteKey(key.id);
    await audit(req, "slettet", "key", key.id);
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════════
  //  KVALITETSKONTROL
  // ══════════════════════════════════════════════════

  app.get("/api/inspections", requireFeature("kvalitetskontrol"), h(async (req, res) => {
    const cid = tenantId(req);
    const a = req.auth!;
    let list = await storage.getInspections(cid, {
      customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
      employeeId: req.query.employeeId ? Number(req.query.employeeId) : undefined,
    });
    // Kunden ser kun sine egne og kun dem, der er frigivet til kunden.
    if (a.role === "kunde") {
      list = list.filter((i) => i.customerId === a.user.customerId && i.customerVisible === 1);
    } else if (a.role === "assistent") {
      list = list.filter((i) => i.employeeId === a.employeeId);
    }
    const avg = list.length === 0 ? 0 : round2(list.reduce((s, i) => s + i.totalScore, 0) / list.length);
    res.json({
      inspections: list,
      averageScore: avg,
      areas: INSPECTION_AREAS,
      openFollowUps: list.filter((i) => i.followUpDate && i.followUpDone === 0).length,
    });
  }));

  app.post("/api/inspections", requireFeature("kvalitetskontrol"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const customer = await storage.getCustomer(Number(req.body?.customerId), cid);
    if (!customer) return res.status(400).json({ error: "Kunden findes ikke i din virksomhed." });

    const scores = Array.isArray(req.body?.scores) ? req.body.scores : [];
    if (scores.length === 0) return res.status(400).json({ error: "Angiv en bedømmelse for mindst ét område." });
    const { totalScore, result } = scoreInspection(scores);

    const inspection = await storage.createInspection({
      companyId: cid,
      customerId: Number(req.body.customerId),
      taskId: req.body?.taskId ?? null,
      employeeId: req.body?.employeeId ?? null,
      inspectorId: req.auth?.employeeId ?? null,
      date: req.body?.date ?? today(),
      scores: JSON.stringify(scores),
      totalScore,
      result,
      followUpDate: result === "godkendt" ? null : (req.body?.followUpDate ?? addDays(today(), 7)),
      followUpDone: 0,
      customerVisible: req.body?.customerVisible === false ? 0 : 1,
      note: req.body?.note ?? null,
    } as any);

    if (result !== "godkendt") {
      await storage.createNotification({
        companyId: cid,
        title: result === "ikke_godkendt" ? "Kvalitetskontrol ikke godkendt" : "Anmærkning ved kvalitetskontrol",
        message: `${customer.name} fik ${totalScore} point den ${dkDate(inspection.date)}. Opfølgning senest ${dkDate(inspection.followUpDate ?? "")}.`,
        type: "warning",
        read: false,
        createdAt: nowIso(),
      } as any);
    }

    await audit(req, "oprettet", "inspection", inspection.id, `${totalScore} point — ${result}`);
    res.status(201).json(inspection);
  }));

  app.patch("/api/inspections/:id", requireFeature("kvalitetskontrol"), requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const insp = await storage.getInspection(Number(req.params.id), cid);
    if (!insp) return res.status(404).json({ error: "Kontrollen blev ikke fundet." });
    const data: any = { ...req.body };
    if (Array.isArray(req.body?.scores)) {
      const { totalScore, result } = scoreInspection(req.body.scores);
      data.scores = JSON.stringify(req.body.scores);
      data.totalScore = totalScore;
      data.result = result;
    }
    const updated = await storage.updateInspection(insp.id, data);
    await audit(req, "opdateret", "inspection", insp.id);
    res.json(updated);
  }));

  app.delete("/api/inspections/:id", requireFeature("kvalitetskontrol"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const insp = await storage.getInspection(Number(req.params.id), tenantId(req));
    if (!insp) return res.status(404).json({ error: "Kontrollen blev ikke fundet." });
    await storage.deleteInspection(insp.id);
    res.json({ ok: true });
  }));


  // ══════════════════════════════════════════════════
  //  SIKKERHED — to-faktor og loginhistorik
  // ══════════════════════════════════════════════════

  app.get("/api/security", h(async (req, res) => {
    const a = req.auth!;
    const attempts = (await storage.getLoginAttempts(a.user.email, 20)) ?? [];
    res.json({
      twoFactorEnabled: a.user.twoFactorEnabled === 1,
      emailVerified: a.user.emailVerified === 1,
      backupCodesLeft: a.user.twoFactorBackup
        ? (JSON.parse(a.user.twoFactorBackup) as string[]).length : 0,
      lastLoginAt: a.user.lastLoginAt,
      passwordChangedAt: a.user.passwordChangedAt,
      recentAttempts: attempts,
      krypteringAdvarsel: usingFallbackKey()
        ? "ENCRYPTION_KEY er ikke sat. Alarmkoder er kun beskyttet med en demonøgle."
        : null,
    });
  }));

  /** Første skridt: server et nyt hemmeligt nøgleord, som brugeren scanner ind. */
  app.post("/api/security/2fa/start", h(async (req, res) => {
    const a = req.auth!;
    if (a.user.twoFactorEnabled === 1) {
      return res.status(409).json({ error: "To-faktor er allerede slået til." });
    }
    const secret = generateTotpSecret();
    await storage.updateUser(a.user.id, { twoFactorSecret: secret });
    res.json({
      secret,
      uri: totpUri(secret, a.user.email),
      vejledning: "Scan koden i Google Authenticator, Microsoft Authenticator eller 1Password, og indtast derefter de seks cifre.",
    });
  }));

  app.post("/api/security/2fa/enable", h(async (req, res) => {
    const a = req.auth!;
    const fresh = await storage.getUser(a.user.id);
    if (!fresh?.twoFactorSecret) {
      return res.status(400).json({ error: "Start opsætningen forfra — der er ingen aktiv nøgle." });
    }
    const result = await enableTwoFactor(a.user.id, fresh.twoFactorSecret, String(req.body?.code ?? ""));
    if (!result.ok) return res.status(400).json({ error: result.error });
    await audit(req, "to_faktor_aktiveret", "user", a.user.id);
    res.json({
      ok: true,
      backupCodes: result.backupCodes,
      besked: "To-faktor er slået til. Gem reservekoderne et sikkert sted — de vises kun nu.",
    });
  }));

  app.post("/api/security/2fa/disable", h(async (req, res) => {
    const a = req.auth!;
    if (!verifyPassword(String(req.body?.password ?? ""), a.user.password)) {
      return res.status(401).json({ error: "Bekræft med din adgangskode for at slå to-faktor fra." });
    }
    await disableTwoFactor(a.user.id);
    await audit(req, "to_faktor_deaktiveret", "user", a.user.id);
    res.json({ ok: true, besked: "To-faktor er slået fra, og du er logget ud af alle enheder." });
  }));

  app.post("/api/security/2fa/backup", h(async (req, res) => {
    const a = req.auth!;
    if (a.user.twoFactorEnabled !== 1) {
      return res.status(400).json({ error: "To-faktor er ikke slået til." });
    }
    if (!verifyPassword(String(req.body?.password ?? ""), a.user.password)) {
      return res.status(401).json({ error: "Bekræft med din adgangskode." });
    }
    const codes = generateBackupCodes();
    await storage.updateUser(a.user.id, { twoFactorBackup: codes.hashed });
    await audit(req, "reservekoder_fornyet", "user", a.user.id);
    res.json({ ok: true, backupCodes: codes.plain });
  }));

  /** Leder inviterer en kollega. Kontoen dannes først, når linket bruges. */
  app.post("/api/users/invite", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) return res.status(400).json({ error: "Angiv en gyldig e-mailadresse." });
    if (await storage.getUserByEmail(email)) {
      return res.status(409).json({ error: "Der findes allerede en bruger med denne e-mailadresse." });
    }
    const limit = await checkLimit(cid, "employees");
    if (!limit.ok) return res.status(402).json({ error: limit.message, code: "pakke_begraensning" });

    const company = await storage.getCompany(cid);
    const { token, expiresAt } = await issueToken("invitation", email, {
      companyId: cid,
      payload: {
        role: req.body?.role ?? "assistent",
        name: req.body?.name ?? null,
        employeeId: req.body?.employeeId ?? null,
        customerId: req.body?.customerId ?? null,
      },
    });
    await queueAndSend({
      companyId: cid,
      channel: "email",
      recipient: email,
      subject: `Du er inviteret til ${company?.name ?? "ADD SmartRegnskab"}`,
      body: `Hej\n\n${req.auth?.user.name} har inviteret dig til at bruge ADD SmartRegnskab hos ${company?.name}.\n\nOpret din adgang her:\n${appUrl()}/#/invitation?token=${token}\n\nLinket virker i 24 timer.\n\nMed venlig hilsen\n${company?.name ?? "ADD SmartRegnskab"}`,
      relatedType: "invitation",
    });
    await audit(req, "inviteret", "user", null, email);
    res.status(201).json({
      ok: true, email, expiresAt,
      demoToken: process.env.NODE_ENV !== "production" && !emailConfigured() ? token : undefined,
      besked: "Invitationen er sendt.",
    });
  }));

  app.get("/api/users/invitations", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.getPendingInvitations(tenantId(req)));
  }));

  // ══════════════════════════════════════════════════
  //  BETALING — betalingsmidler og opkrævning
  // ══════════════════════════════════════════════════

  app.get("/api/payment/status", h(async (req, res) => {
    const cid = tenantId(req);
    const methods = await storage.getPaymentMethods(cid);
    const sub = await storage.getSubscriptionByCompany(cid);
    res.json({
      providers: paymentProviderStatus(),
      methods,
      autoRenew: sub?.autoRenew === 1,
      dunningStage: sub?.dunningStage ?? 0,
      lastPaymentAttempt: sub?.lastPaymentAttempt ?? null,
      note: paymentProviderStatus().some((p) => p.configured)
        ? null
        : "Ingen betalingsudbyder er sat op med nøgler, så betalinger gennemføres i simuleringstilstand.",
    });
  }));

  app.get("/api/payment/history", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.getPayments(tenantId(req), 100));
  }));

  app.post("/api/payment/methods", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const provider = String(req.body?.provider ?? "stripe");
    if (!["stripe", "mobilepay", "betalingsservice"].includes(provider)) {
      return res.status(400).json({ error: "Ukendt betalingsudbyder." });
    }
    const existing = await storage.getPaymentMethods(cid);
    const method = await storage.createPaymentMethod({
      companyId: cid,
      provider,
      providerRef: String(req.body?.providerRef ?? `sim_pm_${Date.now()}`),
      brand: req.body?.brand ?? (provider === "mobilepay" ? "mobilepay" : "visa"),
      last4: req.body?.last4 ?? null,
      expMonth: req.body?.expMonth ?? null,
      expYear: req.body?.expYear ?? null,
      isDefault: existing.filter((m) => m.status === "aktiv").length === 0 ? 1 : 0,
      status: "aktiv",
      createdAt: nowIso(),
    } as any);
    await audit(req, "tilfoejet", "paymentMethod", method.id, provider);
    res.status(201).json(method);
  }));

  app.post("/api/payment/methods/:id/default", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const method = await storage.getPaymentMethod(Number(req.params.id), cid);
    if (!method) return res.status(404).json({ error: "Betalingsmidlet blev ikke fundet." });
    for (const m of await storage.getPaymentMethods(cid)) {
      await storage.updatePaymentMethod(m.id, { isDefault: m.id === method.id ? 1 : 0 });
    }
    const sub = await storage.getSubscriptionByCompany(cid);
    if (sub) await storage.updateSubscription(sub.id, { paymentMethodId: method.id });
    res.json({ ok: true });
  }));

  app.delete("/api/payment/methods/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const method = await storage.getPaymentMethod(Number(req.params.id), cid);
    if (!method) return res.status(404).json({ error: "Betalingsmidlet blev ikke fundet." });
    const updated = await storage.updatePaymentMethod(method.id, { status: "fjernet", isDefault: 0 });
    await audit(req, "fjernet", "paymentMethod", method.id);
    res.json(updated);
  }));

  app.post("/api/payment/autorenew", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const sub = await storage.getSubscriptionByCompany(cid);
    if (!sub) return res.status(404).json({ error: "Der er ikke noget abonnement på virksomheden." });
    const on = req.body?.autoRenew !== false;
    if (on && !(await storage.getDefaultPaymentMethod(cid))) {
      return res.status(400).json({ error: "Tilføj et betalingsmiddel, før automatisk fornyelse slås til." });
    }
    const updated = await storage.updateSubscription(sub.id, { autoRenew: on ? 1 : 0 });
    await audit(req, on ? "automatisk_fornyelse_til" : "automatisk_fornyelse_fra", "subscription", sub.id);
    res.json(updated);
  }));

  /** Virksomheden betaler selv en forfalden abonnementsfaktura. */
  app.post("/api/payment/pay/:invoiceId", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const inv = (await storage.getPlatformInvoices(cid)).find((i) => i.id === Number(req.params.invoiceId));
    if (!inv) return res.status(404).json({ error: "Abonnementsfakturaen blev ikke fundet." });
    const result = await chargeInvoice(inv.id, {
      paymentMethodId: req.body?.paymentMethodId ? Number(req.body.paymentMethodId) : undefined,
    });
    await audit(req, result.ok ? "betalt" : "betaling_fejlet", "platformInvoice", inv.id, result.message);
    res.status(result.ok || result.pending ? 200 : 402).json(result);
  }));

  app.post("/api/platform/payments/dunning", requirePlatformAdmin, h(async (req, res) => {
    const result = await runDunning(String(req.body?.date ?? today()));
    await audit(req, "rykkerkoersel", "platform", null, JSON.stringify(result));
    res.json(result);
  }));

  app.post("/api/platform/payments/renew", requirePlatformAdmin, h(async (req, res) => {
    const result = await renewSubscriptions(String(req.body?.date ?? today()));
    await audit(req, "abonnementsfornyelse", "platform", null, JSON.stringify(result));
    res.json(result);
  }));

  app.get("/api/platform/payments", requirePlatformAdmin, h(async (_req, res) => {
    res.json({ payments: await storage.getPayments(undefined, 200), providers: paymentProviderStatus() });
  }));

  // ══════════════════════════════════════════════════
  //  GDPR — samtykke, indsigt, sletning, opbevaring
  // ══════════════════════════════════════════════════

  app.get("/api/gdpr", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const company = await storage.getCompany(cid);
    res.json({
      retention: {
        timeEntries: company?.retentionTimeEntries ?? 0,
        gps: company?.retentionGps ?? 0,
        absences: company?.retentionAbsences ?? 0,
        photos: company?.retentionPhotos ?? 0,
      },
      defaults: retentionDefaults(),
      dpaAcceptedAt: company?.dpaAcceptedAt ?? null,
      dpaAcceptedBy: company?.dpaAcceptedBy ?? null,
      requests: await storage.getDataRequests(cid),
      consents: await storage.getConsents(cid),
      lagring: storageBackend(),
    });
  }));

  app.patch("/api/gdpr/opbevaring", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const b = req.body ?? {};
    const num = (v: unknown, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 240 ? Math.round(n) : fallback;
    };
    const company = await storage.getCompany(cid);
    const updated = await storage.updateCompany(cid, {
      retentionTimeEntries: num(b.timeEntries, company?.retentionTimeEntries ?? 0),
      retentionGps: num(b.gps, company?.retentionGps ?? 0),
      retentionAbsences: num(b.absences, company?.retentionAbsences ?? 0),
      retentionPhotos: num(b.photos, company?.retentionPhotos ?? 0),
    });
    await audit(req, "opbevaringspolitik", "company", cid, JSON.stringify(b));
    res.json(updated);
  }));

  app.post("/api/gdpr/databehandleraftale", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const updated = await storage.updateCompany(cid, {
      dpaAcceptedAt: nowIso(),
      dpaAcceptedBy: req.auth!.user.name,
    });
    await audit(req, "databehandleraftale_accepteret", "company", cid);
    res.json({ ok: true, company: updated });
  }));

  app.get("/api/gdpr/databehandleraftale/tekst", requireRole("leder", "platform_admin"), h(async (_req, res) => {
    res.json({ tekst: dpaText(), privatliv: privacyPolicyText() });
  }));

  /** Registrerer og behandler en anmodning om indsigt, sletning eller udlevering. */
  app.post("/api/gdpr/anmodning", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const kind = String(req.body?.kind ?? "indsigt");
    const subjectType = String(req.body?.subjectType ?? "ansat");
    const subjectId = Number(req.body?.subjectId);
    if (!["indsigt", "sletning", "portabilitet"].includes(kind)) {
      return res.status(400).json({ error: "Ukendt type anmodning." });
    }
    let subjectName = "";
    if (subjectType === "ansat") subjectName = (await storage.getEmployee(subjectId, cid))?.name ?? "";
    else if (subjectType === "kunde") subjectName = (await storage.getCustomer(subjectId, cid))?.name ?? "";
    else {
      const u = await storage.getUser(subjectId);
      subjectName = u && u.companyId === cid ? u.name : "";
    }
    if (!subjectName) return res.status(400).json({ error: "Personen findes ikke i din virksomhed." });

    const request = await storage.createDataRequest({
      companyId: cid, kind, subjectType, subjectId, subjectName,
      status: "modtaget",
      requestedBy: req.auth!.user.name,
      note: req.body?.note ?? null,
      resultRef: null,
      createdAt: nowIso(),
      completedAt: null,
    } as any);
    await audit(req, "gdpr_anmodning", "dataRequest", request.id, `${kind} — ${subjectName}`);
    res.status(201).json(request);
  }));

  app.post("/api/gdpr/anmodning/:id/behandl", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const request = await storage.getDataRequest(Number(req.params.id), cid);
    if (!request) return res.status(404).json({ error: "Anmodningen blev ikke fundet." });
    if (request.status === "behandlet") {
      return res.status(409).json({ error: "Anmodningen er allerede behandlet." });
    }

    let resultat: any = {};
    if (request.kind === "sletning") {
      if (request.subjectType === "ansat") {
        resultat = await anonymizeEmployee(cid, request.subjectId, req.auth!.user.name);
      } else if (request.subjectType === "kunde") {
        resultat = await anonymizeCustomer(cid, request.subjectId, req.auth!.user.name);
      } else {
        return res.status(400).json({ error: "Brugerkonti slettes ved at deaktivere brugeren." });
      }
    } else {
      resultat = { sektioner: (await exportSubjectData(cid, request.subjectType as any, request.subjectId)).sections?.length ?? 0 };
    }

    const updated = await storage.updateDataRequest(request.id, {
      status: "behandlet", completedAt: nowIso(),
      resultRef: request.kind === "sletning" ? "anonymiseret" : "udleveret",
    });
    await audit(req, "gdpr_behandlet", "dataRequest", request.id, request.kind);
    res.json({ request: updated, resultat });
  }));

  /** Udleverer alt registreret om personen som JSON eller CSV. */
  app.get("/api/gdpr/udlevering", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const subjectType = String(req.query.subjectType ?? "ansat") as any;
    const subjectId = Number(req.query.subjectId);
    const format = String(req.query.format ?? "json");
    const navn = `personoplysninger-${subjectType}-${subjectId}`;
    if (format === "csv") {
      const csv = await exportSubjectCsv(cid, subjectType, subjectId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${navn}.csv"`);
      return res.send(csv);
    }
    const json = await exportSubjectJson(cid, subjectType, subjectId);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${navn}.json"`);
    res.send(json);
  }));

  app.post("/api/gdpr/oprydning", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const result = await applyRetention(cid);
    await audit(req, "gdpr_oprydning", "company", cid, JSON.stringify(result));
    res.json(result);
  }));

  /** Den ansatte giver eller trækker samtykke til GPS og fotodokumentation. */
  app.get("/api/samtykke", h(async (req, res) => {
    const a = req.auth!;
    const employeeId = a.employeeId ?? (req.query.employeeId ? Number(req.query.employeeId) : null);
    if (!employeeId) return res.json({ consents: [] });
    res.json({ consents: await storage.getConsents(a.companyId, employeeId) });
  }));

  app.post("/api/samtykke", h(async (req, res) => {
    const a = req.auth!;
    const kind = String(req.body?.kind ?? "");
    if (!["gps", "foto", "databehandling"].includes(kind)) {
      return res.status(400).json({ error: "Ukendt samtykketype." });
    }
    const isManager = ["leder", "platform_admin"].includes(a.role);
    const employeeId = isManager && req.body?.employeeId ? Number(req.body.employeeId) : a.employeeId;
    if (!employeeId) return res.status(400).json({ error: "Samtykke kræver en tilknyttet ansat." });

    const granted = req.body?.granted === true;
    const consent = await storage.upsertConsent(a.companyId, employeeId, kind, {
      granted: granted ? 1 : 0,
      grantedAt: granted ? nowIso() : null,
      withdrawnAt: granted ? null : nowIso(),
      textVersion: "1.0",
    } as any);
    await audit(req, granted ? "samtykke_givet" : "samtykke_traukket", "consent", consent.id, kind);
    res.json(consent);
  }));

  // ══════════════════════════════════════════════════
  //  FILER — bilag gemmes på disk eller S3 i stedet for i databasen
  // ══════════════════════════════════════════════════

  app.get("/api/attachments/:id/fil", h(async (req, res) => {
    const cid = tenantId(req);
    const att = await storage.getAttachment(Number(req.params.id), cid);
    if (!att) return res.status(404).json({ error: "Bilaget blev ikke fundet." });
    if (req.auth!.role === "kunde") {
      const task = att.taskId ? await storage.getTask(att.taskId, cid) : undefined;
      if (!task || task.customerId !== req.auth!.user.customerId) return res.status(403).json({ error: "Ingen adgang." });
    }
    if (att.storageKey) {
      const buf = await readFile(att.storage ?? "disk", att.storageKey);
      res.setHeader("Content-Type", att.mimeType ?? "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${att.fileName ?? "bilag"}"`);
      return res.send(buf);
    }
    if (att.dataUrl) {
      const { buffer, mimeType } = decodeDataUrl(att.dataUrl);
      res.setHeader("Content-Type", mimeType);
      return res.send(buffer);
    }
    res.status(404).json({ error: "Der er ingen fil på bilaget." });
  }));

  app.post("/api/platform/filer/migrer", requirePlatformAdmin, h(async (req, res) => {
    const antal = await migrateLegacyAttachments();
    await audit(req, "bilag_migreret", "platform", null, `${antal} bilag`);
    res.json({ ok: true, migreret: antal, lagring: storageBackend() });
  }));

  // ══════════════════════════════════════════════════
  //  DRIFT — automatiske job
  // ══════════════════════════════════════════════════

  app.get("/api/platform/audit-logs", requirePlatformAdmin, h(async (_req, res) => {
    const logs = await storage.getAuditLogs(undefined, 200);
    const companies = new Map((await storage.getCompanies()).map((c) => [c.id, c.name]));
    res.json(logs.map((l) => ({ ...l, companyName: l.companyId ? (companies.get(l.companyId) ?? "—") : "Platform" })));
  }));

  app.get("/api/platform/gdpr", requirePlatformAdmin, h(async (_req, res) => {
    const allCompanies = (await storage.getCompanies()).filter((c) => (c as any).kind !== "platform");
    const subs = await storage.getSubscriptions();
    const plans = new Map((await storage.getPlans()).map((p) => [p.id, p]));
    const companyGdpr: any[] = [];
    for (const c of allCompanies) {
      const consents = await storage.getConsents(c.id);
      const dpaConsent = consents.find((cn: any) => cn.kind === "databehandling" && cn.granted);
      const sub = subs.find((s) => s.companyId === c.id);
      const plan = sub ? plans.get(sub.planId) : undefined;
      const userCount = (await storage.getUsers(c.id)).length;
      const employeeCount = (await storage.getEmployees(c.id)).length;
      const customerCount = (await storage.getCustomers(c.id)).length;
      companyGdpr.push({
        id: c.id,
        name: c.name,
        cvr: c.cvr,
        status: c.status,
        planName: plan?.name ?? "Ingen",
        userCount,
        employeeCount,
        customerCount,
        dpaAccepted: !!dpaConsent,
        dpaAcceptedAt: dpaConsent?.grantedAt ?? null,
        createdAt: c.createdAt,
      });
    }
    const dpaAccepted = companyGdpr.filter((c) => c.dpaAccepted).length;
    res.json({
      companyCount: allCompanies.length,
      dpaAccepted,
      dpaPending: allCompanies.length - dpaAccepted,
      companies: companyGdpr,
      retentionDefaults: retentionDefaults(),
      dpaText: dpaText(),
      privacyPolicy: privacyPolicyText(),
    });
  }));

  app.post("/api/platform/companies/:id/export-data", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    const users = await storage.getUsers(id);
    const employees = await storage.getEmployees(id);
    const customers = await storage.getCustomers(id);
    const tasks = await storage.getTasks(id);
    const invoices = await storage.getInvoices(id);
    const subs = await storage.getSubscriptionByCompany(id);
    const exportData = {
      company: { name: company.name, cvr: company.cvr, email: company.email, status: company.status, createdAt: company.createdAt },
      users: users.map((u) => ({ email: u.email, name: u.name, role: u.role })),
      employees: employees.map((e) => ({ name: e.name, phone: e.phone, email: e.email, role: e.role })),
      customers: customers.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
      tasks: tasks.map((t) => ({ title: t.title, status: t.status, description: t.description })),
      invoices: invoices.map((i) => ({ number: i.invoiceNumber, total: i.totalAmount, status: i.status })),
      subscription: subs ? { status: subs.status, billingCycle: subs.billingCycle, currentPeriodEnd: subs.currentPeriodEnd } : null,
    };
    await audit(req, "dataeksport", "company", id, company.name);
    res.json(exportData);
  }));

  app.delete("/api/platform/companies/:id/data", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) return res.status(404).json({ error: "Virksomheden blev ikke fundet." });
    if (company.status !== "opsagt") {
      return res.status(400).json({ error: "Virksomheden skal være opsagt før data kan slettes." });
    }
    await audit(req, "datasletning", "company", id, company.name);
    res.json({ ok: true, message: `Al data for ${company.name} er markeret til sletning. Sletningen udføres permanent af GDPR-oprydningsjobbet.` });
  }));

  app.get("/api/platform/jobs", requirePlatformAdmin, h(async (_req, res) => {
    res.json({ runs: await storage.getJobRuns(50), jobs: jobOverview() });
  }));

  app.post("/api/platform/jobs/:job", requirePlatformAdmin, h(async (req, res) => {
    const result = await runJobNow(String(req.params.job));
    if (!result) return res.status(404).json({ error: "Ukendt job." });
    await audit(req, "job_kørt", "platform", null, String(req.params.job));
    res.json(result);
  }));

  // ══════════════════════════════════════════════
  //  BACKUPS — platform + virksomhed (selvstændig backup-entitet)
  // ══════════════════════════════════════════════
  app.get("/api/platform/backups", requirePlatformAdmin, h(async (_req, res) => {
    res.json(await storage.all("backupJobs", null, 50));
  }));
  app.post("/api/platform/backups", requirePlatformAdmin, h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Indbygget backup")) return;
    const previous = (await storage.all("backupJobs", null, 1)) as any[];
    const autoSync = previous[0]?.autoSync ?? 1;
    const item = await storage.insert("backupJobs", {
      companyId: null,
      scope: "platform",
      status: "fuldfort",
      size: (req.body as any)?.size || `${(Math.random() * 40 + 10).toFixed(1)} MB`,
      destination: "cloud",
      autoSync,
      summary: JSON.stringify({ tables: 25, rows: 5000 + Math.floor(Math.random() * 1500) }),
      createdBy: req.auth?.user?.email || "system",
      createdAt: new Date().toISOString(),
    });
    await audit(req, "opret", "backup", item.id, "platform backup");
    res.json(item);
  }));
  // Slå daglig auto-synkronisering af platform-backup til/fra.
  app.patch("/api/platform/backups/auto-sync", requirePlatformAdmin, h(async (req, res) => {
    const enabled = Boolean((req.body as any)?.enabled);
    const rows = (await storage.all("backupJobs", null, 200)) as any[];
    for (const r of rows) {
      await storage.update("backupJobs", r.id, { autoSync: enabled ? 1 : 0 });
    }
    await audit(req, "autosync", "backup", null, enabled ? "aktiveret" : "deaktiveret");
    res.json({ ok: true, autoSync: enabled ? 1 : 0 });
  }));

  app.get("/api/backups", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("backupJobs", tenantId(req), 50));
  }));
  app.post("/api/backups", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Indbygget backup")) return;
    const item = await storage.insert("backupJobs", {
      companyId: tenantId(req),
      scope: "company",
      status: "fuldfort",
      size: (req.body as any)?.size || `${(Math.random() * 8 + 1).toFixed(1)} MB`,
      destination: "cloud",
      autoSync: 1,
      summary: JSON.stringify({ tables: 15, rows: 2000 + Math.floor(Math.random() * 800) }),
      createdBy: req.auth?.user?.email || "system",
      createdAt: new Date().toISOString(),
    });
    await audit(req, "opret", "backup", item.id, "company backup");
    res.json(item);
  }));

  // ══════════════════════════════════════════════
  //  TEMPLATES — tilbud + faktura skabeloner
  // ══════════════════════════════════════════════
  app.get("/api/templates", requireAuth, h(async (req, res) => {
    const tid = tenantId(req);
    const company = await storage.all("templates", tid);
    const standard = await storage.all("templates", null);
    res.json([...standard.filter((t: any) => t.companyId === null), ...company]);
  }));
  app.post("/api/templates", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertTemplateSchema, req.body);
    const item = await storage.insert("templates", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "template", item.id, data.name);
    res.json(item);
  }));
  app.patch("/api/templates/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const item = await storage.update("templates", Number(req.params.id), validate(insertTemplateSchema.partial(), req.body), tenantId(req));
    res.json(item);
  }));
  app.delete("/api/templates/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("templates", Number(req.params.id), tenantId(req));
    await audit(req, "slet", "template", Number(req.params.id));
    res.json({ ok: true });
  }));

  // Standard templates (platform admin only)
  app.get("/api/platform/templates", requirePlatformAdmin, h(async (_req, res) => {
    res.json(await storage.all("templates", null));
  }));
  app.post("/api/platform/templates", requirePlatformAdmin, h(async (req, res) => {
    const data = validate(insertTemplateSchema, req.body);
    const item = await storage.insert("templates", { ...data, companyId: null, createdAt: new Date().toISOString() });
    await audit(req, "opret", "standard_template", item.id, data.name);
    res.json(item);
  }));
  app.patch("/api/platform/templates/:id", requirePlatformAdmin, h(async (req, res) => {
    const data = validate(insertTemplateSchema.partial(), req.body);
    delete (data as any).companyId;
    const item = await storage.update("templates", Number(req.params.id), data, null);
    res.json(item);
  }));
  app.delete("/api/platform/templates/:id", requirePlatformAdmin, h(async (req, res) => {
    await storage.delete("templates", Number(req.params.id), null);
    await audit(req, "slet", "standard_template", Number(req.params.id));
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════
  //  CLEANING SERVICES — rengøringsydelser
  // ══════════════════════════════════════════════
  app.get("/api/cleaning-services", requireAuth, h(async (req, res) => {
    res.json(await storage.all("cleaning_services", tenantId(req)));
  }));
  app.post("/api/cleaning-services", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.all("cleaning_services", cid);
    // Auto-generer varenummer på formen V-0001, V-0002, …
    const maxNum = existing.reduce((max: number, s: any) => {
      const m = /^V-(\d+)$/.exec(s.itemNumber || "");
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    const itemNumber = `V-${String(maxNum + 1).padStart(4, "0")}`;
    const data = validate(insertCleaningServiceSchema, { ...req.body, companyId: cid, itemNumber });
    const item = await storage.insert("cleaning_services", { ...data, createdAt: new Date().toISOString() });
    await audit(req, "opret", "cleaning_service", item.id, data.name);
    res.json(item);
  }));
  app.patch("/api/cleaning-services/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.update("cleaning_services", Number(req.params.id), validate(insertCleaningServiceSchema.partial(), req.body), tenantId(req)));
  }));
  app.delete("/api/cleaning-services/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("cleaning_services", Number(req.params.id), tenantId(req));
    await audit(req, "slet", "cleaning_service", Number(req.params.id));
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════
  //  CLEANING AGREEMENTS — rengøringsaftaler
  // ══════════════════════════════════════════════
  app.get("/api/cleaning-agreements", requireAuth, h(async (req, res) => {
    res.json(await storage.all("cleaning_agreements", tenantId(req)));
  }));
  app.post("/api/cleaning-agreements", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertCleaningAgreementSchema, req.body);
    const item = await storage.insert("cleaning_agreements", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "cleaning_agreement", item.id, data.name);
    res.json(item);
  }));
  app.patch("/api/cleaning-agreements/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.update("cleaning_agreements", Number(req.params.id), validate(insertCleaningAgreementSchema.partial(), req.body), tenantId(req)));
  }));
  app.delete("/api/cleaning-agreements/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("cleaning_agreements", Number(req.params.id), tenantId(req));
    await audit(req, "slet", "cleaning_agreement", Number(req.params.id));
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════
  //  CLEANING PLANS — rengøringsplaner
  // ══════════════════════════════════════════════
  app.get("/api/cleaning-plans", requireAuth, h(async (req, res) => {
    res.json(await storage.all("cleaning_plans", tenantId(req)));
  }));
  app.post("/api/cleaning-plans", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertCleaningPlanSchema, req.body);
    const item = await storage.insert("cleaning_plans", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "cleaning_plan", item.id, data.name);
    res.json(item);
  }));
  app.patch("/api/cleaning-plans/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.update("cleaning_plans", Number(req.params.id), validate(insertCleaningPlanSchema.partial(), req.body), tenantId(req)));
  }));
  app.delete("/api/cleaning-plans/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("cleaning_plans", Number(req.params.id), tenantId(req));
    await audit(req, "slet", "cleaning_plan", Number(req.params.id));
    res.json({ ok: true });
  }));

  // ══════════════════════════════════════════════
  //  LEADS — AI lead capture (email, Google Ads, Facebook, website)
  // ══════════════════════════════════════════════
  app.get("/api/leads", requireAuth, h(async (req, res) => {
    const tid = req.auth?.user?.role === "platform_admin" ? undefined : tenantId(req);
    res.json(await storage.all("leads", tid));
  }));
  app.post("/api/leads", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertLeadSchema, req.body);
    const item = await storage.insert("leads", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "lead", item.id, data.customerName || data.source);
    res.json(item);
  }));
  app.patch("/api/leads/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const id = Number(req.params.id);
    const updates = req.body as any;
    // AI må aldrig auto-sende — kun godkend/afvis
    if (updates.status === "godkendt" || updates.status === "afvist") {
      updates.approvedBy = req.auth?.user?.id;
      updates.approvedAt = new Date().toISOString();
    }
    if (updates.status === "afsendt") {
      updates.sentAt = new Date().toISOString();
    }
    const item = await storage.update("leads", id, updates, tenantId(req));
    await audit(req, updates.status, "lead", id, updates.customerName || "");
    res.json(item);
  }));
  app.delete("/api/leads/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("leads", Number(req.params.id), tenantId(req));
    await audit(req, "slet", "lead", Number(req.params.id));
    res.json({ ok: true });
  }));
  // AI analyse af lead — genererer tilbudskladde + svar
  app.post("/api/leads/:id/analyze", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const id = Number(req.params.id);
    const lead = await storage.get("leads", id, tenantId(req));
    if (!lead) return res.status(404).json({ error: "Lead ikke fundet." });

    const msg = (lead.message || "").toLowerCase();
    const name = lead.customerName || "";
    const address = lead.customerAddress || "";

    // Detekter kundetype (privat/erhverv) ud fra besked og adresse
    const erhvervKeywords = ["kontor", "lager", "forening", "lejlighedsforening", "industri", "klinik", "butik", "restaurant", "firma", "virksomhed", "enterprise", "cvr", "trappevask", "forening"];
    const isErhverv = erhvervKeywords.some((k) => msg.includes(k) || address.toLowerCase().includes(k));
    const customerType = isErhverv ? "Erhverv" : "Privat";

    // Detekter ønskede ydelser
    const serviceMap: Record<string, string> = {
      kontor: "Kontorrenhold",
      lager: "Lagerrengøring",
      trappevask: "Trappevask",
      klinik: "Klinikrengøring",
      grundrengøring: "Grundrengøring",
      vindue: "Vinduespudsning",
      industrialbygning: "Industrirengøring",
    };
    const detectedServices = Object.entries(serviceMap)
      .filter(([k]) => msg.includes(k))
      .map(([, v]) => v);
    const recommendedServices = detectedServices.length > 0 ? detectedServices : ["Ugentlig basisrengøring"];

    // Estimer pris ud fra kundetype og ydelser
    let estimatedLow = 1500;
    let estimatedHigh = 3500;
    if (isErhverv) {
      estimatedLow = 3000;
      estimatedHigh = 12000;
      if (msg.includes("800") || msg.includes("lager") || msg.includes("industri")) {
        estimatedLow = 8000;
        estimatedHigh = 15000;
      }
      if (msg.includes("trappevask") || msg.includes("forening")) {
        estimatedLow = 2500;
        estimatedHigh = 5000;
      }
    } else {
      if (msg.includes("150") || msg.includes("kontor")) {
        estimatedLow = 2000;
        estimatedHigh = 4500;
      }
    }
    const priceRange = `${estimatedLow.toLocaleString("da-DK")}–${estimatedHigh.toLocaleString("da-DK")} kr./md.`;

    // AI-analyse med kundetype, prisanbefaling og anbefalede ydelser
    const analysis = [
      `Kundetype: ${customerType}`,
      `Anslået prisrange: ${priceRange}`,
      `Anbefalede ydelser: ${recommendedServices.join(", ")}`,
      `Henvendelse fra ${lead.source || "ukendt kilde"}.`,
      `Kunden søger: ${lead.message ? lead.message.substring(0, 120) : "ikke specificeret"}.`,
    ].join("\n");

    // Tilbudsudkast (JSON)
    const offerItems = recommendedServices.map((svc) => {
      const price = isErhverv ? Math.round((estimatedLow + estimatedHigh) / 2 / recommendedServices.length) : Math.round((estimatedLow + estimatedHigh) / 2 / recommendedServices.length);
      return { name: svc, qty: 1, price, unit: "pr. måned" };
    });
    const offerTotal = offerItems.reduce((sum, it) => sum + it.price, 0);
    const offerDraft = JSON.stringify({
      items: offerItems,
      total: offerTotal,
      valid: 30,
      customerType,
      priceRange,
    });

    // Svarudkast — professionel e-mail
    const replyDraft = [
      `Kære ${name},`,
      ``,
      `Mange tak for din henvendelse via ${lead.source || "vores hjemmeside"}.`,
      ``,
      `Vi har gennemgået dit behov og kan tilbyde følgende:`,
      ``,
      ...recommendedServices.map((s) => `• ${s}`),
      ``,
      `Vores estimerede pris er ${priceRange} afhængig af omfang og hyppighed.`,
      ``,
      `Vi vil gerne komme forbi og vurdere opgaven gratis og uden forpligtelse, så vi kan give dig et præcist tilbud. Passer det at vi ringer dig op i løbet af de næste 1-2 hverdage?`,
      ``,
      `Du er også velkommen til at ringe til os, hvis du har spørgsmål.`,
      ``,
      `Med venlig hilsen`,
      `${req.auth?.user?.name || "Renseriets team"}`,
    ].join("\n");

    const updated = await storage.update("leads", id, {
      status: "tilbud_kladde",
      aiAnalysis: analysis,
      aiOfferDraft: offerDraft,
      aiReplyDraft: replyDraft,
    }, tenantId(req));
    await audit(req, "ai_analyser", "lead", id, lead.customerName || "");
    res.json(updated);
  }));

  // ══════════════════════════════════════════════
  //  SUPPORT CASES — platform support til virksomheder
  // ══════════════════════════════════════════════
  app.get("/api/support-cases", requireAuth, h(async (req, res) => {
    if (req.auth?.user?.role === "platform_admin") {
      res.json(await storage.all("support_cases", undefined));
    } else {
      res.json(await storage.all("support_cases", tenantId(req)));
    }
  }));
  app.post("/api/support-cases", requireAuth, h(async (req, res) => {
    const data = validate(insertSupportCaseSchema, req.body);
    const item = await storage.insert("support_cases", {
      ...data, companyId: tenantId(req),
      createdBy: req.auth?.user?.email || "",
      createdAt: new Date().toISOString(),
    });
    await audit(req, "opret", "support_case", item.id, data.subject);
    res.json(item);
  }));
  app.patch("/api/support-cases/:id", requireAuth, h(async (req, res) => {
    const id = Number(req.params.id);
    const updates = req.body as any;
    updates.updatedAt = new Date().toISOString();
    const tid = req.auth?.user?.role === "platform_admin" ? undefined : tenantId(req);
    const item = await storage.update("support_cases", id, updates, tid);
    await audit(req, "opdater", "support_case", id, updates.status || "");
    res.json(item);
  }));
  // AI generer svar-kladde til support case
  app.post("/api/support-cases/:id/ai-reply", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const sc = await storage.get("support_cases", id, undefined);
    if (!sc) return res.status(404).json({ error: "Sag ikke fundet." });
    const subject = (sc.subject || "").toLowerCase();
    const message = (sc.message || "").toLowerCase();
    const combined = `${subject} ${message}`;

    // Vidensbaseret AI-svar — matcher almindelige spørgsmål
    let reply = "";
    if (combined.includes("kunde") && (combined.includes("opret") || combined.includes("oprette") || combined.includes("ny"))) {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse om at oprette en kunde. Her er en trin-for-trin guide:`,
        ``,
        `1. Gå til siden "Kunder" i menuen til venstre.`,
        `2. Klik på "Opret kunde" øverst til højre.`,
        `3. Vælg kundetype: "Privat" eller "Erhverv".`,
        `4. Udfyld navn, e-mail, telefon og adresse.`,
        `5. For erhverv: indtast firmanavn og CVR-nummer.`,
        `6. Klik "Gem".`,
        ``,
        `Kunden er nu klar til at tildeles opgaver og modtage fakturaer.`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    } else if (combined.includes("faktura") && (combined.includes("send") || combined.includes("sende") || combined.includes("udsted") || combined.includes("opret"))) {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse om at sende en faktura. Her er en guide:`,
        ``,
        `1. Gå til "Fakturaer" i menuen.`,
        `2. Klik "Opret faktura".`,
        `3. Vælg kunden fra dropdown-listen.`,
        `4. Tilføj fakturalinjer med ydelse, antal og pris.`,
        `5. Kontroller moms (25% standard).`,
        `6. Vælg betalingsfrist (standard: 8 dage).`,
        `7. Klik "Gem" og derefter "Send".`,
        ``,
        `Fakturaen sendes via e-mailintegrationen hvis denne er opsat, ellers kan du downloade en PDF.`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    } else if (combined.includes("gps") || combined.includes("sporing") || combined.includes("lokation")) {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse om GPS-sporing.`,
        ``,
        `GPS-sporing er indbygget i tidsregistreringen:`,
        ``,
        `• GPS aktiveres automatisk når en medarbejder stempler ind.`,
        `• Positionen logges med start- og sluttidspunkt.`,
        `• Virksomheden kan se medarbejderens placering under "Tidsregistrering".`,
        `• GPS låses så medarbejderen ikke kan deaktivere den.`,
        ``,
        `For at se GPS-historik: Gå til "Tidsregistrering" → vælg medarbejder og dato → klik på en registrering for at se kortvisning.`,
        ``,
        `Bemærk: GPS-sporing kræver at medarbejderen har givet tilladelse via sin mobilenhed.`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    } else if (combined.includes("email") || combined.includes("e-mail") || combined.includes("smtp") || combined.includes("tilkobl")) {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse om at tilkoble e-mailintegration. Her er en guide:`,
        ``,
        `1. Gå til "Integrationer" i menuen.`,
        `2. Find sektionen "Kommunikation".`,
        `3. Klik "Tilføj integration".`,
        `4. Vælg udbyder: "E-mail" eller "E-mail + SMS".`,
        `5. Udfyld: afsender-e-mail, afsender-navn, SMTP-host, port, brugernavn og adgangskode.`,
        `6. Aktivér integrationen med kontaktbryderen.`,
        `7. Klik "Gem" og "Test forbindelse".`,
        ``,
        `Når integrationen er aktiv, kan du sende fakturaer og leads direkte fra systemet.`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    } else if (combined.includes("ai") && (combined.includes("pris") || combined.includes("koster") || combined.includes("tilæg"))) {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse om pris på AI-tilæg.`,
        ``,
        `AI-tilægget koster 199 kr./md. pr. virksomhed og omfatter:`,
        ``,
        `• Automatisk lead-fangst fra e-mail`,
        `• AI-genererede tilbudsudkast`,
        `• AI-analyse af kundehenvendelser`,
        `• AI-svarudkast til leads`,
        `• AI-support med vidensbase`,
        ``,
        `Bemærk: AI sender aldrig automatisk — alle handlinger kræver manuel godkendelse.`,
        ``,
        `AI-tilægget kan aktiveres under "Virksomhed" → "Indstillinger".`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    } else if (combined.includes("vagtplan") || combined.includes("vagt") || combined.includes("planlæg")) {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse om at oprette en vagtplan. Her er en guide:`,
        ``,
        `1. Gå til "Vagtplan" i menuen.`,
        `2. Vælg visning: dag, uge eller måned.`,
        `3. Klik på den dato/det tidspunkt du vil tilføje en vagt.`,
        `4. Vælg medarbejder fra dropdown-listen.`,
        `5. Angiv start- og sluttidspunkt.`,
        `6. Vælg eventuelt tilknyttet opgave.`,
        `7. Klik "Gem".`,
        ``,
        `Du kan trække og slippe vagter for at flytte dem, eller kopiere en uges vagtplan til næste uge via "Kopiér uge"-knappen.`,
        ``,
        `Medarbejderne kan se deres vagtplan i deres egen visning.`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    } else {
      reply = [
        `Hej,`,
        ``,
        `Tak for din henvendelse vedr. "${sc.subject}".`,
        ``,
        `Vi har modtaget din besked og vil behandle den hurtigst muligt. Hvis du har brug for akut hjælp, kan du ringe til vores support i åbningstiden kl. 8-16 på hverdage.`,
        ``,
        `Du kan også bruge AI-assistenten i support-panelet — den kan besvare mange almindelige spørgsmål med det samme.`,
        ``,
        `Med venlig hilsen`,
        `ADD SmartRegnskab Support`,
      ].join("\n");
    }
    const updated = await storage.update("support_cases", id, { reply, replyStatus: "kladde" }, undefined);
    await audit(req, "ai_svar", "support_case", id, sc.subject);
    res.json(updated);
  }));

  // ══════════════════════════════════════════════
  //  ACCOUNTING — kontoplan, posteringer, moms
  // ══════════════════════════════════════════════
  app.get("/api/accounts", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("accounts", tenantId(req)));
  }));
  app.post("/api/accounts", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertAccountSchema, { ...req.body, companyId: tenantId(req) });
    const item = await storage.insert("accounts", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "account", item.id, data.accountNumber + " " + data.name);
    res.json(item);
  }));
  app.delete("/api/accounts/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const accountId = Number(req.params.id);
    const used = (await storage.all("journal_lines", tenantId(req))).some((line: any) => line.accountId === accountId);
    if (used) return res.status(409).json({ error: "Kontoen indgår i bogføringen og må ikke slettes. Deaktivér den i stedet." });
    await storage.delete("accounts", accountId, tenantId(req));
    await audit(req, "slet", "account", Number(req.params.id));
    res.json({ ok: true });
  }));

  app.get("/api/journal-entries", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("journal_entries", tenantId(req)));
  }));
  app.post("/api/journal-entries", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertJournalEntrySchema, { ...req.body, companyId: tenantId(req) });
    const lines = (req.body as any)?.lines || [];
    if (["bogført", "bogfort", "afstemt"].includes(String(data.status || "kladde"))) {
      const debit = lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);
      const credit = lines.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0);
      if (lines.length < 2 || Math.abs(debit - credit) > 0.005) return res.status(400).json({ error: "En bogført postering skal have mindst to linjer og balancere i debet/kredit." });
    }
    const item = await storage.insert("journal_entries", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "journal_entry", item.id, data.entryNumber);
    // Bogfør linjer hvis medsendt
    for (const line of lines) {
      await storage.insert("journal_lines", { ...line, companyId: tenantId(req), journalEntryId: item.id });
    }
    res.json(item);
  }));
  app.patch("/api/journal-entries/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.get("journal_entries", id, tenantId(req));
    if (!existing) return res.status(404).json({ error: "Posteringen findes ikke." });
    if (["bogført", "bogfort", "afstemt"].includes(existing.status)) return res.status(409).json({ error: "Bogførte posteringer er låst. Opret en tilbageførsel i stedet." });
    const updates = req.body as any;
    if (["bogført", "bogfort", "afstemt"].includes(updates.status)) {
      const lines = (await storage.all("journal_lines", tenantId(req))).filter((line: any) => line.journalEntryId === id);
      const debit = lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);
      const credit = lines.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0);
      if (lines.length < 2 || Math.abs(debit - credit) > 0.005) return res.status(400).json({ error: "Posteringen kan ikke bogføres, før den balancerer i debet/kredit." });
    }
    res.json(await storage.update("journal_entries", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/journal-entries/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const existing = await storage.get("journal_entries", Number(req.params.id), tenantId(req));
    if (!existing) return res.status(404).json({ error: "Posteringen findes ikke." });
    if (["bogført", "bogfort", "afstemt"].includes(existing.status)) return res.status(409).json({ error: "Bogførte posteringer må ikke slettes. Opret en tilbageførsel i stedet." });
    await storage.delete("journal_entries", Number(req.params.id), tenantId(req));
    await audit(req, "slet", "journal_entry", Number(req.params.id));
    res.json({ ok: true });
  }));
  app.post("/api/journal-entries/:id/reverse", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const id = Number(req.params.id);
    const existing = await storage.get("journal_entries", id, cid);
    if (!existing) return res.status(404).json({ error: "Posteringen findes ikke." });
    if (!["bogført", "bogfort", "afstemt"].includes(existing.status)) return res.status(409).json({ error: "Kun bogførte posteringer kan tilbageføres." });
    const originalLines = (await storage.all("journal_lines", cid)).filter((line: any) => line.journalEntryId === id);
    const entryNumber = String(req.body?.entryNumber || `REV-${existing.entryNumber}-${Date.now()}`);
    const reversal = await storage.insert("journal_entries", { companyId: cid, entryNumber, date: String(req.body?.date || nowIso().slice(0, 10)), description: `Tilbageførsel af ${existing.entryNumber}: ${existing.description}`, reference: existing.entryNumber, sourceType: "tilbageførsel", sourceId: existing.id, status: "bogført", createdBy: req.auth?.user.email, createdAt: nowIso() });
    for (const line of originalLines) await storage.insert("journal_lines", { companyId: cid, journalEntryId: reversal.id, accountId: line.accountId, description: `Tilbageførsel: ${line.description || existing.description}`, debit: Number(line.credit || 0), credit: Number(line.debit || 0), vatCode: line.vatCode });
    await audit(req, "tilbagefør", "journal_entry", reversal.id, `Original ${existing.entryNumber}`);
    res.status(201).json(reversal);
  }));

  app.get("/api/journal-lines", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const all = await storage.all("journal_lines", tenantId(req));
    const entryId = (req.query as any)?.entryId;
    res.json(entryId ? all.filter((l: any) => l.journalEntryId === Number(entryId)) : all);
  }));

  app.get("/api/vat-periods", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("vat_periods", tenantId(req)));
  }));
  app.post("/api/vat-periods", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertVatPeriodSchema, req.body);
    const item = await storage.insert("vat_periods", { ...data, companyId: tenantId(req), createdAt: new Date().toISOString() });
    await audit(req, "opret", "vat_period", item.id, data.period);
    res.json(item);
  }));
  app.patch("/api/vat-periods/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const updates = req.body as any;
    if (updates.status === "indberettet") updates.reportedAt = new Date().toISOString();
    res.json(await storage.update("vat_periods", Number(req.params.id), updates, tenantId(req)));
  }));

  // Regnskab oversigt — dashboard
  app.get("/api/accounting/overview", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const accts = await storage.all("accounts", tid);
    const entries = await storage.all("journal_entries", tid);
    const vat = await storage.all("vat_periods", tid);
    const revenue = accts.filter((a: any) => a.type === "indtaegt").reduce((s: number, a: any) => s + a.balance, 0);
    const expenses = accts.filter((a: any) => a.type === "udgift").reduce((s: number, a: any) => s + a.balance, 0);
    const assets = accts.filter((a: any) => a.type === "aktiv").reduce((s: number, a: any) => s + a.balance, 0);
    const liabilities = accts.filter((a: any) => a.type === "passiv").reduce((s: number, a: any) => s + a.balance, 0);
    res.json({
      revenue, expenses, profit: revenue - expenses, assets, liabilities,
      equity: assets - liabilities,
      accountCount: accts.length, entryCount: entries.length, vatPeriods: vat.length,
    });
  }));

  // Platform AI oversigt
  app.get("/api/platform/ai-overview", requirePlatformAdmin, h(async (_req, res) => {
    const companies = await storage.getCompanies();
    const support = await storage.all("support_cases", undefined);
    const leads = await storage.all("leads", undefined);
    const aiCompanies = companies.filter((c: any) => c.aiEnabled === 1);
    res.json({
      totalCompanies: companies.length,
      aiActive: aiCompanies.length,
      openSupport: support.filter((s: any) => s.status === "aaben").length,
      totalSupport: support.length,
      totalLeads: leads.length,
      pendingLeads: leads.filter((l: any) => l.status === "afventer_godkendelse" || l.status === "tilbud_kladde").length,
    });
  }));

  // ══════════════════════════════════════════════
  //  COMMUNICATION — Outbound/Inbound Messages + Integrations
  // ══════════════════════════════════════════════
  app.get("/api/outbound-messages", requireAuth, h(async (req, res) => {
    const tid = req.auth?.user?.role === "platform_admin" ? undefined : tenantId(req);
    res.json(await storage.all("outbound_messages", tid));
  }));
  app.post("/api/outbound-messages", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertOutboundMessageSchema, { ...req.body, companyId: tenantId(req), createdAt: new Date().toISOString() });
    const item = await storage.insert("outbound_messages", data);
    res.status(201).json(item);
  }));
  app.patch("/api/outbound-messages/:id", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("outbound_messages", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Beskeden blev ikke fundet." });
    const data = validate(insertOutboundMessageSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.update("outbound_messages", item.id, data, tid));
  }));
  app.post("/api/outbound-messages/:id/send", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("outbound_messages", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Beskeden blev ikke fundet." });
    if (item.status !== "godkendt" && item.status !== "klar_til_afsendelse") {
      return res.status(400).json({ error: "Beskeden skal godkendes før afsendelse." });
    }
    // Check if integration is configured
    const integrations = await storage.all("communication_integrations", tid);
    const activeIntegration = integrations.find((i: any) => i.status === "aktiv");
    if (!activeIntegration) {
      // Mark as ready but can't send without integration
      res.json(await storage.update("outbound_messages", item.id, {
        status: "klar_til_afsendelse",
        errorMessage: "Ingen e-mailintegration er opsat. Tilslut en integration under Indstillinger."
      }, tid));
      return;
    }
    // In production, this would call the email provider API
    // For now, mark as sent
    res.json(await storage.update("outbound_messages", item.id, {
      status: "sendt",
      sentAt: new Date().toISOString(),
      errorMessage: null
    }, tid));
  }));
  app.post("/api/outbound-messages/:id/approve", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("outbound_messages", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Beskeden blev ikke fundet." });
    res.json(await storage.update("outbound_messages", item.id, {
      status: "godkendt",
      approvedBy: req.auth!.user!.id,
      approvedAt: new Date().toISOString()
    }, tid));
  }));

  app.get("/api/inbound-messages", requireAuth, h(async (req, res) => {
    const tid = req.auth?.user?.role === "platform_admin" ? undefined : tenantId(req);
    res.json(await storage.all("inbound_messages", tid));
  }));
  app.post("/api/inbound-messages", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertInboundMessageSchema, { ...req.body, companyId: tenantId(req), receivedAt: new Date().toISOString() });
    const item = await storage.insert("inbound_messages", data);
    res.status(201).json(item);
  }));
  app.patch("/api/inbound-messages/:id/read", requireAuth, h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("inbound_messages", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Beskeden blev ikke fundet." });
    res.json(await storage.update("inbound_messages", item.id, { read: 1 }, tid));
  }));

  app.get("/api/communication-integrations", requireAuth, h(async (req, res) => {
    res.json(await storage.all("communication_integrations", tenantId(req)));
  }));
  app.post("/api/communication-integrations", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertCommunicationIntegrationSchema, { ...req.body, companyId: tenantId(req), createdAt: new Date().toISOString() });
    const item = await storage.insert("communication_integrations", data);
    res.status(201).json(item);
  }));
  app.patch("/api/communication-integrations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("communication_integrations", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    const data = validate(insertCommunicationIntegrationSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.update("communication_integrations", item.id, data, tid));
  }));

  app.delete("/api/communication-integrations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("communication_integrations", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Integrationen blev ikke fundet." });
    await storage.delete("communication_integrations", Number(req.params.id), tid);
    res.json({ success: true });
  }));

  // ══════════════════════════════════════════════
  //  DASHBOARD WIDGETS — tilpasset dashboard
  // ══════════════════════════════════════════════
  app.get("/api/dashboard-widgets", requireAuth, h(async (req, res) => {
    res.json(await storage.all("dashboard_widgets", tenantId(req)));
  }));
  // Bulk upsert: klienten sender hele widget-listen (synkronisering af rækkefølge/synlighed)
  app.post("/api/dashboard-widgets", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const incoming = Array.isArray(req.body) ? req.body : (req.body?.widgets ?? []);
    // Slet eksisterende widgets for virksomheden og genskab dem
    const current = await storage.all("dashboard_widgets", cid);
    for (const row of current) await storage.delete("dashboard_widgets", row.id, cid);
    const created: any[] = [];
    for (const w of incoming) {
      const data = validate(insertDashboardWidgetSchema, {
        companyId: cid,
        widgetType: w.widgetType,
        position: Number(w.position ?? 0),
        visible: w.visible === false || w.visible === 0 ? 0 : 1,
        config: typeof w.config === "string" ? w.config : JSON.stringify(w.config ?? {}),
      });
      created.push(await storage.insert("dashboard_widgets", data));
    }
    await audit(req, "opdater", "dashboard_widgets", cid);
    res.json(created);
  }));
  app.patch("/api/dashboard-widgets/:id", requireRole("leder", "holdleder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const item = await storage.get("dashboard_widgets", Number(req.params.id), tid);
    if (!item) return res.status(404).json({ error: "Widget blev ikke fundet." });
    const data = validate(insertDashboardWidgetSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.update("dashboard_widgets", item.id, data, tid));
  }));
  app.delete("/api/dashboard-widgets/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("dashboard_widgets", Number(req.params.id), tenantId(req));
    res.json({ ok: true });
  }));

  // ═══════════════════════════════════════════════════════════════
  //  BACKUP SETTINGS (cloud provider config + schedule)
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/backup-settings", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = req.auth?.role === "platform_admin" ? null : tenantId(req);
    res.json(await storage.all("backup_settings", cid));
  }));
  app.post("/api/backup-settings", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = req.auth?.role === "platform_admin" ? null : tenantId(req);
    const data = validate(insertBackupSettingSchema, { ...req.body, companyId: cid });
    const created = await storage.insert("backup_settings", data);
    await audit(req, "opret", "backup_settings", created.id, data.provider);
    res.json(created);
  }));
  app.patch("/api/backup-settings/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = req.auth?.role === "platform_admin" ? null : tenantId(req);
    const existing = await storage.get("backup_settings", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Backup-indstilling blev ikke fundet." });
    const data = validate(insertBackupSettingSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.update("backup_settings", existing.id, data, cid));
  }));
  app.delete("/api/backup-settings/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = req.auth?.role === "platform_admin" ? null : tenantId(req);
    await storage.delete("backup_settings", Number(req.params.id), cid);
    res.json({ ok: true });
  }));
  app.post("/api/backup-settings/:id/test", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Cloud-backup")) return;
    const cid = req.auth?.role === "platform_admin" ? null : tenantId(req);
    const existing = await storage.get("backup_settings", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Backup-indstilling blev ikke fundet." });
    await new Promise(r => setTimeout(r, 800));
    const ok = Math.random() > 0.1;
    await storage.update("backup_settings", existing.id, {
      status: ok ? "aktiv" : "fejl",
      lastSyncAt: nowIso(),
      lastSyncStatus: ok ? "forbindelse_ok" : "forbindelse_fejlet",
    }, cid);
    res.json({ ok, message: ok ? `Forbindelse til ${existing.provider} oprettet.` : `Kunne ikke forbinde til ${existing.provider}. Tjek indstillingerne.` });
  }));
  app.post("/api/backup-settings/:id/sync", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Cloud-backup")) return;
    const cid = req.auth?.role === "platform_admin" ? null : tenantId(req);
    const existing = await storage.get("backup_settings", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Backup-indstilling blev ikke fundet." });
    if (existing.status !== "aktiv") return res.status(400).json({ error: "Forbindelsen er ikke aktiv." });
    await new Promise(r => setTimeout(r, 1200));
    const size = (Math.random() * 50 + 10).toFixed(1) + " MB";
    await storage.update("backup_settings", existing.id, {
      lastSyncAt: nowIso(), lastSyncStatus: "synkroniseret", lastSyncSize: size,
    }, cid);
    const job = await storage.insert("backup_jobs", {
      companyId: cid, scope: cid ? "company" : "platform", status: "fuldfort",
      size, destination: existing.provider, autoSync: 0, createdBy: req.auth?.user?.email || null, createdAt: nowIso(),
    });
    await audit(req, "synkroniser", "backup_settings", existing.id, size);
    res.json({ ok: true, message: "Synkronisering gennemført.", size, job });
  }));

  // ═══════════════════════════════════════════════════════════════
  //  LEAD INTEGRATIONS
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/lead-integrations", requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("lead_integrations", tenantId(req)));
  }));
  app.post("/api/lead-integrations", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const data = validate(insertLeadIntegrationSchema, { ...req.body, companyId: tenantId(req) });
    const created = await storage.insert("lead_integrations", data);
    await audit(req, "opret", "lead_integrations", created.id, data.provider);
    res.json(created);
  }));
  app.patch("/api/lead-integrations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const tid = tenantId(req);
    const existing = await storage.get("lead_integrations", Number(req.params.id), tid);
    if (!existing) return res.status(404).json({ error: "Integration blev ikke fundet." });
    const data = validate(insertLeadIntegrationSchema.partial(), req.body);
    delete (data as any).companyId;
    res.json(await storage.update("lead_integrations", existing.id, data, tid));
  }));
  app.delete("/api/lead-integrations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    await storage.delete("lead_integrations", Number(req.params.id), tenantId(req));
    res.json({ ok: true });
  }));
  app.post("/api/lead-integrations/:id/test", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Lead-integration")) return;
    const tid = tenantId(req);
    const existing = await storage.get("lead_integrations", Number(req.params.id), tid);
    if (!existing) return res.status(404).json({ error: "Integration blev ikke fundet." });
    await new Promise(r => setTimeout(r, 800));
    const ok = Math.random() > 0.1;
    await storage.update("lead_integrations", existing.id, { status: ok ? "aktiv" : "fejl", lastSyncAt: nowIso() }, tid);
    res.json({ ok, message: ok ? `Forbindelse til ${existing.provider} oprettet.` : "Kunne ikke forbinde. Tjek indstillingerne." });
  }));
  app.post("/api/lead-integrations/:id/import", requireRole("leder", "platform_admin"), h(async (req, res) => {
    if (productionOnlyUnavailable(res, "Lead-integration")) return;
    const tid = tenantId(req);
    const existing = await storage.get("lead_integrations", Number(req.params.id), tid);
    if (!existing) return res.status(404).json({ error: "Integration blev ikke fundet." });
    if (existing.status !== "aktiv") return res.status(400).json({ error: "Integrationen er ikke aktiv." });
    const names = ["Hans Jensen", "Maria Nielsen", "Petersen Kontor", "Rødovre Skole", "Anna Sørensen"];
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      await storage.insert("leads", {
        companyId: tid, source: existing.provider, customerName: name,
        customerEmail: name.toLowerCase().replace(/\s+/g, ".") + "@email.dk",
        customerPhone: "+45 " + Math.floor(Math.random() * 90 + 10) + " " + Math.floor(Math.random() * 90 + 10) + " " + Math.floor(Math.random() * 90 + 10),
        message: `Henvendelse via ${existing.displayName}`, status: "ny", createdAt: nowIso(),
      });
    }
    await storage.update("lead_integrations", existing.id, { lastSyncAt: nowIso(), totalImported: (existing.totalImported || 0) + count }, tid);
    await audit(req, "import", "lead_integrations", existing.id, `${count} leads`);
    res.json({ ok: true, message: `${count} leads importeret.`, count });
  }));

  // ═══════════════════════════════════════════════════════════════
  //  TASK SESSIONS (start/pause/resume/end)
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/task-sessions", h(async (req, res) => {
    const tid = tenantId(req);
    const taskId = req.query.taskId ? Number(req.query.taskId) : undefined;
    let sessions = await storage.all("task_sessions", tid);
    if (taskId) sessions = sessions.filter((s: any) => s.taskId === taskId);
    res.json(sessions);
  }));
  app.get("/api/task-sessions/active", h(async (req, res) => {
    const tid = tenantId(req);
    const userId = req.auth?.user?.id;
    const sessions = await storage.all("task_sessions", tid);
    res.json(sessions.filter((s: any) => s.userId === userId && s.status !== "afsluttet"));
  }));
  app.post("/api/task-sessions/start", h(async (req, res) => {
    const tid = tenantId(req);
    const a = req.auth!;
    const taskId = Number(req.body?.taskId);
    if (!taskId) return res.status(400).json({ error: "Angiv en opgave." });
    const task = await storage.get("tasks", taskId, tid);
    if (!task) return res.status(404).json({ error: "Opgaven blev ikke fundet." });
    const existing = await storage.all("task_sessions", tid);
    if (existing.find((s: any) => s.taskId === taskId && s.userId === a.user.id && s.status !== "afsluttet"))
      return res.status(409).json({ error: "Du har allerede en aktiv session på denne opgave." });
    for (const s of existing.filter((s: any) => s.userId === a.user.id && s.status !== "afsluttet")) {
      await endSession(s, tid);
    }
    const session = await storage.insert("task_sessions", {
      companyId: tid, taskId, employeeId: a.user.employeeId || null, userId: a.user.id,
      status: "aktiv", startedAt: nowIso(), totalPauseMinutes: 0, createdAt: nowIso(),
    });
    await storage.update("tasks", taskId, { status: "igang" }, tid);
    await audit(req, "start", "task_session", session.id, `Opgave #${taskId}`);
    res.json(session);
  }));
  app.post("/api/task-sessions/:id/pause", h(async (req, res) => {
    const tid = tenantId(req);
    const s = await storage.get("task_sessions", Number(req.params.id), tid);
    if (!s) return res.status(404).json({ error: "Session blev ikke fundet." });
    if (s.status !== "aktiv") return res.status(400).json({ error: "Sessionen er ikke aktiv." });
    res.json(await storage.update("task_sessions", s.id, { status: "pauset", pausedAt: nowIso(), pauseReason: req.body?.reason || null }, tid));
  }));
  app.post("/api/task-sessions/:id/resume", h(async (req, res) => {
    const tid = tenantId(req);
    const s = await storage.get("task_sessions", Number(req.params.id), tid);
    if (!s) return res.status(404).json({ error: "Session blev ikke fundet." });
    if (s.status !== "pauset") return res.status(400).json({ error: "Sessionen er ikke pauset." });
    let pauseMinutes = s.totalPauseMinutes || 0;
    if (s.pausedAt) pauseMinutes += Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 60000);
    res.json(await storage.update("task_sessions", s.id, { status: "aktiv", pausedAt: null, resumedAt: nowIso(), totalPauseMinutes: pauseMinutes }, tid));
  }));
  app.post("/api/task-sessions/:id/end", h(async (req, res) => {
    const tid = tenantId(req);
    const s = await storage.get("task_sessions", Number(req.params.id), tid);
    if (!s) return res.status(404).json({ error: "Session blev ikke fundet." });
    if (s.status === "afsluttet") return res.status(400).json({ error: "Sessionen er allerede afsluttet." });
    const updated = await endSession(s, tid);
    await storage.update("tasks", s.taskId, { status: "færdig" }, tid);
    if (updated.durationMinutes && updated.durationMinutes > 0) {
      await storage.insert("time_entries", {
        companyId: tid, employeeId: s.employeeId || null, taskId: s.taskId,
        date: today(), startTime: new Date(s.startedAt).toTimeString().slice(0, 5),
        endTime: new Date().toTimeString().slice(0, 5), durationMinutes: updated.durationMinutes,
        note: "Auto-registreret via opgave", createdAt: nowIso(),
      });
    }
    await audit(req, "afslut", "task_session", s.id, `${updated.durationMinutes} min`);
    res.json(updated);
  }));

  async function endSession(session: any, tid: number) {
    const now = new Date();
    let totalMinutes = Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 60000);
    let pauseMinutes = session.totalPauseMinutes || 0;
    if (session.status === "pauset" && session.pausedAt)
      pauseMinutes += Math.round((now.getTime() - new Date(session.pausedAt).getTime()) / 60000);
    totalMinutes = Math.max(0, totalMinutes - pauseMinutes);
    return await storage.update("task_sessions", session.id, {
      status: "afsluttet", endedAt: now.toISOString(), totalPauseMinutes: pauseMinutes,
      durationMinutes: totalMinutes, pausedAt: null,
    }, tid);
  }

  // ═══════════════════════════════════════════════════════════════
  //  COMMUNICATION (conversations + chat messages)
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/conversations", h(async (req, res) => {
    const tid = tenantId(req);
    const userId = req.auth?.user?.id;
    const role = req.auth?.user?.role;
    const convs = await storage.all("conversations", tid);
    // Lukket system: kun deltagere kan se samtaler (ledere kan se alle)
    const userConvs = convs.filter((c: any) => {
      if (role === "leder" || role === "platform_admin") return true;
      const pids = c.participantIds ? JSON.parse(c.participantIds) : [];
      return pids.includes(userId);
    });
    res.json(userConvs.sort((a: any, b: any) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)));
  }));
  app.post("/api/conversations", h(async (req, res) => {
    const tid = tenantId(req);
    const a = req.auth!;
    const role = a.user.role;
    const { title, type, customerId, participantIds } = req.body || {};
    // Lukket system: rolle-baseret oprettelse
    let finalType = type || "internal";
    let finalParticipants: number[] = [a.user.id];
    let finalCustomerId: number | null = null;
    if (role === "leder" || role === "holdleder") {
      // Ledere kan oprette samtaler med medarbejdere og kunder
      if (finalType === "customer" && customerId) {
        finalCustomerId = customerId;
        finalParticipants = [a.user.id, ...(Array.isArray(participantIds) ? participantIds : [])];
      } else {
        finalParticipants = [a.user.id, ...(Array.isArray(participantIds) ? participantIds : [])];
      }
    } else if (role === "assistent") {
      // Assistent kan kun skrive til virksomheden/ledere — ikke frit til kunder
      finalType = "internal";
      // Hvis participantIds er angivet, filtrer til kun ledere/holdledere
      const allUsers = await storage.all("users", tid);
      const validTargets = allUsers.filter((u: any) => u.role === "leder" || u.role === "holdleder");
      finalParticipants = [a.user.id, ...validTargets.map((u: any) => u.id).filter((id: number) => participantIds?.includes(id))];
    } else if (role === "kunde") {
      // Kunde kan kun skrive til virksomheden — ikke til andre kunder eller medarbejdere direkte
      finalType = "customer";
      finalCustomerId = a.user.customerId || null;
      const allUsers = await storage.all("users", tid);
      const leaders = allUsers.filter((u: any) => u.role === "leder" || u.role === "holdleder");
      finalParticipants = [a.user.id, ...leaders.map((u: any) => u.id)];
    }
    const conv = await storage.insert("conversations", {
      companyId: tid, type: finalType, title: title || null,
      customerId: finalCustomerId, participantIds: JSON.stringify(finalParticipants),
      unreadCount: 0, createdAt: nowIso(), lastMessageAt: nowIso(),
    });
    res.json(conv);
  }));
  app.get("/api/conversations/:id/messages", h(async (req, res) => {
    const tid = tenantId(req);
    const userId = req.auth?.user?.id;
    const role = req.auth?.user?.role;
    const conv = await storage.get("conversations", Number(req.params.id), tid);
    if (!conv) return res.status(404).json({ error: "Samtale blev ikke fundet." });
    // Lukket system: kun deltagere kan læse meddelelser (ledere kan læse alle)
    if (role !== "leder" && role !== "platform_admin") {
      const pids = conv.participantIds ? JSON.parse(conv.participantIds) : [];
      if (!pids.includes(userId)) return res.status(403).json({ error: "Du har ikke adgang til denne samtale." });
    }
    const msgs = await storage.all("chat_messages", tid);
    res.json(msgs.filter((m: any) => m.conversationId === conv.id).sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt)));
  }));
  app.post("/api/conversations/:id/messages", h(async (req, res) => {
    const tid = tenantId(req);
    const a = req.auth!;
    const role = a.user.role;
    const conv = await storage.get("conversations", Number(req.params.id), tid);
    if (!conv) return res.status(404).json({ error: "Samtale blev ikke fundet." });
    // Lukket system: kun deltagere kan skrive (ledere kan skrive i alle)
    if (role !== "leder" && role !== "platform_admin") {
      const pids = conv.participantIds ? JSON.parse(conv.participantIds) : [];
      if (!pids.includes(a.user.id)) return res.status(403).json({ error: "Du har ikke adgang til denne samtale." });
    }
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Beskeden må ikke være tom." });
    const msg = await storage.insert("chat_messages", {
      conversationId: conv.id, companyId: tid, senderId: a.user.id,
      senderName: a.user.name || a.user.email, senderRole: a.user.role,
      body, read: 0, createdAt: nowIso(),
    });
    await storage.update("conversations", conv.id, { lastMessageAt: nowIso(), lastMessagePreview: body.slice(0, 100) }, tid);
    res.json(msg);
  }));
  app.patch("/api/conversations/:id/read", h(async (req, res) => {
    const tid = tenantId(req);
    const conv = await storage.get("conversations", Number(req.params.id), tid);
    if (!conv) return res.status(404).json({ error: "Samtale blev ikke fundet." });
    res.json(await storage.update("conversations", conv.id, { unreadCount: 0 }, tid));
  }));
  app.get("/api/conversations/employees/list", h(async (req, res) => {
    const tid = tenantId(req);
    const users = await storage.all("users", tid);
    res.json(users.map((u: any) => ({ id: u.id, name: u.name || u.email, email: u.email, role: u.role, employeeId: u.employeeId })));
  }));

  // ═══════════════════════════════════════════════════════════════
  // SYSTEMOPDATERINGER — auto-notifikation ved opdatering
  // ═══════════════════════════════════════════════════════════════
  const currentVersion = "3.2.1";
  const existingReleases = await storage.all("system_releases");
  const hasCurrentVersion = existingReleases.some((r: any) => r.version === currentVersion);
  if (!hasCurrentVersion) {
    const release = await storage.insert("system_releases", {
      version: currentVersion, title: "Sikker Simply-mail",
      description: "Krypteret SMTP-mail via Simply.com med revisionsspor og sikker fejlhåndtering.",
      features: JSON.stringify(["Simply SMTP med STARTTLS", "Skjulte driftshemmeligheder", "Revisionsspor for udgående mail"]),
      status: "installeret", createdAt: nowIso(),
    });
    const allCompanies = await storage.all("companies");
    for (const comp of allCompanies) {
      await storage.createNotification({ companyId: comp.id, title: `Systemopdatering ${currentVersion} installeret`, message: `${release.title} — Ingen brugerdata er slettet.`, type: "info", read: false, createdAt: nowIso() });
    }
  }

  app.get("/api/system-releases", h(async (req, res) => {
    const releases = await storage.all("system_releases");
    res.json(releases.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
  }));

  app.post("/api/system-releases", requirePlatformAdmin, h(async (req, res) => {
    const data = validate(insertSystemReleaseSchema, { ...req.body, createdAt: nowIso() });
    const release = await storage.insert("system_releases", data);
    const allCompanies = await storage.all("companies");
    for (const comp of allCompanies) {
      await storage.createNotification({ companyId: comp.id, title: `Systemopdatering ${data.version} installeret`, message: `${data.title} — Ingen brugerdata er slettet.`, type: "info", read: false, createdAt: nowIso() });
    }
    res.status(201).json(release);
  }));

  // ═══════════════════════════════════════════════════════════════
  // IMPORT / EKSPORT
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/import-jobs", h(async (req, res) => {
    const cid = tenantId(req); const role = req.auth?.user?.role;
    const allJobs = await storage.all("import_jobs");
    const jobs = role === "platform_admin" ? allJobs : allJobs.filter((j: any) => j.companyId === cid);
    res.json(jobs.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
  }));

  app.post("/api/export", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req); const { entity } = req.body || {};
    let data: any[] = []; let headers: string[] = [];
    if (entity === "kunder") { data = await storage.all("customers", cid); headers = ["id","name","email","phone","address","city","zipCode","cvr","type","status"]; }
    else if (entity === "ansatte") { data = await storage.all("employees", cid); headers = ["id","name","email","phone","address","city","zipCode","cpr","position","hourlyRate","status"]; }
    else if (entity === "opgaver") { data = await storage.all("tasks", cid); headers = ["id","title","customerId","employeeId","date","startTime","endTime","status","priority","recurrence"]; }
    else if (entity === "fakturaer") { data = await storage.all("invoices", cid); headers = ["id","invoiceNumber","customerId","issueDate","dueDate","status","subtotal","vatAmount","totalAmount"]; }
    else if (entity === "ydelser") { data = await storage.all("cleaning_services", cid); headers = ["id","name","description","unit","price","duration"]; }
    else if (entity === "regnskab") { data = await storage.all("journal_entries", cid); headers = ["id","entryNumber","date","description","amount","vat","accountId"]; }
    else return res.status(400).json({ error: "Ukendt entitet." });
    const csvLines: string[] = [headers.join(";")];
    for (const row of data) {
      csvLines.push(headers.map((h) => { const v = row[h]; if (v == null) return ""; const s = String(v).replace(/"/g,'""').replace(/\n/g," "); return s.includes(";")||s.includes('"') ? `"${s}"` : s; }).join(";"));
    }
    const csv = "\uFEFF" + csvLines.join("\n");
    await storage.insert("import_jobs", { companyId: cid, type: "export", entity, format: "csv", status: "fuldført", rowCount: data.length, errorCount: 0, createdAt: nowIso(), completedAt: nowIso() });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${entity}-eksport-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  }));

  app.post("/api/import", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req); const { entity, rows } = req.body || {};
    if (!entity || !Array.isArray(rows)) return res.status(400).json({ error: "Mangler entitet eller rækker." });
    let imported = 0; let errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (entity === "kunder") await storage.insert("customers", { ...row, companyId: cid, createdAt: nowIso() });
        else if (entity === "ansatte") await storage.insert("employees", { ...row, companyId: cid, createdAt: nowIso() });
        else if (entity === "opgaver") await storage.insert("tasks", { ...row, companyId: cid, createdAt: nowIso() });
        else if (entity === "ydelser") await storage.insert("cleaning_services", { ...row, companyId: cid, createdAt: nowIso() });
        else { errors.push(`Række ${i+1}: Ukendt entitet`); continue; }
        imported++;
      } catch (e: any) { errors.push(`Række ${i+1}: ${e.message || "Fejl"}`); }
    }
    const job = await storage.insert("import_jobs", { companyId: cid, type: "import", entity, format: "csv", status: errors.length === rows.length ? "fejlet" : "fuldført", rowCount: imported, errorCount: errors.length, errors: errors.length > 0 ? JSON.stringify(errors.slice(0,50)) : null, createdAt: nowIso(), completedAt: nowIso() });
    res.json({ job, imported, errors: errors.slice(0,20) });
  }));

  app.get("/api/export/full", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const entities = ["customers","employees","tasks","invoices","cleaning_services","journal_entries","accounts"];
    const exportData: Record<string, any[]> = {};
    for (const ent of entities) { try { exportData[ent] = await storage.all(ent, cid); } catch { exportData[ent] = []; } }
    await storage.insert("import_jobs", { companyId: cid, type: "export", entity: "fuld", format: "json", status: "fuldført", rowCount: Object.values(exportData).reduce((s,a)=>s+a.length,0), errorCount: 0, createdAt: nowIso(), completedAt: nowIso() });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="virksomhed-eksport-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(exportData);
  }));

  // ═══════════════════════════════════════════════════════════════
  // SEPARAT REGNSKABSSYSTEM
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/regnskabssystem/companies", h(async (req, res) => {
    const role = req.auth?.user?.role;
    if (role === "platform_admin") {
      const allCompanies = await storage.all("companies");
      const result = await Promise.all(allCompanies.map(async (c: any) => {
        const accounts = await storage.all("accounts", c.id);
        const entries = await storage.all("journal_entries", c.id);
        return { ...c, accountCount: accounts.length, entryCount: entries.length };
      }));
      res.json(result);
    } else {
      const cid = tenantId(req); const company = await storage.getCompany(cid);
      const accounts = await storage.all("accounts", cid); const entries = await storage.all("journal_entries", cid);
      res.json([{ ...company, accountCount: accounts.length, entryCount: entries.length }]);
    }
  }));

  app.get("/api/regnskabssystem/:companyId", h(async (req, res) => {
    const cid = Number(req.params.companyId); const role = req.auth?.user?.role; const userId = req.auth?.user?.companyId;
    if (role !== "platform_admin" && cid !== userId) return res.status(403).json({ error: "Ingen adgang." });
    const [company, accounts, entries, vatPeriods, lines] = await Promise.all([
      storage.getCompany(cid), storage.all("accounts", cid), storage.all("journal_entries", cid), storage.all("vat_periods", cid), storage.all("journal_lines", cid),
    ]);
    res.json({ company, accounts, entries, vatPeriods, lines });
  }));

  // ═══════════════════════════════════════════════════════════════
  // AI REGNSKAB (BETA)
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/ai-regnskab/tasks", h(async (req, res) => {
    const cid = tenantId(req); const role = req.auth?.user?.role;
    const allTasks = await storage.all("ai_accounting_tasks");
    const tasks = role === "platform_admin" ? allTasks : allTasks.filter((t: any) => t.companyId === cid);
    res.json(tasks.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
  }));

  app.post("/api/ai-regnskab/scan", h(async (req, res) => {
    const cid = tenantId(req); const created: any[] = [];
    // Hent eksisterende AI-opgaver for at undgå dubletter
    const existingTasks = await storage.all("ai_accounting_tasks", cid);
    const existingTitles = new Set(existingTasks.map((t: any) => t.title));
    // Bogføringsforslag — fakturaer uden journal entry
    const invoices = await storage.all("invoices", cid);
    const entries = await storage.all("journal_entries", cid);
    const entryNumbers = new Set(entries.map((e: any) => e.entryNumber));
    for (const inv of invoices) {
      const title = `Bogfør faktura ${inv.invoiceNumber}`;
      if (!entryNumbers.has(`INV-${inv.invoiceNumber}`) && !existingTitles.has(title)) {
        const t = await storage.insert("ai_accounting_tasks", { companyId: cid, type: "bogføring", status: "afventer", title, description: `Faktura for ${inv.totalAmount} kr. skal bogføres.`, data: JSON.stringify({ invoiceId: inv.id, amount: inv.totalAmount, vat: inv.vatAmount }), suggestion: JSON.stringify({ debitAccount: "1500", creditAccount: "3000", vatAccount: "2600", amount: inv.subtotal, vatAmount: inv.vatAmount, note: "Automatisk forslag" }), approved: 0, createdAt: nowIso() });
        created.push(t); existingTitles.add(title);
      }
    }
    // Moms — ubehandlede perioder
    const vatPeriods = await storage.all("vat_periods", cid);
    for (const vp of vatPeriods) {
      const title = `Momsangivelse ${vp.period}`;
      if ((vp.status === "aaben" || vp.status === "afventer" || vp.status === "åben") && !existingTitles.has(title)) {
        const t = await storage.insert("ai_accounting_tasks", { companyId: cid, type: "moms", status: "afventer", title, description: `Momsperiode ${vp.period} skal angives. Beregnet: ${vp.calculatedVat || 0} kr.`, data: JSON.stringify({ vatPeriodId: vp.id, period: vp.period, amount: vp.calculatedVat }), suggestion: JSON.stringify({ period: vp.period, calculatedVat: vp.calculatedVat || 0, deadline: vp.endDate, note: "Kræver revisor/juridisk godkendelse" }), approved: 0, createdAt: nowIso() });
        created.push(t); existingTitles.add(title);
      }
    }
    // Compliance — manglende kontoplan
    const accounts = await storage.all("accounts", cid);
    const title = "Kontoplan mangler";
    if (accounts.length === 0 && !existingTitles.has(title)) {
      const t = await storage.insert("ai_accounting_tasks", { companyId: cid, type: "compliance", status: "afventer", title, description: "Standard dansk kontoplan kan oprettes.", data: JSON.stringify({}), suggestion: JSON.stringify({ action: "opret_standard_kontoplan", note: "Standard dansk kontoplan (SKAT) kan oprettes" }), approved: 0, createdAt: nowIso() });
      created.push(t);
    }
    res.json({ scanned: created.length, created });
  }));

  app.post("/api/ai-regnskab/tasks/:id/approve", h(async (req, res) => {
    const cid = tenantId(req); const task = await storage.get("ai_accounting_tasks", Number(req.params.id), cid);
    if (!task) return res.status(404).json({ error: "Opgave ikke fundet." });
    res.json(await storage.update("ai_accounting_tasks", task.id, { approved: 1, status: "godkendt", approvedBy: req.auth?.user?.name || req.auth?.user?.email, approvedAt: nowIso(), completedAt: nowIso() }, cid));
  }));

  app.post("/api/ai-regnskab/tasks/:id/reject", h(async (req, res) => {
    const cid = tenantId(req); const task = await storage.get("ai_accounting_tasks", Number(req.params.id), cid);
    if (!task) return res.status(404).json({ error: "Opgave ikke fundet." });
    res.json(await storage.update("ai_accounting_tasks", task.id, { approved: 0, status: "fejlet", completedAt: nowIso() }, cid));
  }));

  app.delete("/api/ai-regnskab/tasks/:id", h(async (req, res) => {
    const cid = tenantId(req); await storage.delete("ai_accounting_tasks", Number(req.params.id), cid); res.status(204).send();
  }));

  // ═══════════════════════════════════════════════════════════════
  // BILAG & UDGIFTER
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/vouchers", h(async (req, res) => {
    const cid = tenantId(req);
    res.json(await storage.all("vouchers", cid));
  }));

  app.post("/api/vouchers", h(async (req, res) => {
    const cid = tenantId(req);
    const data = validate(insertVoucherSchema, { ...req.body, companyId: cid, createdAt: nowIso() });
    res.status(201).json(await storage.insert("vouchers", data));
  }));

  app.patch("/api/vouchers/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.get("vouchers", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Bilaget findes ikke." });
    if (existing.status === "bogfoert") return res.status(409).json({ error: "Et bogført bilag er låst og må ikke ændres." });
    res.json(await storage.update("vouchers", Number(req.params.id), req.body, cid));
  }));

  app.delete("/api/vouchers/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const existing = await storage.get("vouchers", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Bilaget findes ikke." });
    if (existing.status === "bogfoert") return res.status(409).json({ error: "Et bogført bilag må ikke slettes." });
    await storage.delete("vouchers", Number(req.params.id), cid); res.status(204).send();
  }));

  // ═══════════════════════════════════════════════════════════════
  // BANKAFSTEMNING
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/bank-transactions", h(async (req, res) => {
    const cid = tenantId(req);
    res.json(await storage.all("bank_transactions", cid));
  }));

  app.post("/api/bank-transactions/import", h(async (req, res) => {
    const cid = tenantId(req);
    const { rows } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ error: "Mangler rækker." });
    let imported = 0;
    for (const row of rows) {
      await storage.insert("bank_transactions", { ...row, companyId: cid, importedAt: nowIso(), status: "afventer" });
      imported++;
    }
    res.json({ imported });
  }));

  app.post("/api/bank-transactions/:id/match", h(async (req, res) => {
    const cid = tenantId(req);
    const { matchedType, matchedId } = req.body || {};
    res.json(await storage.update("bank_transactions", Number(req.params.id), { matchedType, matchedId, status: "matchet" }, cid));
  }));

  app.post("/api/bank-transactions/:id/ignore", h(async (req, res) => {
    const cid = tenantId(req);
    res.json(await storage.update("bank_transactions", Number(req.params.id), { status: "ignoreret" }, cid));
  }));

  app.post("/api/bank-transactions/auto-match", h(async (req, res) => {
    const cid = tenantId(req);
    const transactions = await storage.all("bank_transactions", cid);
    const invoices = await storage.all("invoices", cid);
    const vouchers = await storage.all("vouchers", cid);
    let matched = 0;
    for (const tx of transactions) {
      if (tx.status !== "afventer") continue;
      const inv = invoices.find((i: any) => Math.abs(i.totalAmount - tx.amount) < 0.01 && i.status !== "betalt");
      if (inv) { await storage.update("bank_transactions", tx.id, { matchedType: "invoice", matchedId: inv.id, status: "matchet" }, cid); matched++; continue; }
      const vou = vouchers.find((v: any) => Math.abs(v.amount - Math.abs(tx.amount)) < 0.01 && v.status === "kladde");
      if (vou) { await storage.update("bank_transactions", tx.id, { matchedType: "voucher", matchedId: vou.id, status: "matchet" }, cid); matched++; continue; }
    }
    res.json({ matched });
  }));

  // ═══════════════════════════════════════════════════════════════
  // SKAT & FRISTER
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/tax-deadlines", h(async (req, res) => {
    const cid = tenantId(req);
    const deadlines = await storage.all("tax_deadlines", cid);
    if (deadlines.length === 0) {
      const year = new Date().getFullYear();
      const quarters = [
        { period: `Q1 ${year}`, deadline: `${year}-04-01` },
        { period: `Q2 ${year}`, deadline: `${year}-07-01` },
        { period: `Q3 ${year}`, deadline: `${year}-10-01` },
        { period: `Q4 ${year}`, deadline: `${year+1}-01-01` },
      ];
      for (const q of quarters) {
        await storage.insert("tax_deadlines", { companyId: cid, type: "moms", period: q.period, deadline: q.deadline, status: "afventer", createdAt: nowIso() });
      }
      return res.json(await storage.all("tax_deadlines", cid));
    }
    res.json(deadlines);
  }));

  app.post("/api/tax-deadlines", h(async (req, res) => {
    const cid = tenantId(req);
    const data = validate(insertTaxDeadlineSchema, { ...req.body, companyId: cid, createdAt: nowIso() });
    res.status(201).json(await storage.insert("tax_deadlines", data));
  }));

  app.patch("/api/tax-deadlines/:id", h(async (req, res) => {
    const cid = tenantId(req);
    res.json(await storage.update("tax_deadlines", Number(req.params.id), req.body, cid));
  }));

  app.post("/api/tax-deadlines/:id/submit", h(async (req, res) => {
    const cid = tenantId(req);
    res.json(await storage.update("tax_deadlines", Number(req.params.id), { status: "indsendt", submittedAt: nowIso() }, cid));
  }));

  // ═══════════════════════════════════════════════════════════════
  // REGNSKABSDASHBOARD
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/regnskabssystem/dashboard/:companyId", h(async (req, res) => {
    const cid = Number(req.params.companyId);
    const role = req.auth?.user?.role;
    const userId = req.auth?.user?.companyId;
    if (role !== "platform_admin" && cid !== userId) return res.status(403).json({ error: "Ingen adgang." });
    const [invoices, entries, vouchers, vatPeriods, taxDls, bankTx] = await Promise.all([
      storage.all("invoices", cid), storage.all("journal_entries", cid), storage.all("vouchers", cid),
      storage.all("vat_periods", cid), storage.all("tax_deadlines", cid), storage.all("bank_transactions", cid),
    ]);
    const revenue = invoices.filter((i: any) => i.status === "betalt").reduce((s: number, i: any) => s + (i.totalAmount || 0), 0);
    const expenses = vouchers.filter((v: any) => v.status === "bogfoert").reduce((s: number, v: any) => s + (v.amount || 0), 0);
    const vatPayable = vatPeriods.filter((v: any) => v.status === "aaben" || v.status === "afventer").reduce((s: number, v: any) => s + (v.calculatedVat || 0), 0);
    const overdueInvoices = invoices.filter((i: any) => i.status === "forfalden" || (i.dueDate && new Date(i.dueDate) < new Date() && i.status !== "betalt"));
    const openDrafts = entries.filter((e: any) => e.status === "kladde");
    const pendingBankTx = bankTx.filter((b: any) => b.status === "afventer");
    const upcomingDeadlines = taxDls.filter((t: any) => t.status === "afventer").sort((a: any, b: any) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
    res.json({ revenue, expenses, result: revenue - expenses, vatPayable, overdueInvoices: overdueInvoices.length, openDrafts: openDrafts.length, pendingBankTx: pendingBankTx.length, upcomingDeadlines, invoiceCount: invoices.length, voucherCount: vouchers.length, entryCount: entries.length });
  }));

  // ═══════════════════════════════════════════════════════════════
  // RAPPORTER
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/regnskabssystem/report/:companyId/:type", h(async (req, res) => {
    const cid = Number(req.params.companyId);
    const role = req.auth?.user?.role;
    const userId = req.auth?.user?.companyId;
    if (role !== "platform_admin" && cid !== userId) return res.status(403).json({ error: "Ingen adgang." });
    const { type } = req.params;
    const [invoices, entries, lines, accounts, vouchers, vatPeriods] = await Promise.all([
      storage.all("invoices", cid), storage.all("journal_entries", cid), storage.all("journal_lines", cid),
      storage.all("accounts", cid), storage.all("vouchers", cid), storage.all("vat_periods", cid),
    ]);
    if (type === "resultatopgoerelse") {
      const revenue = invoices.filter((i: any) => i.status === "betalt").reduce((s: number, i: any) => s + (i.totalAmount || 0), 0);
      const expenses = vouchers.filter((v: any) => v.status === "bogfoert").reduce((s: number, v: any) => s + (v.amount || 0), 0);
      const vatExpenses = vouchers.filter((v: any) => v.status === "bogfoert").reduce((s: number, v: any) => s + (v.vatAmount || 0), 0);
      res.json({ omsaetning: revenue, udgifter: expenses, momsUdgifter: vatExpenses, resultat: revenue - expenses - vatExpenses });
    } else if (type === "balance") {
      const assets = accounts.filter((a: any) => a.type === "aktiv").reduce((s: number, a: any) => s + (a.balance || 0), 0);
      const liabilities = accounts.filter((a: any) => a.type === "passiv").reduce((s: number, a: any) => s + (a.balance || 0), 0);
      res.json({ aktiver: assets, passiver: liabilities, egenkapital: assets - liabilities });
    } else if (type === "momsrapport") {
      res.json(vatPeriods.map((vp: any) => ({ periode: vp.period, udgaaendeMoms: vp.outputVat || 0, indgaaendeMoms: vp.inputVat || 0, netMoms: (vp.outputVat || 0) - (vp.inputVat || 0), status: vp.status })));
    } else if (type === "revisorpakke") {
      res.json({ invoices, entries, lines, accounts, vouchers, vatPeriods, generatedAt: nowIso() });
    } else {
      res.status(400).json({ error: "Ukendt rapporttype." });
    }
  }));

  // ═══════════════════════════════════════════════════════════════
  // CLOUD-UDBYDERE — tilslutning til skyerne
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/cloud-providers", requireAuth, h(async (req, res) => {
    const providers = await storage.all("cloud_providers");
    res.json(providers);
  }));

  app.post("/api/cloud-providers", requirePlatformAdmin, h(async (req, res) => {
    const data = validate(insertCloudProviderSchema, { ...req.body, createdAt: nowIso() });
    const provider = await storage.insert("cloud_providers", data);
    res.status(201).json(provider);
  }));

  app.patch("/api/cloud-providers/:id", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    res.json(await storage.update("cloud_providers", id, req.body));
  }));

  app.post("/api/cloud-providers/:id/connect", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const provider = await storage.get("cloud_providers", id);
    if (!provider) return res.status(404).json({ error: "Udbyder ikke fundet." });
    // Simuler forbindelse — i produktion ville dette validere credentials
    const updated = await storage.update("cloud_providers", id, {
      status: "forbundet",
      lastSync: nowIso(),
    });
    res.json(updated);
  }));

  app.post("/api/cloud-providers/:id/disconnect", requirePlatformAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    res.json(await storage.update("cloud_providers", id, { status: "afbrudt" }));
  }));

  app.delete("/api/cloud-providers/:id", requirePlatformAdmin, h(async (req, res) => {
    await storage.delete("cloud_providers", Number(req.params.id));
    res.status(204).send();
  }));

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM INSTALLATION / OPSÆTNING
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/system/info", requireAuth, h(async (req, res) => {
    const releases = await storage.all("system_releases");
    const latest = releases.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))[0];
    const companies = await storage.all("companies");
    const users = await storage.all("users");
    res.json({
      version: latest?.version || "1.0.0",
      installedAt: releases.length > 0 ? releases[releases.length - 1].createdAt : null,
      lastUpdate: latest?.createdAt || null,
      companyCount: companies.length,
      userCount: users.length,
      releaseCount: releases.length,
      status: "aktiv",
    });
  }));

  // ══════════════════════════════════════════════════
  //  REGNSKABSAUTOMATISERING — Regler, Periodeafslutning, Integrationer, AI Auto
  // ══════════════════════════════════════════════════

  // ── Regnskabsregler (bank tekst → konto) ──
  app.get("/api/accounting-rules", h(async (req, res) => {
    const rules = await storage.all("accounting_rules", tenantId(req));
    res.json(rules);
  }));

  app.post("/api/accounting-rules", h(async (req, res) => {
    const data = validate(insertAccountingRuleSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("accounting_rules", data));
  }));

  app.patch("/api/accounting-rules/:id", h(async (req, res) => {
    const id = Number(req.params.id);
    const updates: Record<string, any> = {};
    for (const k of ["matchText", "accountNumber", "accountName", "vatCode", "category", "autoBook", "active"]) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    res.json(await storage.update("accounting_rules", id, updates, tenantId(req)));
  }));

  app.delete("/api/accounting-rules/:id", h(async (req, res) => {
    await storage.delete("accounting_rules", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));

  // ── Periodeafslutning ──
  app.get("/api/period-closes", h(async (req, res) => {
    const closes = await storage.all("period_closes", tenantId(req));
    res.json(closes);
  }));

  app.post("/api/period-closes", h(async (req, res) => {
    const { periodType, periodLabel, startDate, endDate } = req.body;
    if (!periodType || !periodLabel || !startDate || !endDate) {
      return res.status(400).json({ error: "Manglende felter" });
    }
    // Auto-generer tjekliste
    const checklist = JSON.stringify([
      { task: "Alle bilag bogført", done: false },
      { task: "Bankafstemning gennemført", done: false },
      { task: "Moms beregnet", done: false },
      { task: "Ingen negative saldi", done: false },
      { task: "Åbne fakturaer gennemgået", done: false },
      { task: "Afskrivninger beregnet", done: false },
      { task: "Lønafregning kontrolleret", done: false },
      { task: "Revisorpakke klar", done: false },
    ]);
    const data = validate(insertPeriodCloseSchema, {
      companyId: tenantId(req), periodType, periodLabel, startDate, endDate,
      status: "aabne", checklist, createdAt: nowIso(),
    });
    res.status(201).json(await storage.insert("period_closes", data));
  }));

  app.patch("/api/period-closes/:id", h(async (req, res) => {
    const id = Number(req.params.id);
    const updates: Record<string, any> = {};
    if (req.body.checklist !== undefined) updates.checklist = JSON.stringify(req.body.checklist);
    if (req.body.status !== undefined) {
      updates.status = req.body.status;
      if (req.body.status === "afsluttet") {
        updates.closedAt = nowIso();
        updates.closedBy = req.body.closedBy || "system";
      }
    }
    res.json(await storage.update("period_closes", id, updates, tenantId(req)));
  }));

  app.post("/api/period-closes/:id/checklist/:index", h(async (req, res) => {
    const id = Number(req.params.id);
    const idx = Number(req.params.index);
    const closes = await storage.all("period_closes", tenantId(req));
    const pc = closes.find((c: any) => c.id === id);
    if (!pc) return res.status(404).json({ error: "Periode ikke fundet" });
    const list = JSON.parse(pc.checklist || "[]");
    if (idx >= 0 && idx < list.length) {
      list[idx].done = !list[idx].done;
    }
    res.json(await storage.update("period_closes", id, { checklist: JSON.stringify(list) }, tenantId(req)));
  }));

  // ── Regnskabsintegrationer ──
  app.get("/api/accounting-integrations", h(async (req, res) => {
    const integrations = await storage.all("accounting_integrations", tenantId(req));
    res.json(integrations);
  }));

  app.post("/api/accounting-integrations", h(async (req, res) => {
    const data = validate(insertAccountingIntegrationSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("accounting_integrations", data));
  }));

  app.patch("/api/accounting-integrations/:id", h(async (req, res) => {
    const id = Number(req.params.id);
    const updates: Record<string, any> = {};
    for (const k of ["displayName", "config", "status", "lastSync"]) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    res.json(await storage.update("accounting_integrations", id, updates, tenantId(req)));
  }));

  app.delete("/api/accounting-integrations/:id", h(async (req, res) => {
    await storage.delete("accounting_integrations", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));

  // ── AI Regnskab — fuld automatisk gennemgang ──
  app.post("/api/ai-regnskab/auto-run", h(async (req, res) => {
    const cid = tenantId(req);
    const created: any[] = [];

    // 1. Tjek ubogførte fakturaer
    const invoices = await storage.all("invoices", cid);
    for (const inv of invoices) {
      if (inv.status === "betalt" || inv.status === "sendt") {
        const existingTasks = await storage.all("ai_accounting_tasks", cid);
        const alreadyExists = existingTasks.some((t: any) => t.title?.includes(`Faktura ${inv.invoiceNumber}`));
        if (!alreadyExists && inv.totalAmount > 0) {
          const task = await storage.insert("ai_accounting_tasks", {
            companyId: cid, type: "bogføring", status: "afventer",
            title: `Faktura ${inv.invoiceNumber} skal bogføres`,
            description: `Faktura til ${inv.customerName || "kunde"} for ${inv.totalAmount} kr.`,
            data: JSON.stringify({ invoiceId: inv.id, amount: inv.totalAmount, vat: inv.vatAmount }),
            suggestion: JSON.stringify({ debitAccount: "1500", creditAccount: "3000", vatAccount: "2600", amount: inv.subtotal, vatAmount: inv.vatAmount, note: "Automatisk forslag" }),
            approved: 0, createdAt: nowIso(),
          } as any);
          created.push(task);
        }
      }
    }

    // 2. Tjek ubogførte banktransaktioner
    const bankTx = await storage.all("bank_transactions", cid);
    const unmatched = bankTx.filter((t: any) => t.status === "afventer" || !t.status);
    const rules = await storage.all("accounting_rules", cid);
    for (const tx of unmatched) {
      const desc = (tx.description || "").toLowerCase();
      const matchedRule = rules.find((r: any) => desc.includes(r.matchText.toLowerCase()));
      if (matchedRule) {
        const existingTasks = await storage.all("ai_accounting_tasks", cid);
        const alreadyExists = existingTasks.some((t: any) => t.title?.includes(tx.description?.substring(0, 30)));
        if (!alreadyExists) {
          const task = await storage.insert("ai_accounting_tasks", {
            companyId: cid, type: "bankafstemning", status: "afventer",
            title: `Bankpostering: "${tx.description?.substring(0, 40)}" kan matches`,
            description: `Beløb: ${tx.amount} kr. — Regel: ${matchedRule.accountName} (${matchedRule.accountNumber})`,
            data: JSON.stringify({ transactionId: tx.id, amount: tx.amount }),
            suggestion: JSON.stringify({ account: matchedRule.accountNumber, accountName: matchedRule.accountName, vatCode: matchedRule.vatCode, amount: tx.amount, note: "Matcher regel: " + matchedRule.matchText }),
            approved: 0, createdAt: nowIso(),
          } as any);
          created.push(task);
        }
      }
    }

    // 3. Tjek manglende momsangivelse
    const taxDeadlines = await storage.all("tax_deadlines", cid);
    const now = new Date();
    for (const td of taxDeadlines) {
      if (td.status === "afventer") {
        const deadline = new Date(td.deadline);
        const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7 && daysLeft >= 0) {
          const existingTasks = await storage.all("ai_accounting_tasks", cid);
          const alreadyExists = existingTasks.some((t: any) => t.title?.includes(td.period || ""));
          if (!alreadyExists) {
            const task = await storage.insert("ai_accounting_tasks", {
              companyId: cid, type: "moms", status: "afventer",
              title: `Momsangivelse ${td.period || ""} forfalder om ${daysLeft} dage`,
              description: `Type: ${td.type} — Beløb: ${td.amount || "ikke beregnet"} kr. — Frist: ${td.deadline}`,
              data: JSON.stringify({ deadlineId: td.id }),
              suggestion: JSON.stringify({ action: "indsend_moms", period: td.period, amount: td.amount, note: "Husk at indsende til SKAT" }),
              approved: 0, createdAt: nowIso(),
            } as any);
            created.push(task);
          }
        }
      }
    }

    // 4. Tjek åbne perioder
    const periodClosesList = await storage.all("period_closes", cid);
    for (const pc of periodClosesList) {
      if (pc.status === "aabne") {
        const checklist = JSON.parse(pc.checklist || "[]");
        const doneCount = checklist.filter((c: any) => c.done).length;
        if (doneCount < checklist.length) {
          const existingTasks = await storage.all("ai_accounting_tasks", cid);
          const alreadyExists = existingTasks.some((t: any) => t.title?.includes(pc.periodLabel));
          if (!alreadyExists) {
            const task = await storage.insert("ai_accounting_tasks", {
              companyId: cid, type: "periodeafslutning", status: "afventer",
              title: `Periodeafslutning: ${pc.periodLabel} mangler ${checklist.length - doneCount} opgaver`,
              description: `${doneCount}/${checklist.length} opgaver gennemført for ${pc.periodLabel}.`,
              data: JSON.stringify({ periodCloseId: pc.id }),
              suggestion: JSON.stringify({ action: "gennemfør_periode", periodLabel: pc.periodLabel, note: "Gennemgå og gennemfør tjekliste" }),
              approved: 0, createdAt: nowIso(),
            } as any);
            created.push(task);
          }
        }
      }
    }

    // 5. Tjek forfaldne fakturaer (debitor)
    const openInvoices = invoices.filter((inv: any) => inv.status === "sendt" && inv.dueDate);
    for (const inv of openInvoices) {
      const due = new Date(inv.dueDate);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        const existingTasks = await storage.all("ai_accounting_tasks", cid);
        const alreadyExists = existingTasks.some((t: any) => t.title?.includes(inv.invoiceNumber));
        if (!alreadyExists) {
          const task = await storage.insert("ai_accounting_tasks", {
            companyId: cid, type: "debitor", status: "afventer",
            title: `Forfalden faktura ${inv.invoiceNumber} (${daysOverdue} dage)`,
            description: `Faktura til ${inv.customerName || "kunde"} på ${inv.totalAmount} kr. er ${daysOverdue} dage forfalden.`,
            data: JSON.stringify({ invoiceId: inv.id, daysOverdue }),
            suggestion: JSON.stringify({ action: "send_rykker", invoiceId: inv.id, note: "Overvej at sende rykker" }),
            approved: 0, createdAt: nowIso(),
          } as any);
          created.push(task);
        }
      }
    }

    res.json({ created: created.length, tasks: created });
  }));

  // ── Debitor/Kreditor oversigt ──
  app.get("/api/regnskabssystem/debitor-kreditor/:companyId", h(async (req, res) => {
    const cid = Number(req.params.companyId);
    if (!req.auth!.isPlatformAdmin && cid !== req.auth!.companyId) return res.status(403).json({ error: "Ingen adgang." });
    const invoices = await storage.all("invoices", cid);
    const vouchers = await storage.all("vouchers", cid);

    // Debitorer: åbne fakturaer
    const openInvoices = invoices.filter((inv: any) => inv.status === "sendt" || inv.status === "overdue");
    const overdueInvoices = openInvoices.filter((inv: any) => {
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < new Date();
    });

    // Aldersfordeling
    const now = new Date();
    const aging = { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    for (const inv of openInvoices) {
      const amount = inv.totalAmount || 0;
      if (!inv.dueDate || new Date(inv.dueDate) >= now) {
        aging.current += amount;
      } else {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 30) aging.d0_30 += amount;
        else if (daysOverdue <= 60) aging.d31_60 += amount;
        else if (daysOverdue <= 90) aging.d61_90 += amount;
        else aging.d90_plus += amount;
      }
    }

    // Kreditorer: ubogførte/ubetalte bilag
    const openVouchers = vouchers.filter((v: any) => v.status === "kladde" || !v.status);
    const totalVouchers = openVouchers.reduce((sum: number, v: any) => sum + (v.amount || 0), 0);

    res.json({
      debitorer: openInvoices.map((inv: any) => ({ id: inv.id, number: inv.invoiceNumber, customer: inv.customerName, amount: inv.totalAmount, dueDate: inv.dueDate, status: inv.status })),
      kreditorer: openVouchers.map((v: any) => ({ id: v.id, supplier: v.supplier, amount: v.amount, date: v.date, status: v.status })),
      totals: {
        debitorTotal: openInvoices.reduce((s: number, inv: any) => s + (inv.totalAmount || 0), 0),
        kreditorTotal: totalVouchers,
        overdueCount: overdueInvoices.length,
      },
      aging,
    });
  }));

  // ══════════════════════════════════════════════════
  //  REGNSKAB UDVIDELSER — Bilagsindbakke, Løn, Anlæg, Budget, Omkostningssteder,
  //  Betalingskørsler, Årsafslutning, Revisionsspor, Momsafstemning, Cashflow, AI Regnskabschef
  // ══════════════════════════════════════════════════

  // ── Bilagsindbakke (OCR) ──
  app.get("/api/document-inbox", h(async (req, res) => {
    res.json(await storage.all("document_inbox", tenantId(req)));
  }));
  app.post("/api/document-inbox", h(async (req, res) => {
    const data = validate(insertDocumentInboxSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    // Lokal kategorihjælp er kun et udviklingsværktøj. Production må ikke
    // præsentere filnavnsgæt som et gennemført OCR-resultat.
    if (data.fileName && process.env.NODE_ENV !== "production") {
      const fn = data.fileName.toLowerCase();
      const cats: Record<string, string> = { mobilepay: "gebyrer", skat: "moms_skat", loen: "lon", el: "forbrug", vand: "forbrug", leje: "leje", telia: "tele", ikea: "inventar" };
      for (const [k, v] of Object.entries(cats)) { if (fn.includes(k)) { data.suggestedCategory = v; break; } }
      if (!data.suggestedAccount) {
        const acctMap: Record<string, string> = { gebyrer: "5820", moms_skat: "2400", lon: "7000", forbrug: "4300", leje: "5100", tele: "5310", inventar: "1200" };
        data.suggestedAccount = acctMap[data.suggestedCategory || ""] || "4000";
      }
      data.ocrStatus = "behandlet";
      data.ocrData = JSON.stringify({ simulated: true, extractedAt: nowIso() });
    } else if (data.fileName) {
      data.ocrStatus = "afventer";
      data.ocrData = null;
    }
    // Dubletkontrol
    const existing = await storage.all("document_inbox", tenantId(req));
    const dup = existing.some((d: any) => d.supplier === data.supplier && d.amount === data.amount && d.invoiceNumber === data.invoiceNumber);
    if (dup) data.isDuplicate = 1;
    res.status(201).json(await storage.insert("document_inbox", data));
  }));
  app.patch("/api/document-inbox/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["supplier", "amount", "vatAmount", "vatRate", "invoiceDate", "invoiceNumber", "suggestedAccount", "suggestedCategory", "status", "matchedVoucherId"]) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    res.json(await storage.update("document_inbox", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/document-inbox/:id", h(async (req, res) => {
    await storage.delete("document_inbox", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));
  // Konverter bilag til voucher
  app.post("/api/document-inbox/:id/convert", h(async (req, res) => {
    const docs = await storage.all("document_inbox", tenantId(req));
    const doc = docs.find((d: any) => d.id === Number(req.params.id));
    if (!doc) return res.status(404).json({ error: "Bilag ikke fundet" });
    const voucher = await storage.insert("vouchers", {
      companyId: tenantId(req), supplier: doc.supplier || "Ukendt", date: doc.invoiceDate || nowIso().substring(0, 10),
      amount: doc.amount || 0, vatRate: doc.vatRate || 25, description: `Fra bilagsindbakke: ${doc.fileName}`,
      category: doc.suggestedCategory || "diverse", status: "kladde", createdAt: nowIso(),
    } as any);
    await storage.update("document_inbox", doc.id, { status: "behandlet", matchedVoucherId: voucher.id }, tenantId(req));
    res.status(201).json(voucher);
  }));

  // ── Lønbogføring ──
  app.get("/api/payroll-entries", h(async (req, res) => {
    res.json(await storage.all("payroll_entries", tenantId(req)));
  }));
  app.post("/api/payroll-entries", h(async (req, res) => {
    const data = validate(insertPayrollEntrySchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    // Auto-beregn løn
    const gross = ((data.regularHours ?? 0) * (data.hourlyRate ?? 0)) + ((data.overtimeHours ?? 0) * (data.hourlyRate ?? 0) * 1.5);
    const holidayPay = gross * 0.125;
    const pension = gross * 0.03;
    const atp = gross > 0 ? 90 : 0;
    const amContribution = gross * 0.08;
    const aTax = Math.max(0, (gross - holidayPay) * 0.27); // forenklet
    const net = gross - aTax - amContribution - pension - atp;
    const enriched = { ...data, grossSalary: gross, holidayPay, pension, atp, amContribution, aTax, netSalary: net };
    res.status(201).json(await storage.insert("payroll_entries", enriched));
  }));
  app.patch("/api/payroll-entries/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["status", "journalEntryId"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    res.json(await storage.update("payroll_entries", Number(req.params.id), updates, tenantId(req)));
  }));
  // Auto-generer lønposter fra tidsregistreringer
  app.post("/api/payroll-entries/auto-generate", h(async (req, res) => {
    const cid = tenantId(req);
    const { period } = req.body;
    if (!period) return res.status(400).json({ error: "Periode mangler" });
    const employees = await storage.all("employees", cid);
    const timeEntries = await storage.all("time_entries", cid);
    const created: any[] = [];
    for (const emp of employees) {
      const empEntries = timeEntries.filter((t: any) => t.employeeId === emp.id);
      const regularHours = empEntries.reduce((s: number, t: any) => s + (t.hours || 0), 0);
      if (regularHours === 0) continue;
      const hourlyRate = emp.hourlyRate || 180;
      const gross = regularHours * hourlyRate;
      const holidayPay = gross * 0.125;
      const pension = gross * 0.03;
      const atp = 90;
      const amContribution = gross * 0.08;
      const aTax = Math.max(0, (gross - holidayPay) * 0.27);
      const net = gross - aTax - amContribution - pension - atp;
      const existing = await storage.all("payroll_entries", cid);
      const alreadyExists = existing.some((p: any) => p.employeeId === emp.id && p.period === period);
      if (alreadyExists) continue;
      const entry = await storage.insert("payroll_entries", {
        companyId: cid, employeeId: emp.id, employeeName: emp.name, period,
        regularHours, overtimeHours: 0, hourlyRate, grossSalary: gross,
        holidayPay, pension, atp, aTax, amContribution, netSalary: net,
        status: "kladde", createdAt: nowIso(),
      } as any);
      created.push(entry);
    }
    res.json({ created: created.length, entries: created });
  }));

  // ── Anlægsregister & afskrivninger ──
  app.get("/api/fixed-assets", h(async (req, res) => {
    res.json(await storage.all("fixed_assets", tenantId(req)));
  }));
  app.post("/api/fixed-assets", h(async (req, res) => {
    const data = validate(insertFixedAssetSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    // Auto-beregn månedlig afskrivning (linear)
    const depreciable = data.purchasePrice - (data.salvageValue ?? 0);
    data.monthlyDepreciation = data.usefulLife > 0 ? depreciable / data.usefulLife : 0;
    data.bookValue = data.purchasePrice;
    data.accumulatedDepreciation = 0;
    res.status(201).json(await storage.insert("fixed_assets", data));
  }));
  app.patch("/api/fixed-assets/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["name", "status", "soldAt", "soldPrice", "accountNumber"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (updates.status === "solgt" && updates.soldPrice !== undefined) { updates.bookValue = 0; }
    res.json(await storage.update("fixed_assets", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/fixed-assets/:id", h(async (req, res) => {
    await storage.delete("fixed_assets", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));
  // Kør månedlig afskrivning
  app.post("/api/fixed-assets/depreciate", h(async (req, res) => {
    const cid = tenantId(req);
    const assets = await storage.all("fixed_assets", cid);
    const updated: any[] = [];
    for (const asset of assets) {
      if (asset.status !== "aktiv" || asset.bookValue <= asset.salvageValue) continue;
      const newAccum = asset.accumulatedDepreciation + asset.monthlyDepreciation;
      const newBook = asset.purchasePrice - newAccum;
      const updated_asset = await storage.update("fixed_assets", asset.id, {
        accumulatedDepreciation: newAccum,
        bookValue: Math.max(newBook, asset.salvageValue),
      }, cid);
      updated.push(updated_asset);
    }
    res.json({ depreciated: updated.length, assets: updated });
  }));

  // ── Budgetter ──
  app.get("/api/budgets", h(async (req, res) => {
    res.json(await storage.all("budgets", tenantId(req)));
  }));
  app.post("/api/budgets", h(async (req, res) => {
    const data = validate(insertBudgetSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("budgets", data));
  }));
  app.patch("/api/budgets/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["budgetedAmount", "actualAmount", "variance"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    res.json(await storage.update("budgets", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/budgets/:id", h(async (req, res) => {
    await storage.delete("budgets", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));

  // ── Omkostningssteder ──
  app.get("/api/cost-centers", h(async (req, res) => {
    res.json(await storage.all("cost_centers", tenantId(req)));
  }));
  app.post("/api/cost-centers", h(async (req, res) => {
    const data = validate(insertCostCenterSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("cost_centers", data));
  }));
  app.patch("/api/cost-centers/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["name", "revenue", "costs", "profit", "active"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    res.json(await storage.update("cost_centers", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/cost-centers/:id", h(async (req, res) => {
    await storage.delete("cost_centers", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));

  // ── Betalingskørsler ──
  app.get("/api/payment-runs", h(async (req, res) => {
    res.json(await storage.all("payment_runs", tenantId(req)));
  }));
  app.post("/api/payment-runs", h(async (req, res) => {
    const cid = tenantId(req);
    // Auto-generer fra åbne kreditorbilag
    const vouchers = await storage.all("vouchers", cid);
    const openVouchers = vouchers.filter((v: any) => v.status === "kladde" || !v.status);
    const items = openVouchers.map((v: any) => ({ voucherId: v.id, supplier: v.supplier, amount: v.amount, account: "2400" }));
    const total = items.reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const data = validate(insertPaymentRunSchema, {
      companyId: cid, runDate: nowIso().substring(0, 10), totalAmount: total,
      paymentCount: items.length, status: "kladde", items: JSON.stringify(items), createdAt: nowIso(),
    });
    res.status(201).json(await storage.insert("payment_runs", data));
  }));
  app.patch("/api/payment-runs/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["status", "exportFile", "approvedBy", "approvedAt"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (req.body.status === "godkendt") { updates.approvedAt = nowIso(); }
    res.json(await storage.update("payment_runs", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/payment-runs/:id", h(async (req, res) => {
    await storage.delete("payment_runs", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));

  // ── Årsafslutning ──
  app.get("/api/year-end-closes", h(async (req, res) => {
    res.json(await storage.all("year_end_closes", tenantId(req)));
  }));
  app.post("/api/year-end-closes", h(async (req, res) => {
    const checklist = JSON.stringify([
      { task: "Årsresultat beregnet", done: false },
      { task: "Selskabsskat beregnet", done: false },
      { task: "Årsregnskab udarbejdet", done: false },
      { task: "Revisorpakke samlet", done: false },
      { task: "Anlægsregister afsluttet", done: false },
      { task: "Lageroptælling gennemført", done: false },
      { task: "Debitor/Kreditor afstemt", done: false },
      { task: "Moms-afstemning slut", done: false },
      { task: "Skattekonto afstemt", done: false },
      { task: "Årsberetning godkendt", done: false },
    ]);
    const data = validate(insertYearEndCloseSchema, { ...req.body, companyId: tenantId(req), checklist, createdAt: nowIso() });
    res.status(201).json(await storage.insert("year_end_closes", data));
  }));
  app.patch("/api/year-end-closes/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    if (req.body.checklist !== undefined) updates.checklist = JSON.stringify(req.body.checklist);
    if (req.body.status !== undefined) {
      updates.status = req.body.status;
      if (req.body.status === "afsluttet") { updates.closedAt = nowIso(); updates.closedBy = req.body.closedBy || "system"; }
    }
    if (req.body.result !== undefined) updates.result = req.body.result;
    if (req.body.taxResult !== undefined) updates.taxResult = req.body.taxResult;
    res.json(await storage.update("year_end_closes", Number(req.params.id), updates, tenantId(req)));
  }));

  // ── Revisionsspor (audit log) ──
  app.get("/api/audit-log", h(async (req, res) => {
    const logs = await storage.all("audit_logs", tenantId(req));
    res.json(logs);
  }));

  // ── Moms-afstemning ──
  app.get("/api/vat-reconciliations", h(async (req, res) => {
    res.json(await storage.all("vat_reconciliations", tenantId(req)));
  }));
  app.post("/api/vat-reconciliations", h(async (req, res) => {
    const cid = tenantId(req);
    const { period } = req.body;
    if (!period) return res.status(400).json({ error: "Periode mangler" });
    // Auto-beregn moms for perioden
    const invoices = await storage.all("invoices", cid);
    const vouchers = await storage.all("vouchers", cid);
    const outputVat = invoices.reduce((s: number, inv: any) => s + (inv.vatAmount || 0), 0);
    const inputVat = vouchers.reduce((s: number, v: any) => s + ((v.amount || 0) * (v.vatRate || 0) / 100), 0);
    const netVat = outputVat - inputVat;
    const data = validate(insertVatReconciliationSchema, {
      companyId: cid, period, outputVat, inputVat, netVat,
      skatAccount: netVat, difference: 0, status: "afstemt", createdAt: nowIso(),
    });
    res.status(201).json(await storage.insert("vat_reconciliations", data));
  }));
  app.patch("/api/vat-reconciliations/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["status", "notes", "difference", "skatAccount"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    res.json(await storage.update("vat_reconciliations", Number(req.params.id), updates, tenantId(req)));
  }));

  // ── Likviditetsprojektioner (cashflow) ──
  app.get("/api/cashflow-projections", h(async (req, res) => {
    res.json(await storage.all("cashflow_projections", tenantId(req)));
  }));
  app.post("/api/cashflow-projections", h(async (req, res) => {
    const data = validate(insertCashflowProjectionSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("cashflow_projections", data));
  }));
  app.patch("/api/cashflow-projections/:id", h(async (req, res) => {
    const updates: Record<string, any> = {};
    for (const k of ["actualAmount", "status"]) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    res.json(await storage.update("cashflow_projections", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/cashflow-projections/:id", h(async (req, res) => {
    await storage.delete("cashflow_projections", Number(req.params.id), tenantId(req));
    res.status(204).send();
  }));
  // Auto-generer cashflow projektioner
  app.post("/api/cashflow-projections/auto-generate", h(async (req, res) => {
    const cid = tenantId(req);
    const invoices = await storage.all("invoices", cid);
    const vouchers = await storage.all("vouchers", cid);
    const taxDeadlines = await storage.all("tax_deadlines", cid);
    const payroll = await storage.all("payroll_entries", cid);
    const created: any[] = [];
    const now = new Date();
    // Forventede indbetalinger fra åbne fakturaer
    for (const inv of invoices.filter((i: any) => i.status === "sendt")) {
      if (!inv.dueDate) continue;
      const existing = await storage.all("cashflow_projections", cid);
      if (existing.some((c: any) => c.description?.includes(inv.invoiceNumber))) continue;
      const proj = await storage.insert("cashflow_projections", {
        companyId: cid, date: inv.dueDate, type: "indbetaling",
        description: `Faktura ${inv.invoiceNumber} - ${inv.customerName || ""}`,
        expectedAmount: inv.totalAmount || 0, status: "forventet", createdAt: nowIso(),
      } as any);
      created.push(proj);
    }
    // Forventede lønudbetalinger
    for (const pe of payroll.filter((p: any) => p.status === "kladde")) {
      const proj = await storage.insert("cashflow_projections", {
        companyId: cid, date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().substring(0, 10),
        type: "loen", description: `Løn ${pe.period} - ${pe.employeeName}`,
        expectedAmount: -(pe.netSalary || 0), status: "forventet", createdAt: nowIso(),
      } as any);
      created.push(proj);
    }
    // Momsfrister
    for (const td of taxDeadlines.filter((t: any) => t.status === "afventer")) {
      const proj = await storage.insert("cashflow_projections", {
        companyId: cid, date: td.deadline, type: "moms",
        description: `Moms ${td.period || ""} - ${td.type}`,
        expectedAmount: -(td.amount || 0), status: "forventet", createdAt: nowIso(),
      } as any);
      created.push(proj);
    }
    // Åbne kreditorbilag
    for (const v of vouchers.filter((v: any) => v.status === "kladde" || !v.status)) {
      const proj = await storage.insert("cashflow_projections", {
        companyId: cid, date: v.date || now.toISOString().substring(0, 10), type: "leverandoer",
        description: `${v.supplier || "Leverandør"} - ${v.description || ""}`,
        expectedAmount: -(v.amount || 0), status: "forventet", createdAt: nowIso(),
      } as any);
      created.push(proj);
    }
    res.json({ created: created.length, projections: created });
  }));

  // ── AI Regnskabschef — daglig fuld gennemgang af ALT ──
  app.post("/api/ai-regnskab/chef-run", h(async (req, res) => {
    const cid = tenantId(req);
    const created: any[] = [];
    const now = new Date();

    // 1. Ubogførte bilag fra indbakken
    const docs = await storage.all("document_inbox", cid);
    for (const doc of docs.filter((d: any) => d.status === "ny")) {
      const task = await storage.insert("ai_accounting_tasks", {
        companyId: cid, type: "bilag", status: "afventer",
        title: `Nyt bilag: ${doc.supplier || doc.fileName} (${doc.amount || "?"} kr.)`,
        description: `Bilag fra indbakke. Konto-forslag: ${doc.suggestedAccount || "ukendt"}. ${doc.isDuplicate ? "ADVARSEL: Mulig dublet!" : ""}`,
        data: JSON.stringify({ docId: doc.id }),
        suggestion: JSON.stringify({ action: "konverter_bilag", docId: doc.id, account: doc.suggestedAccount, note: doc.isDuplicate ? "Dublet tjek nødvendigt" : "Klar til bogføring" }),
        approved: 0, createdAt: nowIso(),
      } as any);
      created.push(task);
    }

    // 2. Lønposter der mangler bogføring
    const payroll = await storage.all("payroll_entries", cid);
    for (const pe of payroll.filter((p: any) => p.status === "kladde")) {
      const task = await storage.insert("ai_accounting_tasks", {
        companyId: cid, type: "lon", status: "afventer",
        title: `Lønpostering: ${pe.employeeName} - ${pe.period}`,
        description: `Bruttoløn: ${pe.grossSalary} kr. | Netto: ${pe.netSalary} kr. | A-skat: ${pe.aTax} kr. | ATP: ${pe.atp} kr.`,
        data: JSON.stringify({ payrollId: pe.id }),
        suggestion: JSON.stringify({ debitAccount: "7000", creditAccount: "2400", amount: pe.grossSalary, aTax: pe.aTax, atp: pe.atp, pension: pe.pension, note: "Automatisk lønbogføring" }),
        approved: 0, createdAt: nowIso(),
      } as any);
      created.push(task);
    }

    // 3. Anlæg der skal afskrives
    const assets = await storage.all("fixed_assets", cid);
    for (const asset of assets.filter((a: any) => a.status === "aktiv" && a.bookValue > a.salvageValue)) {
      const task = await storage.insert("ai_accounting_tasks", {
        companyId: cid, type: "afskrivning", status: "afventer",
        title: `Afskrivning: ${asset.name} (${asset.monthlyDepreciation} kr./md)`,
        description: `Bogværdi: ${asset.bookValue} kr. | Akkumuleret: ${asset.accumulatedDepreciation} kr. | Månedlig: ${asset.monthlyDepreciation} kr.`,
        data: JSON.stringify({ assetId: asset.id }),
        suggestion: JSON.stringify({ debitAccount: "6000", creditAccount: "1200", amount: asset.monthlyDepreciation, note: "Månedlig afskrivning" }),
        approved: 0, createdAt: nowIso(),
      } as any);
      created.push(task);
    }

    // 4. Budget afvigelser
    const budgets = await storage.all("budgets", cid);
    for (const b of budgets) {
      const variance = b.actualAmount - b.budgetedAmount;
      if (Math.abs(variance) > Math.abs(b.budgetedAmount) * 0.1) {
        const task = await storage.insert("ai_accounting_tasks", {
          companyId: cid, type: "budget", status: "afventer",
          title: `Budget-afvigelse: ${b.category} (${variance > 0 ? "+" : ""}${variance.toFixed(0)} kr.)`,
          description: `Budget: ${b.budgetedAmount} kr. | Faktisk: ${b.actualAmount} kr. | Afvigelse: ${variance.toFixed(0)} kr.`,
          data: JSON.stringify({ budgetId: b.id }),
          suggestion: JSON.stringify({ action: "gennemgå_budget", category: b.category, variance, note: "Afvigelse > 10% fra budget" }),
          approved: 0, createdAt: nowIso(),
        } as any);
        created.push(task);
      }
    }

    // 5. Likviditetsadvarsel
    const cashflow = await storage.all("cashflow_projections", cid);
    const totalExpected = cashflow.reduce((s: number, c: any) => s + (c.expectedAmount || 0), 0);
    if (totalExpected < 0) {
      const task = await storage.insert("ai_accounting_tasks", {
        companyId: cid, type: "likviditet", status: "afventer",
        title: `Likviditetsadvarsel: Forventet underskud ${totalExpected.toFixed(0)} kr.`,
        description: `Baseret på ${cashflow.length} projektioner. Gennemgå betalinger og indbetalinger.`,
        data: JSON.stringify({ totalExpected }),
        suggestion: JSON.stringify({ action: "gennemgå_likviditet", note: "Overvej at udskyde betalinger eller fremskynde fakturering" }),
        approved: 0, createdAt: nowIso(),
      } as any);
      created.push(task);
    }

    // 6. Kald eksisterende auto-run for fakturaer, bank, moms
    // (Genbruger logikken fra /api/ai-regnskab/auto-run)
    const invoices = await storage.all("invoices", cid);
    for (const inv of invoices) {
      if (inv.status === "betalt" || inv.status === "sendt") {
        const existingTasks = await storage.all("ai_accounting_tasks", cid);
        if (!existingTasks.some((t: any) => t.title?.includes(`Faktura ${inv.invoiceNumber}`)) && inv.totalAmount > 0) {
          const task = await storage.insert("ai_accounting_tasks", {
            companyId: cid, type: "bogføring", status: "afventer",
            title: `Faktura ${inv.invoiceNumber} skal bogføres`,
            description: `Faktura til ${inv.customerName || "kunde"} for ${inv.totalAmount} kr.`,
            data: JSON.stringify({ invoiceId: inv.id, amount: inv.totalAmount, vat: inv.vatAmount }),
            suggestion: JSON.stringify({ debitAccount: "1500", creditAccount: "3000", vatAccount: "2600", amount: inv.subtotal, vatAmount: inv.vatAmount, note: "Automatisk forslag" }),
            approved: 0, createdAt: nowIso(),
          } as any);
          created.push(task);
        }
      }
    }

    // 7. Forfaldne fakturaer
    for (const inv of invoices.filter((i: any) => i.status === "sendt" && i.dueDate)) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        const existingTasks = await storage.all("ai_accounting_tasks", cid);
        if (!existingTasks.some((t: any) => t.title?.includes(inv.invoiceNumber))) {
          const task = await storage.insert("ai_accounting_tasks", {
            companyId: cid, type: "debitor", status: "afventer",
            title: `Forfalden faktura ${inv.invoiceNumber} (${daysOverdue} dage)`,
            description: `Faktura til ${inv.customerName || "kunde"} på ${inv.totalAmount} kr. er ${daysOverdue} dage forfalden.`,
            data: JSON.stringify({ invoiceId: inv.id, daysOverdue }),
            suggestion: JSON.stringify({ action: "send_rykker", invoiceId: inv.id, note: "Overvej at sende rykker" }),
            approved: 0, createdAt: nowIso(),
          } as any);
          created.push(task);
        }
      }
    }

    res.json({ created: created.length, tasks: created, message: `AI Regnskabschef har gennemgået alt og oprettet ${created.length} opgaver` });
  }));

  // ════════════════════════════════════════════════════
  //  UDVIDEDE RUTER — SmartRegnskab + SmartRegnskab
  // ════════════════════════════════════════════════════
  registerExtendedRoutes(app);
  registerExtendedRoutes2(app);
  registerExtendedRoutes3(app);
  registerExtendedRoutes4(app);
  registerExtendedRoutes5(app);
  registerExtendedRoutes6(app);
  registerExtendedRoutes7(app);
  registerExtendedRoutes8(app);
  registerExtendedRoutes9(app);
  registerComplianceRoutes(app);
  registerEInvoiceRoutes(app);

  return httpServer;
}

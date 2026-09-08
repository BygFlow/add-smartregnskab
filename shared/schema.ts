import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

// ── Companies (virksomheder — multi-tenant, hver er en betalende kunde) ──
export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  cvr: text("cvr"),
  phone: text("phone"),
  email: text("email"),
  // Platformstyring
  status: text("status").notNull().default("proeve"), // proeve, aktiv, i_restance, spaerret, opsagt
  kind: text("kind").notNull().default("kunde"), // kunde, platform
  createdAt: text("created_at").notNull().default("2026-01-01"),
  notes: text("notes"), // interne noter for ADD SmartDrift Clean-teamet
  // Moms og fakturering
  vatRate: real("vat_rate").notNull().default(25), // procent — 0 ved momsfritagelse
  vatMode: text("vat_mode").notNull().default("dansk"), // dansk, eu_omvendt, eksport_fritaget, momsfri
  currency: text("currency").notNull().default("DKK"),
  // GDPR-opbevaringspolitik (måneder — 0 = gem uendeligt)
  retentionTimeEntries: integer("retention_time_entries").notNull().default(60),
  retentionGps: integer("retention_gps").notNull().default(6),
  retentionAbsences: integer("retention_absences").notNull().default(60),
  retentionPhotos: integer("retention_photos").notNull().default(24),
  dpaAcceptedAt: text("dpa_accepted_at"), // databehandleraftale godkendt
  dpaAcceptedBy: text("dpa_accepted_by"),
  // AI-tilæg
  aiEnabled: integer("ai_enabled").notNull().default(0), // 0 = ikke aktiveret, 1 = aktiveret
  notificationPrefs: text("notification_prefs"), // JSON: email/SMS notification preferences
  // Betalingsinformation
  website: text("website"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  iban: text("iban"),
  swift: text("swift"),
  paymentTerms: integer("payment_terms").notNull().default(8), // Netto X dage
  invoiceAddress: text("invoice_address"), // separat fakturaadresse
  // Faktura-indstillinger
  invoicePrefix: text("invoice_prefix").notNull().default("FA"),
  invoiceNextNumber: integer("invoice_next_number").notNull().default(1),
  offerPrefix: text("offer_prefix").notNull().default("TI"),
  offerNextNumber: integer("offer_next_number").notNull().default(1),
  autoApproveInvoices: integer("auto_approve_invoices").notNull().default(0),
  autoAddTimeToInvoice: integer("auto_add_time_to_invoice").notNull().default(0),
  autoAddMaterialsToInvoice: integer("auto_add_materials_to_invoice").notNull().default(0),
  // Åbningstider (JSON: [{day: "mandag", open: "08:00", close: "16:00"}, ...])
  openingHours: text("opening_hours"),
  // Timeregistrering
  autoBreakMinutes: integer("auto_break_minutes").notNull().default(30), // auto-pause i minutter
  workingHoursType: text("working_hours_type").notNull().default("interval"), // interval, flex
  timeReportFrequency: text("time_report_frequency").notNull().default("monthly"), // weekly, monthly
  // Faste tekster
  invoiceStandardText: text("invoice_standard_text"),
  offerStandardText: text("offer_standard_text"),
  reminderStandardText: text("reminder_standard_text"),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ── Users (brugere — auth & roller) ──
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("assistent"), // platform_admin, leder, holdleder, assistent, kunde
  employeeId: integer("employee_id"),
  customerId: integer("customer_id"),
  active: integer("active").notNull().default(1),
  // Tilmelding og sikkerhed
  emailVerified: integer("email_verified").notNull().default(0),
  twoFactorSecret: text("two_factor_secret"), // base32 TOTP-hemmelighed
  twoFactorEnabled: integer("two_factor_enabled").notNull().default(0),
  twoFactorBackup: text("two_factor_backup"), // JSON: hashede engangskoder
  lockedUntil: text("locked_until"), // sat efter for mange fejlforsøg
  lastLoginAt: text("last_login_at"),
  passwordChangedAt: text("password_changed_at"),
});

// ── Sessions (login-tokens — erstatter tillid til klientens companyId) ──
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export type Session = typeof sessions.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Employees (ansatte) ──
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull().default("Rengøringsassistent"),
  status: text("status").notNull().default("ledig"), // ledig, optaget, orlov
  weeklyHours: integer("weekly_hours").notNull().default(37),
  employeeNumber: text("employee_number"), // M-0001
  employmentStatus: text("employment_status").notNull().default("aktiv"), // aktiv, pauseret, opsagt, tidligere
  startDate: text("start_date"),
  endDate: text("end_date"),
  position: text("position"),
  hourlyRate: real("hourly_rate").default(0),
  monthlySalary: real("monthly_salary").default(0),
  contractType: text("contract_type"), // fast, tidsbegraenset, timeloennet, vikar
  managerId: integer("manager_id"),
  skills: text("skills").default("[]"),
  contractDraft: text("contract_draft"),
  contractFileName: text("contract_file_name"),
  contractUploadedAt: text("contract_uploaded_at"),
  gpsRequired: integer("gps_required").default(1), // virksomheden styrer pr. medarbejder
  appAccessEnabled: integer("app_access_enabled").default(1),
  permissions: text("permissions").default("[]"), // JSON: tilladte moduler
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// ── Customers (kunder) ──
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  contact: text("contact"),
  email: text("email"),
  hourlyRate: real("hourly_rate").notNull().default(350),
  lat: real("lat"),
  lng: real("lng"),
  geofenceRadius: integer("geofence_radius").notNull().default(150),
  customerNumber: text("customer_number"),
  contactPerson: text("contact_person"),
  cvr: text("cvr"),
  ean: text("ean"),
  paymentTerms: text("payment_terms"),
  invoiceEmail: text("invoice_email"),
  accessNotes: text("access_notes"),
  multipleAddresses: text("multiple_addresses").default("[]"),
  customerType: text("customer_type").default("erhverv"), // privat, erhverv
  portalToken: text("portal_token"), // til kundeportal adgang
  portalActive: integer("portal_active").default(0),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ── Tasks (opgaver) ──
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  customerId: integer("customer_id"),
  employeeId: integer("employee_id"),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time"),
  endTime: text("end_time"),
  status: text("status").notNull().default("planlagt"), // planlagt, igang, færdig, aflyst
  priority: text("priority").notNull().default("normal"), // lav, normal, høj
  description: text("description"),
  checklist: text("checklist"), // JSON array of {label, done}
  // Tilbagevendende opgaver
  recurrence: text("recurrence").notNull().default("ingen"), // ingen, daglig, ugentlig, maanedlig
  recurrenceEndDate: text("recurrence_end_date"), // YYYY-MM-DD
  parentTaskId: integer("parent_task_id"),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ── Time Entries (tidsregistrering) ──
export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  taskId: integer("task_id"),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time"), // HH:MM (null = active timer)
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  // GPS & lokation
  checkInLat: real("check_in_lat"),
  checkInLng: real("check_in_lng"),
  checkOutLat: real("check_out_lat"),
  checkOutLng: real("check_out_lng"),
  // Geofence-validering (udregnet på serveren)
  checkInDistance: integer("check_in_distance"), // meter fra kundeadresse
  checkOutDistance: integer("check_out_distance"),
  geofenceStatus: text("geofence_status").notNull().default("ukendt"), // ukendt, indenfor, udenfor, ingen_gps
  approved: integer("approved").notNull().default(0), // godkendt til lønsynk
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// ── Notifications (notifikationer) ──
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").notNull().default("info"), // info, warning, success
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ── Invoices (fakturaer) ──
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("kladde"), // kladde, sendt, betalt, forfalden, krediteret
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  netAmount: real("net_amount").notNull().default(0),
  vatRate: real("vat_rate").notNull().default(25),
  vatAmount: real("vat_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0), // inkl. moms
  paymentTerms: integer("payment_terms").notNull().default(14), // dage
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  reminderCount: integer("reminder_count").notNull().default(0),
  lastReminderAt: text("last_reminder_at"),
  reminderFee: real("reminder_fee").notNull().default(0),
  creditedAmount: real("credited_amount").notNull().default(0),
  paidAmount: real("paid_amount").notNull().default(0),
  notes: text("notes"),
}, (table) => ({ companyInvoiceNumberUnique: uniqueIndex("invoices_company_number_unique").on(table.companyId, table.invoiceNumber) }));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ── Invoice Items (fakturalinjer) ──
export const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(), // timer
  unitPrice: real("unit_price").notNull(), // DKK pr. time
  amount: real("amount").notNull(), // ekskl. moms
  vatRate: real("vat_rate").notNull().default(25),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// ── Integrations (løn- og regnskabsintegrationer) ──
export const integrations = sqliteTable("integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  category: text("category").notNull(), // loen, regnskab, bank, ovrigt
  provider: text("provider").notNull(), // f.eks. "Danløn", "Zenegy", "e-conomic"
  status: text("status").notNull().default("ikke_opsat"), // ikke_opsat, demo_forbundet, forbundet, fejl
  syncMode: text("sync_mode").notNull().default("eksport"), // eksport, api
  apiKey: text("api_key"), // e-conomic: AppSecretToken | Danløn: API-nøgle
  apiSecret: text("api_secret"), // e-conomic: AgreementGrantToken | andre: klienthemmelighed
  baseUrl: text("base_url"), // overstyrer udbyderens standard-endpoint
  exportFormat: text("export_format"), // valgt eksportformat, f.eks. danloen_csv
  autoSync: integer("auto_sync").notNull().default(0), // 0/1 — automatisk synk ved godkendelse
  settingsJson: text("settings_json"), // JSON: firmakonto/kundenr. hos udbyder mv.
  lastSyncAt: text("last_sync_at"),
  lastError: text("last_error"),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({ id: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// Synkroniseringslog — revisionsspor for alle kald til eksterne systemer
export const syncLogs = sqliteTable("sync_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  integrationId: integer("integration_id").notNull(),
  provider: text("provider").notNull(),
  action: text("action").notNull(), // test_forbindelse, synk_loen, synk_fakturaer, eksport
  status: text("status").notNull(), // ok, fejl
  recordCount: integer("record_count").notNull().default(0),
  message: text("message"),
  createdAt: text("created_at").notNull(),
});

export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({ id: true });
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SyncLog = typeof syncLogs.$inferSelect;

// ── Absences (fravær: ferie, sygdom, barsel) ──
export const absences = sqliteTable("absences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  type: text("type").notNull(), // ferie, sygdom, barn_syg, barsel, omsorgsdag, andet
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  hoursPerDay: real("hours_per_day").notNull().default(7.4),
  status: text("status").notNull().default("afventer"), // afventer, godkendt, afvist
  paid: integer("paid").notNull().default(1), // med eller uden løn
  note: text("note"),
  approvedBy: integer("approved_by"), // bruger-id på den, der godkendte
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
});

export const insertAbsenceSchema = createInsertSchema(absences).omit({ id: true });
export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;
export type Absence = typeof absences.$inferSelect;

// ── Shifts (vagtplan) ──
export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  customerId: integer("customer_id"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("planlagt"), // planlagt, bekraeftet, afbud
  note: text("note"),
  published: integer("published").notNull().default(0), // 1 = udsendt til medarbejderen
});

export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// ── Attachments (fotodokumentation: før/efter, kvalitetskontrol) ──
export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  taskId: integer("task_id"),
  kind: text("kind").notNull().default("andet"), // foer, efter, kvalitet, afvigelse, andet
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  dataUrl: text("data_url"), // udfases — kun ældre rækker
  storage: text("storage").notNull().default("disk"), // disk, s3
  storageKey: text("storage_key"), // sti på disk eller nøgle i objektlager
  inspectionId: integer("inspection_id"),
  uploadedBy: integer("uploaded_by"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  deleteAfter: text("delete_after"), // beregnet ud fra opbevaringspolitikken
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true });
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// ── Message Outbox (e-mail/SMS-kø med revisionsspor) ──
export const messageOutbox = sqliteTable("message_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  channel: text("channel").notNull(), // email, sms
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().default("i_koe"), // i_koe, sendt, fejl, simuleret
  relatedType: text("related_type"), // faktura, opgave, rykker
  relatedId: integer("related_id"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
});

export const insertMessageSchema = createInsertSchema(messageOutbox).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type OutboxMessage = typeof messageOutbox.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  PLATFORMLAG — ADD SmartDrift Clean som SaaS-forretning
// ═══════════════════════════════════════════════════════════

// ── Plans (abonnementspakker) ──
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  monthlyPrice: real("monthly_price").notNull(), // DKK ekskl. moms pr. måned
  pricePerEmployee: real("price_per_employee").notNull().default(0), // DKK pr. ansat pr. måned
  maxEmployees: integer("max_employees").notNull().default(10), // -1 = ubegrænset
  maxCustomers: integer("max_customers").notNull().default(25),
  features: text("features").notNull().default("[]"), // JSON: ["api_integration", "vagtplan", ...]
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active").notNull().default(1),
});

export const insertPlanSchema = createInsertSchema(plans).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

// ── Subscriptions (virksomhedens abonnement) ──
export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  planId: integer("plan_id").notNull(),
  status: text("status").notNull().default("proeve"), // proeve, aktiv, i_restance, opsagt
  billingCycle: text("billing_cycle").notNull().default("maanedlig"), // maanedlig, aarlig
  trialEndsAt: text("trial_ends_at"),
  currentPeriodStart: text("current_period_start").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  cancelledAt: text("cancelled_at"),
  startedAt: text("started_at").notNull(),
  autoRenew: integer("auto_renew").notNull().default(1),
  paymentMethodId: integer("payment_method_id"),
  dunningStage: integer("dunning_stage").notNull().default(0), // 0-3: rykkertrin ved fejlet betaling
  lastPaymentAttempt: text("last_payment_attempt"),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// ── Platform Invoices (ADD SmartDrift Clean fakturerer virksomheden) ──
export const platformInvoices = sqliteTable("platform_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  planName: text("plan_name").notNull(),
  employeeCount: integer("employee_count").notNull().default(0),
  netAmount: real("net_amount").notNull(),
  vatAmount: real("vat_amount").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status").notNull().default("udstedt"), // udstedt, betalt, forfalden
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
});

export const insertPlatformInvoiceSchema = createInsertSchema(platformInvoices).omit({ id: true });
export type InsertPlatformInvoice = z.infer<typeof insertPlatformInvoiceSchema>;
export type PlatformInvoice = typeof platformInvoices.$inferSelect;

// ── Audit Log (platformhandlinger — hvem gjorde hvad) ──
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"), // null = platformniveau
  userId: integer("user_id"),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  target: text("target"),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  BETALING — kortbetaling, abonnementsfornyelse, webhooks
// ═══════════════════════════════════════════════════════════

// ── Payment Methods (gemte betalingsmidler — kun udbyderens token, aldrig kortnummer) ──
export const paymentMethods = sqliteTable("payment_methods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  provider: text("provider").notNull(), // stripe, mobilepay, betalingsservice
  providerRef: text("provider_ref").notNull(), // fx Stripe payment_method-id
  brand: text("brand"), // visa, mastercard, mobilepay
  last4: text("last4"),
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  isDefault: integer("is_default").notNull().default(0),
  status: text("status").notNull().default("aktiv"), // aktiv, udloebet, fejlet, fjernet
  createdAt: text("created_at").notNull(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// ── Payments (betalingsforsøg mod en abonnementsfaktura) ──
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  platformInvoiceId: integer("platform_invoice_id"),
  paymentMethodId: integer("payment_method_id"),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"), // fx Stripe payment_intent-id
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("DKK"),
  status: text("status").notNull().default("afventer"), // afventer, gennemfoert, fejlet, refunderet, simuleret
  failureReason: text("failure_reason"),
  attempt: integer("attempt").notNull().default(1),
  createdAt: text("created_at").notNull(),
  settledAt: text("settled_at"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ── Webhook Events (indgående kald fra betalingsudbyder — idempotent) ──
export const webhookEvents = sqliteTable("webhook_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(), // JSON
  signatureValid: integer("signature_valid").notNull().default(0),
  processed: integer("processed").notNull().default(0),
  error: text("error"),
  receivedAt: text("received_at").notNull(),
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true });
export type WebhookEvent = typeof webhookEvents.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  TILMELDING, LOGIN-SIKKERHED OG TO-FAKTOR
// ═══════════════════════════════════════════════════════════

// ── Auth Tokens (e-mailbekræftelse, glemt kodeord, brugerinvitation) ──
export const authTokens = sqliteTable("auth_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  kind: text("kind").notNull(), // verificer_email, nulstil_kode, invitation
  userId: integer("user_id"),
  email: text("email").notNull(),
  companyId: integer("company_id"),
  payload: text("payload"), // JSON — fx rolle ved invitation
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

export const insertAuthTokenSchema = createInsertSchema(authTokens).omit({ id: true });
export type AuthToken = typeof authTokens.$inferSelect;

// ── Login Attempts (bremser maskinel gætning af kodeord) ──
export const loginAttempts = sqliteTable("login_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  ip: text("ip"),
  success: integer("success").notNull().default(0),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  GDPR — opbevaring, samtykke, dataudlevering
// ═══════════════════════════════════════════════════════════

// ── Data Requests (indsigt, sletning og dataportabilitet) ──
export const dataRequests = sqliteTable("data_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  kind: text("kind").notNull(), // indsigt, sletning, portabilitet
  subjectType: text("subject_type").notNull(), // ansat, kunde, bruger
  subjectId: integer("subject_id").notNull(),
  subjectName: text("subject_name").notNull(),
  status: text("status").notNull().default("modtaget"), // modtaget, behandlet, afvist
  requestedBy: text("requested_by"),
  note: text("note"),
  resultRef: text("result_ref"), // fil-id på udleveret pakke
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const insertDataRequestSchema = createInsertSchema(dataRequests).omit({ id: true });
export type InsertDataRequest = z.infer<typeof insertDataRequestSchema>;
export type DataRequest = typeof dataRequests.$inferSelect;

// ── Consents (samtykke til GPS-registrering og fotodokumentation) ──
export const consents = sqliteTable("consents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  kind: text("kind").notNull(), // gps, foto, databehandling
  granted: integer("granted").notNull().default(0),
  grantedAt: text("granted_at"),
  withdrawnAt: text("withdrawn_at"),
  textVersion: text("text_version").notNull().default("1.0"),
});

export const insertConsentSchema = createInsertSchema(consents).omit({ id: true });
export type InsertConsent = z.infer<typeof insertConsentSchema>;
export type Consent = typeof consents.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  BRANCHEMODULER — tilbud, materialer, nøgler, kvalitet
// ═══════════════════════════════════════════════════════════

// ── Quotes (tilbud) ──
export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  quoteNumber: text("quote_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  netAmount: real("net_amount").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0),
  status: text("status").notNull().default("kladde"), // kladde, sendt, accepteret, afvist, udloebet
  validUntil: text("valid_until"),
  issueDate: text("issue_date").notNull(),
  respondedAt: text("responded_at"),
  customerMessage: text("customer_message"), // besked fra kunden ved accept/afvis
  contractId: integer("contract_id"), // sat når tilbuddet er blevet en aftale
}, (table) => ({ companyQuoteNumberUnique: uniqueIndex("quotes_company_number_unique").on(table.companyId, table.quoteNumber) }));

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// ── Quote Items (tilbudslinjer) ──
export const quoteItems = sqliteTable("quote_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteId: integer("quote_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("timer"), // timer, stk, md, m2
  unitPrice: real("unit_price").notNull().default(0),
  amount: real("amount").notNull().default(0),
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ id: true });
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;

// ── Contracts (kontrakter/aftaler med fast pris pr. kunde) ──
export const contracts = sqliteTable("contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  contractNumber: text("contract_number").notNull(),
  title: text("title").notNull(),
  pricingModel: text("pricing_model").notNull().default("timepris"), // timepris, fast_maaned, pr_besoeg, pr_m2
  agreedRate: real("agreed_rate").notNull().default(0), // aftalt pris i den valgte model
  hoursIncluded: real("hours_included").default(0), // timer inkluderet pr. måned ved fast pris
  overtimeRate: real("overtime_rate").default(0), // pris for timer ud over det inkluderede
  frequency: text("frequency").notNull().default("ugentlig"), // daglig, ugentlig, hver_14_dag, maanedlig
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  noticeMonths: integer("notice_months").notNull().default(1),
  indexAdjustment: integer("index_adjustment").notNull().default(0), // 1 = årlig prisregulering
  status: text("status").notNull().default("aktiv"), // udkast, aktiv, opsagt, udloebet
  terms: text("terms"),
});

export const insertContractSchema = createInsertSchema(contracts).omit({ id: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

// ── Materials (materiale- og forbrugsvarekartotek) ──
export const materials = sqliteTable("materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  unit: text("unit").notNull().default("stk"), // stk, liter, kg, rulle
  costPrice: real("cost_price").notNull().default(0),
  salesPrice: real("sales_price").notNull().default(0),
  stock: real("stock").notNull().default(0),
  minStock: real("min_stock").notNull().default(0),
  supplier: text("supplier"),
  hazardous: integer("hazardous").notNull().default(0), // 1 = kræver sikkerhedsdatablad
  safetySheetUrl: text("safety_sheet_url"),
  active: integer("active").notNull().default(1),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// ── Material Usage (forbrug bogført på opgave/kunde) ──
export const materialUsage = sqliteTable("material_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  materialId: integer("material_id").notNull(),
  taskId: integer("task_id"),
  customerId: integer("customer_id"),
  employeeId: integer("employee_id"),
  quantity: real("quantity").notNull(),
  kind: text("kind").notNull().default("forbrug"), // forbrug, indkoeb, korrektion
  billable: integer("billable").notNull().default(1),
  invoicedAt: text("invoiced_at"),
  date: text("date").notNull(),
  note: text("note"),
});

export const insertMaterialUsageSchema = createInsertSchema(materialUsage).omit({ id: true });
export type InsertMaterialUsage = z.infer<typeof insertMaterialUsageSchema>;
export type MaterialUsage = typeof materialUsage.$inferSelect;

// ── Keys (nøgler og alarmkoder pr. adresse — koder krypteret) ──
export const keys = sqliteTable("keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  label: text("label").notNull(), // fx "Hovedindgang" eller "Nøglebrik 4"
  keyType: text("keyType").notNull().default("noegle"), // noegle, brik, kode, alarmkode
  identifier: text("identifier"), // nøglemærke/serienummer
  secretEnc: text("secret_enc"), // krypteret alarmkode (AES-256-GCM)
  accessNote: text("access_note"), // fx "Alarm slås af inden for 30 sek."
  holderEmployeeId: integer("holder_employee_id"), // hvem har den nu
  status: text("status").notNull().default("paa_lager"), // paa_lager, udlaant, bortkommet, returneret
  deposit: real("deposit").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertKeySchema = createInsertSchema(keys).omit({ id: true });
export type InsertKey = z.infer<typeof insertKeySchema>;
export type KeyItem = typeof keys.$inferSelect;

// ── Key Handovers (kvitteret nøgleoverdragelse — ansvarskæden) ──
export const keyHandovers = sqliteTable("key_handovers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  keyId: integer("key_id").notNull(),
  fromEmployeeId: integer("from_employee_id"),
  toEmployeeId: integer("to_employee_id"),
  action: text("action").notNull(), // udlaan, retur, bortkommet
  signedBy: text("signed_by"),
  date: text("date").notNull(),
  note: text("note"),
});

export const insertKeyHandoverSchema = createInsertSchema(keyHandovers).omit({ id: true });
export type InsertKeyHandover = z.infer<typeof insertKeyHandoverSchema>;
export type KeyHandover = typeof keyHandovers.$inferSelect;

// ── Inspections (kvalitetskontrol med score — INSTA 800-inspireret) ──
export const inspections = sqliteTable("inspections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  taskId: integer("task_id"),
  employeeId: integer("employee_id"), // den ansatte der blev kontrolleret
  inspectorId: integer("inspector_id"), // hvem kontrollerede
  date: text("date").notNull(),
  scores: text("scores").notNull().default("[]"), // JSON: [{area, weight, score}]
  totalScore: real("total_score").notNull().default(0), // 0-100
  result: text("result").notNull().default("godkendt"), // godkendt, anmaerkning, ikke_godkendt
  followUpDate: text("follow_up_date"),
  followUpDone: integer("follow_up_done").notNull().default(0),
  customerVisible: integer("customer_visible").notNull().default(1),
  note: text("note"),
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({ id: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

// ── Job Runs (automatiske job — gentagne opgaver, rykkere, fornyelse, oprydning) ──
export const jobRuns = sqliteTable("job_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  job: text("job").notNull(), // gentagne_opgaver, faktura_rykkere, abonnement_fornyelse, gdpr_oprydning, beskedkoe
  status: text("status").notNull().default("koert"), // koert, fejlet
  affected: integer("affected").notNull().default(0),
  detail: text("detail"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});


export const taskNotes = sqliteTable("task_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertTaskNoteSchema = createInsertSchema(taskNotes).omit({ id: true, createdAt: true });
export type InsertTaskNote = z.infer<typeof insertTaskNoteSchema>;
export type TaskNote = typeof taskNotes.$inferSelect;

export type JobRun = typeof jobRuns.$inferSelect;

// ── Backups (platform + virksomhed) ──
export const backups = sqliteTable("backups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"), // null = platform backup
  scope: text("scope").notNull(), // platform, company
  status: text("status").notNull().default("fuldfort"), // igangværende, fuldfort, fejlet
  size: text("size"), // filstørrelse
  summary: text("summary"), // JSON: {tables: N, rows: N}
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"), // bruger email
});

export const insertBackupSchema = createInsertSchema(backups).omit({ id: true });
export type InsertBackup = z.infer<typeof insertBackupSchema>;
export type Backup = typeof backups.$inferSelect;

// ── Templates (tilbud + faktura skabeloner) ──
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  type: text("type").notNull(),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  logoPosition: text("logo_position").default("left"),
  primaryColor: text("primary_color").default("#2176d4"),
  headerLayout: text("header_layout").default("classic"),
  showBankInfo: integer("show_bank_info").default(1),
  showPaymentTerms: integer("show_payment_terms").default(1),
  showEAN: integer("show_ean").default(0),
  columns: text("columns").default("[]"), // JSON: [{key, label, width}]
  footerText: text("footer_text"),
  termsConditions: text("terms_conditions"),
  createdAt: text("created_at").notNull(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// ── Cleaning Services (ydelser med time og priser) ──
export const cleaningServices = sqliteTable("cleaning_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  unitType: text("unit_type").notNull().default("time"), // time, kvm, fast_pris, pr_omgang, pr_lokation
  price: real("price").notNull().default(0),
  hourlyRate: real("hourly_rate").default(0),
  estimatedHours: real("estimated_hours").default(0),
  estimatedTime: real("estimated_time").default(0), // minutter
  category: text("category"),
  active: integer("active").notNull().default(1),
  vatCode: text("vat_code").default("I25"),
  weekendSurcharge: real("weekend_surcharge").default(0), // %
  eveningSurcharge: real("evening_surcharge").default(0), // %
  materialSurcharge: real("material_surcharge").default(0), // %
  transportSurcharge: real("transport_surcharge").default(0), // kr/km
  standardTasks: text("standard_tasks").default("[]"), // JSON: ["Støvsug", "Vask gulv"]
  standardMaterials: text("standard_materials").default("[]"), // JSON: [{name, qty, unit}]
  itemNumber: text("item_number"), // varenummer — auto-genereres
  createdAt: text("created_at").notNull(),
});

export const insertCleaningServiceSchema = createInsertSchema(cleaningServices).omit({ id: true, createdAt: true });
export type InsertCleaningService = z.infer<typeof insertCleaningServiceSchema>;
export type CleaningService = typeof cleaningServices.$inferSelect;

// ── Cleaning Agreements (rengøringsaftaler) ──
export const cleaningAgreements = sqliteTable("cleaning_agreements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("kladde"), // kladde, sendt, afventer_kunde, godkendt, underskrevet, aktiv, opsagt, udløbet
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  frequency: text("frequency").notNull().default("ugentligt"),
  monthlyPrice: real("monthly_price").notNull().default(0),
  serviceIds: text("service_ids").notNull().default("[]"),
  notes: text("notes"),
  agreementNumber: text("agreement_number"),
  contactPerson: text("contact_person"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  agreementLines: text("agreement_lines").default("[]"), // JSON: [{serviceId, name, qty, unit, price, total}]
  totalSetup: real("total_setup").default(0),
  bindingPeriod: integer("binding_period").default(0),
  noticePeriod: integer("notice_period").default(1),
  paymentTerms: text("payment_terms"),
  terms: text("terms"),
  sentAt: text("sent_at"),
  customerApprovedAt: text("customer_approved_at"),
  customerSignature: text("customer_signature"),
  cancelledAt: text("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: text("created_at").notNull(),
});

export const insertCleaningAgreementSchema = createInsertSchema(cleaningAgreements).omit({ id: true, createdAt: true });
export type InsertCleaningAgreement = z.infer<typeof insertCleaningAgreementSchema>;
export type CleaningAgreement = typeof cleaningAgreements.$inferSelect;

// ── Cleaning Plans (rengøringsplaner / tjeklister pr. opgave) ──
export const cleaningPlans = sqliteTable("cleaning_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  agreementId: integer("agreement_id"),
  name: text("name").notNull(),
  area: text("area"),
  tasks: text("tasks").notNull().default("[]"),
  frequency: text("frequency").notNull().default("ugentligt"),
  active: integer("active").notNull().default(1),
  planNumber: text("plan_number"),
  location: text("location"),
  areas: text("areas").default("[]"), // JSON: [{name, tasks: [{description, frequency, estimatedMinutes, materials: []}], assignedEmployeeId}]
  scheduleType: text("schedule_type").default("fast"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  nextScheduledDate: text("next_scheduled_date"),
  totalEstimatedMinutes: real("total_estimated_minutes").default(0),
  checklistEnabled: integer("checklist_enabled").default(1),
  createdAt: text("created_at").notNull(),
});

export const insertCleaningPlanSchema = createInsertSchema(cleaningPlans).omit({ id: true, createdAt: true });
export type InsertCleaningPlan = z.infer<typeof insertCleaningPlanSchema>;
export type CleaningPlan = typeof cleaningPlans.$inferSelect;

// ── Leads (AI-hentede leads fra email, Google Ads, Facebook, website) ──
export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  source: text("source").notNull(), // email, google_ads, facebook, website, manual, phone
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  message: text("message"), // oprindelig henvendelse
  status: text("status").notNull().default("ny"), // ny, analyseret, tilbud_kladde, afventer_godkendelse, godkendt, klar_til_afsendelse, afsendt, afvist
  aiAnalysis: text("ai_analysis"), // AI-analyse af henvendelsen
  aiOfferDraft: text("ai_offer_draft"), // AI-genereret tilbudskladde (JSON)
  aiReplyDraft: text("ai_reply_draft"), // AI-genereret svar til kunden
  approvedBy: integer("approved_by"), // user id der godkendte
  approvedAt: text("approved_at"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// ── Support Cases (platform support til virksomheder) ──
export const supportCases = sqliteTable("support_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("aabn"), // aaben, under_behandling, lukket
  priority: text("priority").notNull().default("normal"), // lav, normal, hoj, akut
  reply: text("reply"), // AI-kladde eller endeligt svar
  replyStatus: text("reply_status").notNull().default("kladde"), // kladde, afventer_godkendelse, godkendt, sendt
  createdBy: text("created_by"), // bruger email
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertSupportCaseSchema = createInsertSchema(supportCases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportCase = z.infer<typeof insertSupportCaseSchema>;
export type SupportCase = typeof supportCases.$inferSelect;

// ── Accounting: Chart of Accounts (kontoplan) ──
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  accountNumber: text("account_number").notNull(), // fx "1000", "55000"
  name: text("name").notNull(),
  type: text("type").notNull(), // aktiv, passiv, indtaegt, udgift, mellemregning
  vatCode: text("vat_code"), // fx "I25" (indkøb 25%), "S25" (salg 25%), "FRI", "EU"
  balance: real("balance").notNull().default(0), // løbende saldo
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// ── Accounting: Journal Entries (posteringer/bilag) ──
export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  entryNumber: text("entry_number").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  reference: text("reference"), // fakturanr, bilagsnr
  sourceType: text("source_type"), // manual, faktura, tilbud, bank, løn, moms
  sourceId: integer("source_id"),
  status: text("status").notNull().default("kladde"), // kladde, bogført, afstemt
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
}, (table) => ({ companyEntryNumberUnique: uniqueIndex("journal_entries_company_number_unique").on(table.companyId, table.entryNumber) }));

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

// ── Accounting: Journal Lines (postrejslinjer — debet/kredit) ──
export const journalLines = sqliteTable("journal_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  journalEntryId: integer("journal_entry_id").notNull(),
  accountId: integer("account_id").notNull(),
  description: text("description"),
  debit: real("debit").notNull().default(0),
  credit: real("credit").notNull().default(0),
  vatCode: text("vat_code"),
});

export const insertJournalLineSchema = createInsertSchema(journalLines).omit({ id: true });
export type InsertJournalLine = z.infer<typeof insertJournalLineSchema>;
export type JournalLine = typeof journalLines.$inferSelect;

// ── Accounting: VAT Periods (momsopgørelse) ──
export const vatPeriods = sqliteTable("vat_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(), // fx "2026-Q1", "2026-01"
  vatType: text("vat_type").notNull().default("kvartal"), // maaned, kvartal, halvaar
  outputVat: real("output_vat").notNull().default(0), // udgående moms (salg)
  inputVat: real("input_vat").notNull().default(0), // indgående moms (køb)
  netVat: real("net_vat").notNull().default(0), // output - input (betales/tilbagebetales)
  status: text("status").notNull().default("aabn"), // aaben, indberettet, betalt
  reportedAt: text("reported_at"),
  createdAt: text("created_at").notNull(),
});

export const insertVatPeriodSchema = createInsertSchema(vatPeriods).omit({ id: true, createdAt: true });
export type InsertVatPeriod = z.infer<typeof insertVatPeriodSchema>;
export type VatPeriod = typeof vatPeriods.$inferSelect;

// ── Communication: Outbound Messages (sendte beskeder) ──
export const outboundMessages = sqliteTable("outbound_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id"),
  relatedType: text("related_type"), // tilbud, aftale, faktura, lead, support
  relatedId: integer("related_id"),
  channel: text("channel").notNull().default("email"), // email, sms, manual
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().default("kladde"), // kladde, afventer_godkendelse, godkendt, klar_til_afsendelse, sendt, fejlet
  aiGenerated: integer("ai_generated").notNull().default(0),
  approvedBy: integer("approved_by"),
  approvedAt: text("approved_at"),
  sentAt: text("sent_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

export const insertOutboundMessageSchema = createInsertSchema(outboundMessages).omit({ id: true, createdAt: true });
export type InsertOutboundMessage = z.infer<typeof insertOutboundMessageSchema>;
export type OutboundMessage = typeof outboundMessages.$inferSelect;

// ── Communication: Inbound Messages (modtagne svar) ──
export const inboundMessages = sqliteTable("inbound_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id"),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  fromEmail: text("from_email"),
  fromPhone: text("from_phone"),
  body: text("body").notNull(),
  read: integer("read").notNull().default(0),
  receivedAt: text("received_at").notNull(),
});

export const insertInboundMessageSchema = createInsertSchema(inboundMessages).omit({ id: true });
export type InsertInboundMessage = z.infer<typeof insertInboundMessageSchema>;
export type InboundMessage = typeof inboundMessages.$inferSelect;

// ── Communication: Integration Setup ──
export const communicationIntegrations = sqliteTable("communication_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  provider: text("provider").notNull().default("email"), // email, smtp
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  status: text("status").notNull().default("ikke_aktiv"), // aktiv, ikke_aktiv, fejl
  config: text("config").default("{}"), // JSON: smtp host, port, etc.
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").notNull(),
});

export const insertCommunicationIntegrationSchema = createInsertSchema(communicationIntegrations).omit({ id: true, createdAt: true });
export type InsertCommunicationIntegration = z.infer<typeof insertCommunicationIntegrationSchema>;
export type CommunicationIntegration = typeof communicationIntegrations.$inferSelect;

// ── Payment Providers (betalingsudbydere) ──
export const paymentProviders = sqliteTable("payment_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  provider: text("provider").notNull(), // mobilepay, nets, stripe, swift, leverandorservice
  displayName: text("display_name"),
  status: text("status").notNull().default("ikke_aktiv"), // aktiv, ikke_aktiv, fejl
  config: text("config").default("{}"), // JSON: apiKey, merchantId, etc.
  autoSetup: integer("auto_setup").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertPaymentProviderSchema = createInsertSchema(paymentProviders).omit({ id: true, createdAt: true });
export type InsertPaymentProvider = z.infer<typeof insertPaymentProviderSchema>;
export type PaymentProvider = typeof paymentProviders.$inferSelect;

// ── Custom Payment Terms (betalingsbetingelser) ──
export const customPaymentTerms = sqliteTable("custom_payment_terms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(), // f.eks. "30 dage", "Kontant", "15 dage"
  days: integer("days").notNull().default(30),
  isStandard: integer("is_standard").default(0),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const insertCustomPaymentTermSchema = createInsertSchema(customPaymentTerms).omit({ id: true, createdAt: true });
export type InsertCustomPaymentTerm = z.infer<typeof insertCustomPaymentTermSchema>;
export type CustomPaymentTerm = typeof customPaymentTerms.$inferSelect;

// ── Backup Jobs (selvstændig backup enhed) ──
export const backupJobs = sqliteTable("backup_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"), // null = platform backup
  scope: text("scope").notNull().default("company"), // platform, company, employees, customers
  status: text("status").notNull().default("planlagt"), // planlagt, igang, fuldfort, fejlet
  size: text("size"),
  destination: text("destination").default("cloud"), // cloud, local
  autoSync: integer("auto_sync").default(1),
  summary: text("summary"), // JSON
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

export const insertBackupJobSchema = createInsertSchema(backupJobs).omit({ id: true, createdAt: true });
export type InsertBackupJob = z.infer<typeof insertBackupJobSchema>;
export type BackupJob = typeof backupJobs.$inferSelect;

// ── Dashboard Widgets (tilpasset dashboard) ──
export const dashboardWidgets = sqliteTable("dashboard_widgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  widgetType: text("widget_type").notNull(), // tasks_today, active_timers, upcoming, revenue, notifications, ai_panel
  position: integer("position").default(0),
  visible: integer("visible").notNull().default(1),
  config: text("config").default("{}"),
});

export const insertDashboardWidgetSchema = createInsertSchema(dashboardWidgets).omit({ id: true });
export type InsertDashboardWidget = z.infer<typeof insertDashboardWidgetSchema>;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;

// ── Credit Notes (kreditnotaer) ──
export const creditNotes = sqliteTable("credit_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id"),
  invoiceId: integer("invoice_id"),
  creditNumber: text("credit_number"),
  amount: real("amount").notNull().default(0),
  reason: text("reason"),
  status: text("status").notNull().default("kladde"), // kladde, sendt, bogfort
  createdAt: text("created_at").notNull(),
});

export const insertCreditNoteSchema = createInsertSchema(creditNotes).omit({ id: true, createdAt: true });
export type InsertCreditNote = z.infer<typeof insertCreditNoteSchema>;
export type CreditNote = typeof creditNotes.$inferSelect;

// ── Backup Settings (cloud provider config + schedule) ──
export const backupSettings = sqliteTable("backup_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"), // null = platform
  provider: text("provider").notNull().default("local"), // local, google_drive, dropbox, onedrive, aws_s3
  displayName: text("display_name"),
  status: text("status").notNull().default("ikke_aktiv"), // aktiv, ikke_aktiv, fejl
  config: text("config").default("{}"), // JSON: clientId, clientSecret, refreshToken, folderId, etc.
  autoSync: integer("auto_sync").default(0),
  syncInterval: text("sync_interval").default("weekly"), // daily, weekly, monthly
  syncDay: integer("sync_day").default(1), // 0=sunday, 1=monday...
  syncTime: text("sync_time").default("02:00"),
  retentionDays: integer("retention_days").default(30),
  lastSyncAt: text("last_sync_at"),
  lastSyncStatus: text("last_sync_status"),
  lastSyncSize: text("last_sync_size"),
  createdAt: text("created_at").notNull(),
});

export const insertBackupSettingSchema = createInsertSchema(backupSettings).omit({ id: true, createdAt: true });
export type InsertBackupSetting = z.infer<typeof insertBackupSettingSchema>;
export type BackupSetting = typeof backupSettings.$inferSelect;

// ── Lead Integrations (external systems for lead capture) ──
export const leadIntegrations = sqliteTable("lead_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  provider: text("provider").notNull(), // email_inbox, google_ads, facebook_leads, website_form, api_webhook, mailchimp
  displayName: text("display_name"),
  status: text("status").notNull().default("ikke_aktiv"), // aktiv, ikke_aktiv, fejl
  config: text("config").default("{}"), // JSON: apiKey, accountId, formId, webhookUrl, email, etc.
  autoImport: integer("auto_import").default(1),
  lastSyncAt: text("last_sync_at"),
  totalImported: integer("total_imported").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertLeadIntegrationSchema = createInsertSchema(leadIntegrations).omit({ id: true, createdAt: true });
export type InsertLeadIntegration = z.infer<typeof insertLeadIntegrationSchema>;
export type LeadIntegration = typeof leadIntegrations.$inferSelect;

// ── Task Sessions (start/pause/resume/end with auto time tracking) ──
export const taskSessions = sqliteTable("task_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  taskId: integer("task_id").notNull(),
  employeeId: integer("employee_id"),
  userId: integer("user_id"),
  status: text("status").notNull().default("aktiv"), // aktiv, pauset, afsluttet
  startedAt: text("started_at").notNull(),
  pausedAt: text("paused_at"),
  resumedAt: text("resumed_at"),
  endedAt: text("ended_at"),
  pauseReason: text("pause_reason"),
  totalPauseMinutes: integer("total_pause_minutes").default(0),
  durationMinutes: integer("duration_minutes"), // total active minutes (excluding pauses)
  gpsLat: text("gps_lat"),
  gpsLng: text("gps_lng"),
  createdAt: text("created_at").notNull(),
});

export const insertTaskSessionSchema = createInsertSchema(taskSessions).omit({ id: true, createdAt: true });
export type InsertTaskSession = z.infer<typeof insertTaskSessionSchema>;
export type TaskSession = typeof taskSessions.$inferSelect;

// ── Conversations (threaded messaging between company/employee/customer) ──
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull().default("internal"), // internal (company/employee), customer, group
  title: text("title"),
  customerId: integer("customer_id"),
  participantIds: text("participant_ids"), // JSON array of user IDs
  lastMessageAt: text("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  unreadCount: integer("unread_count").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// ── Chat Messages (individual messages in a conversation) ──
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull(),
  companyId: integer("company_id").notNull(),
  senderId: integer("sender_id"), // user ID
  senderName: text("sender_name"),
  senderRole: text("sender_role"), // leder, holdleder, assistent, kunde, platform_admin
  body: text("body").notNull(),
  attachments: text("attachments"), // JSON array
  read: integer("read").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ── Systemopdateringer (auto-notifikation ved opdatering) ──
export const systemReleases = sqliteTable("system_releases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: text("version").notNull(), // f.eks. "2.4.0"
  title: text("title").notNull(),
  description: text("description").notNull(),
  features: text("features"), // JSON-array af features
  status: text("status").notNull().default("installeret"), // installeret, aktiv
  createdAt: text("created_at").notNull(),
});
export const insertSystemReleaseSchema = createInsertSchema(systemReleases).omit({ id: true, createdAt: true });
export type InsertSystemRelease = z.infer<typeof insertSystemReleaseSchema>;
export type SystemRelease = typeof systemReleases.$inferSelect;

// ── Import/eksport jobs ──
export const importJobs = sqliteTable("import_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"), // null = platform
  type: text("type").notNull(), // import, export
  entity: text("entity").notNull(), // kunder, ansatte, opgaver, fakturaer, ydelser, regnskab
  format: text("format").notNull().default("csv"), // csv, json, excel
  status: text("status").notNull().default("afventer"), // afventer, igang, fuldført, fejlet
  rowCount: integer("row_count").default(0),
  errorCount: integer("error_count").default(0),
  errors: text("errors"), // JSON-array af fejlmeddelelser
  fileName: text("file_name"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});
export const insertImportJobSchema = createInsertSchema(importJobs).omit({ id: true, createdAt: true, completedAt: true });
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;

// ── AI Regnskab (beta) — automatisk bogføring, moms, skat ──
export const aiAccountingTasks = sqliteTable("ai_accounting_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // bogføring, moms, skat, compliance, bilag
  status: text("status").notNull().default("afventer"), // afventer, igang, fuldført, fejlet, godkendt
  title: text("title").notNull(),
  description: text("description"),
  data: text("data"), // JSON med opgave-specifikke data
  suggestion: text("suggestion"), // JSON med AI-forslag
  approved: integer("approved").default(0),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});
export const insertAiAccountingTaskSchema = createInsertSchema(aiAccountingTasks).omit({ id: true, createdAt: true, completedAt: true });
export type InsertAiAccountingTask = z.infer<typeof insertAiAccountingTaskSchema>;
export type AiAccountingTask = typeof aiAccountingTasks.$inferSelect;

// ── Bilag & udgifter ──
export const vouchers = sqliteTable("vouchers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  voucherNumber: text("voucher_number").notNull(),
  supplier: text("supplier"),
  date: text("date").notNull(),
  amount: real("amount").notNull().default(0),
  vatAmount: real("vat_amount").default(0),
  vatRate: real("vat_rate").default(0.25),
  description: text("description"),
  category: text("category"), // kontor, transport, materialer, andre
  accountId: text("account_id"),
  status: text("status").notNull().default("kladde"), // kladde, bogfoert, afvist
  aiSuggested: integer("ai_suggested").default(0),
  createdAt: text("created_at").notNull(),
});
export const insertVoucherSchema = createInsertSchema(vouchers).omit({ id: true, createdAt: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchers.$inferSelect;

// ── Bankafstemning ──
export const bankTransactions = sqliteTable("bank_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  balance: real("balance").default(0),
  matchedType: text("matched_type"), // invoice, voucher, journal, none
  matchedId: integer("matched_id"),
  status: text("status").notNull().default("afventer"), // afventer, matchet, ignoreret
  importedAt: text("imported_at").notNull(),
});
export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({ id: true, importedAt: true });
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type BankTransaction = typeof bankTransactions.$inferSelect;

// ── Skat & frister ──
export const taxDeadlines = sqliteTable("tax_deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // moms, skat, aarsopgoerelse
  period: text("period"),
  deadline: text("deadline").notNull(),
  amount: real("amount").default(0),
  status: text("status").notNull().default("afventer"), // afventer, indsendt, overskredet
  submittedAt: text("submitted_at"),
  createdAt: text("created_at").notNull(),
});
export const insertTaxDeadlineSchema = createInsertSchema(taxDeadlines).omit({ id: true, createdAt: true });
export type InsertTaxDeadline = z.infer<typeof insertTaxDeadlineSchema>;
export type TaxDeadline = typeof taxDeadlines.$inferSelect;

// ── Cloud-udbyder konfiguration ──
export const cloudProviders = sqliteTable("cloud_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(), // aws_s3, google_drive, onedrive, dropbox, local
  displayName: text("display_name").notNull(),
  credentials: text("credentials"), // JSON med provider-specifikke credentials
  bucket: text("bucket"), // S3 bucket / Drive folder
  region: text("region"),
  status: text("status").notNull().default("afbrudt"), // forbundet, afbrudt, fejl
  lastSync: text("last_sync"),
  createdAt: text("created_at").notNull(),
});
export const insertCloudProviderSchema = createInsertSchema(cloudProviders).omit({ id: true, createdAt: true });
export type InsertCloudProvider = z.infer<typeof insertCloudProviderSchema>;
export type CloudProvider = typeof cloudProviders.$inferSelect;

// ── Regnskabsautomatisering regler (bank tekst → konto/moms) ──
export const accountingRules = sqliteTable("accounting_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  matchText: text("match_text").notNull(), // tekst der matches i banktransaktioner
  accountNumber: text("account_number").notNull(), // kontonummer der bogføres på
  accountName: text("account_name").notNull(),
  vatCode: text("vat_code"), // momsgruppe
  category: text("category").notNull().default("diverse"), // kontor, lon, leje, transport, etc
  autoBook: integer("auto_book").notNull().default(0), // 1 = automatisk bogført, 0 = forslag til godkendelse
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const insertAccountingRuleSchema = createInsertSchema(accountingRules).omit({ id: true, createdAt: true });
export type InsertAccountingRule = z.infer<typeof insertAccountingRuleSchema>;
export type AccountingRule = typeof accountingRules.$inferSelect;

// ── Periodeafslutning (månedlig/kvartalsvis/årlig) ──
export const periodCloses = sqliteTable("period_closes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  periodType: text("period_type").notNull(), // maaned, kvartal, aar
  periodLabel: text("period_label").notNull(), // f.eks. "August 2026", "Q3 2026", "2026"
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("aabne"), // aabne, afsluttet, genaabnet
  checklist: text("checklist").notNull().default("[]"), // JSON array af {task, done}
  closedBy: text("closed_by"),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertPeriodCloseSchema = createInsertSchema(periodCloses).omit({ id: true, createdAt: true });
export type InsertPeriodClose = z.infer<typeof insertPeriodCloseSchema>;
export type PeriodClose = typeof periodCloses.$inferSelect;

// ── Regnskabsintegrationer (bank API, bilagsindbakke, etc) ──
export const accountingIntegrations = sqliteTable("accounting_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // bank_api, bilagsindbakke, csv_import, revisor_export
  displayName: text("display_name").notNull(),
  config: text("config"), // JSON med konfiguration
  status: text("status").notNull().default("afbrudt"), // forbundet, afbrudt, fejl
  lastSync: text("last_sync"),
  createdAt: text("created_at").notNull(),
});
export const insertAccountingIntegrationSchema = createInsertSchema(accountingIntegrations).omit({ id: true, createdAt: true });
export type InsertAccountingIntegration = z.infer<typeof insertAccountingIntegrationSchema>;
export type AccountingIntegration = typeof accountingIntegrations.$inferSelect;

// ── Bilagsindbakke (OCR scanning af bilag) ──
export const documentInbox = sqliteTable("document_inbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"), // pdf, jpg, png
  source: text("source").notNull().default("upload"), // upload, email, scan
  supplier: text("supplier"), // AI-udtrukket
  amount: real("amount"),
  vatAmount: real("vat_amount"),
  vatRate: real("vat_rate"),
  invoiceDate: text("invoice_date"),
  invoiceNumber: text("invoice_number"),
  suggestedAccount: text("suggested_account"),
  suggestedCategory: text("suggested_category"),
  ocrStatus: text("ocr_status").notNull().default("afventer"), // afventer, behandlet, fejlet
  ocrData: text("ocr_data"), // JSON med alle udtrukne felter
  matchedVoucherId: integer("matched_voucher_id"),
  isDuplicate: integer("is_duplicate").notNull().default(0),
  status: text("status").notNull().default("ny"), // ny, behandlet, arkiveret, afvist
  createdAt: text("created_at").notNull(),
});
export const insertDocumentInboxSchema = createInsertSchema(documentInbox).omit({ id: true, createdAt: true });
export type InsertDocumentInbox = z.infer<typeof insertDocumentInboxSchema>;
export type DocumentInbox = typeof documentInbox.$inferSelect;

// ── Lønbogføring (fra tidsregistrering til lønposter) ──
export const payrollEntries = sqliteTable("payroll_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  period: text("period").notNull(), // f.eks. "August 2026"
  regularHours: real("regular_hours").notNull().default(0),
  overtimeHours: real("overtime_hours").notNull().default(0),
  hourlyRate: real("hourly_rate").notNull().default(0),
  grossSalary: real("gross_salary").notNull().default(0),
  holidayPay: real("holiday_pay").notNull().default(0),
  pension: real("pension").notNull().default(0),
  atp: real("atp").notNull().default(0),
  aTax: real("a_tax").notNull().default(0),
  amContribution: real("am_contribution").notNull().default(0),
  netSalary: real("net_salary").notNull().default(0),
  status: text("status").notNull().default("kladde"), // kladde, bogfort, betalt
  journalEntryId: integer("journal_entry_id"),
  createdAt: text("created_at").notNull(),
});
export const insertPayrollEntrySchema = createInsertSchema(payrollEntries).omit({ id: true, createdAt: true });
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;
export type PayrollEntry = typeof payrollEntries.$inferSelect;

// ── Anlægsregister & afskrivninger ──
export const fixedAssets = sqliteTable("fixed_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(), // maskiner, biler, inventar, it_udstyr
  purchaseDate: text("purchase_date").notNull(),
  purchasePrice: real("purchase_price").notNull(),
  salvageValue: real("salvage_value").notNull().default(0),
  usefulLife: integer("useful_life").notNull(), // antal måneder
  depreciationMethod: text("depreciation_method").notNull().default("linear"), // linear, degressive
  accumulatedDepreciation: real("accumulated_depreciation").notNull().default(0),
  bookValue: real("book_value").notNull().default(0),
  monthlyDepreciation: real("monthly_depreciation").notNull().default(0),
  accountNumber: text("account_number"),
  status: text("status").notNull().default("aktiv"), // aktiv, solgt, kasseret
  soldAt: text("sold_at"),
  soldPrice: real("sold_price"),
  createdAt: text("created_at").notNull(),
});
export const insertFixedAssetSchema = createInsertSchema(fixedAssets).omit({ id: true, createdAt: true });
export type InsertFixedAsset = z.infer<typeof insertFixedAssetSchema>;
export type FixedAsset = typeof fixedAssets.$inferSelect;

// ── Budgetter & prognoser ──
export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month"), // null = hele året
  accountNumber: text("account_number"),
  category: text("category").notNull(), // omsaetning, lon, leje, transport, materialer, diverse
  budgetedAmount: real("budgeted_amount").notNull().default(0),
  actualAmount: real("actual_amount").notNull().default(0),
  variance: real("variance").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true, createdAt: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// ── Omkostningssteder / projektregnskab ──
export const costCenters = sqliteTable("cost_centers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("kunde"), // kunde, afdeling, projekt, lokation
  parentId: integer("parent_id"),
  revenue: real("revenue").notNull().default(0),
  costs: real("costs").notNull().default(0),
  profit: real("profit").notNull().default(0),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const insertCostCenterSchema = createInsertSchema(costCenters).omit({ id: true, createdAt: true });
export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;
export type CostCenter = typeof costCenters.$inferSelect;

// ── Betalingskørsler (kreditorbetalinger) ──
export const paymentRuns = sqliteTable("payment_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  runDate: text("run_date").notNull(),
  totalAmount: real("total_amount").notNull().default(0),
  paymentCount: integer("payment_count").notNull().default(0),
  status: text("status").notNull().default("kladde"), // kladde, godkendt, eksporteret, betalt
  exportFile: text("export_file"), // filnavn på betalingsfil
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  items: text("items"), // JSON array af {voucherId, supplier, amount, account}
  createdAt: text("created_at").notNull(),
});
export const insertPaymentRunSchema = createInsertSchema(paymentRuns).omit({ id: true, createdAt: true });
export type InsertPaymentRun = z.infer<typeof insertPaymentRunSchema>;
export type PaymentRun = typeof paymentRuns.$inferSelect;

// ── Årsafslutning ──
export const yearEndCloses = sqliteTable("year_end_closes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  year: integer("year").notNull(),
  status: text("status").notNull().default("aabne"), // aabne, igang, afsluttet
  result: real("result").notNull().default(0),
  taxResult: real("tax_result").notNull().default(0),
  checklist: text("checklist").notNull().default("[]"),
  auditorPackage: text("auditor_package"), // JSON med links til dokumenter
  closedBy: text("closed_by"),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertYearEndCloseSchema = createInsertSchema(yearEndCloses).omit({ id: true, createdAt: true });
export type InsertYearEndClose = z.infer<typeof insertYearEndCloseSchema>;
export type YearEndClose = typeof yearEndCloses.$inferSelect;

// ── Revisionsspor / audit log — se eksisterende auditLogs tabel ovenfor ──
// Brug eksisterende auditLogs/insertAuditLogSchema fra tidligere i filen

// ── Skattekonto & moms-afstemning ──
export const vatReconciliations = sqliteTable("vat_reconciliations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(),
  outputVat: real("output_vat").notNull().default(0), // udgående moms
  inputVat: real("input_vat").notNull().default(0), // indgående moms
  netVat: real("net_vat").notNull().default(0), // difference
  skatAccount: real("skat_account").notNull().default(0), // saldo på skattekonto
  difference: real("difference").notNull().default(0),
  status: text("status").notNull().default("afventer"), // afventer, afstemt, afvigelse
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertVatReconciliationSchema = createInsertSchema(vatReconciliations).omit({ id: true, createdAt: true });
export type InsertVatReconciliation = z.infer<typeof insertVatReconciliationSchema>;
export type VatReconciliation = typeof vatReconciliations.$inferSelect;

// ── Likviditetsprojektioner (cashflow) ──
export const cashflowProjections = sqliteTable("cashflow_projections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  date: text("date").notNull(),
  type: text("type").notNull(), // indbetaling, udbetaling, loen, moms, skat, leverandoer
  description: text("description"),
  expectedAmount: real("expected_amount").notNull().default(0),
  actualAmount: real("actual_amount"),
  status: text("status").notNull().default("forventet"), // forventet, bekræftet, forfalt
  createdAt: text("created_at").notNull(),
});
export const insertCashflowProjectionSchema = createInsertSchema(cashflowProjections).omit({ id: true, createdAt: true });
export type InsertCashflowProjection = z.infer<typeof insertCashflowProjectionSchema>;
export type CashflowProjection = typeof cashflowProjections.$inferSelect;

// ════════════════════════════════════════════════════════════════
//  SMARTDRIFT CLEAN — 10 NYE TABELLER
// ════════════════════════════════════════════════════════════════

// ── Ruteplanlægning ──
export const routes = sqliteTable("routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  date: text("date").notNull(),
  driverId: integer("driver_id"),
  driverName: text("driver_name"),
  vehicleId: integer("vehicle_id"),
  zone: text("zone"),
  stops: text("stops"), // JSON: [{taskId, address, lat, lng, time, status}]
  totalDistance: real("total_distance"),
  totalTime: real("total_time"),
  status: text("status").notNull().default("planlagt"), // planlagt, igang, afsluttet
  createdAt: text("created_at").notNull(),
});
export const insertRouteSchema = createInsertSchema(routes).omit({ id: true, createdAt: true });
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// ── Kvalitetskontrol ──
export const qualityInspections = sqliteTable("quality_inspections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  taskId: integer("task_id"),
  customerName: text("customer_name"),
  inspectorName: text("inspector_name").notNull(),
  date: text("date").notNull(),
  score: real("score"),
  maxScore: real("max_score").notNull().default(100),
  checklist: text("checklist"), // JSON: [{item, passed, comment}]
  deviations: text("deviations"), // JSON array
  photos: text("photos"), // JSON array of paths
  status: text("status").notNull().default("afventer"), // afventer, godkendt, afvigelse
  correctiveActions: text("corrective_actions"),
  createdAt: text("created_at").notNull(),
});
export const insertQualityInspectionSchema = createInsertSchema(qualityInspections).omit({ id: true, createdAt: true });
export type InsertQualityInspection = z.infer<typeof insertQualityInspectionSchema>;
export type QualityInspection = typeof qualityInspections.$inferSelect;

// ── Kundeportal forespørgsler ──
export const customerRequests = sqliteTable("customer_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  type: text("type").notNull(), // forespørgsel, klage, ændring, ekstra_arbejde
  subject: text("subject").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("ny"), // ny, behandlet, løst, afvist
  response: text("response"),
  createdAt: text("created_at").notNull(),
});
export const insertCustomerRequestSchema = createInsertSchema(customerRequests).omit({ id: true, createdAt: true });
export type InsertCustomerRequest = z.infer<typeof insertCustomerRequestSchema>;
export type CustomerRequest = typeof customerRequests.$inferSelect;

// ── HR / medarbejderdokumenter ──
export const employeeDocuments = sqliteTable("employee_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  type: text("type").notNull(), // kontrakt, certifikat, apv, onboarding, kursus, udstyr
  title: text("title").notNull(),
  fileName: text("file_name"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("aktiv"), // aktiv, udløbet, arkiveret
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments).omit({ id: true, createdAt: true });
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;

// ── CRM / salgspipeline ──
export const salesPipeline = sqliteTable("sales_pipeline", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  leadName: text("lead_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  source: text("source"), // ai_leads, manual, referral, website
  stage: text("stage").notNull().default("ny"), // ny, kontaktet, tilbud_sendt, forhandling, vundet, tabt
  estimatedValue: real("estimated_value"),
  probability: real("probability").notNull().default(0),
  expectedCloseDate: text("expected_close_date"),
  notes: text("notes"),
  lostReason: text("lost_reason"),
  createdAt: text("created_at").notNull(),
});
export const insertSalesPipelineSchema = createInsertSchema(salesPipeline).omit({ id: true, createdAt: true });
export type InsertSalesPipeline = z.infer<typeof insertSalesPipelineSchema>;
export type SalesPipeline = typeof salesPipeline.$inferSelect;

// ── Lager / indkøb ──
export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category"),
  unit: text("unit").notNull().default("stk"),
  quantity: real("quantity").notNull().default(0),
  minQuantity: real("min_quantity").notNull().default(0),
  costPrice: real("cost_price").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  location: text("location"),
  supplier: text("supplier"),
  autoReorder: integer("auto_reorder").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

// ── Udstyr / service ──
export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // maskine, bil, udstyr, værktøj
  serialNumber: text("serial_number"),
  purchaseDate: text("purchase_date"),
  purchasePrice: real("purchase_price"),
  assignedTo: text("assigned_to"),
  location: text("location"),
  serviceInterval: integer("service_interval"), // dage mellem service
  lastServiceDate: text("last_service_date"),
  nextServiceDate: text("next_service_date"),
  status: text("status").notNull().default("aktiv"), // aktiv, service, reparation, ude_af_brug
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// ── SLA / kontraktmotor ──
export const serviceContracts = sqliteTable("service_contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  contractNumber: text("contract_number"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  type: text("type").notNull(), // fast_pris, timeafregnet, abonnement
  price: real("price").notNull().default(0),
  billingCycle: text("billing_cycle").notNull().default("maanedlig"),
  slaLevel: text("sla_level"), // basic, standard, premium
  description: text("description"),
  autoRenew: integer("auto_renew").notNull().default(1),
  priceIndex: real("price_index").notNull().default(0),
  status: text("status").notNull().default("aktiv"), // aktiv, pauset, opsagt, udløbet
  createdAt: text("created_at").notNull(),
});
export const insertServiceContractSchema = createInsertSchema(serviceContracts).omit({ id: true, createdAt: true });
export type InsertServiceContract = z.infer<typeof insertServiceContractSchema>;
export type ServiceContract = typeof serviceContracts.$inferSelect;

// ── AI Driftschef opgaver ──
export const aiDriftTasks = sqliteTable("ai_drift_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // konflikt, bemanding, sygdom, kvalitet, forsinkelse, risiko
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("info"), // info, warning, critical
  data: text("data"), // JSON
  suggestion: text("suggestion"), // JSON
  status: text("status").notNull().default("afventer"), // afventer, godkendt, afvist
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
});
export const insertAiDriftTaskSchema = createInsertSchema(aiDriftTasks).omit({ id: true, createdAt: true });
export type InsertAiDriftTask = z.infer<typeof insertAiDriftTaskSchema>;
export type AiDriftTask = typeof aiDriftTasks.$inferSelect;

// ════════════════════════════════════════════════════════════════
//  SMARTREGNSKAB — 12 NYE TABELLER
// ════════════════════════════════════════════════════════════════

// ── Bank/SKAT/NemHandel integrationer ──
export const bankIntegrations = sqliteTable("bank_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // bank, skat, nemhandel, peppol, eindkomst
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("afventer"), // afventer, forbundet, afbrudt, fejl
  lastSync: text("last_sync"),
  config: text("config"), // JSON
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertBankIntegrationSchema = createInsertSchema(bankIntegrations).omit({ id: true, createdAt: true });
export type InsertBankIntegration = z.infer<typeof insertBankIntegrationSchema>;
export type BankIntegration = typeof bankIntegrations.$inferSelect;

// ── Bogføringslov arkivering ──
export const archiveRecords = sqliteTable("archive_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  voucherNumber: text("voucher_number"),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amount: real("amount"),
  fileName: text("file_name"),
  period: text("period").notNull(),
  locked: integer("locked").notNull().default(0),
  archivePath: text("archive_path"),
  createdAt: text("created_at").notNull(),
});
export const insertArchiveRecordSchema = createInsertSchema(archiveRecords).omit({ id: true, createdAt: true });
export type InsertArchiveRecord = z.infer<typeof insertArchiveRecordSchema>;
export type ArchiveRecord = typeof archiveRecords.$inferSelect;

// ── Lønindberetning ──
export const payrollReports = sqliteTable("payroll_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(),
  employeeCount: integer("employee_count").notNull().default(0),
  grossTotal: real("gross_total").notNull().default(0),
  taxTotal: real("tax_total").notNull().default(0),
  holidayPayTotal: real("holiday_pay_total").notNull().default(0),
  pensionTotal: real("pension_total").notNull().default(0),
  atpTotal: real("atp_total").notNull().default(0),
  amContributionTotal: real("am_contribution_total").notNull().default(0),
  netTotal: real("net_total").notNull().default(0),
  eindkomstStatus: text("eindkomst_status").notNull().default("ikke_sendt"),
  feriekontoStatus: text("feriekonto_status").notNull().default("ikke_sendt"),
  status: text("status").notNull().default("kladde"),
  submittedAt: text("submitted_at"),
  createdAt: text("created_at").notNull(),
});
export const insertPayrollReportSchema = createInsertSchema(payrollReports).omit({ id: true, createdAt: true });
export type InsertPayrollReport = z.infer<typeof insertPayrollReportSchema>;
export type PayrollReport = typeof payrollReports.$inferSelect;

// ── Årsrapport ──
export const annualReports = sqliteTable("annual_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  year: integer("year").notNull(),
  result: real("result").notNull().default(0),
  taxResult: real("tax_result").notNull().default(0),
  balanceTotal: real("balance_total").notNull().default(0),
  equity: real("equity").notNull().default(0),
  xbrlStatus: text("xbrl_status").notNull().default("ikke_genereret"),
  auditorPackage: text("auditor_package"), // JSON
  status: text("status").notNull().default("kladde"),
  submittedToErhvervsstyrelsen: integer("submitted_to_erhvervsstyrelsen").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export const insertAnnualReportSchema = createInsertSchema(annualReports).omit({ id: true, createdAt: true });
export type InsertAnnualReport = z.infer<typeof insertAnnualReportSchema>;
export type AnnualReport = typeof annualReports.$inferSelect;

// ── Avanceret debitorstyring (rykkerflow) ──
export const reminderFlow = sqliteTable("reminder_flow", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  invoiceId: integer("invoice_id").notNull(),
  invoiceNumber: text("invoice_number"),
  customerName: text("customer_name"),
  amount: real("amount").notNull().default(0),
  daysOverdue: integer("days_overdue").notNull().default(0),
  reminderLevel: integer("reminder_level").notNull().default(1), // 1, 2, 3, inkasso
  reminderFee: real("reminder_fee").notNull().default(0),
  interest: real("interest").notNull().default(0),
  status: text("status").notNull().default("afventer"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
});
export const insertReminderFlowSchema = createInsertSchema(reminderFlow).omit({ id: true, createdAt: true });
export type InsertReminderFlow = z.infer<typeof insertReminderFlowSchema>;
export type ReminderFlow = typeof reminderFlow.$inferSelect;

// ── Periodisering ──
export const accruals = sqliteTable("accruals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // forudbetalt, skyldig, tilbagevendende, lan, leasing
  amount: real("amount").notNull().default(0),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  accountNumber: text("account_number"),
  monthlyAmount: real("monthly_amount").notNull().default(0),
  status: text("status").notNull().default("aktiv"),
  createdAt: text("created_at").notNull(),
});
export const insertAccrualSchema = createInsertSchema(accruals).omit({ id: true, createdAt: true });
export type InsertAccrual = z.infer<typeof insertAccrualSchema>;
export type Accrual = typeof accruals.$inferSelect;

// ── Lagerregnskab ──
export const inventoryAccounts = sqliteTable("inventory_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: real("quantity").notNull().default(0),
  unitCost: real("unit_cost").notNull().default(0),
  totalValue: real("total_value").notNull().default(0),
  location: text("location"),
  lastCountDate: text("last_count_date"),
  status: text("status").notNull().default("aktiv"),
  createdAt: text("created_at").notNull(),
});
export const insertInventoryAccountSchema = createInsertSchema(inventoryAccounts).omit({ id: true, createdAt: true });
export type InsertInventoryAccount = z.infer<typeof insertInventoryAccountSchema>;
export type InventoryAccount = typeof inventoryAccounts.$inferSelect;

// ── Valuta & udenlandsk moms ──
export const currencyTransactions = sqliteTable("currency_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  date: text("date").notNull(),
  currency: text("currency").notNull(), // EUR, USD, GBP
  amount: real("amount").notNull().default(0),
  rate: real("rate").notNull().default(0),
  dkkAmount: real("dkk_amount").notNull().default(0),
  vatType: text("vat_type"), // eu_moms, reverse_charge, oss, intrastat
  description: text("description"),
  status: text("status").notNull().default("ny"),
  createdAt: text("created_at").notNull(),
});
export const insertCurrencyTransactionSchema = createInsertSchema(currencyTransactions).omit({ id: true, createdAt: true });
export type InsertCurrencyTransaction = z.infer<typeof insertCurrencyTransactionSchema>;
export type CurrencyTransaction = typeof currencyTransactions.$inferSelect;

// ── Revisorportal ──
export const auditorPortal = sqliteTable("auditor_portal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  auditorName: text("auditor_name"),
  requestType: text("request_type").notNull(), // bilagsanmodning, kommentar, godkendelse, arbejdsprogram
  description: text("description").notNull(),
  status: text("status").notNull().default("afventer"),
  response: text("response"),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull(),
});
export const insertAuditorPortalSchema = createInsertSchema(auditorPortal).omit({ id: true, createdAt: true });
export type InsertAuditorPortal = z.infer<typeof insertAuditorPortalSchema>;
export type AuditorPortal = typeof auditorPortal.$inferSelect;

// ── Roller & kontrol ──
export const roleControls = sqliteTable("role_controls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  roleName: text("role_name").notNull(),
  module: text("module").notNull(),
  canCreate: integer("can_create").notNull().default(0),
  canEdit: integer("can_edit").notNull().default(0),
  canDelete: integer("can_delete").notNull().default(0),
  canApprove: integer("can_approve").notNull().default(0),
  approvalLimit: real("approval_limit"),
  requiresTwoFactor: integer("requires_two_factor").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export const insertRoleControlSchema = createInsertSchema(roleControls).omit({ id: true, createdAt: true });
export type InsertRoleControl = z.infer<typeof insertRoleControlSchema>;
export type RoleControl = typeof roleControls.$inferSelect;

// ── Importguide ──
export const importJobs2 = sqliteTable("import_jobs2", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  source: text("source").notNull(), // economic, dinero, billy, excel, csv
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("uploadet"),
  totalRows: integer("total_rows"),
  importedRows: integer("imported_rows"),
  errorRows: integer("error_rows"),
  preview: text("preview"), // JSON sample
  mapping: text("mapping"), // JSON field mapping
  createdAt: text("created_at").notNull(),
});
export const insertImportJob2Schema = createInsertSchema(importJobs2).omit({ id: true, createdAt: true });
export type InsertImportJob2 = z.infer<typeof insertImportJob2Schema>;
export type ImportJob2 = typeof importJobs2.$inferSelect;

// ════════════════════════════════════════════════════════════════
//  RYGESPURT 2: SmartDrift Clean — 12 nye features
// ════════════════════════════════════════════════════════════════

// 1. Mobil/PWA — offline sync queue
export const mobileSyncQueue = sqliteTable("mobile_sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  deviceInfo: text("device_info"),
  syncType: text("sync_type").notNull(), // tjekliste, foto, qr, nfc, tidsreg
  payload: text("payload").notNull(),
  status: text("status").notNull().default("afventer"), // afventer, synkroniseret, konflikt, fejl
  syncedAt: text("synced_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});
export const insertMobileSyncQueueSchema = createInsertSchema(mobileSyncQueue).omit({ id: true, createdAt: true });
export type InsertMobileSyncQueue = z.infer<typeof insertMobileSyncQueueSchema>;
export type MobileSyncQueue = typeof mobileSyncQueue.$inferSelect;

// 2. Live driftstavle
export const liveBoardEvents = sqliteTable("live_board_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // medarbejder_status, forsinkelse, sla_bryd, sygdom, afvigelse
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("info"),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  location: text("location"),
  timestamp: text("timestamp").notNull(),
  status: text("status").notNull().default("aktiv"),
  createdAt: text("created_at").notNull(),
});
export const insertLiveBoardEventSchema = createInsertSchema(liveBoardEvents).omit({ id: true, createdAt: true });
export type InsertLiveBoardEvent = z.infer<typeof insertLiveBoardEventSchema>;
export type LiveBoardEvent = typeof liveBoardEvents.$inferSelect;

// 3. Kundehierarki — lokationer
export const customerLocations = sqliteTable("customer_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name"),
  name: text("name").notNull(),
  address: text("address"),
  zip: text("zip"),
  city: text("city"),
  contactPerson: text("contact_person"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  accessInstructions: text("access_instructions"),
  keyNumber: text("key_number"),
  alarmCode: text("alarm_code"),
  cleaningAreas: text("cleaning_areas"),
  status: text("status").notNull().default("aktiv"),
  createdAt: text("created_at").notNull(),
});
export const insertCustomerLocationSchema = createInsertSchema(customerLocations).omit({ id: true, createdAt: true });
export type InsertCustomerLocation = z.infer<typeof insertCustomerLocationSchema>;
export type CustomerLocation = typeof customerLocations.$inferSelect;

// 4. Løn- og overenskomstmotor
export const payrollCalculations = sqliteTable("payroll_calculations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  employeeName: text("employee_name"),
  period: text("period").notNull(),
  baseHours: real("base_hours"),
  overtimeHours: real("overtime_hours"),
  holidayHours: real("holiday_hours"),
  nightHours: real("night_hours"),
  weekendHours: real("weekend_hours"),
  basePay: real("base_pay"),
  overtimePay: real("overtime_pay"),
  holidayPay: real("holiday_pay"),
  nightSurcharge: real("night_surcharge"),
  weekendSurcharge: real("weekend_surcharge"),
  kilometers: real("kilometers"),
  mileageAllowance: real("mileage_allowance"),
  pension: real("pension"),
  atp: real("atp"),
  amContribution: real("am_contribution"),
  aTax: real("a_tax"),
  grossSalary: real("gross_salary"),
  netSalary: real("net_salary"),
  vacationPay: real("vacation_pay"),
  status: text("status").notNull().default("kladde"),
  createdAt: text("created_at").notNull(),
});
export const insertPayrollCalculationSchema = createInsertSchema(payrollCalculations).omit({ id: true, createdAt: true });
export type InsertPayrollCalculation = z.infer<typeof insertPayrollCalculationSchema>;
export type PayrollCalculation = typeof payrollCalculations.$inferSelect;

// 5. E-signatur
export const esignatures = sqliteTable("esignatures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  documentType: text("document_type").notNull(), // tilbud, kontrakt, apv, medarbejderkontrakt, kundegodkendelse
  documentTitle: text("document_title").notNull(),
  relatedId: integer("related_id"),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signerRole: text("signer_role"),
  signatureHash: text("signature_hash"),
  signedAt: text("signed_at"),
  expiresAt: text("expires_at"),
  status: text("status").notNull().default("afventer"), // afventer, underskrevet, afvist, udløbet
  ip: text("ip"),
  createdAt: text("created_at").notNull(),
});
export const insertEsignatureSchema = createInsertSchema(esignatures).omit({ id: true, createdAt: true });
export type InsertEsignature = z.infer<typeof insertEsignatureSchema>;
export type Esignature = typeof esignatures.$inferSelect;

// 6. Dokumentcenter
export const documentCenter = sqliteTable("document_center", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  category: text("category").notNull(), // kunde, medarbejder, opgave, kontrakt, udstyr
  linkedId: integer("linked_id"),
  title: text("title").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  version: integer("version").notNull().default(1),
  uploadedBy: text("uploaded_by"),
  description: text("description"),
  tags: text("tags"),
  status: text("status").notNull().default("aktiv"),
  createdAt: text("created_at").notNull(),
});
export const insertDocumentCenterSchema = createInsertSchema(documentCenter).omit({ id: true, createdAt: true });
export type InsertDocumentCenter = z.infer<typeof insertDocumentCenterSchema>;
export type DocumentCenter = typeof documentCenter.$inferSelect;

// 7. Indkøb/leverandører
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  poNumber: text("po_number"),
  supplier: text("supplier").notNull(),
  supplierEmail: text("supplier_email"),
  supplierPhone: text("supplier_phone"),
  items: text("items"), // JSON array
  totalAmount: real("total_amount"),
  status: text("status").notNull().default("kladde"), // kladde, sendt, modtaget, delvis, afsluttet, annulleret
  expectedDate: text("expected_date"),
  receivedDate: text("received_date"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// 8. Profitabilitet
export const profitabilityReports = sqliteTable("profitability_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  entityType: text("entity_type").notNull(), // kunde, lokation, opgave, kontrakt
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  period: text("period").notNull(),
  revenue: real("revenue").notNull().default(0),
  laborCost: real("labor_cost").notNull().default(0),
  materialCost: real("material_cost").notNull().default(0),
  transportCost: real("transport_cost").notNull().default(0),
  overhead: real("overhead").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  profit: real("profit").notNull().default(0),
  margin: real("margin").notNull().default(0),
  hoursWorked: real("hours_worked"),
  createdAt: text("created_at").notNull(),
});
export const insertProfitabilityReportSchema = createInsertSchema(profitabilityReports).omit({ id: true, createdAt: true });
export type InsertProfitabilityReport = z.infer<typeof insertProfitabilityReportSchema>;
export type ProfitabilityReport = typeof profitabilityReports.$inferSelect;

// 9. Servicehistorik & billedarkiv
export const serviceHistory = sqliteTable("service_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerName: text("customer_name"),
  locationName: text("location_name"),
  taskType: text("task_type"),
  date: text("date").notNull(),
  employeeName: text("employee_name"),
  beforePhotos: text("before_photos"), // JSON array
  afterPhotos: text("after_photos"), // JSON array
  notes: text("notes"),
  rating: integer("rating"),
  status: text("status").notNull().default("afsluttet"),
  createdAt: text("created_at").notNull(),
});
export const insertServiceHistorySchema = createInsertSchema(serviceHistory).omit({ id: true, createdAt: true });
export type InsertServiceHistory = z.infer<typeof insertServiceHistorySchema>;
export type ServiceHistory = typeof serviceHistory.$inferSelect;

// 10. Arbejdsmiljø & hændelser
export const workplaceIncidents = sqliteTable("workplace_incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // ulykke, naarved_haendelse, skade, kemikalie, sds
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  location: text("location"),
  involvedEmployee: text("involved_employee"),
  severity: text("severity").notNull().default("info"),
  chemicalName: text("chemical_name"),
  sdsNumber: text("sds_number"),
  reportedBy: text("reported_by"),
  actions: text("actions"),
  status: text("status").notNull().default("rapporteret"),
  createdAt: text("created_at").notNull(),
});
export const insertWorkplaceIncidentSchema = createInsertSchema(workplaceIncidents).omit({ id: true, createdAt: true });
export type InsertWorkplaceIncident = z.infer<typeof insertWorkplaceIncidentSchema>;
export type WorkplaceIncident = typeof workplaceIncidents.$inferSelect;

// 11. Kundeselvbetjening
export const customerSelfService = sqliteTable("customer_self_service", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  requestType: text("request_type").notNull(), // ekstra_arbejde, tilbud_godkendelse, reklamation, rapport, dokument
  title: text("title").notNull(),
  description: text("description"),
  preferredDate: text("preferred_date"),
  status: text("status").notNull().default("modtaget"),
  response: text("response"),
  respondedBy: text("responded_by"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull(),
});
export const insertCustomerSelfServiceSchema = createInsertSchema(customerSelfService).omit({ id: true, createdAt: true });
export type InsertCustomerSelfService = z.infer<typeof insertCustomerSelfServiceSchema>;
export type CustomerSelfService = typeof customerSelfService.$inferSelect;

// 12. Platform-admin værktøjer
export const platformSubscriptions = sqliteTable("platform_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  companyName: text("company_name").notNull(),
  plan: text("plan").notNull().default("basis"),
  price: real("price").notNull().default(0),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  maxUsers: integer("max_users"),
  maxEmployees: integer("max_employees"),
  aiEnabled: integer("ai_enabled", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("aktiv"),
  trialEndsAt: text("trial_ends_at"),
  nextBillingDate: text("next_billing_date"),
  createdAt: text("created_at").notNull(),
});
export const insertPlatformSubscriptionSchema = createInsertSchema(platformSubscriptions).omit({ id: true, createdAt: true });
export type InsertPlatformSubscription = z.infer<typeof insertPlatformSubscriptionSchema>;
export type PlatformSubscription = typeof platformSubscriptions.$inferSelect;

// ════════════════════════════════════════════════════════════════
//  RYGESPURT 2: SmartRegnskab — 12 nye features
// ════════════════════════════════════════════════════════════════

// 13. Ægte integrationsflow
export const integrationConfigs = sqliteTable("integration_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(), // bank, skat, nemhandel, eindkomst, mitid, peppol
  provider: text("provider"),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("ikke_forbundet"),
  authMethod: text("auth_method"),
  config: text("config"),
  lastSync: text("last_sync"),
  syncStatus: text("sync_status"),
  errorMessage: text("error_message"),
  apiAgreement: text("api_agreement"),
  createdAt: text("created_at").notNull(),
});
export const insertIntegrationConfigSchema = createInsertSchema(integrationConfigs).omit({ id: true, createdAt: true });
export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;

// 14. Compliance-checks
export const complianceChecks = sqliteTable("compliance_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  category: text("category").notNull(), // bogforingslov, momslov, selskabsskattelov, arsregnskab
  checkName: text("check_name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("afventer"),
  result: text("result"),
  checkedAt: text("checked_at"),
  notes: text("notes"),
  requiresLegal: integer("requires_legal", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});
export const insertComplianceCheckSchema = createInsertSchema(complianceChecks).omit({ id: true, createdAt: true });
export type InsertComplianceCheck = z.infer<typeof insertComplianceCheckSchema>;
export type ComplianceCheck = typeof complianceChecks.$inferSelect;

// 15. Koncern/konsolidering
export const consolidationEntries = sqliteTable("consolidation_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(),
  parentCompany: text("parent_company"),
  subsidiaryCompany: text("subsidiary_company"),
  type: text("type").notNull(), // eliminering, intern_handel, intercompany, goodwill
  accountNumber: text("account_number"),
  description: text("description").notNull(),
  amount: real("amount").notNull().default(0),
  eliminationType: text("elimination_type"),
  status: text("status").notNull().default("kladde"),
  createdAt: text("created_at").notNull(),
});
export const insertConsolidationEntrySchema = createInsertSchema(consolidationEntries).omit({ id: true, createdAt: true });
export type InsertConsolidationEntry = z.infer<typeof insertConsolidationEntrySchema>;
export type ConsolidationEntry = typeof consolidationEntries.$inferSelect;

// 16. Avanceret moms
export const advancedVat = sqliteTable("advanced_vat", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(),
  vatType: text("vat_type").notNull(), // indenlandsk, eu_med_vat, eu_uden_vat, reverse_charge, import_moms, oss, intrastat
  country: text("country"),
  basis: real("basis").notNull().default(0),
  vatRate: real("vat_rate"),
  vatAmount: real("vat_amount").notNull().default(0),
  deductionRate: real("deduction_rate"),
  deductibleAmount: real("deductible_amount"),
  description: text("description"),
  status: text("status").notNull().default("kladde"),
  createdAt: text("created_at").notNull(),
});
export const insertAdvancedVatSchema = createInsertSchema(advancedVat).omit({ id: true, createdAt: true });
export type InsertAdvancedVat = z.infer<typeof insertAdvancedVatSchema>;
export type AdvancedVat = typeof advancedVat.$inferSelect;

// 17. Reelle bankbetalinger
export const bankPayments = sqliteTable("bank_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  paymentFileId: text("payment_file_id"),
  recipientName: text("recipient_name").notNull(),
  recipientAccount: text("recipient_account"),
  recipientReg: text("recipient_reg"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("DKK"),
  paymentDate: text("payment_date"),
  reference: text("reference"),
  message: text("message"),
  status: text("status").notNull().default("kladde"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  bankStatus: text("bank_status"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});
export const insertBankPaymentSchema = createInsertSchema(bankPayments).omit({ id: true, createdAt: true });
export type InsertBankPayment = z.infer<typeof insertBankPaymentSchema>;
export type BankPayment = typeof bankPayments.$inferSelect;

// 18. Fuld lønmotor
export const payrollEngine = sqliteTable("payroll_engine", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  employeeName: text("employee_name"),
  period: text("period").notNull(),
  payslipNumber: text("payslip_number"),
  grossSalary: real("gross_salary"),
  aTax: real("a_tax"),
  atp: real("atp"),
  amContribution: real("am_contribution"),
  holidayPay: real("holiday_pay"),
  pension: real("pension"),
  healthInsurance: real("health_insurance"),
  unionContribution: real("union_contribution"),
  netSalary: real("net_salary"),
  hours: real("hours"),
  hourlyRate: real("hourly_rate"),
  overtime: real("overtime"),
  mileage: real("mileage"),
  deductions: real("deductions"),
  eindkomstStatus: text("eindkomst_status").default("ikke_sendt"),
  feriekontoStatus: text("feriekonto_status").default("ikke_sendt"),
  status: text("status").notNull().default("kladde"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
});
export const insertPayrollEngineSchema = createInsertSchema(payrollEngine).omit({ id: true, createdAt: true });
export type InsertPayrollEngine = z.infer<typeof insertPayrollEngineSchema>;
export type PayrollEngine = typeof payrollEngine.$inferSelect;

// 19. Revisionspakke
export const auditPackage = sqliteTable("audit_package", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  year: text("year").notNull(),
  type: text("type").notNull(), // permanent_fil, arbejdspapir, note, bilagsanmodning, sign_off
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  preparedBy: text("prepared_by"),
  reviewedBy: text("reviewed_by"),
  status: text("status").notNull().default("kladde"),
  signedOffAt: text("signed_off_at"),
  createdAt: text("created_at").notNull(),
});
export const insertAuditPackageSchema = createInsertSchema(auditPackage).omit({ id: true, createdAt: true });
export type InsertAuditPackage = z.infer<typeof insertAuditPackageSchema>;
export type AuditPackage = typeof auditPackage.$inferSelect;

// 20. Budget versioner/scenarier
export const budgetVersions = sqliteTable("budget_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  year: text("year").notNull(),
  scenario: text("scenario").notNull().default("basis"),
  version: integer("version").notNull().default(1),
  data: text("data"),
  totalRevenue: real("total_revenue"),
  totalCosts: real("total_costs"),
  totalResult: real("total_result"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  status: text("status").notNull().default("kladde"),
  createdAt: text("created_at").notNull(),
});
export const insertBudgetVersionSchema = createInsertSchema(budgetVersions).omit({ id: true, createdAt: true });
export type InsertBudgetVersion = z.infer<typeof insertBudgetVersionSchema>;
export type BudgetVersion = typeof budgetVersions.$inferSelect;

// 21. Automatisk afstemningscenter
export const reconciliationCenter = sqliteTable("reconciliation_center", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(),
  type: text("type").notNull(),
  accountNumber: text("account_number"),
  bookAmount: real("book_amount"),
  externalAmount: real("external_amount"),
  difference: real("difference"),
  matchedTransactions: integer("matched_transactions"),
  unmatchedTransactions: integer("unmatched_transactions"),
  autoMatched: integer("auto_matched"),
  status: text("status").notNull().default("afventer"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertReconciliationCenterSchema = createInsertSchema(reconciliationCenter).omit({ id: true, createdAt: true });
export type InsertReconciliationCenter = z.infer<typeof insertReconciliationCenterSchema>;
export type ReconciliationCenter = typeof reconciliationCenter.$inferSelect;

// 22. OIOUBL/NemHandel dybde
export const einvoiceQueue = sqliteTable("einvoice_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  direction: text("direction").notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceId: integer("invoice_id"),
  counterpartyName: text("counterparty_name"),
  amount: real("amount"),
  format: text("format").default("OIOUBL"),
  validationStatus: text("validation_status").default("afventer"),
  validationErrors: text("validation_errors"),
  routingStatus: text("routing_status").default("afventer"),
  status: text("status").notNull().default("modtaget"),
  processedAt: text("processed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertEinvoiceQueueSchema = createInsertSchema(einvoiceQueue).omit({ id: true, createdAt: true });
export type InsertEinvoiceQueue = z.infer<typeof insertEinvoiceQueueSchema>;
export type EinvoiceQueue = typeof einvoiceQueue.$inferSelect;

// 23. API-nøglestyring
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix"),
  keyHash: text("key_hash"),
  scopes: text("scopes"),
  rateLimit: integer("rate_limit"),
  lastUsed: text("last_used"),
  webhookUrl: text("webhook_url"),
  webhookEvents: text("webhook_events"),
  webhookLog: text("webhook_log"),
  status: text("status").notNull().default("aktiv"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
});
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// 24. Datamigrering
export const migrationJobs = sqliteTable("migration_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  source: text("source").notNull(),
  sourceVersion: text("source_version"),
  fileName: text("file_name"),
  mapping: text("mapping"),
  totalRows: integer("total_rows"),
  importedRows: integer("imported_rows").default(0),
  errorRows: integer("error_rows").default(0),
  validationErrors: text("validation_errors"),
  rollbackAvailable: integer("rollback_available", { mode: "boolean" }).default(true),
  rolledBackAt: text("rolled_back_at"),
  status: text("status").notNull().default("uploadet"),
  createdAt: text("created_at").notNull(),
});
export const insertMigrationJobSchema = createInsertSchema(migrationJobs).omit({ id: true, createdAt: true });
export type InsertMigrationJob = z.infer<typeof insertMigrationJobSchema>;
export type MigrationJob = typeof migrationJobs.$inferSelect;

// ═════════════════════════════════════════════════════════════════
// BATCH 3 — Branche-uafhængighed, sammenkobling, hardening, portal
// ═════════════════════════════════════════════════════════════════

// ── SmartRegnskab branche-uafhængighed ──
export const businessProfiles = sqliteTable("business_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  industry: text("industry").notNull(), // rengøring, håndværk, detail, konsulent, restaurant, transport, klinik, ejendom, saas, andet
  companyType: text("company_type"), // aps, as, ivs, enkeltmand, is, ks
  vatSetup: text("vat_setup"), // almindelig, lille, stor, fritaget
  reportingStandard: text("reporting_standard").default("regnskabssætning"), // regnskabssætning, IFRS, IDSASF
  fiscalYearStart: text("fiscal_year_start"),
  currency: text("currency").default("DKK"),
  defaultTaxRate: real("default_tax_rate").default(25),
  dimensionsConfig: text("dimensions_config"), // JSON: ["afdeling","projekt","lokation","kunde","produkt"]
  customFields: text("custom_fields"), // JSON
  createdAt: text("created_at").notNull(),
});
export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).omit({ id: true, createdAt: true });
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfiles.$inferSelect;

export const industryAccountTemplates = sqliteTable("industry_account_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  industry: text("industry").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(), // aktiv, passiv, indtægt, omkostning, status
  vatCode: text("vat_code"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  description: text("description"),
});
export const insertIndustryAccountTemplateSchema = createInsertSchema(industryAccountTemplates).omit({ id: true });
export type InsertIndustryAccountTemplate = z.infer<typeof insertIndustryAccountTemplateSchema>;
export type IndustryAccountTemplate = typeof industryAccountTemplates.$inferSelect;

export const dimensionDefinitions = sqliteTable("dimension_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(), // afdeling, projekt, lokation, kunde, produkt
  code: text("code").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});
export const insertDimensionDefinitionSchema = createInsertSchema(dimensionDefinitions).omit({ id: true, createdAt: true });
export type InsertDimensionDefinition = z.infer<typeof insertDimensionDefinitionSchema>;
export type DimensionDefinition = typeof dimensionDefinitions.$inferSelect;

export const dimensionValues = sqliteTable("dimension_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  dimensionId: integer("dimension_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});
export const insertDimensionValueSchema = createInsertSchema(dimensionValues).omit({ id: true });
export type InsertDimensionValue = z.infer<typeof insertDimensionValueSchema>;
export type DimensionValue = typeof dimensionValues.$inferSelect;

export const accountingCategoryRules = sqliteTable("accounting_category_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  industry: text("industry"),
  categoryName: text("category_name").notNull(),
  accountNumber: text("account_number").notNull(),
  ruleType: text("rule_type").notNull(), // indtægt, omkostning, aktiv, passiv
  vatTreatment: text("vat_treatment"),
  description: text("description"),
});
export const insertAccountingCategoryRuleSchema = createInsertSchema(accountingCategoryRules).omit({ id: true });
export type InsertAccountingCategoryRule = z.infer<typeof insertAccountingCategoryRuleSchema>;
export type AccountingCategoryRule = typeof accountingCategoryRules.$inferSelect;

// ── Sammenkobling & workflow ──
export const platformSyncJobs = sqliteTable("platform_sync_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  sourcePlatform: text("source_platform").notNull(), // smartdrift_clean, smartregnskab
  targetPlatform: text("target_platform").notNull(),
  syncType: text("sync_type").notNull(), // kunder, fakturaer, timer, løn, materialer, kontrakter
  status: text("status").notNull().default("afventer"),
  totalRecords: integer("total_records").default(0),
  syncedRecords: integer("synced_records").default(0),
  errorRecords: integer("error_records").default(0),
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertPlatformSyncJobSchema = createInsertSchema(platformSyncJobs).omit({ id: true, createdAt: true });
export type InsertPlatformSyncJob = z.infer<typeof insertPlatformSyncJobSchema>;
export type PlatformSyncJob = typeof platformSyncJobs.$inferSelect;

export const platformSyncMappings = sqliteTable("platform_sync_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  syncType: text("sync_type").notNull(),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  sourcePlatform: text("source_platform").notNull(),
  targetPlatform: text("target_platform").notNull(),
  status: text("status").notNull().default("synkroniseret"),
  lastSyncedAt: text("last_synced_at"),
});
export const insertPlatformSyncMappingSchema = createInsertSchema(platformSyncMappings).omit({ id: true });
export type InsertPlatformSyncMapping = z.infer<typeof insertPlatformSyncMappingSchema>;
export type PlatformSyncMapping = typeof platformSyncMappings.$inferSelect;

export const workflowDefinitions = sqliteTable("workflow_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(), // tilbud_oprettet, kontrakt_underskrevet, opgave_afsluttet, faktura_sendt, betaling_modtaget
  steps: text("steps").notNull(), // JSON array of steps
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});
export const insertWorkflowDefinitionSchema = createInsertSchema(workflowDefinitions).omit({ id: true, createdAt: true });
export type InsertWorkflowDefinition = z.infer<typeof insertWorkflowDefinitionSchema>;
export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;

export const workflowRuns = sqliteTable("workflow_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  workflowId: integer("workflow_id").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull().default("startet"),
  currentStep: integer("current_step").default(0),
  totalSteps: integer("total_steps").default(0),
  result: text("result"),
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({ id: true, createdAt: true });
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type WorkflowRun = typeof workflowRuns.$inferSelect;

// ── Filhåndtering ──
export const fileObjects = sqliteTable("file_objects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  category: text("category"), // bilag, kontrakt, foto, dokument, rapport
  uploadedBy: text("uploaded_by"),
  storagePath: text("storage_path"),
  checksum: text("checksum"),
  isVirusScanned: integer("is_virus_scanned", { mode: "boolean" }).default(false),
  status: text("status").default("aktiv"),
  createdAt: text("created_at").notNull(),
});
export const insertFileObjectSchema = createInsertSchema(fileObjects).omit({ id: true, createdAt: true });
export type InsertFileObject = z.infer<typeof insertFileObjectSchema>;
export type FileObject = typeof fileObjects.$inferSelect;

export const fileVersions = sqliteTable("file_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  fileId: integer("file_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  checksum: text("checksum"),
  uploadedBy: text("uploaded_by"),
  changeNote: text("change_note"),
  createdAt: text("created_at").notNull(),
});
export const insertFileVersionSchema = createInsertSchema(fileVersions).omit({ id: true, createdAt: true });
export type InsertFileVersion = z.infer<typeof insertFileVersionSchema>;
export type FileVersion = typeof fileVersions.$inferSelect;

// ── Compliance & dokumentation ──
export const complianceDocuments = sqliteTable("compliance_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  documentType: text("document_type").notNull(), // databehandleraftale, privacy_policy, gdpr_assessment, control_description, audit_report
  title: text("title").notNull(),
  status: text("status").notNull().default("kladde"),
  version: text("version").default("1.0"),
  requiresLegalReview: integer("requires_legal_review", { mode: "boolean" }).default(true),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  validUntil: text("valid_until"),
  content: text("content"),
  createdAt: text("created_at").notNull(),
});
export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({ id: true, createdAt: true });
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;

export const controlTests = sqliteTable("control_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  controlName: text("control_name").notNull(),
  controlCategory: text("control_category").notNull(), // adgangsstyring, ændringsstyring, driftsstyring, dataintegritet
  testStatus: text("test_status").notNull().default("ikke_testet"),
  testResult: text("test_result"),
  testedBy: text("tested_by"),
  testedAt: text("tested_at"),
  frequency: text("frequency"), // månedlig, kvartalvis, årlig
  description: text("description"),
  createdAt: text("created_at").notNull(),
});
export const insertControlTestSchema = createInsertSchema(controlTests).omit({ id: true, createdAt: true });
export type InsertControlTest = z.infer<typeof insertControlTestSchema>;
export type ControlTest = typeof controlTests.$inferSelect;

// ── Sikkerhed & drift ──
export const securityAuditEvents = sqliteTable("security_audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  userId: text("user_id"),
  eventType: text("event_type").notNull(), // login, login_failed, permission_change, data_export, data_delete, role_change, mfa_enable, mfa_disable
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  action: text("action"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  result: text("result").default("success"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});
export const insertSecurityAuditEventSchema = createInsertSchema(securityAuditEvents).omit({ id: true, createdAt: true });
export type InsertSecurityAuditEvent = z.infer<typeof insertSecurityAuditEventSchema>;
export type SecurityAuditEvent = typeof securityAuditEvents.$inferSelect;

export const integrationRuns = sqliteTable("integration_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  integrationType: text("integration_type").notNull(),
  status: text("status").notNull().default("startet"),
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccess: integer("records_success").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertIntegrationRunSchema = createInsertSchema(integrationRuns).omit({ id: true, createdAt: true });
export type InsertIntegrationRun = z.infer<typeof insertIntegrationRunSchema>;
export type IntegrationRun = typeof integrationRuns.$inferSelect;

export const integrationRetryQueue = sqliteTable("integration_retry_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  integrationType: text("integration_type").notNull(),
  payload: text("payload"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  nextRetryAt: text("next_retry_at"),
  status: text("status").notNull().default("afventer"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});
export const insertIntegrationRetryQueueSchema = createInsertSchema(integrationRetryQueue).omit({ id: true, createdAt: true });
export type InsertIntegrationRetryQueue = z.infer<typeof insertIntegrationRetryQueueSchema>;
export type IntegrationRetryQueue = typeof integrationRetryQueue.$inferSelect;

// ── AI-styring, beslutningsspor og regelovervågning ──
export const aiGovernanceSettings = sqliteTable("ai_governance_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  targetAutonomyPercent: integer("target_autonomy_percent").notNull().default(99),
  minimumConfidence: real("minimum_confidence").notNull().default(0.98),
  requireEvidence: integer("require_evidence", { mode: "boolean" }).notNull().default(true),
  approvalActions: text("approval_actions").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({ companyUnique: uniqueIndex("ai_governance_settings_company_unique").on(table.companyId) }));
export const insertAiGovernanceSettingSchema = createInsertSchema(aiGovernanceSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type AiGovernanceSetting = typeof aiGovernanceSettings.$inferSelect;

export const aiDecisionLogs = sqliteTable("ai_decision_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  recommendation: text("recommendation").notNull(),
  reasoning: text("reasoning").notNull(),
  evidence: text("evidence").notNull().default("[]"),
  model: text("model"),
  confidence: real("confidence").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("lav"),
  requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("afventer_godkendelse"),
  proposedAt: text("proposed_at").notNull(),
  decidedBy: integer("decided_by"),
  decidedAt: text("decided_at"),
  decisionNote: text("decision_note"),
});
export const insertAiDecisionLogSchema = createInsertSchema(aiDecisionLogs).omit({ id: true, decidedBy: true, decidedAt: true });
export type AiDecisionLog = typeof aiDecisionLogs.$inferSelect;

export const regulatorySources = sqliteTable("regulatory_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceKey: text("source_key").notNull().unique(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastCheckedAt: text("last_checked_at"),
  lastHttpStatus: integer("last_http_status"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  contentHash: text("content_hash"),
  createdAt: text("created_at").notNull(),
});
export const insertRegulatorySourceSchema = createInsertSchema(regulatorySources).omit({ id: true, createdAt: true });
export type RegulatorySource = typeof regulatorySources.$inferSelect;

export const regulatoryChanges = sqliteTable("regulatory_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull(),
  detectedAt: text("detected_at").notNull(),
  previousHash: text("previous_hash"),
  newHash: text("new_hash").notNull(),
  status: text("status").notNull().default("afventer_faglig_godkendelse"),
  summary: text("summary"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  notes: text("notes"),
});
export const insertRegulatoryChangeSchema = createInsertSchema(regulatoryChanges).omit({ id: true, reviewedBy: true, reviewedAt: true });
export type RegulatoryChange = typeof regulatoryChanges.$inferSelect;

export const systemHealthEvents = sqliteTable("system_health_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  component: text("component").notNull(),
  status: text("status").notNull().default("ok"),
  severity: text("severity").default("info"),
  message: text("message"),
  metrics: text("metrics"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
});
export const insertSystemHealthEventSchema = createInsertSchema(systemHealthEvents).omit({ id: true, createdAt: true });
export type InsertSystemHealthEvent = z.infer<typeof insertSystemHealthEventSchema>;
export type SystemHealthEvent = typeof systemHealthEvents.$inferSelect;

export const deliveryLogs = sqliteTable("delivery_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  channel: text("channel").notNull(), // email, sms, push, webhook
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  message: text("message"),
  status: text("status").notNull().default("afsendt"),
  providerResponse: text("provider_response"),
  sentAt: text("sent_at"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at").notNull(),
});
export const insertDeliveryLogSchema = createInsertSchema(deliveryLogs).omit({ id: true, createdAt: true });
export type InsertDeliveryLog = z.infer<typeof insertDeliveryLogSchema>;
export type DeliveryLog = typeof deliveryLogs.$inferSelect;

// ── Portal & navigation ──
export const customerPortalSettings = sqliteTable("customer_portal_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  allowBooking: integer("allow_booking", { mode: "boolean" }).default(true),
  allowApprovals: integer("allow_approvals", { mode: "boolean" }).default(true),
  allowComplaints: integer("allow_complaints", { mode: "boolean" }).default(true),
  allowReports: integer("allow_reports", { mode: "boolean" }).default(true),
  allowDocuments: integer("allow_documents", { mode: "boolean" }).default(true),
  allowInvoices: integer("allow_invoices", { mode: "boolean" }).default(false),
  portalUrl: text("portal_url"),
  theme: text("theme").default("light"),
  welcomeMessage: text("welcome_message"),
  updatedAt: text("updated_at"),
});
export const insertCustomerPortalSettingSchema = createInsertSchema(customerPortalSettings).omit({ id: true, updatedAt: true });
export type InsertCustomerPortalSetting = z.infer<typeof insertCustomerPortalSettingSchema>;
export type CustomerPortalSetting = typeof customerPortalSettings.$inferSelect;

export const portalDocuments = sqliteTable("portal_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id"),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  visibleToCustomer: integer("visible_to_customer", { mode: "boolean" }).default(true),
  uploadedBy: text("uploaded_by"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});
export const insertPortalDocumentSchema = createInsertSchema(portalDocuments).omit({ id: true, createdAt: true });
export type InsertPortalDocument = z.infer<typeof insertPortalDocumentSchema>;
export type PortalDocument = typeof portalDocuments.$inferSelect;

export const offlineConflicts = sqliteTable("offline_conflicts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id"),
  employeeName: text("employee_name"),
  syncType: text("sync_type").notNull(),
  localData: text("local_data"),
  serverData: text("server_data"),
  conflictType: text("conflict_type").notNull(), // edit_conflict, delete_conflict, duplicate
  status: text("status").notNull().default("afventer"),
  resolvedBy: text("resolved_by"),
  resolution: text("resolution"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
});
export const insertOfflineConflictSchema = createInsertSchema(offlineConflicts).omit({ id: true, createdAt: true });
export type InsertOfflineConflict = z.infer<typeof insertOfflineConflictSchema>;
export type OfflineConflict = typeof offlineConflicts.$inferSelect;

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  companyId: integer("company_id"),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh"),
  auth: text("auth"),
  userAgent: text("user_agent"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const navigationFavorites = sqliteTable("navigation_favorites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  companyId: integer("company_id"),
  path: text("path").notNull(),
  label: text("label").notNull(),
  platform: text("platform").notNull(), // smartdrift_clean, smartregnskab
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull(),
});
export const insertNavigationFavoriteSchema = createInsertSchema(navigationFavorites).omit({ id: true, createdAt: true });
export type InsertNavigationFavorite = z.infer<typeof insertNavigationFavoriteSchema>;
export type NavigationFavorite = typeof navigationFavorites.$inferSelect;

// ── Leverandører (SmartRegnskab) ──
export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  supplierNumber: text("supplier_number"),
  name: text("name").notNull(),
  cvr: text("cvr"),
  ean: text("ean"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  invoiceEmail: text("invoice_email"),
  contactPerson: text("contact_person"),
  paymentTerms: text("payment_terms").default("30"),
  bankAccount: text("bank_account"),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// ── Produkt-/Ydelseskartotek (SmartRegnskab) ──
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  productNumber: text("product_number"),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("ydelse"), // vare, ydelse
  unit: text("unit").notNull().default("stk"), // stk, timer, kg, l, m, pakke
  salesPrice: real("sales_price").notNull().default(0),
  costPrice: real("cost_price").default(0),
  vatRate: real("vat_rate").notNull().default(25),
  accountNumber: text("account_number"),
  inventoryTracked: integer("inventory_tracked", { mode: "boolean" }).default(false),
  stockQuantity: integer("stock_quantity").default(0),
  minStock: integer("min_stock").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ── Faste fakturaer / Abonnementer (SmartRegnskab) ──
export const recurringInvoices = sqliteTable("recurring_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull().default("monthly"), // weekly, monthly, quarterly, yearly
  nextDate: text("next_date").notNull(),
  netAmount: real("net_amount").notNull().default(0),
  vatRate: real("vat_rate").notNull().default(25),
  totalAmount: real("total_amount").notNull().default(0),
  items: text("items"), // JSON array of line items
  paymentTerms: text("payment_terms").default("14"),
  autoSend: integer("auto_send", { mode: "boolean" }).default(false),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastInvoiceId: integer("last_invoice_id"),
  lastRunDate: text("last_run_date"),
  createdAt: text("created_at").notNull(),
});
export const insertRecurringInvoiceSchema = createInsertSchema(recurringInvoices).omit({ id: true, createdAt: true });
export type InsertRecurringInvoice = z.infer<typeof insertRecurringInvoiceSchema>;
export type RecurringInvoice = typeof recurringInvoices.$inferSelect;

// ── Udgiftsregistrering (medarbejder udlæg) ──
export const expenseReports = sqliteTable("expense_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  customerId: integer("customer_id"),
  taskId: integer("task_id"),
  amount: real("amount").notNull(),
  category: text("category").notNull(), // braendstof, materialer, parkering, frokost, transport, andet
  description: text("description"),
  receiptImage: text("receipt_image"), // attachment ID
  date: text("date").notNull(),
  status: text("status").notNull().default("afventer"), // afventer, godkendt, afvist, betalt
  approvedBy: integer("approved_by"),
  approvedAt: text("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: text("created_at").notNull(),
});

// ── Kørselsregistrering ──
export const mileageReports = sqliteTable("mileage_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  customerId: integer("customer_id"),
  taskId: integer("task_id"),
  date: text("date").notNull(),
  startAddress: text("start_address").notNull(),
  endAddress: text("end_address").notNull(),
  kilometers: real("kilometers").notNull(),
  purpose: text("purpose").notNull(), // kunde_besoeg, materiale_indkoeb, andet
  rate: real("rate").notNull().default(3.7), // kr per km
  compensation: real("compensation").notNull().default(0),
  status: text("status").notNull().default("afventer"), // afventer, godkendt, afvist, betalt
  approvedBy: integer("approved_by"),
  approvedAt: text("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: text("created_at").notNull(),
});

// ── Flådestyring ──
export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  plateNumber: text("plate_number").notNull(),
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  color: text("color"),
  fuelType: text("fuel_type").default("benzin"), // benzin, diesel, el, hybrid
  mileage: integer("mileage").default(0),
  insuranceExpiry: text("insurance_expiry"),
  inspectionExpiry: text("inspection_expiry"),
  serviceDue: text("service_due"),
  assignedTo: integer("assigned_to"), // employee ID
  status: text("status").notNull().default("aktiv"), // aktiv, service, ude_af_brug, solgt
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ── Køretøjslog (brugshistorik) ──
export const vehicleLogs = sqliteTable("vehicle_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  vehicleId: integer("vehicle_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  date: text("date").notNull(),
  startMileage: integer("start_mileage"),
  endMileage: integer("end_mileage"),
  distance: integer("distance"),
  purpose: text("purpose"),
  fuelAmount: real("fuel_amount"),
  fuelCost: real("fuel_cost"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ── Kundetilfredshed / feedback ──
export const customerFeedback = sqliteTable("customer_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  taskId: integer("task_id"),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  category: text("category"), // ros, klage, forslag, andet
  status: text("status").notNull().default("ny"), // ny, under_behandling, loest, afvist
  response: text("response"),
  respondedBy: integer("responded_by"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull(),
});

// ── Medarbejderkompetencer / certifikater ──
export const employeeCertifications = sqliteTable("employee_certifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  name: text("name").notNull(), // f.eks. "Kemikaliehåndtering", "Arbejdsmiljøkursus"
  category: text("category"), // sikkerhed, kemi, maskiner, kundespecifik, andet
  issuedDate: text("issued_date"),
  expiryDate: text("expiry_date"),
  issuer: text("issuer"), // kurusprovider
  certificateNumber: text("certificate_number"),
  documentAttachment: text("document_attachment"), // attachment ID
  status: text("status").notNull().default("aktiv"), // aktiv, udloebet, udestaaende
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ── Tjeklister pr. lokation ──
export const locationChecklists = sqliteTable("location_checklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull(), // f.eks. "Toiletter", "Køkken", "Mødelokale"
  area: text("area"), // rum/zone beskrivelse
  items: text("items").notNull().default("[]"), // JSON array of {label, required, frequency}
  frequency: text("frequency").default("hver_gang"), // hver_gang, daglig, ugentlig, maanedlig
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});

// ── Tjekliste udførelse (log) ──
export const checklistExecutions = sqliteTable("checklist_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  checklistId: integer("checklist_id").notNull(),
  taskId: integer("task_id"),
  employeeId: integer("employee_id").notNull(),
  executedAt: text("executed_at").notNull(),
  results: text("results").notNull().default("[]"), // JSON array of {item, checked, note}
  completedCount: integer("completed_count").default(0),
  totalCount: integer("total_count").default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ── Drift → Regnskab eksport ──
export const accountingExports = sqliteTable("accounting_exports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  sourceType: text("source_type").notNull(), // expense, mileage, timesheet
  sourceId: integer("source_id").notNull(),
  exportDate: text("export_date").notNull(),
  status: text("status").notNull().default("eksporteret"), // eksporteret, fejlet, bogfoert
  voucherNumber: text("voucher_number"),
  accountNumber: text("account_number"),
  amount: real("amount").notNull(),
  description: text("description"),
  exportedBy: integer("exported_by"),
  createdAt: text("created_at").notNull(),
});

// ── QR Check-in ──
export const qrCheckins = sqliteTable("qr_checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  customerLocationId: integer("customer_location_id"),
  taskId: integer("task_id"),
  checklistId: integer("checklist_id"),
  employeeId: integer("employee_id").notNull(),
  checkInTime: text("check_in_time").notNull(),
  checkOutTime: text("check_out_time"),
  beforePhotos: text("before_photos").default("[]"),
  afterPhotos: text("after_photos").default("[]"),
  notes: text("notes"),
  status: text("status").notNull().default("aktiv"), // aktiv, afsluttet, afbrudt
  createdAt: text("created_at").notNull(),
});

// ── Afvigelser / Reklamationer / CAPA ──
export const deviations = sqliteTable("deviations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  sourceType: text("source_type").notNull(), // feedback, quality, task, manual
  sourceId: integer("source_id"),
  customerId: integer("customer_id"),
  taskId: integer("task_id"),
  title: text("title").notNull(),
  description: text("description"),
  cause: text("cause"),
  category: text("category").notNull(), // kvalitet, service, sikkerhed, materialer, andet
  severity: text("severity").notNull().default("mellem"), // lav, mellem, hoej, kritisk
  responsibleEmployeeId: integer("responsible_employee_id"),
  deadline: text("deadline"),
  status: text("status").notNull().default("ny"), // ny, under_behandling, igang, afsluttet, afvist
  correctiveAction: text("corrective_action"),
  followUpDate: text("follow_up_date"),
  customerNotified: integer("customer_notified", { mode: "boolean" }).default(false),
  resolution: text("resolution"),
  createdAt: text("created_at").notNull(),
});

// ── Kemikalieregister ──
export const chemicals = sqliteTable("chemicals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  category: text("category"), // rengoering, desinfektion, afkaalkning, gulv, special, andet
  hazardClass: text("hazard_class"), // ingen, irritant, aertring, brandfarlig, giftig, aetzende
  safetyDataSheet: text("safety_data_sheet"), // attachment ID
  ppeRequired: text("ppe_required"), // handsker, beskyttelsesbriller, maske, forklade, stovler
  instructions: text("instructions"),
  supplier: text("supplier"),
  purchaseDate: text("purchase_date"),
  reviewDate: text("review_date"),
  expiryDate: text("expiry_date"),
  locationId: integer("location_id"),
  stockQuantity: real("stock_quantity").default(0),
  unit: text("unit").default("liter"),
  minStock: real("min_stock").default(0),
  status: text("status").notNull().default("aktiv"), // aktiv, udlobet, udestaaende, afskaffet
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ── Kontrakt- og prisregulering ──
export const contractAdjustments = sqliteTable("contract_adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  contractId: integer("contract_id"),
  type: text("type").notNull(), // indeksregulering, prisstigning, kontraktfornyelse, opsigelse
  description: text("description"),
  oldPrice: real("old_price"),
  newPrice: real("new_price"),
  adjustmentPercentage: real("adjustment_percentage"),
  adjustmentDate: text("adjustment_date"),
  effectiveDate: text("effective_date"),
  notificationSent: integer("notification_sent", { mode: "boolean" }).default(false),
  notificationDate: text("notification_date"),
  customerApproved: integer("customer_approved", { mode: "boolean" }).default(false),
  approvedDate: text("approved_date"),
  status: text("status").notNull().default("udkast"), // udkast, sendt, godkendt, afvist, gennemfoert, annulleret
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ── Vikar-/bemandingsforslag ──
export const substitutionSuggestions = sqliteTable("substitution_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  absenceId: integer("absence_id"),
  originalEmployeeId: integer("original_employee_id").notNull(),
  suggestedEmployeeId: integer("suggested_employee_id").notNull(),
  shiftId: integer("shift_id"),
  taskId: integer("task_id"),
  reason: text("reason"), // kompetence_match, lokation_naerhed, ledig, rolle_match
  score: real("score").default(0),
  status: text("status").notNull().default("foreslaaet"), // foreslaaet, accepteret, afvist, udløbet
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull(),
});

// ── SLA-overvågning ──
export const slaAlerts = sqliteTable("sla_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  alertType: text("alert_type").notNull(), // task_not_started, missing_checkin, incomplete_checklist, sla_risk
  taskId: integer("task_id"),
  customerId: integer("customer_id"),
  employeeId: integer("employee_id"),
  severity: text("severity").notNull().default("mellem"), // lav, mellem, hoej, kritisk
  message: text("message").notNull(),
  status: text("status").notNull().default("aktiv"), // aktiv, loest, ignoreret
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
});

// ── Kunderapporter ──
export const customerReports = sqliteTable("customer_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  totalHours: real("total_hours").default(0),
  deviationsCount: integer("deviations_count").default(0),
  feedbackAvg: real("feedback_avg"),
  checklistCompletionRate: real("checklist_completion_rate"),
  photosCount: integer("photos_count").default(0),
  reportData: text("report_data").default("{}"), // JSON summary
  generatedAt: text("generated_at").notNull(),
  status: text("status").notNull().default("genereret"), // genereret, sendt, arkiveret
  createdAt: text("created_at").notNull(),
});

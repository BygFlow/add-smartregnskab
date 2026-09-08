/**
 * PostgreSQL-parallel til schema.ts. Tabellenavne og kolonnenavne er bevaret
 * nøjagtigt, så eksisterende SQLite-data kan flyttes uden navneoversættelse.
 *
 * VIGTIGT: Applikationskoden skriver i dag flere logiske felter som 1/0.
 * PostgreSQL-skemaet bruger rigtige boolean-felter, så server/storage.ts og
 * øvrige skrivesteder skal caste 1/0 til true/false under en migrering.
 *
 * Kolonner der skifter fra SQLite integer (0/1) til PostgreSQL boolean:
 * - users.active, users.email_verified, users.two_factor_enabled
 * - time_entries.approved, notifications.read, integrations.auto_sync
 * - absences.paid, shifts.published, plans.active, subscriptions.auto_renew
 * - payment_methods.is_default, webhook_events.signature_valid,
 *   webhook_events.processed, login_attempts.success, consents.granted
 * - contracts.index_adjustment, materials.hazardous, materials.active
 * - material_usage.billable, inspections.follow_up_done,
 *   inspections.customer_visible
 */

import { boolean, doublePrecision, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

// ── Companies (virksomheder — multi-tenant, hver er en betalende kunde) ──
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  cvr: text("cvr"),
  phone: text("phone"),
  email: text("email"),
  // Platformstyring
  status: text("status").notNull().default("proeve"), // proeve, aktiv, i_restance, spaerret, opsagt
  kind: text("kind").notNull().default("kunde"), // kunde, platform
  createdAt: text("created_at").notNull().default("2026-01-01"),
  notes: text("notes"), // interne noter for ADD SmartRegnskab-teamet
  // Moms og fakturering
  vatRate: doublePrecision("vat_rate").notNull().default(25), // procent — 0 ved momsfritagelse
  vatMode: text("vat_mode").notNull().default("dansk"), // dansk, eu_omvendt, eksport_fritaget, momsfri
  currency: text("currency").notNull().default("DKK"),
  // GDPR-opbevaringspolitik (måneder — 0 = gem uendeligt)
  retentionTimeEntries: integer("retention_time_entries").notNull().default(60),
  retentionGps: integer("retention_gps").notNull().default(6),
  retentionAbsences: integer("retention_absences").notNull().default(60),
  retentionPhotos: integer("retention_photos").notNull().default(24),
  dpaAcceptedAt: text("dpa_accepted_at"), // databehandleraftale godkendt
  dpaAcceptedBy: text("dpa_accepted_by"),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ── Users (brugere — auth & roller) ──
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("assistent"), // platform_admin, leder, holdleder, assistent, kunde
  employeeId: integer("employee_id"),
  customerId: integer("customer_id"),
  active: boolean("active").notNull().default(true),
  // Tilmelding og sikkerhed
  emailVerified: boolean("email_verified").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"), // base32 TOTP-hemmelighed
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorBackup: text("two_factor_backup"), // JSON: hashede engangskoder
  lockedUntil: text("locked_until"), // sat efter for mange fejlforsøg
  lastLoginAt: text("last_login_at"),
  passwordChangedAt: text("password_changed_at"),
});

// ── Sessions (login-tokens — erstatter tillid til klientens companyId) ──
export const sessions = pgTable("sessions", {
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
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull().default("Rengøringsassistent"),
  status: text("status").notNull().default("ledig"), // ledig, optaget, orlov
  weeklyHours: integer("weekly_hours").notNull().default(37),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// ── Customers (kunder) ──
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  contact: text("contact"),
  email: text("email"),
  hourlyRate: doublePrecision("hourly_rate").notNull().default(350), // DKK pr. time
  // Geofence — tjekker at medarbejderen faktisk var på adressen
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  geofenceRadius: integer("geofence_radius").notNull().default(150), // meter
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ── Tasks (opgaver) ──
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
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
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  taskId: integer("task_id"),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time"), // HH:MM (null = active timer)
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  // GPS & lokation
  checkInLat: doublePrecision("check_in_lat"),
  checkInLng: doublePrecision("check_in_lng"),
  checkOutLat: doublePrecision("check_out_lat"),
  checkOutLng: doublePrecision("check_out_lng"),
  // Geofence-validering (udregnet på serveren)
  checkInDistance: integer("check_in_distance"), // meter fra kundeadresse
  checkOutDistance: integer("check_out_distance"),
  geofenceStatus: text("geofence_status").notNull().default("ukendt"), // ukendt, indenfor, udenfor, ingen_gps
  approved: boolean("approved").notNull().default(false), // godkendt til lønsynk
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// ── Notifications (notifikationer) ──
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").notNull().default("info"), // info, warning, success
  read: boolean("read").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ── Invoices (fakturaer) ──
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("kladde"), // kladde, sendt, betalt, forfalden, krediteret
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  netAmount: doublePrecision("net_amount").notNull().default(0),
  vatRate: doublePrecision("vat_rate").notNull().default(25),
  vatAmount: doublePrecision("vat_amount").notNull().default(0),
  totalAmount: doublePrecision("total_amount").notNull().default(0), // inkl. moms
  paymentTerms: integer("payment_terms").notNull().default(14), // dage
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  reminderCount: integer("reminder_count").notNull().default(0),
  lastReminderAt: text("last_reminder_at"),
  notes: text("notes"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ── Invoice Items (fakturalinjer) ──
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull(), // timer
  unitPrice: doublePrecision("unit_price").notNull(), // DKK pr. time
  amount: doublePrecision("amount").notNull(), // ekskl. moms
  vatRate: doublePrecision("vat_rate").notNull().default(25),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// ── Integrations (løn- og regnskabsintegrationer) ──
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  category: text("category").notNull(), // loen, regnskab, bank, ovrigt
  provider: text("provider").notNull(), // f.eks. "Danløn", "Zenegy", "e-conomic"
  status: text("status").notNull().default("ikke_opsat"), // ikke_opsat, demo_forbundet, forbundet, fejl
  syncMode: text("sync_mode").notNull().default("eksport"), // eksport, api
  apiKey: text("api_key"), // e-conomic: AppSecretToken | Danløn: API-nøgle
  apiSecret: text("api_secret"), // e-conomic: AgreementGrantToken | andre: klienthemmelighed
  baseUrl: text("base_url"), // overstyrer udbyderens standard-endpoint
  exportFormat: text("export_format"), // valgt eksportformat, f.eks. danloen_csv
  autoSync: boolean("auto_sync").notNull().default(false), // 0/1 — automatisk synk ved godkendelse
  settingsJson: text("settings_json"), // JSON: firmakonto/kundenr. hos udbyder mv.
  lastSyncAt: text("last_sync_at"),
  lastError: text("last_error"),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({ id: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// Synkroniseringslog — revisionsspor for alle kald til eksterne systemer
export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
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
export const absences = pgTable("absences", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  type: text("type").notNull(), // ferie, sygdom, barn_syg, barsel, omsorgsdag, andet
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  hoursPerDay: doublePrecision("hours_per_day").notNull().default(7.4),
  status: text("status").notNull().default("afventer"), // afventer, godkendt, afvist
  paid: boolean("paid").notNull().default(true), // med eller uden løn
  note: text("note"),
  approvedBy: integer("approved_by"), // bruger-id på den, der godkendte
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
});

export const insertAbsenceSchema = createInsertSchema(absences).omit({ id: true });
export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;
export type Absence = typeof absences.$inferSelect;

// ── Shifts (vagtplan) ──
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  customerId: integer("customer_id"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("planlagt"), // planlagt, bekraeftet, afbud
  note: text("note"),
  published: boolean("published").notNull().default(false), // 1 = udsendt til medarbejderen
});

export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// ── Attachments (fotodokumentation: før/efter, kvalitetskontrol) ──
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
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
export const messageOutbox = pgTable("message_outbox", {
  id: serial("id").primaryKey(),
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
//  PLATFORMLAG — ADD SmartRegnskab som SaaS-forretning
// ═══════════════════════════════════════════════════════════

// ── Plans (abonnementspakker) ──
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  monthlyPrice: doublePrecision("monthly_price").notNull(), // DKK ekskl. moms pr. måned
  pricePerEmployee: doublePrecision("price_per_employee").notNull().default(0), // DKK pr. ansat pr. måned
  maxEmployees: integer("max_employees").notNull().default(10), // -1 = ubegrænset
  maxCustomers: integer("max_customers").notNull().default(25),
  features: text("features").notNull().default("[]"), // JSON: ["api_integration", "vagtplan", ...]
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const insertPlanSchema = createInsertSchema(plans).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

// ── Subscriptions (virksomhedens abonnement) ──
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  planId: integer("plan_id").notNull(),
  status: text("status").notNull().default("proeve"), // proeve, aktiv, i_restance, opsagt
  billingCycle: text("billing_cycle").notNull().default("maanedlig"), // maanedlig, aarlig
  trialEndsAt: text("trial_ends_at"),
  currentPeriodStart: text("current_period_start").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  cancelledAt: text("cancelled_at"),
  startedAt: text("started_at").notNull(),
  autoRenew: boolean("auto_renew").notNull().default(true),
  paymentMethodId: integer("payment_method_id"),
  dunningStage: integer("dunning_stage").notNull().default(0), // 0-3: rykkertrin ved fejlet betaling
  lastPaymentAttempt: text("last_payment_attempt"),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// ── Platform Invoices (ADD SmartRegnskab fakturerer virksomheden) ──
export const platformInvoices = pgTable("platform_invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  planName: text("plan_name").notNull(),
  employeeCount: integer("employee_count").notNull().default(0),
  netAmount: doublePrecision("net_amount").notNull(),
  vatAmount: doublePrecision("vat_amount").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: text("status").notNull().default("udstedt"), // udstedt, betalt, forfalden
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
});

export const insertPlatformInvoiceSchema = createInsertSchema(platformInvoices).omit({ id: true });
export type InsertPlatformInvoice = z.infer<typeof insertPlatformInvoiceSchema>;
export type PlatformInvoice = typeof platformInvoices.$inferSelect;

// ── Audit Log (platformhandlinger — hvem gjorde hvad) ──
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
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
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  provider: text("provider").notNull(), // stripe, mobilepay, betalingsservice
  providerRef: text("provider_ref").notNull(), // fx Stripe payment_method-id
  brand: text("brand"), // visa, mastercard, mobilepay
  last4: text("last4"),
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  isDefault: boolean("is_default").notNull().default(false),
  status: text("status").notNull().default("aktiv"), // aktiv, udloebet, fejlet, fjernet
  createdAt: text("created_at").notNull(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// ── Payments (betalingsforsøg mod en abonnementsfaktura) ──
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  platformInvoiceId: integer("platform_invoice_id"),
  paymentMethodId: integer("payment_method_id"),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"), // fx Stripe payment_intent-id
  amount: doublePrecision("amount").notNull(),
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
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(), // JSON
  signatureValid: boolean("signature_valid").notNull().default(false),
  processed: boolean("processed").notNull().default(false),
  error: text("error"),
  receivedAt: text("received_at").notNull(),
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true });
export type WebhookEvent = typeof webhookEvents.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  TILMELDING, LOGIN-SIKKERHED OG TO-FAKTOR
// ═══════════════════════════════════════════════════════════

// ── Auth Tokens (e-mailbekræftelse, glemt kodeord, brugerinvitation) ──
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
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
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  ip: text("ip"),
  success: boolean("success").notNull().default(false),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;

// ═══════════════════════════════════════════════════════════
//  GDPR — opbevaring, samtykke, dataudlevering
// ═══════════════════════════════════════════════════════════

// ── Data Requests (indsigt, sletning og dataportabilitet) ──
export const dataRequests = pgTable("data_requests", {
  id: serial("id").primaryKey(),
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
export const consents = pgTable("consents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  kind: text("kind").notNull(), // gps, foto, databehandling
  granted: boolean("granted").notNull().default(false),
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
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  quoteNumber: text("quote_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  netAmount: doublePrecision("net_amount").notNull().default(0),
  vatAmount: doublePrecision("vat_amount").notNull().default(0),
  totalAmount: doublePrecision("total_amount").notNull().default(0),
  status: text("status").notNull().default("kladde"), // kladde, sendt, accepteret, afvist, udloebet
  validUntil: text("valid_until"),
  issueDate: text("issue_date").notNull(),
  respondedAt: text("responded_at"),
  contractId: integer("contract_id"), // sat når tilbuddet er blevet en aftale
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// ── Quote Items (tilbudslinjer) ──
export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull(),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unit: text("unit").notNull().default("timer"), // timer, stk, md, m2
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  amount: doublePrecision("amount").notNull().default(0),
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ id: true });
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;

// ── Contracts (kontrakter/aftaler med fast pris pr. kunde) ──
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  contractNumber: text("contract_number").notNull(),
  title: text("title").notNull(),
  pricingModel: text("pricing_model").notNull().default("timepris"), // timepris, fast_maaned, pr_besoeg, pr_m2
  agreedRate: doublePrecision("agreed_rate").notNull().default(0), // aftalt pris i den valgte model
  hoursIncluded: doublePrecision("hours_included").default(0), // timer inkluderet pr. måned ved fast pris
  overtimeRate: doublePrecision("overtime_rate").default(0), // pris for timer ud over det inkluderede
  frequency: text("frequency").notNull().default("ugentlig"), // daglig, ugentlig, hver_14_dag, maanedlig
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  noticeMonths: integer("notice_months").notNull().default(1),
  indexAdjustment: boolean("index_adjustment").notNull().default(false), // 1 = årlig prisregulering
  status: text("status").notNull().default("aktiv"), // udkast, aktiv, opsagt, udloebet
  terms: text("terms"),
});

export const insertContractSchema = createInsertSchema(contracts).omit({ id: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

// ── Materials (materiale- og forbrugsvarekartotek) ──
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  unit: text("unit").notNull().default("stk"), // stk, liter, kg, rulle
  costPrice: doublePrecision("cost_price").notNull().default(0),
  salesPrice: doublePrecision("sales_price").notNull().default(0),
  stock: doublePrecision("stock").notNull().default(0),
  minStock: doublePrecision("min_stock").notNull().default(0),
  supplier: text("supplier"),
  hazardous: boolean("hazardous").notNull().default(false), // 1 = kræver sikkerhedsdatablad
  safetySheetUrl: text("safety_sheet_url"),
  active: boolean("active").notNull().default(true),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// ── Material Usage (forbrug bogført på opgave/kunde) ──
export const materialUsage = pgTable("material_usage", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  materialId: integer("material_id").notNull(),
  taskId: integer("task_id"),
  customerId: integer("customer_id"),
  employeeId: integer("employee_id"),
  quantity: doublePrecision("quantity").notNull(),
  kind: text("kind").notNull().default("forbrug"), // forbrug, indkoeb, korrektion
  billable: boolean("billable").notNull().default(true),
  invoicedAt: text("invoiced_at"),
  date: text("date").notNull(),
  note: text("note"),
});

export const insertMaterialUsageSchema = createInsertSchema(materialUsage).omit({ id: true });
export type InsertMaterialUsage = z.infer<typeof insertMaterialUsageSchema>;
export type MaterialUsage = typeof materialUsage.$inferSelect;

// ── Keys (nøgler og alarmkoder pr. adresse — koder krypteret) ──
export const keys = pgTable("keys", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  label: text("label").notNull(), // fx "Hovedindgang" eller "Nøglebrik 4"
  keyType: text("keyType").notNull().default("noegle"), // noegle, brik, kode, alarmkode
  identifier: text("identifier"), // nøglemærke/serienummer
  secretEnc: text("secret_enc"), // krypteret alarmkode (AES-256-GCM)
  accessNote: text("access_note"), // fx "Alarm slås af inden for 30 sek."
  holderEmployeeId: integer("holder_employee_id"), // hvem har den nu
  status: text("status").notNull().default("paa_lager"), // paa_lager, udlaant, bortkommet, returneret
  deposit: doublePrecision("deposit").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertKeySchema = createInsertSchema(keys).omit({ id: true });
export type InsertKey = z.infer<typeof insertKeySchema>;
export type KeyItem = typeof keys.$inferSelect;

// ── Key Handovers (kvitteret nøgleoverdragelse — ansvarskæden) ──
export const keyHandovers = pgTable("key_handovers", {
  id: serial("id").primaryKey(),
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
export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id").notNull(),
  taskId: integer("task_id"),
  employeeId: integer("employee_id"), // den ansatte der blev kontrolleret
  inspectorId: integer("inspector_id"), // hvem kontrollerede
  date: text("date").notNull(),
  scores: text("scores").notNull().default("[]"), // JSON: [{area, weight, score}]
  totalScore: doublePrecision("total_score").notNull().default(0), // 0-100
  result: text("result").notNull().default("godkendt"), // godkendt, anmaerkning, ikke_godkendt
  followUpDate: text("follow_up_date"),
  followUpDone: boolean("follow_up_done").notNull().default(false),
  customerVisible: boolean("customer_visible").notNull().default(true),
  note: text("note"),
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({ id: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

// ── Job Runs (automatiske job — gentagne opgaver, rykkere, fornyelse, oprydning) ──
export const jobRuns = pgTable("job_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(), // gentagne_opgaver, faktura_rykkere, abonnement_fornyelse, gdpr_oprydning, beskedkoe
  status: text("status").notNull().default("koert"), // koert, fejlet
  affected: integer("affected").notNull().default(0),
  detail: text("detail"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});


export const taskNotes = pgTable("task_notes", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskNoteSchema = createInsertSchema(taskNotes).omit({ id: true, createdAt: true });
export type InsertTaskNote = z.infer<typeof insertTaskNoteSchema>;
export type TaskNote = typeof taskNotes.$inferSelect;

export type JobRun = typeof jobRuns.$inferSelect;

import {
  companies, users, employees, customers, tasks, timeEntries,
  notifications, invoices, invoiceItems, integrations, syncLogs,
  sessions, absences, shifts, attachments, messageOutbox,
  plans, subscriptions, platformInvoices, auditLogs,
  paymentMethods, payments, webhookEvents, authTokens, loginAttempts,
  dataRequests, consents, quotes, quoteItems, contracts,
  materials, materialUsage, keys, keyHandovers, inspections, jobRuns, taskNotes,
} from '@shared/schema';
import type {
  Company, InsertCompany,
  User, InsertUser,
  Employee, InsertEmployee,
  Customer, InsertCustomer,
  Task, InsertTask,
  TimeEntry, InsertTimeEntry,
  Notification, InsertNotification,
  Invoice, InsertInvoice,
  InvoiceItem, InsertInvoiceItem,
  Integration, InsertIntegration,
  SyncLog, InsertSyncLog,
  Session,
  Absence, InsertAbsence,
  Shift, InsertShift,
  Attachment, InsertAttachment,
  OutboxMessage, InsertMessage,
  Plan, InsertPlan,
  Subscription, InsertSubscription,
  PlatformInvoice, InsertPlatformInvoice,
  AuditLog, InsertAuditLog,
  PaymentMethod, InsertPaymentMethod,
  Payment, InsertPayment,
  WebhookEvent, AuthToken, LoginAttempt, JobRun,
  DataRequest, InsertDataRequest,
  Consent, InsertConsent,
  Quote, InsertQuote, QuoteItem, InsertQuoteItem,
  Contract, InsertContract,
  Material, InsertMaterial,
  MaterialUsage, InsertMaterialUsage,
  KeyItem, InsertKey, KeyHandover, InsertKeyHandover,
  Inspection, InsertInspection,
  TaskNote, InsertTaskNote,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, lte, gte, isNull, lt, sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { dirname, resolve, sep } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schemaModule from "@shared/schema";

// ── Persistent database path ──
// I produktion (Render/VPS) sættes DATABASE_PATH til en persistent disk.
// Lokalt fallback til data.db i projektroden.
const DB_PATH = process.env.DATABASE_PATH || "data.db";
const dbDir = dirname(DB_PATH);
if (dbDir && dbDir !== ".") {
  try { mkdirSync(dbDir, { recursive: true }); } catch {}
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
export const db = drizzle(sqlite);

/** Creates the schema on a brand-new database. Existing installations are
 * migrated by the versioned deployment migration command. */
export function ensureDatabaseSchema(): void {
  const hasCompanies = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'companies' LIMIT 1",
  ).get();
  const hasMigrationJournal = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations' LIMIT 1",
  ).get();
  // Legacy databases from 1.0.0 predate versioned migrations and must be
  // upgraded with the documented backup-first upgrade command.
  if (hasCompanies && !hasMigrationJournal) return;
  const migrationsFolder = process.env.MIGRATIONS_DIR || resolve(process.cwd(), "migrations");
  migrate(db, { migrationsFolder });
}

export function checkDatabaseIntegrity(): string {
  return String(sqlite.pragma("quick_check", { simple: true }));
}

/** Atomically reserves the next invoice/offer number for a company. */
export function allocateDocumentNumber(companyId: number, kind: "invoice" | "offer"): { prefix: string; number: number } {
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("Ugyldigt virksomheds-id.");
  const nextColumn = kind === "invoice" ? "invoice_next_number" : "offer_next_number";
  const prefixColumn = kind === "invoice" ? "invoice_prefix" : "offer_prefix";
  return sqlite.transaction(() => {
    const row = sqlite.prepare(`SELECT ${nextColumn} AS number, ${prefixColumn} AS prefix FROM companies WHERE id = ?`).get(companyId) as { number: number; prefix: string } | undefined;
    if (!row) throw new Error("Virksomheden blev ikke fundet.");
    sqlite.prepare(`UPDATE companies SET ${nextColumn} = ${nextColumn} + 1 WHERE id = ?`).run(companyId);
    return { prefix: row.prefix, number: row.number };
  })();
}

const BACKUP_ROOT = resolve(process.env.BACKUP_DIR || "backups");

/** Creates an encrypted, tenant-scoped export. Tables without company_id are
 * intentionally excluded so another tenant's data or session tokens cannot leak. */
export async function createEncryptedBackup(companyId: number | null): Promise<{ path: string; checksum: string; sizeBytes: number; tables: number; rows: number }> {
  if (companyId !== null && (!Number.isInteger(companyId) || companyId <= 0)) throw new Error("Ugyldigt virksomheds-id.");
  const names = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map((row) => row.name)
    .filter((name) => /^[a-z0-9_]+$/i.test(name));
  const payload: Record<string, unknown[]> = {};
  let rows = 0;
  for (const name of names) {
    const columns = sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
    const hasCompany = columns.some((column) => column.name === "company_id");
    if (companyId !== null && !hasCompany) continue;
    const tableRows = (companyId === null
      ? sqlite.prepare(`SELECT * FROM "${name}"`).all()
      : sqlite.prepare(`SELECT * FROM "${name}" WHERE company_id = ?`).all(companyId)) as unknown[];
    payload[name] = tableRows;
    rows += tableRows.length;
  }
  const plaintext = Buffer.from(JSON.stringify({ format: 1, companyId, createdAt: new Date().toISOString(), tables: payload }));
  const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("BACKUP_ENCRYPTION_KEY eller ENCRYPTION_KEY på mindst 32 tegn er påkrævet.");
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const artifact = Buffer.concat([Buffer.from("ASRB1"), iv, cipher.getAuthTag(), ciphertext]);
  mkdirSync(BACKUP_ROOT, { recursive: true });
  const filePath = resolve(BACKUP_ROOT, `${companyId === null ? "platform" : `company-${companyId}`}-${Date.now()}.asrb`);
  await writeFile(filePath, artifact, { flag: "wx" });
  const info = await stat(filePath);
  return { path: filePath, checksum: createHash("sha256").update(artifact).digest("hex"), sizeBytes: info.size, tables: Object.keys(payload).length, rows };
}

export const createTenantBackup = (companyId: number) => createEncryptedBackup(companyId);

export function createInvoiceWithItems(data: InsertInvoice, items: InsertInvoiceItem[]): { invoice: Invoice; items: InvoiceItem[] } {
  return sqlite.transaction(() => {
    const invoice = db.insert(invoices).values(data).returning().get();
    const createdItems = items.map((item) => db.insert(invoiceItems).values({ ...item, invoiceId: invoice.id }).returning().get());
    return { invoice, items: createdItems };
  })();
}

export function createJournalWithLines(entry: Record<string, unknown>, lines: Record<string, unknown>[]): any {
  return sqlite.transaction(() => {
    const journal = db.insert(schemaModule.journalEntries).values(entry as any).returning().get();
    for (const line of lines) db.insert(schemaModule.journalLines).values({ ...line, journalEntryId: journal.id } as any).run();
    return journal;
  })();
}

export async function readVerifiedBackup(filePath: string, expectedChecksum: string): Promise<Buffer> {
  const resolved = resolve(filePath);
  if (!resolved.startsWith(`${BACKUP_ROOT}${sep}`)) throw new Error("Ugyldig backupsti.");
  const data = await readFile(resolved);
  const actual = createHash("sha256").update(data).digest("hex");
  if (actual !== expectedChecksum) throw new Error("Backupens kontrolsum stemmer ikke.");
  return data;
}

// Helper: filter by company
function byCompany(table: any, companyId: number) {
  return eq(table.companyId, companyId);
}

/**
 * Id-opslag der samtidig kræver at rækken tilhører firmaet. Uden dette kunne
 * en bruger fra firma 1 hente /api/employees/7 fra firma 2.
 */
function byIdInCompany(table: any, id: number, companyId?: number) {
  return companyId === undefined
    ? eq(table.id, id)
    : and(eq(table.id, id), eq(table.companyId, companyId));
}

export interface IStorage {
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;

  updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined>;

  // Sessions
  createSession(data: { token: string; userId: number; createdAt: string; expiresAt: string }): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<boolean>;
  deleteUserSessions(userId: number): Promise<boolean>;

  // Users
  getUsers(companyId: number): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;

  // Employees
  getEmployees(companyId: number): Promise<Employee[]>;
  getEmployee(id: number, companyId?: number): Promise<Employee | undefined>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;

  // Customers
  getCustomers(companyId: number): Promise<Customer[]>;
  getCustomer(id: number, companyId?: number): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  // Tasks
  getTasks(companyId: number): Promise<Task[]>;
  getTasksByCustomer(customerId: number): Promise<Task[]>;
  getTask(id: number, companyId?: number): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  getTaskNotes(taskId: number): Promise<TaskNote[]>;
  createTaskNote(data: InsertTaskNote): Promise<TaskNote>;

  // Time Entries
  getTimeEntries(companyId: number): Promise<TimeEntry[]>;
  getTimeEntriesByCustomer(customerId: number): Promise<TimeEntry[]>;
  getTimeEntry(id: number, companyId?: number): Promise<TimeEntry | undefined>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;

  // Notifications
  getNotifications(companyId: number): Promise<Notification[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<boolean>;
  markAllNotificationsRead(companyId: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;

  // Invoices
  getInvoices(companyId: number): Promise<Invoice[]>;
  getInvoicesByCustomer(customerId: number): Promise<Invoice[]>;
  getInvoice(id: number, companyId?: number): Promise<Invoice | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;

  // Invoice Items
  getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]>;
  createInvoiceItem(data: InsertInvoiceItem): Promise<InvoiceItem>;
  deleteInvoiceItems(invoiceId: number): Promise<boolean>;

  // Integrations
  getIntegrations(companyId: number): Promise<Integration[]>;
  getIntegration(id: number, companyId?: number): Promise<Integration | undefined>;
  createIntegration(data: InsertIntegration): Promise<Integration>;
  updateIntegration(id: number, data: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(id: number): Promise<boolean>;

  // Sync logs
  getSyncLogs(companyId: number, limit?: number): Promise<SyncLog[]>;
  createSyncLog(data: InsertSyncLog): Promise<SyncLog>;

  // Absences
  getAbsences(companyId: number): Promise<Absence[]>;
  getAbsence(id: number, companyId?: number): Promise<Absence | undefined>;
  createAbsence(data: InsertAbsence): Promise<Absence>;
  updateAbsence(id: number, data: Partial<InsertAbsence>): Promise<Absence | undefined>;
  deleteAbsence(id: number): Promise<boolean>;

  // Shifts
  getShifts(companyId: number): Promise<Shift[]>;
  getShift(id: number, companyId?: number): Promise<Shift | undefined>;
  createShift(data: InsertShift): Promise<Shift>;
  updateShift(id: number, data: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;

  // Attachments
  getAttachments(companyId: number, taskId?: number): Promise<Attachment[]>;
  getAttachment(id: number, companyId?: number): Promise<Attachment | undefined>;
  createAttachment(data: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<boolean>;

  // Message outbox
  getMessages(companyId: number, limit?: number): Promise<OutboxMessage[]>;
  createMessage(data: InsertMessage): Promise<OutboxMessage>;
  updateMessage(id: number, data: Partial<InsertMessage>): Promise<OutboxMessage | undefined>;

  // Plans
  getPlans(): Promise<Plan[]>;
  getPlan(id: number): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  createPlan(data: InsertPlan): Promise<Plan>;
  updatePlan(id: number, data: Partial<InsertPlan>): Promise<Plan | undefined>;

  // Subscriptions
  getSubscriptions(): Promise<Subscription[]>;
  getSubscriptionByCompany(companyId: number): Promise<Subscription | undefined>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  getCompanyPlan(companyId: number): Promise<Plan | undefined>;

  // Platform invoices
  getPlatformInvoices(companyId?: number): Promise<PlatformInvoice[]>;
  createPlatformInvoice(data: InsertPlatformInvoice): Promise<PlatformInvoice>;
  updatePlatformInvoice(id: number, data: Partial<InsertPlatformInvoice>): Promise<PlatformInvoice | undefined>;

  // Audit
  getAuditLogs(companyId?: number, limit?: number): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  // ── Companies ──
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).all();
  }
  async getCompany(id: number): Promise<Company | undefined> {
    return db.select().from(companies).where(eq(companies.id, id)).get();
  }
  async createCompany(data: InsertCompany): Promise<Company> {
    return db.insert(companies).values(data).returning().get();
  }
  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined> {
    return db.update(companies).set(data).where(eq(companies.id, id)).returning().get();
  }

  // ── Sessions ──
  async createSession(data: { token: string; userId: number; createdAt: string; expiresAt: string }): Promise<Session> {
    return db.insert(sessions).values(data).returning().get();
  }
  async getSession(token: string): Promise<Session | undefined> {
    return db.select().from(sessions).where(eq(sessions.token, token)).get();
  }
  async deleteSession(token: string): Promise<boolean> {
    return db.delete(sessions).where(eq(sessions.token, token)).run().changes > 0;
  }
  async deleteUserSessions(userId: number): Promise<boolean> {
    return db.delete(sessions).where(eq(sessions.userId, userId)).run().changes > 0;
  }

  // ── Users ──
  async getUsers(companyId: number): Promise<User[]> {
    return db.select().from(users).where(byCompany(users, companyId)).all();
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async createUser(data: InsertUser): Promise<User> {
    return db.insert(users).values(data).returning().get();
  }
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  // ── Employees ──
  async getEmployees(companyId: number): Promise<Employee[]> {
    return db.select().from(employees).where(byCompany(employees, companyId)).all();
  }
  async getEmployee(id: number, companyId?: number): Promise<Employee | undefined> {
    return db.select().from(employees).where(byIdInCompany(employees, id, companyId)).get();
  }
  async createEmployee(data: InsertEmployee): Promise<Employee> {
    return db.insert(employees).values(data).returning().get();
  }
  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    return db.update(employees).set(data).where(eq(employees.id, id)).returning().get();
  }
  async deleteEmployee(id: number): Promise<boolean> {
    return db.delete(employees).where(eq(employees.id, id)).run().changes > 0;
  }

  // ── Customers ──
  async getCustomers(companyId: number): Promise<Customer[]> {
    return db.select().from(customers).where(byCompany(customers, companyId)).all();
  }
  async getCustomer(id: number, companyId?: number): Promise<Customer | undefined> {
    return db.select().from(customers).where(byIdInCompany(customers, id, companyId)).get();
  }
  async createCustomer(data: InsertCustomer): Promise<Customer> {
    return db.insert(customers).values(data).returning().get();
  }
  async updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    return db.update(customers).set(data).where(eq(customers.id, id)).returning().get();
  }
  async deleteCustomer(id: number): Promise<boolean> {
    return db.delete(customers).where(eq(customers.id, id)).run().changes > 0;
  }

  // ── Tasks ──
  async getTasks(companyId: number): Promise<Task[]> {
    return db.select().from(tasks).where(byCompany(tasks, companyId)).all();
  }
  async getTasksByCustomer(customerId: number): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.customerId, customerId)).all();
  }
  async getTask(id: number, companyId?: number): Promise<Task | undefined> {
    return db.select().from(tasks).where(byIdInCompany(tasks, id, companyId)).get();
  }
  async createTask(data: InsertTask): Promise<Task> {
    return db.insert(tasks).values(data).returning().get();
  }
  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    return db.update(tasks).set(data).where(eq(tasks.id, id)).returning().get();
  }
  async deleteTask(id: number): Promise<boolean> {
    return db.delete(tasks).where(eq(tasks.id, id)).run().changes > 0;
  }
  async getTaskNotes(taskId: number): Promise<TaskNote[]> {
    return db.select().from(taskNotes).where(eq(taskNotes.taskId, taskId)).orderBy(desc(taskNotes.createdAt)).all();
  }
  async createTaskNote(data: InsertTaskNote): Promise<TaskNote> {
    return db.insert(taskNotes).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }

  // ── Time Entries ──
  async getTimeEntries(companyId: number): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(byCompany(timeEntries, companyId)).all();
  }
  async getTimeEntriesByCustomer(customerId: number): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.taskId, customerId)).all();
  }
  async getTimeEntry(id: number, companyId?: number): Promise<TimeEntry | undefined> {
    return db.select().from(timeEntries).where(byIdInCompany(timeEntries, id, companyId)).get();
  }
  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    return db.insert(timeEntries).values(data).returning().get();
  }
  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    return db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning().get();
  }
  async deleteTimeEntry(id: number): Promise<boolean> {
    return db.delete(timeEntries).where(eq(timeEntries.id, id)).run().changes > 0;
  }

  // ── Notifications ──
  async getNotifications(companyId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(byCompany(notifications, companyId)).all();
  }
  async createNotification(data: InsertNotification): Promise<Notification> {
    return db.insert(notifications).values(data).returning().get();
  }
  async markNotificationRead(id: number, companyId?: number): Promise<boolean> {
    const where = companyId == null
      ? eq(notifications.id, id)
      : and(eq(notifications.id, id), eq(notifications.companyId, companyId));
    return db.update(notifications).set({ read: true }).where(where).run().changes > 0;
  }
  async markAllNotificationsRead(companyId: number): Promise<boolean> {
    return db.update(notifications).set({ read: true }).where(byCompany(notifications, companyId)).run().changes > 0;
  }
  async deleteNotification(id: number, companyId?: number): Promise<boolean> {
    const where = companyId == null
      ? eq(notifications.id, id)
      : and(eq(notifications.id, id), eq(notifications.companyId, companyId));
    return db.delete(notifications).where(where).run().changes > 0;
  }

  // ── Invoices ──
  async getInvoices(companyId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(byCompany(invoices, companyId)).all();
  }
  async getInvoicesByCustomer(customerId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.customerId, customerId)).all();
  }
  async getInvoice(id: number, companyId?: number): Promise<Invoice | undefined> {
    return db.select().from(invoices).where(byIdInCompany(invoices, id, companyId)).get();
  }
  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    return db.insert(invoices).values(data).returning().get();
  }
  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    return db.update(invoices).set(data).where(eq(invoices.id, id)).returning().get();
  }
  async deleteInvoice(id: number): Promise<boolean> {
    return db.delete(invoices).where(eq(invoices.id, id)).run().changes > 0;
  }

  // ── Invoice Items ──
  async getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
    return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).all();
  }
  async createInvoiceItem(data: InsertInvoiceItem): Promise<InvoiceItem> {
    return db.insert(invoiceItems).values(data).returning().get();
  }
  async deleteInvoiceItems(invoiceId: number): Promise<boolean> {
    return db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).run().changes > 0;
  }

  // ── Integrations ──
  async getIntegrations(companyId: number): Promise<Integration[]> {
    return db.select().from(integrations).where(byCompany(integrations, companyId)).all();
  }
  async getIntegration(id: number, companyId?: number): Promise<Integration | undefined> {
    return db.select().from(integrations).where(byIdInCompany(integrations, id, companyId)).get();
  }
  async createIntegration(data: InsertIntegration): Promise<Integration> {
    return db.insert(integrations).values(data).returning().get();
  }
  async updateIntegration(id: number, data: Partial<InsertIntegration>): Promise<Integration | undefined> {
    return db.update(integrations).set(data).where(eq(integrations.id, id)).returning().get();
  }
  async deleteIntegration(id: number): Promise<boolean> {
    return db.delete(integrations).where(eq(integrations.id, id)).run().changes > 0;
  }

  // ── Sync logs ──
  async getSyncLogs(companyId: number, limit = 50): Promise<SyncLog[]> {
    return db.select().from(syncLogs).where(byCompany(syncLogs, companyId))
      .orderBy(desc(syncLogs.id)).limit(limit).all();
  }
  async createSyncLog(data: InsertSyncLog): Promise<SyncLog> {
    return db.insert(syncLogs).values(data).returning().get();
  }

  // ── Absences ──
  async getAbsences(companyId: number): Promise<Absence[]> {
    return db.select().from(absences).where(byCompany(absences, companyId))
      .orderBy(desc(absences.startDate)).all();
  }
  async getAbsence(id: number, companyId?: number): Promise<Absence | undefined> {
    return db.select().from(absences).where(byIdInCompany(absences, id, companyId)).get();
  }
  async createAbsence(data: InsertAbsence): Promise<Absence> {
    return db.insert(absences).values(data).returning().get();
  }
  async updateAbsence(id: number, data: Partial<InsertAbsence>): Promise<Absence | undefined> {
    return db.update(absences).set(data).where(eq(absences.id, id)).returning().get();
  }
  async deleteAbsence(id: number): Promise<boolean> {
    return db.delete(absences).where(eq(absences.id, id)).run().changes > 0;
  }

  // ── Shifts ──
  async getShifts(companyId: number, from?: string, to?: string): Promise<Shift[]> {
    const clauses = [byCompany(shifts, companyId)];
    if (from) clauses.push(gte(shifts.date, from));
    if (to) clauses.push(lte(shifts.date, to));
    return db.select().from(shifts).where(and(...clauses)).all();
  }
  async getShift(id: number, companyId?: number): Promise<Shift | undefined> {
    return db.select().from(shifts).where(byIdInCompany(shifts, id, companyId)).get();
  }
  async createShift(data: InsertShift): Promise<Shift> {
    return db.insert(shifts).values(data).returning().get();
  }
  async updateShift(id: number, data: Partial<InsertShift>): Promise<Shift | undefined> {
    return db.update(shifts).set(data).where(eq(shifts.id, id)).returning().get();
  }
  async deleteShift(id: number): Promise<boolean> {
    return db.delete(shifts).where(eq(shifts.id, id)).run().changes > 0;
  }

  // ── Attachments ──
  async getAttachments(companyId: number, taskId?: number): Promise<Attachment[]> {
    const where = taskId === undefined
      ? byCompany(attachments, companyId)
      : and(byCompany(attachments, companyId), eq(attachments.taskId, taskId));
    return db.select().from(attachments).where(where).orderBy(desc(attachments.id)).all();
  }
  async getAttachment(id: number, companyId?: number): Promise<Attachment | undefined> {
    return db.select().from(attachments).where(byIdInCompany(attachments, id, companyId)).get();
  }
  async createAttachment(data: InsertAttachment): Promise<Attachment> {
    return db.insert(attachments).values(data).returning().get();
  }
  async deleteAttachment(id: number): Promise<boolean> {
    return db.delete(attachments).where(eq(attachments.id, id)).run().changes > 0;
  }

  // ── Message outbox ──
  async getMessages(companyId: number, limit = 50): Promise<OutboxMessage[]> {
    return db.select().from(messageOutbox).where(byCompany(messageOutbox, companyId))
      .orderBy(desc(messageOutbox.id)).limit(limit).all();
  }
  async createMessage(data: InsertMessage): Promise<OutboxMessage> {
    return db.insert(messageOutbox).values(data).returning().get();
  }
  async updateMessage(id: number, data: Partial<InsertMessage>): Promise<OutboxMessage | undefined> {
    return db.update(messageOutbox).set(data).where(eq(messageOutbox.id, id)).returning().get();
  }

  // ── Plans ──
  async getPlans(): Promise<Plan[]> {
    return db.select().from(plans).orderBy(plans.sortOrder).all();
  }
  async getPlan(id: number): Promise<Plan | undefined> {
    return db.select().from(plans).where(eq(plans.id, id)).get();
  }
  async getPlanBySlug(slug: string): Promise<Plan | undefined> {
    return db.select().from(plans).where(eq(plans.slug, slug)).get();
  }
  async createPlan(data: InsertPlan): Promise<Plan> {
    return db.insert(plans).values(data).returning().get();
  }
  async updatePlan(id: number, data: Partial<InsertPlan>): Promise<Plan | undefined> {
    return db.update(plans).set(data).where(eq(plans.id, id)).returning().get();
  }

  // ── Subscriptions ──
  async getSubscriptions(): Promise<Subscription[]> {
    return db.select().from(subscriptions).all();
  }
  async getSubscriptionByCompany(companyId: number): Promise<Subscription | undefined> {
    return db.select().from(subscriptions).where(byCompany(subscriptions, companyId)).get();
  }
  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    return db.insert(subscriptions).values(data).returning().get();
  }
  async updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    return db.update(subscriptions).set(data).where(eq(subscriptions.id, id)).returning().get();
  }
  async getCompanyPlan(companyId: number): Promise<Plan | undefined> {
    const sub = await this.getSubscriptionByCompany(companyId);
    if (!sub) return undefined;
    return this.getPlan(sub.planId);
  }

  // ── Platform invoices ──
  async getPlatformInvoices(companyId?: number): Promise<PlatformInvoice[]> {
    const q = db.select().from(platformInvoices);
    const rows = companyId === undefined
      ? q.orderBy(desc(platformInvoices.id)).all()
      : q.where(byCompany(platformInvoices, companyId)).orderBy(desc(platformInvoices.id)).all();
    return rows;
  }
  async createPlatformInvoice(data: InsertPlatformInvoice): Promise<PlatformInvoice> {
    return db.insert(platformInvoices).values(data).returning().get();
  }
  async updatePlatformInvoice(id: number, data: Partial<InsertPlatformInvoice>): Promise<PlatformInvoice | undefined> {
    return db.update(platformInvoices).set(data).where(eq(platformInvoices.id, id)).returning().get();
  }

  // ── Audit ──
  async getAuditLogs(companyId?: number, limit = 100): Promise<AuditLog[]> {
    const q = db.select().from(auditLogs);
    return companyId === undefined
      ? q.orderBy(desc(auditLogs.id)).limit(limit).all()
      : q.where(byCompany(auditLogs, companyId)).orderBy(desc(auditLogs.id)).limit(limit).all();
  }
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    return db.insert(auditLogs).values(data).returning().get();
  }

  // ══════════════════════════════════════════════════
  //  BETALING
  // ══════════════════════════════════════════════════
  async getPaymentMethods(companyId: number): Promise<PaymentMethod[]> {
    return db.select().from(paymentMethods).where(and(byCompany(paymentMethods, companyId), eq(paymentMethods.status, "aktiv"))).all();
  }
  async getPaymentMethod(id: number, companyId?: number): Promise<PaymentMethod | undefined> {
    return db.select().from(paymentMethods).where(byIdInCompany(paymentMethods, id, companyId)).get();
  }
  async getDefaultPaymentMethod(companyId: number): Promise<PaymentMethod | undefined> {
    return db.select().from(paymentMethods)
      .where(and(byCompany(paymentMethods, companyId), eq(paymentMethods.isDefault, 1), eq(paymentMethods.status, "aktiv"))).get();
  }
  async createPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
    return db.insert(paymentMethods).values(data).returning().get();
  }
  async updatePaymentMethod(id: number, data: Partial<InsertPaymentMethod>): Promise<PaymentMethod | undefined> {
    return db.update(paymentMethods).set(data).where(eq(paymentMethods.id, id)).returning().get();
  }
  async clearDefaultPaymentMethods(companyId: number): Promise<void> {
    db.update(paymentMethods).set({ isDefault: 0 }).where(byCompany(paymentMethods, companyId)).run();
  }

  async getPayments(companyId?: number, limit = 100): Promise<Payment[]> {
    const q = db.select().from(payments);
    return companyId === undefined
      ? q.orderBy(desc(payments.id)).limit(limit).all()
      : q.where(byCompany(payments, companyId)).orderBy(desc(payments.id)).limit(limit).all();
  }
  async getPaymentsForInvoice(platformInvoiceId: number): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.platformInvoiceId, platformInvoiceId)).orderBy(desc(payments.id)).all();
  }
  async createPayment(data: InsertPayment): Promise<Payment> {
    return db.insert(payments).values(data).returning().get();
  }
  async updatePayment(id: number, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    return db.update(payments).set(data).where(eq(payments.id, id)).returning().get();
  }
  async getPaymentByProviderRef(ref: string): Promise<Payment | undefined> {
    return db.select().from(payments).where(eq(payments.providerRef, ref)).get();
  }

  async getWebhookEvent(eventId: string): Promise<WebhookEvent | undefined> {
    return db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).get();
  }
  async createWebhookEvent(data: any): Promise<WebhookEvent> {
    return db.insert(webhookEvents).values(data).returning().get();
  }
  async updateWebhookEvent(id: number, data: any): Promise<WebhookEvent | undefined> {
    return db.update(webhookEvents).set(data).where(eq(webhookEvents.id, id)).returning().get();
  }
  async getWebhookEvents(limit = 50): Promise<WebhookEvent[]> {
    return db.select().from(webhookEvents).orderBy(desc(webhookEvents.id)).limit(limit).all();
  }

  // ══════════════════════════════════════════════════
  //  TILMELDING OG LOGIN-SIKKERHED
  // ══════════════════════════════════════════════════
  async createAuthToken(data: any): Promise<AuthToken> {
    return db.insert(authTokens).values(data).returning().get();
  }
  async getAuthToken(token: string): Promise<AuthToken | undefined> {
    return db.select().from(authTokens).where(eq(authTokens.token, token)).get();
  }
  async useAuthToken(id: number, usedAt: string): Promise<void> {
    db.update(authTokens).set({ usedAt }).where(eq(authTokens.id, id)).run();
  }
  async getPendingInvitations(companyId: number): Promise<AuthToken[]> {
    return db.select().from(authTokens)
      .where(and(eq(authTokens.companyId, companyId), eq(authTokens.kind, "invitation"), isNull(authTokens.usedAt)))
      .orderBy(desc(authTokens.id)).all();
  }

  async recordLoginAttempt(data: { email: string; ip?: string | null; success: number; reason?: string | null; createdAt: string }): Promise<void> {
    db.insert(loginAttempts).values(data).run();
  }
  async countRecentFailures(email: string, sinceIso: string): Promise<number> {
    const rows = db.select().from(loginAttempts)
      .where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, 0), gte(loginAttempts.createdAt, sinceIso))).all();
    return rows.length;
  }
  async getLoginAttempts(email?: string, limit = 50): Promise<LoginAttempt[]> {
    const q = db.select().from(loginAttempts);
    return email
      ? q.where(eq(loginAttempts.email, email)).orderBy(desc(loginAttempts.id)).limit(limit).all()
      : q.orderBy(desc(loginAttempts.id)).limit(limit).all();
  }

  // ══════════════════════════════════════════════════
  //  GDPR
  // ══════════════════════════════════════════════════
  async getDataRequests(companyId: number): Promise<DataRequest[]> {
    return db.select().from(dataRequests).where(byCompany(dataRequests, companyId)).orderBy(desc(dataRequests.id)).all();
  }
  async getDataRequest(id: number, companyId?: number): Promise<DataRequest | undefined> {
    return db.select().from(dataRequests).where(byIdInCompany(dataRequests, id, companyId)).get();
  }
  async createDataRequest(data: InsertDataRequest): Promise<DataRequest> {
    return db.insert(dataRequests).values(data).returning().get();
  }
  async updateDataRequest(id: number, data: Partial<InsertDataRequest>): Promise<DataRequest | undefined> {
    return db.update(dataRequests).set(data).where(eq(dataRequests.id, id)).returning().get();
  }

  async getConsents(companyId: number, employeeId?: number): Promise<Consent[]> {
    const q = db.select().from(consents);
    return employeeId === undefined
      ? q.where(byCompany(consents, companyId)).all()
      : q.where(and(byCompany(consents, companyId), eq(consents.employeeId, employeeId))).all();
  }
  async upsertConsent(companyId: number, employeeId: number, kind: string, data: Partial<InsertConsent>): Promise<Consent> {
    const existing = db.select().from(consents)
      .where(and(byCompany(consents, companyId), eq(consents.employeeId, employeeId), eq(consents.kind, kind))).get();
    if (existing) {
      return db.update(consents).set(data).where(eq(consents.id, existing.id)).returning().get();
    }
    return db.insert(consents).values({ companyId, employeeId, kind, ...data } as InsertConsent).returning().get();
  }

  // ══════════════════════════════════════════════════
  //  TILBUD OG KONTRAKTER
  // ══════════════════════════════════════════════════
  async getQuotes(companyId: number): Promise<Quote[]> {
    return db.select().from(quotes).where(byCompany(quotes, companyId)).orderBy(desc(quotes.id)).all();
  }
  async getQuote(id: number, companyId?: number): Promise<Quote | undefined> {
    return db.select().from(quotes).where(byIdInCompany(quotes, id, companyId)).get();
  }
  async createQuote(data: InsertQuote): Promise<Quote> {
    return db.insert(quotes).values(data).returning().get();
  }
  async updateQuote(id: number, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    return db.update(quotes).set(data).where(eq(quotes.id, id)).returning().get();
  }
  async deleteQuote(id: number): Promise<boolean> {
    db.delete(quoteItems).where(eq(quoteItems.quoteId, id)).run();
    return db.delete(quotes).where(eq(quotes.id, id)).run().changes > 0;
  }
  async getQuoteItems(quoteId: number): Promise<QuoteItem[]> {
    return db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId)).all();
  }
  async createQuoteItem(data: InsertQuoteItem): Promise<QuoteItem> {
    return db.insert(quoteItems).values(data).returning().get();
  }
  async deleteQuoteItems(quoteId: number): Promise<void> {
    db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId)).run();
  }

  async getContracts(companyId: number): Promise<Contract[]> {
    return db.select().from(contracts).where(byCompany(contracts, companyId)).orderBy(desc(contracts.id)).all();
  }
  async getContract(id: number, companyId?: number): Promise<Contract | undefined> {
    return db.select().from(contracts).where(byIdInCompany(contracts, id, companyId)).get();
  }
  async getContractForCustomer(companyId: number, customerId: number): Promise<Contract | undefined> {
    return db.select().from(contracts)
      .where(and(byCompany(contracts, companyId), eq(contracts.customerId, customerId), eq(contracts.status, "aktiv"))).get();
  }
  async createContract(data: InsertContract): Promise<Contract> {
    return db.insert(contracts).values(data).returning().get();
  }
  async updateContract(id: number, data: Partial<InsertContract>): Promise<Contract | undefined> {
    return db.update(contracts).set(data).where(eq(contracts.id, id)).returning().get();
  }
  async deleteContract(id: number): Promise<boolean> {
    return db.delete(contracts).where(eq(contracts.id, id)).run().changes > 0;
  }

  // ══════════════════════════════════════════════════
  //  MATERIALER
  // ══════════════════════════════════════════════════
  async getMaterials(companyId: number): Promise<Material[]> {
    return db.select().from(materials).where(byCompany(materials, companyId)).orderBy(materials.name).all();
  }
  async getMaterial(id: number, companyId?: number): Promise<Material | undefined> {
    return db.select().from(materials).where(byIdInCompany(materials, id, companyId)).get();
  }
  async createMaterial(data: InsertMaterial): Promise<Material> {
    return db.insert(materials).values(data).returning().get();
  }
  async updateMaterial(id: number, data: Partial<InsertMaterial>): Promise<Material | undefined> {
    return db.update(materials).set(data).where(eq(materials.id, id)).returning().get();
  }
  async deleteMaterial(id: number): Promise<boolean> {
    return db.delete(materials).where(eq(materials.id, id)).run().changes > 0;
  }

  async getMaterialUsage(companyId: number, filters?: { materialId?: number; taskId?: number; customerId?: number }): Promise<MaterialUsage[]> {
    const conds = [byCompany(materialUsage, companyId)];
    if (filters?.materialId) conds.push(eq(materialUsage.materialId, filters.materialId));
    if (filters?.taskId) conds.push(eq(materialUsage.taskId, filters.taskId));
    if (filters?.customerId) conds.push(eq(materialUsage.customerId, filters.customerId));
    return db.select().from(materialUsage).where(and(...conds)).orderBy(desc(materialUsage.id)).all();
  }
  async createMaterialUsage(data: InsertMaterialUsage): Promise<MaterialUsage> {
    return db.insert(materialUsage).values(data).returning().get();
  }
  async updateMaterialUsage(id: number, data: Partial<InsertMaterialUsage>): Promise<MaterialUsage | undefined> {
    return db.update(materialUsage).set(data).where(eq(materialUsage.id, id)).returning().get();
  }
  async deleteMaterialUsage(id: number): Promise<boolean> {
    return db.delete(materialUsage).where(eq(materialUsage.id, id)).run().changes > 0;
  }

  // ══════════════════════════════════════════════════
  //  NØGLER OG ALARMKODER
  // ══════════════════════════════════════════════════
  async getKeys(companyId: number, customerId?: number): Promise<KeyItem[]> {
    const conds = [byCompany(keys, companyId)];
    if (customerId) conds.push(eq(keys.customerId, customerId));
    return db.select().from(keys).where(and(...conds)).orderBy(desc(keys.id)).all();
  }
  async getKey(id: number, companyId?: number): Promise<KeyItem | undefined> {
    return db.select().from(keys).where(byIdInCompany(keys, id, companyId)).get();
  }
  async createKey(data: InsertKey): Promise<KeyItem> {
    return db.insert(keys).values(data).returning().get();
  }
  async updateKey(id: number, data: Partial<InsertKey>): Promise<KeyItem | undefined> {
    return db.update(keys).set(data).where(eq(keys.id, id)).returning().get();
  }
  async deleteKey(id: number): Promise<boolean> {
    db.delete(keyHandovers).where(eq(keyHandovers.keyId, id)).run();
    return db.delete(keys).where(eq(keys.id, id)).run().changes > 0;
  }
  async getKeyHandovers(companyId: number, keyId?: number): Promise<KeyHandover[]> {
    const conds = [byCompany(keyHandovers, companyId)];
    if (keyId) conds.push(eq(keyHandovers.keyId, keyId));
    return db.select().from(keyHandovers).where(and(...conds)).orderBy(desc(keyHandovers.id)).all();
  }
  async createKeyHandover(data: InsertKeyHandover): Promise<KeyHandover> {
    return db.insert(keyHandovers).values(data).returning().get();
  }

  // ══════════════════════════════════════════════════
  //  KVALITETSKONTROL
  // ══════════════════════════════════════════════════
  async getInspections(companyId: number, filters?: { customerId?: number; employeeId?: number }): Promise<Inspection[]> {
    const conds = [byCompany(inspections, companyId)];
    if (filters?.customerId) conds.push(eq(inspections.customerId, filters.customerId));
    if (filters?.employeeId) conds.push(eq(inspections.employeeId, filters.employeeId));
    return db.select().from(inspections).where(and(...conds)).orderBy(desc(inspections.date)).all();
  }
  async getInspection(id: number, companyId?: number): Promise<Inspection | undefined> {
    return db.select().from(inspections).where(byIdInCompany(inspections, id, companyId)).get();
  }
  async createInspection(data: InsertInspection): Promise<Inspection> {
    return db.insert(inspections).values(data).returning().get();
  }
  async updateInspection(id: number, data: Partial<InsertInspection>): Promise<Inspection | undefined> {
    return db.update(inspections).set(data).where(eq(inspections.id, id)).returning().get();
  }
  async deleteInspection(id: number): Promise<boolean> {
    return db.delete(inspections).where(eq(inspections.id, id)).run().changes > 0;
  }

  // ══════════════════════════════════════════════════
  //  AUTOMATISKE JOB
  // ══════════════════════════════════════════════════
  async createJobRun(data: any): Promise<JobRun> {
    return db.insert(jobRuns).values(data).returning().get();
  }
  async updateJobRun(id: number, data: any): Promise<JobRun | undefined> {
    return db.update(jobRuns).set(data).where(eq(jobRuns.id, id)).returning().get();
  }
  async getJobRuns(limit = 40): Promise<JobRun[]> {
    return db.select().from(jobRuns).orderBy(desc(jobRuns.id)).limit(limit).all();
  }

  // ══════════════════════════════════════════════════
  //  OPRYDNING (GDPR-opbevaring)
  // ══════════════════════════════════════════════════
  /** Fjerner GPS-koordinater fra gamle tidsregistreringer, men beholder timerne. */
  async stripOldGps(companyId: number, beforeDate: string): Promise<number> {
    const rows = db.select().from(timeEntries)
      .where(and(byCompany(timeEntries, companyId), lte(timeEntries.date, beforeDate))).all();
    let n = 0;
    for (const r of rows) {
      if (r.checkInLat !== null || r.checkInLng !== null || r.checkOutLat !== null) {
        db.update(timeEntries).set({ checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null })
          .where(eq(timeEntries.id, r.id)).run();
        n++;
      }
    }
    return n;
  }
  async deleteOldTimeEntries(companyId: number, beforeDate: string): Promise<number> {
    return db.delete(timeEntries)
      .where(and(byCompany(timeEntries, companyId), lte(timeEntries.date, beforeDate))).run().changes;
  }
  async deleteOldAbsences(companyId: number, beforeDate: string): Promise<number> {
    return db.delete(absences)
      .where(and(byCompany(absences, companyId), lte(absences.endDate, beforeDate))).run().changes;
  }
  /** Rydder udløbne sessioner. Returnerer antallet, der blev fjernet. */
  async deleteExpiredSessions(nowIso: string): Promise<number> {
    const r = db.delete(sessions).where(lt(sessions.expiresAt, nowIso)).run();
    return r.changes ?? 0;
  }
  /** Rydder udløbne og brugte engangstokens, så tabellen ikke vokser i det uendelige. */
  async deleteExpiredAuthTokens(nowIso: string): Promise<number> {
    const r = db.delete(authTokens).where(lt(authTokens.expiresAt, nowIso)).run();
    return r.changes ?? 0;
  }

  async getExpiredAttachments(nowIso: string): Promise<Attachment[]> {
    return db.select().from(attachments).where(lte(attachments.deleteAfter, nowIso)).all();
  }
  async deleteAttachmentRow(id: number): Promise<boolean> {
    return db.delete(attachments).where(eq(attachments.id, id)).run().changes > 0;
  }

  // ── Generic CRUD for new tables ──
  private tableMap: Record<string, any> = {};
  private getTable(name: string): any {
    if (!this.tableMap[name]) {
      this.tableMap[name] = schemaModule[name as keyof typeof schemaModule]
        || schemaModule[name.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase()) as keyof typeof schemaModule];
    }
    return this.tableMap[name];
  }

  async all(name: string, companyId?: number | null, limit?: number): Promise<any[]> {
    const table = this.getTable(name);
    if (!table) return [];
    let q: any = db.select().from(table);
    if (companyId !== undefined) {
      if (companyId === null) {
        q = q.where(sql`${table.companyId} IS NULL`);
      } else {
        q = q.where(eq(table.companyId, companyId));
      }
    }
    const rows = q.all();
    return limit ? rows.slice(-limit).reverse() : rows;
  }

  async get(name: string, id: number, companyId?: number | null): Promise<any | undefined> {
    const table = this.getTable(name);
    if (!table) return undefined;
    let q = db.select().from(table).where(eq(table.id, id));
    const row = q.get();
    if (row && companyId !== undefined && companyId !== null && (row as any).companyId !== companyId) return undefined;
    if (row && companyId === null && (row as any).companyId !== null) return undefined;
    return row;
  }

  async insert(name: string, data: any): Promise<any> {
    const table = this.getTable(name);
    if (!table) throw new Error(`Unknown table: ${name}`);
    return db.insert(table).values(data).returning().get();
  }

  async update(name: string, id: number, data: any, companyId?: number | null): Promise<any> {
    const table = this.getTable(name);
    if (!table) throw new Error(`Unknown table: ${name}`);
    const { id: _ignoredId, companyId: _ignoredCompanyId, createdAt: _ignoredCreatedAt, ...safeData } = data ?? {};
    let q: any = db.update(table).set(safeData);
    if (companyId !== undefined) {
      if (companyId === null) {
        q = q.where(and(eq(table.id, id), sql`${table.companyId} IS NULL`));
      } else {
        q = q.where(and(eq(table.id, id), eq(table.companyId, companyId)));
      }
    } else {
      q = q.where(eq(table.id, id));
    }
    return q.returning().get();
  }

  async delete(name: string, id: number, companyId?: number | null): Promise<boolean> {
    const table = this.getTable(name);
    if (!table) throw new Error(`Unknown table: ${name}`);
    let q: any = db.delete(table);
    if (companyId !== undefined && companyId !== null) {
      q = q.where(and(eq(table.id, id), eq(table.companyId, companyId)));
    } else {
      q = q.where(eq(table.id, id));
    }
    return q.run().changes > 0;
  }
}

export const storage = new DatabaseStorage();

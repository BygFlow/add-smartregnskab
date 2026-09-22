import { and, eq } from "drizzle-orm";
import { dpaPlainText } from "@shared/legal-documents";
import {
  absences,
  attachments,
  auditLogs,
  companies,
  consents,
  customers,
  dataRequests,
  employees,
  invoices,
  loginAttempts,
  sessions,
  shifts,
  tasks,
  timeEntries,
  users,
} from "@shared/schema";
import { db, storage } from "./storage";
import { addMonths, round2 } from "./domain";
import { deleteFile } from "./files";

type SubjectType = "ansat" | "kunde" | "bruger";
type DanishRow = Record<string, unknown>;

export interface SubjectDataExport {
  subjectName: string;
  generatedAt: string;
  sections: Array<{ overskrift: string; poster: DanishRow[] }>;
}

export interface AnonymizeEmployeeResult {
  anonymized: boolean;
  timeEntries: number;
  absences: number;
  attachments: number;
  forklaring: string;
}

export interface AnonymizeCustomerResult {
  anonymized: boolean;
  attachments: number;
  forklaring: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function actorDetails(actor: unknown): { userId: number | null; userEmail: string | null } {
  if (typeof actor === "string") return { userId: null, userEmail: actor };
  if (actor && typeof actor === "object") {
    const item = actor as { id?: unknown; userId?: unknown; email?: unknown; name?: unknown };
    const possibleId = item.userId ?? item.id;
    return {
      userId: typeof possibleId === "number" ? possibleId : null,
      userEmail: typeof item.email === "string" ? item.email : typeof item.name === "string" ? item.name : null,
    };
  }
  return { userId: null, userEmail: null };
}

async function audit(companyId: number, actor: unknown, action: string, target: string, detail: string): Promise<void> {
  const who = actorDetails(actor);
  await storage.createAuditLog({
    companyId,
    userId: who.userId,
    userEmail: who.userEmail,
    action,
    target,
    detail,
    createdAt: nowIso(),
  });
}

function profileEmployee(employee: typeof employees.$inferSelect): DanishRow {
  return {
    "ID": employee.id,
    "Navn": employee.name,
    "Telefon": employee.phone,
    "E-mail": employee.email,
    "Stilling": employee.role,
    "Status": employee.status,
    "Aftalt ugentlig arbejdstid": employee.weeklyHours,
  };
}

function profileCustomer(customer: typeof customers.$inferSelect): DanishRow {
  return {
    "ID": customer.id,
    "Navn": customer.name,
    "Adresse": customer.address,
    "Kontaktperson": customer.contact,
    "Telefon": customer.phone,
    "E-mail": customer.email,
    "Timepris": customer.hourlyRate,
    "Breddegrad": customer.lat,
    "Længdegrad": customer.lng,
    "Geofence-radius i meter": customer.geofenceRadius,
  };
}

function profileUser(user: typeof users.$inferSelect): DanishRow {
  // Kodeordshash og 2FA-hemmeligheder udleveres aldrig; de er sikkerhedsoplysninger,
  // ikke indhold der kan bruges sikkert af den registrerede.
  return {
    "ID": user.id,
    "Navn": user.name,
    "E-mail": user.email,
    "Rolle": user.role,
    "Tilknyttet ansat-ID": user.employeeId,
    "Tilknyttet kunde-ID": user.customerId,
    "Aktiv konto": user.active === 1 ? "Ja" : "Nej",
    "E-mail bekræftet": user.emailVerified === 1 ? "Ja" : "Nej",
    "To-faktor-login aktiveret": user.twoFactorEnabled === 1 ? "Ja" : "Nej",
    "Konto låst til": user.lockedUntil,
    "Seneste login": user.lastLoginAt,
    "Kodeord sidst ændret": user.passwordChangedAt,
  };
}

function timeEntryRow(row: typeof timeEntries.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Dato": row.date,
    "Starttid": row.startTime,
    "Sluttid": row.endTime,
    "Varighed i minutter": row.durationMinutes,
    "Bemærkning": row.note,
    "Opgave-ID": row.taskId,
    "Check-in breddegrad": row.checkInLat,
    "Check-in længdegrad": row.checkInLng,
    "Check-ud breddegrad": row.checkOutLat,
    "Check-ud længdegrad": row.checkOutLng,
    "Check-in afstand i meter": row.checkInDistance,
    "Check-ud afstand i meter": row.checkOutDistance,
    "Geofence-status": row.geofenceStatus,
    "Godkendt til løn": row.approved === 1 ? "Ja" : "Nej",
  };
}

function absenceRow(row: typeof absences.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Fraværstype": row.type,
    "Startdato": row.startDate,
    "Slutdato": row.endDate,
    "Timer pr. dag": row.hoursPerDay,
    "Status": row.status,
    "Med løn": row.paid === 1 ? "Ja" : "Nej",
    "Bemærkning": row.note,
    "Godkendt af bruger-ID": row.approvedBy,
    "Godkendt tidspunkt": row.approvedAt,
    "Oprettet": row.createdAt,
  };
}

function shiftRow(row: typeof shifts.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Dato": row.date,
    "Starttid": row.startTime,
    "Sluttid": row.endTime,
    "Kunde-ID": row.customerId,
    "Status": row.status,
    "Bemærkning": row.note,
    "Udgivet": row.published === 1 ? "Ja" : "Nej",
  };
}

function taskRow(row: typeof tasks.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Titel": row.title,
    "Dato": row.date,
    "Starttid": row.startTime,
    "Sluttid": row.endTime,
    "Kunde-ID": row.customerId,
    "Ansat-ID": row.employeeId,
    "Status": row.status,
    "Prioritet": row.priority,
    "Beskrivelse": row.description,
    "Tjekliste": row.checklist,
    "Gentagelse": row.recurrence,
    "Gentagelse slutter": row.recurrenceEndDate,
    "Forældreopgave-ID": row.parentTaskId,
  };
}

function attachmentRow(row: typeof attachments.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Filnavn": row.fileName,
    "Filtype": row.mimeType,
    "Filstørrelse i byte": row.sizeBytes,
    "Dokumentationstype": row.kind,
    "Opgave-ID": row.taskId,
    "Inspektions-ID": row.inspectionId,
    "Uploadet af bruger-ID": row.uploadedBy,
    "Bemærkning": row.note,
    "Oprettet": row.createdAt,
    "Planlagt sletning": row.deleteAfter,
  };
}

function consentRow(row: typeof consents.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Samtykketype": row.kind,
    "Givet": row.granted === 1 ? "Ja" : "Nej",
    "Givet tidspunkt": row.grantedAt,
    "Trukket tilbage tidspunkt": row.withdrawnAt,
    "Tekstversion": row.textVersion,
  };
}

function invoiceRow(row: typeof invoices.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Fakturanummer": row.invoiceNumber,
    "Status": row.status,
    "Fakturadato": row.issueDate,
    "Forfaldsdato": row.dueDate,
    "Beløb ekskl. moms": row.netAmount,
    "Momssats": row.vatRate,
    "Momsbeløb": row.vatAmount,
    "Beløb inkl. moms": row.totalAmount,
    "Betalingsfrist i dage": row.paymentTerms,
    "Sendt tidspunkt": row.sentAt,
    "Betalt tidspunkt": row.paidAt,
    "Antal rykkere": row.reminderCount,
    "Seneste rykker": row.lastReminderAt,
    "Bemærkning": row.notes,
  };
}

function dataRequestRow(row: typeof dataRequests.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Anmodningstype": row.kind,
    "Status": row.status,
    "Anmodet af": row.requestedBy,
    "Bemærkning": row.note,
    "Reference til resultat": row.resultRef,
    "Oprettet": row.createdAt,
    "Afsluttet": row.completedAt,
  };
}

function auditRow(row: typeof auditLogs.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "Handling": row.action,
    "Mål": row.target,
    "Detaljer": row.detail,
    "Tidspunkt": row.createdAt,
  };
}

function loginRow(row: typeof loginAttempts.$inferSelect): DanishRow {
  return {
    "ID": row.id,
    "IP-adresse": row.ip,
    "Vellykket login": row.success === 1 ? "Ja" : "Nej",
    "Årsag": row.reason,
    "Tidspunkt": row.createdAt,
  };
}

/** Samler personoplysninger i danske, udleveringsklare sektioner. */
export async function exportSubjectData(
  companyId: number,
  subjectType: SubjectType,
  subjectId: number,
): Promise<SubjectDataExport> {
  let employee: typeof employees.$inferSelect | undefined;
  let customer: typeof customers.$inferSelect | undefined;
  let user: typeof users.$inferSelect | undefined;

  if (subjectType === "ansat") employee = await storage.getEmployee(subjectId, companyId);
  if (subjectType === "kunde") customer = await storage.getCustomer(subjectId, companyId);
  if (subjectType === "bruger") {
    user = await storage.getUser(subjectId);
    if (!user || user.companyId !== companyId) user = undefined;
  }
  if (!employee && !customer && !user) throw new Error("Den registrerede findes ikke i virksomheden.");

  if (user?.employeeId) employee = await storage.getEmployee(user.employeeId, companyId);
  if (user?.customerId) customer = await storage.getCustomer(user.customerId, companyId);
  const relatedUsers = employee || customer
    ? db.select().from(users).where(and(
      eq(users.companyId, companyId),
      employee ? eq(users.employeeId, employee.id) : eq(users.customerId, customer!.id),
    )).all()
    : [];
  if (user && !relatedUsers.some((row) => row.id === user!.id)) relatedUsers.push(user);

  const effectiveEmployeeId = employee?.id;
  const effectiveCustomerId = customer?.id;
  const userIds = relatedUsers.map((row) => row.id);
  const employeeTasks = effectiveEmployeeId
    ? db.select().from(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.employeeId, effectiveEmployeeId))).all()
    : [];
  const customerTasks = effectiveCustomerId
    ? db.select().from(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.customerId, effectiveCustomerId))).all()
    : [];
  const relevantTasks = Array.from(new Map([...employeeTasks, ...customerTasks].map((row) => [row.id, row])).values());
  const taskIds = relevantTasks.map((row) => row.id);
  const allCompanyAttachments = await storage.getAttachments(companyId);
  const relevantAttachments = allCompanyAttachments.filter((row) =>
    (row.taskId !== null && taskIds.includes(row.taskId)) || (row.uploadedBy !== null && userIds.includes(row.uploadedBy)),
  );

  const sections: SubjectDataExport["sections"] = [];
  if (employee) sections.push({ overskrift: "Ansættelsesprofil", poster: [profileEmployee(employee)] });
  if (customer) sections.push({ overskrift: "Kundeprofil", poster: [profileCustomer(customer)] });
  if (relatedUsers.length) sections.push({ overskrift: "Brugerprofil og kontosikkerhed", poster: relatedUsers.map(profileUser) });

  if (effectiveEmployeeId) {
    const employeeTimeEntries = db.select().from(timeEntries).where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.employeeId, effectiveEmployeeId))).all();
    const employeeAbsences = db.select().from(absences).where(and(eq(absences.companyId, companyId), eq(absences.employeeId, effectiveEmployeeId))).all();
    const employeeShifts = db.select().from(shifts).where(and(eq(shifts.companyId, companyId), eq(shifts.employeeId, effectiveEmployeeId))).all();
    const employeeConsents = db.select().from(consents).where(and(eq(consents.companyId, companyId), eq(consents.employeeId, effectiveEmployeeId))).all();
    sections.push({ overskrift: "Tidsregistreringer med lokationsoplysninger", poster: employeeTimeEntries.map(timeEntryRow) });
    sections.push({ overskrift: "Fravær", poster: employeeAbsences.map(absenceRow) });
    sections.push({ overskrift: "Vagter", poster: employeeShifts.map(shiftRow) });
    sections.push({ overskrift: "Samtykker", poster: employeeConsents.map(consentRow) });
  }

  sections.push({ overskrift: "Opgaver", poster: relevantTasks.map(taskRow) });
  sections.push({ overskrift: "Bilagsmetadata", poster: relevantAttachments.map(attachmentRow) });

  if (effectiveCustomerId) {
    const customerInvoices = db.select().from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.customerId, effectiveCustomerId))).all();
    sections.push({ overskrift: "Fakturaer", poster: customerInvoices.map(invoiceRow) });
  }

  const requestFilters: Array<{ type: SubjectType; id: number }> = [{ type: subjectType, id: subjectId }];
  if (effectiveEmployeeId) requestFilters.push({ type: "ansat", id: effectiveEmployeeId });
  if (effectiveCustomerId) requestFilters.push({ type: "kunde", id: effectiveCustomerId });
  for (const relatedUser of relatedUsers) requestFilters.push({ type: "bruger", id: relatedUser.id });
  const requests = db.select().from(dataRequests).where(eq(dataRequests.companyId, companyId)).all()
    .filter((row) => requestFilters.some((filter) => row.subjectType === filter.type && row.subjectId === filter.id));
  sections.push({ overskrift: "GDPR-anmodninger", poster: requests.map(dataRequestRow) });

  if (relatedUsers.length) {
    const emails = relatedUsers.map((row) => row.email);
    const allLogins = db.select().from(loginAttempts).all().filter((row) => emails.includes(row.email));
    const allAudit = db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).all()
      .filter((row) => (row.userId !== null && userIds.includes(row.userId)) || (row.userEmail !== null && emails.includes(row.userEmail)));
    sections.push({ overskrift: "Loginforsøg", poster: allLogins.map(loginRow) });
    sections.push({ overskrift: "Revisionslog", poster: allAudit.map(auditRow) });
  }

  const subjectName = employee?.name ?? customer?.name ?? user!.name;
  return { subjectName, generatedAt: nowIso(), sections };
}

export async function exportSubjectJson(companyId: number, subjectType: SubjectType, subjectId: number): Promise<string> {
  return JSON.stringify(await exportSubjectData(companyId, subjectType, subjectId), null, 2);
}

function csvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (typeof value === "number") text = String(round2(value)).replace(".", ",");
  else if (typeof value === "boolean") text = value ? "Ja" : "Nej";
  else text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export async function exportSubjectCsv(companyId: number, subjectType: SubjectType, subjectId: number): Promise<string> {
  const data = await exportSubjectData(companyId, subjectType, subjectId);
  const rows = ["Sektion;Post;Felt;Værdi"];
  for (const section of data.sections) {
    section.poster.forEach((post, index) => {
      Object.entries(post).forEach(([field, value]) => rows.push([section.overskrift, index + 1, field, value].map(csvCell).join(";")));
    });
  }
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

async function deleteAttachmentBlobs(rows: Array<typeof attachments.$inferSelect>): Promise<number> {
  let deleted = 0;
  for (const row of rows) {
    if (row.storageKey) await deleteFile(row.storage, row.storageKey);
    await storage.deleteAttachmentRow(row.id);
    deleted++;
  }
  return deleted;
}

/**
 * Anonymiserer en fratrådt ansat. Timer bevares uden GPS, fordi dansk
 * bogføringslov kræver fem års dokumentation for løn- og regnskabsgrundlag.
 */
export async function anonymizeEmployee(companyId: number, employeeId: number, actor: unknown): Promise<AnonymizeEmployeeResult> {
  const employee = await storage.getEmployee(employeeId, companyId);
  if (!employee) throw new Error("Den ansatte findes ikke i virksomheden.");
  const linkedUsers = db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.employeeId, employeeId))).all();
  const linkedUserIds = linkedUsers.map((row) => row.id);
  const employeeTasks = db.select().from(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.employeeId, employeeId))).all();
  const taskIds = employeeTasks.map((row) => row.id);
  const employeeAttachments = (await storage.getAttachments(companyId)).filter((row) =>
    (row.taskId !== null && taskIds.includes(row.taskId)) || (row.uploadedBy !== null && linkedUserIds.includes(row.uploadedBy)),
  );
  const employeeTimeEntries = db.select().from(timeEntries).where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.employeeId, employeeId))).all();
  const absenceResult = db.delete(absences).where(and(eq(absences.companyId, companyId), eq(absences.employeeId, employeeId))).run();
  db.delete(consents).where(and(eq(consents.companyId, companyId), eq(consents.employeeId, employeeId))).run();

  for (const entry of employeeTimeEntries) {
    db.update(timeEntries).set({ checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null })
      .where(eq(timeEntries.id, entry.id)).run();
  }
  const attachmentCount = await deleteAttachmentBlobs(employeeAttachments);
  db.update(employees).set({ name: `Anonymiseret ansat #${employeeId}`, phone: null, email: null, status: "ledig" })
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).run();
  for (const linkedUser of linkedUsers) {
    db.delete(sessions).where(eq(sessions.userId, linkedUser.id)).run();
    db.update(users).set({
      name: `Anonymiseret bruger #${linkedUser.id}`,
      email: `anonymiseret-bruger-${linkedUser.id}@invalid.local`,
      password: `deaktiveret-${linkedUser.id}-${nowIso()}`,
      active: 0,
      twoFactorSecret: null,
      twoFactorEnabled: 0,
      twoFactorBackup: null,
      lockedUntil: null,
    }).where(eq(users.id, linkedUser.id)).run();
  }
  await audit(companyId, actor, "gdpr_anonymiser_ansat", `ansat#${employeeId}`, "Ansat anonymiseret; GPS og helbredsoplysninger fjernet.");
  return {
    anonymized: true,
    timeEntries: employeeTimeEntries.length,
    absences: absenceResult.changes,
    attachments: attachmentCount,
    forklaring: "Ansættelsesprofil, GPS, fravær og bilag er anonymiseret eller slettet. Arbejdstimerne bevares uden GPS af hensyn til fem års dokumentation for løn og bogføring.",
  };
}

/** Anonymiserer en kunde, men bevarer fakturaer som regnskabsbilag. */
export async function anonymizeCustomer(companyId: number, customerId: number, actor: unknown): Promise<AnonymizeCustomerResult> {
  const customer = await storage.getCustomer(customerId, companyId);
  if (!customer) throw new Error("Kunden findes ikke i virksomheden.");
  const customerTasks = db.select().from(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.customerId, customerId))).all();
  const linkedUsers = db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.customerId, customerId))).all();
  const linkedUserIds = linkedUsers.map((row) => row.id);
  const taskIds = customerTasks.map((row) => row.id);
  const customerAttachments = (await storage.getAttachments(companyId)).filter((row) =>
    (row.taskId !== null && taskIds.includes(row.taskId)) || (row.uploadedBy !== null && linkedUserIds.includes(row.uploadedBy)),
  );
  const attachmentCount = await deleteAttachmentBlobs(customerAttachments);
  db.update(customers).set({
    name: `Anonymiseret kunde #${customerId}`,
    address: null,
    contact: null,
    phone: null,
    email: null,
    lat: null,
    lng: null,
  }).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).run();
  for (const linkedUser of linkedUsers) {
    db.delete(sessions).where(eq(sessions.userId, linkedUser.id)).run();
    db.update(users).set({
      name: `Anonymiseret bruger #${linkedUser.id}`,
      email: `anonymiseret-bruger-${linkedUser.id}@invalid.local`,
      password: `deaktiveret-${linkedUser.id}-${nowIso()}`,
      active: 0,
      twoFactorSecret: null,
      twoFactorEnabled: 0,
      twoFactorBackup: null,
      lockedUntil: null,
    }).where(eq(users.id, linkedUser.id)).run();
  }
  await audit(companyId, actor, "gdpr_anonymiser_kunde", `kunde#${customerId}`, "Kundens kontaktoplysninger, adresse, koordinater, tilknyttede konti og bilag er fjernet; fakturaer er bevaret.");
  return {
    anonymized: true,
    attachments: attachmentCount,
    forklaring: "Kundens kontaktoplysninger, adresse, koordinater og tilknyttede bilag er slettet eller anonymiseret. Fakturaer bevares som regnskabsbilag efter bogføringsreglerne.",
  };
}

export interface RetentionResult {
  gpsStripped: number;
  timeEntriesDeleted: number;
  absencesDeleted: number;
  photosDeleted: number;
  perCompany: Record<number, { gpsStripped: number; timeEntriesDeleted: number; absencesDeleted: number; photosDeleted: number }>;
}

/** Anvender hver virksomheds opbevaringspolitik; 0 betyder altid behold. */
export async function applyRetention(companyId?: number, todayIso = new Date().toISOString().slice(0, 10)): Promise<RetentionResult> {
  const today = todayIso.slice(0, 10);
  const relevantCompanies = companyId === undefined
    ? await storage.getCompanies()
    : (await storage.getCompany(companyId) ? [await storage.getCompany(companyId)] : []).filter(Boolean) as Array<typeof companies.$inferSelect>;
  const expiredAttachments = await storage.getExpiredAttachments(`${today}T23:59:59.999Z`);
  const result: RetentionResult = { gpsStripped: 0, timeEntriesDeleted: 0, absencesDeleted: 0, photosDeleted: 0, perCompany: {} };

  for (const company of relevantCompanies) {
    const counts = { gpsStripped: 0, timeEntriesDeleted: 0, absencesDeleted: 0, photosDeleted: 0 };
    if (company.retentionGps > 0) counts.gpsStripped = await storage.stripOldGps(company.id, addMonths(today, -company.retentionGps));
    if (company.retentionTimeEntries > 0) counts.timeEntriesDeleted = await storage.deleteOldTimeEntries(company.id, addMonths(today, -company.retentionTimeEntries));
    if (company.retentionAbsences > 0) counts.absencesDeleted = await storage.deleteOldAbsences(company.id, addMonths(today, -company.retentionAbsences));
    if (company.retentionPhotos > 0) {
      const photos = expiredAttachments.filter((attachment) => attachment.companyId === company.id);
      counts.photosDeleted = await deleteAttachmentBlobs(photos);
    }
    result.perCompany[company.id] = counts;
    result.gpsStripped += counts.gpsStripped;
    result.timeEntriesDeleted += counts.timeEntriesDeleted;
    result.absencesDeleted += counts.absencesDeleted;
    result.photosDeleted += counts.photosDeleted;
    if (counts.gpsStripped || counts.timeEntriesDeleted || counts.absencesDeleted || counts.photosDeleted) {
      await audit(company.id, "system", "gdpr_opbevaring", "opbevaringspolitik", `Fjernet: GPS ${counts.gpsStripped}, tidsregistreringer ${counts.timeEntriesDeleted}, fravær ${counts.absencesDeleted}, bilag ${counts.photosDeleted}.`);
    }
  }
  return result;
}

/** Anbefalede perioder kan justeres pr. virksomhed ud fra konkret dokumentationsbehov. */
export function retentionDefaults() {
  return {
    gps: { maaneder: 6, begrundelse: "GPS bør kun gemmes så længe, det er nødvendigt for kontrol og håndtering af konkrete tvister." },
    tidsregistreringer: { maaneder: 60, begrundelse: "Fem år understøtter dokumentation for løn, fakturering og bogføring." },
    fravaer: { maaneder: 60, begrundelse: "Fravær kan være nødvendigt for løn- og ansættelsesdokumentation, men skal slettes efter den fastsatte periode." },
    fotos: { maaneder: 24, begrundelse: "To år giver rimelig tid til kvalitetsopfølgning og reklamationer uden at opbevare billeder unødigt længe." },
  };
}

export function dpaText(): string {
  return dpaPlainText();
}

export function privacyPolicyText(): string {
  return `PRIVATLIVSPOLITIK — UDKAST

ADD SmartDrift ApS, CVR 46761898, Lynæs Søpark 49, 3390 Hundested, behandler gennem ADD SmartRegnskab de oplysninger, der er nødvendige for at oprette og sikre brugerkonti, levere regnskabsfunktioner, yde support, administrere abonnementer og dokumentere sikkerhedshændelser. Kontakt: regnskab@addsmartregnskab.dk.

Oplysninger
Der kan behandles navn, e-mail, telefonnummer, virksomhedsoplysninger, login- og sikkerhedslog, kunde- og leverandørdata, bilag, posteringer, fakturaer, betalingsstatus og supporthenvendelser. Betalingskortoplysninger bør behandles direkte af den valgte betalingsudbyder og ikke gemmes i applikationen.

Formål og grundlag
Behandlingen sker for at opfylde aftalen om tjenesten, overholde retlige forpligtelser, beskytte tjenesten og forfølge legitime interesser i drift, support og misbrugsforebyggelse. Samtykke anvendes, hvor loven kræver det.

Modtagere og opbevaring
Oplysninger deles kun med autoriserede brugere og nødvendige leverandører under passende aftaler. Oplysninger opbevares ikke længere end nødvendigt, dog med respekt for lovpligtige opbevaringsperioder for regnskabsmateriale og dokumentation.

Rettigheder
Registrerede kan efter omstændighederne anmode om indsigt, rettelse, sletning, begrænsning, indsigelse og dataportabilitet samt klage til Datatilsynet. Henvendelser sendes til den dataansvarlige virksomhed eller det kontaktpunkt, som angives i den endelige politik.

Dette er et teknisk udkast. Dataansvarlig, kontaktoplysninger, konkrete leverandører, behandlingsgrundlag og opbevaringsperioder skal udfyldes og godkendes af juridisk rådgiver før kommerciel brug.`;
}

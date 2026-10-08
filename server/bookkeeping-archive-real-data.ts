import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { archiveBucketConfig, archivePeriod, checkArchiveBucket } from "./bookkeeping-archive-readiness";
import { readLockedArchiveObject, storeLockedArchiveObject } from "./bookkeeping-archive-object";
import { parseStoredFileObjectPath } from "./file-object-location";

export type Row = Record<string, unknown>;
export type FileReader = (storage: string, key: string) => Promise<Buffer>;
export const productionFileReader: FileReader = async (storage, key) => (await import("./files")).readFile(storage, key);

export function rows(db: Database.Database, table: string, where: string, params: unknown[]): Row[] {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) {
    throw new Error(`Arkivet kræver tabellen ${table}; ingen delvis eksport må godkendes.`);
  }
  return db.prepare(`SELECT * FROM "${table}" WHERE ${where} ORDER BY id`).all(...params) as Row[];
}

function periodRows(db: Database.Database, table: string, dateColumn: string, companyId: number, start: string, end: string) {
  return rows(db, table, `company_id = ? AND "${dateColumn}" BETWEEN ? AND ?`, [companyId, start, end]);
}

export function childRows(db: Database.Database, table: string, parentColumn: string, ids: number[]) {
  if (!ids.length) return [];
  const result: Row[] = [];
  for (let offset = 0; offset < ids.length; offset += 900) {
    const part = ids.slice(offset, offset + 900);
    result.push(...rows(db, table, `"${parentColumn}" IN (${part.map(() => "?").join(",")})`, part));
  }
  return result.sort((a, b) => Number(a.id) - Number(b.id));
}

function ids(rows: Row[]): number[] {
  return rows.map((row) => Number(row.id));
}

function linkedDocumentRows(db: Database.Database, companyId: number, journalIds: number[], voucherIds: number[]): Row[] {
  const result = new Map<number, Row>();
  for (const [column, parentIds] of [["posted_journal_entry_id", journalIds], ["matched_voucher_id", voucherIds]] as const) {
    for (let offset = 0; offset < parentIds.length; offset += 899) {
      const part = parentIds.slice(offset, offset + 899);
      const found = rows(db, "document_inbox",
        `company_id = ? AND "${column}" IN (${part.map(() => "?").join(",")})`, [companyId, ...part]);
      for (const document of found) result.set(Number(document.id), document);
    }
  }
  return Array.from(result.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

/** Fælles udvælgelse af årsdata til de to arkivformater. */
export function selectRealBookkeepingRows(
  db: Database.Database,
  companyId: number,
  fiscalYearStart: string,
  referenceDate: string,
) {
  if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error("Ugyldigt virksomheds-ID.");
  const company = rows(db, "companies", "id = ?", [companyId])[0];
  if (!company) throw new Error("Virksomheden findes ikke.");
  const profiles = rows(db, "business_profiles", "company_id = ?", [companyId]);
  const profile = profiles.at(-1);
  if (!profile?.fiscal_year_start || profile.fiscal_year_start !== fiscalYearStart) {
    throw new Error("Regnskabsårets start skal svare til virksomhedens gemte brancheprofil.");
  }
  const period = archivePeriod(fiscalYearStart, referenceDate);
  const journalEntries = periodRows(db, "journal_entries", "date", companyId, period.start, period.end);
  const journalLines = childRows(db, "journal_lines", "journal_entry_id", ids(journalEntries));
  if (journalLines.some((line) => line.company_id !== companyId)) {
    throw new Error("En postering indeholder linjer fra en anden virksomhed.");
  }
  const invoices = periodRows(db, "invoices", "issue_date", companyId, period.start, period.end);
  const vouchers = periodRows(db, "vouchers", "date", companyId, period.start, period.end);
  const expenseReports = periodRows(db, "expense_reports", "date", companyId, period.start, period.end);
  const accountingFileObjects = periodRows(db, "file_objects", "created_at", companyId, period.start, `${period.end}T23:59:59.999Z`)
    .filter((item) => String(item.category || "").toLowerCase() === "bilag");
  const fileObjectVersions = childRows(db, "file_versions", "file_id", ids(accountingFileObjects));
  if (fileObjectVersions.some((version) => version.company_id !== companyId)) {
    throw new Error("En bilagsfilversion tilhører en anden virksomhed.");
  }
  const archiveRecords = periodRows(db, "archive_records", "date", companyId, period.start, period.end);
  if (archiveRecords.some((record) => record.archive_path)) {
    throw new Error("Arkivpost henviser til en ekstern fil, som endnu ikke er dækket af årsudtrækket.");
  }
  const creditNotes = periodRows(db, "credit_notes", "created_at", companyId, period.start, `${period.end}T23:59:59.999Z`);
  const bankTransactions = periodRows(db, "bank_transactions", "date", companyId, period.start, period.end);
  const vatPeriods = periodRows(db, "vat_periods", "created_at", companyId, period.start, `${period.end}T23:59:59.999Z`);
  const periodCloses = periodRows(db, "period_closes", "end_date", companyId, period.start, period.end);
  const einvoiceQueue = periodRows(db, "einvoice_queue", "created_at", companyId, period.start, `${period.end}T23:59:59.999Z`);
  // Et bilag modtaget i et tidligere år skal også bevares med det år, hvor
  // posteringen eller bilaget faktisk blev bogført/matchet.
  const documentInbox = Array.from(new Map([
    ...periodRows(db, "document_inbox", "created_at", companyId, period.start, `${period.end}T23:59:59.999Z`),
    ...linkedDocumentRows(db, companyId, ids(journalEntries), ids(vouchers)),
  ].map((document) => [Number(document.id), document])).values()).sort((a, b) => Number(a.id) - Number(b.id));
  if (!(journalEntries.length || invoices.length || vouchers.length || expenseReports.length || accountingFileObjects.length || archiveRecords.length || creditNotes.length
      || bankTransactions.length || vatPeriods.length || periodCloses.length || einvoiceQueue.length || documentInbox.length)) {
    throw new Error("Regnskabsåret indeholder ingen poster eller bilag; testen kan ikke bevise arkivering af rigtige data.");
  }
  return { period, journalEntries, journalLines, invoices, vouchers, expenseReports, accountingFileObjects,
    fileObjectVersions, archiveRecords, creditNotes, bankTransactions, vatPeriods, periodCloses, einvoiceQueue, documentInbox };
}

/** Et afgrænset, ægte bogføringsudtræk. Ikke en fuld juridisk dækningspåstand. */
export async function collectRealBookkeepingBundle(
  db: Database.Database,
  companyId: number,
  fiscalYearStart: string,
  referenceDate: string,
  fileReader: FileReader = productionFileReader,
) {
  const { period, journalEntries, journalLines, invoices, vouchers, expenseReports, accountingFileObjects,
    fileObjectVersions, archiveRecords, creditNotes, bankTransactions, vatPeriods, periodCloses, einvoiceQueue, documentInbox } =
    selectRealBookkeepingRows(db, companyId, fiscalYearStart, referenceDate);
  const files: Array<{ documentId: number; name: string; sha256: string; bytesBase64: string }> = [];
  const expenseFiles: Array<{ attachmentId: number; sha256: string; bytesBase64: string }> = [];
  const fileObjectFiles: Array<{ fileObjectId: number; sha256: string; bytesBase64: string }> = [];
  const fileObjectVersionFiles: Array<{ versionId: number; sha256: string; bytesBase64: string }> = [];
  let fileBytes = 0;
  for (const document of documentInbox) {
    const storage = String(document.storage || "");
    const key = String(document.storage_key || "");
    if (!storage || !key) throw new Error(`Bilag ${document.id} mangler originalfil; arkivering afbrydes.`);
    if (!key.startsWith(`${companyId}/`) || !/^\d+\/[A-Za-z0-9._-]+$/.test(key)) {
      throw new Error(`Bilag ${document.id} har en ugyldig eller fremmed filreference.`);
    }
    const bytes = await fileReader(storage, key);
    if (!bytes.length) throw new Error(`Bilag ${document.id} har en tom originalfil.`);
    fileBytes += bytes.length;
    if (fileBytes > 100 * 1024 * 1024) {
      throw new Error("Årsudtrækket er for stort til sikker samlet behandling; der kræves streaming/partitionering.");
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (document.content_hash && document.content_hash !== sha256) {
      throw new Error(`Bilag ${document.id} stemmer ikke med den oprindelige SHA-256.`);
    }
    files.push({ documentId: Number(document.id), name: String(document.file_name),
      sha256, bytesBase64: bytes.toString("base64") });
  }
  const receiptIds = expenseReports.filter((report) => report.receipt_image != null && report.receipt_image !== "")
    .map((report) => {
      const value = String(report.receipt_image);
      if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`Udlæg ${report.id} har en ugyldig kvitteringsreference.`);
      }
      return Number(value);
    });
  const expenseAttachments = childRows(db, "attachments", "id", Array.from(new Set(receiptIds)));
  if (expenseAttachments.length !== new Set(receiptIds).size
      || expenseAttachments.some((attachment) => attachment.company_id !== companyId)) {
    throw new Error("En udlægskvittering mangler eller tilhører en anden virksomhed.");
  }
  for (const attachment of expenseAttachments) {
    const key = String(attachment.storage_key || "");
    let bytes: Buffer;
    if (key) {
      if (!key.startsWith(`${companyId}/`) || !/^\d+\/[A-Za-z0-9._-]+$/.test(key)) {
        throw new Error(`Udlægskvittering ${attachment.id} har en ugyldig filreference.`);
      }
      bytes = await fileReader(String(attachment.storage || ""), key);
    } else if (attachment.data_url) {
      bytes = (await import("./files")).decodeDataUrl(String(attachment.data_url)).buffer;
    } else {
      throw new Error(`Udlægskvittering ${attachment.id} mangler originalfil.`);
    }
    if (!bytes.length || Number(attachment.size_bytes || 0) > 0 && bytes.length !== Number(attachment.size_bytes)) {
      throw new Error(`Udlægskvittering ${attachment.id} har forkert filstørrelse.`);
    }
    fileBytes += bytes.length;
    if (fileBytes > 100 * 1024 * 1024) {
      throw new Error("Årsudtrækket er for stort til sikker samlet behandling; der kræves streaming/partitionering.");
    }
    expenseFiles.push({ attachmentId: Number(attachment.id),
      sha256: createHash("sha256").update(bytes).digest("hex"), bytesBase64: bytes.toString("base64") });
  }
  for (const item of accountingFileObjects) {
    const location = parseStoredFileObjectPath(String(item.storage_path || ""), companyId);
    const bytes = await fileReader(location.storage, location.key);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!bytes.length || bytes.length !== Number(item.file_size) || sha256 !== item.checksum) {
      throw new Error(`Bilagsfil ${item.id} mangler eller stemmer ikke med checksum og størrelse.`);
    }
    fileBytes += bytes.length;
    if (fileBytes > 100 * 1024 * 1024) {
      throw new Error("Årsudtrækket er for stort til sikker samlet behandling; der kræves streaming/partitionering.");
    }
    fileObjectFiles.push({ fileObjectId: Number(item.id), sha256, bytesBase64: bytes.toString("base64") });
  }
  for (const version of fileObjectVersions) {
    const location = parseStoredFileObjectPath(String(version.storage_path || ""), companyId);
    const bytes = await fileReader(location.storage, location.key);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!bytes.length || sha256 !== version.checksum) {
      throw new Error(`Bilagsfilversion ${version.id} mangler eller har forkert checksum.`);
    }
    fileBytes += bytes.length;
    if (fileBytes > 100 * 1024 * 1024) {
      throw new Error("Årsudtrækket er for stort til sikker samlet behandling; der kræves streaming/partitionering.");
    }
    fileObjectVersionFiles.push({ versionId: Number(version.id), sha256, bytesBase64: bytes.toString("base64") });
  }
  const data = {
    format: "smartregnskab-bookkeeping-extract-v6",
    companyId, fiscalYear: { start: period.start, end: period.end },
    tables: {
      journalEntries,
      journalLines,
      invoices,
      invoiceItems: childRows(db, "invoice_items", "invoice_id", ids(invoices)),
      vouchers,
      expenseReports,
      expenseAttachments,
      accountingFileObjects,
      fileObjectVersions,
      archiveRecords,
      creditNotes,
      bankTransactions,
      vatPeriods,
      periodCloses,
      einvoiceQueue,
      documentInbox,
      // Kontoplanen er nødvendig for at fortolke konto-ID i posteringerne.
      accounts: rows(db, "accounts", "company_id = ?", [companyId]),
    },
    files,
    expenseFiles,
    fileObjectFiles,
    fileObjectVersionFiles,
  };
  const plain = Buffer.from(JSON.stringify(data), "utf8");
  if (plain.length > 150 * 1024 * 1024) {
    throw new Error("Årsudtrækket er for stort til sikker samlet behandling; der kræves streaming/partitionering.");
  }
  return { period, data, plain };
}

/** Kontrollerer, at en hentet arkivpakke kan fortolkes og genskabe alle registrerede bilagsbytes. */
export function validateRestoredBookkeepingBundle(plain: Buffer, companyId: number) {
  const bundle = JSON.parse(plain.toString("utf8")) as {
    format?: string; companyId?: number;
    tables?: Record<string, Row[]>;
    files?: Array<{ documentId: number; sha256: string; bytesBase64: string }>;
    expenseFiles?: Array<{ attachmentId: number; sha256: string; bytesBase64: string }>;
    fileObjectFiles?: Array<{ fileObjectId: number; sha256: string; bytesBase64: string }>;
    fileObjectVersionFiles?: Array<{ versionId: number; sha256: string; bytesBase64: string }>;
  };
  if (bundle.format !== "smartregnskab-bookkeeping-extract-v6" || bundle.companyId !== companyId
      || !bundle.tables || !Array.isArray(bundle.files) || !Array.isArray(bundle.expenseFiles)
      || !Array.isArray(bundle.fileObjectFiles) || !Array.isArray(bundle.fileObjectVersionFiles)) {
    throw new Error("Det gendannede arkiv har forkert format eller virksomhed.");
  }
  const names = ["journalEntries", "journalLines", "invoices", "invoiceItems", "vouchers", "expenseReports", "expenseAttachments", "accountingFileObjects", "fileObjectVersions", "archiveRecords",
    "creditNotes", "bankTransactions", "vatPeriods", "periodCloses", "einvoiceQueue", "documentInbox", "accounts"];
  for (const name of names) {
    if (!Array.isArray(bundle.tables[name])) throw new Error(`Det gendannede arkiv mangler ${name}.`);
  }
  for (const name of ["journalEntries", "invoices", "vouchers", "expenseReports", "expenseAttachments", "accountingFileObjects", "fileObjectVersions", "archiveRecords", "creditNotes", "bankTransactions",
    "vatPeriods", "periodCloses", "einvoiceQueue", "documentInbox", "accounts", "journalLines"]) {
    if (bundle.tables[name].some((row) => row.company_id !== companyId)) {
      throw new Error(`Det gendannede arkiv indeholder fremmede ${name}.`);
    }
  }
  const journalIds = new Set(bundle.tables.journalEntries.map((row) => Number(row.id)));
  const invoiceIds = new Set(bundle.tables.invoices.map((row) => Number(row.id)));
  if (bundle.tables.journalLines.some((row) => !journalIds.has(Number(row.journal_entry_id)))
      || bundle.tables.invoiceItems.some((row) => !invoiceIds.has(Number(row.invoice_id)))) {
    throw new Error("Gendannede linjer henviser til poster uden for virksomheden.");
  }
  const documents = new Set(bundle.tables.documentInbox.map((row) => Number(row.id)));
  if (documents.size !== bundle.files.length) throw new Error("Gendannede bilagsfiler og bilagsrækker stemmer ikke i antal.");
  const seenFiles = new Set<number>();
  for (const file of bundle.files) {
    if (!documents.has(file.documentId) || seenFiles.has(file.documentId)
        || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new Error("Gendannet bilagsfil har ugyldig reference eller hash.");
    }
    seenFiles.add(file.documentId);
    const bytes = Buffer.from(file.bytesBase64, "base64");
    if (!bytes.length || createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error("Gendannet bilagsfil bestod ikke SHA-256-kontrollen.");
    }
  }
  const receiptIds = new Set(bundle.tables.expenseReports.filter((report) => report.receipt_image != null && report.receipt_image !== "")
    .map((report) => Number(report.receipt_image)));
  const attachmentIds = new Set(bundle.tables.expenseAttachments.map((attachment) => Number(attachment.id)));
  if (receiptIds.size !== attachmentIds.size || bundle.expenseFiles.length !== attachmentIds.size
      || Array.from(receiptIds).some((id) => !attachmentIds.has(id))) {
    throw new Error("Gendannede udlæg og kvitteringer stemmer ikke i antal.");
  }
  const seenExpenseFiles = new Set<number>();
  const attachmentSizes = new Map(bundle.tables.expenseAttachments.map((attachment) =>
    [Number(attachment.id), Number(attachment.size_bytes || 0)]));
  for (const file of bundle.expenseFiles) {
    if (!attachmentIds.has(file.attachmentId) || seenExpenseFiles.has(file.attachmentId)
        || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new Error("Gendannet udlægskvittering har ugyldig reference eller hash.");
    }
    seenExpenseFiles.add(file.attachmentId);
    const bytes = Buffer.from(file.bytesBase64, "base64");
    if (!bytes.length || attachmentSizes.get(file.attachmentId)! > 0 && bytes.length !== attachmentSizes.get(file.attachmentId)
        || createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error("Gendannet udlægskvittering bestod ikke SHA-256-kontrollen.");
    }
  }
  const fileObjects = new Map(bundle.tables.accountingFileObjects.map((item) => [Number(item.id), item]));
  if (fileObjects.size !== bundle.fileObjectFiles.length) {
    throw new Error("Gendannede bilagsfilobjekter stemmer ikke i antal.");
  }
  const seenFileObjects = new Set<number>();
  for (const file of bundle.fileObjectFiles) {
    const item = fileObjects.get(file.fileObjectId);
    if (!item || seenFileObjects.has(file.fileObjectId) || file.sha256 !== item.checksum) {
      throw new Error("Gendannet bilagsfilobjekt har ugyldig reference eller checksum.");
    }
    seenFileObjects.add(file.fileObjectId);
    const bytes = Buffer.from(file.bytesBase64, "base64");
    if (!bytes.length || bytes.length !== Number(item.file_size)
        || createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error("Gendannet bilagsfilobjekt bestod ikke SHA-256-kontrollen.");
    }
  }
  const versions = new Map(bundle.tables.fileObjectVersions.map((version) => [Number(version.id), version]));
  if (versions.size !== bundle.fileObjectVersionFiles.length
      || Array.from(versions.values()).some((version) => !fileObjects.has(Number(version.file_id)))) {
    throw new Error("Gendannede bilagsfilversioner stemmer ikke med de oprindelige filer.");
  }
  const seenVersions = new Set<number>();
  for (const file of bundle.fileObjectVersionFiles) {
    const version = versions.get(file.versionId);
    if (!version || seenVersions.has(file.versionId) || file.sha256 !== version.checksum) {
      throw new Error("Gendannet bilagsfilversion har ugyldig reference eller checksum.");
    }
    seenVersions.add(file.versionId);
    const bytes = Buffer.from(file.bytesBase64, "base64");
    if (!bytes.length || createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error("Gendannet bilagsfilversion bestod ikke SHA-256-kontrollen.");
    }
  }
  return { companyId, counts: Object.fromEntries(names.map((name) => [name, bundle.tables![name].length])),
    fileCount: bundle.files.length + bundle.expenseFiles.length + bundle.fileObjectFiles.length + bundle.fileObjectVersionFiles.length };
}

/** Bevidst manuelt arkivløb: lagrer rigtige data, verificerer Object Lock og læser bytes tilbage. */
export async function archiveRealCompanyYear(input: {
  db: Database.Database; companyId: number; fiscalYearStart: string; referenceDate: string;
  fileReader?: FileReader;
  preparedBundle?: Awaited<ReturnType<typeof collectRealBookkeepingBundle>>;
}) {
  const config = archiveBucketConfig();
  const encryptionSecret = process.env.ARCHIVE_ENCRYPTION_KEY || "";
  await checkArchiveBucket(config);
  const { period, plain } = input.preparedBundle ?? await collectRealBookkeepingBundle(
    input.db, input.companyId, input.fiscalYearStart, input.referenceDate, input.fileReader,
  );
  const expectedPeriod = archivePeriod(input.fiscalYearStart, input.referenceDate);
  if (period.start !== expectedPeriod.start || period.end !== expectedPeriod.end
      || input.preparedBundle?.data.companyId !== undefined && input.preparedBundle.data.companyId !== input.companyId) {
    throw new Error("Det forberedte arkiv tilhører en anden virksomhed eller periode.");
  }
  const receipt = await storeLockedArchiveObject({
    config,
    key: `companies/${input.companyId}/fiscal-years/${period.start}/real-data/${randomUUID()}.json`,
    plain,
    retainUntil: period.retainUntil,
    encryptionSecret,
  });
  const restored = await readLockedArchiveObject({ config, receipt, encryptionSecret });
  if (!restored.equals(plain)) throw new Error("Gendannet arkiv er ikke identisk med kilden.");
  const recovered = validateRestoredBookkeepingBundle(restored, input.companyId);
  return { receipt, counts: recovered.counts, fileCount: recovered.fileCount, verified: true };
}

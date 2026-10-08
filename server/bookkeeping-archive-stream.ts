import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { decodeDataUrl } from "./files";
import { parseStoredFileObjectPath } from "./file-object-location";
import { archiveBucketConfig, archivePeriod, checkArchiveBucket } from "./bookkeeping-archive-readiness";
import { readSegmentedArchive, storeSegmentedArchive } from "./bookkeeping-archive-segments";
import type { ArchiveReceipt } from "./bookkeeping-archive-object";
import {
  childRows, productionFileReader, rows, selectRealBookkeepingRows,
  type FileReader, type Row,
} from "./bookkeeping-archive-real-data";

const CHUNK_BYTES = 256 * 1024;
const MAX_SINGLE_FILE = 64 * 1024 * 1024;
const MAX_LINE_BYTES = 24 * 1024 * 1024;
const TABLES = ["journalEntries", "journalLines", "invoices", "invoiceItems", "vouchers", "expenseReports",
  "expenseAttachments", "accountingFileObjects", "fileObjectVersions", "archiveRecords", "creditNotes",
  "bankTransactions", "vatPeriods", "periodCloses", "einvoiceQueue", "documentInbox", "accounts"] as const;
type Table = typeof TABLES[number];
type FileCollection = "files" | "expenseFiles" | "fileObjectFiles" | "fileObjectVersionFiles";

function line(value: unknown): Buffer { return Buffer.from(`${JSON.stringify(value)}\n`, "utf8"); }
function validId(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0; }

/** Et årsudtræk som én kanonisk NDJSON-strøm. Filer læses én ad gangen og
 * splittes i små poster; årsforbruget samles ikke i én JSON-buffer. */
export async function* streamRealBookkeepingYear(input: {
  db: Database.Database; companyId: number; fiscalYearStart: string; referenceDate: string;
  fileReader?: FileReader;
}): AsyncGenerator<Buffer> {
  const { db, companyId } = input;
  const selected = selectRealBookkeepingRows(db, companyId, input.fiscalYearStart, input.referenceDate);
  const receiptIds = selected.expenseReports.filter((report) => report.receipt_image != null && report.receipt_image !== "")
    .map((report) => {
      const value = String(report.receipt_image);
      if (!/^[1-9]\d*$/.test(value) || !validId(Number(value))) throw new Error(`Udlæg ${report.id} har en ugyldig kvitteringsreference.`);
      return Number(value);
    });
  const expenseAttachments = childRows(db, "attachments", "id", Array.from(new Set(receiptIds)));
  if (expenseAttachments.length !== new Set(receiptIds).size
      || expenseAttachments.some((attachment) => attachment.company_id !== companyId)) {
    throw new Error("En udlægskvittering mangler eller tilhører en anden virksomhed.");
  }
  const tables: Record<Table, Row[]> = {
    journalEntries: selected.journalEntries, journalLines: selected.journalLines,
    invoices: selected.invoices, invoiceItems: childRows(db, "invoice_items", "invoice_id", selected.invoices.map((row) => Number(row.id))),
    vouchers: selected.vouchers, expenseReports: selected.expenseReports, expenseAttachments,
    accountingFileObjects: selected.accountingFileObjects, fileObjectVersions: selected.fileObjectVersions,
    archiveRecords: selected.archiveRecords, creditNotes: selected.creditNotes,
    bankTransactions: selected.bankTransactions, vatPeriods: selected.vatPeriods,
    periodCloses: selected.periodCloses, einvoiceQueue: selected.einvoiceQueue,
    documentInbox: selected.documentInbox, accounts: rows(db, "accounts", "company_id = ?", [companyId]),
  };
  yield line({ kind: "header", format: "smartregnskab-bookkeeping-stream-v1", companyId,
    fiscalYear: { start: selected.period.start, end: selected.period.end } });
  for (const table of TABLES) {
    for (const row of tables[table]) yield line({ kind: "row", table, row });
  }

  const fileReader = input.fileReader ?? productionFileReader;
  async function* emitFile(collection: FileCollection, id: number, bytes: Buffer, expectedHash?: string): AsyncGenerator<Buffer> {
    if (!bytes.length || bytes.length > MAX_SINGLE_FILE) throw new Error(`Arkivfil ${collection}/${id} er tom eller over 64 MB.`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (expectedHash && expectedHash !== sha256) throw new Error(`Arkivfil ${collection}/${id} bestod ikke SHA-256-kontrollen.`);
    yield line({ kind: "fileStart", collection, id, sha256, size: bytes.length });
    for (let offset = 0, index = 0; offset < bytes.length; offset += CHUNK_BYTES, index++) {
      yield line({ kind: "fileChunk", index, bytesBase64: bytes.subarray(offset, offset + CHUNK_BYTES).toString("base64") });
    }
    yield line({ kind: "fileEnd" });
  }
  for (const document of selected.documentInbox) {
    const storage = String(document.storage || "");
    const key = String(document.storage_key || "");
    if (!storage || !key || !key.startsWith(`${companyId}/`) || !/^\d+\/[A-Za-z0-9._-]+$/.test(key)) {
      throw new Error(`Bilag ${document.id} mangler en gyldig virksomhedsafgrænset originalfil.`);
    }
    const bytes = await fileReader(storage, key);
    yield* emitFile("files", Number(document.id), bytes, document.content_hash ? String(document.content_hash) : undefined);
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
      bytes = decodeDataUrl(String(attachment.data_url)).buffer;
    } else throw new Error(`Udlægskvittering ${attachment.id} mangler originalfil.`);
    if (Number(attachment.size_bytes || 0) > 0 && bytes.length !== Number(attachment.size_bytes)) {
      throw new Error(`Udlægskvittering ${attachment.id} har forkert filstørrelse.`);
    }
    yield* emitFile("expenseFiles", Number(attachment.id), bytes);
  }
  for (const item of selected.accountingFileObjects) {
    const location = parseStoredFileObjectPath(String(item.storage_path || ""), companyId);
    const bytes = await fileReader(location.storage, location.key);
    if (bytes.length !== Number(item.file_size)) throw new Error(`Bilagsfil ${item.id} har forkert filstørrelse.`);
    yield* emitFile("fileObjectFiles", Number(item.id), bytes, String(item.checksum || ""));
  }
  for (const version of selected.fileObjectVersions) {
    const location = parseStoredFileObjectPath(String(version.storage_path || ""), companyId);
    const bytes = await fileReader(location.storage, location.key);
    yield* emitFile("fileObjectVersionFiles", Number(version.id), bytes, String(version.checksum || ""));
  }
}

/** Incremental restore checker. Push only bytes read from verified locked parts;
 * never apply streamed rows/files to a live database before finish succeeds. */
export class BookkeepingStreamValidator {
  private pending = Buffer.alloc(0);
  private header = false;
  private filesStarted = false;
  private active: { collection: FileCollection; id: number; size: number; sha256: string; hash: ReturnType<typeof createHash>; count: number; nextIndex: number } | null = null;
  private tables = Object.fromEntries(TABLES.map((name) => [name, new Map<number, Row>()])) as Record<Table, Map<number, Row>>;
  private seenFiles = { files: new Set<number>(), expenseFiles: new Set<number>(), fileObjectFiles: new Set<number>(), fileObjectVersionFiles: new Set<number>() };
  private expectedCompanyId: number;
  private expectedFiscalYearStart: string;

  constructor(companyId: number, fiscalYearStart: string) {
    this.expectedCompanyId = companyId;
    this.expectedFiscalYearStart = fiscalYearStart;
  }

  push(bytes: Buffer) {
    this.pending = Buffer.concat([this.pending, bytes]);
    while (true) {
      const end = this.pending.indexOf(10);
      if (end < 0) break;
      if (end > MAX_LINE_BYTES) throw new Error("Arkivposten er for stor.");
      const value = JSON.parse(this.pending.subarray(0, end).toString("utf8")) as Record<string, unknown>;
      this.pending = this.pending.subarray(end + 1);
      this.accept(value);
    }
    if (this.pending.length > MAX_LINE_BYTES) throw new Error("Arkivposten er for stor.");
  }

  private accept(value: Record<string, unknown>) {
    if (!this.header) {
      if (value.kind !== "header" || value.format !== "smartregnskab-bookkeeping-stream-v1"
          || value.companyId !== this.expectedCompanyId
          || (value.fiscalYear as Record<string, unknown> | undefined)?.start !== this.expectedFiscalYearStart
          || (value.fiscalYear as Record<string, unknown> | undefined)?.end !== archivePeriod(this.expectedFiscalYearStart, this.expectedFiscalYearStart).end) {
        throw new Error("Arkivstrømmen tilhører en anden virksomhed, et andet år eller et andet format.");
      }
      this.header = true;
      return;
    }
    if (value.kind === "row") {
      if (this.filesStarted || this.active || !TABLES.includes(value.table as Table)) throw new Error("Ugyldig tabelrækkefølge i arkivet.");
      const table = value.table as Table;
      const row = value.row as Row;
      if (!row || !validId(row.id) || table !== "invoiceItems" && row.company_id !== this.expectedCompanyId
          || this.tables[table].has(Number(row.id))) throw new Error(`Ugyldig eller fremmed række i ${table}.`);
      this.tables[table].set(Number(row.id), row);
      return;
    }
    if (value.kind === "fileStart") {
      this.filesStarted = true;
      if (this.active || !["files", "expenseFiles", "fileObjectFiles", "fileObjectVersionFiles"].includes(String(value.collection))
          || !validId(value.id) || !validId(value.size) || Number(value.size) > MAX_SINGLE_FILE
          || !/^[a-f0-9]{64}$/i.test(String(value.sha256 || ""))) throw new Error("Ugyldig filstart i arkivet.");
      const collection = value.collection as FileCollection;
      if (this.seenFiles[collection].has(Number(value.id))) throw new Error("Duplikeret arkivfil.");
      this.active = { collection, id: Number(value.id), size: Number(value.size), sha256: String(value.sha256),
        hash: createHash("sha256"), count: 0, nextIndex: 0 };
      return;
    }
    if (value.kind === "fileChunk") {
      const active = this.active;
      if (!active || value.index !== active.nextIndex || typeof value.bytesBase64 !== "string"
          || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.bytesBase64)) {
        throw new Error("Ugyldig eller ombyttet fil-del i arkivet.");
      }
      const chunk = Buffer.from(value.bytesBase64, "base64");
      if (!chunk.length || chunk.length > CHUNK_BYTES || active.count + chunk.length > active.size) throw new Error("Fil-delen har ugyldig størrelse.");
      active.hash.update(chunk);
      active.count += chunk.length;
      active.nextIndex++;
      return;
    }
    if (value.kind === "fileEnd") {
      const active = this.active;
      if (!active || active.count !== active.size || active.hash.digest("hex") !== active.sha256) {
        throw new Error("Arkivfilen bestod ikke checksumkontrollen.");
      }
      const associated: Table = active.collection === "files" ? "documentInbox"
        : active.collection === "expenseFiles" ? "expenseAttachments"
          : active.collection === "fileObjectFiles" ? "accountingFileObjects" : "fileObjectVersions";
      const row = this.tables[associated].get(active.id);
      if (!row || active.collection === "fileObjectFiles" && (row.checksum !== active.sha256 || row.file_size !== active.size)
          || active.collection === "fileObjectVersionFiles" && row.checksum !== active.sha256
          || active.collection === "expenseFiles" && Number(row.size_bytes || 0) > 0 && Number(row.size_bytes) !== active.size
          || active.collection === "files" && row.content_hash && row.content_hash !== active.sha256) {
        throw new Error("Arkivfilen stemmer ikke med sin tabelrække.");
      }
      this.seenFiles[active.collection].add(active.id);
      this.active = null;
      return;
    }
    throw new Error("Ukendt posttype i arkivet.");
  }

  finish() {
    if (!this.header || this.pending.length || this.active) throw new Error("Arkivstrømmen blev afbrudt.");
    if (!["journalEntries", "invoices", "vouchers", "expenseReports", "accountingFileObjects", "archiveRecords",
      "creditNotes", "bankTransactions", "vatPeriods", "periodCloses", "einvoiceQueue", "documentInbox"]
      .some((table) => this.tables[table as Table].size > 0)) {
      throw new Error("Arkivstrømmen indeholder ingen bogføringsposter eller bilag.");
    }
    const journalIds = this.tables.journalEntries;
    const invoiceIds = this.tables.invoices;
    if (Array.from(this.tables.journalLines.values()).some((row) => !journalIds.has(Number(row.journal_entry_id)))
        || Array.from(this.tables.invoiceItems.values()).some((row) => !invoiceIds.has(Number(row.invoice_id)))
        || Array.from(this.tables.fileObjectVersions.values()).some((row) => !this.tables.accountingFileObjects.has(Number(row.file_id)))) {
      throw new Error("Arkivet indeholder linjer eller versioner uden en tilhørende hovedpost.");
    }
    const receiptIds = new Set(Array.from(this.tables.expenseReports.values())
      .filter((row) => row.receipt_image != null && row.receipt_image !== "").map((row) => Number(row.receipt_image)));
    if (receiptIds.size !== this.tables.expenseAttachments.size
        || Array.from(receiptIds).some((id) => !this.tables.expenseAttachments.has(id))) {
      throw new Error("Arkivets udlæg og kvitteringer stemmer ikke.");
    }
    for (const [collection, table] of [
      ["files", "documentInbox"], ["expenseFiles", "expenseAttachments"],
      ["fileObjectFiles", "accountingFileObjects"], ["fileObjectVersionFiles", "fileObjectVersions"],
    ] as const) {
      if (this.seenFiles[collection].size !== this.tables[table].size
          || Array.from(this.tables[table].keys()).some((id) => !this.seenFiles[collection].has(id))) {
        throw new Error(`Arkivets ${collection} stemmer ikke med tabelrækkerne.`);
      }
    }
    return { counts: Object.fromEntries(TABLES.map((table) => [table, this.tables[table].size])),
      fileCount: Object.values(this.seenFiles).reduce((sum, entries) => sum + entries.size, 0) };
  }
}

export type StreamedArchiveFingerprint = {
  companyId: number; fiscalYearStart: string; referenceDate: string;
  sourceSha256: string; sourceBytes: number; counts: Record<string, number>; fileCount: number;
};
export type SegmentedBookkeepingReceipt = {
  format: "smartregnskab-segmented-receipt-v1";
  sourceSha256: string;
  manifestReceipt: ArchiveReceipt;
};

/** Første læsning kontrollerer datakilderne og giver ugejobbet et stabilt
 * fingeraftryk. Anden læsning ved arkivering skal matche præcist. */
export async function fingerprintRealBookkeepingYear(input: {
  db: Database.Database; companyId: number; fiscalYearStart: string; referenceDate: string;
  fileReader?: FileReader;
}): Promise<StreamedArchiveFingerprint> {
  const validator = new BookkeepingStreamValidator(input.companyId,
    archivePeriod(input.fiscalYearStart, input.referenceDate).start);
  const hash = createHash("sha256");
  let sourceBytes = 0;
  for await (const chunk of streamRealBookkeepingYear(input)) {
    hash.update(chunk);
    sourceBytes += chunk.length;
    if (!Number.isSafeInteger(sourceBytes)) throw new Error("Årsudtrækket er for stort til sikker byteoptælling.");
    validator.push(chunk);
  }
  const recovered = validator.finish();
  return { companyId: input.companyId, fiscalYearStart: input.fiscalYearStart,
    referenceDate: input.referenceDate, sourceSha256: hash.digest("hex"), sourceBytes,
    counts: recovered.counts, fileCount: recovered.fileCount };
}

/** Ny årsarkivering: segmenteret, krypteret og låst. Ugejobbet kan sende sit
 * tidligere fingerprint; ændrede filbytes mellem læsningerne afvises. */
export async function archiveRealCompanyYearStream(input: {
  db: Database.Database; companyId: number; fiscalYearStart: string; referenceDate: string;
  fileReader?: FileReader; preparedFingerprint?: StreamedArchiveFingerprint;
}) {
  const period = archivePeriod(input.fiscalYearStart, input.referenceDate);
  const prepared = input.preparedFingerprint ?? await fingerprintRealBookkeepingYear(input);
  if (prepared.companyId !== input.companyId || prepared.sourceBytes < 1
      || prepared.fiscalYearStart !== input.fiscalYearStart || prepared.referenceDate !== input.referenceDate) {
    throw new Error("Det forberedte årsudtræk tilhører en anden virksomhed eller periode.");
  }
  const config = archiveBucketConfig();
  const encryptionSecret = process.env.ARCHIVE_ENCRYPTION_KEY || "";
  await checkArchiveBucket(config);
  const stored = await storeSegmentedArchive({
    config, prefix: `companies/${input.companyId}/fiscal-years/${period.start}/real-data/${randomUUID()}`,
    source: streamRealBookkeepingYear(input), retainUntil: period.retainUntil, encryptionSecret,
    expectedSourceSha256: prepared.sourceSha256, expectedSourceBytes: prepared.sourceBytes,
  });
  if (stored.sourceSha256 !== prepared.sourceSha256 || stored.sourceBytes !== prepared.sourceBytes) {
    throw new Error("Årsudtrækket ændrede sig mellem forberedelse og arkivering.");
  }
  const validator = new BookkeepingStreamValidator(input.companyId, period.start);
  const restored = await readSegmentedArchive({ config, receipt: stored.receipt, encryptionSecret,
    expectedCompanyId: input.companyId, expectedFiscalYearStart: period.start,
    sink: async (part) => { validator.push(part); },
  });
  if (restored.sourceSha256 !== prepared.sourceSha256) throw new Error("Gendannet arkiv har forkert kildehash.");
  const recovered = validator.finish();
  if (JSON.stringify(recovered.counts) !== JSON.stringify(prepared.counts)
      || recovered.fileCount !== prepared.fileCount) {
    throw new Error("Gendannet arkiv indeholder andre rækker eller filer end kilden.");
  }
  const receipt: SegmentedBookkeepingReceipt = {
    format: "smartregnskab-segmented-receipt-v1", sourceSha256: stored.sourceSha256,
    manifestReceipt: stored.receipt,
  };
  return { receipt, counts: recovered.counts, fileCount: recovered.fileCount, verified: true };
}

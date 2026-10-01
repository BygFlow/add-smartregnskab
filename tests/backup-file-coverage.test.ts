import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { referencedS3Files } from "../server/backup-service";

test("backup includes each referenced S3 original only once", () => {
  const snapshot = new Database(":memory:");
  try {
    for (const table of ["attachments", "document_inbox", "add_connect_invoice_documents"])
      snapshot.exec(`CREATE TABLE ${table} (storage TEXT, storage_key TEXT)`);
    snapshot.prepare("INSERT INTO attachments VALUES (?, ?)").run("s3", "1/invoice.pdf");
    snapshot.prepare("INSERT INTO document_inbox VALUES (?, ?)").run("s3", "1/invoice.pdf");
    snapshot.prepare("INSERT INTO add_connect_invoice_documents VALUES (?, ?)").run("s3", "2/original.xml");
    snapshot.prepare("INSERT INTO attachments VALUES (?, ?)").run("disk", "3/local.pdf");
    assert.deepEqual(referencedS3Files(snapshot), ["1/invoice.pdf", "2/original.xml"]);
  } finally { snapshot.close(); }
});

test("backup refuses unsafe references and an unreadable storage schema", () => {
  const snapshot = new Database(":memory:");
  try {
    snapshot.exec("CREATE TABLE attachments (storage TEXT, storage_key TEXT)");
    snapshot.prepare("INSERT INTO attachments VALUES (?, ?)").run("s3", "../other-tenant.pdf");
    assert.throws(() => referencedS3Files(snapshot), /Ugyldig S3-filreference/);
    snapshot.exec("DROP TABLE attachments; CREATE TABLE attachments (storage TEXT)");
    assert.throws(() => referencedS3Files(snapshot), /kan ikke kontrolleres/);
  } finally { snapshot.close(); }
});

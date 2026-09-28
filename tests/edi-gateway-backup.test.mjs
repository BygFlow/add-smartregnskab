import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

test("EDI backup creates a verified copy without altering the source", () => {
  const root = mkdtempSync(join(tmpdir(), "edi-gateway-backup-test-"));
  const sourcePath = join(root, "gateway.db");
  const backupDir = join(root, "backups");
  try {
    const source = new Database(sourcePath);
    source.exec("CREATE TABLE edi_gateway_tenants (id INTEGER PRIMARY KEY); CREATE TABLE edi_gateway_documents (id INTEGER PRIMARY KEY, payload_xml TEXT); CREATE TABLE edi_gateway_webhook_events (id INTEGER PRIMARY KEY)");
    source.prepare("INSERT INTO edi_gateway_documents (payload_xml) VALUES (?)").run("<Invoice>Original</Invoice>");
    source.close();
    const run = spawnSync(process.execPath, ["scripts/edi-gateway-backup.mjs"], {
      cwd: resolve(import.meta.dirname, ".."), encoding: "utf8",
      env: { ...process.env, EDI_GATEWAY_DATABASE_PATH: sourcePath, EDI_GATEWAY_BACKUP_DIR: backupDir },
    });
    assert.equal(run.status, 0, run.stderr);
    const files = readdirSync(backupDir);
    assert.equal(files.length, 1);
    const copy = new Database(join(backupDir, files[0]), { readonly: true, fileMustExist: true });
    assert.equal(copy.prepare("SELECT payload_xml FROM edi_gateway_documents").get().payload_xml, "<Invoice>Original</Invoice>");
    assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    copy.close();
  } finally {
    // This path was created by mkdtempSync for this test, never a user folder.
    assert.ok(realpathSync(root).startsWith(realpathSync(tmpdir())));
    rmSync(root, { recursive: true, force: true });
  }
});

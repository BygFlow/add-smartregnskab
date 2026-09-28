import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { auditEdiCutover } from "../services/edi-gateway/cutover-audit.mjs";

test("read-only cutover audit detects unresolved documents and child mismatch", () => {
  const root = mkdtempSync(join(tmpdir(), "edi-cutover-audit-test-"));
  const legacyPath = join(root, "legacy.db");
  const gatewayPath = join(root, "gateway.db");
  const childA = "00000000-0000-4000-8000-000000000001";
  const childB = "00000000-0000-4000-8000-000000000002";
  try {
    const legacy = new Database(legacyPath);
    legacy.exec(`CREATE TABLE companies (id INTEGER PRIMARY KEY, cvr TEXT);
      CREATE TABLE einvoice_queue (company_id INTEGER, direction TEXT, status TEXT, routing_status TEXT, provider_message_id TEXT, payload_xml TEXT);
      INSERT INTO companies (id, cvr) VALUES (1, '12345678');
      INSERT INTO einvoice_queue VALUES (1, 'udgående', 'indsendt', 'indsendt', 'msg-1', '<Invoice/>');
      INSERT INTO einvoice_queue VALUES (1, 'indgående', 'modtaget', 'modtaget', 'msg-2', '<Invoice/>');`);
    legacy.close();
    const gateway = new Database(gatewayPath);
    gateway.exec(`CREATE TABLE edi_gateway_tenants (id INTEGER PRIMARY KEY, product TEXT, source_tenant_id TEXT, cvr TEXT, sproom_child_id TEXT, active INTEGER, receive_enabled INTEGER);
      CREATE TABLE edi_gateway_documents (tenant_id INTEGER, direction TEXT, status TEXT, provider_message_id TEXT);
      CREATE TABLE edi_gateway_webhook_events (status TEXT);
      INSERT INTO edi_gateway_tenants VALUES (1, 'smartregnskab', '1', '12345678', '${childB}', 0, 0);
      INSERT INTO edi_gateway_documents VALUES (1, 'outbound', 'submitted', 'msg-1');
      INSERT INTO edi_gateway_webhook_events VALUES ('pending');`);
    gateway.close();
    const report = auditEdiCutover(legacyPath, gatewayPath, { companyMap: JSON.stringify({ 1: childA }), gatewayKeys: "{}" });
    assert.equal(report.cutoverPerformed, false);
    assert.equal(report.companies[0].unresolvedOutbound, 1);
    assert.equal(report.companies[0].overlap, 1);
    assert.equal(report.companies[0].legacyOriginals, 2);
    assert.equal(report.gatewayWebhookQueue.pending, 1);
    assert.ok(report.companies[0].blockers.some(value => value.includes("forskellige")));
    assert.ok(report.companies[0].blockers.some(value => value.includes("afstemning")));
    assert.ok(report.companies[0].blockers.some(value => value.includes("gateway-nøgle")));
    assert.throws(() => auditEdiCutover(legacyPath, legacyPath), /adskilt/);
    assert.throws(() => auditEdiCutover(legacyPath, gatewayPath, { companyMap: "[1]" }), /JSON-objekt/);
    const check = new Database(legacyPath, { readonly: true });
    assert.equal(check.prepare("SELECT COUNT(*) AS n FROM einvoice_queue").get().n, 2);
    check.close();
  } finally {
    assert.equal(dirname(realpathSync(root)), realpathSync(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

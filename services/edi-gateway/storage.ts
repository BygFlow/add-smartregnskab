import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const path = process.env.EDI_GATEWAY_DATABASE_PATH;
if (!path) throw new Error("EDI_GATEWAY_DATABASE_PATH skal pege på en separat, persistent database.");
if (process.env.NODE_ENV === "production" && path === ":memory:") throw new Error("EDI-gatewayen kræver persistent lagring i produktion.");
const absolutePath = path === ":memory:" ? path : resolve(path);
if (absolutePath !== ":memory:" && absolutePath === resolve(process.env.DATABASE_PATH || "data.db")) {
  throw new Error("EDI-gatewayen må ikke bruge SmartRegnskabs database.");
}
if (absolutePath !== ":memory:") mkdirSync(dirname(absolutePath), { recursive: true });
const sqlite = new Database(absolutePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS edi_gateway_tenants (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    product text NOT NULL,
    source_tenant_id text NOT NULL,
    cvr text NOT NULL,
    company_name text NOT NULL,
    sproom_child_id text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    active integer DEFAULT 0 NOT NULL,
    receive_enabled integer DEFAULT 0 NOT NULL,
    onboarding_evidence text,
    activated_at text,
    created_at text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS edi_gateway_tenant_source_unique
    ON edi_gateway_tenants (product, source_tenant_id);
  CREATE UNIQUE INDEX IF NOT EXISTS edi_gateway_tenant_key_prefix_unique
    ON edi_gateway_tenants (key_prefix);
  CREATE UNIQUE INDEX IF NOT EXISTS edi_gateway_one_inbound_receiver_per_child
    ON edi_gateway_tenants (sproom_child_id) WHERE receive_enabled = 1;
  CREATE TABLE IF NOT EXISTS edi_gateway_documents (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    tenant_id integer NOT NULL REFERENCES edi_gateway_tenants(id),
    source_id text NOT NULL,
    direction text NOT NULL,
    format text NOT NULL,
    document_type text NOT NULL,
    invoice_number text,
    issuer_cvr text,
    recipient text,
    payload_xml text NOT NULL,
    sha256 text NOT NULL,
    provider_message_id text,
    status text NOT NULL,
    error text,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS edi_gateway_document_source_unique
    ON edi_gateway_documents (tenant_id, direction, source_id);
  CREATE TABLE IF NOT EXISTS edi_gateway_webhook_events (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    body_hash text NOT NULL UNIQUE,
    body_json text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at integer NOT NULL DEFAULT 0,
    locked_until integer NOT NULL DEFAULT 0,
    last_error text,
    received_at text NOT NULL,
    completed_at text
  );
  CREATE INDEX IF NOT EXISTS edi_gateway_webhook_due_idx
    ON edi_gateway_webhook_events (status, next_attempt_at, id);
`);
const documentColumns = sqlite.pragma("table_info(edi_gateway_documents)") as Array<{ name: string }>;
const tenantColumns = sqlite.pragma("table_info(edi_gateway_tenants)") as Array<{ name: string }>;
if (!tenantColumns.some(column => column.name === "onboarding_evidence")) sqlite.exec("ALTER TABLE edi_gateway_tenants ADD COLUMN onboarding_evidence text");
if (!tenantColumns.some(column => column.name === "activated_at")) sqlite.exec("ALTER TABLE edi_gateway_tenants ADD COLUMN activated_at text");
if (!documentColumns.some(column => column.name === "issuer_cvr")) sqlite.exec("ALTER TABLE edi_gateway_documents ADD COLUMN issuer_cvr text");
sqlite.exec(`UPDATE edi_gateway_documents SET issuer_cvr = (
  SELECT cvr FROM edi_gateway_tenants WHERE edi_gateway_tenants.id = edi_gateway_documents.tenant_id
) WHERE direction = 'outbound' AND issuer_cvr IS NULL`);
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS edi_gateway_issuer_invoice_unique
  ON edi_gateway_documents (issuer_cvr, invoice_number)
  WHERE direction = 'outbound' AND issuer_cvr IS NOT NULL AND invoice_number IS NOT NULL`);

export const db = drizzle(sqlite);
export const gatewaySqlite = sqlite;
export function closeGatewayDatabase() { sqlite.close(); }

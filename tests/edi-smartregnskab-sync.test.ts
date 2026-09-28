import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";

process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = ":memory:";
process.env.EDI_GATEWAY_DATABASE_PATH = ":memory:";
const { db, storage } = await import("../server/storage");
const { db: gatewayDb } = await import("../services/edi-gateway/storage");
const { registerPublicEdiGatewayRoutes } = await import("../services/edi-gateway/routes");
const { syncGatewayInboundForCompany } = await import("../server/edi-gateway-sync");
const { ediGatewayTenants, ediGatewayDocuments, einvoiceQueue } = await import("../shared/schema");

test("SmartRegnskab imports one gateway original only for the matching CVR and rejects altered XML", async () => {
  const company = await storage.createCompany({ name: "Fiktivt regnskab", cvr: "12345678", createdAt: new Date().toISOString() } as any);
  const other = await storage.createCompany({ name: "Anden virksomhed", cvr: "87654321", createdAt: new Date().toISOString() } as any);
  const key = `edi_${"a".repeat(64)}`;
  const tenant = gatewayDb.insert(ediGatewayTenants).values({ product: "smartregnskab", sourceTenantId: String(company.id), cvr: "12345678",
    companyName: "Fiktivt regnskab", sproomChildId: "00000000-0000-4000-8000-000000000001",
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: key.slice(0, 16), active: 1, receiveEnabled: 1,
    createdAt: new Date().toISOString() }).returning().get();
  const xml = `<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>TEST-EDI-1</cbc:ID><cbc:PayableAmount currencyID="DKK">125.00</cbc:PayableAmount></Invoice>`;
  gatewayDb.insert(ediGatewayDocuments).values({ tenantId: tenant.id, sourceId: "sproom-doc-1", direction: "inbound", format: "OIOUBL_2_1",
    documentType: "invoice", payloadXml: xml, sha256: createHash("sha256").update(xml).digest("hex"),
    providerMessageId: "sproom-doc-1", status: "received", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).run();
  const app = express();
  registerPublicEdiGatewayRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    process.env.EDI_GATEWAY_URL = `http://127.0.0.1:${address.port}`;
    process.env.EDI_GATEWAY_KEYS_JSON = JSON.stringify({ [company.id]: key, [other.id]: key });
    assert.equal(await syncGatewayInboundForCompany(company.id), 1);
    assert.equal(await syncGatewayInboundForCompany(company.id), 0);
    assert.equal(db.select().from(einvoiceQueue).where(eq(einvoiceQueue.companyId, company.id)).all().length, 1);
    await assert.rejects(syncGatewayInboundForCompany(other.id), /tilhører ikke/);
    assert.equal(db.select().from(einvoiceQueue).where(eq(einvoiceQueue.companyId, other.id)).all().length, 0);
    gatewayDb.insert(ediGatewayDocuments).values({ tenantId: tenant.id, sourceId: "sproom-doc-2", direction: "inbound", format: "OIOUBL_2_1",
      documentType: "invoice", payloadXml: xml, sha256: "0".repeat(64), providerMessageId: "sproom-doc-2", status: "received",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).run();
    await assert.rejects(syncGatewayInboundForCompany(company.id), /kontrolsum/);
    assert.equal(db.select().from(einvoiceQueue).where(eq(einvoiceQueue.companyId, company.id)).all().length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

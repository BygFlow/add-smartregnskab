import type { Express, Request, Response, NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { ediGatewayDocuments, ediGatewayTenants } from "../../shared/schema";
import { requireGatewayAdmin } from "./security";
import { db } from "./storage";
import { reconcileSproomDocuments } from "./reconciliation";
import { generateEInvoice, providerValidate, sproomChildCompanyToken, sproomDownloadChildDocument, sproomSendForChild, type EInvoiceFormat } from "../../server/einvoice";

const run = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const product = z.enum(["smartregnskab", "smartdrift_pro", "smartdrift_clean"]);
const provision = z.object({
  product, sourceTenantId: z.string().min(1).max(100), cvr: z.string().regex(/^\d{8}$/),
  companyName: z.string().min(1).max(200), sproomChildId: z.string().uuid(),
}).strict();
const send = z.object({
  sourceId: z.string().min(1).max(120), format: z.enum(["OIOUBL_2_1", "PEPPOL_BIS_3"]),
  invoiceNumber: z.string().min(1).max(80), issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), currency: z.literal("DKK"),
  customer: z.object({ name: z.string().min(1).max(200), cvr: z.string().regex(/^\d{8}$/).optional(), ean: z.string().regex(/^\d{13}$/).optional() }).refine(v => v.cvr || v.ean, "Modtager-CVR eller EAN kræves"),
  lines: z.array(z.object({ description: z.string().min(1).max(500), quantity: z.number().positive(), unitPrice: z.number().nonnegative(), vatRate: z.number().min(0).max(100) })).min(1).max(1000),
}).strict();

function tenantFor(req: Request) {
  const token = String(req.headers.authorization || "").match(/^Bearer (.+)$/i)?.[1] || "";
  if (!/^edi_[a-f0-9]{64}$/.test(token)) return null;
  const hash = digest(token);
  const row = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.keyPrefix, token.slice(0, 16))).get();
  if (!row || !/^[a-f0-9]{64}$/.test(row.keyHash) || !timingSafeEqual(Buffer.from(hash), Buffer.from(row.keyHash))) return null;
  return row;
}

export function registerPublicEdiGatewayRoutes(app: Express) {
  app.get("/api/edi-gateway/me", run(async (req, res) => {
    const tenant = tenantFor(req);
    if (!tenant) return void res.status(401).json({ error: "Ugyldig EDI-adgangsnøgle." });
    res.json({ product: tenant.product, sourceTenantId: tenant.sourceTenantId, cvr: tenant.cvr,
      sproomChildId: tenant.sproomChildId, active: Boolean(tenant.active), receiveEnabled: Boolean(tenant.receiveEnabled) });
  }));
  app.post("/api/edi-gateway/send", run(async (req, res) => {
    const tenant = tenantFor(req);
    if (!tenant) return void res.status(401).json({ error: "Ugyldig EDI-adgangsnøgle." });
    if (!tenant.active) return void res.status(403).json({ error: "EDI er ikke aktiveret for virksomheden." });
    if (!process.env.SPROOM_API_TOKEN || !process.env.EINVOICE_VALIDATOR_URL) return void res.status(503).json({ error: "Sproom og ekstern XML-validering skal være konfigureret før afsendelse." });
    const parsed = send.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Fakturadata er ugyldige.", details: parsed.error.flatten() });
    const value = parsed.data;
    const round2 = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
    const net = round2(value.lines.reduce((sum, line) => sum + round2(line.quantity * line.unitPrice), 0));
    const vat = round2(value.lines.reduce((sum, line) => sum + round2(round2(line.quantity * line.unitPrice) * line.vatRate / 100), 0));
    const document = generateEInvoice({
      company: { name: tenant.companyName, cvr: tenant.cvr, currency: value.currency } as any,
      customer: value.customer as any,
      invoice: { invoiceNumber: value.invoiceNumber, issueDate: value.issueDate, dueDate: value.dueDate, netAmount: net, vatAmount: vat, totalAmount: net + vat } as any,
      items: value.lines.map(line => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, amount: round2(line.quantity * line.unitPrice), vatRate: line.vatRate })) as any,
      format: value.format as EInvoiceFormat,
    });
    const errors = await providerValidate(document.xml, value.format);
    if (errors.length) return void res.status(422).json({ error: "E-fakturaen kunne ikke valideres.", details: errors });
    const hash = digest(document.xml);
    const previous = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.direction, "outbound"), eq(ediGatewayDocuments.sourceId, value.sourceId))).get();
    if (previous) return void res.status(previous.sha256 === hash ? 200 : 409).json(previous.sha256 === hash
      ? { id: previous.id, status: previous.status, providerMessageId: previous.providerMessageId, duplicate: true }
      : { error: "Kilde-ID er allerede brugt til et andet dokument." });
    const sameInvoice = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.issuerCvr, tenant.cvr), eq(ediGatewayDocuments.direction, "outbound"), eq(ediGatewayDocuments.invoiceNumber, value.invoiceNumber))).get();
    if (sameInvoice) return void res.status(409).json({ error: "Fakturanummeret er allerede reserveret til dette CVR. Kontrollér eksisterende afsendelse." });
    const row = db.insert(ediGatewayDocuments).values({ tenantId: tenant.id, sourceId: value.sourceId,
      direction: "outbound", format: value.format, documentType: "invoice", invoiceNumber: value.invoiceNumber, issuerCvr: tenant.cvr,
      recipient: document.recipientEndpointId, payloadXml: document.xml, sha256: hash, status: "pending", createdAt: now(), updatedAt: now(),
    }).returning().get();
    try {
      const result = await sproomSendForChild(document.xml, value.format, document.recipientEndpointId, tenant.sproomChildId);
      db.update(ediGatewayDocuments).set({ providerMessageId: result.messageId, status: "submitted", updatedAt: now() }).where(eq(ediGatewayDocuments.id, row.id)).run();
      return void res.status(202).json({ id: row.id, status: "submitted", providerMessageId: result.messageId });
    } catch (error) {
      db.update(ediGatewayDocuments).set({ status: "needs_review", error: error instanceof Error ? error.message.slice(0, 1000) : "Ukendt fejl", updatedAt: now() }).where(eq(ediGatewayDocuments.id, row.id)).run();
      return void res.status(502).json({ id: row.id, status: "needs_review", error: "Afsendelsen kræver kontrol. Gentag ikke automatisk." });
    }
  }));
  app.get("/api/edi-gateway/documents/:sourceId", run(async (req, res) => {
    const tenant = tenantFor(req);
    if (!tenant) return void res.status(401).json({ error: "Ugyldig EDI-adgangsnøgle." });
    if (!tenant.active) return void res.status(403).json({ error: "EDI er ikke aktiveret for virksomheden." });
    const row = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.direction, "outbound"), eq(ediGatewayDocuments.sourceId, String(req.params.sourceId)))).get();
    if (!row) return void res.status(404).json({ error: "Dokumentet findes ikke." });
    res.json({ id: row.id, status: row.status, providerMessageId: row.providerMessageId, error: row.error, updatedAt: row.updatedAt });
  }));
  app.get("/api/edi-gateway/documents/:sourceId/xml", run(async (req, res) => {
    const tenant = tenantFor(req);
    if (!tenant) return void res.status(401).json({ error: "Ugyldig EDI-adgangsnøgle." });
    if (!tenant.active) return void res.status(403).json({ error: "EDI er ikke aktiveret for virksomheden." });
    const row = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.direction, "outbound"), eq(ediGatewayDocuments.sourceId, String(req.params.sourceId)))).get();
    if (!row) return void res.status(404).json({ error: "Dokumentet findes ikke." });
    if (row.status !== "delivered") return void res.status(409).json({ error: "Dokumentets levering er endnu ikke bekræftet." });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(row.payloadXml);
  }));
  app.get("/api/edi-gateway/inbound", run(async (req, res) => {
    const tenant = tenantFor(req);
    if (!tenant) return void res.status(401).json({ error: "Ugyldig EDI-adgangsnøgle." });
    if (!tenant.active) return void res.status(403).json({ error: "EDI er ikke aktiveret for virksomheden." });
    const afterId = req.query.afterId === undefined ? null : Number(req.query.afterId);
    const limit = req.query.limit === undefined ? null : Number(req.query.limit);
    if (afterId !== null && (!Number.isSafeInteger(afterId) || afterId < 0)) return void res.status(400).json({ error: "Ugyldigt afterId." });
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)) return void res.status(400).json({ error: "Ugyldig limit." });
    const query = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.direction, "inbound"), ...(afterId === null ? [] : [gt(ediGatewayDocuments.id, afterId)]))).orderBy(asc(ediGatewayDocuments.id));
    const rows = limit === null ? query.all() : query.limit(limit).all();
    res.json(rows.map(({ payloadXml, ...row }) => ({ ...row, hasDocument: Boolean(payloadXml) })));
  }));
  app.get("/api/edi-gateway/inbound/:id/xml", run(async (req, res) => {
    const tenant = tenantFor(req);
    if (!tenant) return void res.status(401).json({ error: "Ugyldig EDI-adgangsnøgle." });
    if (!tenant.active) return void res.status(403).json({ error: "EDI er ikke aktiveret for virksomheden." });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return void res.status(400).json({ error: "Ugyldigt ID." });
    const row = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.id, id), eq(ediGatewayDocuments.direction, "inbound"))).get();
    if (!row) return void res.status(404).json({ error: "Dokumentet findes ikke." });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(row.payloadXml);
  }));
}

/** Called only after the existing Sproom RSA signature check has passed. */
export async function handleGatewaySproomWebhook(body: any): Promise<{ status: number; result: object } | null> {
  const childId = String(body?.companyId || "").trim();
  const tenants = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sproomChildId, childId)).all();
  if (!tenants.length) return null;
  const messageId = String(body?.documentId || "").trim();
  if (!messageId) return { status: 400, result: { error: "documentId mangler." } };
  if (body.webhookType === "documentStatusChanged") {
    const matching = tenants.flatMap(tenant => db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.providerMessageId, messageId), eq(ediGatewayDocuments.direction, "outbound"))).all());
    const providerState = String(body.documentStatus || "");
    const delivered = ["received", "transmissionCompleted", "approved"].includes(providerState);
    const failed = /error|reject|timeout|notfound|exceeded|canceled|deleted/i.test(providerState);
    for (const row of matching) {
      if (row.status === "delivered" && !failed) continue;
        if (row.status === "failed" && !delivered) continue;
      db.update(ediGatewayDocuments).set({ status: delivered ? "delivered" : failed ? "failed" : "submitted", error: failed ? String(body?.statusDetails?.message || providerState).slice(0, 1000) : null, updatedAt: now() }).where(eq(ediGatewayDocuments.id, row.id)).run();
    }
    return { status: 200, result: { accepted: true, matched: matching.length > 0 } };
  }
  if (body.webhookType !== "documentReceived") return { status: 200, result: { accepted: true, ignored: true } };
  const receivers = tenants.filter(tenant => tenant.active && tenant.receiveEnabled);
  if (receivers.length === 0) return null;
  if (receivers.length !== 1) return { status: 503, result: { error: "Indgående EDI kræver præcis én aktiv modtager for virksomheden." } };
  const tenant = receivers[0];
  const previous = db.select().from(ediGatewayDocuments).where(and(eq(ediGatewayDocuments.tenantId, tenant.id), eq(ediGatewayDocuments.direction, "inbound"), eq(ediGatewayDocuments.sourceId, messageId))).get();
  if (previous) return { status: 200, result: { id: previous.id, duplicate: true } };
  let format: EInvoiceFormat = "OIOUBL_2_1";
  let xml: string;
  try { xml = await sproomDownloadChildDocument(messageId, tenant.sproomChildId, format); }
  catch (firstError) {
    format = "PEPPOL_BIS_3";
    try { xml = await sproomDownloadChildDocument(messageId, tenant.sproomChildId, format); }
    catch { throw firstError; }
  }
  const errors = await providerValidate(xml, format);
  const row = db.insert(ediGatewayDocuments).values({ tenantId: tenant.id, sourceId: messageId, direction: "inbound", format,
    documentType: String(body.documentType || "invoice").toLowerCase(), payloadXml: xml, sha256: digest(xml), providerMessageId: messageId,
    status: errors.length ? "invalid" : "received", error: errors.length ? errors.join("; ").slice(0, 1000) : null, createdAt: now(), updatedAt: now(),
  }).returning().get();
  return { status: 201, result: { id: row.id, accepted: errors.length === 0 } };
}

export function registerEdiGatewayAdminRoutes(app: Express) {
  app.post("/api/edi-gateway/reconcile", requireGatewayAdmin, run(async (req, res) => {
    const limit = req.body?.limit === undefined ? 50 : Number(req.body.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) return void res.status(400).json({ error: "Ugyldigt afstemningsantal." });
    res.json(await reconcileSproomDocuments(limit));
  }));
  app.post("/api/edi-gateway/tenants", requireGatewayAdmin, run(async (req, res) => {
    const parsed = provision.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Ugyldige virksomhedsoplysninger." });
    const input = parsed.data;
    const old = db.select().from(ediGatewayTenants).where(and(eq(ediGatewayTenants.product, input.product), eq(ediGatewayTenants.sourceTenantId, input.sourceTenantId))).get();
    if (old) return void res.status(409).json({ error: "Virksomheden er allerede oprettet til dette produkt." });
    const sameCvr = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.cvr, input.cvr)).all();
    if (sameCvr.some(row => row.sproomChildId !== input.sproomChildId)) return void res.status(409).json({ error: "CVR er allerede knyttet til en anden Sproom-profil." });
    const sameChild = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sproomChildId, input.sproomChildId)).all();
    if (sameChild.some(row => row.cvr !== input.cvr)) return void res.status(409).json({ error: "Sproom-profilen er allerede knyttet til et andet CVR." });
    const token = `edi_${randomBytes(32).toString("hex")}`;
    const row = db.insert(ediGatewayTenants).values({ ...input, keyHash: digest(token), keyPrefix: token.slice(0, 16), createdAt: now() }).returning().get();
    res.status(201).json({ id: row.id, active: false, receiveEnabled: false, token });
  }));
  app.get("/api/edi-gateway/tenants", requireGatewayAdmin, run(async (_req, res) => {
    res.json(db.select().from(ediGatewayTenants).all().map(({ keyHash, keyPrefix, ...row }) => row));
  }));
  app.post("/api/edi-gateway/tenants/:id/activate", requireGatewayAdmin, run(async (req, res) => {
    const activation = z.object({
      confirmation: z.literal("SPROOM_AFTALE_OG_KUNDEGODKENDELSE_BEKRAEFTET"),
      evidenceReference: z.string().trim().min(8).max(200),
    }).strict().safeParse(req.body);
    if (!activation.success) return void res.status(400).json({ error: "Sproom-aftale og dokumenteret kundegodkendelse skal først bekræftes." });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return void res.status(400).json({ error: "Ugyldigt ID." });
    const row = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.id, id)).get();
    if (!row) return void res.status(404).json({ error: "EDI-virksomheden findes ikke." });
    if (!process.env.EINVOICE_VALIDATOR_URL) return void res.status(503).json({ error: "Ekstern XML-validering skal være konfigureret før aktivering." });
    // Confirms that the parent agreement can access the exact mapped child;
    // network registration and the customer's authority still need human evidence.
    try { await sproomChildCompanyToken(row.sproomChildId); }
    catch { return void res.status(503).json({ error: "Sproom-child-profilen kunne ikke verificeres med parent-aftalen." }); }
    db.update(ediGatewayTenants).set({ active: 1, onboardingEvidence: activation.data.evidenceReference,
      activatedAt: now() }).where(eq(ediGatewayTenants.id, id)).run();
    res.json({ id, active: true, receiveEnabled: Boolean(row.receiveEnabled) });
  }));
  app.post("/api/edi-gateway/tenants/:id/receive", requireGatewayAdmin, run(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || typeof req.body?.enabled !== "boolean") return void res.status(400).json({ error: "ID og enabled kræves." });
    const row = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.id, id)).get();
    if (!row) return void res.status(404).json({ error: "EDI-virksomheden findes ikke." });
    if (req.body.enabled && !row.active) return void res.status(409).json({ error: "Virksomheden skal aktiveres først." });
    const other = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sproomChildId, row.sproomChildId)).all().find(tenant => tenant.id !== id && tenant.receiveEnabled);
    if (req.body.enabled && other) return void res.status(409).json({ error: "Sproom-virksomheden har allerede en indgående EDI-modtager." });
    db.update(ediGatewayTenants).set({ receiveEnabled: req.body.enabled ? 1 : 0 }).where(eq(ediGatewayTenants.id, id)).run();
    res.json({ id, receiveEnabled: req.body.enabled });
  }));
  app.post("/api/edi-gateway/tenants/:id/disable", requireGatewayAdmin, run(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return void res.status(400).json({ error: "Ugyldigt ID." });
    const row = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.id, id)).get();
    if (!row) return void res.status(404).json({ error: "EDI-virksomheden findes ikke." });
    db.update(ediGatewayTenants).set({ active: 0, receiveEnabled: 0 }).where(eq(ediGatewayTenants.id, id)).run();
    res.json({ id, active: false, receiveEnabled: false });
  }));
}

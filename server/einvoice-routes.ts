import type { Express, Request, Response, NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { einvoiceQueue } from "@shared/schema";
import { requireRole } from "./auth";
import { db, storage } from "./storage";
import { generateEInvoice, providerSend, providerStatus, providerValidate, validateEInvoice, verifyInboundSignature, type EInvoiceFormat } from "./einvoice";

const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const cid = (req: Request) => Number((req as any).auth?.companyId);
const actor = (req: Request) => String((req as any).auth?.user?.email || (req as any).auth?.userId || "system");
const now = () => new Date().toISOString();
const formatOf = (value: unknown): EInvoiceFormat => value === "PEPPOL_BIS_3" ? "PEPPOL_BIS_3" : "OIOUBL_2_1";
const text = (payload: string, tag: string) => payload.match(new RegExp(`<cbc:${tag}(?:\\s[^>]*)?>([^<]*)</cbc:${tag}>`))?.[1] || null;
const validationState = (errors: string[]) => errors.length ? "afvist" : providerStatus().validatorConfigured ? "godkendt" : "lokal_godkendt";

async function audit(companyId: number, userEmail: string, action: string, target: string, detail: string) {
  await storage.createAuditLog({ companyId, userId: null, userEmail, action, target, detail, createdAt: now() });
}

export function registerPublicEInvoiceRoutes(app: Express) {
  app.post("/api/einvoice/inbound", asyncRoute(async (req, res) => {
    const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
    const signatureHeader = req.headers["x-einvoice-signature"] ?? req.headers["x-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!verifyInboundSignature(raw, signature)) return void res.status(401).json({ error: "Webhook-signaturen kunne ikke bekræftes." });
    const companyId = Number(req.body?.companyId);
    const payload = req.body?.documentBase64 ? Buffer.from(String(req.body.documentBase64), "base64").toString("utf8") : String(req.body?.xml || "");
    const messageId = String(req.body?.messageId || "").trim();
    if (!Number.isInteger(companyId) || companyId <= 0 || !messageId || !payload) return void res.status(400).json({ error: "companyId, messageId og dokument er påkrævet." });
    const company = await storage.getCompany(companyId);
    if (!company) return void res.status(404).json({ error: "Virksomheden findes ikke." });
    const errors = validateEInvoice(payload);
    const duplicate = db.select().from(einvoiceQueue).where(and(eq(einvoiceQueue.companyId, companyId), eq(einvoiceQueue.providerMessageId, messageId))).get();
    if (duplicate) return void res.status(200).json({ id: duplicate.id, accepted: duplicate.validationStatus !== "afvist", duplicate: true });
    const created = db.insert(einvoiceQueue).values({
      companyId, direction: "indgående", invoiceNumber: text(payload, "ID"), counterpartyName: null,
      amount: Number(text(payload, "PayableAmount") || 0), format: formatOf(req.body?.format),
      validationStatus: errors.length ? "afvist" : "lokal_godkendt", validationErrors: errors.length ? JSON.stringify(errors) : null,
      routingStatus: "modtaget", status: errors.length ? "afvist" : "modtaget", payloadXml: payload,
      providerMessageId: messageId || null, responseType: "modtaget", receivedAt: now(), processedAt: now(), createdAt: now(),
    }).returning().get();
    await audit(companyId, "einvoice-provider", "einvoice_modtaget", `einvoice#${created.id}`, errors.length ? `Afvist: ${errors.join("; ")}` : "Elektronisk faktura modtaget og strukturelt valideret.");
    res.status(errors.length ? 422 : 201).json({ id: created.id, accepted: errors.length === 0, errors });
  }));
}

export function registerEInvoiceRoutes(app: Express) {
  app.get("/api/einvoice-queue/status", requireRole("leder", "platform_admin"), asyncRoute(async (_req, res) => res.json(providerStatus())));
  app.get("/api/einvoice-queue", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    res.json(db.select().from(einvoiceQueue).where(eq(einvoiceQueue.companyId, cid(req))).orderBy(desc(einvoiceQueue.id)).all().map(({ payloadXml, ...row }) => ({ ...row, hasDocument: Boolean(payloadXml) })));
  }));
  app.post("/api/einvoice-queue/from-invoice", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const companyId = cid(req);
    const invoice = await storage.getInvoice(Number(req.body?.invoiceId), companyId);
    if (!invoice) return void res.status(404).json({ error: "Fakturaen findes ikke." });
    const [company, customer, items] = await Promise.all([storage.getCompany(companyId), storage.getCustomer(invoice.customerId, companyId), storage.getInvoiceItems(invoice.id)]);
    if (!company || !customer) return void res.status(400).json({ error: "Virksomhed eller kunde mangler." });
    const format = formatOf(req.body?.format);
    const generated = generateEInvoice({ company, customer, invoice, items, format });
    const errors = await providerValidate(generated.xml, format);
    const state = validationState(errors);
    const created = db.insert(einvoiceQueue).values({ companyId, direction: "udgående", invoiceNumber: invoice.invoiceNumber, invoiceId: invoice.id, counterpartyName: customer.name, amount: invoice.totalAmount, format, validationStatus: state, validationErrors: errors.length ? JSON.stringify(errors) : null, routingStatus: "afventer", status: errors.length ? "afvist" : "klar", documentType: "invoice", recipientEndpointId: generated.recipientEndpointId, endpointScheme: generated.endpointScheme, payloadXml: generated.xml, processedAt: now(), createdAt: now() }).returning().get();
    await audit(companyId, actor(req), "einvoice_oprettet", `einvoice#${created.id}`, `${format}; ${errors.length ? "afvist" : "klar"}`);
    res.status(201).json({ ...created, payloadXml: undefined, hasDocument: true, errors });
  }));
  app.post("/api/einvoice-queue/import", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const payload = String(req.body?.xml || "");
    const format = formatOf(req.body?.format);
    const errors = await providerValidate(payload, format);
    const created = db.insert(einvoiceQueue).values({ companyId: cid(req), direction: "indgående", invoiceNumber: text(payload, "ID"), amount: Number(text(payload, "PayableAmount") || 0), format, validationStatus: validationState(errors), validationErrors: errors.length ? JSON.stringify(errors) : null, routingStatus: "importeret", status: errors.length ? "afvist" : "modtaget", documentType: "invoice", payloadXml: payload, receivedAt: now(), processedAt: now(), createdAt: now() }).returning().get();
    await audit(cid(req), actor(req), "einvoice_importeret", `einvoice#${created.id}`, errors.length ? `Afvist: ${errors.join("; ")}` : `${format}; godkendt`);
    res.status(errors.length ? 422 : 201).json({ id: created.id, accepted: errors.length === 0, errors });
  }));
  app.post("/api/einvoice-queue/:id/validate", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const row = db.select().from(einvoiceQueue).where(and(eq(einvoiceQueue.id, Number(req.params.id)), eq(einvoiceQueue.companyId, cid(req)))).get();
    if (!row?.payloadXml) return void res.status(404).json({ error: "E-fakturaen eller XML-dokumentet findes ikke." });
    const errors = await providerValidate(row.payloadXml, formatOf(row.format));
    const updated = db.update(einvoiceQueue).set({ validationStatus: validationState(errors), validationErrors: errors.length ? JSON.stringify(errors) : null, processedAt: now() }).where(eq(einvoiceQueue.id, row.id)).returning().get();
    await audit(cid(req), actor(req), "einvoice_valideret", `einvoice#${row.id}`, errors.length ? `Afvist: ${errors.join("; ")}` : "Validering bestået.");
    res.status(errors.length ? 422 : 200).json({ ...updated, payloadXml: undefined, errors });
  }));
  app.post("/api/einvoice-queue/:id/send", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const row = db.select().from(einvoiceQueue).where(and(eq(einvoiceQueue.id, Number(req.params.id)), eq(einvoiceQueue.companyId, cid(req)))).get();
    if (!row?.payloadXml) return void res.status(404).json({ error: "E-fakturaen eller XML-dokumentet findes ikke." });
    if (row.validationStatus !== "godkendt") return void res.status(409).json({ error: "Dokumentet skal bestå validering før afsendelse." });
    try {
      const result = await providerSend(row.payloadXml, formatOf(row.format), String(row.recipientEndpointId || ""));
      const updated = db.update(einvoiceQueue).set({ routingStatus: "sendt", status: "sendt", providerMessageId: result.messageId || null, sentAt: now(), processedAt: now(), attempts: (row.attempts || 0) + 1, lastError: null }).where(eq(einvoiceQueue.id, row.id)).returning().get();
      if (row.invoiceId) await storage.updateInvoice(row.invoiceId, { status: "sendt", sentAt: now() });
      await audit(cid(req), actor(req), "einvoice_sendt", `einvoice#${row.id}`, `Leverandør-ID: ${result.messageId || "ikke oplyst"}`);
      res.json({ ...updated, payloadXml: undefined });
    } catch (error: any) {
      const message = String(error?.message || error);
      db.update(einvoiceQueue).set({ routingStatus: "fejlet", status: "fejlet", attempts: (row.attempts || 0) + 1, lastError: message, processedAt: now() }).where(eq(einvoiceQueue.id, row.id)).run();
      await audit(cid(req), actor(req), "einvoice_sendefejl", `einvoice#${row.id}`, message);
      res.status(503).json({ error: message });
    }
  }));
  app.get("/api/einvoice-queue/:id/download", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const row = db.select().from(einvoiceQueue).where(and(eq(einvoiceQueue.id, Number(req.params.id)), eq(einvoiceQueue.companyId, cid(req)))).get();
    if (!row?.payloadXml) return void res.status(404).json({ error: "XML-dokumentet findes ikke." });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${String(row.invoiceNumber || row.id).replace(/[^a-zA-Z0-9_-]/g, "_")}.xml"`);
    res.send(row.payloadXml);
  }));
}

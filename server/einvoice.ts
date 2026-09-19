import { createHash, createHmac, timingSafeEqual, verify } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Company, Customer, CreditNote, EinvoiceQueue, Invoice, InvoiceItem } from "@shared/schema";

export type EInvoiceFormat = "OIOUBL_2_1" | "PEPPOL_BIS_3";
export type EInvoiceProvider = "generic" | "sproom";

type DocumentInput = {
  company: Company;
  customer: Customer;
  invoice: Invoice;
  items: InvoiceItem[];
  format: EInvoiceFormat;
};

const xml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const money = (value: number | null | undefined) => Number(value || 0).toFixed(2);
const quantity = (value: number | null | undefined) => Number(value || 0).toFixed(4);

function endpoint(customer: Customer): { id: string; scheme: string } {
  const ean = String(customer.ean || "").replace(/\s/g, "");
  if (/^\d{13}$/.test(ean)) return { id: ean, scheme: "0088" };
  const cvr = String(customer.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
  if (/^\d{8}$/.test(cvr)) return { id: `DK${cvr}`, scheme: "0184" };
  throw new Error("Kunden mangler et gyldigt GLN/EAN (13 cifre) eller CVR-nummer (8 cifre).");
}

function senderEndpoint(company: Company): { id: string; scheme: string } {
  const cvr = String(company.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cvr)) throw new Error("Virksomheden mangler et gyldigt CVR-nummer.");
  return { id: `DK${cvr}`, scheme: "0184" };
}

function invoiceLines(items: InvoiceItem[], currency: string, peppol: boolean): string {
  return items.map((item, index) => {
    const vat = Number(item.vatRate || 0);
    const line = peppol ? "cac:InvoiceLine" : "cac:InvoiceLine";
    return `<${line}><cbc:ID>${index + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="HUR">${quantity(item.quantity)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(item.amount)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${xml(item.description)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${vat ? "S" : "Z"}</cbc:ID><cbc:Percent>${vat}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${money(item.unitPrice)}</cbc:PriceAmount></cac:Price></${line}>`;
  }).join("");
}

export function generateEInvoice(input: DocumentInput): { xml: string; recipientEndpointId: string; endpointScheme: string } {
  const { company, customer, invoice, format } = input;
  if (!input.items.length) throw new Error("Fakturaen har ingen fakturalinjer.");
  const receiver = endpoint(customer);
  const sender = senderEndpoint(company);
  const currency = company.currency || "DKK";
  const dueDate = invoice.dueDate || invoice.issueDate;
  const common = `<cbc:ID>${xml(invoice.invoiceNumber)}</cbc:ID><cbc:IssueDate>${xml(invoice.issueDate)}</cbc:IssueDate><cbc:DueDate>${xml(dueDate)}</cbc:DueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode>`;
  const parties = `<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="${sender.scheme}">${xml(sender.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(company.name)}</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:CompanyID>${xml(sender.id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${xml(company.name)}</cbc:RegistrationName><cbc:CompanyID>${xml(sender.id)}</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="${receiver.scheme}">${xml(receiver.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(customer.name)}</cbc:Name></cac:PartyName><cac:PartyLegalEntity><cbc:RegistrationName>${xml(customer.name)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`;
  const totals = `<cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${money(invoice.vatAmount)}</cbc:TaxAmount></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(invoice.netAmount)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${money(invoice.netAmount)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:PayableAmount></cac:LegalMonetaryTotal>`;
  const profile = format === "PEPPOL_BIS_3"
    ? `<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID><cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>`
    : `<cbc:CustomizationID>OIOUBL-2.1</cbc:CustomizationID><cbc:ProfileID schemeID="urn:oioubl:id:profileid-1.2">urn:www.nesubl.eu:profiles:profile5:ver2.0</cbc:ProfileID>`;
  const document = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${profile}${common}${parties}${totals}${invoiceLines(input.items, currency, format === "PEPPOL_BIS_3")}</Invoice>`;
  return { xml: document, recipientEndpointId: receiver.id, endpointScheme: receiver.scheme };
}

export function generateECreditNote(input: { company: Company; customer: Customer; creditNote: CreditNote; originalInvoice: Invoice; format: EInvoiceFormat }) {
  const { company, customer, creditNote, originalInvoice, format } = input;
  const receiver = endpoint(customer);
  const sender = senderEndpoint(company);
  const currency = company.currency || "DKK";
  const vatRate = Number(originalInvoice.vatRate || company.vatRate || 0);
  const total = Math.abs(Number(creditNote.amount || 0));
  if (total <= 0) throw new Error("Kreditnotaens beløb skal være større end 0.");
  const net = total / (1 + vatRate / 100);
  const vat = total - net;
  const profile = format === "PEPPOL_BIS_3"
    ? `<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID><cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>`
    : `<cbc:CustomizationID>OIOUBL-2.1</cbc:CustomizationID><cbc:ProfileID schemeID="urn:oioubl:id:profileid-1.2">urn:www.nesubl.eu:profiles:profile5:ver2.0</cbc:ProfileID>`;
  const parties = `<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="${sender.scheme}">${xml(sender.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(company.name)}</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:CompanyID>${xml(sender.id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="${receiver.scheme}">${xml(receiver.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(customer.name)}</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>`;
  const payload = `<?xml version="1.0" encoding="UTF-8"?><CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${profile}<cbc:ID>${xml(creditNote.creditNumber)}</cbc:ID><cbc:IssueDate>${creditNote.createdAt.slice(0, 10)}</cbc:IssueDate><cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode><cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode><cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${xml(originalInvoice.invoiceNumber)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>${parties}<cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${money(vat)}</cbc:TaxAmount></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(net)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${money(net)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${money(total)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${xml(currency)}">${money(total)}</cbc:PayableAmount></cac:LegalMonetaryTotal><cac:CreditNoteLine><cbc:ID>1</cbc:ID><cbc:CreditedQuantity unitCode="EA">1</cbc:CreditedQuantity><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(net)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${xml(creditNote.reason || `Kreditering af ${originalInvoice.invoiceNumber}`)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${vatRate ? "S" : "Z"}</cbc:ID><cbc:Percent>${vatRate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${money(net)}</cbc:PriceAmount></cac:Price></cac:CreditNoteLine></CreditNote>`;
  return { xml: payload, recipientEndpointId: receiver.id, endpointScheme: receiver.scheme };
}

export function generateEInvoiceResponse(original: EinvoiceQueue, company: Company, responseType: string, accepted: boolean, reason?: string) {
  if (!original.payloadXml || original.direction !== "indgående") throw new Error("Kun et modtaget XML-dokument kan besvares.");
  const endpoints = Array.from(original.payloadXml.matchAll(/<cbc:EndpointID\b[^>]*schemeID="([^"]+)"[^>]*>([^<]+)<\/cbc:EndpointID>/g));
  const receiver = endpoints[0] ? { scheme: endpoints[0][1], id: endpoints[0][2] } : null;
  if (!receiver) throw new Error("Det modtagne dokument indeholder ikke et afsender-ID.");
  const sender = senderEndpoint(company);
  const type = ["application_response", "message_level_response", "invoice_response"].includes(responseType) ? responseType : "invoice_response";
  const customization = type === "message_level_response" ? "urn:fdc:peppol.eu:poacc:trns:mlr:3" : type === "invoice_response" ? "urn:fdc:peppol.eu:poacc:trns:invoice_response:3" : "OIOUBL-2.1";
  const responseCode = accepted ? "AP" : "RE";
  const id = `RESP-${Date.now()}`;
  const payload = `<?xml version="1.0" encoding="UTF-8"?><ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>${customization}</cbc:CustomizationID><cbc:ID>${id}</cbc:ID><cbc:IssueDate>${new Date().toISOString().slice(0, 10)}</cbc:IssueDate><cac:SenderParty><cbc:EndpointID schemeID="${sender.scheme}">${xml(sender.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(company.name)}</cbc:Name></cac:PartyName></cac:SenderParty><cac:ReceiverParty><cbc:EndpointID schemeID="${xml(receiver.scheme)}">${xml(receiver.id)}</cbc:EndpointID></cac:ReceiverParty><cac:DocumentResponse><cac:Response><cbc:ResponseCode>${responseCode}</cbc:ResponseCode>${reason ? `<cbc:Description>${xml(reason)}</cbc:Description>` : ""}</cac:Response><cac:DocumentReference><cbc:ID>${xml(original.invoiceNumber || original.providerMessageId || original.id)}</cbc:ID></cac:DocumentReference></cac:DocumentResponse></ApplicationResponse>`;
  return { xml: payload, id, recipientEndpointId: receiver.id, endpointScheme: receiver.scheme, responseType: type };
}

export function validateEInvoice(payload: string): string[] {
  const errors: string[] = [];
  if (!payload.trim()) return ["XML-dokumentet er tomt."];
  if (XMLValidator.validate(payload) !== true) return ["Dokumentet er ikke velformet XML."];
  new XMLParser({ ignoreAttributes: false }).parse(payload);
  if (/<ApplicationResponse\b/.test(payload)) {
    if (!/<cbc:ID>[^<]+<\/cbc:ID>/.test(payload)) errors.push("Svar-ID mangler.");
    if (!/<cbc:ResponseCode>(AP|RE)<\/cbc:ResponseCode>/.test(payload)) errors.push("Gyldig svarkode mangler.");
    if (!/<cac:DocumentReference>/.test(payload)) errors.push("Reference til originaldokument mangler.");
    return errors;
  }
  const creditNote = /<CreditNote\b/.test(payload);
  for (const [pattern, message] of [
    [creditNote ? /<CreditNote\b/ : /<Invoice\b/, creditNote ? "Rod-elementet CreditNote mangler." : "Rod-elementet Invoice mangler."], [/<cbc:ID>[^<]+<\/cbc:ID>/, "Dokumentnummer mangler."],
    [/<cbc:IssueDate>\d{4}-\d{2}-\d{2}<\/cbc:IssueDate>/, "Gyldig fakturadato mangler."],
    [/<cbc:EndpointID\b[^>]*>[^<]+<\/cbc:EndpointID>/, "Afsender/modtager-ID mangler."],
    [creditNote ? /<cac:CreditNoteLine>/ : /<cac:InvoiceLine>/, "Mindst én dokumentlinje kræves."], [/<cbc:PayableAmount\b/, "Betalingsbeløb mangler."],
  ] as Array<[RegExp, string]>) if (!pattern.test(payload)) errors.push(message);
  return errors;
}

export function providerStatus(companyId?: number) {
  const provider = String(process.env.EINVOICE_PROVIDER || "generic").toLowerCase() === "sproom" ? "sproom" : "generic";
  const companyMap = sproomCompanyMap();
  const configured = provider === "sproom"
    ? Boolean(process.env.SPROOM_API_TOKEN && (companyId ? companyMap[String(companyId)] : Object.keys(companyMap).length))
    : Boolean(process.env.EINVOICE_PROVIDER_URL && process.env.EINVOICE_PROVIDER_API_KEY);
  return {
    provider,
    configured,
    companyMapped: provider !== "sproom" || !companyId || Boolean(companyMap[String(companyId)]),
    validatorConfigured: Boolean(process.env.EINVOICE_VALIDATOR_URL),
    inboundConfigured: provider === "sproom"
      ? Boolean(process.env.SPROOM_WEBHOOK_PUBLIC_KEY || process.env.SPROOM_WEBHOOK_PUBLIC_KEY_BASE64)
      : Boolean(process.env.EINVOICE_WEBHOOK_SECRET),
    supportedFormats: ["OIOUBL_2_1", "PEPPOL_BIS_3"],
  };
}

export async function providerValidate(payload: string, format: EInvoiceFormat): Promise<string[]> {
  const local = validateEInvoice(payload);
  if (local.length || !process.env.EINVOICE_VALIDATOR_URL) return local;
  const response = await fetch(process.env.EINVOICE_VALIDATOR_URL, { method: "POST", headers: { "Content-Type": "application/xml", "X-Document-Format": format }, body: payload });
  if (response.ok) return [];
  return [`Ekstern validator afviste dokumentet (${response.status}): ${(await response.text()).slice(0, 500)}`];
}

function providerKind(): EInvoiceProvider {
  return String(process.env.EINVOICE_PROVIDER || "generic").toLowerCase() === "sproom" ? "sproom" : "generic";
}

function sproomBaseUrl(): string {
  return String(process.env.SPROOM_API_URL || "https://sproom.net/api").replace(/\/$/, "");
}

function sproomCompanyMap(): Record<string, string> {
  try {
    const parsed = JSON.parse(process.env.SPROOM_COMPANY_MAP || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string" && value.trim()));
  } catch {
    return {};
  }
}

function sproomCompanyId(companyId: number): string {
  const externalId = sproomCompanyMap()[String(companyId)];
  if (!externalId) throw new Error(`Virksomhed ${companyId} er ikke knyttet til en Sproom-kundevirksomhed.`);
  return externalId;
}

export function internalCompanyIdForSproom(externalCompanyId: string): number | null {
  const entry = Object.entries(sproomCompanyMap()).find(([, value]) => value === externalCompanyId);
  return entry ? Number(entry[0]) : null;
}

async function sproomCompanyToken(companyId: number): Promise<string> {
  const parentToken = process.env.SPROOM_API_TOKEN?.trim();
  if (!parentToken) throw new Error("Sproom API-token mangler.");
  const response = await fetch(`${sproomBaseUrl()}/child-companies/${encodeURIComponent(sproomCompanyId(companyId))}/token`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${parentToken}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Sproom kunne ikke udstede virksomhedstoken (${response.status}): ${body.slice(0, 500)}`);
  try {
    const parsed = JSON.parse(body);
    const token = String(parsed.token || parsed.accessToken || parsed.access_token || "").trim();
    if (token) return token;
  } catch { /* handled below */ }
  const token = body.replace(/^"|"$/g, "").trim();
  if (!token) throw new Error("Sproom returnerede ikke et virksomhedstoken.");
  return token;
}

function sproomRecipient(recipient: string): string {
  const value = recipient.trim();
  if (/^\d{13}$/.test(value)) return `GLN:${value}`;
  const cvr = value.replace(/^DK/i, "").replace(/\D/g, "");
  if (/^\d{8}$/.test(cvr)) return `DK:CVR:${cvr}`;
  throw new Error("Modtageren mangler et gyldigt GLN eller CVR til NemHandel-opslag.");
}

export async function sproomDownloadDocument(documentId: string, companyId: number, format: EInvoiceFormat): Promise<string> {
  const token = await sproomCompanyToken(companyId);
  const targetFormat = format === "PEPPOL_BIS_3" ? "peppolBis3" : "oioUbl2";
  const response = await fetch(`${sproomBaseUrl()}/documents/${encodeURIComponent(documentId)}/${targetFormat}`, {
    headers: { Accept: "application/xml, application/octet-stream", Authorization: `Bearer ${token}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Sproom-dokumentet kunne ikke hentes (${response.status}): ${body.slice(0, 500)}`);
  return body;
}

export function verifySproomSignature(raw: string, signature?: string): boolean {
  if (!signature) return false;
  try {
    const direct = process.env.SPROOM_WEBHOOK_PUBLIC_KEY?.replace(/\\n/g, "\n").trim();
    const encoded = process.env.SPROOM_WEBHOOK_PUBLIC_KEY_BASE64?.trim();
    const publicKey = direct || (encoded ? Buffer.from(encoded, "base64").toString("utf8") : "");
    if (!publicKey) return false;
    return verify("RSA-SHA256", Buffer.from(raw, "utf8"), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export async function providerSend(payload: string, format: EInvoiceFormat, recipient: string, companyId?: number) {
  if (providerKind() === "sproom") {
    if (!companyId) throw new Error("Virksomheds-ID mangler ved Sproom-afsendelse.");
    const token = await sproomCompanyToken(companyId);
    const recipientResponse = await fetch(`${sproomBaseUrl()}/recipients/${encodeURIComponent(sproomRecipient(recipient))}`, {
      headers: { Accept: "*/*", Authorization: `Bearer ${token}` },
    });
    if (!recipientResponse.ok) {
      const reason = (await recipientResponse.text()).slice(0, 500);
      throw new Error(`Modtageren er ikke registreret til e-faktura (${recipientResponse.status}): ${reason}`);
    }
    const response = await fetch(`${sproomBaseUrl()}/documents`, {
      method: "POST",
      headers: { Accept: "*/*", Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: Buffer.from(payload, "utf8"),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Sproom afviste dokumentet (${response.status}): ${body.slice(0, 500)}`);
    const messageId = response.headers.get("x-sproom-documentid") || response.headers.get("x-sproom-document-id") || "";
    if (!messageId) throw new Error("Sproom accepterede kaldet, men returnerede ikke X-Sproom-DocumentId. Dokumentet markeres ikke som sendt.");
    return { messageId, response: body.slice(0, 2000) };
  }
  if (!process.env.EINVOICE_PROVIDER_URL || !process.env.EINVOICE_PROVIDER_API_KEY) throw new Error("NemHandel/Peppol-leverandøren er ikke konfigureret. Dokumentet er ikke sendt.");
  const idempotencyKey = createHash("sha256").update(`${format}\0${recipient}\0${payload}`).digest("hex");
  const response = await fetch(process.env.EINVOICE_PROVIDER_URL, { method: "POST", headers: { Authorization: `Bearer ${process.env.EINVOICE_PROVIDER_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ format, recipient, documentBase64: Buffer.from(payload).toString("base64") }) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Leverandøren afviste afsendelsen (${response.status}): ${body.slice(0, 500)}`);
  let parsed: any = {};
  try { parsed = JSON.parse(body); } catch { parsed = { messageId: response.headers.get("x-message-id") }; }
  return { messageId: String(parsed.messageId || parsed.id || response.headers.get("x-message-id") || ""), response: body.slice(0, 2000) };
}

export function verifyInboundSignature(raw: string, signature?: string): boolean {
  const secret = process.env.EINVOICE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const supplied = signature.replace(/^sha256=/, "");
  return expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

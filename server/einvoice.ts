import { createHash, createHmac, timingSafeEqual, verify } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import { companies, type Company, type Customer, type CreditNote, type EinvoiceQueue, type Invoice, type InvoiceItem } from "@shared/schema";
import { db } from "./storage";
import { normalizeDanishCvr, safeSproomConnection, sproomConnectionForCompany, sproomConnectionForExternalId } from "./sproom-registry";

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

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function oioAddress(value: unknown, owner: string): string {
  const address = String(value || "").replace(/\s+/g, " ").trim();
  if (!address) throw new Error(`${owner} mangler en adresse, som kræves til OIOUBL.`);
  const structured = address.match(/^(.*?)(?:\s+(\d+[A-Za-z]?))?\s*,?\s+(\d{4})\s+(.+)$/);
  if (!structured) {
    return `<cac:PostalAddress><cbc:AddressFormatCode listAgencyID="320" listID="urn:oioubl:codelist:addressformatcode-1.1">Unstructured</cbc:AddressFormatCode><cac:AddressLine><cbc:Line>${xml(address)}</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>DK</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;
  }
  const [, street, buildingNumber, postalZone, city] = structured;
  return `<cac:PostalAddress><cbc:AddressFormatCode listAgencyID="320" listID="urn:oioubl:codelist:addressformatcode-1.1">StructuredDK</cbc:AddressFormatCode><cbc:StreetName>${xml(street.trim())}</cbc:StreetName>${buildingNumber ? `<cbc:BuildingNumber>${xml(buildingNumber)}</cbc:BuildingNumber>` : ""}<cbc:CityName>${xml(city.trim())}</cbc:CityName><cbc:PostalZone>${xml(postalZone)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DK</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;
}

function peppolAddress(value: unknown, owner: string): string {
  const address = String(value || "").replace(/\s+/g, " ").trim();
  if (!address) throw new Error(`${owner} mangler en adresse, som kræves til Peppol BIS.`);
  const structured = address.match(/^(.*?)(?:\s+(\d+[A-Za-z]?))?\s*,?\s+(\d{4})\s+(.+)$/);
  if (!structured) return `<cac:PostalAddress><cbc:StreetName>${xml(address)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>DK</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;
  const [, street, buildingNumber, postalZone, city] = structured;
  const streetLine = buildingNumber ? `${street.trim()} ${buildingNumber}` : street.trim();
  return `<cac:PostalAddress><cbc:StreetName>${xml(streetLine)}</cbc:StreetName><cbc:CityName>${xml(city.trim())}</cbc:CityName><cbc:PostalZone>${xml(postalZone)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DK</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;
}

function oioTaxScheme(): string {
  return `<cac:TaxScheme><cbc:ID schemeAgencyID="320" schemeID="urn:oioubl:id:taxschemeid-1.1">63</cbc:ID><cbc:Name>Moms</cbc:Name></cac:TaxScheme>`;
}

function oioTaxCategory(vatRate: number): string {
  const id = vatRate ? "StandardRated" : "ZeroRated";
  return `<cac:TaxCategory><cbc:ID schemeAgencyID="320" schemeID="urn:oioubl:id:taxcategoryid-1.1">${id}</cbc:ID><cbc:Percent>${vatRate}</cbc:Percent>${oioTaxScheme()}</cac:TaxCategory>`;
}

function oioPayment(company: Company, invoice: Invoice, currency: string): string {
  const bankDigits = String(company.bankAccount || "").replace(/\D/g, "");
  const dueDate = invoice.dueDate || invoice.issueDate;
  if (bankDigits.length >= 8) {
    const registrationNumber = bankDigits.slice(0, 4);
    const accountNumber = bankDigits.slice(4);
    return `<cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>42</cbc:PaymentMeansCode><cbc:PaymentDueDate>${xml(dueDate)}</cbc:PaymentDueDate><cbc:PaymentChannelCode listAgencyID="320" listID="urn:oioubl:codelist:paymentchannelcode-1.1">DK:BANK</cbc:PaymentChannelCode><cac:PayeeFinancialAccount><cbc:ID>${xml(accountNumber)}</cbc:ID><cbc:PaymentNote>${xml(invoice.invoiceNumber)}</cbc:PaymentNote><cac:FinancialInstitutionBranch><cbc:ID>${xml(registrationNumber)}</cbc:ID></cac:FinancialInstitutionBranch></cac:PayeeFinancialAccount></cac:PaymentMeans>`;
  }
  const iban = String(company.iban || "").replace(/\s/g, "").trim();
  if (iban) {
    return `<cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentDueDate>${xml(dueDate)}</cbc:PaymentDueDate><cac:PayeeFinancialAccount><cbc:ID schemeID="IBAN">${xml(iban)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>`;
  }
  throw new Error("Virksomheden mangler bankkonto eller IBAN til OIOUBL-betalingen.");
}

function endpoint(customer: Customer, format: EInvoiceFormat): { id: string; scheme: string } {
  const ean = String(customer.ean || "").replace(/\s/g, "");
  if (/^\d{13}$/.test(ean)) return { id: ean, scheme: format === "PEPPOL_BIS_3" ? "0088" : "GLN" };
  const cvr = String(customer.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
  if (/^\d{8}$/.test(cvr)) return { id: `DK${cvr}`, scheme: format === "PEPPOL_BIS_3" ? "0184" : "DK:CVR" };
  throw new Error("Kunden mangler et gyldigt GLN/EAN (13 cifre) eller CVR-nummer (8 cifre).");
}

function senderEndpoint(company: Company, format: EInvoiceFormat): { id: string; scheme: string } {
  const cvr = String(company.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cvr)) throw new Error("Virksomheden mangler et gyldigt CVR-nummer.");
  return { id: `DK${cvr}`, scheme: format === "PEPPOL_BIS_3" ? "0184" : "DK:CVR" };
}

function oioInvoiceLines(items: InvoiceItem[], currency: string): string {
  return items.map((item, index) => {
    const vat = Number(item.vatRate || 0);
    const lineTax = Number(item.amount || 0) * vat / 100;
    return `<cac:InvoiceLine><cbc:ID>${index + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="HUR">${quantity(item.quantity)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(item.amount)}</cbc:LineExtensionAmount><cac:OrderLineReference><cbc:LineID>${index + 1}</cbc:LineID></cac:OrderLineReference><cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${money(lineTax)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${money(item.amount)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${money(lineTax)}</cbc:TaxAmount>${oioTaxCategory(vat)}</cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>${xml(item.description)}</cbc:Description><cbc:Name>${xml(item.description)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${money(item.unitPrice)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="HUR">1</cbc:BaseQuantity><cbc:OrderableUnitFactorRate>1</cbc:OrderableUnitFactorRate></cac:Price></cac:InvoiceLine>`;
  }).join("");
}

function peppolInvoiceLines(items: InvoiceItem[], currency: string): string {
  return items.map((item, index) => {
    const vat = Number(item.vatRate || 0);
    return `<cac:InvoiceLine><cbc:ID>${index + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="HUR">${quantity(item.quantity)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(item.amount)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${xml(item.description)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${vat ? "S" : "Z"}</cbc:ID><cbc:Percent>${vat}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${money(item.unitPrice)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="HUR">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`;
  }).join("");
}

export function generateEInvoice(input: DocumentInput): { xml: string; recipientEndpointId: string; endpointScheme: string } {
  const { company, customer, invoice, format } = input;
  if (!input.items.length) throw new Error("Fakturaen har ingen fakturalinjer.");
  const receiver = endpoint(customer, format);
  const sender = senderEndpoint(company, format);
  const currency = company.currency || "DKK";
  const dueDate = invoice.dueDate || invoice.issueDate;
  const lineNet = input.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const calculatedVat = input.items.reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.vatRate || 0) / 100, 0);
  if (Math.abs(lineNet - Number(invoice.netAmount || 0)) > 0.02) throw new Error("Fakturalinjerne stemmer ikke med fakturaens nettobeløb.");
  if (Math.abs(calculatedVat - Number(invoice.vatAmount || 0)) > 0.02) throw new Error("Fakturalinjernes moms stemmer ikke med fakturaens momsbeløb.");
  if (Math.abs(lineNet + calculatedVat - Number(invoice.totalAmount || 0)) > 0.02) throw new Error("Netto, moms og total stemmer ikke på fakturaen.");

  const taxGroups = new Map<number, number>();
  for (const item of input.items) {
    const rate = Number(item.vatRate || 0);
    taxGroups.set(rate, (taxGroups.get(rate) || 0) + Number(item.amount || 0));
  }

  let document: string;
  if (format === "OIOUBL_2_1") {
    const documentUuid = stableUuid(`invoice:${company.cvr}:${invoice.id || invoice.invoiceNumber}`);
    const orderUuid = stableUuid(`order:${company.cvr}:${invoice.id || invoice.invoiceNumber}`);
    const customerCvr = String(customer.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
    const customerLegalId = /^\d{8}$/.test(customerCvr) ? `<cbc:CompanyID schemeID="DK:CVR">DK${customerCvr}</cbc:CompanyID>` : "";
    const supplierContact = company.email ? `<cac:Contact><cbc:ID>${xml(company.email)}</cbc:ID><cbc:Name>${xml(company.name)}</cbc:Name><cbc:ElectronicMail>${xml(company.email)}</cbc:ElectronicMail></cac:Contact>` : "";
    const customerContact = customer.email ? `<cac:Contact><cbc:ID>${xml(customer.email)}</cbc:ID><cbc:Name>${xml(customer.contactPerson || customer.contact || customer.name)}</cbc:Name><cbc:ElectronicMail>${xml(customer.email)}</cbc:ElectronicMail></cac:Contact>` : "";
    const parties = `<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="${sender.scheme}">${xml(sender.id)}</cbc:EndpointID><cac:PartyIdentification><cbc:ID schemeID="DK:CVR">${xml(sender.id)}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${xml(company.name)}</cbc:Name></cac:PartyName>${oioAddress(company.address, "Virksomheden")}<cac:PartyTaxScheme><cbc:CompanyID schemeID="DK:SE">${xml(sender.id)}</cbc:CompanyID>${oioTaxScheme()}</cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${xml(company.name)}</cbc:RegistrationName><cbc:CompanyID schemeID="DK:CVR">${xml(sender.id)}</cbc:CompanyID></cac:PartyLegalEntity>${supplierContact}</cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="${receiver.scheme}">${xml(receiver.id)}</cbc:EndpointID><cac:PartyIdentification><cbc:ID schemeID="${receiver.scheme}">${xml(receiver.id)}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${xml(customer.name)}</cbc:Name></cac:PartyName>${oioAddress(customer.address, "Kunden")}<cac:PartyLegalEntity><cbc:RegistrationName>${xml(customer.name)}</cbc:RegistrationName>${customerLegalId}</cac:PartyLegalEntity>${customerContact}</cac:Party></cac:AccountingCustomerParty>`;
    const subtotals = Array.from(taxGroups.entries()).map(([rate, taxable]) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${money(taxable)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${money(taxable * rate / 100)}</cbc:TaxAmount>${oioTaxCategory(rate)}</cac:TaxSubtotal>`).join("");
    const payment = oioPayment(company, invoice, currency);
    document = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:UBLVersionID>2.0</cbc:UBLVersionID><cbc:CustomizationID>OIOUBL-2.01</cbc:CustomizationID><cbc:ProfileID schemeAgencyID="320" schemeID="urn:oioubl:id:profileid-1.1">Procurement-OrdSimR-BilSim-1.0</cbc:ProfileID><cbc:ID>${xml(invoice.invoiceNumber)}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${documentUuid}</cbc:UUID><cbc:IssueDate>${xml(invoice.issueDate)}</cbc:IssueDate><cbc:InvoiceTypeCode listAgencyID="320" listID="urn:oioubl:codelist:invoicetypecode-1.1">380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode><cbc:AccountingCost>${xml(invoice.notes || invoice.invoiceNumber)}</cbc:AccountingCost><cac:OrderReference><cbc:ID>${xml(invoice.invoiceNumber)}</cbc:ID><cbc:UUID>${orderUuid}</cbc:UUID><cbc:IssueDate>${xml(invoice.issueDate)}</cbc:IssueDate></cac:OrderReference>${parties}<cac:Delivery><cbc:ActualDeliveryDate>${xml(invoice.issueDate)}</cbc:ActualDeliveryDate></cac:Delivery>${payment}<cac:PaymentTerms><cbc:ID>1</cbc:ID><cbc:PaymentMeansID>1</cbc:PaymentMeansID><cbc:Amount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:Amount></cac:PaymentTerms><cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${money(invoice.vatAmount)}</cbc:TaxAmount>${subtotals}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(invoice.netAmount)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${money(invoice.netAmount)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${oioInvoiceLines(input.items, currency)}</Invoice>`;
  } else {
    const customerCvr = String(customer.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
    const supplierVat = sender.id;
    const customerLegalId = /^\d{8}$/.test(customerCvr) ? `<cbc:CompanyID schemeID="0184">DK${customerCvr}</cbc:CompanyID>` : "";
    const buyerReference = customer.customerNumber || customer.contactPerson || customer.contact || invoice.invoiceNumber;
    const parties = `<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="${sender.scheme}">${xml(sender.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(company.name)}</cbc:Name></cac:PartyName>${peppolAddress(company.address, "Virksomheden")}<cac:PartyTaxScheme><cbc:CompanyID>${xml(supplierVat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${xml(company.name)}</cbc:RegistrationName><cbc:CompanyID schemeID="0184">${xml(sender.id)}</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="${receiver.scheme}">${xml(receiver.id)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(customer.name)}</cbc:Name></cac:PartyName>${peppolAddress(customer.address, "Kunden")}<cac:PartyLegalEntity><cbc:RegistrationName>${xml(customer.name)}</cbc:RegistrationName>${customerLegalId}</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`;
    const subtotals = Array.from(taxGroups.entries()).map(([rate, taxable]) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${money(taxable)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${money(taxable * rate / 100)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${rate ? "S" : "Z"}</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`).join("");
    const iban = String(company.iban || "").replace(/\s/g, "").trim();
    const bankDigits = String(company.bankAccount || "").replace(/\D/g, "");
    const accountId = iban || bankDigits.slice(4);
    if (!accountId) throw new Error("Virksomheden mangler bankkonto eller IBAN til Peppol-betalingen.");
    const payment = `<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode><cbc:PaymentID>${xml(invoice.invoiceNumber)}</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>${xml(accountId)}</cbc:ID>${iban ? "" : `<cac:FinancialInstitutionBranch><cbc:ID>${xml(bankDigits.slice(0, 4))}</cbc:ID></cac:FinancialInstitutionBranch>`}</cac:PayeeFinancialAccount></cac:PaymentMeans>`;
    document = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID><cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID><cbc:ID>${xml(invoice.invoiceNumber)}</cbc:ID><cbc:IssueDate>${xml(invoice.issueDate)}</cbc:IssueDate><cbc:DueDate>${xml(dueDate)}</cbc:DueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode><cbc:BuyerReference>${xml(buyerReference)}</cbc:BuyerReference>${parties}${payment}<cac:PaymentTerms><cbc:Note>Betales senest ${xml(dueDate)}</cbc:Note></cac:PaymentTerms><cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${money(invoice.vatAmount)}</cbc:TaxAmount>${subtotals}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(invoice.netAmount)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${money(invoice.netAmount)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${xml(currency)}">${money(invoice.totalAmount)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${peppolInvoiceLines(input.items, currency)}</Invoice>`;
  }
  return { xml: document, recipientEndpointId: receiver.id, endpointScheme: receiver.scheme };
}

export function generateECreditNote(input: { company: Company; customer: Customer; creditNote: CreditNote; originalInvoice: Invoice; format: EInvoiceFormat }) {
  const { company, customer, creditNote, originalInvoice, format } = input;
  const receiver = endpoint(customer, format);
  const sender = senderEndpoint(company, format);
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
  const sender = senderEndpoint(company, original.format === "PEPPOL_BIS_3" ? "PEPPOL_BIS_3" : "OIOUBL_2_1");
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
  const connection = companyId ? sproomConnectionForCompany(companyId) : null;
  let parentCvr = "";
  let platformCvr = "";
  try { parentCvr = normalizeDanishCvr(process.env.SPROOM_PARENT_CVR || process.env.PLATFORM_COMPANY_CVR); } catch {}
  try { platformCvr = normalizeDanishCvr(process.env.PLATFORM_COMPANY_CVR); } catch {}
  const parentMatchesPlatform = Boolean(parentCvr && (!platformCvr || parentCvr === platformCvr));
  const parentCompany = Boolean(companyId && parentCvr && sproomInternalCompanyCvr(companyId) === parentCvr);
  const mapped = parentCompany || Boolean((connection?.status === "forbundet" && connection.externalCompanyId) || (companyId && companyMap[String(companyId)]));
  const configured = provider === "sproom"
    ? Boolean(process.env.SPROOM_API_TOKEN && parentMatchesPlatform && (companyId ? mapped : true))
    : Boolean(process.env.EINVOICE_PROVIDER_URL && process.env.EINVOICE_PROVIDER_API_KEY);
  return {
    provider,
    configured,
    companyMapped: provider !== "sproom" || !companyId || mapped,
    masterConfigured: provider !== "sproom" || Boolean(process.env.SPROOM_API_TOKEN && parentMatchesPlatform),
    masterCvr: provider === "sproom" ? parentCvr || null : null,
    parentCompany,
    parentMatchesPlatform,
    automaticProvisioning: provider === "sproom" && /^(1|true|yes)$/i.test(String(process.env.SPROOM_AUTOMATIC_PROVISIONING || "")),
    automaticNemhandel: provider === "sproom" && /^(1|true|yes)$/i.test(String(process.env.SPROOM_AUTO_REGISTER_NEMHANDEL || "")),
    connection: safeSproomConnection(connection),
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
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string" && value.trim())
        .map(([key, value]) => [key, String(value).trim()]),
    );
  } catch {
    return {};
  }
}

function sproomParentCvr(): string {
  try { return normalizeDanishCvr(process.env.SPROOM_PARENT_CVR || process.env.PLATFORM_COMPANY_CVR); }
  catch { return ""; }
}

function sproomInternalCompanyCvr(companyId: number): string {
  const company = db.select({ cvr: companies.cvr }).from(companies).where(eq(companies.id, companyId)).get();
  try { return normalizeDanishCvr(company?.cvr); }
  catch { return ""; }
}

function sproomParentInternalCompanyId(): number | null {
  const parentCvr = sproomParentCvr();
  if (!parentCvr) return null;
  const match = db.select({ id: companies.id, cvr: companies.cvr }).from(companies).all()
    .find((company) => {
      try { return normalizeDanishCvr(company.cvr) === parentCvr; }
      catch { return false; }
    });
  return match?.id || null;
}

function isSproomParentCompany(companyId: number): boolean {
  const parentCvr = sproomParentCvr();
  return Boolean(parentCvr && sproomInternalCompanyCvr(companyId) === parentCvr);
}

function sproomCompanyId(companyId: number): string {
  const registry = sproomConnectionForCompany(companyId);
  const externalId = registry?.status === "forbundet" ? registry.externalCompanyId : sproomCompanyMap()[String(companyId)];
  if (!externalId) {
    if (registry) throw new Error("Virksomhedens Sproom-onboarding er endnu ikke godkendt og forbundet.");
    throw new Error(`Virksomhed ${companyId} er ikke knyttet til en Sproom-kundevirksomhed.`);
  }
  return externalId;
}

export function internalCompanyIdForSproom(externalCompanyId: string, companyIdentifier?: unknown): number | null {
  const registry = sproomConnectionForExternalId(externalCompanyId);
  if (registry?.status === "forbundet") return registry.companyId;
  const entry = Object.entries(sproomCompanyMap()).find(([, value]) => value === externalCompanyId);
  if (entry) return Number(entry[0]);
  const configuredParentId = String(process.env.SPROOM_PARENT_COMPANY_ID || "").trim();
  if (configuredParentId && externalCompanyId === configuredParentId) return sproomParentInternalCompanyId();
  if (companyIdentifier && typeof companyIdentifier === "object") {
    const identifier = companyIdentifier as { schemeId?: unknown; value?: unknown };
    if (String(identifier.schemeId || "").toUpperCase() === "DK:CVR") {
      try {
        if (normalizeDanishCvr(identifier.value) === sproomParentCvr()) return sproomParentInternalCompanyId();
      } catch { /* not a valid parent CVR */ }
    }
  }
  return null;
}

async function sproomCompanyToken(companyId: number): Promise<string> {
  const parentToken = process.env.SPROOM_API_TOKEN?.trim();
  if (!parentToken) throw new Error("Sproom API-token mangler.");
  // The master token authenticates the parent company itself. Creating the
  // parent again as its own child would violate Sproom's one-profile-per-CVR
  // model, so only customer CVRs use short-lived child tokens.
  if (isSproomParentCompany(companyId)) return parentToken;
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

export function sproomRequestId(payload: string, format: EInvoiceFormat, recipient: string): string {
  // Sproom begrænser X-Request-Id til 64 tegn. En deterministisk SHA-256 gør
  // genforsøg idempotente uden at dele fakturanummer eller andre kundedata.
  return createHash("sha256").update(`${format}\0${recipient}\0${payload}`).digest("hex");
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
    // Render may persist a pasted PEM with escaped CRLF sequences ("\\r\\n").
    // Normalize those before the more general escaped-LF form so a literal
    // "\\r" is not left in front of every decoded newline.
    const direct = process.env.SPROOM_WEBHOOK_PUBLIC_KEY
      ?.replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .trim();
    const encoded = process.env.SPROOM_WEBHOOK_PUBLIC_KEY_BASE64?.trim();
    const publicKey = direct || (encoded ? Buffer.from(encoded, "base64").toString("utf8") : "");
    if (!publicKey) return false;
    const normalizedSignature = signature
      .trim()
      .replace(/^sha256=/i, "")
      .replace(/^signature=/i, "")
      .replace(/^"|"$/g, "");
    return verify("RSA-SHA256", Buffer.from(raw, "utf8"), publicKey, Buffer.from(normalizedSignature, "base64"));
  } catch {
    return false;
  }
}

let cachedSproomWebhookKey: { value: string; expiresAt: number } | null = null;

function normalizeSproomPublicKey(value: string | undefined): string {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();
}

function verifySproomSignatureWithKey(raw: string, signature: string | undefined, publicKey: string): boolean {
  if (!signature || !publicKey) return false;
  try {
    const normalizedSignature = signature
      .trim()
      .replace(/^sha256=/i, "")
      .replace(/^signature=/i, "")
      .replace(/^"|"$/g, "");
    return verify("RSA-SHA256", Buffer.from(raw, "utf8"), publicKey, Buffer.from(normalizedSignature, "base64"));
  } catch {
    return false;
  }
}

async function currentSproomWebhookKey(): Promise<string> {
  if (cachedSproomWebhookKey && cachedSproomWebhookKey.expiresAt > Date.now()) return cachedSproomWebhookKey.value;
  const token = process.env.SPROOM_API_TOKEN?.trim();
  if (!token) return "";
  try {
    const response = await fetch(`${sproomBaseUrl()}/webhooks/key`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return "";
    const body = await response.json() as { publicKey?: string };
    const value = normalizeSproomPublicKey(body.publicKey);
    if (!value) return "";
    cachedSproomWebhookKey = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
    return value;
  } catch {
    return "";
  }
}

export async function verifySproomWebhookSignature(raw: string, signature?: string): Promise<boolean> {
  const providerKey = await currentSproomWebhookKey();
  if (verifySproomSignatureWithKey(raw, signature, providerKey)) return true;
  return verifySproomSignature(raw, signature);
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
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-Request-Id": sproomRequestId(payload, format, recipient),
      },
      body: Buffer.from(payload, "utf8"),
    });
    const body = await response.text();
    if (response.status === 409) {
      try {
        const existing = String(JSON.parse(body)?.documentId || "").trim();
        if (existing) return { messageId: existing, response: body.slice(0, 2000), duplicate: true };
      } catch { /* fall through to the normal provider error */ }
    }
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

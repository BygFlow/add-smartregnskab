import PDFDocument from "pdfkit";
import type { Company, Customer, Invoice, InvoiceItem, PlatformInvoice } from "@shared/schema";

// ── Danske tal- og datoformater ──

export function kr(n: number): string {
  return n.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dkDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

const INK = "#1a1a1a";
const MUTED = "#6b7280";
const ACCENT = "#0f766e";
const LINE = "#e5e7eb";

function buffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/** Tegner en tabelrække og returnerer den nye y-position. */
function row(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: Array<{ text: string; x: number; w: number; align?: "left" | "right" }>,
  opts: { bold?: boolean; size?: number; color?: string } = {},
): number {
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.size ?? 9.5)
    .fillColor(opts.color ?? INK);
  let maxH = 0;
  for (const c of cols) {
    const h = doc.heightOfString(c.text, { width: c.w, align: c.align ?? "left" });
    maxH = Math.max(maxH, h);
    doc.text(c.text, c.x, y, { width: c.w, align: c.align ?? "left" });
  }
  return y + maxH;
}

// ══════════════════════════════════════════════════
//  Kundefaktura (virksomheden → deres kunde)
// ══════════════════════════════════════════════════

export async function invoicePdf(
  company: Company,
  customer: Customer,
  invoice: Invoice,
  items: InvoiceItem[],
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const L = 48;
  const R = 547; // højre kant af indhold
  const W = R - L;

  // Hoved
  doc.font("Helvetica-Bold").fontSize(17).fillColor(ACCENT)
    .text(company.name, L, 48, { width: W * 0.6 });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  const senderLines = [
    company.address, company.cvr ? `CVR ${company.cvr}` : null,
    company.phone, company.email,
  ].filter(Boolean) as string[];
  doc.text(senderLines.join("\n"), L, 72, { width: W * 0.55, lineGap: 1.5 });

  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK)
    .text("FAKTURA", L, 48, { width: W, align: "right" });
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
    .text(`Nr. ${invoice.invoiceNumber}`, L, 74, { width: W, align: "right" });

  // Modtager og datoer
  let y = 152;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("FAKTURERES TIL", L, y);
  doc.font("Helvetica").fontSize(10.5).fillColor(INK)
    .text(
      [customer.name, customer.address, customer.contact].filter(Boolean).join("\n"),
      L, y + 14, { width: W * 0.5, lineGap: 2 },
    );

  const metaX = L + W * 0.58;
  const meta: Array<[string, string]> = [
    ["Fakturadato", dkDate(invoice.issueDate)],
    ["Forfaldsdato", dkDate(invoice.dueDate)],
    ["Betalingsbetingelser", `Netto ${invoice.paymentTerms} dage`],
  ];
  let my = y + 14;
  for (const [k, v] of meta) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, metaX, my, { width: 110 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK)
      .text(v, metaX + 110, my, { width: W - W * 0.58 - 110, align: "right" });
    my += 16;
  }

  // Linjetabel
  y = Math.max(my, y + 76) + 22;
  const cBesk = { x: L, w: 232 };
  const cAnt = { x: L + 238, w: 58 };
  const cPris = { x: L + 302, w: 78 };
  const cMoms = { x: L + 386, w: 44 };
  const cBel = { x: L + 436, w: W - 436 + L - L };

  doc.rect(L, y - 6, W, 22).fill("#f8fafc");
  row(doc, y, [
    { text: "Beskrivelse", ...cBesk },
    { text: "Antal", ...cAnt, align: "right" },
    { text: "Enhedspris", ...cPris, align: "right" },
    { text: "Moms", ...cMoms, align: "right" },
    { text: "Beløb", x: cBel.x, w: R - cBel.x, align: "right" },
  ], { bold: true, size: 8.5, color: MUTED });
  y += 22;

  for (const it of items) {
    if (y > 690) { doc.addPage(); y = 60; }
    const end = row(doc, y, [
      { text: it.description, ...cBesk },
      { text: kr(it.quantity), ...cAnt, align: "right" },
      { text: kr(it.unitPrice), ...cPris, align: "right" },
      { text: `${it.vatRate}%`, ...cMoms, align: "right" },
      { text: kr(it.amount), x: cBel.x, w: R - cBel.x, align: "right" },
    ]);
    y = end + 8;
    doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.5).strokeColor(LINE).stroke();
    y += 4;
  }

  // Totaler
  y += 8;
  const tLabelX = L + W * 0.52;
  const tValW = 96;
  const totals: Array<[string, string, boolean]> = [
    ["Subtotal ekskl. moms", `${kr(invoice.netAmount)} kr.`, false],
    [`Moms ${invoice.vatRate}%`, `${kr(invoice.vatAmount)} kr.`, false],
    ["Total at betale", `${kr(invoice.totalAmount)} kr.`, true],
  ];
  for (const [label, value, strong] of totals) {
    if (strong) {
      doc.moveTo(tLabelX, y - 5).lineTo(R, y - 5).lineWidth(1).strokeColor(INK).stroke();
      y += 4;
    }
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 11 : 9.5)
      .fillColor(strong ? INK : MUTED)
      .text(label, tLabelX, y, { width: R - tLabelX - tValW - 8 });
    doc.font("Helvetica-Bold").fontSize(strong ? 11 : 9.5).fillColor(INK)
      .text(value, R - tValW, y, { width: tValW, align: "right" });
    y += strong ? 20 : 16;
  }

  // Noter og bundtekst
  if (invoice.notes) {
    y += 12;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("BEMÆRKNINGER", L, y);
    doc.font("Helvetica").fontSize(9.5).fillColor(INK)
      .text(invoice.notes, L, y + 13, { width: W * 0.6, lineGap: 2 });
  }

  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(
      `Betaling bedes indbetalt senest ${dkDate(invoice.dueDate)} med angivelse af fakturanummer ${invoice.invoiceNumber}.`,
      L, 762, { width: W, align: "center" },
    );

  return buffer(doc);
}

// ══════════════════════════════════════════════════
//  Abonnementsfaktura (ADD SmartRegnskab → virksomheden)
// ══════════════════════════════════════════════════

export async function platformInvoicePdf(
  company: Company,
  inv: PlatformInvoice,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const L = 48;
  const R = 547;
  const W = R - L;
  const platformName = process.env.PLATFORM_COMPANY_NAME || "ADD Multiservice ApS";
  const platformAddress = process.env.PLATFORM_COMPANY_ADDRESS || "";
  const platformCvr = process.env.PLATFORM_COMPANY_CVR || "";
  const platformInvoiceEmail = process.env.PLATFORM_INVOICE_EMAIL || "regnskab@addsmartregnskab.dk";

  doc.font("Helvetica-Bold").fontSize(17).fillColor(ACCENT).text("ADD SmartRegnskab", L, 48);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text([platformName, platformAddress, platformCvr ? `CVR ${platformCvr}` : null, platformInvoiceEmail].filter(Boolean).join("\n"), L, 72, { lineGap: 1.5 });

  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK)
    .text("ABONNEMENT", L, 48, { width: W, align: "right" });
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
    .text(`Nr. ${inv.invoiceNumber}`, L, 74, { width: W, align: "right" });

  let y = 158;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("FAKTURERES TIL", L, y);
  doc.font("Helvetica").fontSize(10.5).fillColor(INK)
    .text(
      [company.name, company.address, company.cvr ? `CVR ${company.cvr}` : null]
        .filter(Boolean).join("\n"),
      L, y + 14, { width: W * 0.5, lineGap: 2 },
    );

  const metaX = L + W * 0.58;
  let my = y + 14;
  for (const [k, v] of [
    ["Fakturadato", dkDate(inv.issueDate)],
    ["Forfaldsdato", dkDate(inv.dueDate)],
    ["Periode", `${dkDate(inv.periodStart)} – ${dkDate(inv.periodEnd)}`],
  ] as Array<[string, string]>) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, metaX, my, { width: 100 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK)
      .text(v, metaX + 100, my, { width: R - metaX - 100, align: "right" });
    my += 16;
  }

  y = Math.max(my, y + 74) + 24;
  doc.rect(L, y - 6, W, 22).fill("#f8fafc");
  row(doc, y, [
    { text: "Ydelse", x: L, w: 300 },
    { text: "Antal", x: L + 310, w: 70, align: "right" },
    { text: "Beløb", x: L + 390, w: R - L - 390, align: "right" },
  ], { bold: true, size: 8.5, color: MUTED });
  y += 24;

  y = row(doc, y, [
    { text: `Pakken ${inv.planName} — abonnement`, x: L, w: 300 },
    { text: `${inv.employeeCount} ansatte`, x: L + 310, w: 70, align: "right" },
    { text: `${kr(inv.netAmount)} kr.`, x: L + 390, w: R - L - 390, align: "right" },
  ]) + 10;

  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
  y += 14;

  const tLabelX = L + W * 0.52;
  const tValW = 96;
  for (const [label, value, strong] of [
    ["Subtotal ekskl. moms", `${kr(inv.netAmount)} kr.`, false],
    ["Moms 25%", `${kr(inv.vatAmount)} kr.`, false],
    ["Total at betale", `${kr(inv.totalAmount)} kr.`, true],
  ] as Array<[string, string, boolean]>) {
    if (strong) {
      doc.moveTo(tLabelX, y - 5).lineTo(R, y - 5).lineWidth(1).strokeColor(INK).stroke();
      y += 4;
    }
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 11 : 9.5)
      .fillColor(strong ? INK : MUTED)
      .text(label, tLabelX, y, { width: R - tLabelX - tValW - 8 });
    doc.font("Helvetica-Bold").fontSize(strong ? 11 : 9.5).fillColor(INK)
      .text(value, R - tValW, y, { width: tValW, align: "right" });
    y += strong ? 20 : 16;
  }

  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(`Tak for samarbejdet. Spørgsmål til fakturaen sendes til ${platformInvoiceEmail}.`,
      L, 762, { width: W, align: "center" });

  return buffer(doc);
}

/** Tilbud i samme layout som fakturaen, så kunden møder ét genkendeligt udtryk. */
export async function quotePdf(
  company: Company,
  customer: Customer,
  quote: {
    quoteNumber: string; title: string; description?: string | null;
    issueDate: string; validUntil?: string | null;
    netAmount: number; vatAmount: number; totalAmount: number;
  },
  items: Array<{ description: string; quantity: number; unit: string; unitPrice: number; amount: number }>,
  vatNote?: string | null,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const L = 48;
  const R = 547;
  const W = R - L;

  doc.font("Helvetica-Bold").fontSize(17).fillColor(ACCENT)
    .text(company.name, L, 48, { width: W * 0.6 });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  doc.text(
    [company.address, company.cvr ? `CVR ${company.cvr}` : null, company.phone, company.email]
      .filter(Boolean).join("\n"),
    L, 72, { width: W * 0.55, lineGap: 1.5 },
  );

  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK)
    .text("TILBUD", L, 48, { width: W, align: "right" });
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
    .text(`Nr. ${quote.quoteNumber}`, L, 74, { width: W, align: "right" });

  let y = 152;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("TILBUD TIL", L, y);
  doc.font("Helvetica").fontSize(10.5).fillColor(INK)
    .text([customer.name, customer.address, customer.contact].filter(Boolean).join("\n"),
      L, y + 14, { width: W * 0.5, lineGap: 2 });

  const metaX = L + W * 0.58;
  let my = y + 14;
  for (const [k, v] of [["Dato", dkDate(quote.issueDate)], ["Gyldigt til", dkDate(quote.validUntil)]] as Array<[string, string]>) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, metaX, my, { width: 110 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK)
      .text(v, metaX + 110, my, { width: W - W * 0.58 - 110, align: "right" });
    my += 16;
  }

  y = Math.max(my, y + 76) + 20;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(quote.title, L, y, { width: W });
  y = doc.y + 6;
  if (quote.description) {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
      .text(quote.description, L, y, { width: W, lineGap: 2 });
    y = doc.y + 10;
  }

  const cBesk = { x: L, w: 232 };
  const cAnt = { x: L + 238, w: 58 };
  const cPris = { x: L + 302, w: 78 };
  const cBel = { x: L + 386, w: R - (L + 386) };

  y = row(doc, y + 6, [
    { text: "Beskrivelse", ...cBesk },
    { text: "Antal", ...cAnt, align: "right" },
    { text: "Pris", ...cPris, align: "right" },
    { text: "Beløb", ...cBel, align: "right" },
  ], { bold: true, size: 9, color: MUTED });

  doc.moveTo(L, y + 2).lineTo(R, y + 2).strokeColor(LINE).lineWidth(0.8).stroke();
  y += 10;

  for (const it of items) {
    y = row(doc, y, [
      { text: it.description, ...cBesk },
      { text: `${it.quantity} ${it.unit}`, ...cAnt, align: "right" },
      { text: kr(it.unitPrice), ...cPris, align: "right" },
      { text: kr(it.amount), ...cBel, align: "right" },
    ]);
    y += 4;
  }

  doc.moveTo(L + 238, y + 4).lineTo(R, y + 4).strokeColor(LINE).lineWidth(0.8).stroke();
  y += 14;

  const sums: Array<[string, string, boolean]> = [
    ["Subtotal", kr(quote.netAmount), false],
    ["Moms", kr(quote.vatAmount), false],
    ["I alt", kr(quote.totalAmount), true],
  ];
  for (const [label, value, bold] of sums) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5)
      .fillColor(bold ? INK : MUTED)
      .text(label, L + 238, y, { width: 140, align: "right" });
    doc.font("Helvetica-Bold").fontSize(bold ? 11 : 9.5).fillColor(bold ? ACCENT : INK)
      .text(`${value} kr.`, L + 386, y, { width: R - (L + 386), align: "right" });
    y += bold ? 20 : 16;
  }

  if (vatNote) {
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
      .text(vatNote, L, y + 8, { width: W, lineGap: 1.5 });
    y = doc.y;
  }

  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(
      "Accepterer du tilbuddet, bliver det automatisk til en aftale i vores system, og de aftalte priser gælder fra første besøg.",
      L, Math.min(y + 18, 760), { width: W, lineGap: 1.5 },
    );

  return buffer(doc);
}

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { simpleParser } from "mailparser";
import { extractDeliveries, signedHeaders } from "../scripts/simply-imap-bridge.mjs";

const recipient = `bilag-${"a".repeat(32)}@addsmartregnskab.dk`;
const pdf = Buffer.from("%PDF-1.4\n%%EOF");

function parsedMail(to = recipient, parts = [pdf]) {
  return simpleParser([
    "From: supplier@example.com",
    `To: ${to}`,
    "Message-ID: <invoice-123@example.com>",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="test"',
    "", "--test", "Content-Type: text/plain", "", "Invoice attached.",
    ...parts.flatMap((part, index) => [
      "--test", "Content-Type: application/pdf", `Content-Disposition: attachment; filename="invoice-${index}.pdf"`,
      "Content-Transfer-Encoding: base64", "", part.toString("base64"),
    ]),
    "--test--", "",
  ].join("\r\n"));
}

test("Simply bridge routes each attachment to exactly one customer", async () => {
  const mail = await parsedMail(recipient, [pdf, pdf]);
  const result = extractDeliveries(mail, "addsmartregnskab.dk", 42);
  assert.equal(result.reason, null);
  assert.equal(result.deliveries.length, 2);
  assert.equal(result.deliveries[0].recipient, recipient);
  assert.equal(result.deliveries[0].sender, "supplier@example.com");
  assert.notEqual(result.deliveries[0].messageId, result.deliveries[1].messageId);
  assert.deepEqual(Buffer.from(result.deliveries[0].dataUrl.split(",")[1], "base64"), pdf);
});

test("Simply bridge rejects ambiguous or unknown customer routing", async () => {
  const ambiguous = await parsedMail(`${recipient}, bilag-${"b".repeat(32)}@addsmartregnskab.dk`);
  assert.match(extractDeliveries(ambiguous, "addsmartregnskab.dk", 43).reason, /præcis én/);
  const unrelated = await parsedMail("admin@addsmartregnskab.dk");
  assert.equal(extractDeliveries(unrelated, "addsmartregnskab.dk", 44).deliveries.length, 0);
});

test("Simply bridge signs exact webhook bytes", () => {
  const body = Buffer.from('{"recipient":"test"}');
  const headers = signedHeaders(body, "secret", "1234567890");
  const expected = createHmac("sha256", "secret").update("1234567890.").update(body).digest("hex");
  assert.equal(headers["x-document-signature"], expected);
});

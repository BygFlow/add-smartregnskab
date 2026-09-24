import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { simpleParser } from "mailparser";
import { extractDeliveries, pollOnce, signedHeaders } from "../scripts/simply-imap-bridge.mjs";

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

function fakeMailbox(uids) {
  const seen = new Set();
  const flagged = new Set();
  const searches = [];
  const client = {
    connect: async () => {}, logout: async () => {},
    getMailboxLock: async () => ({ release() {} }),
    search: async (query) => {
      searches.push(query);
      return uids.filter((uid) => !seen.has(uid) && !flagged.has(uid));
    },
    fetchOne: async (uid, query) => query.size ? { size: 100 } : { source: Buffer.from(String(uid)) },
    messageFlagsAdd: async (uid, flags) => {
      if (flags.includes("\\Seen")) seen.add(uid);
      if (flags.includes("\\Flagged")) flagged.add(uid);
    },
  };
  return { client, seen, flagged, searches };
}

function fakeParsed(uid) {
  return {
    to: { value: [{ address: Number(uid) === 26 || Number(uid) === 1 ? recipient : "other@example.com" }] },
    from: { value: [{ address: "supplier@example.com" }] },
    headers: new Map(), messageId: `<invoice-${uid}@example.com>`,
    attachments: [{ contentType: "application/pdf", content: pdf, filename: "invoice.pdf",
      contentDisposition: "attachment", related: false }],
  };
}

const pollConfig = { user: "machine@example.com", password: "test-password",
  domain: "addsmartregnskab.dk", secret: "test-secret", endpoint: "https://example.com/inbound" };

test("rejected unread messages are flagged for review and cannot starve later invoices", async () => {
  const mailbox = fakeMailbox(Array.from({ length: 26 }, (_, index) => index + 1));
  const accepted = [];
  const options = { clientFactory: () => mailbox.client,
    parseImpl: async (source) => Number(source.toString()) === 26 ? fakeParsed(26) : {
      ...fakeParsed(0), to: { value: [{ address: "other@example.com" }] },
    },
    fetchImpl: async (_url, request) => { accepted.push(JSON.parse(request.body.toString())); return { ok: true }; },
    warn: () => {},
  };
  await pollOnce(pollConfig, options);
  assert.equal(mailbox.flagged.size, 25);
  assert.equal(mailbox.seen.size, 0);
  assert.equal(accepted.length, 0);
  await pollOnce(pollConfig, options);
  assert.equal(mailbox.seen.has(26), true);
  assert.equal(accepted.length, 1);
  assert.deepEqual(mailbox.searches, [
    { seen: false, flagged: false }, { seen: false, flagged: false },
  ]);
});

test("a temporary receive-API failure stays unflagged and is retried", async () => {
  const mailbox = fakeMailbox([1]);
  let attempts = 0;
  const options = { clientFactory: () => mailbox.client,
    parseImpl: async () => fakeParsed(1),
    fetchImpl: async () => ({ ok: ++attempts > 1, status: attempts > 1 ? 200 : 503 }),
    warn: () => {},
  };
  await pollOnce(pollConfig, options);
  assert.equal(mailbox.flagged.size, 0);
  assert.equal(mailbox.seen.size, 0);
  await pollOnce(pollConfig, options);
  assert.equal(mailbox.seen.has(1), true);
  assert.equal(attempts, 2);
});

test("an unknown customer address is flagged instead of blocking the queue forever", async () => {
  const mailbox = fakeMailbox([1]);
  let attempts = 0;
  await pollOnce(pollConfig, { clientFactory: () => mailbox.client,
    parseImpl: async () => fakeParsed(1),
    fetchImpl: async () => { attempts += 1; return { ok: false, status: 404 }; },
    warn: () => {},
  });
  assert.equal(mailbox.flagged.has(1), true);
  assert.equal(mailbox.seen.size, 0);
  await pollOnce(pollConfig, { clientFactory: () => mailbox.client,
    parseImpl: async () => fakeParsed(1),
    fetchImpl: async () => { attempts += 1; return { ok: true }; },
    warn: () => {},
  });
  assert.equal(attempts, 1);
});

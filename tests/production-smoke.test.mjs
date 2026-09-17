import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { createHmac } from "node:crypto";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("SmartRegnskab production deployment migrates, starts and keeps bootstrap secrets private", { timeout: 45_000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), "smartregnskab-smoke-"));
  const files = join(temp, "files");
  await mkdir(files);
  const databasePath = join(temp, "smartregnskab.db");
  execFileSync(process.execPath, ["scripts/migrate-sqlite-prod.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: databasePath, BACKUP_DIR: join(temp, "migration-backups") },
    stdio: "pipe",
  });
  const existingDb = new Database(databasePath);
  try {
    existingDb.prepare(`INSERT INTO companies (name, email, status, kind, created_at)
      VALUES (?, ?, 'aktiv', 'platform', ?)`).run("Tidligere platform", "old-platform@example.test", new Date().toISOString());
    const insertLegacyPlan = existingDb.prepare(`INSERT INTO plans
      (name, slug, description, monthly_price, price_per_employee, max_employees, max_customers, features, sort_order, active)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 1)`);
    insertLegacyPlan.run("Start", "start", "Gammel driftspakke", 199, 5, 15, JSON.stringify(["opgaver", "tidsregistrering", "kunder", "fakturering"]), 1);
    insertLegacyPlan.run("Drift", "drift", "Gammel driftspakke", 499, 25, 100, JSON.stringify([
      "opgaver", "tidsregistrering", "kunder", "fakturering", "vagtplan", "fravaer", "fotodokumentation",
      "loen_eksport", "regnskab_eksport", "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler",
      "api_integration", "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "gdpr_vaerktoejer",
    ]), 2);
    insertLegacyPlan.run("Professionel", "professionel", "Gammel driftspakke", 999, -1, -1, JSON.stringify([
      "opgaver", "tidsregistrering", "kunder", "fakturering", "vagtplan", "fravaer", "fotodokumentation",
      "loen_eksport", "regnskab_eksport", "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler",
      "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "regnskab", "backup",
    ]), 3);
    insertLegacyPlan.run("Enterprise", "enterprise", "Gammel driftspakke", 1999, -1, -1, JSON.stringify([
      "opgaver", "tidsregistrering", "kunder", "fakturering", "vagtplan", "fravaer", "fotodokumentation",
      "loen_eksport", "regnskab_eksport", "geofence", "api_integration", "revisionsspor", "tilbud", "materialer",
      "kvalitetskontrol", "noegler", "gdpr_vaerktoejer", "skabeloner", "rengoringsservice", "rengoringsaftaler",
      "rengoringsplaner", "regnskab", "backup", "support_sla",
    ]), 4);
  } finally {
    existingDb.close();
  }
  const port = 5193;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["dist/index.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_PATH: databasePath,
      FILE_STORAGE_DIR: files,
      DISABLE_JOBS: "1",
      ENCRYPTION_KEY: "test-only-key-material-that-is-at-least-thirty-two-characters",
      PLATFORM_ADMIN_EMAIL: "bootstrap@example.test",
      PLATFORM_ADMIN_PASSWORD: "A-strong-bootstrap-password-2026",
      PLATFORM_COMPANY_NAME: "ADD SmartDrift ApS",
      PLATFORM_COMPANY_CVR: "46761898",
      PLATFORM_COMPANY_ADDRESS: "Lynæs Søpark 49, 3390 Hundested",
      APP_BASE_URL: base,
      ALLOWED_ORIGINS: base,
      EINVOICE_WEBHOOK_SECRET: "test-einvoice-webhook-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  try {
    let response;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) assert.fail(`server exited early (${child.exitCode}):\n${output}`);
      try {
        response = await fetch(`${base}/healthz`);
        if (response.ok) break;
      } catch {}
      await delay(250);
    }
    assert.ok(response?.ok, `server did not become healthy:\n${output}`);
    const health = await response.json();
    assert.deepEqual(Object.keys(health).sort(), ["status", "timestamp", "version"]);

    const readinessResponse = await fetch(`${base}/readyz`);
    assert.equal(readinessResponse.status, 200);
    const readiness = await readinessResponse.json();
    assert.equal(readiness.status, "ready");

    const backupDir = join(temp, "backups");
    execFileSync(process.execPath, ["scripts/backup-sqlite.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: join(temp, "smartregnskab.db"), BACKUP_DIR: backupDir },
      stdio: "pipe",
    });
    const backupFiles = (await readdir(backupDir)).filter((name) => name.endsWith(".db"));
    assert.equal(backupFiles.length, 1);
    const backupDb = new Database(join(backupDir, backupFiles[0]), { readonly: true });
    try {
      assert.equal(backupDb.pragma("quick_check", { simple: true }), "ok");
    } finally {
      backupDb.close();
    }

    const adminLogin = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bootstrap@example.test", password: "A-strong-bootstrap-password-2026" }),
    });
    assert.equal(adminLogin.status, 200);
    const sessionCookie = adminLogin.headers.get("set-cookie");
    assert.match(sessionCookie ?? "", /add_sr_session=/);
    assert.match(sessionCookie ?? "", /HttpOnly/i);
    const platformToken = (await adminLogin.json()).token;
    assert.ok(platformToken);
    const restoredSession = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: sessionCookie.split(";")[0] },
    });
    assert.equal(restoredSession.status, 200, "HttpOnly cookie must restore login after a page refresh");
    assert.equal((await restoredSession.json()).user.email, "bootstrap@example.test");
    const platformCompanyResponse = await fetch(`${base}/api/company`, { headers: { Authorization: `Bearer ${platformToken}` } });
    assert.equal(platformCompanyResponse.status, 200);
    const platformCompany = await platformCompanyResponse.json();
    assert.equal(platformCompany.name, "ADD SmartDrift ApS");
    assert.equal(platformCompany.cvr, "46761898");
    assert.equal(platformCompany.email, "bootstrap@example.test");
    const bootstrappedDb = new Database(databasePath, { readonly: true });
    try {
      assert.equal(bootstrappedDb.prepare("SELECT COUNT(*) AS count FROM companies WHERE kind = 'platform'").get().count, 1);
    } finally {
      bootstrappedDb.close();
    }
    assert.equal(platformCompany.address, "Lynæs Søpark 49, 3390 Hundested");

    const plansResponse = await fetch(`${base}/api/plans`, { headers: { Authorization: `Bearer ${platformToken}` } });
    const plans = await plansResponse.json();
    assert.ok(plans[0]?.id);
    assert.equal(plans.length, 4);
    const startFeatures = JSON.parse(plans.find((plan) => plan.slug === "start").features);
    const enterpriseFeatures = JSON.parse(plans.find((plan) => plan.slug === "enterprise").features);
    assert.ok(startFeatures.includes("fakturering"));
    assert.ok(startFeatures.includes("revisoradgang"));
    assert.ok(enterpriseFeatures.includes("konsolidering"));
    assert.ok(enterpriseFeatures.includes("support_sla"));

    const customPlanResponse = await fetch(`${base}/api/platform/plans`, {
      method: "POST",
      headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Testpakke", slug: "testpakke", description: "Test af redigerbare pakker",
        monthlyPrice: 299, pricePerEmployee: 0, maxEmployees: 5, maxCustomers: 50,
        features: JSON.stringify(["regnskab", "bilag", "fakturering"]), sortOrder: 9, active: 1,
      }),
    });
    assert.equal(customPlanResponse.status, 201);
    assert.deepEqual(JSON.parse((await customPlanResponse.json()).features), ["regnskab", "bilag", "fakturering"]);
    const companyResponse = await fetch(`${base}/api/platform/companies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Test ApS", adminName: "Testleder", adminEmail: "leader@example.test",
        adminPassword: "A-strong-leader-password-2026", planId: plans[0].id, trialDays: 14,
      }),
    });
    assert.equal(companyResponse.status, 201);
    const companyResult = await companyResponse.json();
    assert.ok(companyResult.company?.id);

    const platformCompanyList = await fetch(`${base}/api/platform/companies`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    });
    assert.equal(platformCompanyList.status, 200);
    const platformCompanyMetadata = (await platformCompanyList.json())[0];
    assert.equal(platformCompanyMetadata.name, "Smoke Test ApS");
    assert.equal(Object.hasOwn(platformCompanyMetadata, "bankAccount"), false, "platform metadata must not expose bank details");
    assert.equal(Object.hasOwn(platformCompanyMetadata, "invoiceStandardText"), false, "platform metadata must not expose accounting settings");

    const blockedAccounting = await fetch(`${base}/api/regnskabssystem/${companyResult.company.id}`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    });
    assert.equal(blockedAccounting.status, 403, "platform admin must not open a customer's ledger");
    assert.equal((await blockedAccounting.json()).code, "platform_customer_data_blocked");
    assert.equal((await fetch(`${base}/api/customers?companyId=${companyResult.company.id}`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    })).status, 403, "platform admin must not list a customer's contacts");

    const leaderLogin = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "leader@example.test", password: "A-strong-leader-password-2026" }),
    });
    assert.equal(leaderLogin.status, 200);
    const leaderToken = (await leaderLogin.json()).token;
    const assistantResponse = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Assistent", email: "assistant@example.test", password: "A-strong-assistant-password", role: "assistent" }),
    });
    assert.equal(assistantResponse.status, 201);
    const forbiddenRole = await fetch(`${base}/api/users`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Forkert rolle", email: "wrong-role@example.test", password: "A-strong-password-2026", role: "revisor" }),
    });
    assert.equal(forbiddenRole.status, 400);
    const assistantLogin = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "assistant@example.test", password: "A-strong-assistant-password" }),
    });
    assert.equal(assistantLogin.status, 200);
    const assistantToken = (await assistantLogin.json()).token;
    assert.equal((await fetch(`${base}/api/invoices`, { headers: { Authorization: `Bearer ${assistantToken}` } })).status, 403);
    assert.equal((await fetch(`${base}/api/ai-governance`, { headers: { Authorization: `Bearer ${assistantToken}` } })).status, 403);

    const governanceResponse = await fetch(`${base}/api/ai-governance`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    assert.equal(governanceResponse.status, 200);
    const governance = await governanceResponse.json();
    assert.equal(governance.settings.targetAutonomyPercent, 99);
    assert.equal(governance.settings.minimumConfidence, 0.98);
    assert.ok(governance.settings.approvalActions.includes("payment"));
    assert.ok(governance.settings.approvalActions.includes("audit_statement"));

    const aiDecisionResponse = await fetch(`${base}/api/ai-governance/decisions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: "payment", recommendation: "Betal leverandørfaktura", reasoning: "Forfalden faktura",
        confidence: 0.999, riskLevel: "lav", evidence: ["invoice:1"],
      }),
    });
    assert.equal(aiDecisionResponse.status, 201);
    assert.equal((await aiDecisionResponse.json()).status, "afventer_godkendelse");

    const invalidAiDecision = await fetch(`${base}/api/ai-governance/decisions`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "categorize", recommendation: "Bogfør", reasoning: "Test", confidence: 1, riskLevel: "ukendt", evidence: ["voucher:1"] }),
    });
    assert.equal(invalidAiDecision.status, 400);

    const supportKnowledge = await fetch(`${base}/api/support/knowledge`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(supportKnowledge.status, 200);
    assert.ok((await supportKnowledge.json()).articles.length >= 8);
    const adaptersResponse = await fetch(`${base}/api/integration-adapters/status`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(adaptersResponse.status, 200);
    assert.ok((await adaptersResponse.json()).adapters.some((item) => item.id === "nemhandel"));
    const aiiaStatusResponse = await fetch(`${base}/api/bank/aiia/status`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(aiiaStatusResponse.status, 200);
    const aiiaStatus = await aiiaStatusResponse.json();
    assert.equal(aiiaStatus.configured, false);
    assert.equal(aiiaStatus.connected, false);
    const blockedAiiaConnect = await fetch(`${base}/api/bank/aiia/connect`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(blockedAiiaConnect.status, 503);
    const paymentStatusResponse = await fetch(`${base}/api/payment/status`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(paymentStatusResponse.status, 200);
    const paymentStatus = await paymentStatusResponse.json();
    assert.ok(paymentStatus.providers.some((provider) => provider.id === "quickpay" && provider.configured === false));
    const blockedQuickpaySetup = await fetch(`${base}/api/payment/setup/quickpay`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(blockedQuickpaySetup.status, 503);
    const unsignedQuickpayCallback = await fetch(`${base}/api/webhooks/quickpay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: 123, type: "Payment", accepted: true, state: "processed" }) });
    assert.equal(unsignedQuickpayCallback.status, 400);

    const importContent = "Leverandørnavn;CVR;Email\nSmoke Leverandør ApS;11223344;invoice@supplier.example";
    const importPreviewResponse = await fetch(`${base}/api/migration/preview`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ source: "economic", entity: "suppliers", content: importContent }) });
    assert.equal(importPreviewResponse.status, 200);
    const importPreview = await importPreviewResponse.json();
    assert.equal(importPreview.validRows, 1);
    const tamperedImport = await fetch(`${base}/api/migration/commit`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ source: "economic", entity: "suppliers", content: `${importContent}\nAnden;99887766;x@y.dk`, token: importPreview.token }) });
    assert.equal(tamperedImport.status, 409);
    const importCommitResponse = await fetch(`${base}/api/migration/commit`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ source: "economic", entity: "suppliers", content: importContent, token: importPreview.token, fileName: "suppliers.csv" }) });
    assert.equal(importCommitResponse.status, 201);
    const imported = await importCommitResponse.json();
    assert.equal(imported.importedRows, 1);
    const rollbackResponse = await fetch(`${base}/api/migration-jobs/${imported.job.id}/rollback`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(rollbackResponse.status, 200);
    assert.equal((await rollbackResponse.json()).removedRows, 1);

    const controlCenterResponse = await fetch(`${base}/api/accounting-control-center`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    assert.equal(controlCenterResponse.status, 200);
    const controlCenter = await controlCenterResponse.json();
    assert.equal(typeof controlCenter.score, "number");
    assert.equal(controlCenter.legal.registeredBookkeepingSystem, "not_verified");

    const companyUpdate = await fetch(`${base}/api/company`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cvr: "12345678", address: "Testvej 1, 2100 København Ø", email: "company@example.test", iban: "DK5000400440116243", currency: "DKK" }),
    });
    assert.equal(companyUpdate.status, 200);
    const customerResponse = await fetch(`${base}/api/customers`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "NemHandel Kunde", email: "customer@example.test", cvr: "87654321", ean: "5790001234567", address: "Testgade 2, 2100 København Ø" }),
    });
    assert.equal(customerResponse.status, 201);
    const customer = await customerResponse.json();
    const invoiceResponse = await fetch(`${base}/api/invoices`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id, issueDate: "2026-09-08", items: [{ description: "Rådgivning", quantity: 1, unitPrice: 1000, vatRate: 25 }] }),
    });
    assert.equal(invoiceResponse.status, 201);
    const invoice = await invoiceResponse.json();
    const onboardingResponse = await fetch(`${base}/api/onboarding/status`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(onboardingResponse.status, 200);
    const onboarding = await onboardingResponse.json();
    assert.equal(onboarding.total, 5);
    assert.ok(onboarding.completed >= 2);
    const einvoiceStatus = await fetch(`${base}/api/einvoice-queue/status`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(einvoiceStatus.status, 200);
    assert.equal((await einvoiceStatus.json()).configured, false);
    const electronicResponse = await fetch(`${base}/api/einvoice-queue/from-invoice`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, format: "PEPPOL_BIS_3" }),
    });
    assert.equal(electronicResponse.status, 201);
    const electronic = await electronicResponse.json();
    assert.equal(electronic.validationStatus, "lokal_godkendt");
    const xmlDownload = await fetch(`${base}/api/einvoice-queue/${electronic.id}/download`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(xmlDownload.status, 200);
    const invoiceXml = await xmlDownload.text();
    assert.match(invoiceXml, /peppol\.eu:2017:poacc:billing:3\.0/);
    const blockedSend = await fetch(`${base}/api/einvoice-queue/${electronic.id}/send`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(blockedSend.status, 409);
    assert.match((await blockedSend.json()).error, /bestå validering/);

    const markInvoiceSent = await fetch(`${base}/api/invoices/${invoice.id}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sendt" }),
    });
    assert.equal(markInvoiceSent.status, 409);
    const sendInvoice = await fetch(`${base}/api/invoices/${invoice.id}/send`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(sendInvoice.status, 200);
    const creditResponse = await fetch(`${base}/api/credit-notes`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, amount: 125, reason: "Smoke-test kreditering" }),
    });
    assert.equal(creditResponse.status, 201);
    const creditNote = await creditResponse.json();
    assert.equal((await fetch(`${base}/api/credit-notes/${creditNote.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${leaderToken}` } })).status, 409);
    const electronicCreditResponse = await fetch(`${base}/api/einvoice-queue/from-credit-note`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ creditNoteId: creditNote.id, format: "PEPPOL_BIS_3" }),
    });
    assert.equal(electronicCreditResponse.status, 201);
    const electronicCredit = await electronicCreditResponse.json();
    const creditXmlResponse = await fetch(`${base}/api/einvoice-queue/${electronicCredit.id}/download`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.match(await creditXmlResponse.text(), /<CreditNote\b/);

    const inboundBody = JSON.stringify({ companyId: companyResult.company.id, format: "PEPPOL_BIS_3", messageId: "smoke-inbound-1", documentBase64: Buffer.from(invoiceXml).toString("base64") });
    const inboundSignature = createHmac("sha256", "test-einvoice-webhook-secret").update(inboundBody).digest("hex");
    const inboundResponse = await fetch(`${base}/api/einvoice/inbound`, { method: "POST", headers: { "Content-Type": "application/json", "X-Einvoice-Signature": inboundSignature }, body: inboundBody });
    assert.equal(inboundResponse.status, 201);
    const inbound = await inboundResponse.json();
    const duplicateInbound = await fetch(`${base}/api/einvoice/inbound`, { method: "POST", headers: { "Content-Type": "application/json", "X-Einvoice-Signature": inboundSignature }, body: inboundBody });
    assert.equal(duplicateInbound.status, 200);
    assert.equal((await duplicateInbound.json()).duplicate, true);
    const rejectedWebhook = await fetch(`${base}/api/einvoice/inbound`, { method: "POST", headers: { "Content-Type": "application/json", "X-Einvoice-Signature": "invalid" }, body: inboundBody });
    assert.equal(rejectedWebhook.status, 401);
    const responseDocument = await fetch(`${base}/api/einvoice-queue/${inbound.id}/respond`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ responseType: "invoice_response", accepted: true }) });
    assert.equal(responseDocument.status, 201);
    const responseRow = await responseDocument.json();
    const responseXml = await fetch(`${base}/api/einvoice-queue/${responseRow.id}/download`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.match(await responseXml.text(), /<ApplicationResponse\b/);
    const createdAccounts = [];
    for (const account of [
      { accountNumber: "1010", standardAccountNumber: "1010", name: "Salg", type: "indtaegt" },
      { accountNumber: "6190", standardAccountNumber: "6190", name: "Debitorer", type: "aktiv" },
    ]) {
      const accountResponse = await fetch(`${base}/api/accounts`, {
        method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: JSON.stringify(account),
      });
      assert.equal(accountResponse.status, 200);
      createdAccounts.push(await accountResponse.json());
    }
    const entryResponse = await fetch(`${base}/api/journal-entries`, {
      method: "POST",
      headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entryNumber: "SMOKE-1", date: "2026-09-08", description: "SAF-T smoke test", status: "bogført", lines: [
        { accountId: createdAccounts[1].id, description: "Debitor", debit: 125, credit: 0 },
        { accountId: createdAccounts[0].id, description: "Salg", debit: 0, credit: 125 },
      ] }),
    });
    assert.equal(entryResponse.status, 200);
    const entry = await entryResponse.json();
    const lockedDelete = await fetch(`${base}/api/journal-entries/${entry.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(lockedDelete.status, 409);
    const saftStatus = await fetch(`${base}/api/saft/status`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(saftStatus.status, 200);
    assert.equal((await saftStatus.json()).ready, true);
    const saftExport = await fetch(`${base}/api/saft/export?from=2026-01-01&to=2026-12-31`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    assert.equal(saftExport.status, 200);
    const saftXml = await saftExport.text();
    assert.match(saftXml, /<AuditFileVersion>2\.1<\/AuditFileVersion>/);
    assert.match(saftXml, /<TransactionID>SMOKE-1<\/TransactionID>/);
    const saftPreview = await fetch(`${base}/api/saft/import/preview`, { method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/xml" }, body: saftXml });
    assert.equal(saftPreview.status, 200);
    const preview = await saftPreview.json();
    assert.deepEqual(preview.errors, []);
    assert.equal(preview.entries.length, 1);
    assert.equal(preview.totalDebit, preview.totalCredit);

    const operationsResponse = await fetch(`${base}/api/operations/status`, { headers: { Authorization: `Bearer ${platformToken}` } });
    assert.equal(operationsResponse.status, 200);
    const operations = await operationsResponse.json();
    assert.equal(operations.version, "3.11.9");
    assert.ok(operations.services.some((item) => item.id === "database" && item.status === "ok"));
    assert.equal((await fetch(`${base}/api/platform/jobs`, { headers: { Authorization: `Bearer ${platformToken}` } })).status, 200);
    assert.equal((await fetch(`${base}/api/platform/professionals`, { headers: { Authorization: `Bearer ${platformToken}` } })).status, 200);
    assert.equal((await fetch(`${base}/api/platform/gdpr`, { headers: { Authorization: `Bearer ${platformToken}` } })).status, 200);

    const supportCaseResponse = await fetch(`${base}/api/support-cases`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Hjælp til faktura", message: "Hvordan sender jeg en faktura?", priority: "normal" }),
    });
    assert.equal(supportCaseResponse.status, 200);
    const supportCase = await supportCaseResponse.json();
    const supportAiResponse = await fetch(`${base}/api/support-cases/${supportCase.id}/ai-reply`, { method: "POST", headers: { Authorization: `Bearer ${platformToken}` } });
    assert.equal(supportAiResponse.status, 200);
    assert.match((await supportAiResponse.json()).reply, /faktura/i);

    const companyTwoResponse = await fetch(`${base}/api/platform/companies`, {
      method: "POST", headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Isoleret ApS", adminName: "Anden leder", adminEmail: "second@example.test", adminPassword: "A-strong-second-password-2026", planId: plans[0].id, trialDays: 14 }),
    });
    assert.equal(companyTwoResponse.status, 201);
    const companyTwoResult = await companyTwoResponse.json();
    const secondLogin = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "second@example.test", password: "A-strong-second-password-2026" }) });
    const secondToken = (await secondLogin.json()).token;

    const professionalInvite = await fetch(`${base}/api/professional/invite`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "second@example.test", role: "revisor" }),
    });
    assert.equal(professionalInvite.status, 201);
    const professionalClients = await fetch(`${base}/api/professional/clients`, { headers: { Authorization: `Bearer ${secondToken}` } });
    assert.equal(professionalClients.status, 200);
    assert.equal((await professionalClients.json()).clients.length, 2);
    const switchToClient = await fetch(`${base}/api/professional/switch-company`, {
      method: "POST", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyResult.company.id }),
    });
    assert.equal(switchToClient.status, 200);
    assert.equal((await fetch(`${base}/api/invoices`, { headers: { Authorization: `Bearer ${secondToken}` } })).status, 403, "MFA must be fail-closed for professionals");
    const liveDb = new Database(join(temp, "smartregnskab.db"));
    try { liveDb.prepare("UPDATE users SET two_factor_enabled = 1 WHERE email = ?").run("second@example.test"); } finally { liveDb.close(); }
    assert.equal((await fetch(`${base}/api/invoices`, { headers: { Authorization: `Bearer ${secondToken}` } })).status, 200);
    assert.equal((await fetch(`${base}/api/professional/team`, { headers: { Authorization: `Bearer ${secondToken}` } })).status, 403);
    assert.equal((await fetch(`${base}/api/professional/invite`, {
      method: "POST", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unauthorized@example.test", role: "revisor" }),
    })).status, 403);
    assert.equal((await fetch(`${base}/api/invoices`, {
      method: "POST", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" }, body: JSON.stringify({}),
    })).status, 403, "auditor access must be read-only");
    assert.equal((await fetch(`${base}/api/regnskabssystem/dashboard/${companyResult.company.id}`, { headers: { Authorization: `Bearer ${secondToken}` } })).status, 200);
    assert.equal((await fetch(`${base}/api/regnskabssystem/dashboard/${companyTwoResult.company.id}`, { headers: { Authorization: `Bearer ${secondToken}` } })).status, 403);
    const approvalCreate = await fetch(`${base}/api/professional/approvals`, {
      method: "POST", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Godkend smoke-moms", approvalType: "moms" }),
    });
    assert.equal(approvalCreate.status, 201);
    const approval = await approvalCreate.json();
    const selfApproval = await fetch(`${base}/api/professional/approvals/${approval.id}/decision`, {
      method: "PATCH", headers: { Authorization: `Bearer ${leaderToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approved" }),
    });
    assert.equal(selfApproval.status, 409);
    const approvalDecision = await fetch(`${base}/api/professional/approvals/${approval.id}/decision`, {
      method: "PATCH", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approved" }),
    });
    assert.equal(approvalDecision.status, 200);
    assert.equal((await approvalDecision.json()).status, "approved");
    const repeatedDecision = await fetch(`${base}/api/professional/approvals/${approval.id}/decision`, {
      method: "PATCH", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ decision: "rejected" }),
    });
    assert.equal(repeatedDecision.status, 409);
    const switchHome = await fetch(`${base}/api/professional/switch-company`, {
      method: "POST", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyTwoResult.company.id }),
    });
    assert.equal(switchHome.status, 200);

    const secondCustomerResponse = await fetch(`${base}/api/customers`, { method: "POST", headers: { Authorization: `Bearer ${secondToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Hemmelig kunde" }) });
    assert.equal(secondCustomerResponse.status, 201);
    const secondCustomer = await secondCustomerResponse.json();
    assert.equal((await fetch(`${base}/api/customers/${secondCustomer.id}`, { headers: { Authorization: `Bearer ${leaderToken}` } })).status, 404);

    const demoLogin = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "platform@smartregnskab.dk", password: "demo1234" }),
    });
    assert.equal(demoLogin.status, 401);

    const forgot = await fetch(`${base}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bootstrap@example.test" }),
    });
    assert.equal(forgot.status, 200);
    assert.equal(Object.hasOwn(await forgot.json(), "demoToken"), false);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(temp, { recursive: true, force: true });
  }
});

test("legacy production database is upgraded in place before login", { timeout: 45_000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), "smartregnskab-legacy-startup-"));
  const files = join(temp, "files");
  await mkdir(files);
  const databasePath = join(temp, "legacy.db");
  const initialSql = await readFile(join(process.cwd(), "migrations", "0000_initial.sql"), "utf8");
  const legacyDb = new Database(databasePath);
  try {
    legacyDb.exec(initialSql.replaceAll("--> statement-breakpoint", ""));
  } finally {
    legacyDb.close();
  }

  const port = 5194;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["dist/index.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_PATH: databasePath,
      FILE_STORAGE_DIR: files,
      DISABLE_JOBS: "1",
      ENCRYPTION_KEY: "test-only-key-material-that-is-at-least-thirty-two-characters",
      PLATFORM_ADMIN_EMAIL: "legacy-admin@example.test",
      PLATFORM_ADMIN_PASSWORD: "A-strong-legacy-password-2026",
      PLATFORM_COMPANY_NAME: "ADD SmartDrift ApS",
      PLATFORM_COMPANY_CVR: "46761898",
      PLATFORM_COMPANY_ADDRESS: "Lynæs Søpark 49, 3390 Hundested",
      APP_BASE_URL: base,
      ALLOWED_ORIGINS: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  try {
    let response;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) assert.fail(`legacy server exited early (${child.exitCode}):\n${output}`);
      try {
        response = await fetch(`${base}/healthz`);
        if (response.ok) break;
      } catch {}
      await delay(250);
    }
    assert.ok(response?.ok, `legacy server did not become healthy:\n${output}`);

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "legacy-admin@example.test", password: "A-strong-legacy-password-2026" }),
    });
    assert.equal(login.status, 200, await login.text());

    const upgraded = new Database(databasePath, { readonly: true });
    try {
      const sessionColumns = upgraded.prepare("PRAGMA table_info(sessions)").all().map((column) => column.name);
      assert.ok(sessionColumns.includes("active_company_id"));
      const bankColumns = upgraded.prepare("PRAGMA table_info(bank_transactions)").all().map((column) => column.name);
      assert.ok(bankColumns.includes("external_id"));
      assert.equal(upgraded.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'professional_memberships'").get()?.name, "professional_memberships");
    } finally {
      upgraded.close();
    }
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(temp, { recursive: true, force: true });
  }
});

test("production migration script backs up and applies checked-in migrations", async () => {
  const temp = await mkdtemp(join(tmpdir(), "smartregnskab-migrate-test-"));
  const databasePath = join(temp, "legacy.db");
  const backupDir = join(temp, "backups");
  new Database(databasePath).close();
  try {
    execFileSync(process.execPath, ["scripts/migrate-sqlite-prod.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: databasePath, BACKUP_DIR: backupDir },
      stdio: "pipe",
    });
    const migrated = new Database(databasePath, { readonly: true });
    try {
      const row = migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'companies'").get();
      assert.equal(row?.name, "companies");
      const columns = migrated.prepare("PRAGMA table_info(bank_transactions)").all().map((column) => column.name);
      assert.ok(columns.includes("external_id"));
      assert.ok(columns.includes("account_ref"));
      assert.ok(columns.includes("provider"));
    } finally {
      migrated.close();
    }
    assert.equal((await readdir(backupDir)).filter((name) => name.endsWith(".db")).length, 1);
    const restoreOutput = execFileSync(process.execPath, ["scripts/restore-drill.mjs"], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, encoding: "utf8",
    });
    const restoreResult = JSON.parse(restoreOutput);
    assert.equal(restoreResult.ok, true);
    assert.equal(restoreResult.integrity, "ok");
    assert.ok(restoreResult.tableCount > 10);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "smartregnskab-smoke-"));
const port = 5300 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/index.cjs"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    APP_BASE_URL: base,
    DATABASE_PATH: join(root, "data.db"),
    FILE_STORAGE_DIR: join(root, "files"),
    BACKUP_DIR: join(root, "backups"),
    ENCRYPTION_KEY: "smoke-test-only-0123456789abcdef0123456789abcdef",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return { response, body };
}

async function requestStatus(path, expectedStatus, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method || "GET"} ${path}: forventede ${expectedStatus}, fik ${response.status} ${JSON.stringify(body)}`);
  }
  return { response, body };
}

try {
  let ready;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = await request("/readyz"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  if (!ready || ready.body.status !== "ready") throw new Error("Serveren blev ikke klar.");
  const signup = await request("/api/signup", { method: "POST", body: JSON.stringify({ email: "smoke@example.test", name: "Smoke Leder", companyName: "Smoke ApS", password: "Sikker!Smoke2026" }) });
  if (!signup.body.ok) throw new Error("Tilmelding fejlede.");
  const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "smoke@example.test", password: "Sikker!Smoke2026" }) });
  const auth = { authorization: `Bearer ${login.body.token}` };
  const customer = await request("/api/customers", { method: "POST", headers: auth, body: JSON.stringify({ name: "Testkunde" }) });
  if (!customer.body.id) throw new Error("Kundeoprettelse fejlede.");
  const backup = await request("/api/backups", { method: "POST", headers: auth, body: "{}" });
  const verification = await request(`/api/backups/${backup.body.id}/verify`, { method: "POST", headers: auth, body: "{}" });
  if (!verification.body.verified) throw new Error("Backupverifikation fejlede.");
  const controlCenter = await request("/api/accounting-control-center", { headers: auth });
  if (typeof controlCenter.body.score !== "number" || !Array.isArray(controlCenter.body.checks)) {
    throw new Error("Kontrolcenterets driftsmåling fejlede.");
  }
  const governance = await request("/api/ai-governance", { headers: auth });
  if (governance.body.settings?.targetAutonomyPercent !== 99 || governance.body.regulatorySources?.length < 5) {
    throw new Error("AI-styring eller officielle regelkilder blev ikke initialiseret.");
  }
  const safeDecision = await request("/api/ai-governance/decisions", {
    method: "POST", headers: auth,
    body: JSON.stringify({ actionType: "voucher_classification", recommendation: "Konto 3600", reasoning: "Matcher godkendt leverandørregel", evidence: ["voucher:1", "rule:1"], confidence: 0.995, riskLevel: "lav" }),
  });
  if (safeDecision.body.status !== "klar_til_automatisk_udfoerelse") throw new Error("En sikker rutinebeslutning blev ikke frigivet.");
  const paymentDecision = await request("/api/ai-governance/decisions", {
    method: "POST", headers: auth,
    body: JSON.stringify({ actionType: "payment", recommendation: "Betal faktura", reasoning: "Forfalder i dag", evidence: ["invoice:1"], confidence: 1, riskLevel: "lav" }),
  });
  if (paymentDecision.body.status !== "afventer_godkendelse") throw new Error("Betalingsporten blev ikke håndhævet.");
  const approvedDecision = await request(`/api/ai-governance/decisions/${paymentDecision.body.id}/approve`, { method: "POST", headers: auth, body: "{}" });
  if (approvedDecision.body.status !== "godkendt") throw new Error("AI-godkendelsen fejlede.");
  const key = await request("/api/api-keys/generate", { method: "POST", headers: auth, body: JSON.stringify({ name: "Smoke", scopes: "read" }) });
  const apiCustomers = await request("/api/customers", { headers: { authorization: `Bearer ${key.body.key}` } });
  if (apiCustomers.body.length !== 1) throw new Error("API-nøgle eller tenantfilter fejlede.");
  await request("/api/role-controls", {
    method: "POST", headers: auth,
    body: JSON.stringify({ roleName: "regnskab_bogfoerer", module: "bogføring", canCreate: 0, canEdit: 0, canDelete: 0, canApprove: 0, requiresTwoFactor: 0 }),
  });
  await request("/api/users", {
    method: "POST", headers: auth,
    body: JSON.stringify({ name: "Smoke Bogfører", email: "bookkeeper@example.test", password: "Sikker!Bog2026", role: "regnskab_bogfoerer", active: 1, emailVerified: 1 }),
  });
  const bookkeeperLogin = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "bookkeeper@example.test", password: "Sikker!Bog2026" }) });
  const bookkeeperAuth = { authorization: `Bearer ${bookkeeperLogin.body.token}` };
  await request("/api/accounts", { headers: bookkeeperAuth });
  await requestStatus("/api/bank-transactions", 403, { headers: bookkeeperAuth });
  await requestStatus("/api/accounts", 403, { method: "POST", headers: bookkeeperAuth, body: JSON.stringify({ accountNumber: "9999", name: "Må ikke oprettes", type: "aktiv" }) });
  const integration = await request("/api/integrations", { method: "POST", headers: auth, body: JSON.stringify({ category: "regnskab", provider: "e-conomic" }) });
  const connectorTest = await request(`/api/integrations/${integration.body.id}/test`, { method: "POST", headers: auth, body: "{}" });
  if (connectorTest.body.ok !== false || connectorTest.body.demo !== false) throw new Error("Manglende produktionscredentials blev fejlagtigt godkendt.");
  await requestStatus(`/api/integrations/${integration.body.id}/connect-demo`, 403, { method: "POST", headers: auth, body: "{}" });
  console.log("Smoke-test OK: opstart, migration, signup, login, tenantdata, backup, kontrolcenter, AI-godkendelsesport, API-nøgle, håndhævet RBAC og fail-closed integrationer.");
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(root, { recursive: true, force: true });
}

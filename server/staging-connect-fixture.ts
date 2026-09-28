import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { accounts, apiKeys, companies } from "@shared/schema";
import { db, storage } from "./storage";

const STAGING_SERVICE_ID = "srv-dat13nbncjis73cmttg0";
const STAGING_BRANCH = "staging/internal-integration-2026-09-28";
const FIXTURE_COMPANY = "Fiktiv ADD Connect-stagingkunde";
const FIXTURE_KEY = "Midlertidig Pro/Clean-integrationstest";

/** Never creates a customer or credential outside the named private staging service. */
export async function ensureStagingConnectFixture(): Promise<void> {
  if (process.env.RENDER_SERVICE_ID !== STAGING_SERVICE_ID || process.env.RENDER_GIT_BRANCH !== STAGING_BRANCH) return;
  const previous = db.select().from(apiKeys).where(eq(apiKeys.name, FIXTURE_KEY)).all();
  const token = process.env.STAGING_CONNECT_TOKEN || "";
  if (!token) {
    for (const key of previous) db.update(apiKeys).set({ status: "deaktiveret" }).where(eq(apiKeys.id, key.id)).run();
    if (previous.length) console.info("ADD Connect staging-testnøgle deaktiveret.");
    return;
  }
  if (!/^sk_[a-f0-9]{64}$/.test(token)) throw new Error("STAGING_CONNECT_TOKEN har ugyldigt format.");

  let company = db.select().from(companies).where(eq(companies.name, FIXTURE_COMPANY)).get();
  if (!company) company = await storage.createCompany({ name: FIXTURE_COMPANY, kind: "kunde", status: "aktiv",
    createdAt: new Date().toISOString() } as any);
  for (const account of [
    { accountNumber: "1200", name: "Testdebitorer", type: "aktiv" },
    { accountNumber: "3000", name: "Testsalg", type: "indtaegt" },
    { accountNumber: "2310", name: "Testsalgsmoms", type: "passiv" },
  ]) {
    const existing = db.select().from(accounts).where(and(eq(accounts.companyId, company.id),
      eq(accounts.accountNumber, account.accountNumber))).get();
    if (!existing) db.insert(accounts).values({ companyId: company.id, ...account, active: 1,
      createdAt: new Date().toISOString() }).run();
  }
  const hash = createHash("sha256").update(token).digest("hex");
  for (const key of previous) if (key.keyHash !== hash && key.status === "aktiv") {
    db.update(apiKeys).set({ status: "deaktiveret" }).where(eq(apiKeys.id, key.id)).run();
  }
  const current = db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).get();
  if (current) {
    if (current.companyId !== company.id) throw new Error("Staging-testnøglen tilhører en anden virksomhed.");
    if (!current.expiresAt || new Date(current.expiresAt).getTime() <= Date.now()) {
      db.update(apiKeys).set({ status: "deaktiveret" }).where(eq(apiKeys.id, current.id)).run();
      console.info("ADD Connect staging-testnøgle er udløbet.");
      return;
    }
    db.update(apiKeys).set({ status: "aktiv" }).where(eq(apiKeys.id, current.id)).run();
  } else {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    db.insert(apiKeys).values({ companyId: company.id, name: FIXTURE_KEY, keyPrefix: token.slice(0, 10),
      keyHash: hash, scopes: JSON.stringify(["add_connect:read", "add_connect:write"]), status: "aktiv",
      expiresAt, createdAt: new Date().toISOString() }).run();
  }
  console.info(`ADD Connect staging-fixture klar for firma ${company.id}; testnøglen udløber om to timer.`);
}

import type { Express, Request, Response } from "express";
import { requireRole, tenantId } from "./auth";
import { storage, assertDatabaseReady } from "./storage";
import { externalBackupConfigured } from "./backup-service";
import { providerStatus } from "./einvoice";
import { emailConfigured } from "./messaging";

const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);
const configured = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));

const knowledge = [
  { slug: "kom-godt-i-gang", category: "Opsætning", title: "Kom godt i gang", steps: ["Kontrollér virksomhedsoplysninger og CVR", "Vælg eller importér kontoplan", "Opret første kunde", "Opret en kladdefaktura", "Gennemfør onboarding-kontrollen"] },
  { slug: "import", category: "Migrering", title: "Import fra andet regnskabssystem", steps: ["Eksportér kunder, leverandører eller kontoplan som CSV", "Vælg kildesystem og datatype", "Validér forhåndsvisningen", "Godkend importen", "Brug rollback, hvis resultatet ikke er korrekt"] },
  { slug: "bilag", category: "Bogføring", title: "Bilag og bogføring", steps: ["Upload bilaget", "Kontrollér dato, beløb og moms", "Vælg konti", "Kontrollér at debet og kredit balancerer", "Bogfør først efter godkendelse"] },
  { slug: "moms", category: "Moms", title: "Momsafstemning", steps: ["Afslut periodens bogføring", "Kør momsafstemning", "Undersøg alle differencer", "Få en ansvarlig til at godkende", "Indberet hos Skattestyrelsen"] },
  { slug: "ai-godkendelse", category: "AI", title: "AI-forslag og godkendelser", steps: ["Læs anbefaling og begrundelse", "Kontrollér dokumentation og sikkerhedsniveau", "Ret data ved behov", "Godkend eller afvis", "AI må aldrig selv indsende skat, moms, løn eller betalinger"] },
  { slug: "backup", category: "Drift", title: "Backup og gendannelse", steps: ["Kontrollér ekstern backup-status", "Kør en manuel backup", "Bekræft checksum", "Kør jævnligt restore-drill", "Dokumentér resultatet"] },
  { slug: "nemhandel", category: "Fakturering", title: "NemHandel og Peppol", steps: ["Kontrollér kundens EAN/GLN", "Validér OIOUBL/Peppol-dokumentet", "Godkend køen", "Send via konfigureret access point", "Følg leveringskvitteringen"] },
  { slug: "support", category: "Hjælp", title: "Opret en supportsag", steps: ["Beskriv hvad du forsøgte", "Ang fejlmeddelelsen og tidspunktet", "Vedlæg relevante id-numre uden adgangskoder", "Markér prioritet", "Følg svaret i supportsagen"] },
];

export function registerReadinessRoutes(app: Express) {
  app.get("/api/onboarding/status", requireRole("leder", "holdleder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const company = await storage.getCompany(cid);
    const [accounts, customers, invoices] = await Promise.all([storage.all("accounts", cid), storage.getCustomers(cid), storage.getInvoices(cid)]);
    const steps = [
      { id: "company", title: "Virksomhedsoplysninger", complete: Boolean(company?.name && company?.cvr && company?.address && company?.email), action: "Udfyld navn, CVR, adresse og mail" },
      { id: "accounts", title: "Kontoplan", complete: accounts.length > 0, action: "Opret eller importér en kontoplan" },
      { id: "customer", title: "Første kunde", complete: customers.length > 0, action: "Opret eller importér en kunde" },
      { id: "invoice", title: "Første faktura", complete: invoices.length > 0, action: "Opret en kladdefaktura og kontrollér moms" },
      { id: "dpa", title: "Databehandleraftale", complete: Boolean(company?.dpaAcceptedAt), action: "Læs og acceptér databehandleraftalen" },
    ];
    const completed = steps.filter((step) => step.complete).length;
    res.json({ completed, total: steps.length, percent: Math.round(completed / steps.length * 100), readyForPilot: completed === steps.length, steps });
  }));

  app.get("/api/support/knowledge", asyncRoute(async (_req, res) => res.json({ articles: knowledge })));

  app.get("/api/integration-adapters/status", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const integrations = await storage.getIntegrations(cid);
    const electronic = providerStatus();
    res.json({ adapters: [
      { id: "economic", name: "e-conomic", mode: "API", configured: integrations.some((item: any) => String(item.provider).toLowerCase().includes("conomic")) },
      { id: "dinero", name: "Dinero", mode: "CSV-import", configured: true },
      { id: "billy", name: "Billy", mode: "CSV-import", configured: true },
      { id: "nemhandel", name: "NemHandel/Peppol", mode: "API", configured: electronic.configured && electronic.validatorConfigured && electronic.inboundConfigured },
      { id: "smtp", name: "Simply.com mail", mode: "SMTP", configured: emailConfigured() },
      { id: "s3", name: "Ekstern backup", mode: "S3", configured: externalBackupConfigured() },
      { id: "stripe", name: "Stripe", mode: "API", configured: configured("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET") },
    ] });
  }));

  app.get("/api/operations/status", requireRole("platform_admin"), asyncRoute(async (_req, res) => {
    let database = true;
    try { assertDatabaseReady(); } catch { database = false; }
    const electronic = providerStatus();
    const services = [
      { id: "database", name: "Database", status: database ? "ok" : "error", message: database ? "SQLite svarer på integritetskontrollen." : "Databasen svarer ikke." },
      { id: "email", name: "Udgående mail", status: emailConfigured() ? "ok" : "warning", message: emailConfigured() ? "SMTP/afsender er konfigureret." : "Mailnøgler mangler." },
      { id: "backup", name: "Ekstern backup", status: externalBackupConfigured() ? "ok" : "warning", message: externalBackupConfigured() ? "S3-adapter er konfigureret." : "S3-adapter kræver produktionsnøgler." },
      { id: "einvoice", name: "NemHandel/Peppol", status: electronic.configured && electronic.validatorConfigured && electronic.inboundConfigured ? "ok" : "warning", message: electronic.configured ? "Afsendelsesadapter er konfigureret; kontrollér validator og inbound-webhook." : "Access point-nøgler mangler." },
      { id: "payments", name: "Betalinger", status: configured("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET") ? "ok" : "warning", message: configured("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET") ? "Stripe og webhook er konfigureret." : "Betalingsnøgler mangler." },
      { id: "security", name: "Sikkerhedsnøgler", status: configured("SESSION_SECRET", "ENCRYPTION_KEY") ? "ok" : "error", message: configured("SESSION_SECRET", "ENCRYPTION_KEY") ? "Session og kryptering bruger produktionsnøgler." : "Kritiske sikkerhedsnøgler mangler." },
    ];
    const blocking = services.filter((service) => service.status === "error");
    res.json({ generatedAt: new Date().toISOString(), version: "3.6.0", overall: blocking.length ? "blocked" : services.some((service) => service.status === "warning") ? "attention" : "operational", services, blockers: blocking.map((service) => service.message) });
  }));
}

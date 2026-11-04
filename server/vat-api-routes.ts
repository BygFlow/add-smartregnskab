import type { Express, NextFunction, Request, Response } from "express";
import { requireRole, tenantId } from "./auth";
import { storage } from "./storage";
import {
  createVatDraft,
  getVatCalendar,
  getVatReceipt,
  vatApiProviderStatus,
  type VatApiAmounts,
} from "./vat-api";

const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (
  req: Request, res: Response, next: NextFunction,
) => Promise.resolve(fn(req, res)).catch(next);
const now = () => new Date().toISOString();

const seNumberFor = async (req: Request) => {
  const company = await storage.getCompany(tenantId(req));
  if (!company) throw new Error("Virksomheden findes ikke.");
  const requested = String(req.body?.seNumber ?? "").replace(/\D/g, "");
  const fallback = String(company.cvr ?? "").replace(/\D/g, "");
  const seNumber = requested || fallback;
  if (!/^\d{8}$/.test(seNumber)) {
    throw new Error("Virksomheden skal have et gyldigt CVR-/SE-nummer, før Moms API kan bruges.");
  }
  return { company, seNumber };
};

async function audit(req: Request, action: string, detail: string) {
  const auth = req.auth!;
  await storage.createAuditLog({
    companyId: auth.companyId,
    userId: auth.userId,
    userEmail: auth.email,
    action,
    target: "skat_moms_api",
    detail,
    createdAt: now(),
  });
}

export function registerVatApiRoutes(app: Express) {
  app.get("/api/vat-api/status", requireRole("leder", "holdleder"), asyncRoute(async (_req, res) => {
    res.json(vatApiProviderStatus());
  }));

  app.post("/api/vat-api/calendar", requireRole("leder", "holdleder"), asyncRoute(async (req, res) => {
    const { seNumber } = await seNumberFor(req);
    const result = await getVatCalendar({ seNumber, from: req.body?.from, to: req.body?.to });
    await audit(req, "moms_kalender_hentet", `SE ${seNumber}; ${req.body?.from}–${req.body?.to}`);
    res.json(result);
  }));

  app.post("/api/vat-api/draft", requireRole("leder"), asyncRoute(async (req, res) => {
    if (req.body?.confirmation !== "OPRET_MOMSKLADDE") {
      return void res.status(400).json({
        error: "En ansvarlig leder skal kontrollere momsafstemningen og bekræfte oprettelsen af kladden.",
        requiredConfirmation: "OPRET_MOMSKLADDE",
      });
    }
    const { seNumber } = await seNumberFor(req);
    const result = await createVatDraft({
      seNumber,
      periodFrom: req.body?.periodFrom,
      periodTo: req.body?.periodTo,
      amounts: (req.body?.amounts ?? {}) as VatApiAmounts,
    });
    if (!result.providerTransactionId || !result.deepLink) {
      throw new Error("SKAT returnerede ikke både transaktions-id og godkendelseslink til TastSelv.");
    }
    await audit(req, "moms_kladde_oprettet", `SE ${seNumber}; ${req.body?.periodFrom}–${req.body?.periodTo}; endelig godkendelse kræves i TastSelv.`);
    res.status(201).json({ ...result, requiresFinalApproval: true, approvalLocation: "TastSelv Erhverv" });
  }));

  app.post("/api/vat-api/receipt", requireRole("leder", "holdleder"), asyncRoute(async (req, res) => {
    const { seNumber } = await seNumberFor(req);
    const result = await getVatReceipt({ seNumber, providerTransactionId: req.body?.providerTransactionId });
    await audit(req, "moms_kvittering_hentet", `SE ${seNumber}; kvittering ${result.received ? "modtaget" : "ikke tilgængelig"}.`);
    res.json(result);
  }));
}

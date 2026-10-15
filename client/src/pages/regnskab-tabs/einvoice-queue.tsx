import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Send, FileCheck, Download, Plus, Network, ShieldCheck } from "lucide-react";

/* OIOUBL/NemHandel e-faktura-kø */

type EInvoice = {
  id: number;
  companyId?: number | null;
  direction?: string | null;
  invoiceNumber?: string | null;
  counterpartyName?: string | null;
  amount?: string | null;
  currency?: string | null;
  format?: string | null;
  validationStatus?: string | null;
  routingStatus?: string | null;
  status?: string | null;
  lastError?: string | null;
  hasDocument?: boolean;
  documentType?: string | null;
};

type ProviderStatus = {
  provider: string;
  configured: boolean;
  companyMapped: boolean;
  masterConfigured: boolean;
  masterCvr?: string | null;
  parentCompany?: boolean;
  parentMatchesPlatform: boolean;
  automaticProvisioning?: boolean;
  automaticNemhandel?: boolean;
  validatorConfigured: boolean;
  inboundConfigured: boolean;
  supportedFormats: string[];
  connection?: {
    cvr: string;
    status: string;
    sourceProducts: string[];
    nemhandelStatus: string;
    peppolStatus: string;
    consentAt?: string | null;
    connected: boolean;
    lastError?: string | null;
    updatedAt: string;
  } | null;
};

const SPROOM_STATUS_LABEL: Record<string, string> = {
  afventer_sproom: "Afventer masteradgang",
  afventer_tilmelding: "Afventer MitID-godkendelse",
  tilmelding_fejlet: "Tilmelding kræver handling",
  oprettelse_fejlet: "Oprettelse kræver handling",
  forbundet: "Forbundet",
};

const DIRECTION_STYLE: Record<string, string> = {
  udgående: "badge-soft badge-soft-blue",
  indgående: "badge-soft badge-soft-green",
};
const DIRECTION_LABEL: Record<string, string> = {
  udgående: "Udgående",
  indgående: "Indgående",
};

const VALIDATION_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  lokal_godkendt: "badge-soft badge-soft-amber",
  godkendt: "badge-soft badge-soft-green",
  afvist: "badge-soft badge-soft-red",
};
const VALIDATION_LABEL: Record<string, string> = {
  afventer: "Afventer",
  lokal_godkendt: "Kun lokalkontrol",
  godkendt: "Godkendt",
  afvist: "Afvist",
};

const ROUTING_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  sendt: "badge-soft badge-soft-blue",
  leveret: "badge-soft badge-soft-green",
  fejlet: "badge-soft badge-soft-red",
};
const ROUTING_LABEL: Record<string, string> = {
  afventer: "Afventer",
  sendt: "Sendt",
  leveret: "Leveret",
  fejlet: "Fejlet",
};

function fmtAmount(amount?: string | null, currency = "DKK"): string {
  const n = Number(amount);
  if (!isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(n);
  } catch {
    return String(n);
  }
}

export default function EInvoiceQueue({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = useState("");
  const [format, setFormat] = useState("OIOUBL_2_1");
  const [documentKind, setDocumentKind] = useState("invoice");
  const [sproomConsent, setSproomConsent] = useState(false);

  const queryKey = ["/api/einvoice-queue", companyId];

  const { data, isLoading } = useQuery<EInvoice[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/einvoice-queue?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const invoices = data ?? [];
  const { data: provider } = useQuery<ProviderStatus>({
    queryKey: ["/api/einvoice-queue/status"],
    queryFn: async () => (await apiRequest("GET", "/api/einvoice-queue/status")).json(),
  });

  const onboardingMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/einvoice-queue/sproom/onboarding", {
      consent: true,
      sourceProducts: ["add_smartregnskab"],
    })).json(),
    onSuccess: (result: { action?: string }) => {
      setSproomConsent(false);
      qc.invalidateQueries({ queryKey: ["/api/einvoice-queue/status"] });
      const description = result.action === "child_created"
        ? "Sproom child-profilen er oprettet og genbruges af SmartRegnskab, Pro og Clean."
        : result.action === "enrollment_requested"
          ? "Virksomheden findes allerede hos Sproom. Den tegningsberettigede skal godkende tilmeldingen med MitID Erhverv."
          : "Tilslutningen er gemt og afventer Sprooms masteradgang. Ingen dokumenter sendes endnu.";
      toast({ title: "Tilslutningen er registreret", description });
    },
    onError: (err: unknown) => toast({ title: "Kunne ikke registrere tilslutningen", description: err instanceof Error ? err.message : "Ukendt fejl", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", documentKind === "credit_note" ? "/api/einvoice-queue/from-credit-note" : "/api/einvoice-queue/from-invoice", documentKind === "credit_note" ? { creditNoteId: Number(invoiceId), format } : { invoiceId: Number(invoiceId), format })).json(),
    onSuccess: () => { setInvoiceId(""); qc.invalidateQueries({ queryKey }); toast({ title: "E-faktura oprettet", description: "XML er genereret og valideret. Ingen afsendelse sker uden et separat klik." }); },
    onError: (err: unknown) => toast({ title: "Kunne ikke oprette", description: err instanceof Error ? err.message : "Ukendt fejl", variant: "destructive" }),
  });

  const validateMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/einvoice-queue/${id}/validate`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/einvoice-queue"] });
      toast({ title: "Valideret", description: "Fakturaen er valideret." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke validere", description: message, variant: "destructive" });
    },
  });

  const sendMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/einvoice-queue/${id}/send`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/einvoice-queue"] });
      toast({ title: "Leverandøren har modtaget fakturaen", description: "Afsendelsen er registreret med leverandørens svar og revisionsspor." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke sende", description: message, variant: "destructive" });
    },
  });

  const respondMut = useMutation({
    mutationFn: async ({ id, accepted, invoiceFormat }: { id: number; accepted: boolean; invoiceFormat?: string | null }) => (await apiRequest("POST", `/api/einvoice-queue/${id}/respond`, { responseType: invoiceFormat === "PEPPOL_BIS_3" ? "invoice_response" : "application_response", accepted })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast({ title: "Svar oprettet", description: "Svarmeddelelsen er lagt i kø og skal valideres før afsendelse." }); },
    onError: (err: unknown) => toast({ title: "Kunne ikke oprette svar", description: err instanceof Error ? err.message : "Ukendt fejl", variant: "destructive" }),
  });

  const downloadXml = async (invoice: EInvoice) => {
    try {
      const response = await apiRequest("GET", `/api/einvoice-queue/${invoice.id}/download`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceNumber || invoice.id}.xml`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Kunne ikke hente XML", description: error instanceof Error ? error.message : "Ukendt fejl", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">OIOUBL/NemHandel kø</h2>
        <p className="text-sm text-muted-foreground">
          Validering og afsendelse af e-fakturaer via OIOUBL/NemHandel.
        </p>
      </div>

      <div className={`rounded-md border p-3 text-sm ${provider?.configured ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-300" : "border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"}`}>
        {provider?.configured
          ? "Afsendelsesleverandør er tilsluttet. Kontrollér stadig leveringskvitteringen i køen."
          : "Afsendelse er låst, indtil en rigtig NemHandel/Peppol-leverandør er tilsluttet. Systemet kan ikke længere markere dokumenter som sendt uden leverandørsvar."}
      </div>

      {provider?.provider === "sproom" && (
        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800"><Network className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold">Sproom masterforbindelse</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">ADD SmartDrift ApS bruger sin egen parent/masterprofil. Hver kundevirksomhed får én child-profil pr. CVR, som genbruges på tværs af SmartRegnskab, Pro og Clean.</p>
              </div>
            </div>
            <span className={provider.parentCompany || provider.connection?.connected ? "badge-soft badge-soft-green" : "badge-soft badge-soft-amber"}>{provider.parentCompany ? "Parentprofil aktiv" : provider.connection ? (SPROOM_STATUS_LABEL[provider.connection.status] || provider.connection.status.replaceAll("_", " ")) : "Ikke tilmeldt"}</span>
          </div>
          {provider.parentCompany ? (
            <div className="mt-4 grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-3">
              <div><span className="text-muted-foreground">Virksomheds-CVR</span><strong className="mt-1 block">{provider.masterCvr}</strong></div>
              <div><span className="text-muted-foreground">Sproom-rolle</span><strong className="mt-1 block">Parent/master</strong></div>
              <div><span className="text-muted-foreground">Kundetilknytning</span><strong className="mt-1 block">Child-profiler pr. CVR</strong></div>
            </div>
          ) : provider.connection ? (
            <>
              <div className="mt-4 grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div><span className="text-muted-foreground">Kunde-CVR</span><strong className="mt-1 block">{provider.connection.cvr}</strong></div>
                <div><span className="text-muted-foreground">Produkter</span><strong className="mt-1 block">{provider.connection.sourceProducts.map((item) => item === "add_smartregnskab" ? "SmartRegnskab" : item === "smartdrift_pro" ? "Pro" : item === "smartdrift_clean" ? "Clean" : item).join(", ") || "SmartRegnskab"}</strong></div>
                <div><span className="text-muted-foreground">NemHandel</span><strong className="mt-1 block capitalize">{provider.connection.nemhandelStatus.replaceAll("_", " ")}</strong></div>
                <div><span className="text-muted-foreground">Peppol</span><strong className="mt-1 block capitalize">{provider.connection.peppolStatus.replaceAll("_", " ")}</strong></div>
              </div>
              {provider.connection.lastError && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{provider.connection.lastError}</p>}
              {provider.connection.status.endsWith("_fejlet") && <Button className="mt-3" size="sm" variant="outline" disabled={onboardingMut.isPending} onClick={() => onboardingMut.mutate()}><ShieldCheck className="mr-2 h-4 w-4" />Prøv Sproom-tilmelding igen</Button>}
              {provider.connection.connected && provider.automaticNemhandel && provider.connection.nemhandelStatus !== "aktiv" && <Button className="mt-3" size="sm" variant="outline" disabled={onboardingMut.isPending} onClick={() => onboardingMut.mutate()}><Network className="mr-2 h-4 w-4" />Aktivér NemHandel-modtagelse</Button>}
            </>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={sproomConsent} onChange={(event) => setSproomConsent(event.target.checked)} /><span>Jeg godkender, at virksomhedens CVR- og fakturaoplysninger bruges til at oprette eller knytte én Sproom child-profil til NemHandel/Peppol under ADD SmartDrift ApS' masteraftale.</span></label>
              <Button size="sm" disabled={!sproomConsent || onboardingMut.isPending} onClick={() => onboardingMut.mutate()}><ShieldCheck className="mr-2 h-4 w-4" />Registrér tilslutning</Button>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <label className="grid gap-1 text-sm"><span>Dokument</span><select className="h-9 rounded-md border bg-background px-3" value={documentKind} onChange={(event) => setDocumentKind(event.target.value)}><option value="invoice">Faktura</option><option value="credit_note">Kreditnota</option></select></label>
        <label className="grid gap-1 text-sm"><span>Internt ID</span><input className="h-9 rounded-md border bg-background px-3" inputMode="numeric" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} placeholder="fx 42" /></label>
        <label className="grid gap-1 text-sm"><span>Format</span><select className="h-9 rounded-md border bg-background px-3" value={format} onChange={(event) => setFormat(event.target.value)}><option value="OIOUBL_2_1">OIOUBL 2.1</option><option value="PEPPOL_BIS_3">Peppol BIS Billing 3</option></select></label>
        <Button onClick={() => createMut.mutate()} disabled={!invoiceId || createMut.isPending}><Plus className="h-4 w-4" /> Opret e-faktura</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : invoices.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen e-fakturaer i køen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Retning</th>
                <th className="px-3 py-2">Fakturanr.</th>
                <th className="px-3 py-2">Modpart</th>
                <th className="px-3 py-2">Beløb</th>
                <th className="px-3 py-2">Format</th>
                <th className="px-3 py-2">Validering</th>
                <th className="px-3 py-2">Routing</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} data-testid={`einvoice-row-${inv.id}`}>
                  <td className="px-3 py-2">
                    <span
                      className={DIRECTION_STYLE[inv.direction ?? ""] ?? "badge-soft badge-soft-gray"}
                      data-testid={`direction-${inv.id}`}
                    >
                      {DIRECTION_LABEL[inv.direction ?? ""] ?? inv.direction}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{inv.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-2">{inv.counterpartyName ?? "—"}</td>
                  <td className="px-3 py-2">{fmtAmount(inv.amount, inv.currency ?? "DKK")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.format ?? "OIOUBL"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={VALIDATION_STYLE[inv.validationStatus ?? "afventer"] ?? "badge-soft badge-soft-amber"}
                      data-testid={`validation-${inv.id}`}
                    >
                      {VALIDATION_LABEL[inv.validationStatus ?? "afventer"] ?? inv.validationStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={ROUTING_STYLE[inv.routingStatus ?? "afventer"] ?? "badge-soft badge-soft-amber"}
                      data-testid={`routing-${inv.id}`}
                    >
                      {ROUTING_LABEL[inv.routingStatus ?? "afventer"] ?? inv.routingStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`validate-btn-${inv.id}`}
                        disabled={validateMut.isPending || inv.validationStatus === "godkendt"}
                        onClick={() => validateMut.mutate(inv.id)}
                      >
                        <FileCheck className="h-3.5 w-3.5" /> Valider
                      </Button>
                      {inv.hasDocument && <Button size="sm" variant="ghost" onClick={() => downloadXml(inv)}><Download className="h-3.5 w-3.5" /> XML</Button>}
                      {inv.direction === "indgående" && <><Button size="sm" variant="outline" onClick={() => respondMut.mutate({ id: inv.id, accepted: true, invoiceFormat: inv.format })}>Accepter</Button><Button size="sm" variant="outline" onClick={() => respondMut.mutate({ id: inv.id, accepted: false, invoiceFormat: inv.format })}>Afvis</Button></>}
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid={`send-btn-${inv.id}`}
                        disabled={
                          sendMut.isPending ||
                          inv.validationStatus !== "godkendt" ||
                          inv.routingStatus === "sendt" ||
                          inv.routingStatus === "leveret" || !provider?.configured
                        }
                        onClick={() => sendMut.mutate(inv.id)}
                      >
                        <Send className="h-3.5 w-3.5" /> Send
                      </Button>
                    </div>
                    {inv.lastError && <p className="mt-1 max-w-xs text-xs text-destructive">{inv.lastError}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Send, FileCheck, Download, Plus } from "lucide-react";

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

type ProviderStatus = { configured: boolean; validatorConfigured: boolean; inboundConfigured: boolean; supportedFormats: string[] };

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

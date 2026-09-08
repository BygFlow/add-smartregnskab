import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Send, FileCheck } from "lucide-react";

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
  godkendt: "badge-soft badge-soft-green",
  afvist: "badge-soft badge-soft-red",
};
const VALIDATION_LABEL: Record<string, string> = {
  afventer: "Afventer",
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

  const validateMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/einvoice-queue/${id}?companyId=${companyId}`, {
        validationStatus: "godkendt",
      });
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
      const res = await apiRequest("PATCH", `/api/einvoice-queue/${id}?companyId=${companyId}`, {
        routingStatus: "sendt",
        status: "sendt",
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/einvoice-queue"] });
      toast({ title: "Faktura sendt", description: "Fakturaen er sendt via NemHandel." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke sende", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">OIOUBL/NemHandel kø</h2>
        <p className="text-sm text-muted-foreground">
          Validering og afsendelse af e-fakturaer via OIOUBL/NemHandel.
        </p>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        OIOUBL/NemHandel (beta) — Kræver NemHandel aftale.
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
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid={`send-btn-${inv.id}`}
                        disabled={
                          sendMut.isPending ||
                          inv.validationStatus !== "godkendt" ||
                          inv.routingStatus === "sendt" ||
                          inv.routingStatus === "leveret"
                        }
                        onClick={() => sendMut.mutate(inv.id)}
                      >
                        <Send className="h-3.5 w-3.5" /> Send
                      </Button>
                    </div>
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

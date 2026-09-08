import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Wand2, Send, AlertTriangle, Check, X } from "lucide-react";

/* Avanceret debitorstyring — rykkerflow */

type ReminderFlow = {
  id: number;
  companyId?: number | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  customerName?: string | null;
  amount?: number | null;
  daysOverdue?: number | null;
  reminderLevel?: number | null;
  reminderFee?: number | null;
  interest?: number | null;
  status?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 2,
});

function levelMeta(level?: number | null) {
  if (level === 4 || level === 99) return { label: "Inkasso", style: "badge-soft badge-soft-red" };
  if (level === 3) return { label: "Rykker 3", style: "badge-soft badge-soft-red" };
  if (level === 2) return { label: "Rykker 2", style: "badge-soft badge-soft-amber" };
  return { label: "Rykker 1", style: "badge-soft badge-soft-blue" };
}

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  sendt: "badge-soft badge-soft-blue",
  betalt: "badge-soft badge-soft-green",
  inkasso: "badge-soft badge-soft-red",
};

const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  sendt: "Sendt",
  betalt: "Betalt",
  inkasso: "Inkasso",
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

export default function Debitorstyring({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState<number | null>(null);

  const { data, isLoading } = useQuery<ReminderFlow[]>({
    queryKey: ["/api/reminder-flow", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reminder-flow");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const reminders = data ?? [];

  const totalOverdue = reminders.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalFees = reminders.reduce((s, r) => s + Number(r.reminderFee ?? 0), 0);
  const totalInterest = reminders.reduce((s, r) => s + Number(r.interest ?? 0), 0);
  const pendingCount = reminders.filter((r) => r.status === "afventer").length;

  const autoGenMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reminder-flow/auto-generate", { companyId });
      return await res.json();
    },
    onSuccess: (data: { created?: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/reminder-flow"] });
      toast({
        title: "Rykkere genereret",
        description: `${data?.created ?? 0} rykker(e) oprettet baseret på forfaldne fakturaer.`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke generere rykkere", description: message, variant: "destructive" });
    },
  });

  const sendMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/reminder-flow/${id}`, {
        status: "sendt",
        sentAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reminder-flow"] });
      toast({ title: "Rykker sendt", description: "Rykker markeret som sendt." });
      setConfirmOpen(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke sende rykker", description: message, variant: "destructive" });
    },
  });

  const escalateMut = useMutation({
    mutationFn: async ({ id, level }: { id: number; level: number }) => {
      const fee = level === 2 ? 250 : level === 3 ? 500 : 100;
      const res = await apiRequest("PATCH", `/api/reminder-flow/${id}`, {
        reminderLevel: level,
        reminderFee: fee,
        status: "afventer",
      });
      return await res.json();
    },
    onSuccess: (_data, { level }) => {
      qc.invalidateQueries({ queryKey: ["/api/reminder-flow"] });
      toast({ title: "Eskaleret", description: `Rykker niveau ${level} sat.` });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke eskalere", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Debitorstyring</h2>
          <p className="text-sm text-muted-foreground">
            Avanceret rykkerflow med rykkerniveauer, gebyrer og renter.
          </p>
        </div>
        <Button
          data-testid="auto-generate-btn"
          disabled={autoGenMut.isPending}
          onClick={() => autoGenMut.mutate()}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {autoGenMut.isPending ? "Genererer…" : "Auto-generer rykkere"}
        </Button>
      </div>

      {/* Sammenfatning */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground">Forfalden fordring i alt</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{fmtDKK.format(totalOverdue)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{reminders.length} rykker(e)</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground">Rykkergebyrer i alt</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{fmtDKK.format(totalFees)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{pendingCount} afventer</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground">Renter i alt</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{fmtDKK.format(totalInterest)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Beregnet dagligt</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : reminders.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen forfaldne fakturaer med rykker. Kør "Auto-generer rykkere" for at oprette.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="p-2">Fakturanr.</th>
                <th className="p-2">Kunde</th>
                <th className="p-2 text-right">Beløb</th>
                <th className="p-2 text-right">Dage</th>
                <th className="p-2">Niveau</th>
                <th className="p-2 text-right">Gebyr</th>
                <th className="p-2 text-right">Renter</th>
                <th className="p-2">Status</th>
                <th className="p-2">Sendt</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => {
                const lvl = levelMeta(r.reminderLevel);
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r.invoiceNumber ?? "—"}</td>
                    <td className="p-2 max-w-[14rem] truncate">{r.customerName ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">{fmtDKK.format(Number(r.amount ?? 0))}</td>
                    <td className="p-2 text-right tabular-nums">{r.daysOverdue ?? 0}</td>
                    <td className="p-2">
                      <span className={`badge-soft ${lvl.style}`}>{lvl.label}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmtDKK.format(Number(r.reminderFee ?? 0))}</td>
                    <td className="p-2 text-right tabular-nums">{fmtDKK.format(Number(r.interest ?? 0))}</td>
                    <td className="p-2">
                      <span className={`badge-soft ${STATUS_STYLE[r.status ?? "afventer"] ?? "badge-soft badge-soft-gray"}`}>
                        {STATUS_LABEL[r.status ?? "afventer"] ?? r.status}
                      </span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{dkDate(r.sentAt)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          data-testid={`send-reminder-${r.id}`}
                          disabled={r.status === "sendt" || sendMut.isPending}
                          onClick={() => setConfirmOpen(r.id)}
                        >
                          <Send className="mr-1 h-3 w-3" /> Send rykker
                        </Button>
                        {Number(r.reminderLevel ?? 1) < 3 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`escalate-${r.id}`}
                            disabled={escalateMut.isPending}
                            onClick={() =>
                              escalateMut.mutate({ id: r.id, level: Number(r.reminderLevel ?? 1) + 1 })
                            }
                          >
                            ↑
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={confirmOpen !== null} onOpenChange={(o) => !o && setConfirmOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Godkend afsendelse af rykker</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bekræft afsendelse af rykker. Funktionen markerer rykkeren som sendt — selve afsendelsen
            (e-mail/e-Boks) kræver en integrationsaftale. Gennemgå indholdet inden godkendelse.
          </p>
          <DialogFooter>
            <Button variant="outline" data-testid="confirm-cancel" onClick={() => setConfirmOpen(null)}>
              <X className="mr-1.5 h-4 w-4" /> Afvis
            </Button>
            <Button
              data-testid="confirm-send"
              disabled={sendMut.isPending}
              onClick={() => confirmOpen !== null && sendMut.mutate(confirmOpen)}
            >
              <Check className="mr-1.5 h-4 w-4" /> Godkend og send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

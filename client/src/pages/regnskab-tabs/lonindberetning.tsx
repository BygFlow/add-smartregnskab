import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Users, Wallet, ScrollText, Banknote, Check, X } from "lucide-react";

/* Lønindberetning (eIndkomst / FerieKonto) */

type PayrollReport = {
  id: number;
  companyId?: number | null;
  period?: string | null;
  employeeCount?: number | null;
  grossTotal?: number | null;
  taxTotal?: number | null;
  holidayPayTotal?: number | null;
  pensionTotal?: number | null;
  atpTotal?: number | null;
  amContributionTotal?: number | null;
  netTotal?: number | null;
  eindkomstStatus?: string | null;
  feriekontoStatus?: string | null;
  status?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const EINDKOMST_STYLE: Record<string, string> = {
  ikke_sendt: "badge-soft badge-soft-gray",
  sendt: "badge-soft badge-soft-blue",
  godkendt: "badge-soft badge-soft-green",
};

const EINDKOMST_LABEL: Record<string, string> = {
  ikke_sendt: "Ikke sendt",
  sendt: "Sendt",
  godkendt: "Godkendt",
};

const FERIE_STYLE: Record<string, string> = {
  ikke_sendt: "badge-soft badge-soft-gray",
  sendt: "badge-soft badge-soft-blue",
  godkendt: "badge-soft badge-soft-green",
};

const FERIE_LABEL: Record<string, string> = {
  ikke_sendt: "Ikke sendt",
  sendt: "Sendt",
  godkendt: "Godkendt",
};

const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  godkendt: "Godkendt",
  indsendt: "Indsendt",
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

export default function Lonindberetning({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [period, setPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  );

  const { data, isLoading } = useQuery<PayrollReport[]>({
    queryKey: ["/api/payroll-reports", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/payroll-reports");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const reports = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payroll-reports", { period, companyId });
      return await res.json();
    },
    onSuccess: (rep: PayrollReport) => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-reports"] });
      toast({
        title: "Lønindberetning oprettet",
        description: `Periode ${rep.period} — ${rep.employeeCount} ansatte.`,
      });
      setDialogOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette indberetning", description: message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<PayrollReport>;
    }) => {
      const res = await apiRequest("PATCH", `/api/payroll-reports/${id}`, patch);
      return await res.json();
    },
    onSuccess: (_data, { patch }) => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-reports"] });
      toast({ title: "Indberetning opdateret", description: `Status: ${patch.status ?? patch.eindkomstStatus ?? "—"}` });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Lønindberetning</h2>
          <p className="text-sm text-muted-foreground">
            Indberetning af løn til eIndkomst og FerieKonto per periode.
          </p>
        </div>
        <Button data-testid="add-report-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret lønindberetning
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Lønindberetning (beta) — Kræver API-aftale hos eIndkomst/FerieKonto.
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen lønindberetninger endnu. Opret en indberetning for en periode.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <div key={r.id} className="kpi-card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">Periode {r.period ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    Status: {STATUS_LABEL[r.status ?? "kladde"] ?? r.status}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge-soft ${EINDKOMST_STYLE[r.eindkomstStatus ?? "ikke_sendt"] ?? "badge-soft badge-soft-gray"}`}>
                    eIndkomst: {EINDKOMST_LABEL[r.eindkomstStatus ?? "ikke_sendt"] ?? r.eindkomstStatus}
                  </span>
                  <span className={`badge-soft ${FERIE_STYLE[r.feriekontoStatus ?? "ikke_sendt"] ?? "badge-soft badge-soft-gray"}`}>
                    FerieKonto: {FERIE_LABEL[r.feriekontoStatus ?? "ikke_sendt"] ?? r.feriekontoStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Ansatte:</span>
                  <span className="font-medium">{r.employeeCount ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Netto:</span>
                  <span className="font-medium">{fmtDKK.format(Number(r.netTotal ?? 0))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Brutto:</span>
                  <span className="font-medium">{fmtDKK.format(Number(r.grossTotal ?? 0))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">A-skat:</span>
                  <span className="font-medium">{fmtDKK.format(Number(r.taxTotal ?? 0))}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Indsendt: <span className="font-medium text-foreground">{dkDate(r.submittedAt)}</span>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  data-testid={`send-eindkomst-${r.id}`}
                  disabled={r.eindkomstStatus === "godkendt" || updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: r.id,
                      patch: { eindkomstStatus: "sendt", status: "indsendt", submittedAt: new Date().toISOString() },
                    })
                  }
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Send til eIndkomst
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`send-ferie-${r.id}`}
                  disabled={r.feriekontoStatus === "godkendt" || updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({ id: r.id, patch: { feriekontoStatus: "sendt" } })
                  }
                >
                  Send til FerieKonto
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  data-testid={`reject-${r.id}`}
                  onClick={() =>
                    updateMut.mutate({ id: r.id, patch: { status: "kladde", eindkomstStatus: "ikke_sendt" } })
                  }
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Afvis
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret lønindberetning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lr-period">Periode (YYYY-MM)</Label>
              <Input
                id="lr-period"
                data-testid="form-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-08"
              />
              <p className="text-xs text-muted-foreground">
                Rapporten genereres automatisk ud fra lønposter for den valgte periode.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !period.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Genererer…" : "Opret indberetning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

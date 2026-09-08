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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, FileText, Scale, Check, X, ClipboardCheck } from "lucide-react";

/* Årsrapport med XBRL og årsafslut-checklist */

type AnnualReport = {
  id: number;
  companyId?: number | null;
  year?: number | null;
  result?: number | null;
  taxResult?: number | null;
  balanceTotal?: number | null;
  equity?: number | null;
  xbrlStatus?: string | null;
  auditorPackage?: number | boolean | null;
  status?: string | null;
  submittedToErhvervsstyrelsen?: number | boolean | null;
  createdAt?: string | null;
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const XBRL_STYLE: Record<string, string> = {
  ikke_genereret: "badge-soft badge-soft-gray",
  genereret: "badge-soft badge-soft-blue",
  indsendt: "badge-soft badge-soft-green",
};

const XBRL_LABEL: Record<string, string> = {
  ikke_genereret: "Ikke genereret",
  genereret: "Genereret",
  indsendt: "Indsendt",
};

const STATUS_STYLE: Record<string, string> = {
  kladde: "badge-soft badge-soft-gray",
  godkendt: "badge-soft badge-soft-green",
  indsendt: "badge-soft badge-soft-blue",
};

const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  godkendt: "Godkendt",
  indsendt: "Indsendt",
};

const DEFAULT_CHECKLIST = [
  "Årsregnskab opstillet",
  "Resultatopgørelse verificeret",
  "Balance verificeret",
  "Noteskrivning afsluttet",
  "Moms og skat afstemt",
  "Ledelsesberetning udarbejdet",
  "Revisor gennemgang bestilt",
  "XBRL-tagning udført",
];

export default function Arsrapport({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHECKLIST.map((t) => [t, false])),
  );

  const { data, isLoading } = useQuery<AnnualReport[]>({
    queryKey: ["/api/annual-reports", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/annual-reports");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const reports = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/annual-reports", {
        year: Number(year),
        status: "kladde",
        xbrlStatus: "ikke_genereret",
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/annual-reports"] });
      toast({ title: "Årsrapport oprettet", description: `Regnskabsår ${year}.` });
      setDialogOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette årsrapport", description: message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<AnnualReport> }) => {
      const res = await apiRequest("PATCH", `/api/annual-reports/${id}`, patch);
      return await res.json();
    },
    onSuccess: (_data, { patch }) => {
      qc.invalidateQueries({ queryKey: ["/api/annual-reports"] });
      toast({ title: "Årsrapport opdateret", description: `Status: ${patch.xbrlStatus ?? patch.status ?? "—"}` });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const checklistDone = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Årsrapport</h2>
          <p className="text-sm text-muted-foreground">
            Årsrapport, XBRL-tagning og indberetning til Erhvervsstyrelsen.
          </p>
        </div>
        <Button data-testid="add-report-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret årsrapport
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Årsrapport (beta) — Kræver revisor/juridisk godkendelse.
      </div>

      {/* Årsafslut checklist */}
      <div className="kpi-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Checklist for årsafslut</h3>
          </div>
          <span className="badge-soft badge-soft-blue">{checklistDone}/{DEFAULT_CHECKLIST.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEFAULT_CHECKLIST.map((task) => (
            <label
              key={task}
              className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/40"
              data-testid={`checklist-${task.replace(/\s+/g, "-")}`}
            >
              <Checkbox
                checked={!!checklist[task]}
                onCheckedChange={(v) => setChecklist((c) => ({ ...c, [task]: !!v }))}
              />
              <span className={checklist[task] ? "text-muted-foreground line-through" : ""}>{task}</span>
            </label>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-60 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen årsrapporter endnu. Opret en rapport for et regnskabsår.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <div key={r.id} className="kpi-card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-muted p-2">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium">Regnskabsår {r.year ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {STATUS_LABEL[r.status ?? "kladde"] ?? r.status}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge-soft ${STATUS_STYLE[r.status ?? "kladde"] ?? "badge-soft badge-soft-gray"}`}>
                    {STATUS_LABEL[r.status ?? "kladde"] ?? r.status}
                  </span>
                  <span className={`badge-soft ${XBRL_STYLE[r.xbrlStatus ?? "ikke_genereret"] ?? "badge-soft badge-soft-gray"}`}>
                    XBRL: {XBRL_LABEL[r.xbrlStatus ?? "ikke_genereret"] ?? r.xbrlStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Årets resultat</span>
                  <span className="font-medium tabular-nums">{fmtDKK.format(Number(r.result ?? 0))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Skat</span>
                  <span className="font-medium tabular-nums">{fmtDKK.format(Number(r.taxResult ?? 0))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Balance i alt</span>
                  <span className="font-medium tabular-nums">{fmtDKK.format(Number(r.balanceTotal ?? 0))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Egenkapital</span>
                  <span className="font-medium tabular-nums">{fmtDKK.format(Number(r.equity ?? 0))}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Scale className="h-3.5 w-3.5" />
                Revisorpakke: {r.auditorPackage ? "Klar" : "Ikke klar"} · Indsendt Erhvervsstyrelsen:{" "}
                {r.submittedToErhvervsstyrelsen ? "Ja" : "Nej"}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  data-testid={`generate-xbrl-${r.id}`}
                  disabled={r.xbrlStatus !== "ikke_genereret" || updateMut.isPending}
                  onClick={() => updateMut.mutate({ id: r.id, patch: { xbrlStatus: "genereret" } })}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Generér XBRL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`approve-${r.id}`}
                  disabled={r.status === "godkendt" || updateMut.isPending}
                  onClick={() => updateMut.mutate({ id: r.id, patch: { status: "godkendt" } })}
                >
                  Godkend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  data-testid={`reject-${r.id}`}
                  onClick={() => updateMut.mutate({ id: r.id, patch: { status: "kladde", xbrlStatus: "ikke_genereret" } })}
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
            <DialogTitle>Opret årsrapport</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ar-year">Regnskabsår</Label>
              <Input
                id="ar-year"
                type="number"
                data-testid="form-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
              />
              <p className="text-xs text-muted-foreground">
                Årsrapporten oprettes som kladde. Tal udfyldes via bogføringen.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !year.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Opret rapport"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, RefreshCw, AlertTriangle, ListChecks, CheckCircle2, XCircle } from "lucide-react";

/* Integrationskørsler — logning af eksekverede integrationer */

type IntegrationRun = {
  id: number;
  integrationType: string;
  status: string;
  recordsProcessed?: number | null;
  recordsSuccess?: number | null;
  recordsFailed?: number | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

const INTEGRATION_TYPES = [
  { id: "bank", label: "Bank" },
  { id: "skat", label: "SKAT" },
  { id: "nemhandel", label: "NemHandel" },
  { id: "eindkomst", label: "eIndkomst" },
  { id: "mitid", label: "MitID" },
];

const TYPE_STYLE: Record<string, string> = {
  bank: "badge-soft badge-soft-blue",
  skat: "badge-soft badge-soft-green",
  nemhandel: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  eindkomst: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  mitid: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
};

function typeLabel(t: string): string {
  return INTEGRATION_TYPES.find((x) => x.id === t)?.label ?? t;
}

const STATUS_STYLE: Record<string, string> = {
  startet: "badge-soft badge-soft-blue",
  igang: "badge-soft badge-soft-amber",
  gennemført: "badge-soft badge-soft-green",
  fejl: "badge-soft badge-soft-red",
};

const STATUS_LABEL: Record<string, string> = {
  startet: "Startet",
  igang: "I gang",
  gennemført: "Gennemført",
  fejl: "Fejl",
};

const STATUS_OPTIONS = ["startet", "igang", "gennemført", "fejl"];

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function badge(style?: string) {
  return `badge-soft ${style ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`;
}

export default function IntegrationRuns({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    integrationType: "bank",
    recordsProcessed: 0,
    recordsSuccess: 0,
    recordsFailed: 0,
  });

  const queryKey = ["/api/integration-runs", companyId];

  const { data, isLoading } = useQuery<IntegrationRun[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integration-runs");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const runs = (data ?? []).slice().sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));

  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === "gennemført").length;
  const failedRuns = runs.filter((r) => r.status === "fejl").length;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integration-runs", {
        integrationType: form.integrationType,
        status: "startet",
        recordsProcessed: Number(form.recordsProcessed) || 0,
        recordsSuccess: Number(form.recordsSuccess) || 0,
        recordsFailed: Number(form.recordsFailed) || 0,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-runs"] });
      toast({ title: "Kørsel startet", description: "Integrationskørslen er registreret." });
      setDialogOpen(false);
      setForm({ integrationType: "bank", recordsProcessed: 0, recordsSuccess: 0, recordsFailed: 0 });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke starte kørsel", description: message, variant: "destructive" });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<IntegrationRun> }) => {
      const res = await apiRequest("PATCH", `/api/integration-runs/${id}`, patch);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-runs"] });
      toast({ title: "Kørsel opdateret" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  function markComplete(r: IntegrationRun) {
    patchMut.mutate({
      id: r.id,
      patch: { status: "gennemført", completedAt: new Date().toISOString() },
    });
  }

  function markFailed(r: IntegrationRun) {
    patchMut.mutate({
      id: r.id,
      patch: { status: "fejl", errorMessage: r.errorMessage || "Ukendt fejl under kørsel", completedAt: new Date().toISOString() },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Integrationskørsler</h2>
          <p className="text-sm text-muted-foreground">
            Logning af eksekverede integrationer med bank, SKAT, NemHandel, eIndkomst og MitID.
          </p>
        </div>
        <Button data-testid="add-run-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Registrer kørsel
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>BETA — Ægte integrationer kræver API-aftale med den relevante udbyder.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card" data-testid="summary-total">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" /> Kørsler i alt
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">{totalRuns}</div>
        </div>
        <div className="kpi-card" data-testid="summary-success-rate">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Succesrate
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">{successRate}%</div>
        </div>
        <div className="kpi-card" data-testid="summary-failed">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" /> Fejlede kørsler
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">{failedRuns}</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : runs.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen integrationskørsler endnu. Registrer den første kørsel ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Integrationstype</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Behandlet</th>
                <th className="px-3 py-2">Succes</th>
                <th className="px-3 py-2">Fejlet</th>
                <th className="px-3 py-2">Fejlmeddelelse</th>
                <th className="px-3 py-2">Startet</th>
                <th className="px-3 py-2">Afsluttet</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id} data-testid={`run-row-${r.id}`}>
                  <td className="px-3 py-2">
                    <span className={TYPE_STYLE[r.integrationType] ?? badge()} data-testid={`type-badge-${r.id}`}>
                      {typeLabel(r.integrationType)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={STATUS_STYLE[r.status] ?? "badge-soft badge-soft-gray"}
                      data-testid={`status-badge-${r.id}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.recordsProcessed ?? 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.recordsSuccess ?? 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.recordsFailed ?? 0}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                    {r.errorMessage || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(r.startedAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(r.completedAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {r.status !== "gennemført" && r.status !== "fejl" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`complete-btn-${r.id}`}
                            onClick={() => markComplete(r)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            data-testid={`fail-btn-${r.id}`}
                            onClick={() => markFailed(r)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {r.status === "fejl" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`rerun-btn-${r.id}`}
                          onClick={() =>
                            patchMut.mutate({
                              id: r.id,
                              patch: { status: "startet", errorMessage: null, startedAt: new Date().toISOString(), completedAt: null },
                            })
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrer integrationskørsel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="run-type">Integrationstype</Label>
              <Select
                value={form.integrationType}
                onValueChange={(v) => setForm((f) => ({ ...f, integrationType: v }))}
              >
                <SelectTrigger id="run-type" data-testid="form-integrationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEGRATION_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="run-processed">Behandlet</Label>
                <Input
                  id="run-processed"
                  type="number"
                  data-testid="form-recordsProcessed"
                  value={form.recordsProcessed}
                  onChange={(e) => setForm((f) => ({ ...f, recordsProcessed: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-success">Succes</Label>
                <Input
                  id="run-success"
                  type="number"
                  data-testid="form-recordsSuccess"
                  value={form.recordsSuccess}
                  onChange={(e) => setForm((f) => ({ ...f, recordsSuccess: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-failed">Fejlet</Label>
                <Input
                  id="run-failed"
                  type="number"
                  data-testid="form-recordsFailed"
                  value={form.recordsFailed}
                  onChange={(e) => setForm((f) => ({ ...f, recordsFailed: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button data-testid="form-save" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "Gemmer…" : "Start kørsel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

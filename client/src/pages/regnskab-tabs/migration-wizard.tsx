import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Plus,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

/* Migreringsguide — economic, dinero, billy, excel, csv */

type MigrationJob = {
  id: number;
  companyId?: number | null;
  source?: string | null;
  fileName?: string | null;
  totalRows?: number | null;
  importedRows?: number | null;
  errorRows?: number | null;
  status?: string | null;
  rollbackAvailable?: boolean | null;
  mapping?: string | null;
  validationErrors?: string | null;
};

const SOURCE_STYLE: Record<string, string> = {
  economic: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  dinero: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  billy: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  excel: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  csv: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};
const SOURCE_LABEL: Record<string, string> = {
  economic: "e-conomic",
  dinero: "Dinero",
  billy: "Billy",
  excel: "Excel",
  csv: "CSV",
};
const SOURCES = ["economic", "dinero", "billy", "excel", "csv"];

const STATUS_STYLE: Record<string, string> = {
  uploadet: "badge-soft badge-soft-gray",
  validerer: "badge-soft badge-soft-amber",
  importerer: "badge-soft badge-soft-blue",
  færdig: "badge-soft badge-soft-green",
  fejlet: "badge-soft badge-soft-red",
  rolled_back: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  uploadet: "Uploadet",
  validerer: "Validerer",
  importerer: "Importerer",
  færdig: "Færdig",
  fejlet: "Fejlet",
  rolled_back: "Rullet tilbage",
};

function badge(style?: string) {
  return `badge-soft ${style ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`;
}

function parseErrors(s?: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* ignore */
  }
  return String(s)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function MigrationWizard({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    source: "excel",
    fileName: "",
    mapping: "",
  });

  const queryKey = ["/api/migration-jobs", companyId];

  const { data, isLoading } = useQuery<MigrationJob[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/migration-jobs?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const jobs = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/migration-jobs", {
        source: form.source,
        fileName: form.fileName.trim() || `${SOURCE_LABEL[form.source]}-import.xlsx`,
        mapping: form.mapping || null,
        status: "uploadet",
        totalRows: 0,
        importedRows: 0,
        errorRows: 0,
        rollbackAvailable: true,
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/migration-jobs"] });
      toast({ title: "Migrering startet", description: "Validering kører i baggrunden." });
      setDialogOpen(false);
      setForm({ source: "excel", fileName: "", mapping: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke starte migrering", description: message, variant: "destructive" });
    },
  });

  const validateMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/migration-jobs/${id}?companyId=${companyId}`, {
        status: "validerer",
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/migration-jobs"] });
      toast({ title: "Validering startet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke validere", description: message, variant: "destructive" });
    },
  });

  const rollbackMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/migration-jobs/${id}/rollback?companyId=${companyId}`, {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/migration-jobs"] });
      toast({ title: "Rollback gennemført", description: "Migreringen er rullet tilbage." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke rulle tilbage", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Migreringsguide</h2>
          <p className="text-sm text-muted-foreground">
            Importér data fra e-conomic, Dinero, Billy, Excel eller CSV med validering og rollback.
          </p>
        </div>
        <Button data-testid="start-migration-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Start migrering
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Migreringsguide (beta) — Kræver revisor/juridisk godkendelse før endelig import.
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen migreringsjob endnu. Start den første migrering ovenfor.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => {
            const total = Number(job.totalRows) || 0;
            const imported = Number(job.importedRows) || 0;
            const errors = Number(job.errorRows) || 0;
            const progress = total > 0 ? Math.min(100, Math.round((imported / total) * 100)) : 0;
            const errorList = parseErrors(job.validationErrors);
            return (
              <div key={job.id} className="kpi-card flex flex-col gap-3" data-testid={`job-card-${job.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-2">
                      {job.source === "excel" || job.source === "csv" ? (
                        <FileSpreadsheet className="h-4 w-4" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{job.fileName || (SOURCE_LABEL[job.source ?? ""] ?? job.source)}</div>
                      <span className={badge(SOURCE_STYLE[job.source ?? ""])} data-testid={`source-${job.id}`}>
                        {SOURCE_LABEL[job.source ?? ""] ?? job.source}
                      </span>
                    </div>
                  </div>
                  <span
                    className={STATUS_STYLE[job.status ?? "uploadet"] ?? "badge-soft badge-soft-gray"}
                    data-testid={`status-${job.id}`}
                  >
                    {STATUS_LABEL[job.status ?? "uploadet"] ?? job.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{imported} / {total} rækker</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      data-testid={`progress-${job.id}`}
                      className={`h-full rounded-full transition-all ${
                        job.status === "fejlet" || job.status === "rolled_back"
                          ? "bg-red-500"
                          : job.status === "færdig"
                            ? "bg-emerald-500"
                            : "bg-primary"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block">Total</span>
                    <span className="font-medium text-foreground">{total}</span>
                  </div>
                  <div>
                    <span className="block">Importeret</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{imported}</span>
                  </div>
                  <div>
                    <span className="block">Fejl</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{errors}</span>
                  </div>
                </div>

                {errorList.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 p-2 text-xs text-red-800 dark:text-red-300">
                    <div className="mb-1 flex items-center gap-1 font-medium">
                      <XCircle className="h-3.5 w-3.5" /> Valideringsfejl
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5" data-testid={`errors-${job.id}`}>
                      {errorList.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {errorList.length > 5 && <li>…og {errorList.length - 5} flere</li>}
                    </ul>
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`validate-btn-${job.id}`}
                    disabled={validateMut.isPending || job.status === "færdig"}
                    onClick={() => validateMut.mutate(job.id)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Valider
                  </Button>
                  {job.status === "færdig" && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Gennemført
                    </span>
                  )}
                  {job.rollbackAvailable && job.status !== "rolled_back" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      data-testid={`rollback-btn-${job.id}`}
                      disabled={rollbackMut.isPending}
                      onClick={() => rollbackMut.mutate(job.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Rollback
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start migrering</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mj-source">Kilde</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
              >
                <SelectTrigger id="mj-source" data-testid="form-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mj-file">Filnavn</Label>
              <Input
                id="mj-file"
                data-testid="form-fileName"
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                placeholder="F.eks. kontoplan-2026.xlsx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mj-mapping">Felt-mapping (JSON, valgfrit)</Label>
              <Textarea
                id="mj-mapping"
                data-testid="form-mapping"
                value={form.mapping}
                onChange={(e) => setForm((f) => ({ ...f, mapping: e.target.value }))}
                placeholder='{"kontonr":"accountNumber","navn":"accountName"}'
                className="font-mono text-xs"
              />
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Filen uploades og valideres. Du kan rulle migreringen tilbage bagefter.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Starter…" : "Start migrering"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import {
  Plus,
  Upload,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
} from "lucide-react";

/* ---------- labels & badges ---------- */

const SOURCE_LABEL: Record<string, string> = {
  economic: "e-conomic",
  dinero: "Dinero",
  billy: "Billy",
  excel: "Excel",
  csv: "CSV",
};
const SOURCE_ICON: Record<string, typeof Database> = {
  economic: Database,
  dinero: Database,
  billy: Database,
  excel: FileSpreadsheet,
  csv: FileSpreadsheet,
};
const SOURCES = ["economic", "dinero", "billy", "excel", "csv"] as const;

const STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  uploadet: "blue",
  validerer: "amber",
  importerer: "amber",
  færdig: "green",
  fejlet: "red",
};
const STATUS_LABEL: Record<string, string> = {
  uploadet: "Uploadet",
  validerer: "Validerer",
  importerer: "Importerer",
  færdig: "Færdig",
  fejlet: "Fejlet",
};

/* ---------- typer ---------- */

type PreviewRow = Record<string, string | number | null>;

type ImportJob = {
  id: number;
  source: string;
  fileName?: string | null;
  status: string;
  totalRows?: number | null;
  importedRows?: number | null;
  errorRows?: number | null;
  preview?: PreviewRow[] | null;
};

/* ---------- komponent ---------- */

export default function Importguide({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportJob | null>(null);

  const queryKey = useMemo(
    () => ["/api/import-jobs2", companyId] as const,
    [companyId],
  );

  const { data, isLoading } = useQuery<ImportJob[]>({
    queryKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/import-jobs2?companyId=${companyId}`)).json(),
  });

  const items = data ?? [];
  const completed = items.filter((j) => j.status === "færdig").length;
  const failed = items.filter((j) => j.status === "fejlet").length;
  const totalImported = items.reduce(
    (sum, j) => sum + (Number(j.importedRows) || 0),
    0,
  );

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/import-jobs2?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Import startet", description: "Validering kører i baggrunden." });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/import-jobs2/${id}?companyId=${companyId}`, { status: "validerer" })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Import genstartet" });
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Importguide"
        description="Importer data fra e-conomic, Dinero, Billy, Excel eller CSV."
        action={
          <Button data-testid="start-import-btn" onClick={() => setOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Start import
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        <MetricCard
          icon={<Upload className="w-4 h-4" />}
          value={items.length}
          label="Importjob"
          variant="primary"
        />
        <MetricCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          value={completed}
          label="Gennemført"
          variant="green"
        />
        <MetricCard
          icon={<XCircle className="w-4 h-4" />}
          value={failed}
          label="Fejlet"
          variant="red"
        />
        <MetricCard
          icon={<Database className="w-4 h-4" />}
          value={totalImported}
          label="Rækker importeret"
          variant="blue"
          valueTestId="total-imported-rows"
        />
      </div>

      <SectionCard title="Importjob" icon={<Upload className="w-4 h-4" />} noPadding>
        {isLoading ? (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Ingen importjob endnu. Tryk “Start import” for at vælge en kilde.
          </div>
        ) : (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((job) => (
              <ImportCard
                key={job.id}
                job={job}
                onPreview={() => setPreview(job)}
                onRetry={() => retryMutation.mutate(job.id)}
                retrying={retryMutation.isPending}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <ImportDialog
        key="import"
        open={open}
        onOpenChange={setOpen}
        onSubmit={(body) => createMutation.mutate(body)}
        pending={createMutation.isPending}
      />

      <PreviewDialog job={preview} onOpenChange={(o) => !o && setPreview(null)} />
    </div>
  );
}

/* ---------- importkort ---------- */

function ImportCard({
  job,
  onPreview,
  onRetry,
  retrying,
}: {
  job: ImportJob;
  onPreview: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const Icon = SOURCE_ICON[job.source] ?? Database;
  const total = Number(job.totalRows) || 0;
  const imported = Number(job.importedRows) || 0;
  const errors = Number(job.errorRows) || 0;
  const progress = total > 0 ? Math.min(100, Math.round((imported / total) * 100)) : 0;
  const active = job.status === "validerer" || job.status === "importerer";

  return (
    <Card data-testid={`job-card-${job.id}`} className="overflow-hidden">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{job.fileName || SOURCE_LABEL[job.source] || job.source}</p>
              <span
                data-testid={`source-${job.id}`}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
              >
                {SOURCE_LABEL[job.source] ?? job.source}
              </span>
            </div>
          </div>
          <StatusChip
            data-testid={`status-${job.id}`}
            status={STATUS_LABEL[job.status] ?? job.status}
            variant={STATUS_VARIANT[job.status] ?? "gray"}
            icon={active ? <Loader2 className="w-3 h-3 animate-spin" /> : undefined}
          />
        </div>

        {/* fremskridtslinje */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{imported} / {total} rækker</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              data-testid={`progress-${job.id}`}
              className={`h-full rounded-full transition-all ${
                job.status === "fejlet"
                  ? "bg-red-500"
                  : job.status === "færdig"
                    ? "bg-emerald-500"
                    : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {(errors > 0 || total > 0) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {total > 0 && <span>Importerede: <span className="text-foreground font-medium">{imported}</span></span>}
            {errors > 0 && (
              <span className="text-red-600 dark:text-red-400">Fejl: <span className="font-medium">{errors}</span></span>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-1 pt-1">
          <Button
            data-testid={`preview-btn-${job.id}`}
            variant="ghost"
            size="sm"
            onClick={onPreview}
            disabled={!job.preview || job.preview.length === 0}
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> Forhåndsvisning
          </Button>
          {job.status === "fejlet" && (
            <Button
              data-testid={`retry-btn-${job.id}`}
              variant="ghost"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Prøv igen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- start import-dialog ---------- */

function ImportDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [source, setSource] = useState<string>("excel");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (!open) return;
    setSource("excel");
    setFileName("");
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      source,
      fileName: fileName.trim() || `${SOURCE_LABEL[source]}-import.xlsx`,
      status: "uploadet",
      totalRows: 0,
      importedRows: 0,
      errorRows: 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start import</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vælg kilde</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger data-testid="input-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => {
                  const Icon = SOURCE_ICON[s] ?? Database;
                  return (
                    <SelectItem key={s} value={s}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        {SOURCE_LABEL[s]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="file-name">Filnavn</Label>
            <Input
              id="file-name"
              data-testid="input-fileName"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="F.eks. kontoplan-2026.xlsx"
            />
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Filen uploades og valideres automatisk. Du kan se fremskridt og eventuelle fejl på kortet efter start.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="cancel-btn"
            >
              Annuller
            </Button>
            <Button type="submit" disabled={pending} data-testid="save-btn">
              {pending ? "Starter…" : "Start import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- forhåndsvisnings-dialog ---------- */

function PreviewDialog({
  job,
  onOpenChange,
}: {
  job: ImportJob | null;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = job?.preview ?? [];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Forhåndsvisning — {job?.fileName ?? ""}</DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Ingen forhåndsvisningsdata tilgængelig.
          </p>
        ) : (
          <div className="overflow-auto max-h-[60vh] rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 whitespace-nowrap">
                        {row[h] == null ? "—" : String(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="close-preview-btn"
          >
            Luk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

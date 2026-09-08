import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@//lib/queryClient";
import { useAuth } from "@//lib/auth";
import { useToast } from "@//hooks/use-toast";
import { PageHeader, SectionCard, StatusChip } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Upload,
  Building2,
  Users,
  Briefcase,
  FileText,
  Wrench,
  Calculator,
  History,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Loader2,
} from "lucide-react";

/* ---------- typer ---------- */

type ExportEntity =
  | "kunder"
  | "ansatte"
  | "opgaver"
  | "fakturaer"
  | "ydelser"
  | "regnskab";

type ImportEntity = "kunder" | "ansatte" | "opgaver" | "ydelser";

type ImportJob = {
  id: number;
  type?: string | null;
  entity: string;
  status: string;
  rowCount?: number | null;
  errors?: string | null;
  createdAt?: string | null;
};

type ImportResult = {
  imported?: number;
  errors?: string[] | string | null;
  rowCount?: number | null;
  message?: string | null;
};

/* ---------- helpers ---------- */

const EXPORT_ENTITIES: {
  entity: ExportEntity;
  label: string;
  icon: React.ReactNode;
}[] = [
  { entity: "kunder", label: "Kunder", icon: <Users className="size-4" /> },
  { entity: "ansatte", label: "Ansatte", icon: <Briefcase className="size-4" /> },
  { entity: "opgaver", label: "Opgaver", icon: <FileText className="size-4" /> },
  { entity: "fakturaer", label: "Fakturaer", icon: <FileText className="size-4" /> },
  { entity: "ydelser", label: "Ydelser", icon: <Wrench className="size-4" /> },
  { entity: "regnskab", label: "Regnskab", icon: <Calculator className="size-4" /> },
];

const IMPORT_ENTITIES: { entity: ImportEntity; label: string }[] = [
  { entity: "kunder", label: "Kunder" },
  { entity: "ansatte", label: "Ansatte" },
  { entity: "opgaver", label: "Opgaver" },
  { entity: "ydelser", label: "Ydelser" },
];

/**
 * Parser semikolonsepareret CSV. Første række er overskrifter.
 * Returnerer et array af objekter { overskrift: værdi }.
 */
function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ";" && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function downloadText(content: string, filename: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function dk(d?: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}

function formatErrors(errors?: string[] | string | null): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) return errors.length ? errors.join("; ") : null;
  return errors;
}

/* ---------- eksport mutatio­n ---------- */

function useExportEntity() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (entity: ExportEntity) => {
      const res = await apiRequest("POST", "/api/export", { entity });
      // Backend returnerer CSV som tekst, ikke JSON.
      const text = await res.text();
      return { entity, text };
    },
    onSuccess: ({ entity, text }) => {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadText(text, `${entity}-eksport-${stamp}.csv`);
      toast({
        title: "Eksport fuldført",
        description: `${entity} eksporteret som CSV.`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: "Eksport fejlede",
        description: message,
        variant: "destructive",
      });
    },
  });
}

function useFullExport() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/export/full");
      const json = await res.text();
      return json;
    },
    onSuccess: (json) => {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadText(json, `virksomhed-fuldeksport-${stamp}.json`, "application/json");
      toast({
        title: "Fuld virksomhedseksport fuldført",
        description: "Alle data eksporteret som JSON.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: "Fuld eksport fejlede",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/* ---------- import mutatio­n ---------- */

function useImportEntity() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ entity, rows }: { entity: ImportEntity; rows: Record<string, string>[] }) => {
      const res = await apiRequest("POST", "/api/import", { entity, rows });
      const data = (await res.json()) as ImportResult;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/import-jobs"] });
      const imported = data.imported ?? data.rowCount ?? 0;
      const errors = formatErrors(data.errors);
      toast({
        title: "Import fuldført",
        description: errors
          ? `${imported} rækker importeret. Fejl: ${errors}`
          : `${imported} rækker importeret.`,
        variant: errors ? "destructive" : "default",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: "Import fejlede",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/* ---------- hovedkomponent ---------- */

export default function ImportEksportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importEntity, setImportEntity] = useState<ImportEntity>("kunder");
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const exportMut = useExportEntity();
  const fullExportMut = useFullExport();
  const importMut = useImportEntity();

  const jobsQuery = useQuery<ImportJob[]>({
    queryKey: ["/api/import-jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/import-jobs");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.jobs ?? []);
    },
  });

  const jobs = jobsQuery.data ?? [];

  const parsedPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    try {
      const rows = parseCsv(csvText);
      return { rowCount: rows.length, headers: rows[0] ? Object.keys(rows[0]) : [] };
    } catch {
      return null;
    }
  }, [csvText]);

  function handleImport(e: FormEvent) {
    e.preventDefault();
    setImportResult(null);
    if (!csvText.trim()) {
      toast({
        title: "Ingen data",
        description: "Indsæt CSV-data før import.",
        variant: "destructive",
      });
      return;
    }
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      toast({
        title: "Ugyldig CSV",
        description: "Kunne ikke parse data. Tjek at første række er overskrifter.",
        variant: "destructive",
      });
      return;
    }
    importMut.mutate(
      { entity: importEntity, rows },
      {
        onSuccess: (data) => setImportResult(data),
      },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import / Eksport"
        description="Eksportér og importér data for virksomheden."
        action={
          <Button
            data-testid="btn-full-export"
            variant="default"
            onClick={() => fullExportMut.mutate()}
            disabled={fullExportMut.isPending}
          >
            {fullExportMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Building2 className="size-4" />
            )}
            Fuld virksomhedseksport
          </Button>
        }
      />

      {/* EKSPORT */}
      <SectionCard
        title="Eksportér data"
        icon={<Download className="size-4" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EXPORT_ENTITIES.map(({ entity, label, icon }) => (
            <Button
              key={entity}
              data-testid={`btn-export-${entity}`}
              variant="outline"
              onClick={() => exportMut.mutate(entity)}
              disabled={exportMut.isPending}
              className="justify-start"
            >
              {exportMut.isPending && exportMut.variables === entity ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                icon
              )}
              {label}
              <FileDown className="size-3.5 ml-auto text-muted-foreground" />
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Eksporterer semikolonsepareret CSV (UTF-8) med overskrifter på første række.
        </p>
      </SectionCard>

      {/* IMPORT */}
      <SectionCard title="Importér data" icon={<Upload className="size-4" />}>
        <form onSubmit={handleImport} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="import-entity" className="text-xs">
              Vælg enhed
            </Label>
            <Select
              value={importEntity}
              onValueChange={(v) => setImportEntity(v as ImportEntity)}
            >
              <SelectTrigger id="import-entity" data-testid="select-import-entity" className="w-full sm:w-64">
                <SelectValue placeholder="Vælg enhed" />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_ENTITIES.map(({ entity, label }) => (
                  <SelectItem key={entity} value={entity} data-testid={`opt-import-${entity}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-csv" className="text-xs">
              CSV-data (semikolonsepareret, første række er overskrifter)
            </Label>
            <Textarea
              id="import-csv"
              data-testid="textarea-import-csv"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"navn;email;telefon\nTest Testesen;test@eksempel.dk;12345678"}
              className="font-mono text-xs min-h-[160px]"
            />
            {parsedPreview && (
              <p className="text-[11px] text-muted-foreground">
                Parse preview: {parsedPreview.rowCount} datarække(r), {parsedPreview.headers.length} kolonne(r).
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              data-testid="btn-import-submit"
              disabled={importMut.isPending}
            >
              {importMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Importér
            </Button>
            <Button
              type="button"
              data-testid="btn-import-clear"
              variant="ghost"
              onClick={() => {
                setCsvText("");
                setImportResult(null);
              }}
            >
              Ryd
            </Button>
          </div>

          {importResult && (
            <div
              data-testid="import-result"
              className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {importResult.errors ? (
                  <AlertTriangle className="size-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                )}
                Importresultat
              </div>
              <p className="text-xs text-muted-foreground">
                Importerede rækker: {importResult.imported ?? importResult.rowCount ?? 0}
              </p>
              {formatErrors(importResult.errors) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Fejl: {formatErrors(importResult.errors)}
                </p>
              )}
            </div>
          )}
        </form>
      </SectionCard>

      {/* IMPORT-HISTORIK */}
      <SectionCard
        title="Import-historik"
        icon={<History className="size-4" />}
      >
        {jobsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : jobsQuery.isError ? (
          <p className="text-xs text-muted-foreground">
            Kunne ikke hente import-historik.
          </p>
        ) : jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Ingen importer endnu.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-3">
            <table className="w-full text-xs" data-testid="table-import-jobs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="font-medium px-3 py-1.5">Type</th>
                  <th className="font-medium px-3 py-1.5">Enhed</th>
                  <th className="font-medium px-3 py-1.5">Status</th>
                  <th className="font-medium px-3 py-1.5 text-right">Rækker</th>
                  <th className="font-medium px-3 py-1.5">Fejl</th>
                  <th className="font-medium px-3 py-1.5">Oprettet</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const statusVariant =
                    job.status === "completed" || job.status === "success" || job.status === "fuldført"
                      ? "green"
                      : job.status === "failed" || job.status === "fejlet"
                        ? "red"
                        : job.status === "pending" || job.status === "processing"
                          ? "amber"
                          : "gray";
                  return (
                    <tr key={job.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-1.5">{job.type ?? "import"}</td>
                      <td className="px-3 py-1.5">{job.entity}</td>
                      <td className="px-3 py-1.5">
                        <StatusChip status={job.status} variant={statusVariant} />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{job.rowCount ?? 0}</td>
                      <td className="px-3 py-1.5 max-w-[220px] truncate" title={job.errors ?? ""}>
                        {job.errors ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{dk(job.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {user && (
        <p className="text-[11px] text-muted-foreground">
          Logget ind som {user.name} ({user.email}).
        </p>
      )}
    </div>
  );
}

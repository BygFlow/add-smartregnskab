import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Database, FileSpreadsheet, Plus, RotateCcw, XCircle } from "lucide-react";

type MigrationJob = { id: number; source?: string | null; fileName?: string | null; totalRows?: number | null; importedRows?: number | null; errorRows?: number | null; status?: string | null; rollbackAvailable?: boolean | null; validationErrors?: string | null };
type ImportPreview = { token: string; totalRows: number; validRows: number; errors: string[]; matchedFields: string[]; sample: Record<string, unknown>[] };

const SOURCE_LABEL: Record<string, string> = { economic: "e-conomic", dinero: "Dinero", billy: "Billy", excel: "Excel", csv: "CSV" };
const SOURCES = Object.keys(SOURCE_LABEL);
const STATUS_LABEL: Record<string, string> = { uploadet: "Uploadet", validerer: "Validerer", importerer: "Importerer", færdig: "Færdig", fejlet: "Fejlet", rolled_back: "Rullet tilbage" };
const STATUS_STYLE: Record<string, string> = { uploadet: "badge-soft-gray", validerer: "badge-soft-amber", importerer: "badge-soft-blue", færdig: "badge-soft-green", fejlet: "badge-soft-red", rolled_back: "badge-soft-red" };
function errorText(error: unknown) { return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Ukendt fejl"; }
function parseErrors(value?: string | null): string[] { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return value ? [value] : []; } }

export default function MigrationWizard({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [form, setForm] = useState({ source: "excel", entity: "customers", fileName: "", content: "" });
  const jobsQuery = useQuery<MigrationJob[]>({ queryKey: ["/api/migration-jobs", companyId], queryFn: async () => { const response = await apiRequest("GET", `/api/migration-jobs?companyId=${companyId}`); const value = await response.json(); return Array.isArray(value) ? value : value.items || []; } });

  const previewMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/migration/preview", { ...form, companyId })).json(),
    onSuccess: (value: ImportPreview) => { setPreview(value); toast({ title: "Filen er valideret", description: `${value.validRows} rækker er klar.` }); },
    onError: (error) => toast({ title: "Validering fejlede", description: errorText(error), variant: "destructive" }),
  });
  const commitMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/migration/commit", { ...form, token: preview?.token, companyId })).json(),
    onSuccess: (value: any) => { qc.invalidateQueries({ queryKey: ["/api/migration-jobs"] }); toast({ title: "Import gennemført", description: `${value.importedRows || 0} oprettet; ${value.skippedRows || 0} dubletter sprunget over.` }); setOpen(false); setPreview(null); setForm({ source: "excel", entity: "customers", fileName: "", content: "" }); },
    onError: (error) => toast({ title: "Import fejlede", description: errorText(error), variant: "destructive" }),
  });
  const rollbackMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/migration-jobs/${id}/rollback?companyId=${companyId}`, {})).json(),
    onSuccess: (value: any) => { qc.invalidateQueries({ queryKey: ["/api/migration-jobs"] }); toast({ title: "Rollback gennemført", description: `${value.removedRows || 0} importerede rækker blev fjernet.` }); },
    onError: (error) => toast({ title: "Rollback fejlede", description: errorText(error), variant: "destructive" }),
  });

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Migreringsguide</h2><p className="text-sm text-muted-foreground">Sikker import fra e-conomic, Dinero, Billy, Excel eller CSV med forhåndsvisning og rollback.</p></div><Button data-testid="start-migration-btn" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Start import</Button></div>
    <div className="rounded-md border border-blue-300/60 bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/20 dark:text-blue-300">Eksportér data som CSV fra kildesystemet. Intet skrives, før du har set og godkendt valideringen.</div>
    {jobsQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (jobsQuery.data || []).length === 0 ? <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">Ingen migreringer endnu.</div> : <div className="grid gap-4 md:grid-cols-2">{(jobsQuery.data || []).map((job) => {
      const total = Number(job.totalRows || 0); const imported = Number(job.importedRows || 0); const errors = parseErrors(job.validationErrors);
      return <div key={job.id} className="kpi-card space-y-3" data-testid={`job-card-${job.id}`}>
        <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2">{["excel", "csv"].includes(job.source || "") ? <FileSpreadsheet className="h-4 w-4" /> : <Database className="h-4 w-4" />}<div><div className="font-medium">{job.fileName || "Import"}</div><div className="text-xs text-muted-foreground">{SOURCE_LABEL[job.source || ""] || job.source}</div></div></div><span className={`badge-soft ${STATUS_STYLE[job.status || ""] || "badge-soft-gray"}`}>{STATUS_LABEL[job.status || ""] || job.status}</span></div>
        <div className="grid grid-cols-3 gap-2 text-xs"><div><span className="block text-muted-foreground">Total</span>{total}</div><div><span className="block text-muted-foreground">Importeret</span><span className="text-emerald-600">{imported}</span></div><div><span className="block text-muted-foreground">Sprunget over</span>{Number(job.errorRows || 0)}</div></div>
        {errors.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs dark:bg-amber-950/20"><div className="flex items-center gap-1 font-medium"><XCircle className="h-3.5 w-3.5" /> Bemærkninger</div>{errors.slice(0, 5).map((error) => <div key={error}>{error}</div>)}</div>}
        <div className="flex items-center justify-between">{job.status === "færdig" && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Gennemført</span>}{job.rollbackAvailable && job.status !== "rolled_back" && <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={rollbackMutation.isPending} onClick={() => rollbackMutation.mutate(job.id)}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Rollback</Button>}</div>
      </div>;
    })}</div>}

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setPreview(null); }}><DialogContent><DialogHeader><DialogTitle>Importér regnskabsdata</DialogTitle></DialogHeader><div className="space-y-4 py-2">
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Kilde</Label><Select value={form.source} onValueChange={(source) => { setPreview(null); setForm((value) => ({ ...value, source })); }}><SelectTrigger data-testid="form-source"><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((source) => <SelectItem key={source} value={source}>{SOURCE_LABEL[source]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Datatype</Label><Select value={form.entity} onValueChange={(entity) => { setPreview(null); setForm((value) => ({ ...value, entity })); }}><SelectTrigger data-testid="form-entity"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customers">Kunder</SelectItem><SelectItem value="suppliers">Leverandører</SelectItem><SelectItem value="accounts">Kontoplan</SelectItem></SelectContent></Select></div></div>
      <div className="space-y-2"><Label htmlFor="migration-file">CSV-fil</Label><Input id="migration-file" type="file" accept=".csv,.txt,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const content = await file.text(); setPreview(null); setForm((value) => ({ ...value, fileName: file.name, content })); }} /></div>
      <div className="space-y-2"><Label htmlFor="migration-content">Eller indsæt CSV-indhold</Label><Textarea id="migration-content" data-testid="form-content" className="min-h-28 font-mono text-xs" value={form.content} placeholder={'Navn;Email;CVR\nEksempel ApS;kontakt@eksempel.dk;12345678'} onChange={(event) => { setPreview(null); setForm((value) => ({ ...value, content: event.target.value })); }} /></div>
      {preview && <div className={`rounded-md border p-3 text-xs ${preview.errors.length ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"}`}><div className="font-medium">{preview.validRows} af {preview.totalRows} rækker er gyldige</div><div className="mt-1 text-muted-foreground">Genkendte felter: {preview.matchedFields.join(", ")}</div>{preview.errors.slice(0, 5).map((error) => <div key={error} className="mt-1 text-destructive">{error}</div>)}</div>}
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuller</Button><Button data-testid="form-save" disabled={!form.content.trim() || previewMutation.isPending || commitMutation.isPending || Boolean(preview?.errors.length)} onClick={() => preview ? commitMutation.mutate() : previewMutation.mutate()}>{previewMutation.isPending ? "Validerer…" : commitMutation.isPending ? "Importerer…" : preview ? "Godkend og importér" : "Validér og forhåndsvis"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

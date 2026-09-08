import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AlertTriangle, Plus, Search, Trash2, Pencil, CheckCircle2, Clock, ShieldAlert } from "lucide-react";

type SourceType = "feedback" | "quality" | "task" | "manual";
type Category = "kvalitet" | "service" | "sikkerhed" | "materialer" | "andet";
type Severity = "lav" | "mellem" | "hoej" | "kritisk";
type Status = "ny" | "under_behandling" | "igang" | "afsluttet" | "afvist";

interface Deviation {
  id: number; companyId: number; sourceType: SourceType; sourceId?: number | null;
  customerId?: number | null; taskId?: number | null; title: string;
  description?: string | null; cause?: string | null; category: Category;
  severity: Severity; responsibleEmployeeId?: number | null; deadline?: string | null;
  status: Status; correctiveAction?: string | null; followUpDate?: string | null;
  customerNotified?: boolean | null; resolution?: string | null; createdAt?: string | null;
}
interface Customer { id: number; name: string; }
interface Employee { id: number; name: string; }
interface Task { id: number; title: string; }

const STATUS_LABEL: Record<Status, string> = { ny: "Ny", under_behandling: "Under behandling", igang: "I gang", afsluttet: "Afsluttet", afvist: "Afvist" };
const STATUS_CLASS: Record<Status, string> = { ny: "badge-soft badge-soft-amber", under_behandling: "badge-soft badge-soft-blue", igang: "badge-soft badge-soft-blue", afsluttet: "badge-soft badge-soft-green", afvist: "badge-soft badge-soft-gray" };
const SEVERITY_LABEL: Record<Severity, string> = { lav: "Lav", mellem: "Mellem", hoej: "Høj", kritisk: "Kritisk" };
const SEVERITY_CLASS: Record<Severity, string> = { lav: "badge-soft badge-soft-green", mellem: "badge-soft badge-soft-amber", hoej: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400", kritisk: "badge-soft badge-soft-red" };
const CATEGORY_LABEL: Record<Category, string> = { kvalitet: "Kvalitet", service: "Service", sikkerhed: "Sikkerhed", materialer: "Materialer", andet: "Andet" };
const SOURCE_LABEL: Record<SourceType, string> = { feedback: "Feedback", quality: "Kvalitetskontrol", task: "Opgave", manual: "Manuel" };

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("da-DK") : "—");
const isOverdue = (d: Deviation) => !!d.deadline && d.status !== "afsluttet" && new Date(d.deadline).getTime() < Date.now();

export default function Afvigelser({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = user?.role !== "viewer";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deviation | null>(null);
  const [viewTarget, setViewTarget] = useState<Deviation | null>(null);

  const { data: deviations = [], isLoading } = useQuery<Deviation[]>({
    queryKey: ["/api/deviations", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/deviations?companyId=${companyId}`)).json(),
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/tasks?companyId=${companyId}`)).json(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/deviations"] });

  const createDev = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/deviations`, body)).json(),
    onSuccess: () => { invalidate(); setCreateOpen(false); toast({ title: "Afvigelse oprettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke oprette afvigelse", description: e.message, variant: "destructive" }),
  });
  const updateDev = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) => (await apiRequest("PATCH", `/api/deviations/${id}`, data)).json(),
    onSuccess: () => { invalidate(); setEditTarget(null); toast({ title: "Afvigelse opdateret" }); },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere afvigelse", description: e.message, variant: "destructive" }),
  });
  const deleteDev = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/deviations/${id}`)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Afvigelse slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette afvigelse", description: e.message, variant: "destructive" }),
  });

  const customerName = (id?: number | null) => customers.find((c) => c.id === id)?.name ?? "—";
  const employeeName = (id?: number | null) => employees.find((e) => e.id === id)?.name ?? "—";

  const stats = useMemo(() => {
    const isOpen = (d: Deviation) => d.status !== "afsluttet" && d.status !== "afvist";
    const now = new Date();
    return {
      open: deviations.filter(isOpen).length,
      critical: deviations.filter((d) => d.severity === "kritisk" && isOpen(d)).length,
      overdue: deviations.filter(isOverdue).length,
      resolved: deviations.filter((d) => {
        if (d.status !== "afsluttet" || !d.createdAt) return false;
        const c = new Date(d.createdAt);
        return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [deviations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deviations.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (severityFilter !== "all" && d.severity !== severityFilter) return false;
      if (q && !`${d.title} ${d.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [deviations, search, statusFilter, severityFilter]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-afvigelser">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  const statCards = [
    { label: "Åbne", value: stats.open, icon: AlertTriangle, tone: "text-blue-600 dark:text-blue-400", test: "stat-open" },
    { label: "Kritiske", value: stats.critical, icon: ShieldAlert, tone: "text-red-600 dark:text-red-400", test: "stat-critical" },
    { label: "Overskredet", value: stats.overdue, icon: Clock, tone: "text-amber-600 dark:text-amber-400", test: "stat-overdue" },
    { label: "Løst denne måned", value: stats.resolved, icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", test: "stat-resolved" },
  ];

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Afvigelser & CAPA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Registrer og følg op på afvigelser, klager og korrigerende handlinger</p>
        </div>
        {canManage && (
          <Button data-testid="button-new-afvigelse" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Opret afvigelse
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.test} data-testid={s.test}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.tone}`} />
              <div>
                <p className="text-2xl font-bold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="input-search-afvigelse" placeholder="Søg på titel eller beskrivelse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status-filter" className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statusser</SelectItem>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger data-testid="select-severity-filter" className="sm:w-48"><SelectValue placeholder="Alvorsgrad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle alvorsgrader</SelectItem>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-10 text-center" data-testid="empty-afvigelser">
              <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Ingen afvigelser fundet</p>
            </div>
          ) : (
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead><TableHead>Kategori</TableHead><TableHead>Alvorsgrad</TableHead>
                  <TableHead>Kunde</TableHead><TableHead>Ansvarlig</TableHead><TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const overdue = isOverdue(d);
                  return (
                    <TableRow key={d.id} data-testid={`row-afvigelse-${d.id}`}>
                      <TableCell className="font-medium max-w-[220px] truncate" title={d.title}>{d.title}</TableCell>
                      <TableCell>{CATEGORY_LABEL[d.category]}</TableCell>
                      <TableCell><Badge className={SEVERITY_CLASS[d.severity]}>{SEVERITY_LABEL[d.severity]}</Badge></TableCell>
                      <TableCell>{customerName(d.customerId)}</TableCell>
                      <TableCell>{employeeName(d.responsibleEmployeeId)}</TableCell>
                      <TableCell>
                        <span className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>{fmtDate(d.deadline)}</span>
                        {overdue && <Badge className="badge-soft badge-soft-red ml-1" data-testid={`badge-overdue-${d.id}`}><Clock className="w-3 h-3" />Overskredet</Badge>}
                      </TableCell>
                      <TableCell><Badge className={STATUS_CLASS[d.status]}>{STATUS_LABEL[d.status]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" data-testid={`button-view-${d.id}`} onClick={() => setViewTarget(d)}><Search className="w-4 h-4" /></Button>
                          {canManage && (<>
                            <Button variant="ghost" size="sm" data-testid={`button-edit-${d.id}`} onClick={() => setEditTarget(d)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" data-testid={`button-delete-${d.id}`} onClick={() => deleteDev.mutate(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </>)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ny afvigelse</DialogTitle></DialogHeader>
          <DeviationForm customers={customers} employees={employees} tasks={tasks} pending={createDev.isPending} onSubmit={(data) => createDev.mutate({ ...data, companyId })} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Rediger afvigelse</DialogTitle></DialogHeader>
          {editTarget && <DeviationForm initial={editTarget} customers={customers} employees={employees} tasks={tasks} isEdit pending={updateDev.isPending} onSubmit={(data) => updateDev.mutate({ id: editTarget.id, data })} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewTarget?.title}</DialogTitle></DialogHeader>
          {viewTarget && (
            <div className="space-y-3 text-sm" data-testid="view-afvigelse">
              <div className="flex flex-wrap gap-2">
                <Badge className={STATUS_CLASS[viewTarget.status]}>{STATUS_LABEL[viewTarget.status]}</Badge>
                <Badge className={SEVERITY_CLASS[viewTarget.severity]}>{SEVERITY_LABEL[viewTarget.severity]}</Badge>
                <Badge variant="outline">{CATEGORY_LABEL[viewTarget.category]}</Badge>
                <Badge variant="secondary">{SOURCE_LABEL[viewTarget.sourceType]}</Badge>
                {isOverdue(viewTarget) && <Badge className="badge-soft badge-soft-red"><Clock className="w-3 h-3" />Overskredet</Badge>}
              </div>
              <Field label="Beskrivelse" value={viewTarget.description} />
              <Field label="Årsag" value={viewTarget.cause} />
              <Field label="Kunde" value={customerName(viewTarget.customerId)} />
              <Field label="Ansvarlig" value={employeeName(viewTarget.responsibleEmployeeId)} />
              <Field label="Deadline" value={fmtDate(viewTarget.deadline)} />
              <Field label="Korrigerende handling" value={viewTarget.correctiveAction} />
              <Field label="Løsning" value={viewTarget.resolution} />
              <Field label="Opfølgningsdato" value={fmtDate(viewTarget.followUpDate)} />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Kunde orienteret:</span>
                {viewTarget.customerNotified ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <span className="text-muted-foreground">Nej</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

interface FormProps { initial?: Deviation; customers: Customer[]; employees: Employee[]; tasks: Task[]; isEdit?: boolean; pending: boolean; onSubmit: (data: Record<string, unknown>) => void; }

function DeviationForm({ initial, customers, employees, tasks, isEdit, pending, onSubmit }: FormProps) {
  const [form, setForm] = useState<Record<string, unknown>>({
    title: initial?.title ?? "", sourceType: initial?.sourceType ?? "manual", sourceId: initial?.sourceId ?? null,
    customerId: initial?.customerId ?? null, taskId: initial?.taskId ?? null, description: initial?.description ?? "",
    cause: initial?.cause ?? "", category: initial?.category ?? "kvalitet", severity: initial?.severity ?? "mellem",
    responsibleEmployeeId: initial?.responsibleEmployeeId ?? null, deadline: initial?.deadline ?? "",
    status: initial?.status ?? "ny", correctiveAction: initial?.correctiveAction ?? "",
    followUpDate: initial?.followUpDate ?? "", customerNotified: initial?.customerNotified ?? false, resolution: initial?.resolution ?? "",
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const str = (k: string) => String(form[k] ?? "");

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="dev-title">Titel *</Label>
        <Input id="dev-title" data-testid="input-title" required value={str("title")} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField label="Kilde" test="select-source-type" value={str("sourceType")} onChange={(v) => set("sourceType", v)} options={(Object.keys(SOURCE_LABEL) as SourceType[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
        <SelField label="Kategori" test="select-category" value={str("category")} onChange={(v) => set("category", v)} options={(Object.keys(CATEGORY_LABEL) as Category[]).map((s) => ({ value: s, label: CATEGORY_LABEL[s] }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField label="Kunde (valgfri)" test="select-customer" value={form.customerId ? String(form.customerId) : "none"} placeholder="Vælg kunde" onChange={(v) => set("customerId", v === "none" ? null : Number(v))} options={[{ value: "none", label: "Ingen kunde" }, ...customers.map((c) => ({ value: String(c.id), label: c.name }))]} />
        <SelField label="Opgave (valgfri)" test="select-task" value={form.taskId ? String(form.taskId) : "none"} placeholder="Vælg opgave" onChange={(v) => set("taskId", v === "none" ? null : Number(v))} options={[{ value: "none", label: "Ingen opgave" }, ...tasks.map((t) => ({ value: String(t.id), label: t.title }))]} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-description">Beskrivelse</Label>
        <Textarea id="dev-description" data-testid="input-description" rows={3} value={str("description")} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField label="Alvorsgrad" test="select-severity" value={str("severity")} onChange={(v) => set("severity", v)} options={(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))} />
        <SelField label="Ansvarlig" test="select-responsible" value={form.responsibleEmployeeId ? String(form.responsibleEmployeeId) : "none"} placeholder="Vælg medarbejder" onChange={(v) => set("responsibleEmployeeId", v === "none" ? null : Number(v))} options={[{ value: "none", label: "Ingen" }, ...employees.map((e) => ({ value: String(e.id), label: e.name }))]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dev-deadline">Deadline</Label>
          <Input id="dev-deadline" data-testid="input-deadline" type="date" value={form.deadline ? str("deadline").slice(0, 10) : ""} onChange={(e) => set("deadline", e.target.value || null)} />
        </div>
        {isEdit && <SelField label="Status" test="select-status" value={str("status")} onChange={(v) => set("status", v)} options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-corrective">Korrigerende handling</Label>
        <Textarea id="dev-corrective" data-testid="input-corrective-action" rows={3} value={str("correctiveAction")} onChange={(e) => set("correctiveAction", e.target.value)} />
      </div>
      {isEdit && (<>
        <div className="space-y-1.5">
          <Label htmlFor="dev-cause">Årsag</Label>
          <Textarea id="dev-cause" data-testid="input-cause" rows={2} value={str("cause")} onChange={(e) => set("cause", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dev-resolution">Løsning</Label>
          <Textarea id="dev-resolution" data-testid="input-resolution" rows={2} value={str("resolution")} onChange={(e) => set("resolution", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dev-followup">Opfølgningsdato</Label>
          <Input id="dev-followup" data-testid="input-followup" type="date" value={form.followUpDate ? str("followUpDate").slice(0, 10) : ""} onChange={(e) => set("followUpDate", e.target.value || null)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="dev-notified" data-testid="input-customer-notified" checked={Boolean(form.customerNotified)} onCheckedChange={(v) => set("customerNotified", v === true)} />
          <Label htmlFor="dev-notified" className="cursor-pointer">Kunde orienteret</Label>
        </div>
      </>)}
      <DialogFooter>
        <Button type="submit" disabled={pending} data-testid="button-submit">{isEdit ? "Gem ændringer" : "Opret"}</Button>
      </DialogFooter>
    </form>
  );
}

function SelField({ label, test, value, onChange, options, placeholder }: { label: string; test: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={test}><SelectValue placeholder={placeholder ?? label} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

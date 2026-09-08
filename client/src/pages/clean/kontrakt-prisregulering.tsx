import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, TrendingUp, Plus, Search, Trash2, Pencil, Send, CheckCircle2, Calendar } from "lucide-react";

type AdjustmentType = "indeksregulering" | "prisstigning" | "kontraktfornyelse" | "opsigelse";
type AdjustmentStatus = "udkast" | "sendt" | "godkendt" | "afvist" | "gennemfoert" | "annulleret";

interface ContractAdjustment {
  id: number;
  companyId: number;
  customerId: number;
  contractId?: number | null;
  type: AdjustmentType;
  description?: string | null;
  oldPrice?: number | string | null;
  newPrice?: number | string | null;
  adjustmentPercentage?: number | string | null;
  adjustmentDate?: string | null;
  effectiveDate?: string | null;
  notificationSent?: boolean;
  notificationDate?: string | null;
  customerApproved?: boolean;
  approvedDate?: string | null;
  status: AdjustmentStatus;
  notes?: string | null;
  createdAt?: string | null;
}

interface Customer { id: number; name: string; }

const TYPE_LABELS: Record<AdjustmentType, string> = {
  indeksregulering: "Indeksregulering",
  prisstigning: "Prisstigning",
  kontraktfornyelse: "Kontraktfornyelse",
  opsigelse: "Opsigelse",
};
const TYPE_BADGE: Record<AdjustmentType, string> = {
  indeksregulering: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  prisstigning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  kontraktfornyelse: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  opsigelse: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};
const STATUS_LABELS: Record<AdjustmentStatus, string> = {
  udkast: "Udkast", sendt: "Sendt", godkendt: "Godkendt", afvist: "Afvist",
  gennemfoert: "Gennemført", annulleret: "Annulleret",
};
const STATUS_BADGE: Record<AdjustmentStatus, string> = {
  udkast: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sendt: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  godkendt: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  afvist: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  gennemfoert: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  annulleret: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}
function money(value?: number | string | null): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(num(value));
}
function pct(value?: number | string | null): string {
  const n = num(value);
  return `${n > 0 ? "+" : ""}${n.toLocaleString("da-DK", { maximumFractionDigits: 2 })}%`;
}
function formatDate(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}.${month}.${year}`;
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function nowIso(): string { return new Date().toISOString(); }

interface FormState {
  customerId: string;
  type: AdjustmentType;
  description: string;
  oldPrice: string;
  newPrice: string;
  adjustmentDate: string;
  effectiveDate: string;
  notes: string;
}
function emptyForm(): FormState {
  const t = today();
  return { customerId: "", type: "indeksregulering", description: "", oldPrice: "", newPrice: "", adjustmentDate: t, effectiveDate: t, notes: "" };
}
function calcPct(oldP: string, newP: string): number {
  const o = parseFloat(oldP);
  const n = parseFloat(newP);
  if (!Number.isFinite(o) || o === 0 || !Number.isFinite(n)) return 0;
  return ((n - o) / o) * 100;
}

function KontraktPrisregulering({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<AdjustmentType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<AdjustmentStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ContractAdjustment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data: adjustments = [], isLoading } = useQuery<ContractAdjustment[]>({
    queryKey: ["/api/contract-adjustments", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/contract-adjustments?companyId=${companyId}`)).json(),
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/contract-adjustments"] });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await apiRequest("POST", "/api/contract-adjustments", { ...body, companyId })).json(),
    onSuccess: () => { invalidate(); setFormOpen(false); toast({ title: "Prisregulering oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette", description: e.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      (await apiRequest("PATCH", `/api/contract-adjustments/${id}`, body)).json(),
    onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); toast({ title: "Prisregulering opdateret" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/contract-adjustments/${id}`); },
    onSuccess: () => { invalidate(); toast({ title: "Prisregulering slettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });

  const customerName = (customerId: number) => customers.find((c) => c.id === customerId)?.name ?? "—";

  const filtered = useMemo(() => adjustments.filter((a) => {
    const name = customerName(a.customerId).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  }), [adjustments, customers, search, filterType, filterStatus]);

  const stats = useMemo(() => {
    const total = adjustments.length;
    const pending = adjustments.filter((a) => a.status === "sendt").length;
    const thisYear = new Date().getFullYear();
    const approved = adjustments.filter((a) => a.status === "godkendt" && !!a.approvedDate && new Date(a.approvedDate).getFullYear() === thisYear).length;
    const increase = adjustments
      .filter((a) => a.status === "gennemfoert" || a.status === "godkendt")
      .reduce((sum, a) => sum + Math.max(0, num(a.newPrice) - num(a.oldPrice)), 0);
    return { total, pending, approved, increase };
  }, [adjustments]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (a: ContractAdjustment) => {
    setEditing(a);
    setForm({
      customerId: String(a.customerId ?? ""),
      type: a.type,
      description: a.description ?? "",
      oldPrice: a.oldPrice != null ? String(a.oldPrice) : "",
      newPrice: a.newPrice != null ? String(a.newPrice) : "",
      adjustmentDate: a.adjustmentDate ?? today(),
      effectiveDate: a.effectiveDate ?? today(),
      notes: a.notes ?? "",
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!form.customerId) { toast({ title: "Vælg en kunde", variant: "destructive" }); return; }
    const body: Record<string, unknown> = {
      customerId: Number(form.customerId),
      type: form.type,
      description: form.description.trim() || null,
      oldPrice: form.oldPrice ? num(form.oldPrice) : 0,
      newPrice: form.newPrice ? num(form.newPrice) : 0,
      adjustmentPercentage: calcPct(form.oldPrice, form.newPrice),
      adjustmentDate: form.adjustmentDate || null,
      effectiveDate: form.effectiveDate || null,
      notes: form.notes.trim() || null,
    };
    if (editing) updateMutation.mutate({ id: editing.id, body });
    else createMutation.mutate(body);
  };

  const sendNotification = (a: ContractAdjustment) => updateMutation.mutate({
    id: a.id, body: { notificationSent: true, notificationDate: nowIso(), status: "sendt" },
  });
  const approve = (a: ContractAdjustment) => updateMutation.mutate({
    id: a.id, body: { customerApproved: true, approvedDate: nowIso(), status: "gennemfoert" },
  });
  const reject = (a: ContractAdjustment) => updateMutation.mutate({ id: a.id, body: { status: "afvist" } });

  const currentPct = calcPct(form.oldPrice, form.newPrice);
  const viewAdjustment = viewId ? adjustments.find((a) => a.id === viewId) ?? null : null;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-7xl mx-auto pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kontrakt Prisregulering</h1>
          <p className="text-sm text-muted-foreground">Prisregulering og fornyelse af kontrakter</p>
        </div>
        <Button data-testid="button-add-adjustment" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" />Ny prisregulering
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-total">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Samlede reguleringer</p>
              <p className="text-xl font-semibold">{stats.total}</p>
            </div>
            <FileText className="w-5 h-5 text-blue-500" />
          </CardContent>
        </Card>
        <Card data-testid="card-pending">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Afventer (sendt)</p>
              <p className="text-xl font-semibold text-amber-600 dark:text-amber-500">{stats.pending}</p>
            </div>
            <Send className="w-5 h-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card data-testid="card-approved">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Godkendt i år</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-500">{stats.approved}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </CardContent>
        </Card>
        <Card data-testid="card-increase">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Samlet prisstigning</p>
              <p className="text-xl font-semibold">{money(stats.increase)}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="input-search" placeholder="Søg på kundenavn..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as AdjustmentType | "all")}>
          <SelectTrigger className="w-44" data-testid="select-filter-type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {(Object.keys(TYPE_LABELS) as AdjustmentType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as AdjustmentStatus | "all")}>
          <SelectTrigger className="w-44" data-testid="select-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statusser</SelectItem>
            {(Object.keys(STATUS_LABELS) as AdjustmentStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-adjustments">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen prisreguleringer registreret.
        </div>
      ) : (
        <Card data-testid="card-adjustments-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Gammel pris</TableHead>
                    <TableHead className="text-right">Ny pris</TableHead>
                    <TableHead className="text-right">Regulering %</TableHead>
                    <TableHead>Ikrafttrædelse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id} data-testid={`row-adjustment-${a.id}`}>
                      <TableCell className="font-medium max-w-44 truncate">{customerName(a.customerId)}</TableCell>
                      <TableCell><Badge className={TYPE_BADGE[a.type]}>{TYPE_LABELS[a.type] ?? a.type}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{money(a.oldPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{money(a.newPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={num(a.adjustmentPercentage) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}>
                          {pct(a.adjustmentPercentage)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">{formatDate(a.effectiveDate)}</TableCell>
                      <TableCell><Badge className={STATUS_BADGE[a.status]}>{STATUS_LABELS[a.status] ?? a.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <button className="p-1.5 rounded-md hover:bg-muted" data-testid={`button-view-${a.id}`} onClick={() => setViewId(a.id)} aria-label="Vis detaljer"><FileText className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded-md hover:bg-muted" data-testid={`button-edit-${a.id}`} onClick={() => openEdit(a)} aria-label="Rediger"><Pencil className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-delete-${a.id}`} onClick={() => deleteMutation.mutate(a.id)} aria-label="Slet"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Rediger prisregulering" : "Ny prisregulering"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="customer">Kunde *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}>
                <SelectTrigger data-testid="select-customer" id="customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as AdjustmentType }))}>
                <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as AdjustmentType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea id="description" data-testid="input-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="F.eks. Årlig indeksregulering" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="old-price">Gammel pris (kr)</Label>
                <Input id="old-price" data-testid="input-old-price" type="number" value={form.oldPrice} onChange={(e) => setForm((f) => ({ ...f, oldPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-price">Ny pris (kr)</Label>
                <Input id="new-price" data-testid="input-new-price" type="number" value={form.newPrice} onChange={(e) => setForm((f) => ({ ...f, newPrice: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Regulering %</Label>
              <div className="text-sm font-medium tabular-nums">
                {currentPct > 0 ? "+" : ""}{currentPct.toLocaleString("da-DK", { maximumFractionDigits: 2 })}%
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="adj-date">Reguleringsdato</Label>
                <Input id="adj-date" data-testid="input-adjustment-date" type="date" value={form.adjustmentDate} onChange={(e) => setForm((f) => ({ ...f, adjustmentDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eff-date">Ikrafttrædelse</Label>
                <Input id="eff-date" data-testid="input-effective-date" type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Noter</Label>
              <Textarea id="notes" data-testid="input-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Valgfrie noter" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-save" disabled={createMutation.isPending || updateMutation.isPending || !form.customerId} onClick={submitForm}>
              {editing ? "Gem ændringer" : "Opret prisregulering"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={viewId !== null} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detaljer om prisregulering</DialogTitle></DialogHeader>
          {viewAdjustment && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Kunde</p>
                  <p className="font-medium">{customerName(viewAdjustment.customerId)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <Badge className={TYPE_BADGE[viewAdjustment.type]}>{TYPE_LABELS[viewAdjustment.type] ?? viewAdjustment.type}</Badge>
                </div>
              </div>
              {viewAdjustment.description && (
                <div><p className="text-muted-foreground">Beskrivelse</p><p>{viewAdjustment.description}</p></div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Gammel pris</p><p className="font-medium">{money(viewAdjustment.oldPrice)}</p></div>
                <div><p className="text-muted-foreground">Ny pris</p><p className="font-medium">{money(viewAdjustment.newPrice)}</p></div>
              </div>
              <div><p className="text-muted-foreground">Regulering</p><p className="font-medium tabular-nums">{pct(viewAdjustment.adjustmentPercentage)}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Reguleringsdato</p>
                  <p>{formatDate(viewAdjustment.adjustmentDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Ikrafttrædelse</p>
                  <p>{formatDate(viewAdjustment.effectiveDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Varsling sendt</p>
                  <p>{viewAdjustment.notificationSent ? "Ja" : "Nej"}{viewAdjustment.notificationDate && ` — ${formatDate(viewAdjustment.notificationDate)}`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kunde godkendt</p>
                  <p>{viewAdjustment.customerApproved ? "Ja" : "Nej"}{viewAdjustment.approvedDate && ` — ${formatDate(viewAdjustment.approvedDate)}`}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge className={STATUS_BADGE[viewAdjustment.status]}>{STATUS_LABELS[viewAdjustment.status] ?? viewAdjustment.status}</Badge>
              </div>
              {viewAdjustment.notes && <div><p className="text-muted-foreground">Noter</p><p>{viewAdjustment.notes}</p></div>}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" data-testid="button-send-notification" disabled={viewAdjustment.status === "sendt" || viewAdjustment.notificationSent || updateMutation.isPending} onClick={() => sendNotification(viewAdjustment)}>
                  <Send className="w-4 h-4 mr-1.5" />Send varsling
                </Button>
                <Button size="sm" variant="outline" data-testid="button-approve" disabled={viewAdjustment.status === "gennemfoert" || viewAdjustment.status === "afvist" || updateMutation.isPending} onClick={() => approve(viewAdjustment)}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />Godkend
                </Button>
                <Button size="sm" variant="outline" data-testid="button-reject" disabled={viewAdjustment.status === "afvist" || viewAdjustment.status === "gennemfoert" || updateMutation.isPending} onClick={() => reject(viewAdjustment)}>
                  Afvis
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KontraktPrisregulering;

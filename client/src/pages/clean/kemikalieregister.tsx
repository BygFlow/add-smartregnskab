import React, { useMemo, useState } from "react";
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
import { FlaskConical, Plus, Search, Trash2, Pencil, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

/* ---------- types & constants ---------- */

type Category = "rengoering" | "desinfektion" | "afkaalkning" | "gulv" | "special" | "andet";
type HazardClass = "ingen" | "irritant" | "aertring" | "brandfarlig" | "giftig" | "aetzende";
type Unit = "liter" | "stk" | "kg";
type Status = "aktiv" | "udlobet" | "udestaaende" | "afskaffet";

interface Chemical {
  id: number;
  companyId: number;
  name: string;
  category: Category;
  hazardClass: HazardClass;
  safetyDataSheet?: string | null;
  ppeRequired?: string | null;
  instructions?: string | null;
  supplier?: string | null;
  purchaseDate?: string | null;
  reviewDate?: string | null;
  expiryDate?: string | null;
  locationId?: number | null;
  stockQuantity?: number | string | null;
  unit?: Unit | null;
  minStock?: number | string | null;
  status: Status;
  notes?: string | null;
  createdAt?: string | null;
}

const CATEGORY_LABELS: Record<Category, string> = {
  rengoering: "Rengøring", desinfektion: "Desinfektion", afkaalkning: "Afkalkning",
  gulv: "Gulv", special: "Special", andet: "Andet",
};
const HAZARD_LABELS: Record<HazardClass, string> = {
  ingen: "Ingen", irritant: "Irriterende", aertring: "Ætsende",
  brandfarlig: "Brandfarlig", giftig: "Giftig", aetzende: "Ætsende",
};
const UNIT_LABELS: Record<Unit, string> = { liter: "Liter", stk: "Stk", kg: "Kg" };
const STATUS_LABELS: Record<Status, string> = {
  aktiv: "Aktiv", udlobet: "Udløbet", udestaaende: "Udestående", afskaffet: "Afskaffet",
};

const HAZARD_BADGE: Record<HazardClass, string> = {
  ingen: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  irritant: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  aertring: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  brandfarlig: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  giftig: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  aetzende: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};
const STATUS_BADGE: Record<Status, string> = {
  aktiv: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  udlobet: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  udestaaende: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  afskaffet: "bg-muted text-muted-foreground border-border",
};

const CAT_OPTS = Object.keys(CATEGORY_LABELS) as Category[];
const HAZ_OPTS = Object.keys(HAZARD_LABELS) as HazardClass[];
const UNIT_OPTS = Object.keys(UNIT_LABELS) as Unit[];
const STATUS_OPTS = Object.keys(STATUS_LABELS) as Status[];

const DAY = 86400000;
const SOON = 90;

/* ---------- helpers ---------- */

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
};

const fmtDate = (d?: string | null): string => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("da-DK");
};

const daysUntil = (d?: string | null): number | null => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.round((dt.getTime() - Date.now()) / DAY);
};

const reviewSoon = (c: Chemical): boolean => {
  const chk = (x: number | null) => x !== null && x >= 0 && x <= SOON;
  return chk(daysUntil(c.reviewDate)) || chk(daysUntil(c.expiryDate));
};
const expired = (c: Chemical): boolean => {
  const e = daysUntil(c.expiryDate);
  return e !== null && e < 0;
};
const lowStock = (c: Chemical): boolean => num(c.stockQuantity) <= num(c.minStock);

/* ---------- form state ---------- */

interface FormState {
  name: string; category: Category; hazardClass: HazardClass;
  ppeRequired: string; instructions: string; supplier: string;
  purchaseDate: string; reviewDate: string; expiryDate: string;
  stockQuantity: string; unit: Unit; minStock: string; notes: string;
}

const emptyForm = (): FormState => ({
  name: "", category: "rengoering", hazardClass: "ingen", ppeRequired: "",
  instructions: "", supplier: "", purchaseDate: "", reviewDate: "", expiryDate: "",
  stockQuantity: "0", unit: "liter", minStock: "0", notes: "",
});

const formFrom = (c: Chemical): FormState => ({
  name: c.name ?? "", category: c.category ?? "rengoering", hazardClass: c.hazardClass ?? "ingen",
  ppeRequired: c.ppeRequired ?? "", instructions: c.instructions ?? "", supplier: c.supplier ?? "",
  purchaseDate: c.purchaseDate?.slice(0, 10) ?? "", reviewDate: c.reviewDate?.slice(0, 10) ?? "",
  expiryDate: c.expiryDate?.slice(0, 10) ?? "", stockQuantity: String(num(c.stockQuantity)),
  unit: c.unit ?? "liter", minStock: String(num(c.minStock)), notes: c.notes ?? "",
});

const formToBody = (f: FormState): Record<string, unknown> => ({
  name: f.name.trim(), category: f.category, hazardClass: f.hazardClass,
  ppeRequired: f.ppeRequired.trim() || null, instructions: f.instructions.trim() || null,
  supplier: f.supplier.trim() || null, purchaseDate: f.purchaseDate || null,
  reviewDate: f.reviewDate || null, expiryDate: f.expiryDate || null,
  stockQuantity: num(f.stockQuantity), unit: f.unit, minStock: num(f.minStock),
  notes: f.notes.trim() || null,
});

/* ---------- form component ---------- */

function ChemicalForm({
  initial, pending, onSubmit,
}: { initial: FormState; pending: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const sel = (val: string, fn: (v: string) => void, opts: { v: string; l: string }[], testId: string) => (
    <Select value={val} onValueChange={fn}>
      <SelectTrigger data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent>
        {opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const dateField = (key: "purchaseDate" | "reviewDate" | "expiryDate", label: string, id: string, testId: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} data-testid={testId} type="date" value={f[key]}
        onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  const numField = (key: "stockQuantity" | "minStock", label: string, id: string, testId: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} data-testid={testId} type="number" step="0.01" value={f[key]}
        onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="chem-name">Navn *</Label>
        <Input id="chem-name" data-testid="input-chem-name" value={f.name}
          onChange={(e) => set("name", e.target.value)} placeholder="F.eks. Universalmiddel 5L" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          {sel(f.category, (v) => set("category", v as Category),
            CAT_OPTS.map((c) => ({ v: c, l: CATEGORY_LABELS[c] })), "select-category")}
        </div>
        <div className="space-y-1.5">
          <Label>Fareklasse</Label>
          {sel(f.hazardClass, (v) => set("hazardClass", v as HazardClass),
            HAZ_OPTS.map((h) => ({ v: h, l: HAZARD_LABELS[h] })), "select-hazard")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chem-ppe">Værnemidler (kommasepareret)</Label>
        <Input id="chem-ppe" data-testid="input-ppe" value={f.ppeRequired}
          onChange={(e) => set("ppeRequired", e.target.value)}
          placeholder="F.eks. handsker, beskyttelsesbriller, maske" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chem-instructions">Brugsanvisning</Label>
        <Textarea id="chem-instructions" data-testid="input-instructions" value={f.instructions}
          onChange={(e) => set("instructions", e.target.value)} rows={3} placeholder="Dosering og anvendelse" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chem-supplier">Leverandør</Label>
        <Input id="chem-supplier" data-testid="input-supplier" value={f.supplier}
          onChange={(e) => set("supplier", e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {dateField("purchaseDate", "Købsdato", "chem-purchase", "input-purchase-date")}
        {dateField("reviewDate", "Review-dato", "chem-review", "input-review-date")}
        {dateField("expiryDate", "Udløbsdato", "chem-expiry", "input-expiry-date")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {numField("stockQuantity", "Lagerbeholdning", "chem-stock", "input-stock")}
        <div className="space-y-1.5">
          <Label>Enhed</Label>
          {sel(f.unit, (v) => set("unit", v as Unit),
            UNIT_OPTS.map((u) => ({ v: u, l: UNIT_LABELS[u] })), "select-unit")}
        </div>
        {numField("minStock", "Minimum", "chem-min", "input-min-stock")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chem-notes">Noter</Label>
        <Textarea id="chem-notes" data-testid="input-notes" value={f.notes}
          onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button data-testid="button-save-chem" disabled={pending || !f.name.trim()}
          onClick={() => onSubmit(formToBody(f))}>
          Gem kemikalie
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------- view dialog ---------- */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function ViewDialog({ chem, open, onClose }: { chem: Chemical | null; open: boolean; onClose: () => void }) {
  if (!chem) return null;
  const ppe = chem.ppeRequired?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            {chem.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={STATUS_BADGE[chem.status]}>{STATUS_LABELS[chem.status]}</Badge>
            <Badge variant="outline" className={HAZARD_BADGE[chem.hazardClass]}>
              <AlertTriangle className="w-3 h-3 mr-1" />{HAZARD_LABELS[chem.hazardClass]}
            </Badge>
            <Badge variant="secondary">{CATEGORY_LABELS[chem.category]}</Badge>
            {reviewSoon(chem) && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Review snart</Badge>
            )}
            {expired(chem) && (
              <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">Udløbet</Badge>
            )}
            {lowStock(chem) && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Lav lager</Badge>
            )}
          </div>
          <div>
            <DetailRow label="Leverandør" value={chem.supplier} />
            <DetailRow label="Købsdato" value={fmtDate(chem.purchaseDate)} />
            <DetailRow label="Review-dato" value={fmtDate(chem.reviewDate)} />
            <DetailRow label="Udløbsdato" value={fmtDate(chem.expiryDate)} />
            <DetailRow label="Lagerbeholdning" value={`${num(chem.stockQuantity)} ${chem.unit ? UNIT_LABELS[chem.unit] : ""}`} />
            <DetailRow label="Minimum" value={`${num(chem.minStock)} ${chem.unit ? UNIT_LABELS[chem.unit] : ""}`} />
            <DetailRow label="Sikkerhedsdatablad" value={chem.safetyDataSheet ? (
              <span className="inline-flex items-center gap-1 text-blue-600"><FileText className="w-3.5 h-3.5" />{chem.safetyDataSheet}</span>
            ) : "—"} />
          </div>
          {ppe.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1.5">Påkrævede værnemidler</p>
              <div className="flex flex-wrap gap-1.5">
                {ppe.map((p, i) => <Badge key={i} variant="secondary">{p}</Badge>)}
              </div>
            </div>
          )}
          {chem.instructions && (
            <div>
              <p className="text-sm font-medium mb-1">Brugsanvisning</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/50 p-2.5">{chem.instructions}</p>
            </div>
          )}
          {chem.notes && (
            <div>
              <p className="text-sm font-medium mb-1">Noter</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{chem.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button data-testid="button-close-view" variant="outline" onClick={onClose}>Luk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- main component ---------- */

export default function Kemikalieregister({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Chemical | null>(null);
  const [viewing, setViewing] = useState<Chemical | null>(null);

  const { data, isLoading } = useQuery<Chemical[]>({
    queryKey: ["/api/chemicals", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/chemicals?companyId=${companyId}`)).json(),
  });

  useQuery({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/chemicals"] });

  const createMut = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/chemicals?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); setCreateOpen(false); toast({ title: "Kemikalie oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette kemikalie", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/chemicals/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); setEditing(null); toast({ title: "Kemikalie opdateret" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere kemikalie", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/chemicals/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidate(); toast({ title: "Kemikalie slettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke slette kemikalie", description: e.message, variant: "destructive" }),
  });

  const chemicals = data ?? [];

  const stats = useMemo(() => ({
    total: chemicals.length,
    active: chemicals.filter((c) => c.status === "aktiv").length,
    expiring: chemicals.filter((c) => reviewSoon(c) && !expired(c)).length,
    low: chemicals.filter((c) => lowStock(c)).length,
  }), [chemicals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chemicals.filter((c) => {
      if (filterCategory !== "all" && c.category !== filterCategory) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.supplier ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [chemicals, search, filterCategory, filterStatus]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            Kemikalieregister
          </h1>
          <p className="text-sm text-muted-foreground">Kemikalier og sikkerhedsdatablade</p>
        </div>
        <Button data-testid="button-add-chem" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />Tilføj kemikalie
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: "total", label: "Total", val: stats.total, icon: <FlaskConical className="w-4 h-4 text-blue-600" />, color: "" },
          { key: "active", label: "Aktive", val: stats.active, icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: "text-emerald-600 dark:text-emerald-500" },
          { key: "expiring", label: "Udløber snart", val: stats.expiring, icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, color: "text-amber-600 dark:text-amber-500" },
          { key: "low-stock", label: "Lav lager", val: stats.low, icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, color: "text-amber-600 dark:text-amber-500" },
        ] as const).map((s) => (
          <Card key={s.key} data-testid={`card-${s.key}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                {s.icon}
              </div>
              <div className={`text-xl font-semibold ${s.color}`}>{s.val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input data-testid="input-search" placeholder="Søg på navn eller leverandør"
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as Category | "all")}>
          <SelectTrigger data-testid="filter-category" className="w-[160px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {CAT_OPTS.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "all")}>
          <SelectTrigger data-testid="filter-status" className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statusser</SelectItem>
            {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-chemicals">
          <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Ingen kemikalier fundet.
        </div>
      ) : (
        <Card data-testid="card-chemicals-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Fareklasse</TableHead>
                    <TableHead className="text-right">Lagerbeholdning</TableHead>
                    <TableHead>Enhed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review-dato</TableHead>
                    <TableHead className="text-center">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const isExpired = expired(c), isSoon = reviewSoon(c), isLow = lowStock(c);
                    return (
                      <TableRow key={c.id} data-testid={`row-chem-${c.id}`} className={isLow ? "bg-amber-500/5" : ""}>
                        <TableCell className="font-medium max-w-[220px]">
                          <button className="text-left hover:text-blue-600 truncate"
                            data-testid={`button-view-chem-${c.id}`} onClick={() => setViewing(c)}>
                            {c.name}
                          </button>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {isSoon && !isExpired && (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 px-1.5">Review snart</Badge>
                            )}
                            {isExpired && (
                              <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-[10px] py-0 px-1.5">Udløbet</Badge>
                            )}
                            {isLow && (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 px-1.5">Lav lager</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{CATEGORY_LABELS[c.category]}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={HAZARD_BADGE[c.hazardClass]}>
                            <AlertTriangle className="w-3 h-3 mr-1" />{HAZARD_LABELS[c.hazardClass]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{num(c.stockQuantity)}</TableCell>
                        <TableCell className="text-muted-foreground">{c.unit ? UNIT_LABELS[c.unit] : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={STATUS_BADGE[c.status]}>{STATUS_LABELS[c.status]}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(c.reviewDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1.5 rounded-md hover:bg-muted text-blue-600"
                              data-testid={`button-edit-chem-${c.id}`} onClick={() => setEditing(c)} aria-label="Rediger">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded-md hover:bg-muted text-destructive"
                              data-testid={`button-delete-chem-${c.id}`} onClick={() => deleteMut.mutate(c.id)} aria-label="Slet">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tilføj kemikalie</DialogTitle></DialogHeader>
          <ChemicalForm initial={emptyForm()} pending={createMut.isPending} onSubmit={(b) => createMut.mutate(b)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Rediger kemikalie</DialogTitle></DialogHeader>
          {editing && (
            <ChemicalForm initial={formFrom(editing)} pending={updateMut.isPending}
              onSubmit={(b) => updateMut.mutate({ id: editing.id, body: b })} />
          )}
        </DialogContent>
      </Dialog>
      <ViewDialog chem={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

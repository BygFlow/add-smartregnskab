import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCustomers, useEmployees, useTasks } from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Boxes, Lock, Package, PackageMinus, Plus, Trash2 } from "lucide-react";
import type { Material, MaterialUsage } from "@shared/schema";
import { PageHeader, MetricCard, SectionCard } from "@/components/premium";

const UNITS = ["stk", "liter", "kg", "rulle", "pakke", "dåse"];

function money(value?: number | null) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(value ?? 0);
}
function date(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

type MaterialsResponse = { materials: Material[]; lowStock: number[]; lowStockCount: number };

export default function Materialer() {
  const { companyId, user, hasFeature, plan } = useAuth();
  const { toast } = useToast();
  const allowed = hasFeature("materialer");
  const canManage = ["leder", "holdleder", "platform_admin"].includes(user?.role ?? "");
  const canDelete = ["leder", "platform_admin"].includes(user?.role ?? "");
  const { data: customers } = useCustomers(companyId);
  const { data: tasks } = useTasks(companyId);
  const { data: employees } = useEmployees(companyId);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);

  const { data, isLoading } = useQuery<MaterialsResponse>({
    queryKey: ["/api/materials", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/materials?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: usage, isLoading: usageLoading } = useQuery<MaterialUsage[]>({
    queryKey: ["/api/material-usage", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/material-usage?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    queryClient.invalidateQueries({ queryKey: ["/api/material-usage"] });
  };
  const saveMaterial = useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: unknown }) =>
      (await apiRequest(id ? "PATCH" : "POST", `/api/materials${id ? `/${id}` : ""}?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); setMaterialOpen(false); setEditing(null); toast({ title: "Vare gemt" }); },
    onError: (e: any) => toast({ title: "Kunne ikke gemme vare", description: e.message, variant: "destructive" }),
  });
  const deleteMaterial = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/materials/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidate(); toast({ title: "Vare slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette vare", description: e.message, variant: "destructive" }),
  });
  const registerUsage = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/material-usage?companyId=${companyId}`, body)).json(),
    onSuccess: (result: { stock: number; warning?: string | null; usage: MaterialUsage }) => {
      invalidate(); setUsageOpen(false);
      toast({ title: "Forbrug registreret", description: `Opdateret beholdning: ${result.stock}.` });
      if (result.warning) toast({ title: "Advarsel om lager", description: result.warning, variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke registrere forbrug", description: e.message, variant: "destructive" }),
  });
  const deleteUsage = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/material-usage/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidate(); toast({ title: "Postering slettet", description: "Lageret er rettet tilbage." }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette postering", description: e.message, variant: "destructive" }),
  });

  const materials = data?.materials ?? [];
  const totalValue = useMemo(() => materials.reduce((sum, material) => sum + material.stock * material.costPrice, 0), [materials]);
  const lowStock = new Set(data?.lowStock ?? []);
  const nameFor = (id: number | null, list: { id: number; name?: string; title?: string }[] | undefined, fallback: string) =>
    id ? (list?.find((x) => x.id === id)?.name ?? list?.find((x) => x.id === id)?.title ?? fallback) : "—";

  if (!allowed) return <Locked planName={plan?.name} />;
  if (isLoading) return <Loading />;
  return <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
    <PageHeader
      eyebrow="Lager"
      title="Materialer"
      description="Materialer og forbrug"
      action={
        <div className="flex gap-2">
          <Dialog open={usageOpen} onOpenChange={setUsageOpen}><DialogTrigger asChild><Button variant="outline" data-testid="button-register-usage"><PackageMinus className="w-4 h-4 mr-1.5" />Registrér forbrug</Button></DialogTrigger><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Registrér forbrug eller indkøb</DialogTitle></DialogHeader><UsageForm materials={materials} customers={customers ?? []} tasks={tasks ?? []} pending={registerUsage.isPending} onSubmit={(body) => registerUsage.mutate(body)} /></DialogContent></Dialog>
          {canManage && <Dialog open={materialOpen} onOpenChange={(open) => { setMaterialOpen(open); if (!open) setEditing(null); }}><DialogTrigger asChild><Button data-testid="button-new-material"><Plus className="w-4 h-4 mr-1.5" />Opret vare</Button></DialogTrigger><DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Redigér vare" : "Opret vare"}</DialogTitle></DialogHeader><MaterialForm key={editing?.id ?? "new"} material={editing} pending={saveMaterial.isPending} onSubmit={(body) => saveMaterial.mutate({ id: editing?.id, body })} /></DialogContent></Dialog>}
        </div>
      }
    />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <MetricCard data-testid="card-material-count" icon={<Boxes className="w-5 h-5" />} value={String(materials.length)} label="Antal varer" variant="primary" />
      <MetricCard data-testid="card-low-stock-count" icon={<AlertTriangle className="w-5 h-5" />} value={String(data?.lowStockCount ?? 0)} label="Varer under minimum" variant="amber" />
      <MetricCard data-testid="card-stock-value" icon={<Boxes className="w-5 h-5" />} value={money(totalValue)} label="Samlet lagerværdi" variant="blue" />
    </div>
    {materials.length === 0 ? <Empty testId="empty-materials" text="Der er ingen varer på lager endnu." /> : <SectionCard data-testid="card-materials" title="Varer" icon={<Package className="w-4 h-4" />} noPadding><div className="overflow-x-auto"><table className="table-premium w-full min-w-[900px] text-sm"><thead><tr><th>Navn</th><th>Leverandør</th><th>Enhed</th><th className="text-right">Beholdning</th><th className="text-right">Minimum</th><th className="text-right">Kostpris</th><th className="text-right">Salgspris</th><th /></tr></thead><tbody>{materials.map((material: Material) => {
      const isLow = lowStock.has(material.id);
      return <tr key={material.id} className={`divide-y divide-border/50 last:border-0 ${isLow ? "bg-amber-500/10" : ""}`} data-testid={`row-material-${material.id}`}><td className="p-3"><div className="font-medium max-w-48 truncate">{material.name}</div>{material.sku && <div className="text-[11px] text-muted-foreground">Varenr. {material.sku}</div>}{material.hazardous === 1 && <span className="text-[10px] text-amber-700 dark:text-amber-400">Farligt stof</span>}</td><td className="p-3">{material.supplier ?? "—"}</td><td className="p-3">{material.unit}</td><td className="p-3 text-right tabular-nums font-medium">{material.stock} {material.unit}{isLow && <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">Under minimum</div>}</td><td className="p-3 text-right tabular-nums">{material.minStock}</td><td className="p-3 text-right tabular-nums">{money(material.costPrice)}</td><td className="p-3 text-right tabular-nums">{money(material.salesPrice)}</td><td className="p-3"><div className="flex gap-1 justify-end">{canManage && <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-edit-material-${material.id}`} onClick={() => { setEditing(material); setMaterialOpen(true); }}><Boxes className="w-4 h-4" /></button>}{canDelete && <button className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-delete-material-${material.id}`} onClick={() => deleteMaterial.mutate(material.id)}><Trash2 className="w-4 h-4" /></button>}</div></td></tr>;
    })}</tbody></table></div></SectionCard>}
    <section className="space-y-2">{usageLoading ? <Skeleton className="h-44 rounded-md" /> : (usage ?? []).length === 0 ? <Empty testId="empty-material-usage" text="Der er ingen registreret forbrugshistorik endnu." /> : <SectionCard data-testid="card-material-usage" title="Forbrugshistorik" icon={<Package className="w-4 h-4" />} noPadding><div className="overflow-x-auto"><table className="table-premium w-full min-w-[800px] text-sm"><thead><tr><th>Dato</th><th>Vare</th><th className="text-right">Antal</th><th>Type</th><th>Kunde</th><th>Ansat</th><th>Faktureres</th><th /></tr></thead><tbody>{usage?.map((row) => <tr key={row.id} className="divide-y divide-border/50 last:border-0" data-testid={`row-material-usage-${row.id}`}><td className="p-3 whitespace-nowrap">{date(row.date)}</td><td className="p-3 max-w-44 truncate">{nameFor(row.materialId, materials, `Vare #${row.materialId}`)}</td><td className="p-3 text-right tabular-nums">{row.quantity}</td><td className="p-3">{row.kind === "indkoeb" ? "Indkøb" : "Forbrug"}</td><td className="p-3 max-w-36 truncate">{nameFor(row.customerId, customers, `Kunde #${row.customerId}`)}</td><td className="p-3 max-w-36 truncate">{nameFor(row.employeeId, employees, `Ansat #${row.employeeId}`)}</td><td className="p-3">{row.billable ? "Ja" : "Nej"}</td><td className="p-3">{canManage && <button className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-delete-material-usage-${row.id}`} onClick={() => deleteUsage.mutate(row.id)}><Trash2 className="w-4 h-4" /></button>}</td></tr>)}</tbody></table></div></SectionCard>}</section>
  </div>;
}

function MaterialForm({ material, pending, onSubmit }: { material: Material | null; pending: boolean; onSubmit: (body: unknown) => void }) {
  const [name, setName] = useState(material?.name ?? "");
  const [sku, setSku] = useState(material?.sku ?? "");
  const [unit, setUnit] = useState(material?.unit ?? "stk");
  const [costPrice, setCostPrice] = useState(String(material?.costPrice ?? 0));
  const [salesPrice, setSalesPrice] = useState(String(material?.salesPrice ?? 0));
  const [stock, setStock] = useState(String(material?.stock ?? 0));
  const [minStock, setMinStock] = useState(String(material?.minStock ?? 0));
  const [supplier, setSupplier] = useState(material?.supplier ?? "");
  const [hazardous, setHazardous] = useState(material?.hazardous === 1);
  const [safetySheetUrl, setSafetySheetUrl] = useState(material?.safetySheetUrl ?? "");
  const [active, setActive] = useState(material?.active !== 0);
  const [error, setError] = useState("");
  const number = (value: string) => Number(value.replace(",", ".")) || 0;
  const submit = (e: { preventDefault(): void }) => { e.preventDefault(); if (!name.trim()) return setError("Angiv et varenavn."); setError(""); onSubmit({ name: name.trim(), sku: sku.trim() || null, unit, costPrice: number(costPrice), salesPrice: number(salesPrice), stock: number(stock), minStock: number(minStock), supplier: supplier.trim() || null, hazardous: hazardous ? 1 : 0, safetySheetUrl: safetySheetUrl.trim() || null, active: active ? 1 : 0 }); };
  return <form className="space-y-3" onSubmit={submit}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Navn"><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-material-name" required /></Field><Field label="Varenummer"><Input value={sku} onChange={(e) => setSku(e.target.value)} data-testid="input-material-sku" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Enhed"><Select value={unit} onValueChange={setUnit}><SelectTrigger data-testid="select-material-unit"><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Beholdning"><Input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} data-testid="input-material-stock" /></Field><Field label="Minimumsbeholdning"><Input inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} data-testid="input-material-min-stock" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Kostpris"><Input inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} data-testid="input-material-cost-price" /></Field><Field label="Salgspris"><Input inputMode="decimal" value={salesPrice} onChange={(e) => setSalesPrice(e.target.value)} data-testid="input-material-sales-price" /></Field></div><Field label="Leverandør"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} data-testid="input-material-supplier" /></Field><Field label="Link til sikkerhedsdatablad"><Input type="url" value={safetySheetUrl} onChange={(e) => setSafetySheetUrl(e.target.value)} data-testid="input-material-safety-sheet" /></Field><label className="flex items-center gap-2 text-sm"><Checkbox checked={hazardous} onCheckedChange={(checked) => setHazardous(checked === true)} data-testid="checkbox-material-hazardous" />Kræver sikkerhedsdatablad</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(checked) => setActive(checked === true)} data-testid="checkbox-material-active" />Varen er aktiv</label>{error && <p className="text-xs text-destructive" data-testid="text-material-error">{error}</p>}<Button type="submit" className="w-full" disabled={pending} data-testid="button-save-material">{pending ? "Gemmer..." : "Gem vare"}</Button></form>;
}

function UsageForm({ materials, customers, tasks, pending, onSubmit }: { materials: Material[]; customers: { id: number; name: string }[]; tasks: { id: number; title: string }[]; pending: boolean; onSubmit: (body: unknown) => void }) {
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [kind, setKind] = useState("forbrug");
  const [customerId, setCustomerId] = useState("none");
  const [taskId, setTaskId] = useState("none");
  const [usageDate, setUsageDate] = useState(today());
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState("");
  const submit = (e: { preventDefault(): void }) => { e.preventDefault(); if (!materialId || !(Number(quantity.replace(",", ".")) > 0)) return setError("Vælg en vare og angiv et positivt antal."); setError(""); onSubmit({ materialId: Number(materialId), quantity: Number(quantity.replace(",", ".")), kind, customerId: customerId === "none" ? null : Number(customerId), taskId: taskId === "none" ? null : Number(taskId), date: usageDate, note: note.trim() || null, billable }); };
  return <form className="space-y-3" onSubmit={submit}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Vare"><Select value={materialId} onValueChange={setMaterialId}><SelectTrigger data-testid="select-usage-material"><SelectValue placeholder="Vælg vare" /></SelectTrigger><SelectContent>{materials.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Antal"><Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="input-usage-quantity" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Type"><Select value={kind} onValueChange={setKind}><SelectTrigger data-testid="select-usage-kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="forbrug">Forbrug</SelectItem><SelectItem value="indkoeb">Indkøb</SelectItem></SelectContent></Select></Field><Field label="Dato"><Input type="date" value={usageDate} onChange={(e) => setUsageDate(e.target.value)} data-testid="input-usage-date" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Kunde (valgfri)"><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger data-testid="select-usage-customer"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ingen kunde</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Opgave (valgfri)"><Select value={taskId} onValueChange={setTaskId}><SelectTrigger data-testid="select-usage-task"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ingen opgave</SelectItem>{tasks.map((task) => <SelectItem key={task.id} value={String(task.id)}>{task.title}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} data-testid="input-usage-note" /></Field><label className="flex items-center gap-2 text-sm"><Checkbox checked={billable} onCheckedChange={(checked) => setBillable(checked === true)} data-testid="checkbox-usage-billable" />Skal viderefaktureres til kunden</label>{error && <p className="text-xs text-destructive" data-testid="text-usage-error">{error}</p>}<Button type="submit" className="w-full" disabled={pending} data-testid="button-save-usage">{pending ? "Registrerer..." : "Registrér"}</Button></form>;
}

function Field({ label, children }: { label: string; children: any }) { return <div className="space-y-1.5 min-w-0"><Label>{label}</Label>{children}</div>; }
function Empty({ testId, text }: { testId: string; text: string }) { return <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid={testId}><Boxes className="w-8 h-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">{text}</p></div>; }
function Loading() { return <div className="p-4 space-y-3"><Skeleton className="h-8 w-56" /><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}</div><Skeleton className="h-80 rounded-md" /></div>; }
function Locked({ planName }: { planName?: string }) { return <div className="p-3 md:p-4 max-w-2xl mx-auto"><div className="rounded-md border border-border/50 bg-card p-4 text-center space-y-2" data-testid="notice-feature-locked"><Lock className="w-8 h-8 mx-auto text-muted-foreground" /><h1 className="text-lg font-bold text-foreground">Materialer og lager er ikke med i din pakke</h1><p className="text-sm text-muted-foreground">Pakken {planName ?? "din nuværende"} indeholder ikke lagerstyring. Opgradér på abonnementssiden for at få adgang.</p></div></div>; }

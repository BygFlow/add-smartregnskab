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
import { Plus, Trash2, Pencil, Eye, Car, Fuel, ClipboardList, ShieldAlert, Search, CalendarClock, Wrench } from "lucide-react";

type FuelType = "benzin" | "diesel" | "el" | "hybrid";
type VehicleStatus = "aktiv" | "service" | "ude_af_brug" | "solgt";

interface Vehicle {
  id: number; companyId: number; plateNumber: string; brand: string; model: string;
  year?: number | string | null; color?: string | null; fuelType: FuelType;
  mileage?: number | string | null; insuranceExpiry?: string | null;
  inspectionExpiry?: string | null; serviceDue?: string | null;
  assignedTo?: number | string | null; status: VehicleStatus; notes?: string | null;
  createdAt?: string | null;
}
interface Employee { id: number; name: string; role?: string | null; }
interface VehicleLog {
  id: number; vehicleId: number; type?: string | null; cost?: number | string | null;
  distance?: number | string | null; note?: string | null; date?: string | null;
}

const FUEL_LABELS: Record<FuelType, string> = { benzin: "Benzin", diesel: "Diesel", el: "El", hybrid: "Hybrid" };
const STATUS_LABELS: Record<VehicleStatus, string> = { aktiv: "Aktiv", service: "Service", ude_af_brug: "Ude af brug", solgt: "Solgt" };
const STATUS_VARIANTS: Record<VehicleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  aktiv: "default", service: "secondary", ude_af_brug: "outline", solgt: "destructive",
};
const MS_30 = 30 * 24 * 60 * 60 * 1000;

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}
function fmtCurrency(v: number | string | null | undefined): string {
  const n = num(v);
  return n ? new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n) : "—";
}
function fmtKm(v: number | string | null | undefined): string {
  const n = num(v);
  return n ? new Intl.NumberFormat("da-DK").format(n) + " km" : "—";
}
function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : "—";
}
function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function within30(value?: string | null): boolean {
  if (!value) return false;
  const t = new Date(value.slice(0, 10)).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + MS_30;
}
function isPast(value?: string | null): boolean {
  return !!value && value.slice(0, 10) < todayISO();
}

interface FormState {
  plateNumber: string; brand: string; model: string; year: string; color: string;
  fuelType: FuelType; mileage: string; insuranceExpiry: string; inspectionExpiry: string;
  serviceDue: string; assignedTo: string; status: VehicleStatus; notes: string;
}
const emptyForm = (): FormState => ({
  plateNumber: "", brand: "", model: "", year: "", color: "", fuelType: "benzin",
  mileage: "", insuranceExpiry: "", inspectionExpiry: "", serviceDue: "",
  assignedTo: "none", status: "aktiv", notes: "",
});
const toForm = (v: Vehicle): FormState => ({
  plateNumber: v.plateNumber ?? "", brand: v.brand ?? "", model: v.model ?? "",
  year: v.year != null ? String(v.year) : "", color: v.color ?? "", fuelType: v.fuelType ?? "benzin",
  mileage: v.mileage != null ? String(v.mileage) : "",
  insuranceExpiry: v.insuranceExpiry?.slice(0, 10) ?? "",
  inspectionExpiry: v.inspectionExpiry?.slice(0, 10) ?? "",
  serviceDue: v.serviceDue?.slice(0, 10) ?? "",
  assignedTo: v.assignedTo != null ? String(v.assignedTo) : "none",
  status: v.status ?? "aktiv", notes: v.notes ?? "",
});

/** Compact labeled field wrapper */
function Field({ label, testId, children }: { label: string; testId?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {testId ? <div data-testid={testId}>{children}</div> : children}
    </div>
  );
}

function VehicleForm({ form, setForm, employees, pending, onSubmit }: {
  form: FormState; setForm: (f: FormState) => void; employees: Employee[];
  pending: boolean; onSubmit: () => void;
}) {
  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setForm({ ...form, [k]: val });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nummerplade *">
          <Input data-testid="input-plate-number" value={form.plateNumber}
            onChange={(e) => set("plateNumber", e.target.value.toUpperCase())} placeholder="AB 12 345" />
        </Field>
        <Field label="Årgang">
          <Input data-testid="input-year" type="number" value={form.year}
            onChange={(e) => set("year", e.target.value)} placeholder="2021" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mærke *">
          <Input data-testid="input-brand" value={form.brand}
            onChange={(e) => set("brand", e.target.value)} placeholder="Volkswagen" />
        </Field>
        <Field label="Model *">
          <Input data-testid="input-model" value={form.model}
            onChange={(e) => set("model", e.target.value)} placeholder="Caddy" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Farve">
          <Input data-testid="input-color" value={form.color}
            onChange={(e) => set("color", e.target.value)} placeholder="Hvid" />
        </Field>
        <Field label="Kilometerstand">
          <Input data-testid="input-mileage" type="number" value={form.mileage}
            onChange={(e) => set("mileage", e.target.value)} placeholder="0" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brændstof">
          <Select value={form.fuelType} onValueChange={(v) => set("fuelType", v as FuelType)}>
            <SelectTrigger data-testid="select-fuel-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(FUEL_LABELS) as FuelType[]).map((f) => <SelectItem key={f} value={f}>{FUEL_LABELS[f]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v as VehicleStatus)}>
            <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as VehicleStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Forsikring udløber">
          <Input data-testid="input-insurance-expiry" type="date" value={form.insuranceExpiry}
            onChange={(e) => set("insuranceExpiry", e.target.value)} />
        </Field>
        <Field label="Syn udløber">
          <Input data-testid="input-inspection-expiry" type="date" value={form.inspectionExpiry}
            onChange={(e) => set("inspectionExpiry", e.target.value)} />
        </Field>
        <Field label="Service">
          <Input data-testid="input-service-due" type="date" value={form.serviceDue}
            onChange={(e) => set("serviceDue", e.target.value)} />
        </Field>
      </div>
      <Field label="Tildelt til">
        <Select value={form.assignedTo} onValueChange={(v) => set("assignedTo", v)}>
          <SelectTrigger data-testid="select-assigned-to"><SelectValue placeholder="Vælg medarbejder" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}{emp.role ? ` (${emp.role})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Noter">
        <Textarea data-testid="input-notes" value={form.notes}
          onChange={(e) => set("notes", e.target.value)} rows={2}
          placeholder="F.eks. vinterdæk, servicehistorik" />
      </Field>
      <DialogFooter>
        <Button data-testid="button-save-vehicle"
          disabled={pending || !form.plateNumber.trim() || !form.brand.trim() || !form.model.trim()}
          onClick={onSubmit}>Gem køretøj</Button>
      </DialogFooter>
    </div>
  );
}

function WarningBadges({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="flex flex-wrap gap-1">
      {within30(vehicle.inspectionExpiry) && (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <CalendarClock className="w-3 h-3 mr-1" />Syn udløber
        </Badge>
      )}
      {within30(vehicle.insuranceExpiry) && (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <ShieldAlert className="w-3 h-3 mr-1" />Forsikring udløber
        </Badge>
      )}
      {isPast(vehicle.serviceDue) && (
        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
          <Wrench className="w-3 h-3 mr-1" />Service påkrævet
        </Badge>
      )}
    </div>
  );
}

function NewLogForm({ vehicleId, onAdd, pending }: {
  vehicleId: number; onAdd: (body: Record<string, unknown>) => void; pending: boolean;
}) {
  const [type, setType] = useState("brændstof");
  const [cost, setCost] = useState("");
  const [distance, setDistance] = useState("");
  const [note, setNote] = useState("");
  const submit = () => {
    onAdd({ vehicleId, type, cost: cost ? num(cost) : null, distance: distance ? num(distance) : null,
      note: note.trim() || null, date: todayISO() });
    setCost(""); setDistance(""); setNote("");
  };
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="grid grid-cols-2 gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="select-log-type" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="brændstof">Brændstof</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="reparation">Reparation</SelectItem>
            <SelectItem value="undersogelse">Undersøgelse</SelectItem>
          </SelectContent>
        </Select>
        <Input data-testid="input-log-cost" type="number" value={cost}
          onChange={(e) => setCost(e.target.value)} placeholder="Pris (DKK)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input data-testid="input-log-distance" type="number" value={distance}
          onChange={(e) => setDistance(e.target.value)} placeholder="Afstand (km)" />
        <Input data-testid="input-log-note" value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="Notat" />
      </div>
      <Button data-testid="button-add-log" size="sm" variant="secondary" disabled={pending} onClick={submit}>
        <Plus className="w-3.5 h-3.5 mr-1" />Tilføj logpost
      </Button>
    </div>
  );
}

export default function Flaadestyring({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [fuelFilter, setFuelFilter] = useState("alle");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [viewVehicle, setViewVehicle] = useState<Vehicle | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });

  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/vehicles?companyId=${companyId}`)).json(),
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });
  const { data: vehicleLogs } = useQuery<VehicleLog[]>({
    queryKey: ["/api/vehicle-logs", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/vehicle-logs?companyId=${companyId}`)).json(),
  });

  const saveVehicle = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const method = editing ? "PATCH" : "POST";
      const url = editing ? `/api/vehicles/${editing.id}?companyId=${companyId}` : `/api/vehicles?companyId=${companyId}`;
      return (await apiRequest(method, url, body)).json();
    },
    onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null);
      toast({ title: editing ? "Køretøj opdateret" : "Køretøj oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke gemme køretøj", description: e.message, variant: "destructive" }),
  });
  const deleteVehicle = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/vehicles/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidate(); toast({ title: "Køretøj slettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke slette køretøj", description: e.message, variant: "destructive" }),
  });
  const addLog = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await apiRequest("POST", `/api/vehicle-logs?companyId=${companyId}`, body)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vehicle-logs"] }),
    onError: (e: Error) => toast({ title: "Kunne ikke tilføje log", description: e.message, variant: "destructive" }),
  });

  const items = vehicles ?? [];
  const empList = employees ?? [];
  const allLogs = vehicleLogs ?? [];
  const empName = (id: number | string | null | undefined): string => {
    if (id == null || id === "none" || id === "") return "—";
    return empList.find((e) => String(e.id) === String(id))?.name ?? String(id);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((v) => {
      if (statusFilter !== "alle" && v.status !== statusFilter) return false;
      if (fuelFilter !== "alle" && v.fuelType !== fuelFilter) return false;
      if (!q) return true;
      return v.plateNumber?.toLowerCase().includes(q) || v.brand?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q);
    });
  }, [items, search, statusFilter, fuelFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((v) => v.status === "aktiv").length,
    needsService: items.filter((v) => isPast(v.serviceDue) || within30(v.serviceDue)).length,
    insuranceExpiring: items.filter((v) => within30(v.insuranceExpiry)).length,
  }), [items]);

  const handleSubmit = () => {
    saveVehicle.mutate({
      plateNumber: form.plateNumber.trim(), brand: form.brand.trim(), model: form.model.trim(),
      year: form.year ? num(form.year) : null, color: form.color.trim() || null, fuelType: form.fuelType,
      mileage: form.mileage ? num(form.mileage) : 0, insuranceExpiry: form.insuranceExpiry || null,
      inspectionExpiry: form.inspectionExpiry || null, serviceDue: form.serviceDue || null,
      assignedTo: form.assignedTo && form.assignedTo !== "none" ? num(form.assignedTo) : null,
      status: form.status, notes: form.notes.trim() || null, companyId,
    });
  };

  const viewLogs = viewVehicle ? allLogs.filter((l) => l.vehicleId === viewVehicle.id) : [];

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

  const StatCard = ({ testId, label, value, icon, color }: {
    testId: string; label: string; value: number; icon: React.ReactNode; color: string;
  }) => (
    <Card data-testid={testId}>
      <CardContent className="flex items-center justify-between pt-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold ${color}`}>{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );

  const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span className="text-muted-foreground">{label}:</span>
      <p className="font-medium">{value}</p>
    </div>
  );

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-7xl mx-auto pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Flådestyring</h1>
          <p className="text-sm text-muted-foreground">Køretøjsadministration, service og forsikring</p>
        </div>
        <Button data-testid="button-add-vehicle" onClick={() => { setEditing(null); setForm(emptyForm()); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />Tilføj køretøj
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard testId="card-total-vehicles" label="Samlede køretøjer" value={summary.total}
          icon={<Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />} color="" />
        <StatCard testId="card-active-vehicles" label="Aktive" value={summary.active}
          icon={<Car className="w-5 h-5 text-green-600 dark:text-green-500" />} color="text-green-600 dark:text-green-500" />
        <StatCard testId="card-needs-service" label="Service påkrævet" value={summary.needsService}
          icon={<Wrench className="w-5 h-5 text-amber-600 dark:text-amber-500" />} color="text-amber-600 dark:text-amber-500" />
        <StatCard testId="card-insurance-expiring" label="Forsikring udløber" value={summary.insuranceExpiring}
          icon={<ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-500" />} color="text-red-600 dark:text-red-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg på nummerplade, mærke eller model" className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-filter-status" className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statusser</SelectItem>
            {(Object.keys(STATUS_LABELS) as VehicleStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fuelFilter} onValueChange={setFuelFilter}>
          <SelectTrigger data-testid="select-filter-fuel" className="w-[140px]"><SelectValue placeholder="Brændstof" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle brændstoffer</SelectItem>
            {(Object.keys(FUEL_LABELS) as FuelType[]).map((f) => <SelectItem key={f} value={f}>{FUEL_LABELS[f]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummerplade</TableHead>
                <TableHead>Mærke/Model</TableHead>
                <TableHead>Årgang</TableHead>
                <TableHead>Brændstof</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>Tildelt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Ingen køretøjer fundet</TableCell></TableRow>
              )}
              {filtered.map((v) => (
                <TableRow key={v.id} data-testid={`row-vehicle-${v.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1"><span>{v.plateNumber}</span><WarningBadges vehicle={v} /></div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{v.brand}</div>
                    <div className="text-sm text-muted-foreground">{v.model}</div>
                  </TableCell>
                  <TableCell>{v.year ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1"><Fuel className="w-3 h-3" />{FUEL_LABELS[v.fuelType]}</Badge>
                  </TableCell>
                  <TableCell>{fmtKm(v.mileage)}</TableCell>
                  <TableCell>{empName(v.assignedTo)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANTS[v.status]}>{STATUS_LABELS[v.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${v.id}`} onClick={() => setViewVehicle(v)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-edit-${v.id}`}
                        onClick={() => { setEditing(v); setForm(toForm(v)); setFormOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-${v.id}`}
                        onClick={() => { if (confirm(`Slet ${v.plateNumber}?`)) deleteVehicle.mutate(v.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Rediger køretøj" : "Tilføj køretøj"}</DialogTitle></DialogHeader>
          <VehicleForm form={form} setForm={setForm} employees={empList}
            pending={saveVehicle.isPending} onSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewVehicle} onOpenChange={(o) => !o && setViewVehicle(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewVehicle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />{viewVehicle.plateNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Mærke/Model" value={`${viewVehicle.brand} ${viewVehicle.model}`} />
                  <Detail label="Årgang" value={viewVehicle.year ?? "—"} />
                  <Detail label="Farve" value={viewVehicle.color ?? "—"} />
                  <Detail label="Brændstof" value={FUEL_LABELS[viewVehicle.fuelType]} />
                  <Detail label="Kilometerstand" value={fmtKm(viewVehicle.mileage)} />
                  <Detail label="Tildelt" value={empName(viewVehicle.assignedTo)} />
                  <Detail label="Forsikring udløber" value={fmtDate(viewVehicle.insuranceExpiry)} />
                  <Detail label="Syn udløber" value={fmtDate(viewVehicle.inspectionExpiry)} />
                  <Detail label="Service" value={fmtDate(viewVehicle.serviceDue)} />
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1"><Badge variant={STATUS_VARIANTS[viewVehicle.status]}>{STATUS_LABELS[viewVehicle.status]}</Badge></div>
                  </div>
                </div>
                <WarningBadges vehicle={viewVehicle} />
                {viewVehicle.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Noter:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{viewVehicle.notes}</p>
                  </div>
                )}
                {/* Vehicle logs */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <ClipboardList className="w-4 h-4" />Køretøjslog
                  </div>
                  {viewLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen logposter endnu.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {viewLogs.map((log) => (
                        <div key={log.id} data-testid={`log-${log.id}`}
                          className="flex items-center justify-between rounded-md border p-2 text-sm">
                          <div>
                            <p className="font-medium">{log.type ?? "Log"}</p>
                            {log.note && <p className="text-xs text-muted-foreground">{log.note}</p>}
                            {log.distance != null && <p className="text-xs text-muted-foreground">{fmtKm(log.distance)}</p>}
                          </div>
                          <div className="text-right">
                            {log.cost != null && <p className="font-medium">{fmtCurrency(log.cost)}</p>}
                            {log.date && <p className="text-xs text-muted-foreground">{fmtDate(log.date)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <NewLogForm vehicleId={viewVehicle.id} onAdd={(body) => addLog.mutate(body)} pending={addLog.isPending} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

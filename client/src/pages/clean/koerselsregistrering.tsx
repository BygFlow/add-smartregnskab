import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, MapPin, Plus, Route, Trash2, Wallet, XCircle,
} from "lucide-react";

type MileageStatus = "afventer" | "godkendt" | "afvist" | "betalt";
type MileagePurpose = "kunde_besoeg" | "materiale_indkoeb" | "andet";

interface MileageReport {
  id: number; companyId: number; employeeId: number | null; customerId: number | null;
  taskId: number | null; date: string | null; startAddress: string | null;
  endAddress: string | null; kilometers: number | string | null;
  purpose: MileagePurpose | null; rate: number | string | null;
  compensation: number | string | null; status: MileageStatus;
  approvedBy: number | null; approvedAt: string | null;
  rejectionReason: string | null; createdAt: string | null;
}
interface Employee { id: number; name: string; }
interface Customer { id: number; name: string; address?: string | null; }

const DEFAULT_RATE = 3.7;
const STATUS_LABELS: Record<MileageStatus, string> = {
  afventer: "Afventer", godkendt: "Godkendt", afvist: "Afvist", betalt: "Betalt",
};
const STATUS_CLASSES: Record<MileageStatus, string> = {
  afventer: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  godkendt: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  afvist: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  betalt: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};
const PURPOSE_LABELS: Record<MileagePurpose, string> = {
  kunde_besoeg: "Kunde-besøg", materiale_indkoeb: "Materiale-indkøb", andet: "Andet",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}
function money(value?: number | null): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(value ?? 0);
}
function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : value.slice(0, 10);
}
function isThisMonth(value?: string | null): boolean {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function MileageForm({ companyId, pending, onSubmit }: {
  companyId: number; pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const [employeeId, setEmployeeId] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [kilometers, setKilometers] = useState("");
  const [purpose, setPurpose] = useState<MileagePurpose>("kunde_besoeg");
  const [rate, setRate] = useState(String(DEFAULT_RATE));

  const km = num(kilometers);
  const rt = num(rate) || DEFAULT_RATE;
  const compensation = Math.round(km * rt * 100) / 100;
  const canSave = !!employeeId && startAddress.trim() !== "" && endAddress.trim() !== "" && km > 0;

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      companyId, employeeId: Number(employeeId),
      customerId: customerId === "none" ? null : Number(customerId),
      date, startAddress: startAddress.trim(), endAddress: endAddress.trim(),
      kilometers: km, purpose, rate: rt, compensation, status: "afventer",
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Medarbejder *</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Vælg medarbejder" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Kunde (valgfri)</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger data-testid="select-customer"><SelectValue placeholder="Ingen kunde" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen kunde</SelectItem>
              {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mileage-date">Dato *</Label>
        <Input id="mileage-date" data-testid="input-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mileage-start">Fra-adresse *</Label>
          <Input id="mileage-start" data-testid="input-start-address" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} placeholder="F.eks. Hovedgaden 1, København" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mileage-end">Til-adresse *</Label>
          <Input id="mileage-end" data-testid="input-end-address" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} placeholder="F.eks. Kundevej 5, Århus" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mileage-km">Kilometer *</Label>
          <Input id="mileage-km" data-testid="input-kilometers" type="number" min="0" step="0.1" value={kilometers} onChange={(e) => setKilometers(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mileage-rate">Sats (kr/km)</Label>
          <Input id="mileage-rate" data-testid="input-rate" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Formål</Label>
          <Select value={purpose} onValueChange={(v) => setPurpose(v as MileagePurpose)}>
            <SelectTrigger data-testid="select-purpose"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PURPOSE_LABELS) as MileagePurpose[]).map((p) => (
                <SelectItem key={p} value={p}>{PURPOSE_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm" data-testid="text-compensation-preview">
        <span className="text-muted-foreground">Beregnet godtgørelse: </span>
        <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{money(compensation)}</span>
        <span className="text-muted-foreground"> ({km} km × {rt} kr/km)</span>
      </div>
      <DialogFooter>
        <Button data-testid="button-save-mileage" disabled={pending || !canSave} onClick={submit}>
          <Plus className="w-4 h-4 mr-1.5" />Registrér kørsel
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Koerselsregistrering({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const canApprove = user?.role === "leder" || user?.role === "holdleder" || user?.role === "platform_admin";

  const { data: reports = [], isLoading } = useQuery<MileageReport[]>({
    queryKey: ["/api/mileage-reports", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/mileage-reports?companyId=${companyId}`)).json(),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });
  const employeeName = (id: number | null) => employees.find((e) => e.id === id)?.name ?? "—";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/mileage-reports"] });

  const createReport = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiRequest("POST", "/api/mileage-reports", body)).json(),
    onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Kørsel registreret" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke registrere kørsel", description: e.message, variant: "destructive" }),
  });
  const patchReport = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      (await apiRequest("PATCH", `/api/mileage-reports/${id}`, body)).json(),
    onSuccess: () => { invalidate(); setRejectId(null); setRejectionReason(""); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere kørsel", description: e.message, variant: "destructive" }),
  });
  const deleteReport = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/mileage-reports/${id}`); },
    onSuccess: () => { invalidate(); toast({ title: "Kørsel slettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke slette kørsel", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports
      .filter((r) => statusFilter === "all" ? true : r.status === statusFilter)
      .filter((r) => !q ||
        employeeName(r.employeeId).toLowerCase().includes(q) ||
        (r.startAddress ?? "").toLowerCase().includes(q) ||
        (r.endAddress ?? "").toLowerCase().includes(q));
  }, [reports, employees, search, statusFilter]);

  const stats = useMemo(() => ({
    pending: reports.filter((r) => r.status === "afventer").length,
    kmThisMonth: reports.filter((r) => isThisMonth(r.date)).reduce((s, r) => s + num(r.kilometers), 0),
    compPending: reports.filter((r) => r.status === "afventer").reduce((s, r) => s + num(r.compensation), 0),
    approved: reports.filter((r) => r.status === "godkendt").length,
  }), [reports]);

  const approve = (id: number) => patchReport.mutate({
    id, body: { status: "godkendt", approvedBy: user?.id ?? null, approvedAt: new Date().toISOString(), rejectionReason: null },
  });
  const confirmReject = () => {
    if (rejectId == null) return;
    patchReport.mutate({
      id: rejectId, body: { status: "afvist", approvedBy: user?.id ?? null, approvedAt: new Date().toISOString(), rejectionReason: rejectionReason.trim() || null },
    });
  };

  const statCards = [
    { id: "pending", label: "Afventende", value: String(stats.pending), icon: Route, color: "text-amber-600 dark:text-amber-500", iconColor: "text-amber-500" },
    { id: "km-month", label: "Km denne måned", value: stats.kmThisMonth.toFixed(1), icon: MapPin, color: "", iconColor: "text-blue-500" },
    { id: "comp-pending", label: "Godtgørelse afventer", value: money(stats.compPending), icon: Wallet, color: "", iconColor: "text-muted-foreground" },
    { id: "approved", label: "Godkendte", value: String(stats.approved), icon: CheckCircle2, color: "text-green-600 dark:text-green-500", iconColor: "text-green-500" },
  ];

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
          <h1 className="text-xl font-semibold tracking-tight">Kørselsregistrering</h1>
          <p className="text-sm text-muted-foreground">Registrering og godkendelse af kørsel for medarbejdere</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-mileage" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Registrer kørsel
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrer kørsel</DialogTitle></DialogHeader>
            <MileageForm companyId={companyId} pending={createReport.isPending} onSubmit={(body) => createReport.mutate(body)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.id} data-testid={`card-${s.id}`}>
              <CardContent className="flex flex-row items-center justify-between pb-3 pt-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                  <p className={`text-xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>
                </div>
                <Icon className={`w-4 h-4 ${s.iconColor}`} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input data-testid="input-search" placeholder="Søg på adresse eller medarbejder…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status-filter" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statusser</SelectItem>
            {(Object.keys(STATUS_LABELS) as MileageStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-mileage">
          <Route className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen kørselsrapporter endnu.
        </div>
      ) : (
        <Card data-testid="card-mileage-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Fra</TableHead>
                    <TableHead>Til</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                    <TableHead>Formål</TableHead>
                    <TableHead className="text-right">Godtgørelse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} data-testid={`row-mileage-${r.id}`}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{employeeName(r.employeeId)}</TableCell>
                      <TableCell className="max-w-44 truncate" title={r.startAddress ?? ""}>{r.startAddress || "—"}</TableCell>
                      <TableCell className="max-w-44 truncate" title={r.endAddress ?? ""}>{r.endAddress || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.kilometers).toFixed(1)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.purpose ? PURPOSE_LABELS[r.purpose] : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{money(num(r.compensation))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_CLASSES[r.status]} data-testid={`badge-status-${r.id}`}>{STATUS_LABELS[r.status]}</Badge>
                        {r.status === "afvist" && r.rejectionReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-48 truncate" title={r.rejectionReason}>{r.rejectionReason}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canApprove && r.status === "afventer" && (
                            <>
                              <Button size="sm" variant="outline" data-testid={`button-approve-${r.id}`} disabled={patchReport.isPending} onClick={() => approve(r.id)} className="text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Godkend
                              </Button>
                              <Button size="sm" variant="outline" data-testid={`button-reject-${r.id}`} disabled={patchReport.isPending} onClick={() => { setRejectId(r.id); setRejectionReason(""); }} className="text-red-600 dark:text-red-400">
                                <XCircle className="w-3.5 h-3.5 mr-1" />Afvis
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" data-testid={`button-delete-${r.id}`} disabled={deleteReport.isPending} onClick={() => deleteReport.mutate(r.id)}>
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
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

      <Dialog open={rejectId != null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Afvis kørsel</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rejection-reason">Begrundelse (valgfri)</Label>
            <Textarea id="rejection-reason" data-testid="input-rejection-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Angiv årsag til afvisning…" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="button-cancel-reject" onClick={() => setRejectId(null)}>Annuller</Button>
            <Button variant="destructive" data-testid="button-confirm-reject" disabled={patchReport.isPending} onClick={confirmReject}>
              <XCircle className="w-4 h-4 mr-1.5" />Bekræft afvisning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

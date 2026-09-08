import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
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
import { CheckCircle2, ClipboardList, Plus, Search, Trash2, Wallet, XCircle } from "lucide-react";

type Category = "braendstof" | "materialer" | "parkering" | "frokost" | "transport" | "andet";
type Status = "afventer" | "godkendt" | "afvist" | "betalt";

interface ExpenseReport {
  id: number;
  companyId: number;
  employeeId: number | null;
  customerId: number | null;
  taskId: number | null;
  amount: number | string | null;
  category: Category | string;
  description?: string | null;
  date?: string | null;
  status: Status;
  approvedBy?: number | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
}

interface Named { id: number; name?: string | null; fullName?: string | null; companyName?: string | null; title?: string | null; }

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "braendstof", label: "Brændstof" },
  { value: "materialer", label: "Materialer" },
  { value: "parkering", label: "Parkering" },
  { value: "frokost", label: "Frokost" },
  { value: "transport", label: "Transport" },
  { value: "andet", label: "Andet" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "afventer", label: "Afventer" },
  { value: "godkendt", label: "Godkendt" },
  { value: "afvist", label: "Afvist" },
  { value: "betalt", label: "Betalt" },
];

const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

const fmtCurrency = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(Number(n ?? 0));

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("da-DK") : "—");

const nameOf = (x?: Named | null) => x?.name ?? x?.fullName ?? x?.companyName ?? x?.title ?? null;

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    afventer: "bg-amber-100 text-amber-800 border-amber-300",
    godkendt: "bg-green-100 text-green-800 border-green-300",
    afvist: "bg-red-100 text-red-800 border-red-300",
    betalt: "bg-blue-100 text-blue-800 border-blue-300",
  };
  const label = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
  return (
    <Badge variant="outline" className={map[status] ?? map.afventer}>
      {label}
    </Badge>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-base font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const emptyForm = {
  employeeId: "",
  customerId: "",
  taskId: "",
  amount: "",
  category: "braendstof" as Category,
  description: "",
  date: new Date().toISOString().slice(0, 10),
};

export default function Udgiftsregistrering({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | Status>("alle");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [rejectTarget, setRejectTarget] = useState<ExpenseReport | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const isManager = user?.role === "leder" || user?.role === "platform_admin";

  const useCompany = <T,>(key: string, path: string) =>
    useQuery<T[]>({
      queryKey: [key, companyId],
      queryFn: async () => {
        const res = await apiRequest("GET", `${path}?companyId=${companyId}`);
        return res.json();
      },
    });

  const { data: reports = [], isLoading } = useCompany<ExpenseReport>("expense-reports", "/api/expense-reports");
  const { data: employees = [] } = useCompany<Named>("employees", "/api/employees");
  const { data: customers = [] } = useCompany<Named>("customers", "/api/customers");
  const { data: tasks = [] } = useCompany<Named>("tasks", "/api/tasks");

  const employeeName = (id: number | null) => {
    if (!id) return "—";
    const e = employees.find((x) => x.id === id);
    return nameOf(e) ?? `#${id}`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports
      .filter((r) => (statusFilter === "alle" ? true : r.status === statusFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.category ?? "").toLowerCase().includes(q) ||
          categoryLabel(r.category).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = new Date(a.date ?? a.createdAt ?? 0).getTime();
        const db = new Date(b.date ?? b.createdAt ?? 0).getTime();
        return db - da;
      });
  }, [reports, search, statusFilter]);

  const stats = useMemo(() => {
    const pending = reports.filter((r) => r.status === "afventer");
    const approved = reports.filter((r) => r.status === "godkendt");
    const now = new Date();
    const monthReports = reports.filter((r) => {
      const d = new Date(r.date ?? r.createdAt ?? 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const sum = (arr: ExpenseReport[]) => arr.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      approvedAmount: sum(approved),
      monthAmount: sum(monthReports),
      byStatus: STATUS_OPTIONS.map((s) => ({ ...s, count: reports.filter((r) => r.status === s.value).length })),
    };
  }, [reports]);

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/expense-reports", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Udgift oprettet" });
      qc.invalidateQueries({ queryKey: ["expense-reports", companyId] });
      setCreateOpen(false);
      setForm({ ...emptyForm });
    },
    onError: () => toast({ title: "Kunne ikke oprette udgift", variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/expense-reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Udgift opdateret" });
      qc.invalidateQueries({ queryKey: ["expense-reports", companyId] });
    },
    onError: () => toast({ title: "Kunne ikke opdatere udgift", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/expense-reports/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Udgift slettet" });
      qc.invalidateQueries({ queryKey: ["expense-reports", companyId] });
    },
    onError: () => toast({ title: "Kunne ikke slette udgift", variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!form.employeeId || !form.amount) {
      toast({ title: "Udfyld medarbejder og beløb", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      companyId,
      employeeId: Number(form.employeeId),
      customerId: form.customerId ? Number(form.customerId) : null,
      taskId: form.taskId ? Number(form.taskId) : null,
      amount: Number(form.amount),
      category: form.category,
      description: form.description || null,
      date: form.date,
      status: "afventer",
    });
  };

  const handleApprove = (r: ExpenseReport) => {
    patchMutation.mutate({
      id: r.id,
      data: {
        status: "godkendt",
        approvedBy: user?.id ?? null,
        approvedAt: new Date().toISOString(),
        rejectionReason: null,
      },
    });
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    patchMutation.mutate({
      id: rejectTarget.id,
      data: {
        status: "afvist",
        approvedBy: user?.id ?? null,
        approvedAt: new Date().toISOString(),
        rejectionReason: rejectionReason || null,
      },
    });
    setRejectTarget(null);
    setRejectionReason("");
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Udgiftsregistrering</h2>
          <p className="text-sm text-muted-foreground">Registrer og godkend udgifter for rengøringsteamet</p>
        </div>
        <Button data-testid="btn-create-expense" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ny udgift
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Afventer godkendelse" value={`${stats.pendingCount} (${fmtCurrency(stats.pendingAmount)})`} icon={ClipboardList} />
        <StatCard label="Godkendt i alt" value={fmtCurrency(stats.approvedAmount)} icon={CheckCircle2} />
        <StatCard label="Denne måned" value={fmtCurrency(stats.monthAmount)} icon={Wallet} />
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-sm text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.byStatus.map((s) => (
                <Badge key={s.value} variant="secondary" className="gap-1">
                  {s.label}: {s.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Søg på beskrivelse eller kategori…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "alle" | Status)}>
          <SelectTrigger data-testid="select-status-filter" className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dato</TableHead>
              <TableHead>Medarbejder</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Beløb</TableHead>
              <TableHead>Beskrivelse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Indlæser udgifter…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Ingen udgifter fundet</TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                  <TableCell>{employeeName(r.employeeId)}</TableCell>
                  <TableCell>{categoryLabel(r.category)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{fmtCurrency(r.amount)}</TableCell>
                  <TableCell className="max-w-[260px] truncate" title={r.description ?? ""}>{r.description || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isManager && r.status === "afventer" && (
                        <>
                          <Button
                            data-testid={`btn-approve-${r.id}`}
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(r)}
                            disabled={patchMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Godkend
                          </Button>
                          <Button
                            data-testid={`btn-reject-${r.id}`}
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => { setRejectTarget(r); setRejectionReason(""); }}
                          >
                            <XCircle className="h-4 w-4" /> Afvis
                          </Button>
                        </>
                      )}
                      <Button
                        data-testid={`btn-delete-${r.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Ny udgift</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="exp-employee">Medarbejder *</Label>
              <Select value={form.employeeId} onValueChange={(v) => set("employeeId", v)}>
                <SelectTrigger id="exp-employee" data-testid="select-employee">
                  <SelectValue placeholder="Vælg medarbejder" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{nameOf(e) ?? `Medarbejder #${e.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="exp-customer">Kunde (valgfri)</Label>
                <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                  <SelectTrigger id="exp-customer" data-testid="select-customer">
                    <SelectValue placeholder="Vælg kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{nameOf(c) ?? `Kunde #${c.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exp-task">Opgave (valgfri)</Label>
                <Select value={form.taskId} onValueChange={(v) => set("taskId", v)}>
                  <SelectTrigger id="exp-task" data-testid="select-task">
                    <SelectValue placeholder="Vælg opgave" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{nameOf(t) ?? `Opgave #${t.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="exp-amount">Beløb (DKK) *</Label>
                <Input id="exp-amount" data-testid="input-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exp-date">Dato</Label>
                <Input id="exp-date" data-testid="input-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exp-category">Kategori</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v as Category)}>
                <SelectTrigger id="exp-category" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exp-description">Beskrivelse</Label>
              <Textarea id="exp-description" data-testid="input-description" rows={3} placeholder="Beskriv udgiften…" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuller</Button>
            <Button data-testid="btn-submit-expense" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Opretter…" : "Opret udgift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Afvis udgift</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="reject-reason">Begrundelse</Label>
            <Textarea id="reject-reason" data-testid="input-rejection-reason" rows={3} placeholder="Angiv årsag til afvisning…" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Annuller</Button>
            <Button data-testid="btn-confirm-reject" variant="destructive" onClick={handleReject} disabled={patchMutation.isPending}>
              {patchMutation.isPending ? "Afviser…" : "Afvis udgift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useEmployees } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, Trash2, CalendarOff, CalendarX, Lock } from "lucide-react";
import type { Absence } from "@shared/schema";
import { PageHeader, SectionCard } from "@/components/premium";

const TYPES = [
  { id: "ferie", label: "Ferie" },
  { id: "sygdom", label: "Sygdom" },
  { id: "barn_syg", label: "Barns sygedag" },
  { id: "barsel", label: "Barsel" },
  { id: "omsorgsdag", label: "Omsorgsdag" },
  { id: "andet", label: "Andet" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  godkendt: "badge-soft badge-soft-green",
  afvist: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer", godkendt: "Godkendt", afvist: "Afvist",
};

type Summary = {
  employeeId: number;
  name: string;
  totalHours: number;
  byType: Record<string, { hours: number; days: number }>;
};

function dk(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function Fravaer() {
  const { companyId, user, hasFeature, plan } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [filter, setFilter] = useState("alle");

  const canApprove = user?.role === "leder" || user?.role === "holdleder" || user?.role === "platform_admin";
  const allowed = hasFeature("fravaer");

  const { data: employees } = useEmployees(companyId);
  const { data: absences, isLoading } = useQuery<Absence[]>({
    queryKey: ["/api/absences", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/absences?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: summary } = useQuery<Summary[]>({
    queryKey: ["/api/absences/summary", companyId, year],
    queryFn: async () =>
      (await apiRequest("GET", `/api/absences/summary?companyId=${companyId}&year=${year}`)).json(),
    enabled: allowed,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/absences"] });
    queryClient.invalidateQueries({ queryKey: ["/api/absences/summary"] });
  };

  const create = useMutation({
    mutationFn: async (data: any) =>
      (await apiRequest("POST", `/api/absences?companyId=${companyId}`, data)).json(),
    onSuccess: (row: Absence) => {
      invalidate();
      setDialogOpen(false);
      toast({
        title: "Fravær registreret",
        description: row.status === "afventer" ? "Afventer godkendelse fra din leder." : undefined,
      });
    },
    onError: (e: any) => toast({ title: "Kunne ikke gemme", description: e.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await apiRequest("PATCH", `/api/absences/${id}`, { status })).json(),
    onSuccess: (_d, v) => {
      invalidate();
      toast({ title: v.status === "godkendt" ? "Fravær godkendt" : "Fravær afvist" });
    },
    onError: (e: any) => toast({ title: "Handlingen mislykkedes", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/absences/${id}`); },
    onSuccess: () => { invalidate(); toast({ title: "Fravær slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });

  const empName = (id: number) => employees?.find((e) => e.id === id)?.name || `Ansat #${id}`;

  const visible = useMemo(() => {
    const rows = absences ?? [];
    const sorted = [...rows].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return filter === "alle" ? sorted : sorted.filter((a) => a.status === filter);
  }, [absences, filter]);

  const pendingCount = (absences ?? []).filter((a) => a.status === "afventer").length;
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return [now + 1, now, now - 1, now - 2].map(String);
  }, []);

  if (!allowed) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="rounded-md border border-border/50 bg-card p-4 text-center space-y-3" data-testid="notice-feature-locked">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">Fravær er ikke med i din pakke</h1>
          <p className="text-sm text-muted-foreground">
            Pakken {plan?.name ?? "din nuværende"} indeholder ikke fraværsstyring. Opgradér på abonnementssiden for at få adgang.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Personale"
        title="Fravær"
        description="Sygdom, ferie og fravær"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-absence"><Plus className="w-4 h-4 mr-1.5" />Registrér fravær</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrér fravær</DialogTitle></DialogHeader>
              <AbsenceForm
                employees={employees ?? []}
                defaultEmployeeId={user?.employeeId ?? undefined}
                pending={create.isPending}
                onSubmit={(d) => create.mutate(d)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {pendingCount > 0 && canApprove && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300" data-testid="text-pending-count">
          {pendingCount} {pendingCount === 1 ? "anmodning" : "anmodninger"} afventer din godkendelse.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {["alle", "afventer", "godkendt", "afvist"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-absence-${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "alle" ? "Alle" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-absences">
          <CalendarOff className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Der er intet fravær i denne visning.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <div key={a.id} data-testid={`row-absence-${a.id}`}
              className="rounded-md border border-border/50 bg-card p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground" data-testid={`text-absence-employee-${a.id}`}>
                    {empName(a.employeeId)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {TYPE_LABEL[a.type] || a.type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[a.status] || "bg-muted"}`}
                    data-testid={`status-absence-${a.id}`}>
                    {STATUS_LABEL[a.status] || a.status}
                  </span>
                  {!a.paid && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Uden løn</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dk(a.startDate)} – {dk(a.endDate)} · {a.hoursPerDay} timer pr. dag
                </p>
                {a.note && <p className="text-xs text-muted-foreground mt-1 italic">{a.note}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canApprove && a.status === "afventer" && (
                  <>
                    <Button size="sm" variant="outline" data-testid={`button-approve-${a.id}`}
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: a.id, status: "godkendt" })}>
                      <Check className="w-4 h-4 mr-1" />Godkend
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-reject-${a.id}`}
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: a.id, status: "afvist" })}>
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {canApprove && (
                  <Button size="sm" variant="ghost" data-testid={`button-delete-absence-${a.id}`}
                    onClick={() => remove.mutate(a.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionCard
        title="Godkendt fravær pr. ansat"
        icon={<CalendarX className="w-4 h-4" />}
        action={
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-absence-year"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Kun godkendt fravær med løn tælles med. Weekender regnes ikke som fraværsdage.
        </p>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="table-premium min-w-[420px]">
            <thead>
              <tr>
                <th>Ansat</th>
                <th className="text-right">Timer i alt</th>
                <th>Fordeling</th>
              </tr>
            </thead>
            <tbody>
              {(summary ?? []).map((s) => (
                <tr key={s.employeeId} data-testid={`row-summary-${s.employeeId}`}>
                  <td className="text-foreground">{s.name}</td>
                  <td className="text-right font-medium text-foreground tabular-nums">
                    {s.totalHours.toLocaleString("da-DK", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {Object.keys(s.byType).length === 0
                      ? "—"
                      : Object.entries(s.byType)
                          .map(([t, v]) => `${TYPE_LABEL[t] || t}: ${v.days} d`)
                          .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </SectionCard>
    </div>
  );
}

function AbsenceForm({
  employees, defaultEmployeeId, pending, onSubmit,
}: {
  employees: { id: number; name: string }[];
  defaultEmployeeId?: number;
  pending: boolean;
  onSubmit: (data: any) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState(String(defaultEmployeeId ?? employees[0]?.id ?? ""));
  const [type, setType] = useState("ferie");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [hoursPerDay, setHoursPerDay] = useState("7.4");
  const [paid, setPaid] = useState("1");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return setLocalError("Vælg en ansat.");
    if (endDate < startDate) return setLocalError("Slutdatoen kan ikke ligge før startdatoen.");
    setLocalError(null);
    onSubmit({
      employeeId: Number(employeeId),
      type,
      startDate,
      endDate,
      hoursPerDay: Number(hoursPerDay.replace(",", ".")) || 7.4,
      paid: Number(paid),
      note: note.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Ansat</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger data-testid="select-absence-employee"><SelectValue placeholder="Vælg ansat" /></SelectTrigger>
          <SelectContent>
            {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="select-absence-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="abs-start">Fra</Label>
          <Input id="abs-start" type="date" className="w-full" data-testid="input-absence-start"
            value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="abs-end">Til</Label>
          <Input id="abs-end" type="date" className="w-full" data-testid="input-absence-end"
            value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="abs-hours">Timer pr. dag</Label>
          <Input id="abs-hours" className="w-full" data-testid="input-absence-hours"
            value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label>Løn</Label>
          <Select value={paid} onValueChange={setPaid}>
            <SelectTrigger data-testid="select-absence-paid"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Med løn</SelectItem>
              <SelectItem value="0">Uden løn</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="abs-note">Bemærkning</Label>
        <Textarea id="abs-note" rows={2} data-testid="input-absence-note"
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfrit" />
      </div>
      {localError && (
        <p className="text-xs text-destructive" data-testid="text-absence-error">{localError}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-absence">
        {pending ? "Gemmer..." : "Gem fravær"}
      </Button>
    </form>
  );
}

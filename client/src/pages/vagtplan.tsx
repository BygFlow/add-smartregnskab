import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useEmployees, useCustomers } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, Send, Trash2, Lock, CalendarDays, Calendar } from "lucide-react";
import type { Shift } from "@shared/schema";
import { PageHeader, SectionCard } from "@/components/premium";

const WEEKDAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const STATUS = [
  { id: "planlagt", label: "Planlagt" },
  { id: "bekraeftet", label: "Bekræftet" },
  { id: "afbud", label: "Afbud" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS.map((s) => [s.id, s.label]));
const STATUS_STYLE: Record<string, string> = {
  planlagt: "border-l-primary",
  bekraeftet: "border-l-emerald-500",
  afbud: "border-l-destructive",
};

/** Mandagen i ugen for en given dato. */
function mondayOf(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // mandag = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(12, 0, 0, 0);
  return copy;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function Vagtplan() {
  const { companyId, user, hasFeature, plan } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [view, setView] = useState<"liste" | "kalender">("liste");

  const canEdit = ["leder", "holdleder", "platform_admin"].includes(user?.role || "");
  const allowed = hasFeature("vagtplan");

  const from = iso(weekStart);
  const to = iso(addDays(weekStart, 6));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { data: employees } = useEmployees(companyId);
  const { data: customers } = useCustomers(companyId);
  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", companyId, from, to],
    queryFn: async () =>
      (await apiRequest("GET", `/api/shifts?companyId=${companyId}&from=${from}&to=${to}`)).json(),
    enabled: allowed,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });

  const create = useMutation({
    mutationFn: async (data: any) =>
      (await apiRequest("POST", `/api/shifts?companyId=${companyId}`, data)).json(),
    onSuccess: (row: any) => {
      invalidate();
      setDialogOpen(false);
      toast({
        title: "Vagt oprettet",
        description: row.warning || undefined,
        variant: row.warning ? "destructive" : undefined,
      });
    },
    onError: (e: any) => toast({ title: "Kunne ikke oprette vagten", description: e.message, variant: "destructive" }),
  });

  const patch = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) =>
      (await apiRequest("PATCH", `/api/shifts/${id}`, data)).json(),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Kunne ikke opdatere", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/shifts/${id}`); },
    onSuccess: () => { invalidate(); toast({ title: "Vagt slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });

  const publish = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/shifts/publish?companyId=${companyId}`, { from, to })).json(),
    onSuccess: (d: any) => {
      invalidate();
      toast({ title: `${d.count} vagter udsendt`, description: d.message });
    },
    onError: (e: any) => toast({ title: "Kunne ikke udsende", description: e.message, variant: "destructive" }),
  });

  const empName = (id: number) => employees?.find((e) => e.id === id)?.name || `Ansat #${id}`;
  const custName = (id?: number | null) => customers?.find((c) => c.id === id)?.name || null;

  const unpublished = (shifts ?? []).filter((s) => !s.published).length;
  const totalHours = useMemo(() => {
    return (shifts ?? [])
      .filter((s) => s.status !== "afbud")
      .reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        return sum + Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
      }, 0);
  }, [shifts]);

  if (!allowed) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="rounded-md border border-border/50 bg-card p-4 text-center space-y-3" data-testid="notice-feature-locked">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">Vagtplan er ikke med i din pakke</h1>
          <p className="text-sm text-muted-foreground">
            Pakken {plan?.name ?? "din nuværende"} indeholder ikke vagtplanlægning. Opgradér på abonnementssiden for at få adgang.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <PageHeader
        eyebrow="Planlægning"
        title="Vagtplan"
        description="Rute- og vagtplanlægning"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-9 w-9" data-testid="button-prev-week"
                onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" data-testid="button-this-week"
                onClick={() => setWeekStart(mondayOf(new Date()))}>Denne uge</Button>
              <Button size="icon" variant="outline" className="h-9 w-9" data-testid="button-next-week"
                onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {canEdit && (
              <>
                <Button size="sm" variant="outline" data-testid="button-publish-shifts"
                  disabled={publish.isPending || unpublished === 0}
                  onClick={() => publish.mutate()}>
                  <Send className="w-4 h-4 mr-1.5" />
                  {unpublished > 0 ? `Udsend (${unpublished})` : "Alt udsendt"}
                </Button>
                <Button size="sm" data-testid="button-new-shift"
                  onClick={() => { setPrefillDate(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" />Ny vagt
                </Button>
              </>
            )}
          </div>
        }
      >
        <p className="text-sm text-muted-foreground mt-1">
          Uge {isoWeek(weekStart)} · {totalHours.toLocaleString("da-DK", { maximumFractionDigits: 1 })} planlagte timer
        </p>
      </PageHeader>

      <Tabs value={view} onValueChange={(v) => setView(v as "liste" | "kalender")}>
        <TabsList data-testid="tabs-vagtplan-view">
          <TabsTrigger value="liste" data-testid="tab-vagtplan-liste"><CalendarDays className="w-3.5 h-3.5 mr-1.5" />Ugeoversigt</TabsTrigger>
          <TabsTrigger value="kalender" data-testid="tab-vagtplan-kalender"><Calendar className="w-3.5 h-3.5 mr-1.5" />Kalender</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "liste" && (
      <>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-md" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {days.map((day, i) => {
            const key = iso(day);
            const dayShifts = (shifts ?? [])
              .filter((s) => s.date === key)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = key === iso(new Date());
            return (
              <div key={key} data-testid={`col-day-${key}`}
                className={`rounded-md border bg-card p-3 space-y-2 min-h-[140px] ${isToday ? "border-primary" : "border-border/50"}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground">{WEEKDAYS[i]}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {day.getDate()}.{day.getMonth() + 1}.
                  </span>
                </div>
                {dayShifts.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-2">Ingen vagter</p>
                ) : (
                  dayShifts.map((s) => (
                    <div key={s.id} data-testid={`card-shift-${s.id}`}
                      className={`rounded-md bg-muted/50 border-l-2 ${STATUS_STYLE[s.status] || "border-l-border"} p-2 space-y-1`}>
                      <div className="text-[11px] font-medium text-foreground tabular-nums">
                        {s.startTime}–{s.endTime}
                      </div>
                      <div className="text-[11px] text-foreground truncate" data-testid={`text-shift-employee-${s.id}`}>
                        {empName(s.employeeId)}
                      </div>
                      {custName(s.customerId) && (
                        <div className="text-[10px] text-muted-foreground truncate">{custName(s.customerId)}</div>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                          {STATUS_LABEL[s.status] || s.status}
                        </span>
                        {s.published ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded badge-soft badge-soft-green">
                            Udsendt
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded badge-soft badge-soft-amber">
                            Ikke udsendt
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 pt-0.5">
                          <Select value={s.status} onValueChange={(v) => patch.mutate({ id: s.id, data: { status: v } })}>
                            <SelectTrigger className="h-6 text-[10px] flex-1" data-testid={`select-shift-status-${s.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS.map((st) => <SelectItem key={st.id} value={st.id}>{st.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button onClick={() => remove.mutate(s.id)} data-testid={`button-delete-shift-${s.id}`}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {canEdit && (
                  <button data-testid={`button-add-shift-${key}`}
                    onClick={() => { setPrefillDate(key); setDialogOpen(true); }}
                    className="flex items-center gap-1 w-full text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors">
                    <Plus className="w-3 h-3" />Tilføj
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {view === "kalender" && (
        <ShiftCalendar
          companyId={companyId}
          canEdit={canEdit}
          employees={employees ?? []}
          customers={customers ?? []}
          onAddShift={(date) => { setPrefillDate(date); setDialogOpen(true); }}
        />
      )}

      <SectionCard>
        <div className="flex gap-2 items-start">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Når du udsender vagtplanen, lægges en SMS i beskedkøen til hver ansat med telefonnummer.
            Beskederne får status "simuleret" og forlader ikke systemet, før en SMS-udbyder er opsat under Integrationer.
            Ansatte med godkendt fravær giver en advarsel, men vagten oprettes alligevel.
          </p>
        </div>
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ny vagt</DialogTitle></DialogHeader>
          <ShiftForm
            employees={employees ?? []}
            customers={customers ?? []}
            defaultDate={prefillDate ?? from}
            pending={create.isPending}
            onSubmit={(d) => create.mutate(d)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShiftForm({
  employees, customers, defaultDate, pending, onSubmit,
}: {
  employees: { id: number; name: string }[];
  customers: { id: number; name: string }[];
  defaultDate: string;
  pending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.id ?? ""));
  const [customerId, setCustomerId] = useState("ingen");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [status, setStatus] = useState("planlagt");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return setError("Vælg en ansat.");
    if (endTime <= startTime) return setError("Sluttidspunktet skal ligge efter starttidspunktet.");
    setError(null);
    onSubmit({
      employeeId: Number(employeeId),
      customerId: customerId === "ingen" ? null : Number(customerId),
      date, startTime, endTime, status,
      note: note.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Ansat</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger data-testid="select-shift-employee"><SelectValue placeholder="Vælg ansat" /></SelectTrigger>
          <SelectContent>
            {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Kunde</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger data-testid="select-shift-customer"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ingen">Ingen kunde</SelectItem>
            {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shift-date">Dato</Label>
        <Input id="shift-date" type="date" className="w-full" data-testid="input-shift-date"
          value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="shift-start">Fra kl.</Label>
          <Input id="shift-start" type="time" className="w-full" data-testid="input-shift-start"
            value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="shift-end">Til kl.</Label>
          <Input id="shift-end" type="time" className="w-full" data-testid="input-shift-end"
            value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-shift-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shift-note">Bemærkning</Label>
        <Textarea id="shift-note" rows={2} data-testid="input-shift-note"
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfrit" />
      </div>
      {error && <p className="text-xs text-destructive" data-testid="text-shift-error">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-shift">
        {pending ? "Gemmer..." : "Gem vagt"}
      </Button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
// Kalendervisning for vagtplan — dag/uge/måned, farvekodet per ansat
// ═══════════════════════════════════════════════════════════════

const CAL_WEEKDAYS_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const CAL_MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
const EMPLOYEE_COLORS = [
  "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
  "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
  "border-l-purple-500 bg-purple-50 dark:bg-purple-950/30",
  "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
  "border-l-rose-500 bg-rose-50 dark:bg-rose-950/20",
  "border-l-cyan-500 bg-cyan-50 dark:bg-cyan-950/30",
  "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
  "border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function ShiftCalendar({ companyId, canEdit, employees, customers, onAddShift }: {
  companyId: number;
  canEdit: boolean;
  employees: { id: number; name: string }[];
  customers: { id: number; name: string }[];
  onAddShift: (date: string) => void;
}) {
  const [mode, setMode] = useState<"dag" | "uge" | "maaned">("uge");
  const [cursor, setCursor] = useState(() => new Date());
  const { toast } = useToast();

  // Hent vagter for et bredt vindde omkring markøren (dækker dag/uge/måned)
  const from = useMemo(() => {
    if (mode === "maaned") { const s = startOfMonth(cursor); return iso(addDays(s, -7)); }
    if (mode === "uge") return iso(addDays(mondayOf(cursor), -1));
    return iso(addDays(cursor, -1));
  }, [mode, cursor]);
  const to = useMemo(() => {
    if (mode === "maaned") { const s = startOfMonth(cursor); const e = new Date(s.getFullYear(), s.getMonth() + 1, 0); return iso(addDays(e, 7)); }
    if (mode === "uge") return iso(addDays(mondayOf(cursor), 7));
    return iso(addDays(cursor, 1));
  }, [mode, cursor]);

  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", companyId, from, to, "cal"],
    queryFn: async () => (await apiRequest("GET", `/api/shifts?companyId=${companyId}&from=${from}&to=${to}`)).json(),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/shifts/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/shifts"] }); toast({ title: "Vagt slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });

  const empColor = (id: number) => {
    const idx = employees.findIndex((e) => e.id === id);
    return EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] ?? EMPLOYEE_COLORS[0];
  };
  const empName = (id: number) => employees.find((e) => e.id === id)?.name || `Ansat #${id}`;
  const custName = (id?: number | null) => (id ? customers.find((c) => c.id === id)?.name || null : null);

  const move = (dir: number) => {
    if (mode === "dag") setCursor(addDays(cursor, dir));
    else if (mode === "uge") setCursor(addDays(cursor, dir * 7));
    else { const c = new Date(cursor); c.setMonth(c.getMonth() + dir); setCursor(c); }
  };

  const periodLabel = useMemo(() => {
    if (mode === "dag") return cursor.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (mode === "uge") { const m = mondayOf(cursor); return `Uge ${isoWeek(cursor)} — ${m.getDate()}. ${CAL_MONTHS[m.getMonth()]} ${m.getFullYear()}`; }
    return `${CAL_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [mode, cursor]);

  const allShifts = shifts ?? [];

  function renderShift(s: Shift, compact = false) {
    return (
      <div key={s.id} data-testid={`cal-shift-${s.id}`} className={`rounded-md border-l-2 ${empColor(s.employeeId)} px-1.5 py-1 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        <p className="font-medium text-foreground tabular-nums truncate">{s.startTime}–{s.endTime}</p>
        <p className="text-muted-foreground truncate">{empName(s.employeeId)}</p>
        {!compact && custName(s.customerId) && <p className="text-muted-foreground truncate">{custName(s.customerId)}</p>}
        {!compact && canEdit && (
          <button onClick={() => remove.mutate(s.id)} data-testid={`button-cal-delete-shift-${s.id}`} className="mt-0.5 p-0.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  const todayIso = iso(new Date());

  return (
    <SectionCard data-testid="card-vagtplan-kalender" title="Vagtkalender" icon={<Calendar className="w-4 h-4" />} noPadding>
      <div className="px-3 py-3 border-b border-border/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" data-testid="button-vcal-prev" onClick={() => move(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" data-testid="button-vcal-today" onClick={() => setCursor(new Date())}>I dag</Button>
          <Button size="icon" variant="outline" className="h-8 w-8" data-testid="button-vcal-next" onClick={() => move(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground ml-2 capitalize" data-testid="text-vcal-period">{periodLabel}</span>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "dag" | "uge" | "maaned")}>
          <TabsList data-testid="tabs-vcal-mode">
            <TabsTrigger value="dag" data-testid="tab-vcal-dag">Dag</TabsTrigger>
            <TabsTrigger value="uge" data-testid="tab-vcal-uge">Uge</TabsTrigger>
            <TabsTrigger value="maaned" data-testid="tab-vcal-maaned">Måned</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Farvesignalforklaring for ansatte */}
      {employees.length > 0 && (
        <div className="px-3 py-2 border-b border-border/40 flex flex-wrap gap-2">
          {employees.slice(0, 8).map((e, i) => (
            <span key={e.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`w-2.5 h-2.5 rounded-sm border-l-2 ${EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length]} border border-border/40`} />
              {e.name}
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : (
        <>
          {mode === "dag" && (() => {
            const key = iso(cursor);
            const dayShifts = allShifts.filter((s) => s.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
            // Gruppér vagter per ansat — samme mønster som opgaver DayView
            const empMap = new Map<number, string>();
            for (const s of dayShifts) {
              if (!empMap.has(s.employeeId)) empMap.set(s.employeeId, empName(s.employeeId));
            }
            const assignedEmployees = Array.from(empMap.entries()).map(([id, name]) => ({ id, name }));
            const hours = Array.from({ length: 15 }, (_, i) => 6 + i); // 06:00–20:00
            const cols = assignedEmployees.length || 1;
            return (
              <div className="overflow-x-auto" data-testid="vcal-day-view">
                <div className="min-w-[640px]">
                  <div className="grid" style={{ gridTemplateColumns: `48px repeat(${cols}, minmax(0, 1fr))` }}>
                    <div className="border-b border-border/50 bg-muted/30" />
                    {assignedEmployees.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">Ingen vagter denne dag</div>
                    ) : (
                      assignedEmployees.map(({ id, name }) => (
                        <div key={id} data-testid={`vcal-day-emp-${id}`} className="border-b border-l border-border/50 bg-muted/30 px-2 py-1.5">
                          <p className="text-[11px] font-medium text-foreground truncate">{name}</p>
                        </div>
                      ))
                    )}
                  </div>
                  {hours.map((h) => (
                    <div key={h} className="grid border-b border-border/30" style={{ gridTemplateColumns: `48px repeat(${cols}, minmax(0, 1fr))` }}>
                      <div className="px-1 py-1 text-[10px] text-muted-foreground tabular-nums border-r border-border/30">{String(h).padStart(2, "0")}:00</div>
                      {assignedEmployees.length === 0 ? (
                        <div className="min-h-[28px]" />
                      ) : (
                        assignedEmployees.map(({ id }) => {
                          const slotShifts = dayShifts.filter((s) => s.employeeId === id && parseInt(s.startTime.slice(0, 2)) === h);
                          return (
                            <div key={id} className="border-l border-border/30 px-1 py-0.5 min-h-[28px] space-y-0.5">
                              {slotShifts.map((s) => renderShift(s))}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                  {canEdit && assignedEmployees.length > 0 && (
                    <div className="px-2 py-2 border-t border-border/40">
                      <button data-testid={`button-vcal-add-${key}`} onClick={() => onAddShift(key)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                        <Plus className="w-3 h-3" />Tilføj vagt denne dag
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {mode === "uge" && (
            <div className="overflow-x-auto" data-testid="vcal-week-view">
              <div className="grid grid-cols-1 sm:grid-cols-7 min-w-[760px]">
                {Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i)).map((day, i) => {
                  const key = iso(day);
                  const dayShifts = allShifts.filter((s) => s.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = key === todayIso;
                  return (
                    <div key={key} data-testid={`vcal-week-day-${key}`} className={`border-l border-border/40 min-h-[180px] ${isToday ? "bg-primary/5" : ""}`}>
                      <div className="px-2 py-1.5 border-b border-border/40">
                        <p className="text-[11px] font-medium text-foreground">{CAL_WEEKDAYS_SHORT[i]}</p>
                        <p className={`text-xs ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day.getDate()}.{day.getMonth() + 1}.</p>
                      </div>
                      <div className="p-1 space-y-1">
                        {dayShifts.length === 0 ? <p className="text-[10px] text-muted-foreground py-1 text-center">—</p> : dayShifts.map((s) => renderShift(s))}
                        {canEdit && (
                          <button data-testid={`button-vcal-add-${key}`} onClick={() => onAddShift(key)} className="flex items-center gap-1 w-full text-[10px] text-muted-foreground hover:text-foreground py-0.5">
                            <Plus className="w-3 h-3" />Tilføj
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {mode === "maaned" && (
            <div data-testid="vcal-month-view">
              <div className="grid grid-cols-7 border-b border-border/40">
                {CAL_WEEKDAYS_SHORT.map((w) => <div key={w} className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {(() => {
                  const first = startOfMonth(cursor);
                  const startOffset = (first.getDay() + 6) % 7;
                  const gridStart = addDays(first, -startOffset);
                  return Array.from({ length: 42 }, (_, idx) => addDays(gridStart, idx));
                })().map((day) => {
                  const key = iso(day);
                  const dayShifts = allShifts.filter((s) => s.date === key);
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = key === todayIso;
                  return (
                    <div key={key} data-testid={`vcal-month-day-${key}`} className={`border-b border-r border-border/30 min-h-[88px] p-1 ${inMonth ? "bg-card" : "bg-muted/20"} ${isToday ? "ring-1 ring-primary ring-inset" : ""}`}>
                      <p className={`text-[10px] ${inMonth ? "text-muted-foreground" : "text-muted-foreground/50"} ${isToday ? "text-primary font-bold" : ""}`}>{day.getDate()}</p>
                      <div className="space-y-0.5 mt-0.5">
                        {dayShifts.slice(0, 3).map((s) => renderShift(s, true))}
                        {dayShifts.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayShifts.length - 3} flere</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

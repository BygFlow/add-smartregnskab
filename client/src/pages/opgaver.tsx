import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AiGate } from "@/components/ai-lock";
import { useTasks, useEmployees, useCustomers, useCreateTask, useUpdateTask, useDeleteTask, statusLabel, priorityLabel, recurrenceLabel, todayStr, formatDuration } from "@/App";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, SectionCard, StatusChip } from "@/components/premium";
import { FunctionMenu, type FunctionMenuItem } from "@/components/function-menu";
import { Plus, Calendar, Clock, MapPin, User, Repeat, Trash2, Edit2, Navigation, ArrowLeft, StickyNote, Play, Pause, Square, Coffee, Sparkles, RefreshCw, ClipboardList, LayoutGrid, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { Task, Customer } from "@shared/schema";

const STATUSES = ["planlagt", "igang", "færdig", "aflyst"];
const PRIORITIES = ["lav", "normal", "høj"];
const RECURRENCES = ["ingen", "daglig", "ugentlig", "maaedlig"];

const WEEKDAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const WEEKDAYS_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];

// ── Status/prioritet → StatusChip-variant ──
type ChipVariant = "primary" | "blue" | "amber" | "green" | "red" | "gray";
function statusVariant(status: string): ChipVariant {
  const map: Record<string, ChipVariant> = {
    planlagt: "blue",
    igang: "amber",
    "færdig": "green",
    aflyst: "red",
  };
  return map[status] || "gray";
}
function priorityVariant(p: string): ChipVariant {
  const map: Record<string, ChipVariant> = { høj: "red", normal: "blue", lav: "gray" };
  return map[p] || "gray";
}

// ── Dato-hjælpefunktioner ──
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function mondayOf(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // mandag = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(12, 0, 0, 0);
  return copy;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function Opgaver() {
  const { user } = useAuth();
  const role = user?.role || "assistent";

  // Assistenter får deres egen opgavevisning
  if (role === "assistent") {
    return <MineOpgaver />;
  }

  return <OpgaverLeder />;
}

// ═══════════════════════════════════════════════════════════════
// Leder/holdleder: fuld opgavehåndtering med liste- og kalendervisning
// ═══════════════════════════════════════════════════════════════

function OpgaverLeder() {
  const { companyId } = useAuth();
  const { data: tasks, isLoading } = useTasks(companyId);
  const { data: employees } = useEmployees(companyId);
  const { data: customers } = useCustomers(companyId);
  const createTask = useCreateTask(companyId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [filter, setFilter] = useState("alle");
  const [view, setView] = useState<"liste" | "kalender">("liste");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const filtered = (tasks || []).filter(t => filter === "alle" || t.status === filter);

  const filterItems: FunctionMenuItem[] = [
    { id: "alle", label: "Alle", icon: <LayoutGrid className="w-4 h-4" /> },
    { id: "planlagt", label: "Planlagt", icon: <Calendar className="w-4 h-4" /> },
    { id: "igang", label: "I gang", icon: <Play className="w-4 h-4" /> },
    { id: "færdig", label: "Færdig", icon: <CheckCircle className="w-4 h-4" /> },
    { id: "aflyst", label: "Aflyst", icon: <XCircle className="w-4 h-4" /> },
  ];
  const empName = (id?: number | null) => employees?.find(e => e.id === id)?.name || "Ikke tildelt";
  const custName = (id?: number | null) => customers?.find(c => c.id === id)?.name || "Ingen kunde";

  const handleEdit = (task: Task) => {
    setEditing(task);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="p-4 pb-24 space-y-3 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Drift"
        title="Opgaver"
        description="Opgavestyring og planlægning"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} data-testid="button-new-task"><Plus className="w-4 h-4 mr-1.5" />Ny opgave</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Rediger opgave" : "Ny opgave"}</DialogTitle>
              </DialogHeader>
              <TaskForm
                task={editing}
                employees={employees || []}
                customers={customers || []}
                onSubmit={async (data) => {
                  if (editing) {
                    await updateTask.mutateAsync({ id: editing.id, data });
                  } else {
                    await createTask.mutateAsync(data);
                  }
                  setDialogOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as "liste" | "kalender")}>
        <TabsList data-testid="tabs-opgaver-view">
          <TabsTrigger value="liste" data-testid="tab-opgaver-liste"><ClipboardList className="w-3.5 h-3.5 mr-1.5" />Liste</TabsTrigger>
          <TabsTrigger value="kalender" data-testid="tab-opgaver-kalender"><Calendar className="w-3.5 h-3.5 mr-1.5" />Kalender</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "liste" && (
        <div data-testid="card-opgaveliste">
          <SectionCard
            title="Opgaveliste"
            icon={<ClipboardList className="w-4 h-4" />}
            noPadding
          >
            <div data-testid="filter-bar" className="px-3 py-3 border-b border-border/50">
              <FunctionMenu items={filterItems} active={filter} onChange={setFilter} />
            </div>
            <div className="p-3">
              {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Ingen opgaver fundet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((task) => (
                    <div key={task.id} className="rounded-md border border-border/70 bg-card p-4 space-y-2.5" data-testid={`card-task-${task.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-foreground">{task.title}</h3>
                          {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => handleEdit(task)} className="p-1 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-edit-task-${task.id}`}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteTask.mutate(task.id)} className="p-1 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-delete-task-${task.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusChip status={statusLabel(task.status)} variant={statusVariant(task.status)} />
                        <StatusChip status={priorityLabel(task.priority)} variant={priorityVariant(task.priority)} />
                        {task.recurrence !== "ingen" && (
                          <Badge variant="secondary" className="text-[10px] gap-1"><Repeat className="w-3 h-3" />{recurrenceLabel(task.recurrence)}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{task.date}</span>
                        {task.startTime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{task.startTime}{task.endTime && `-${task.endTime}`}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/50">
                        <span className="flex items-center gap-1 min-w-0 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{custName(task.customerId)}</span></span>
                        <span className="flex items-center gap-1 shrink-0"><User className="w-3.5 h-3.5" />{empName(task.employeeId)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {view === "kalender" && (
        <TaskCalendar
          tasks={tasks || []}
          employees={employees || []}
          customers={customers || []}
          isLoading={isLoading}
        />
      )}

      <AiGate label="AI auto-planlægning">
        <AiAutoSchedulePanel companyId={companyId} />
      </AiGate>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Kalendervisning — dag/uge/måned med opgaver per ansat
// ═══════════════════════════════════════════════════════════════

type CalendarMode = "dag" | "uge" | "maaned";

function TaskCalendar({ tasks, employees, customers, isLoading }: {
  tasks: Task[];
  employees: { id: number; name: string; color?: string }[];
  customers: { id: number; name: string }[];
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<CalendarMode>("uge");
  const [cursor, setCursor] = useState(() => new Date());

  const empName = (id?: number | null) => employees.find(e => e.id === id)?.name || "Ikke tildelt";
  const custName = (id?: number | null) => customers.find(c => c.id === id)?.name || "";

  const move = (dir: number) => {
    if (mode === "dag") setCursor(addDays(cursor, dir));
    else if (mode === "uge") setCursor(addDays(cursor, dir * 7));
    else { const c = new Date(cursor); c.setMonth(c.getMonth() + dir); setCursor(c); }
  };

  const periodLabel = useMemo(() => {
    if (mode === "dag") return cursor.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (mode === "uge") { const m = mondayOf(cursor); return `Uge ${isoWeek(cursor)} — ${m.getDate()}. ${MONTHS[m.getMonth()]} ${m.getFullYear()}`; }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [mode, cursor]);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}</div>;
  }

  return (
    <SectionCard data-testid="card-opgave-kalender" title="Opgavekalender" icon={<Calendar className="w-4 h-4" />} noPadding>
      <div className="px-3 py-3 border-b border-border/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" data-testid="button-cal-prev" onClick={() => move(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" data-testid="button-cal-today" onClick={() => setCursor(new Date())}>I dag</Button>
          <Button size="icon" variant="outline" className="h-8 w-8" data-testid="button-cal-next" onClick={() => move(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground ml-2 capitalize" data-testid="text-cal-period">{periodLabel}</span>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as CalendarMode)}>
          <TabsList data-testid="tabs-cal-mode">
            <TabsTrigger value="dag" data-testid="tab-cal-dag">Dag</TabsTrigger>
            <TabsTrigger value="uge" data-testid="tab-cal-uge">Uge</TabsTrigger>
            <TabsTrigger value="maaned" data-testid="tab-cal-maaned">Måned</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "dag" && <DayView date={cursor} tasks={tasks} empName={empName} custName={custName} />}
      {mode === "uge" && <WeekView weekStart={mondayOf(cursor)} tasks={tasks} empName={empName} custName={custName} />}
      {mode === "maaned" && <MonthView cursor={cursor} tasks={tasks} empName={empName} custName={custName} />}
    </SectionCard>
  );
}

function TaskBlock({ task, empName, custName, compact }: { task: Task; empName: (id?: number | null) => string; custName: (id?: number | null) => string; compact?: boolean }) {
  return (
    <div
      data-testid={`cal-task-${task.id}`}
      className={`rounded-md border-l-2 ${task.status === "igang" ? "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30" : task.status === "færdig" ? "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"} px-1.5 py-1 ${compact ? "text-[10px]" : "text-[11px]"}`}
    >
      <p className="font-medium text-foreground truncate">{task.title}</p>
      {!compact && (
        <>
          <p className="text-muted-foreground truncate flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />{task.startTime}{task.endTime ? `-${task.endTime}` : ""}
          </p>
          <p className="text-muted-foreground truncate flex items-center gap-0.5">
            <User className="w-2.5 h-2.5" />{empName(task.employeeId)}
          </p>
          {custName(task.customerId) && (
            <p className="text-muted-foreground truncate flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />{custName(task.customerId)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Dagvisning: tidslinje 06:00–20:00 med opgaver per ansat ──
function DayView({ date, tasks, empName, custName }: { date: Date; tasks: Task[]; empName: (id?: number | null) => string; custName: (id?: number | null) => string }) {
  const key = iso(date);
  const dayTasks = tasks.filter(t => t.date === key);
  const assignedEmployees = employeesForDay(dayTasks);
  const hours = Array.from({ length: 15 }, (_, i) => 6 + i); // 06–20

  return (
    <div className="overflow-x-auto" data-testid="cal-day-view">
      <div className="min-w-[640px]">
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(${assignedEmployees.length || 1}, minmax(0, 1fr))` }}>
          <div className="border-b border-border/50 bg-muted/30" />
          {assignedEmployees.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Ingen opgaver denne dag</div>
          ) : (
            assignedEmployees.map(({ id, name }) => (
              <div key={id ?? "none"} className="border-b border-l border-border/50 bg-muted/30 px-2 py-1.5" data-testid={`cal-day-emp-${id ?? "none"}`}>
                <p className="text-[11px] font-medium text-foreground truncate">{name}</p>
              </div>
            ))
          )}
        </div>
        {hours.map((h) => (
          <div key={h} className="grid border-b border-border/30" style={{ gridTemplateColumns: `48px repeat(${assignedEmployees.length || 1}, minmax(0, 1fr))` }}>
            <div className="px-1 py-1 text-[10px] text-muted-foreground tabular-nums border-r border-border/30">{String(h).padStart(2, "0")}:00</div>
            {assignedEmployees.length === 0 ? (
              <div className="min-h-[28px]" />
            ) : (
              assignedEmployees.map(({ id }) => {
                const slotTasks = dayTasks.filter(t => t.employeeId === id && t.startTime && parseInt(t.startTime.slice(0, 2)) === h);
                return (
                  <div key={id ?? "none"} className="border-l border-border/30 px-1 py-0.5 min-h-[28px] space-y-0.5">
                    {slotTasks.map(t => <TaskBlock key={t.id} task={t} empName={empName} custName={custName} compact />)}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );

  function employeesForDay(dayTasks: Task[]) {
    const map = new Map<number | string, string>();
    for (const t of dayTasks) {
      const id = t.employeeId ?? "none";
      if (!map.has(id)) map.set(id, t.employeeId ? empName(t.employeeId) : "Ikke tildelt");
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id: typeof id === "string" ? null : id, name }));
  }
}

// ── Ugevisning: 7 dagskolonner ──
function WeekView({ weekStart, tasks, empName, custName }: { weekStart: Date; tasks: Task[]; empName: (id?: number | null) => string; custName: (id?: number | null) => string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = iso(new Date());

  return (
    <div className="overflow-x-auto" data-testid="cal-week-view">
      <div className="grid grid-cols-1 sm:grid-cols-7 min-w-[760px]">
        {days.map((day, i) => {
          const key = iso(day);
          const dayTasks = tasks.filter(t => t.date === key).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
          const isToday = key === today;
          return (
            <div key={key} data-testid={`cal-week-day-${key}`} className={`border-l border-border/40 min-h-[180px] ${isToday ? "bg-primary/5" : ""}`}>
              <div className="px-2 py-1.5 border-b border-border/40 sticky top-0 bg-card">
                <p className="text-[11px] font-medium text-foreground">{WEEKDAYS_SHORT[i]}</p>
                <p className={`text-xs ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day.getDate()}.{day.getMonth() + 1}.</p>
              </div>
              <div className="p-1 space-y-1">
                {dayTasks.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground py-1 text-center">—</p>
                ) : (
                  dayTasks.map(t => <TaskBlock key={t.id} task={t} empName={empName} custName={custName} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Månedsvisning: 6×7 gitter ──
function MonthView({ cursor, tasks, empName, custName }: { cursor: Date; tasks: Task[]; empName: (id?: number | null) => string; custName: (id?: number | null) => string }) {
  const first = startOfMonth(cursor);
  const startOffset = (first.getDay() + 6) % 7; // mandag = 0
  const gridStart = addDays(first, -startOffset);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  const today = iso(new Date());

  return (
    <div data-testid="cal-month-view">
      <div className="grid grid-cols-7 border-b border-border/40">
        {WEEKDAYS_SHORT.map(w => <div key={w} className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const key = iso(day);
          const dayTasks = tasks.filter(t => t.date === key);
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = key === today;
          return (
            <div key={key} data-testid={`cal-month-day-${key}`} className={`border-b border-r border-border/30 min-h-[88px] p-1 ${inMonth ? "bg-card" : "bg-muted/20"} ${isToday ? "ring-1 ring-primary ring-inset" : ""}`}>
              <p className={`text-[10px] ${inMonth ? "text-muted-foreground" : "text-muted-foreground/50"} ${isToday ? "text-primary font-bold" : ""}`}>{day.getDate()}</p>
              <div className="space-y-0.5 mt-0.5">
                {dayTasks.slice(0, 3).map(t => <TaskBlock key={t.id} task={t} empName={empName} custName={custName} compact />)}
                {dayTasks.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} flere</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Assistent: Mine opgaver med detaljevisning
// ═══════════════════════════════════════════════════════════════

type TaskSession = {
  id: number;
  companyId: number;
  taskId: number;
  employeeId: number | null;
  userId: number;
  status: "aktiv" | "pauset" | "afsluttet";
  startedAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  pauseReason: string | null;
  totalPauseMinutes: number;
  durationMinutes: number | null;
  endedAt: string | null;
  createdAt: string;
};

const invalidateSessions = () => {
  queryClient.invalidateQueries({ queryKey: ["/api/task-sessions", "active"] });
  queryClient.invalidateQueries({ queryKey: ["/api/task-sessions"] });
  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
};

function useActiveSessions() {
  return useQuery<TaskSession[]>({
    queryKey: ["/api/task-sessions", "active"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/task-sessions/active");
      return res.json();
    },
  });
}

function MineOpgaver() {
  const { companyId } = useAuth();
  const { data: tasks, isLoading } = useTasks(companyId);
  const { data: customers } = useCustomers(companyId);
  const { data: activeSessions } = useActiveSessions();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const startMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("POST", "/api/task-sessions/start", { taskId });
      return res.json();
    },
    onSuccess: invalidateSessions,
  });

  if (selectedTask) {
    return <OpgaveDetalje task={selectedTask} onBack={() => setSelectedTask(null)} customers={customers || []} />;
  }

  const custName = (id?: number | null) => customers?.find(c => c.id === id)?.name || "Ingen kunde";
  const custAddress = (id?: number | null) => customers?.find(c => c.id === id)?.address || "";
  const sessionForTask = (taskId: number) => activeSessions?.find(s => s.taskId === taskId);

  return (
    <div className="p-4 pb-24 space-y-3 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Drift"
        title="Mine opgaver"
        description="Dine tildelte rengøringsopgaver"
      />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}</div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Du har ingen tildelte opgaver</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const session = sessionForTask(task.id);
            const isActive = session?.status === "aktiv" || session?.status === "pauset";
            return (
              <div key={task.id}
                data-testid={`card-mine-opgave-${task.id}`}
                className="rounded-md border border-border/50 bg-card p-4 space-y-3 hover:border-primary/50 transition-colors">
                <button
                  onClick={() => setSelectedTask(task)}
                  data-testid={`button-open-opgave-${task.id}`}
                  className="w-full text-left space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isActive && (
                        <span className="relative flex h-2 w-2 shrink-0" data-testid={`indicator-active-${task.id}`}>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                      <h3 className="font-medium text-sm text-foreground truncate">{task.title}</h3>
                    </div>
                    <StatusChip status={statusLabel(task.status)} variant={statusVariant(task.status)} />
                  </div>
                  {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{task.date}</span>
                    {task.startTime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{task.startTime}{task.endTime && `-${task.endTime}`}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{custName(task.customerId)}</span>
                    {custAddress(task.customerId) && <span className="truncate opacity-70">· {custAddress(task.customerId)}</span>}
                  </div>
                </button>
                {task.status === "planlagt" && !isActive && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => startMutation.mutate(task.id)}
                    disabled={startMutation.isPending}
                    data-testid={`button-quick-start-${task.id}`}>
                    <Play className="w-4 h-4 mr-1.5" />
                    Start opgave
                  </Button>
                )}
                {isActive && session && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3.5 h-3.5" />
                      {session.status === "pauset" ? "På pause" : "I gang"}
                    </span>
                    <button
                      onClick={() => setSelectedTask(task)}
                      data-testid={`button-open-active-${task.id}`}
                      className="text-primary hover:underline">
                      Åbn detaljer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Opgavedetalje for assistent
// ═══════════════════════════════════════════════════════════════

function OpgaveDetalje({ task, onBack, customers }: { task: Task; onBack: () => void; customers: Customer[] }) {
  const customer = customers.find(c => c.id === task.customerId);

  // Aktiv session for aktuel bruger
  const { data: activeSessions } = useActiveSessions();
  const activeSession = (activeSessions || []).find(s => s.taskId === task.id) || null;

  // Sessionhistorik for denne opgave
  const { data: taskSessions } = useQuery<TaskSession[]>({
    queryKey: ["/api/task-sessions", { taskId: task.id }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/task-sessions?taskId=${task.id}`);
      return res.json();
    },
  });

  const endedSessions = (taskSessions || []).filter(s => s.status === "afsluttet");
  const totalMinutes = endedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  // Notater
  const { data: notes, isLoading: notesLoading } = useQuery<any[]>({ queryKey: ["/api/tasks", task.id, "notes"], queryFn: async () => {
    const res = await apiRequest("GET", `/api/tasks/${task.id}/notes`);
    return res.json();
  }});

  const noteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await apiRequest("POST", `/api/tasks/${task.id}/notes`, { note });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "notes"] }),
  });

  const [noteText, setNoteText] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [now, setNow] = useState(Date.now());

  // Live-timer: opdater hvert sekund når der er en aktiv session
  useEffect(() => {
    if (!activeSession || activeSession.status !== "aktiv") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status]);

  // Beregn forløbet tid (ms) for den nuværende session
  const elapsedMs = useMemo(() => {
    if (!activeSession) return 0;
    const startedAt = new Date(activeSession.startedAt).getTime();
    const pauseMs = (activeSession.totalPauseMinutes || 0) * 60000;
    if (activeSession.status === "pauset" && activeSession.pausedAt) {
      return Math.max(0, new Date(activeSession.pausedAt).getTime() - startedAt - pauseMs);
    }
    if (activeSession.status === "aktiv") {
      return Math.max(0, now - startedAt - pauseMs);
    }
    return 0;
  }, [activeSession, now]);

  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

  // Samlet pausetid (inkl. igangværende pause)
  const totalPauseMs = useMemo(() => {
    if (!activeSession) return 0;
    let ms = (activeSession.totalPauseMinutes || 0) * 60000;
    if (activeSession.status === "pauset" && activeSession.pausedAt) {
      ms += Math.max(0, now - new Date(activeSession.pausedAt).getTime());
    }
    return ms;
  }, [activeSession, now]);
  const totalPauseMinutes = Math.floor(totalPauseMs / 60000);

  // Mutations
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/task-sessions/start", { taskId: task.id });
      return res.json();
    },
    onSuccess: invalidateSessions,
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) return;
      const res = await apiRequest("POST", `/api/task-sessions/${activeSession.id}/pause`, { reason: pauseReason.trim() || undefined });
      return res.json();
    },
    onSuccess: () => { invalidateSessions(); setPauseReason(""); },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) return;
      const res = await apiRequest("POST", `/api/task-sessions/${activeSession.id}/resume`);
      return res.json();
    },
    onSuccess: invalidateSessions,
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) return;
      const res = await apiRequest("POST", `/api/task-sessions/${activeSession.id}/end`);
      return res.json();
    },
    onSuccess: invalidateSessions,
  });

  const routeUrl = customer?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}`
    : null;

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await noteMutation.mutateAsync(noteText.trim());
    setNoteText("");
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleString("da-DK", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-4 pb-24 space-y-3 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-opgaver">
        <ArrowLeft className="w-4 h-4" />
        Tilbage til opgaver
      </button>

      <div className="rounded-md border border-border/50 bg-card p-3 space-y-3" data-testid={`card-opgave-detalje-${task.id}`}>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold text-foreground">{task.title}</h1>
          <StatusChip status={statusLabel(task.status)} variant={statusVariant(task.status)} />
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <StatusChip status={priorityLabel(task.priority)} variant={priorityVariant(task.priority)} />
          {task.recurrence !== "ingen" && (
            <Badge variant="secondary" className="text-[10px] gap-1"><Repeat className="w-3 h-3" />{recurrenceLabel(task.recurrence)}</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {task.date}
          </div>
          {task.startTime && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {task.startTime}{task.endTime && `-${task.endTime}`}
            </div>
          )}
        </div>

        {customer && (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{customer.name}</p>
                {customer.address && <p className="text-muted-foreground">{customer.address}</p>}
                {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              </div>
            </div>
            {routeUrl && (
              <a href={routeUrl} target="_blank" rel="noopener noreferrer" data-testid="link-route">
                <Button variant="outline" size="sm" className="w-full">
                  <Navigation className="w-4 h-4 mr-1.5" />
                  Start rute til kunde
                </Button>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Opgaveforløb */}
      <div className="rounded-md border border-border/50 bg-card p-3 space-y-3" data-testid="card-opgave-tid">
        <h2 className="font-medium text-sm text-foreground flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Opgaveforløb
        </h2>

        {!activeSession ? (
          <div className="space-y-2">
            {totalMinutes > 0 && (
              <p className="text-xs text-muted-foreground">Samlet registreret: {formatDuration(totalMinutes)}</p>
            )}
            {task.status === "færdig" ? (
              <p className="text-xs text-muted-foreground">Opgaven er markeret som færdig.</p>
            ) : (
              <Button
                onClick={() => startMutation.mutate()}
                size="sm"
                className="w-full"
                disabled={startMutation.isPending}
                data-testid="button-start-opgave">
                <Play className="w-4 h-4 mr-1.5" />
                Start opgave
              </Button>
            )}
          </div>
        ) : activeSession.status === "aktiv" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Session aktiv
              </p>
              <span className="text-lg font-bold tabular-nums text-foreground" data-testid="text-live-timer">
                {String(elapsedMinutes).padStart(2, "0")}:{String(elapsedSeconds).padStart(2, "0")}
              </span>
            </div>

            {totalPauseMinutes > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid="text-pause-total">
                <Coffee className="w-3.5 h-3.5" />
                Samlet pausetid: {formatDuration(totalPauseMinutes)}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pauseReason" className="text-xs">Pauseresultat (valgfrit)</Label>
              <Input
                id="pauseReason"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="F.eks. frokost, materialemangel..."
                data-testid="input-pause-reason"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => pauseMutation.mutate()}
                variant="outline"
                size="sm"
                disabled={pauseMutation.isPending}
                data-testid="button-pause-opgave">
                <Pause className="w-4 h-4 mr-1.5" />
                Melde pause
              </Button>
              <Button
                onClick={() => endMutation.mutate()}
                variant="destructive"
                size="sm"
                disabled={endMutation.isPending}
                data-testid="button-end-opgave">
                <Square className="w-4 h-4 mr-1.5" />
                Slut opgave
              </Button>
            </div>
          </div>
        ) : (
          // Pauset
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Coffee className="w-4 h-4" />
                På pause
              </p>
              <span className="text-lg font-bold tabular-nums text-foreground" data-testid="text-frozen-timer">
                {String(elapsedMinutes).padStart(2, "0")}:{String(elapsedSeconds).padStart(2, "0")}
              </span>
            </div>

            {activeSession.pauseReason && (
              <p className="text-xs text-muted-foreground" data-testid="text-pause-reason">
                Årsag: {activeSession.pauseReason}
              </p>
            )}

            <p className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid="text-pause-total-paused">
              <Coffee className="w-3.5 h-3.5" />
              Samlet pausetid: {formatDuration(totalPauseMinutes)}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => resumeMutation.mutate()}
                size="sm"
                disabled={resumeMutation.isPending}
                data-testid="button-resume-opgave">
                <Play className="w-4 h-4 mr-1.5" />
                Genoptag
              </Button>
              <Button
                onClick={() => endMutation.mutate()}
                variant="destructive"
                size="sm"
                disabled={endMutation.isPending}
                data-testid="button-end-opgave-paused">
                <Square className="w-4 h-4 mr-1.5" />
                Slut opgave
              </Button>
            </div>
          </div>
        )}

        {endedSessions.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border/50" data-testid="list-session-history">
            <p className="text-xs font-medium text-foreground mb-1">Sessionhistorik</p>
            {endedSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground" data-testid={`text-session-${s.id}`}>
                <span>{fmtTime(s.startedAt)}</span>
                <span className="tabular-nums">{formatDuration(s.durationMinutes || 0)}</span>
                {(s.totalPauseMinutes || 0) > 0 && <span className="text-[10px] opacity-70">(pause {formatDuration(s.totalPauseMinutes)})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notater */}
      <div className="rounded-md border border-border/50 bg-card p-3 space-y-3" data-testid="card-opgave-noter">
        <h2 className="font-medium text-sm text-foreground flex items-center gap-1.5">
          <StickyNote className="w-4 h-4" />
          Notater
        </h2>
        {notesLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : !notes || notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ingen notater endnu</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="bg-muted/50 rounded-lg p-3 text-sm" data-testid={`text-note-${note.id}`}>
                <p className="text-foreground">{note.note}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(note.createdAt).toLocaleString("da-DK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Skriv et notat..."
            data-testid="input-note"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
          />
          <Button onClick={handleAddNote} size="sm" disabled={!noteText.trim() || noteMutation.isPending} data-testid="button-add-note">
            Tilføj
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Task form (used by leder)
// ═══════════════════════════════════════════════════════════════

function TaskForm({ task, employees, customers, onSubmit }: {
  task: Task | null;
  employees: any[];
  customers: any[];
  onSubmit: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    customerId: task?.customerId?.toString() || "",
    employeeId: task?.employeeId?.toString() || "",
    date: task?.date || todayStr(),
    startTime: task?.startTime || "",
    endTime: task?.endTime || "",
    status: task?.status || "planlagt",
    priority: task?.priority || "normal",
    recurrence: task?.recurrence || "ingen",
    recurrenceEndDate: task?.recurrenceEndDate || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      ...form,
      customerId: form.customerId ? Number(form.customerId) : null,
      employeeId: form.employeeId ? Number(form.employeeId) : null,
      recurrenceEndDate: form.recurrenceEndDate || null,
    });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="title">Titel *</Label>
        <Input id="title" data-testid="input-task-title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea id="description" data-testid="input-task-description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kunde</Label>
          <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
            <SelectTrigger data-testid="select-task-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ansæt</Label>
          <Select value={form.employeeId} onValueChange={(v) => set("employeeId", v)}>
            <SelectTrigger data-testid="select-task-employee"><SelectValue placeholder="Vælg ansæt" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Dato *</Label>
          <Input id="date" type="date" data-testid="input-task-date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Start</Label>
          <Input id="startTime" type="time" data-testid="input-task-start" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">Slut</Label>
          <Input id="endTime" type="time" data-testid="input-task-end" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger data-testid="select-task-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioritet</Label>
          <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{priorityLabel(p)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Gentag</Label>
          <Select value={form.recurrence} onValueChange={(v) => set("recurrence", v)}>
            <SelectTrigger data-testid="select-task-recurrence"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECURRENCES.map(r => <SelectItem key={r} value={r}>{recurrenceLabel(r)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {form.recurrence !== "ingen" && (
        <div className="space-y-1.5">
          <Label htmlFor="recurrenceEndDate">Gentag indtil</Label>
          <Input id="recurrenceEndDate" type="date" data-testid="input-task-recurrence-end" value={form.recurrenceEndDate} onChange={(e) => set("recurrenceEndDate", e.target.value)} />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={submitting} data-testid="button-save-task">
        {submitting ? "Gemmer..." : "Gem opgave"}
      </Button>
    </form>
  );
}

function AiAutoSchedulePanel({ companyId }: { companyId: number }) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['/api/ai/assist', 'auto_schedule', companyId],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/ai/assist', { contextType: 'auto_schedule', companyId });
      return res.json();
    },
  });

  return (
    <div data-testid="panel-ai-auto-schedule">
      <SectionCard
        title="AI auto-planlægning"
        icon={<Sparkles className="w-4 h-4" />}
        action={
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-ai-generate-schedule">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Planlægger...' : 'Opdater'}
          </Button>
        }
      >
        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : data?.assignments?.length > 0 ? (
            <>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table className="table-premium">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opgave</TableHead>
                      <TableHead>Foreslået ansat</TableHead>
                      <TableHead>Begrundelse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assignments.map((a: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium" data-testid={`text-ai-task-${i}`}>{a.taskTitle}</TableCell>
                        <TableCell className="text-sm" data-testid={`text-ai-employee-${i}`}>
                          {a.employeeName ? (
                            <Badge variant="outline" className="text-green-600">{a.employeeName}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600">Ingen ledig</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground" data-testid={`text-ai-reason-${i}`}>{a.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-ai-schedule-summary">{data.summary}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-ai-no-tasks">Alle opgaver er allerede tildelt ansatte. Godt arbejde!</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, CheckCircle2, ClipboardList, QrCode, Calendar, MapPin, Camera } from "lucide-react";

// ── Typer ──
interface Task {
  id: number;
  companyId: number;
  title: string;
  customerId: number | null;
  employeeId: number | null;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null;
  status: string; // planlagt, igang, færdig, aflyst
  priority: string;
  description: string | null;
}
interface TimeEntry {
  id: number;
  companyId: number;
  employeeId: number;
  taskId: number | null;
  date: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  note: string | null;
}
interface QRCheckin {
  id: number;
  companyId: number;
  customerId: number;
  customerLocationId: number | null;
  taskId: number | null;
  employeeId: number;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}
interface Customer {
  id: number;
  name: string;
  address: string | null;
}
interface ChecklistExecution {
  id: number;
  companyId: number;
  checklistId: number;
  taskId: number | null;
  employeeId: number;
  executedAt: string;
  results: string;
  completedCount: number;
  totalCount: number;
  notes: string | null;
  createdAt: string;
}

// ── Hjælpefunktioner ──
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function todayLabel(): string {
  return new Date().toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dkTime(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

/** Varighed fra checkInTime til nu, format "Xt Ym". */
function activeDuration(checkInTime: string | null): string {
  if (!checkInTime) return "—";
  const start = new Date(checkInTime).getTime();
  const end = Date.now();
  if (isNaN(start) || end < start) return "—";
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}t ${m}m` : `${m}m`;
}

const TASK_STATUS_LABEL: Record<string, string> = {
  planlagt: "Planlagt",
  igang: "I gang",
  færdig: "Færdig",
  aflyst: "Aflyst",
};

function TaskStatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "færdig"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : s === "igang"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : s === "aflyst"
          ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  return <Badge className={cls}>{TASK_STATUS_LABEL[s] ?? status}</Badge>;
}

// ── Komponent ──
export default function DagensArbejde({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const employeeId = user?.employeeId ?? null;
  const today = todayStr();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/tasks?companyId=${companyId}`)).json(),
  });

  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/time-entries?companyId=${companyId}`)).json(),
  });

  const { data: activeCheckins = [] } = useQuery<QRCheckin[]>({
    queryKey: ["/api/qr-checkins/active", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const res = await apiRequest("GET", `/api/qr-checkins/active/${employeeId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employeeId,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const { data: executions = [] } = useQuery<ChecklistExecution[]>({
    queryKey: ["/api/checklist-executions", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/checklist-executions?companyId=${companyId}`)).json(),
  });

  // ── Afledte data ──
  const customerName = useMemo(() => {
    const map = new Map<number, string>();
    customers.forEach((c) => map.set(c.id, c.name));
    return (id: number | null | undefined) => (id ? map.get(id) ?? "Ukendt kunde" : "Ingen kunde");
  }, [customers]);

  const customerAddress = useMemo(() => {
    const map = new Map<number, string | null>();
    customers.forEach((c) => map.set(c.id, c.address ?? null));
    return (id: number | null | undefined) => (id ? map.get(id) ?? null : null);
  }, [customers]);

  const myTasksToday = useMemo(
    () => tasks.filter((t) => t.employeeId === employeeId && t.date === today && t.status !== "aflyst"),
    [tasks, employeeId, today],
  );

  const totalMinutesToday = useMemo(
    () =>
      timeEntries
        .filter((e) => e.employeeId === employeeId && e.date === today)
        .reduce((sum, e) => {
          if (e.durationMinutes) return sum + e.durationMinutes;
          if (!e.endTime && e.startTime) {
            const [h, m] = e.startTime.split(":").map(Number);
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
            return sum + Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
          }
          return sum;
        }, 0),
    [timeEntries, employeeId, today],
  );

  const totalHours = (totalMinutesToday / 60).toFixed(1).replace(".", ",");
  const activeCheckin = activeCheckins.length > 0 ? activeCheckins[0] : null;

  const todayExecutions = useMemo(
    () =>
      executions.filter((e) => {
        const d = new Date(e.executedAt);
        return !isNaN(d.getTime()) && d.toISOString().split("T")[0] === today;
      }),
    [executions, today],
  );

  const stats = [
    { label: "Opgaver i dag", value: String(myTasksToday.length), icon: ClipboardList },
    { label: "Timer i dag", value: `${totalHours}t`, icon: Clock },
    { label: "Aktive tjeklister", value: String(todayExecutions.length), icon: CheckCircle2 },
    { label: "Aktiv check-in", value: activeCheckin ? "Ja" : "Nej", icon: QrCode },
  ];

  const goTo = (path: string) => navigate(path);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Dagens arbejde</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="capitalize">{todayLabel()}</span>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                </div>
                <span className="text-lg font-semibold text-foreground">{s.value}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Aktiv check-in */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-foreground">Aktiv check-in</h2>
            </div>
            {activeCheckin ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Kunde: <span className="font-medium text-foreground">{customerName(activeCheckin.customerId)}</span></span>
                <span>Tjekket ind: <span className="font-medium text-foreground">{dkTime(activeCheckin.checkInTime)}</span></span>
                <span>Varighed: <span className="font-medium text-foreground">{activeDuration(activeCheckin.checkInTime)}</span></span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Du har ingen aktiv check-in.</p>
            )}
          </div>
          {activeCheckin ? (
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="goto-qr-checkin-active" onClick={() => goTo("#/qr-checkin")}>
              <QrCode className="mr-2 h-4 w-4" />Gå til QR Check-in
            </Button>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="checkin-start" onClick={() => goTo("#/qr-checkin")}>
              <QrCode className="mr-2 h-4 w-4" />Tjek ind
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dagens opgaver */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-foreground">Dagens opgaver</h2>
            <Badge variant="secondary" className="ml-1">{myTasksToday.length}</Badge>
          </div>

          {tasksLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Indlæser opgaver…</p>
          ) : myTasksToday.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ingen opgaver tildelt dig i dag.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opgave</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Tidspunkt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lokation</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTasksToday.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-foreground">{t.title}</TableCell>
                      <TableCell className="text-muted-foreground">{customerName(t.customerId)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.startTime ? `${t.startTime}${t.endTime ? ` – ${t.endTime}` : ""}` : "—"}
                      </TableCell>
                      <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-muted-foreground">
                        {customerAddress(t.customerId) ? (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{customerAddress(t.customerId)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" data-testid={`task-time-${t.id}`} onClick={() => goTo("#/tidsregistrering")}>
                            <Clock className="mr-1 h-3 w-3" />Start tidsregistrering
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`task-checklist-${t.id}`} onClick={() => goTo("#/tjeklister-lokation")}>
                            <ClipboardList className="mr-1 h-3 w-3" />Se tjekliste
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tjeklister i dag */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-foreground">Tjeklister i dag</h2>
            <Badge variant="secondary" className="ml-1">{todayExecutions.length}</Badge>
          </div>
          {todayExecutions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ingen tjekliste-udførelser registreret i dag.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tidspunkt</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Fremgang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayExecutions.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground">{dkTime(e.executedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {customerName(tasks.find((t) => t.id === e.taskId)?.customerId ?? null)}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{e.completedCount}/{e.totalCount}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hurtige handlinger */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-foreground">Hurtige handlinger</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button variant="outline" className="flex flex-col items-center gap-2 py-6" data-testid="quick-qr-checkin" onClick={() => goTo("#/qr-checkin")}>
              <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="text-sm">QR Check-in</span>
            </Button>
            <Button variant="outline" className="flex flex-col items-center gap-2 py-6" data-testid="quick-tidsregistrering" onClick={() => goTo("#/tidsregistrering")}>
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="text-sm">Tidsregistrering</span>
            </Button>
            <Button variant="outline" className="flex flex-col items-center gap-2 py-6" data-testid="quick-opgaver" onClick={() => goTo("#/opgaver")}>
              <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="text-sm">Opgaver</span>
            </Button>
            <Button variant="outline" className="flex flex-col items-center gap-2 py-6" data-testid="quick-tjeklister" onClick={() => goTo("#/tjeklister-lokation")}>
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="text-sm">Tjeklister</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

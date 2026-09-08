import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { AiGate } from "@/components/ai-lock";
import { useTasks, useTimeEntries, useEmployees, useCustomers, useNotifications, useInvoices, statusLabel, priorityLabel, formatDuration, recurrenceLabel, todayStr } from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, AlertTriangle, ClipboardList, Sparkles, CheckCircle, RefreshCw, Copy, TrendingUp, Calendar, Timer, CalendarClock, Bell, Settings2, ArrowUp, ArrowDown, Users, Building2, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";

type ChipVariant = "primary" | "blue" | "amber" | "green" | "red" | "gray";

/** Oversætter en opgavestatus til en StatusChip-variant. */
function statusVariant(status: string): ChipVariant {
  const map: Record<string, ChipVariant> = {
    planlagt: "blue", igang: "amber", "færdig": "green", aflyst: "red",
    ledig: "green", optaget: "amber", orlov: "gray", kladde: "gray", sendt: "blue", betalt: "green",
  };
  return map[status] || "gray";
}

/** Oversætter en prioritetsværdi til en StatusChip-variant. */
function priorityVariant(p: string): ChipVariant {
  const map: Record<string, ChipVariant> = { høj: "red", normal: "blue", lav: "gray" };
  return map[p] || "gray";
}

/** Viser en dato som "14. aug. 2026" i stedet for det rå ISO-format. */
function kortDato(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════
// Widget-katalog — definerer hvilke widgets der kan vises på dashboardet
// ═══════════════════════════════════════════════════════════════

type WidgetKey =
  | "today_tasks"
  | "active_timers"
  | "upcoming"
  | "revenue_today"
  | "active_customers"
  | "employee_overview"
  | "ai_analysis"
  | "ai_lead_scoring"
  | "ai_inquiry";

const WIDGET_CATALOG: { key: WidgetKey; label: string; description: string }[] = [
  { key: "today_tasks", label: "Dagens opgaver", description: "Opgaver planlagt til i dag" },
  { key: "active_timers", label: "Aktive tidsmålere", description: "Kørende tidsmålere lige nu" },
  { key: "upcoming", label: "Kommende opgaver", description: "Planlagte opgaver fremover" },
  { key: "revenue_today", label: "Omsætning i dag", description: "Faktureret beløb for i dag" },
  { key: "active_customers", label: "Antal aktive kunder", description: "Samlet antal kunder" },
  { key: "employee_overview", label: "Medarbejder oversigt", description: "Status for ansatte" },
  { key: "ai_analysis", label: "AI-analyse", description: "Faktureringsrisiko vurderet af AI" },
  { key: "ai_lead_scoring", label: "AI lead-scoring", description: "Vurdering af kundes potentiale" },
  { key: "ai_inquiry", label: "AI kundehenvendelser", description: "Generer svareforslag" },
];

const DEFAULT_WIDGETS: { widgetType: WidgetKey; visible: boolean }[] = [
  { widgetType: "today_tasks", visible: true },
  { widgetType: "active_timers", visible: true },
  { widgetType: "upcoming", visible: true },
  { widgetType: "revenue_today", visible: false },
  { widgetType: "active_customers", visible: false },
  { widgetType: "employee_overview", visible: false },
  { widgetType: "ai_analysis", visible: true },
  { widgetType: "ai_lead_scoring", visible: true },
  { widgetType: "ai_inquiry", visible: true },
];

type WidgetPref = { id?: number; widgetType: WidgetKey; position: number; visible: number; config?: string };

export default function Dashboard() {
  const { companyId, user } = useAuth();
  const isAssistent = user?.role === "assistent";
  const { data: tasks, isLoading: tLoading } = useTasks(companyId);
  const { data: timeEntries, isLoading: teLoading } = useTimeEntries(companyId);
  const { data: employees, isLoading: eLoading } = useEmployees(companyId);
  const { data: customers } = useCustomers(companyId);
  const { data: invoices } = useInvoices(companyId);
  const { data: notifs } = useNotifications(companyId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Widget-præferencer (fra backend) ──
  const { data: widgetPrefs } = useQuery<WidgetPref[]>({
    queryKey: ["/api/dashboard-widgets", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/dashboard-widgets")).json(),
  });

  // Sammensæt den rækkefølge, der skal bruges — backend-værdier hvis de findes,
  // ellers standardkataloget. Dette sikrer at nye widgets altid er tilgængelige.
  const orderedWidgets: WidgetKey[] = useMemo(() => {
    if (widgetPrefs && widgetPrefs.length > 0) {
      const sorted = [...widgetPrefs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const present = new Set<WidgetKey>(sorted.map((w) => w.widgetType as WidgetKey));
      const missing = WIDGET_CATALOG.filter((c) => !present.has(c.key)).map((c) => c.key);
      return [...sorted.map((w) => w.widgetType as WidgetKey), ...missing];
    }
    return DEFAULT_WIDGETS.map((w) => w.widgetType);
  }, [widgetPrefs]);

  const isVisible = (key: WidgetKey): boolean => {
    const pref = widgetPrefs?.find((w) => w.widgetType === key);
    if (!pref) return DEFAULT_WIDGETS.find((w) => w.widgetType === key)?.visible ?? false;
    return pref.visible === 1;
  };

  const visibleWidgets = orderedWidgets.filter((k) => isVisible(k)).filter((k) => {
    // Assistent skal ikke se AI-moduler
    if (isAssistent && (k === "ai_analysis" || k === "ai_lead_scoring" || k === "ai_inquiry")) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async (widgets: { widgetType: string; position: number; visible: boolean }[]) =>
      (await apiRequest("POST", "/api/dashboard-widgets", widgets)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-widgets"] });
      toast({ title: "Dashboard opdateret" });
      setSettingsOpen(false);
    },
    onError: (e: Error) => toast({ title: "Kunne ikke gemme", description: e.message, variant: "destructive" }),
  });

  if (tLoading || teLoading || eLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  const today = todayStr();
  const todayTasks = tasks?.filter(t => t.date === today) || [];
  const activeTasks = tasks?.filter(t => t.status === "igang") || [];
  const completedToday = tasks?.filter(t => t.status === "færdig" && t.date === today) || [];
  const activeTimers = timeEntries?.filter(t => !t.endTime) || [];
  const completedEntries = timeEntries?.filter(t => t.durationMinutes && t.date === today) || [];
  const totalMinutesToday = completedEntries.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const unreadNotifs = notifs?.filter(n => !n.read).length || 0;
  const activeEmployees = employees?.filter(e => e.status === "optaget").length || 0;
  const dateString = new Date(today + "T00:00:00").toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Omsætning i dag: sum af fakturabeløb med dagens dato
  const revenueToday = (invoices || []).filter(i => i.issueDate === today).reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{dateString}</p>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="button-customize-dashboard">
          <Settings2 className="w-4 h-4 mr-1.5" />
          Tilpas dashboard
        </Button>
      </div>

      {/* Compact stat strip — altid synlig */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-md overflow-hidden">
        <div className="bg-card px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Opgaver i dag</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <p data-testid="text-stat-opgaver-i-dag" className="text-lg font-bold">{todayTasks.length}</p>
            <span className="text-[11px] text-muted-foreground">{completedToday.length} færdig</span>
          </div>
        </div>
        <div className="bg-card px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Aktive opgaver</span>
          </div>
          <p data-testid="text-stat-aktive-opgaver" className="text-lg font-bold mt-0.5">{activeTasks.length}</p>
        </div>
        <div className="bg-card px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Timer i dag</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <p data-testid="text-stat-afsluttede-timer-i-dag" className="text-lg font-bold">{formatDuration(totalMinutesToday)}</p>
            <span className="text-[11px] text-muted-foreground">{activeTimers.length} aktive</span>
          </div>
        </div>
        <div className="bg-card px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Notifikationer</span>
          </div>
          <p data-testid="text-stat-ulaeste-notifikationer" className="text-lg font-bold mt-0.5">{unreadNotifs}</p>
        </div>
      </div>

      {/* Tilpassede widgets */}
      {visibleWidgets.length === 0 ? (
        <div className="rounded-md border border-border/50 bg-card p-8 text-center">
          <Settings2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Ingen widgets er slået til. Klik på "Tilpas dashboard" for at vælge widgets.</p>
        </div>
      ) : (
        <>
          {/* Første række: listewidgets i 3 kolonner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {visibleWidgets.includes("today_tasks") && (
              <SectionCard title="Dagens opgaver" noPadding action={<Link href="/opgaver" className="text-[11px] text-primary hover:underline">Se alle</Link>}>
                <div className="divide-y divide-border/50">
                  {todayTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Ingen opgaver i dag</p>
                  ) : (
                    todayTasks.slice(0, 6).map((task) => {
                      const emp = employees?.find(e => e.id === task.employeeId);
                      const cust = customers?.find(c => c.id === task.customerId);
                      return (
                        <div key={task.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === 'igang' ? 'bg-amber-500' : task.status === 'færdig' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                            <p className="text-[11px] text-muted-foreground">{task.startTime}{task.endTime ? `-${task.endTime}` : ""}{emp && ` • ${emp.name}`}</p>
                          </div>
                          {cust && <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[100px]">{cust.name}</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>
            )}

            {visibleWidgets.includes("active_timers") && (
              <SectionCard title="Aktive tidsmålere" noPadding action={<Link href="/tidregistrering" className="text-[11px] text-primary hover:underline">Se alle</Link>}>
                <div className="divide-y divide-border/50">
                  {activeTimers.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Ingen aktive tidsmålere</p>
                  ) : (
                    activeTimers.slice(0, 6).map((timer) => {
                      const emp = employees?.find(e => e.id === timer.employeeId);
                      const startMs = new Date(`${timer.date}T${timer.startTime}:00`).getTime();
                      let elapsed = Math.floor((now - startMs) / 60000);
                      if (elapsed < 0) elapsed = 0;
                      return (
                        <div key={timer.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{emp?.name || "Ukendt"}</p>
                            <p className="text-[11px] text-muted-foreground">Startet {timer.startTime}</p>
                          </div>
                          <span className="text-xs font-medium text-foreground shrink-0">{formatDuration(elapsed)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>
            )}

            {visibleWidgets.includes("upcoming") && (
              <SectionCard title="Kommende opgaver" noPadding>
                <div className="divide-y divide-border/50">
                  {(tasks || []).filter(t => t.status === "planlagt").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((task) => {
                    const emp = employees?.find(e => e.id === task.employeeId);
                    const cust = customers?.find(c => c.id === task.customerId);
                    return (
                      <div key={task.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.priority === 'høj' ? 'bg-red-500' : task.priority === 'normal' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground">{kortDato(task.date)}{task.startTime ? ` kl. ${task.startTime}` : ""}{emp && ` • ${emp.name}`}</p>
                        </div>
                        {cust && <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[100px]">{cust.name}</span>}
                      </div>
                    );
                  })}
                  {tasks?.filter(t => t.status === "planlagt").length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">Ingen kommende opgaver</p>
                  )}
                </div>
              </SectionCard>
            )}

            {visibleWidgets.includes("revenue_today") && (
              <SectionCard title="Omsætning i dag" icon={<Banknote className="w-4 h-4" />}>
                <div className="space-y-2">
                  <p data-testid="text-revenue-today" className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(revenueToday)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(invoices || []).filter(i => i.issueDate === today).length} fakturaer oprettet i dag
                  </p>
                </div>
              </SectionCard>
            )}

            {visibleWidgets.includes("active_customers") && (
              <SectionCard title="Aktive kunder" icon={<Building2 className="w-4 h-4" />}>
                <div className="space-y-2">
                  <p data-testid="text-active-customers" className="text-2xl font-bold text-foreground">{(customers || []).length}</p>
                  <p className="text-xs text-muted-foreground">Samlet antal kunder i systemet</p>
                </div>
              </SectionCard>
            )}

            {visibleWidgets.includes("employee_overview") && (
              <SectionCard title="Medarbejder oversigt" icon={<Users className="w-4 h-4" />} noPadding>
                <div className="divide-y divide-border/50">
                  {(employees || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Ingen ansatte</p>
                  ) : (
                    (employees || []).slice(0, 8).map((emp) => (
                      <div key={emp.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${emp.status === 'optaget' ? 'bg-amber-500' : emp.status === 'ledig' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <p className="text-xs font-medium text-foreground flex-1 truncate">{emp.name}</p>
                        <span className="text-[11px] text-muted-foreground">{statusLabel(emp.status)}</span>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            )}
          </div>

          {/* AI-panels */}
          {visibleWidgets.includes("ai_analysis") && visibleWidgets.includes("ai_lead_scoring") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AiGate label="AI-analyse"><AiDashboardCard companyId={companyId} /></AiGate>
              <AiGate label="AI lead-scoring"><AiLeadScoringPanel companyId={companyId} customers={customers || []} /></AiGate>
            </div>
          )}
          {visibleWidgets.includes("ai_analysis") && !visibleWidgets.includes("ai_lead_scoring") && (
            <AiGate label="AI-analyse"><AiDashboardCard companyId={companyId} /></AiGate>
          )}
          {!visibleWidgets.includes("ai_analysis") && visibleWidgets.includes("ai_lead_scoring") && (
            <AiGate label="AI lead-scoring"><AiLeadScoringPanel companyId={companyId} customers={customers || []} /></AiGate>
          )}
          {visibleWidgets.includes("ai_inquiry") && (
            <AiGate label="AI kundehenvendelser"><AiCustomerInquiryPanel companyId={companyId} customers={customers || []} /></AiGate>
          )}
        </>
      )}

      <DashboardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        orderedWidgets={orderedWidgets.filter((k) => !(isAssistent && (k === "ai_analysis" || k === "ai_lead_scoring" || k === "ai_inquiry")))}
        isVisible={isVisible}
        widgetPrefs={widgetPrefs}
        pending={saveMutation.isPending}
        onSave={(widgets) => saveMutation.mutate(widgets)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Indstillingsdialog — skjul/vis widgets og omord dem
// ═══════════════════════════════════════════════════════════════

function DashboardSettingsDialog({
  open, onOpenChange, orderedWidgets, isVisible, widgetPrefs, pending, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderedWidgets: WidgetKey[];
  isVisible: (key: WidgetKey) => boolean;
  widgetPrefs?: WidgetPref[];
  pending: boolean;
  onSave: (widgets: { widgetType: string; position: number; visible: boolean }[]) => void;
}) {
  const [order, setOrder] = useState<WidgetKey[]>(orderedWidgets);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  // Synkronisér lokal state når dialogen åbnes
  useEffect(() => {
    if (open) {
      setOrder(orderedWidgets);
      const vis: Record<string, boolean> = {};
      for (const w of WIDGET_CATALOG) vis[w.key] = isVisible(w.key);
      setVisibility(vis);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const toggle = (key: WidgetKey, checked: boolean) => {
    setVisibility((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSave = () => {
    onSave(
      order.map((key, idx) => ({
        widgetType: key,
        position: idx,
        visible: visibility[key] ?? false,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tilpas dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Slå widgets til eller fra, og omord dem med pilene. Rækkefølgen bestemmer visningen på dashboardet.</p>
          {order.map((key, idx) => {
            const cat = WIDGET_CATALOG.find((c) => c.key === key)!;
            return (
              <div key={key} className="flex items-center gap-2 rounded-md border border-border/60 p-2.5" data-testid={`row-widget-${key}`}>
                <Checkbox
                  checked={visibility[key] ?? false}
                  onCheckedChange={(v) => toggle(key, v === true)}
                  data-testid={`checkbox-widget-${key}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-30"
                    data-testid={`button-widget-up-${key}`}
                    aria-label="Flyt op"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === order.length - 1}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-30"
                    data-testid={`button-widget-down-${key}`}
                    aria-label="Flyt ned"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-dashboard-settings">Annuller</Button>
          <Button onClick={handleSave} disabled={pending} data-testid="button-save-dashboard-settings">
            {pending ? "Gemmer..." : "Gem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Kompakt AI-kort der viser faktureringsrisiko ved sideindlæsning. */
function AiDashboardCard({ companyId }: { companyId: number }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    riskLevel: "lav" | "medium" | "høj";
    totalOutstanding: number;
    totalOverdue: number;
    unpaidCount: number;
    overdueCount: number;
    insights: string[];
  }>({
    queryKey: ["/api/ai/assist", "fakturering-risk", String(companyId)],
    queryFn: async () =>
      (await apiRequest("POST", "/api/ai/assist", { contextType: "fakturering", intent: "risk", companyId })).json(),
  });

  const riskBadge: Record<string, { label: string; variant: ChipVariant }> = {
    lav: { label: "Lav", variant: "green" },
    medium: { label: "Medium", variant: "amber" },
    høj: { label: "Høj", variant: "red" },
  };
  const risk = data ? (riskBadge[data.riskLevel] ?? riskBadge.lav) : null;
  // Vis de 2 vigtigste insights (forfaldne/risko først).
  const topInsights = data?.insights.slice(0, 2) ?? [];
  const isPositive = (s: string) => /ingen betalingsrisiko|alle fakturaer/i.test(s);

  return (
    <SectionCard
      title="AI-analyse — Faktureringsrisiko"
      icon={<Sparkles className="w-4 h-4" />}
      action={
        <Button size="sm" variant="ghost" data-testid="button-ai-dashboard-refresh" disabled={isFetching} onClick={() => refetch()}>
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      }
      data-testid="panel-ai-dashboard"
    >
      <div className="space-y-3">
        {isLoading || isFetching ? (
          <div className="space-y-2" data-testid="ai-dashboard-loading">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isError || !data ? (
          <p className="text-xs text-muted-foreground" data-testid="text-ai-dashboard-error">
            Analysen kunne ikke hentes.
            <button className="ml-1 underline" data-testid="button-ai-dashboard-retry" onClick={() => refetch()}>Prøv igen</button>
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Risikoniveau:</span>
              <StatusChip status={risk!.label} variant={risk!.variant} data-testid="badge-ai-dashboard-risk" />
            </div>
            {topInsights.length > 0 && (
              <div className="space-y-1" data-testid="block-ai-dashboard-insights">
                {topInsights.map((s, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-dashboard-insight-${i}`}>
                    {isPositive(s)
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />}
                    <span>{s}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI lead-scoring — vurder en kundes potentiale (0-100)
// ═══════════════════════════════════════════════════════════════

type LeadScoreResult = {
  score: number;
  reasons: string[];
  summary?: string;
  recommendations?: string[];
};

function AiLeadScoringPanel({ companyId, customers }: { companyId: number; customers: Customer[] }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const { toast } = useToast();

  const mutation = useMutation<LeadScoreResult, Error, number>({
    mutationFn: async (entityId: number) => {
      const res = await apiRequest("POST", "/api/ai/assist", {
        contextType: "kunde",
        intent: "lead_score",
        companyId,
        entityId,
      });
      return res.json();
    },
  });

  const handleAnalyze = () => {
    if (!selectedId) {
      toast({ title: "Vælg en kunde", description: "Vælg først en kunde i dropdownen." });
      return;
    }
    mutation.mutate(Number(selectedId));
  };

  const score = mutation.data?.score;
  const scoreColor =
    score === undefined ? "bg-muted"
    : score < 40 ? "bg-red-500"
    : score <= 70 ? "bg-amber-500"
    : "bg-emerald-500";
  const scoreText =
    score === undefined ? ""
    : score < 40 ? "Lav"
    : score <= 70 ? "Medium"
    : "Høj";
  const isNegative = (s: string) => /lav|lavere|mindre|mangler|risiko|negativ|lavere margin/i.test(s);

  return (
    <SectionCard
      title="AI lead-scoring"
      icon={<Sparkles className="w-4 h-4" />}
      data-testid="panel-ai-lead-scoring"
    >
      <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="select-ai-lead-customer">Kunde</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger id="select-ai-lead-customer" data-testid="select-ai-lead-customer">
              <SelectValue placeholder="Vælg kunde" />
            </SelectTrigger>
            <SelectContent>
              {customers.length === 0 ? (
                <SelectItem value="__none__" disabled>Ingen kunder</SelectItem>
              ) : (
                customers.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAnalyze} disabled={mutation.isPending || !selectedId} data-testid="button-ai-analyze-lead">
          <TrendingUp className="w-4 h-4 mr-1.5" />
          {mutation.isPending ? "Analyserer..." : "Analyser lead"}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="space-y-2" data-testid="ai-lead-scoring-loading">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {mutation.isError && (
        <p className="text-xs text-destructive" data-testid="text-ai-lead-error">
          Analysen kunne ikke gennemføres.
          <button className="ml-1 underline" data-testid="button-ai-lead-retry" onClick={() => selectedId && mutation.mutate(Number(selectedId))}>Prøv igen</button>
        </p>
      )}

      {mutation.data && (
        <div className="space-y-4">
          {/* Score som bar 0-100 */}
          <div className="space-y-1.5" data-testid="block-ai-lead-score">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Lead-score</span>
              <span className="font-medium text-foreground" data-testid="text-ai-lead-score">{score}/100 ({scoreText})</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreColor}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {mutation.data.summary && (
            <p className="text-sm text-muted-foreground" data-testid="text-ai-lead-summary">{mutation.data.summary}</p>
          )}

          {mutation.data.reasons && mutation.data.reasons.length > 0 && (
            <div className="space-y-1.5" data-testid="block-ai-lead-reasons">
              <p className="text-xs font-medium text-foreground">Begrundelser</p>
              <ul className="space-y-1">
                {mutation.data.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-lead-reason-${i}`}>
                    {isNegative(r)
                      ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      : <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />}
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mutation.data.recommendations && mutation.data.recommendations.length > 0 && (
            <div className="space-y-1.5" data-testid="block-ai-lead-recommendations">
              <p className="text-xs font-medium text-foreground">Anbefalinger</p>
              <ul className="space-y-1">
                {mutation.data.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-lead-recommendation-${i}`}>
                    <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI kundehenvendelse — generer svarforslag ud fra kundeinfo
// ═══════════════════════════════════════════════════════════════

type CustomerInquiryResult = {
  insights: string[];
  summary: string;
};

function AiCustomerInquiryPanel({ companyId, customers }: { companyId: number; customers: Customer[] }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const { toast } = useToast();

  const mutation = useMutation<CustomerInquiryResult, Error, number>({
    mutationFn: async (entityId: number) => {
      const res = await apiRequest("POST", "/api/ai/assist", {
        contextType: "customer_inquiry",
        companyId,
        entityId,
      });
      return res.json();
    },
  });

  const handleGenerate = () => {
    if (!selectedId) {
      toast({ title: "Vælg en kunde", description: "Vælg først en kunde i dropdownen." });
      return;
    }
    mutation.mutate(Number(selectedId));
  };

  const handleCopy = async () => {
    if (!mutation.data?.summary) return;
    try {
      await navigator.clipboard.writeText(mutation.data.summary);
      toast({ title: "Kopieret", description: "Svaret er kopieret til udklipsholderen." });
    } catch {
      toast({ title: "Kunne ikke kopiere", description: "Prøv at markere teksten manuelt.", variant: "destructive" });
    }
  };

  return (
    <SectionCard
      title="AI kundehenvendelse"
      icon={<Sparkles className="w-4 h-4" />}
      data-testid="panel-ai-customer-inquiry"
    >
      <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="select-ai-inquiry-customer">Kunde</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger id="select-ai-inquiry-customer" data-testid="select-ai-inquiry-customer">
              <SelectValue placeholder="Vælg kunde" />
            </SelectTrigger>
            <SelectContent>
              {customers.length === 0 ? (
                <SelectItem value="__none__" disabled>Ingen kunder</SelectItem>
              ) : (
                customers.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={mutation.isPending || !selectedId} data-testid="button-ai-generate-reply">
          <Sparkles className="w-4 h-4 mr-1.5" />
          {mutation.isPending ? "Genererer..." : "Generer svar"}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="space-y-2" data-testid="ai-customer-inquiry-loading">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {mutation.isError && (
        <p className="text-xs text-destructive" data-testid="text-ai-inquiry-error">
          Svaret kunne ikke genereres.
          <button className="ml-1 underline" data-testid="button-ai-inquiry-retry" onClick={() => selectedId && mutation.mutate(Number(selectedId))}>Prøv igen</button>
        </p>
      )}

      {mutation.data && (
        <div className="space-y-4">
          {mutation.data.insights && mutation.data.insights.length > 0 && (
            <div className="space-y-1.5" data-testid="block-ai-inquiry-insights">
              <p className="text-xs font-medium text-foreground">Kundeinfo</p>
              <ul className="space-y-1">
                {mutation.data.insights.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-inquiry-insight-${i}`}>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5" data-testid="block-ai-inquiry-reply">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Foreslået svar</p>
              <Button size="sm" variant="outline" onClick={handleCopy} disabled={!mutation.data.summary} data-testid="button-ai-copy-reply">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Kopier svar
              </Button>
            </div>
            <Textarea
              value={mutation.data.summary}
              readOnly
              rows={6}
              data-testid="textarea-ai-inquiry-reply"
              className="resize-y text-sm"
            />
          </div>
        </div>
      )}
      </div>
    </SectionCard>
  );
}

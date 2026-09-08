import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Check,
  X,
  AlertTriangle,
  Info,
  AlertOctagon,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type TaskStatus = "afventer" | "godkendt" | "afvist";
type TaskSeverity = "lav" | "mellem" | "høj" | "kritisk";

interface AiDriftTask {
  id: number;
  companyId: number;
  title: string;
  description?: string | null;
  type?: string | null;
  severity: TaskSeverity;
  status: TaskStatus;
  createdAt?: string | null;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  afventer: "Afventer",
  godkendt: "Godkendt",
  afvist: "Afvist",
};

const SEVERITY_LABELS: Record<TaskSeverity, string> = {
  lav: "Lav",
  mellem: "Mellem",
  høj: "Høj",
  kritisk: "Kritisk",
};

const SEVERITY_CONFIG: Record<
  TaskSeverity,
  { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Info; color: string }
> = {
  lav: { variant: "outline", icon: Info, color: "text-muted-foreground" },
  mellem: { variant: "secondary", icon: Info, color: "text-blue-600 dark:text-blue-400" },
  høj: { variant: "default", icon: AlertTriangle, color: "text-amber-600 dark:text-amber-500" },
  kritisk: { variant: "destructive", icon: AlertOctagon, color: "text-red-600 dark:text-red-400" },
};

const STATUS_TABS: { key: TaskStatus | "alle"; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "afventer", label: "Afventer" },
  { key: "godkendt", label: "Godkendt" },
  { key: "afvist", label: "Afvist" },
];

const STATUS_ICONS: Record<TaskStatus, typeof Clock> = {
  afventer: Clock,
  godkendt: CheckCircle2,
  afvist: XCircle,
};

function date(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskCard({
  task,
  onApprove,
  onReject,
  pending,
}: {
  task: AiDriftTask;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  const sev = SEVERITY_CONFIG[task.severity] ?? SEVERITY_CONFIG.mellem;
  const StatusIcon = STATUS_ICONS[task.status] ?? Clock;
  const SevIcon = sev.icon;

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-2 shadow-sm"
      data-testid={`card-task-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <SevIcon className={`w-4 h-4 mt-0.5 shrink-0 ${sev.color}`} />
          <div className="min-w-0">
            <div className="font-medium text-sm leading-tight">{task.title}</div>
            {task.type && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {task.type}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={sev.variant}>{SEVERITY_LABELS[task.severity]}</Badge>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusIcon className="w-3 h-3" />
          <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
          {task.createdAt && (
            <span className="ml-1">{date(task.createdAt)}</span>
          )}
        </div>

        {task.status === "afventer" && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              data-testid={`button-approve-task-${task.id}`}
              disabled={pending}
              onClick={onApprove}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Godkend
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive"
              data-testid={`button-reject-task-${task.id}`}
              disabled={pending}
              onClick={onReject}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Afvis
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiDriftschefTasks({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TaskStatus | "alle">("afventer");

  const { data, isLoading } = useQuery<AiDriftTask[]>({
    queryKey: ["/api/ai-drift-tasks", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/ai-drift-tasks?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/ai-drift-tasks"] });

  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TaskStatus }) =>
      (
        await apiRequest("PATCH", `/api/ai-drift-tasks/${id}?companyId=${companyId}`, {
          status,
        })
      ).json(),
    onSuccess: (_data, vars) => {
      invalidate();
      toast({
        title:
          vars.status === "godkendt"
            ? "Opgave godkendt"
            : "Opgave afvist",
      });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere opgave",
        description: e.message,
        variant: "destructive",
      }),
  });

  const tasks = data ?? [];

  const filtered = useMemo(() => {
    if (filter === "alle") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AiDriftTask[]>();
    for (const t of filtered) {
      const key = t.type || "Generelt";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "da"));
  }, [filtered]);

  const counts = useMemo(() => {
    const afventer = tasks.filter((t) => t.status === "afventer").length;
    const godkendt = tasks.filter((t) => t.status === "godkendt").length;
    const afvist = tasks.filter((t) => t.status === "afvist").length;
    const kritisk = tasks.filter(
      (t) => t.severity === "kritisk" && t.status === "afventer",
    ).length;
    return { afventer, godkendt, afvist, kritisk };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-5xl mx-auto pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              AI Driftchef
            </h1>
            <Badge variant="secondary" className="gap-1" data-testid="badge-beta">
              <Sparkles className="w-3 h-3" />
              BETA
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Opgaver og anbefalinger fra AI Driftchef
          </p>
        </div>
      </div>

      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300"
        data-testid="beta-disclaimer"
      >
        <strong>BETA:</strong> AI Driftchef er under udvikling. Anbefalinger
        sendes aldrig automatisk — du skal gennemgå og godkende eller afvise
        hver opgave manuelt.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-pending-count">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Afventer</span>
            </div>
            <div className="text-xl font-semibold mt-1">{counts.afventer}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-approved-count">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Godkendt</span>
            </div>
            <div className="text-xl font-semibold mt-1">{counts.godkendt}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-rejected-count">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Afvist</span>
            </div>
            <div className="text-xl font-semibold mt-1">{counts.afvist}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-critical-count">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Kritiske åbne</span>
            </div>
            <div className="text-xl font-semibold mt-1 text-red-600 dark:text-red-400">
              {counts.kritisk}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskStatus | "alle")}>
        <TabsList data-testid="tabs-status-filter">
          {STATUS_TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              data-testid={`tab-status-${t.key}`}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-tasks"
        >
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen opgaver i denne kategori.
        </div>
      ) : (
        <div className="space-y-5" data-testid="task-groups">
          {grouped.map(([type, groupTasks]) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">{type}</CardTitle>
                <Badge variant="secondary">{groupTasks.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {groupTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    pending={updateTask.isPending}
                    onApprove={() =>
                      updateTask.mutate({ id: task.id, status: "godkendt" })
                    }
                    onReject={() =>
                      updateTask.mutate({ id: task.id, status: "afvist" })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

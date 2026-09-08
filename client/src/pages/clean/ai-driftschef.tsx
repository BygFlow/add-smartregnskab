import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Play,
  Check,
  X,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Users,
  Info,
  Sparkles,
} from "lucide-react";

type TaskType = "konflikt" | "sygdom" | "forsinkelse" | "risiko";
type Severity = "info" | "warning" | "critical";

interface AiDriftTask {
  id: number;
  companyId: number;
  type: TaskType | string;
  severity: Severity | string;
  title: string;
  description?: string | null;
  status: string;
  recommendation?: string | null;
  createdAt?: string | null;
}

const TASK_GROUPS: { id: TaskType; label: string; icon: React.ReactNode }[] = [
  { id: "konflikt", label: "Konflikter", icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "sygdom", label: "Sygdom", icon: <Users className="w-4 h-4" /> },
  { id: "forsinkelse", label: "Forsinkelser", icon: <Clock className="w-4 h-4" /> },
  { id: "risiko", label: "Risici", icon: <ShieldAlert className="w-4 h-4" /> },
];

const SEVERITY_STYLE: Record<string, string> = {
  info: "badge-soft badge-soft-blue",
  warning: "badge-soft badge-soft-amber",
  critical: "badge-soft badge-soft-red",
};
const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Advarsel",
  critical: "Kritisk",
};
const SEVERITY_ICON: Record<string, React.ReactNode> = {
  info: <Info className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  critical: <ShieldAlert className="w-3 h-3" />,
};

const STATUS_STYLE: Record<string, string> = {
  aaben: "badge-soft badge-soft-amber",
  godkendt: "badge-soft badge-soft-green",
  afvist: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  aaben: "Åben",
  godkendt: "Godkendt",
  afvist: "Afvist",
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiDriftschef({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: tasks, isLoading } = useQuery<AiDriftTask[]>({
    queryKey: ["/api/ai-drift-tasks", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/ai-drift-tasks?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/ai-drift-tasks"] });

  const chefRun = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/ai-drift-tasks/chef-run?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({
        title: "Fuld gennemgang kørt",
        description: "Nye opgaver er tilføjet godkendelseskøen.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke køre gennemgang",
        description: e.message,
        variant: "destructive",
      }),
  });

  const resolveTask = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/ai-drift-tasks/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Opgave opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere opgave",
        description: e.message,
        variant: "destructive",
      }),
  });

  const handleChefRun = async () => {
    setRunning(true);
    try {
      await chefRun.mutateAsync();
    } finally {
      setRunning(false);
    }
  };

  const handleApprove = (task: AiDriftTask) =>
    resolveTask.mutate({ id: task.id, data: { status: "godkendt" } });

  const handleReject = (task: AiDriftTask) =>
    resolveTask.mutate({ id: task.id, data: { status: "afvist" } });

  const all = tasks ?? [];
  const openTasks = all.filter((t) => t.status === "aaben" || !t.status);
  const grouped = useMemo(() => {
    const map: Record<string, AiDriftTask[]> = {
      konflikt: [],
      sygdom: [],
      forsinkelse: [],
      risiko: [],
    };
    for (const task of openTasks) {
      const key = (task.type as string) in map ? (task.type as string) : "risiko";
      map[key].push(task);
    }
    return map;
  }, [openTasks]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-ai-tasks">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-5xl mx-auto pb-24">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">AI Driftschef</h1>
        <span
          className="badge-soft badge-soft-amber"
          data-testid="badge-beta"
        >
          <Sparkles className="w-3 h-3" />beta
        </span>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="text-beta-disclaimer">
        AI Driftschef (beta) — resultater er vejledende og skal altid godkendes af en leder.
      </p>

      <Card data-testid="card-chef-run">
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Kør fuld gennemgang af driften
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                AI Driftschef gennemgår automatisk: vagtplan, sygdom, forsinkede opgaver,
                lager, udstyr, kontrakter — alt lander i godkendelseskø.
              </p>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleChefRun}
            disabled={running || chefRun.isPending}
            data-testid="button-run-chef"
          >
            <Play className="w-4 h-4 mr-1.5" />
            {running || chefRun.isPending ? "Kører..." : "Kør fuld gennemgang"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            AI foreslår løsninger, men sender intet automatisk.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card data-testid="card-stat-open">
          <CardContent className="text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">{openTasks.length}</p>
            <p className="text-xs text-muted-foreground">Åbne opgaver</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-approved">
          <CardContent className="text-center">
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {all.filter((t) => t.status === "godkendt").length}
            </p>
            <p className="text-xs text-muted-foreground">Godkendt</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-rejected">
          <CardContent className="text-center">
            <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {all.filter((t) => t.status === "afvist").length}
            </p>
            <p className="text-xs text-muted-foreground">Afvist</p>
          </CardContent>
        </Card>
      </div>

      {openTasks.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-ai-tasks"
        >
          <Check className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-60" />
          <p className="text-sm text-muted-foreground">
            Ingen åbne opgaver — driften ser god ud.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {TASK_GROUPS.map((group) => {
            const items = grouped[group.id] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="space-y-2" data-testid={`group-${group.id}`}>
                <CardHeader className="px-0 pb-1">
                  <CardTitle className="text-base flex items-center gap-1.5">
                    {group.icon}
                    {group.label}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({items.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {items.map((task) => (
                    <Card
                      key={task.id}
                      data-testid={`card-task-${task.id}`}
                      className="overflow-hidden"
                    >
                      <CardContent className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {dk(task.createdAt)}
                            </p>
                          </div>
                          <span
                            className={SEVERITY_STYLE[task.severity as string] ?? "badge-soft badge-soft-gray"}
                            data-testid={`badge-task-severity-${task.id}`}
                          >
                            {SEVERITY_ICON[task.severity as string]}
                            {SEVERITY_LABEL[task.severity as string] ?? task.severity}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        )}

                        {task.recommendation && (
                          <div
                            className="rounded-md border border-primary/20 bg-primary/5 p-2.5"
                            data-testid={`task-recommendation-${task.id}`}
                          >
                            <p className="text-[11px] font-medium text-primary flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />AI anbefaling
                            </p>
                            <p className="text-xs text-foreground mt-1">{task.recommendation}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span
                            className={STATUS_STYLE[task.status as string] ?? "badge-soft badge-soft-amber"}
                            data-testid={`badge-task-status-${task.id}`}
                          >
                            {STATUS_LABEL[task.status as string] ?? task.status ?? "Åben"}
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-approve-task-${task.id}`}
                              disabled={resolveTask.isPending}
                              onClick={() => handleApprove(task)}
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />Godkend
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-reject-task-${task.id}`}
                              disabled={resolveTask.isPending}
                              onClick={() => handleReject(task)}
                              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />Afvis
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

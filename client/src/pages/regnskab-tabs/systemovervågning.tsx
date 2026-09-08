import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/premium";
import {
  Database,
  Server,
  RefreshCw,
  Mail,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ListChecks,
} from "lucide-react";

/* Systemovervågning — system health-hændelser (database, api, sync, mail, storage) */

type SystemHealthEvent = {
  id: number;
  component: string;
  status: string;
  severity?: string | null;
  message?: string | null;
  metrics?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

const COMPONENT_STYLE: Record<string, string> = {
  database: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  api: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  sync: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  mail: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  storage: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
const COMPONENT_LABEL: Record<string, string> = {
  database: "Database",
  api: "API",
  sync: "Synkronisering",
  mail: "Mail",
  storage: "Lagring",
};
const COMPONENT_ICON: Record<string, any> = {
  database: Database,
  api: Server,
  sync: RefreshCw,
  mail: Mail,
  storage: HardDrive,
};

const STATUS_STYLE: Record<string, string> = {
  ok: "badge-soft-green",
  warning: "badge-soft-amber",
  error: "badge-soft-red",
  down: "badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  warning: "Advarsel",
  error: "Fejl",
  down: "Nede",
};

const SEVERITY_STYLE: Record<string, string> = {
  info: "badge-soft-blue",
  warning: "badge-soft-amber",
  error: "badge-soft-red",
  critical: "badge-soft-red",
};
const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Advarsel",
  error: "Fejl",
  critical: "Kritisk",
};

function badgeClass(style?: string) {
  return `badge-soft ${style ?? "badge-soft-gray"}`;
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export default function Systemovervågning({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const queryKey = ["/api/system-health-events", companyId];

  const { data, isLoading } = useQuery<SystemHealthEvent[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/system-health-events");
      const json = await res.json();
      const rows: SystemHealthEvent[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    },
  });

  const events = data ?? [];
  const total = events.length;
  const unresolved = events.filter((e) => !e.resolvedAt && e.status !== "ok").length;
  const critical = events.filter((e) => e.severity === "critical").length;

  const resolveMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/system-health-events/${id}`, {
        status: "ok",
        resolvedAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/system-health-events"] });
      toast({ title: "Hændelse markeret som løst" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere hændelse", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Systemovervågning</h2>
        <p className="text-sm text-muted-foreground">
          Sundhedstilstand for database, API, synkronisering, mail og lagring.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-border overflow-hidden">
        <MetricCard
          icon={<ListChecks className="h-4 w-4" />}
          value={total}
          label="Hændelser i alt"
          variant="blue"
          valueTestId="metric-total"
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          value={unresolved}
          label="Uløste"
          variant="amber"
          valueTestId="metric-unresolved"
        />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          value={critical}
          label="Kritiske"
          variant="red"
          valueTestId="metric-critical"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="events-loading" />
      ) : events.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="events-empty">
          Ingen systemhændelser registreret.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Komponent</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Alvorlighed</th>
                <th className="px-3 py-2">Meddelelse</th>
                <th className="px-3 py-2">Metrics</th>
                <th className="px-3 py-2">Løst</th>
                <th className="px-3 py-2">Oprettet</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => {
                const Icon = COMPONENT_ICON[e.component] ?? Server;
                return (
                  <tr key={e.id} data-testid={`health-row-${e.id}`}>
                    <td className="px-3 py-2">
                      <span
                        className={`${badgeClass(COMPONENT_STYLE[e.component])} inline-flex items-center gap-1`}
                        data-testid={`component-${e.id}`}
                      >
                        <Icon className="h-3 w-3" /> {COMPONENT_LABEL[e.component] ?? e.component}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={badgeClass(STATUS_STYLE[e.status])} data-testid={`status-${e.id}`}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={badgeClass(SEVERITY_STYLE[e.severity ?? "info"])}
                        data-testid={`severity-${e.id}`}
                      >
                        {SEVERITY_LABEL[e.severity ?? "info"] ?? e.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{e.message ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[10rem]">
                      <span className="line-clamp-1 font-mono text-xs">{e.metrics ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(e.resolvedAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(e.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {!e.resolvedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`resolve-health-${e.id}`}
                          disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate(e.id)}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Marker løst
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Activity,
  AlertTriangle,
  AlertOctagon,
  HeartPulse,
  Clock,
  MapPin,
  RefreshCw,
  Radio,
} from "lucide-react";

type EventType = "forsinkelse" | "sygdom" | "sla_bryd" | "afvigelse";
type Severity = "info" | "warning" | "critical";

interface LiveBoardEvent {
  id: number;
  companyId: number;
  type: EventType | string;
  severity: Severity | string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  timestamp?: string | null;
  acknowledged?: boolean | null;
}

const EVENT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  forsinkelse: {
    label: "Forsinkelse",
    icon: <Clock className="w-3.5 h-3.5" />,
    className: "badge-soft badge-soft-amber",
  },
  sygdom: {
    label: "Sygdom",
    icon: <HeartPulse className="w-3.5 h-3.5" />,
    className: "badge-soft badge-soft-blue",
  },
  sla_bryd: {
    label: "SLA-brud",
    icon: <AlertOctagon className="w-3.5 h-3.5" />,
    className: "badge-soft badge-soft-red",
  },
  afvigelse: {
    label: "Afvigelse",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    className: "badge-soft badge-soft-amber",
  },
};

const SEVERITY_CONFIG: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  info: {
    label: "Info",
    className: "badge-soft badge-soft-blue",
    dot: "bg-blue-500",
  },
  warning: {
    label: "Advarsel",
    className: "badge-soft badge-soft-amber",
    dot: "bg-amber-500",
  },
  critical: {
    label: "Kritisk",
    className: "badge-soft badge-soft-red",
    dot: "bg-red-500",
  },
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LiveDriftstavle({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: events, isLoading } = useQuery<LiveBoardEvent[]>({
    queryKey: ["/api/live-board", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/live-board?companyId=${companyId}`)).json(),
    refetchInterval: 15000,
  });

  const invalidate = () => {
    setLastRefresh(new Date());
    qc.invalidateQueries({ queryKey: ["/api/live-board"] });
  };

  const scanNow = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/live-board/scan?companyId=${companyId}`, {})).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Scan udført", description: "Live board opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke scanne",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-live-board">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const list = events ?? [];
  const grouped: Record<string, LiveBoardEvent[]> = {};
  list.forEach((ev) => {
    const key = ev.type as string;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5" />Live driftstavle
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Realtids overvågning af driftshændelser og SLA-status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="auto-refresh-indicator"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            Auto-opdatering · {dk(lastRefresh.toISOString())}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-gradient-to-r from-primary/5 to-transparent p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Manuel scanning</p>
          <p className="text-xs text-muted-foreground mt-1">
            Trigger en fuld scan af alle aktive lokationer og opretter hændelser automatisk
          </p>
        </div>
        <Button
          size="lg"
          data-testid="button-scan-now"
          disabled={scanNow.isPending}
          onClick={() => scanNow.mutate()}
          className="gap-2"
        >
          <Zap className="w-5 h-5" />
          {scanNow.isPending ? "Scanner..." : "Scan nu"}
        </Button>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-live-board"
        >
          <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen aktive hændelser</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, evs]) => {
            const cfg = EVENT_TYPE_CONFIG[type] ?? {
              label: type,
              icon: <AlertTriangle className="w-3.5 h-3.5" />,
              className: "badge-soft badge-soft-gray",
            };
            return (
              <div key={type} data-testid={`group-${type}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cfg.className}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {evs.length} hændelse(r)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {evs.map((ev) => {
                    const sev = SEVERITY_CONFIG[ev.severity as string] ?? {
                      label: ev.severity,
                      className: "badge-soft badge-soft-gray",
                      dot: "bg-gray-400",
                    };
                    return (
                      <Card
                        key={ev.id}
                        data-testid={`card-event-${ev.id}`}
                        className="overflow-hidden"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base truncate">
                              {ev.title || cfg.label}
                            </CardTitle>
                            <span
                              className={sev.className}
                              data-testid={`badge-severity-${ev.id}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                              {sev.label}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {ev.description && (
                            <p className="text-sm text-foreground">{ev.description}</p>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {ev.location || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {dk(ev.timestamp)}
                          </div>
                          {!ev.acknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-1"
                              data-testid={`button-ack-${ev.id}`}
                              onClick={async () => {
                                try {
                                  await apiRequest(
                                    "PATCH",
                                    `/api/live-board/${ev.id}?companyId=${companyId}`,
                                    { acknowledged: true }
                                  );
                                  invalidate();
                                  toast({ title: "Hændelse bekræftet" });
                                } catch (e: any) {
                                  toast({
                                    title: "Kunne ikke bekræfte",
                                    description: e.message,
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1" />
                              Bekræft hændelse
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

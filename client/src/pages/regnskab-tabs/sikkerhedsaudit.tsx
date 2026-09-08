import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, LogIn, LogOut, ShieldAlert, Download, Trash2, UserCog, ShieldCheck, ShieldOff } from "lucide-react";

/* Sikkerhedsaudit — logbog over sikkerhedshændelser (read-only) */

type SecurityAuditEvent = {
  id: number;
  companyId?: number | null;
  userId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  action?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result?: string | null;
  details?: string | null;
  createdAt: string;
};

const EVENT_TYPE_STYLE: Record<string, string> = {
  login: "badge-soft-green",
  login_failed: "badge-soft-red",
  permission_change: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  data_export: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  data_delete: "badge-soft-red",
  role_change: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  mfa_enable: "badge-soft-green",
  mfa_disable: "badge-soft-red",
};
const EVENT_TYPE_LABEL: Record<string, string> = {
  login: "Login",
  login_failed: "Login mislykket",
  permission_change: "Rettighedsændring",
  data_export: "Dataeksport",
  data_delete: "Datasletning",
  role_change: "Rolleændring",
  mfa_enable: "MFA aktiveret",
  mfa_disable: "MFA deaktiveret",
};
const EVENT_ICON: Record<string, any> = {
  login: LogIn,
  login_failed: LogOut,
  permission_change: ShieldAlert,
  data_export: Download,
  data_delete: Trash2,
  role_change: UserCog,
  mfa_enable: ShieldCheck,
  mfa_disable: ShieldOff,
};
const EVENT_TYPES = [
  "login",
  "login_failed",
  "permission_change",
  "data_export",
  "data_delete",
  "role_change",
  "mfa_enable",
  "mfa_disable",
];

const RESULT_STYLE: Record<string, string> = {
  success: "badge-soft-green",
  failure: "badge-soft-red",
};
const RESULT_LABEL: Record<string, string> = {
  success: "Succes",
  failure: "Fejl",
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

export default function Sikkerhedsaudit({ companyId }: { companyId: number }) {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("alle");

  const queryKey = ["/api/security-audit-events", companyId];

  const { data, isLoading } = useQuery<SecurityAuditEvent[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/security-audit-events");
      const json = await res.json();
      const rows: SecurityAuditEvent[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows
        .filter((r) => r.companyId == null || r.companyId === companyId)
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    },
  });

  const events = data ?? [];

  const filtered = useMemo(() => {
    if (eventTypeFilter === "alle") return events;
    return events.filter((e) => e.eventType === eventTypeFilter);
  }, [events, eventTypeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sikkerhedsaudit</h2>
          <p className="text-sm text-muted-foreground">
            Logbog over sikkerhedshændelser — login, rettigheder, dataadgang og MFA.
          </p>
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-56" data-testid="filter-eventType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle hændelsestyper</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {EVENT_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0" /> Alle sikkerhedshændelser logges automatisk.
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="events-loading" />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="events-empty">
          Ingen sikkerhedshændelser fundet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Hændelse</th>
                <th className="px-3 py-2">Bruger</th>
                <th className="px-3 py-2">Ressource</th>
                <th className="px-3 py-2">Handling</th>
                <th className="px-3 py-2">IP-adresse</th>
                <th className="px-3 py-2">Resultat</th>
                <th className="px-3 py-2">Tidspunkt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => {
                const Icon = EVENT_ICON[e.eventType] ?? Info;
                return (
                  <tr key={e.id} data-testid={`event-row-${e.id}`}>
                    <td className="px-3 py-2">
                      <span
                        className={`${badgeClass(EVENT_TYPE_STYLE[e.eventType])} inline-flex items-center gap-1`}
                        data-testid={`event-type-${e.id}`}
                      >
                        <Icon className="h-3 w-3" /> {EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.userId ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {e.resourceType ? `${e.resourceType}${e.resourceId ? ` #${e.resourceId}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.action ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{e.ipAddress ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={badgeClass(RESULT_STYLE[e.result ?? "success"])}
                        data-testid={`result-${e.id}`}
                      >
                        {RESULT_LABEL[e.result ?? "success"] ?? e.result}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(e.createdAt)}</td>
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

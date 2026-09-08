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
import { Info, Mail, MessageSquare, Bell, Webhook } from "lucide-react";

/* Leveringslog — leveringsstatus for e-mail, SMS, push og webhooks */

type DeliveryLog = {
  id: number;
  companyId?: number | null;
  channel: string;
  recipient: string;
  subject?: string | null;
  message?: string | null;
  status: string;
  providerResponse?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
};

const CHANNEL_STYLE: Record<string, string> = {
  email: "badge-soft-blue",
  sms: "badge-soft-green",
  push: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  webhook: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail",
  sms: "SMS",
  push: "Push",
  webhook: "Webhook",
};
const CHANNEL_ICON: Record<string, any> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  webhook: Webhook,
};
const CHANNELS = ["email", "sms", "push", "webhook"];

const STATUS_STYLE: Record<string, string> = {
  afsendt: "badge-soft-blue",
  leveret: "badge-soft-green",
  fejlet: "badge-soft-red",
  afventer: "badge-soft-amber",
};
const STATUS_LABEL: Record<string, string> = {
  afsendt: "Afsendt",
  leveret: "Leveret",
  fejlet: "Fejlet",
  afventer: "Afventer",
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

export default function Leveringslog({ companyId }: { companyId: number }) {
  const [channelFilter, setChannelFilter] = useState<string>("alle");

  const queryKey = ["/api/delivery-logs", companyId];

  const { data, isLoading } = useQuery<DeliveryLog[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/delivery-logs");
      const json = await res.json();
      const rows: DeliveryLog[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows
        .filter((r) => r.companyId == null || r.companyId === companyId)
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    },
  });

  const logs = data ?? [];

  const filtered = useMemo(() => {
    if (channelFilter === "alle") return logs;
    return logs.filter((l) => l.channel === channelFilter);
  }, [logs, channelFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Leveringslog</h2>
          <p className="text-sm text-muted-foreground">
            Overblik over afsendte og leverede beskeder på tværs af kanaler.
          </p>
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-48" data-testid="filter-channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle kanaler</SelectItem>
            {CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0" /> Leveringsstatus for e-mail, SMS, push og webhooks.
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="logs-loading" />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="logs-empty">
          Ingen leveringer fundet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Kanal</th>
                <th className="px-3 py-2">Modtager</th>
                <th className="px-3 py-2">Emne</th>
                <th className="px-3 py-2">Besked</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Afsendt</th>
                <th className="px-3 py-2">Leveret</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((l) => {
                const Icon = CHANNEL_ICON[l.channel] ?? Mail;
                return (
                  <tr key={l.id} data-testid={`delivery-row-${l.id}`}>
                    <td className="px-3 py-2">
                      <span
                        className={`${badgeClass(CHANNEL_STYLE[l.channel])} inline-flex items-center gap-1`}
                        data-testid={`channel-${l.id}`}
                      >
                        <Icon className="h-3 w-3" /> {CHANNEL_LABEL[l.channel] ?? l.channel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.recipient}</td>
                    <td className="px-3 py-2 font-medium">{l.subject ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{l.message ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={badgeClass(STATUS_STYLE[l.status])} data-testid={`status-${l.id}`}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(l.sentAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(l.deliveredAt)}</td>
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

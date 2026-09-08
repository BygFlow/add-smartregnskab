import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { MetricCard } from "@/components/premium";
import {
  Info,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  CloudOff,
  Wrench,
} from "lucide-react";

/* ---------- typer ---------- */

interface OfflineConflict {
  id: number;
  companyId?: number | null;
  employeeName?: string | null;
  syncType: string;
  localData?: string | null;
  serverData?: string | null;
  conflictType: string;
  status: string;
  resolvedBy?: string | null;
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

const CONFLICT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  edit_conflict: { label: "Redigeringskonflikt", className: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  delete_conflict: { label: "Sletningskonflikt", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  duplicate: { label: "Duplikat", className: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  afventer: {
    label: "Afventer",
    className: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
    icon: <Clock className="w-3 h-3" />,
  },
  løst: {
    label: "Løst",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  ignoreret: {
    label: "Ignoreret",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const SYNC_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  tjekliste: { label: "Tjekliste", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  foto: { label: "Foto", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  qr: { label: "QR", className: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  nfc: { label: "NFC", className: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400" },
  tidsreg: { label: "Tidsreg", className: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
};

function badgeFor(map: Record<string, { label: string; className: string }>, key: string) {
  return map[key] ?? { label: key, className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400" };
}

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- komponent ---------- */

export default function OfflineKonflikter({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resolveTarget, setResolveTarget] = useState<OfflineConflict | null>(null);

  const { data, isLoading } = useQuery<OfflineConflict[]>({
    queryKey: ["/api/offline-conflicts", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/offline-conflicts?companyId=${companyId}`)).json(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/offline-conflicts"] });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: number; resolution: string }) =>
      (
        await apiRequest("POST", `/api/offline-conflicts/${id}/resolve?companyId=${companyId}`, {
          resolution,
        })
      ).json(),
    onSuccess: () => {
      invalidate();
      setResolveTarget(null);
      toast({ title: "Konflikt løst" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke løse konflikt", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-offline-konflikter">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = data ?? [];
  const pendingCount = list.filter((c) => c.status === "afventer").length;
  const resolvedCount = list.filter((c) => c.status === "løst").length;

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CloudOff className="w-5 h-5" />
          Offline-konflikter
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konflikter fra offline-synkronisering af mobil-data
        </p>
      </div>

      <div
        className="rounded-md border border-border/70 bg-card p-3 flex items-start gap-2 text-sm"
        data-testid="info-banner-offline-konflikter"
      >
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          Konflikter opstår når offline data ikke kan synkroniseres automatisk
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          value={list.length}
          label="Konflikter i alt"
          variant="primary"
          valueTestId="metric-total-conflicts"
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          value={pendingCount}
          label="Afventer"
          variant="amber"
          valueTestId="metric-pending-conflicts"
        />
        <MetricCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          value={resolvedCount}
          label="Løst"
          variant="green"
          valueTestId="metric-resolved-conflicts"
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-offline-konflikter">
          <CloudOff className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen konflikter registreret</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-offline-konflikter">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medarbejder</TableHead>
                <TableHead>Sync-type</TableHead>
                <TableHead>Konflikttype</TableHead>
                <TableHead>Lokal data</TableHead>
                <TableHead>Server-data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Løst af</TableHead>
                <TableHead>Løst d.</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((conflict) => {
                const conflictBadge = badgeFor(CONFLICT_TYPE_CONFIG, conflict.conflictType);
                const statusBadge = STATUS_CONFIG[conflict.status] ?? {
                  label: conflict.status,
                  className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
                  icon: null,
                };
                const syncBadge = badgeFor(SYNC_TYPE_CONFIG, conflict.syncType);
                return (
                  <TableRow key={conflict.id} data-testid={`row-conflict-${conflict.id}`}>
                    <TableCell className="font-medium">{conflict.employeeName || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${syncBadge.className}`}
                        data-testid={`badge-sync-type-${conflict.id}`}
                      >
                        {syncBadge.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${conflictBadge.className}`}
                        data-testid={`badge-conflict-type-${conflict.id}`}
                      >
                        {conflictBadge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {conflict.localData || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {conflict.serverData || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}
                        data-testid={`badge-status-${conflict.id}`}
                      >
                        {statusBadge.icon}
                        {statusBadge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{conflict.resolvedBy || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dk(conflict.resolvedAt)}</TableCell>
                    <TableCell className="text-right">
                      {conflict.status === "afventer" && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-resolve-${conflict.id}`}
                          onClick={() => setResolveTarget(conflict)}
                        >
                          <Wrench className="w-3.5 h-3.5 mr-1" />
                          Løs konflikt
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Løs konflikt</DialogTitle>
          </DialogHeader>
          {resolveTarget && (
            <ResolveForm
              conflict={resolveTarget}
              pending={resolveMutation.isPending}
              onSubmit={async (resolution) => {
                await resolveMutation.mutateAsync({ id: resolveTarget.id, resolution });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- løs-konflikt-formular ---------- */

function ResolveForm({
  conflict,
  pending,
  onSubmit,
}: {
  conflict: OfflineConflict;
  pending: boolean;
  onSubmit: (resolution: string) => Promise<void>;
}) {
  const [resolution, setResolution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(resolution);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border border-border/70 bg-muted/30 p-3 space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Medarbejder:</span> {conflict.employeeName || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Lokal data:</span> {conflict.localData || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Server-data:</span> {conflict.serverData || "—"}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="resolution-text">Løsning *</Label>
        <textarea
          id="resolution-text"
          data-testid="input-resolution-text"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={4}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Beskriv hvordan konflikten er løst..."
        />
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-submit-resolution">
          {submitting || pending ? "Løser konflikt..." : "Løs konflikt"}
        </Button>
      </DialogFooter>
    </form>
  );
}

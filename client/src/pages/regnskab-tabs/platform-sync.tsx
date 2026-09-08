import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, RefreshCcw, CheckCircle2, XCircle, ListChecks, ArrowRightLeft } from "lucide-react";

/* Platform-sync — synkroniseringsjobs mellem ADD SmartRegnskab og ADD SmartRegnskab */

type PlatformSyncJob = {
  id: number;
  sourcePlatform: string;
  targetPlatform: string;
  syncType: string;
  status: string;
  totalRecords?: number | null;
  syncedRecords?: number | null;
  errorRecords?: number | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
};

const SYNC_TYPES = [
  { id: "kunder", label: "Kunder", cls: "badge-soft badge-soft-blue" },
  { id: "fakturaer", label: "Fakturaer", cls: "badge-soft badge-soft-green" },
  { id: "timer", label: "Timer", cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  { id: "løn", label: "Løn", cls: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  { id: "materialer", label: "Materialer", cls: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400" },
  { id: "kontrakter", label: "Kontrakter", cls: "badge-soft badge-soft-red" },
];

const PLATFORM_STYLE: Record<string, string> = {
  smartdrift_clean: "badge-soft badge-soft-blue",
  smartregnskab: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
};

const PLATFORM_LABEL: Record<string, string> = {
  smartdrift_clean: "ADD SmartRegnskab",
  smartregnskab: "ADD SmartRegnskab",
};

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  synkroniserer: "badge-soft badge-soft-blue",
  gennemført: "badge-soft badge-soft-green",
  fejl: "badge-soft badge-soft-red",
};

const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  synkroniserer: "Synkroniserer…",
  gennemført: "Gennemført",
  fejl: "Fejl",
};

function syncTypeMeta(id?: string | null) {
  return (
    SYNC_TYPES.find((t) => t.id === id) ?? {
      id: id ?? "kunder",
      label: id ?? "—",
      cls: "badge-soft badge-soft-gray",
    }
  );
}

function platformBadge(id?: string | null) {
  return PLATFORM_STYLE[id ?? ""] ?? "badge-soft badge-soft-gray";
}

function platformLabel(id?: string | null) {
  return PLATFORM_LABEL[id ?? ""] ?? id ?? "—";
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export default function PlatformSync({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    sourcePlatform: "smartdrift_clean",
    targetPlatform: "smartregnskab",
    syncType: "kunder",
  });

  const queryKey = ["/api/platform-sync-jobs"];

  const { data, isLoading } = useQuery<PlatformSyncJob[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform-sync-jobs");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
    refetchInterval: 10000,
  });

  const jobs = (data ?? []).slice().sort((a, b) => b.id - a.id);
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === "gennemført").length;
  const failedJobs = jobs.filter((j) => j.status === "fejl").length;

  const triggerMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform-sync-jobs/trigger", {
        sourcePlatform: form.sourcePlatform,
        targetPlatform: form.targetPlatform,
        syncType: form.syncType,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-sync-jobs"] });
      toast({
        title: "Synkronisering startet",
        description: "Jobbet er sat i gang og opdateres i tabellen.",
      });
      setDialogOpen(false);
      setForm({ sourcePlatform: "smartdrift_clean", targetPlatform: "smartregnskab", syncType: "kunder" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: "Kunne ikke starte synkronisering",
        description: message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Platform-synkronisering</h2>
          <p className="text-sm text-muted-foreground">
            Synkroniseringsjobs mellem ADD SmartRegnskab og ADD SmartRegnskab.
          </p>
        </div>
        <Button data-testid="start-sync-btn" onClick={() => setDialogOpen(true)}>
          <Play className="mr-2 h-4 w-4" /> Start synkronisering
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300">
        <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Data flyder automatisk fra ADD SmartRegnskab til ADD SmartRegnskab.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card" data-testid="summary-total">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListChecks className="h-4 w-4" /> Jobs i alt
          </div>
          <div className="mt-1 text-2xl font-semibold">{totalJobs}</div>
        </div>
        <div className="kpi-card" data-testid="summary-completed">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Gennemført
          </div>
          <div className="mt-1 text-2xl font-semibold">{completedJobs}</div>
        </div>
        <div className="kpi-card" data-testid="summary-failed">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4 text-red-600" /> Fejlet
          </div>
          <div className="mt-1 text-2xl font-semibold">{failedJobs}</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : jobs.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen synkroniseringsjobs endnu. Start den første synkronisering ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Kilde</th>
                <th className="px-3 py-2">Mål</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Synkroniseret</th>
                <th className="px-3 py-2">Fejl</th>
                <th className="px-3 py-2">Startet</th>
                <th className="px-3 py-2">Afsluttet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((j) => {
                const meta = syncTypeMeta(j.syncType);
                return (
                  <tr key={j.id} data-testid={`sync-job-row-${j.id}`}>
                    <td className="px-3 py-2">
                      <span className={platformBadge(j.sourcePlatform)} data-testid={`source-badge-${j.id}`}>
                        {platformLabel(j.sourcePlatform)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={platformBadge(j.targetPlatform)} data-testid={`target-badge-${j.id}`}>
                        {platformLabel(j.targetPlatform)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={meta.cls} data-testid={`syncType-badge-${j.id}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={STATUS_STYLE[j.status] ?? "badge-soft badge-soft-gray"}
                        data-testid={`status-badge-${j.id}`}
                      >
                        {STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{j.totalRecords ?? 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{j.syncedRecords ?? 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{j.errorRecords ?? 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(j.startedAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(j.completedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start synkronisering</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ps-source">Kildeplatform</Label>
              <Select
                value={form.sourcePlatform}
                onValueChange={(v) => setForm((f) => ({ ...f, sourcePlatform: v }))}
              >
                <SelectTrigger id="ps-source" data-testid="form-sourcePlatform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartdrift_clean">ADD SmartRegnskab</SelectItem>
                  <SelectItem value="smartregnskab">ADD SmartRegnskab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-target">Målplatform</Label>
              <Select
                value={form.targetPlatform}
                onValueChange={(v) => setForm((f) => ({ ...f, targetPlatform: v }))}
              >
                <SelectTrigger id="ps-target" data-testid="form-targetPlatform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartregnskab">ADD SmartRegnskab</SelectItem>
                  <SelectItem value="smartdrift_clean">ADD SmartRegnskab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-syncType">Synkroniseringstype</Label>
              <Select
                value={form.syncType}
                onValueChange={(v) => setForm((f) => ({ ...f, syncType: v }))}
              >
                <SelectTrigger id="ps-syncType" data-testid="form-syncType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={triggerMut.isPending}
              onClick={() => triggerMut.mutate()}
            >
              {triggerMut.isPending ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> Starter…
                </>
              ) : (
                "Start synkronisering"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

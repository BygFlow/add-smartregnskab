import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2, RefreshCw, ArrowLeftRight, Info } from "lucide-react";

/* Platform-sammenkobling — mapping mellem SmartDrift Clean og SmartRegnskab entiteter */

type PlatformSyncMapping = {
  id: number;
  syncType: string;
  sourceId: string;
  targetId: string;
  sourcePlatform: string;
  targetPlatform: string;
  status: string;
  lastSyncedAt?: string | null;
};

const SYNC_TYPES = [
  { id: "kunder", label: "Kunder" },
  { id: "fakturaer", label: "Fakturaer" },
  { id: "timer", label: "Timer" },
  { id: "løn", label: "Løn" },
  { id: "materialer", label: "Materialer" },
  { id: "kontrakter", label: "Kontrakter" },
];

const SYNC_TYPE_STYLE: Record<string, string> = {
  kunder: "badge-soft badge-soft-blue",
  fakturaer: "badge-soft badge-soft-green",
  timer: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  løn: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  materialer: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  kontrakter: "badge-soft badge-soft-red",
};

const SYNC_TYPE_LABEL: Record<string, string> = {
  kunder: "Kunder",
  fakturaer: "Fakturaer",
  timer: "Timer",
  løn: "Løn",
  materialer: "Materialer",
  kontrakter: "Kontrakter",
};

const STATUS_STYLE: Record<string, string> = {
  synkroniseret: "badge-soft badge-soft-green",
  afventer: "badge-soft badge-soft-amber",
  konflikt: "badge-soft badge-soft-red",
};

const STATUS_LABEL: Record<string, string> = {
  synkroniseret: "Synkroniseret",
  afventer: "Afventer",
  konflikt: "Konflikt",
};

const STATUS_OPTIONS = ["synkroniseret", "afventer", "konflikt"];

const PLATFORMS = ["smartdrift_clean", "smartregnskab"];

function badge(style?: string) {
  return `badge-soft ${style ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`;
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export default function SyncMappings({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    syncType: "kunder",
    sourcePlatform: "smartdrift_clean",
    targetPlatform: "smartregnskab",
    sourceId: "",
    targetId: "",
    status: "afventer",
  });

  const queryKey = ["/api/platform-sync-mappings", companyId];

  const { data, isLoading } = useQuery<PlatformSyncMapping[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform-sync-mappings");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const mappings = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform-sync-mappings", {
        syncType: form.syncType,
        sourcePlatform: form.sourcePlatform,
        targetPlatform: form.targetPlatform,
        sourceId: form.sourceId,
        targetId: form.targetId,
        status: form.status,
        lastSyncedAt: form.status === "synkroniseret" ? new Date().toISOString() : null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-sync-mappings"] });
      toast({ title: "Mapping oprettet", description: "Sammenkoblingen er gemt." });
      setDialogOpen(false);
      setForm({
        syncType: "kunder",
        sourcePlatform: "smartdrift_clean",
        targetPlatform: "smartregnskab",
        sourceId: "",
        targetId: "",
        status: "afventer",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette mapping", description: message, variant: "destructive" });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<PlatformSyncMapping> }) => {
      const res = await apiRequest("PATCH", `/api/platform-sync-mappings/${id}`, patch);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-sync-mappings"] });
      toast({ title: "Mapping opdateret" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const resyncMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/platform-sync-mappings/${id}`, {
        status: "synkroniseret",
        lastSyncedAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-sync-mappings"] });
      toast({ title: "Gensynkroniseret", description: "Mappingen er markeret som synkroniseret." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke synkronisere", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/platform-sync-mappings/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-sync-mappings"] });
      toast({ title: "Mapping slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Platform-sammenkobling</h2>
          <p className="text-sm text-muted-foreground">
            Mapping mellem SmartDrift Clean-entiteter og SmartRegnskab-entiteter.
          </p>
        </div>
        <Button data-testid="add-mapping-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ny mapping
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Data flyder automatisk mellem SmartDrift Clean og SmartRegnskab. Når en kunde, faktura,
          time, lønpost, materiale eller kontrakt oprettes eller opdateres i det ene system,
          holdes den koblede post i det andet system synkroniseret via disse mappings.
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : mappings.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen mappings endnu. Opret den første sammenkobling ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Synk-type</th>
                <th className="px-3 py-2">Kildeplatform</th>
                <th className="px-3 py-2">Målplatform</th>
                <th className="px-3 py-2">Kilde-ID</th>
                <th className="px-3 py-2">Mål-ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Senest synkroniseret</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mappings.map((m) => (
                <tr key={m.id} data-testid={`mapping-row-${m.id}`}>
                  <td className="px-3 py-2">
                    <span className={SYNC_TYPE_STYLE[m.syncType] ?? badge()} data-testid={`synctype-badge-${m.id}`}>
                      {SYNC_TYPE_LABEL[m.syncType] ?? m.syncType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.sourcePlatform}</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.targetPlatform}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.sourceId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.targetId}</td>
                  <td className="px-3 py-2">
                    <span
                      className={STATUS_STYLE[m.status] ?? "badge-soft badge-soft-gray"}
                      data-testid={`status-badge-${m.id}`}
                    >
                      {STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(m.lastSyncedAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`resync-btn-${m.id}`}
                        onClick={() => resyncMut.mutate(m.id)}
                        disabled={resyncMut.isPending}
                        title="Synkroniser igen"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      {m.status === "konflikt" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`resolve-btn-${m.id}`}
                          onClick={() =>
                            patchMut.mutate({ id: m.id, patch: { status: "synkroniseret", lastSyncedAt: new Date().toISOString() } })
                          }
                          title="Løs konflikt"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        data-testid={`delete-btn-${m.id}`}
                        onClick={() => deleteMut.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny sammenkoblingsmapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="map-synctype">Synk-type</Label>
              <Select value={form.syncType} onValueChange={(v) => setForm((f) => ({ ...f, syncType: v }))}>
                <SelectTrigger id="map-synctype" data-testid="form-syncType">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="map-source-platform">Kildeplatform</Label>
                <Select
                  value={form.sourcePlatform}
                  onValueChange={(v) => setForm((f) => ({ ...f, sourcePlatform: v }))}
                >
                  <SelectTrigger id="map-source-platform" data-testid="form-sourcePlatform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="map-target-platform">Målplatform</Label>
                <Select
                  value={form.targetPlatform}
                  onValueChange={(v) => setForm((f) => ({ ...f, targetPlatform: v }))}
                >
                  <SelectTrigger id="map-target-platform" data-testid="form-targetPlatform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="map-source-id">Kilde-ID</Label>
                <Input
                  id="map-source-id"
                  data-testid="form-sourceId"
                  value={form.sourceId}
                  onChange={(e) => setForm((f) => ({ ...f, sourceId: e.target.value }))}
                  placeholder="F.eks. drift-kunde-1029"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="map-target-id">Mål-ID</Label>
                <Input
                  id="map-target-id"
                  data-testid="form-targetId"
                  value={form.targetId}
                  onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                  placeholder="F.eks. regnskab-kunde-451"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger id="map-status" data-testid="form-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
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
              disabled={createMut.isPending || !form.sourceId.trim() || !form.targetId.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

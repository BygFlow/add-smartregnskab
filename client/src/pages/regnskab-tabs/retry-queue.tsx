import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { Plus, RotateCcw, Ban, Trash2 } from "lucide-react";

/* Retry-kø for integrationer — automatisk genforsøg ved fejl */

type IntegrationRetryQueueItem = {
  id: number;
  integrationType: string;
  payload?: string | null;
  retryCount?: number | null;
  maxRetries?: number | null;
  nextRetryAt?: string | null;
  status: string;
  errorMessage?: string | null;
};

const INTEGRATION_TYPES = [
  { id: "bank", label: "Bank" },
  { id: "skat", label: "SKAT" },
  { id: "nemhandel", label: "NemHandel" },
  { id: "eindkomst", label: "eIndkomst" },
  { id: "mitid", label: "MitID" },
];

function typeLabel(t: string): string {
  return INTEGRATION_TYPES.find((x) => x.id === t)?.label ?? t;
}

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  igang: "badge-soft badge-soft-blue",
  gennemført: "badge-soft badge-soft-green",
  fejlet: "badge-soft badge-soft-red",
  stoppet: "badge-soft badge-soft-gray",
};

const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  igang: "I gang",
  gennemført: "Gennemført",
  fejlet: "Fejlet",
  stoppet: "Stoppet",
};

const STATUS_OPTIONS = ["afventer", "igang", "gennemført", "fejlet", "stoppet"];

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export default function RetryQueue({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    integrationType: "bank",
    payload: "",
    maxRetries: 3,
    errorMessage: "",
  });

  const queryKey = ["/api/integration-retry-queue", companyId];

  const { data, isLoading } = useQuery<IntegrationRetryQueueItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integration-retry-queue");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = (data ?? []).slice().sort((a, b) => (a.nextRetryAt ?? "").localeCompare(b.nextRetryAt ?? ""));

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integration-retry-queue", {
        integrationType: form.integrationType,
        payload: form.payload || null,
        retryCount: 0,
        maxRetries: Number(form.maxRetries) || 3,
        status: "afventer",
        errorMessage: form.errorMessage || null,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-retry-queue"] });
      toast({ title: "Tilføjet til kø", description: "Elementet forsøges genkørt automatisk." });
      setDialogOpen(false);
      setForm({ integrationType: "bank", payload: "", maxRetries: 3, errorMessage: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje til kø", description: message, variant: "destructive" });
    },
  });

  const retryMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/integration-retry-queue/${id}/retry`, {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-retry-queue"] });
      toast({ title: "Prøver igen", description: "Genforsøg er sat i gang." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke prøve igen", description: message, variant: "destructive" });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<IntegrationRetryQueueItem> }) => {
      const res = await apiRequest("PATCH", `/api/integration-retry-queue/${id}`, patch);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-retry-queue"] });
      toast({ title: "Opdateret" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/integration-retry-queue/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-retry-queue"] });
      toast({ title: "Fjernet fra kø" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Retry-kø for integrationer</h2>
          <p className="text-sm text-muted-foreground">
            Fejlede integrationskald genforsøges automatisk indtil maks. antal forsøg.
          </p>
        </div>
        <Button data-testid="add-retry-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj til kø
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Retry-køen er tom. Alle integrationer kører problemfrit.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Integrationstype</th>
                <th className="px-3 py-2">Forsøg</th>
                <th className="px-3 py-2">Næste forsøg</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Fejlmeddelelse</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const retryCount = item.retryCount ?? 0;
                const maxRetries = item.maxRetries ?? 3;
                const pct = maxRetries > 0 ? Math.min(100, Math.round((retryCount / maxRetries) * 100)) : 0;
                const exhausted = retryCount >= maxRetries;
                return (
                  <tr key={item.id} data-testid={`retry-row-${item.id}`}>
                    <td className="px-3 py-2">
                      <span className="badge-soft badge-soft-blue" data-testid={`type-badge-${item.id}`}>
                        {typeLabel(item.integrationType)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-32 items-center gap-2">
                        <Progress value={pct} className="h-1.5 w-20" data-testid={`progress-${item.id}`} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {retryCount}/{maxRetries}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(item.nextRetryAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={STATUS_STYLE[item.status] ?? "badge-soft badge-soft-gray"}
                        data-testid={`status-badge-${item.id}`}
                      >
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                      {item.errorMessage || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`retry-btn-${item.id}`}
                          onClick={() => retryMut.mutate(item.id)}
                          disabled={retryMut.isPending || item.status === "stoppet" || exhausted}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Prøv igen
                        </Button>
                        {item.status !== "stoppet" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`stop-btn-${item.id}`}
                            onClick={() => patchMut.mutate({ id: item.id, patch: { status: "stoppet" } })}
                            title="Stop genforsøg"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          data-testid={`delete-btn-${item.id}`}
                          onClick={() => deleteMut.mutate(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
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
            <DialogTitle>Tilføj til retry-kø</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rq-type">Integrationstype</Label>
              <Select
                value={form.integrationType}
                onValueChange={(v) => setForm((f) => ({ ...f, integrationType: v }))}
              >
                <SelectTrigger id="rq-type" data-testid="form-integrationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEGRATION_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-payload">Payload (JSON / reference)</Label>
              <Textarea
                id="rq-payload"
                data-testid="form-payload"
                value={form.payload}
                onChange={(e) => setForm((f) => ({ ...f, payload: e.target.value }))}
                placeholder='{"recordId":"..."}'
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-max">Maks. antal forsøg</Label>
              <Input
                id="rq-max"
                type="number"
                data-testid="form-maxRetries"
                value={form.maxRetries}
                onChange={(e) => setForm((f) => ({ ...f, maxRetries: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-error">Fejlmeddelelse</Label>
              <Textarea
                id="rq-error"
                data-testid="form-errorMessage"
                value={form.errorMessage}
                onChange={(e) => setForm((f) => ({ ...f, errorMessage: e.target.value }))}
                placeholder="Beskriv den fejl der udløste genforsøg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button data-testid="form-save" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "Gemmer…" : "Tilføj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

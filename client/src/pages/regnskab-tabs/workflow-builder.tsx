import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, Play, Workflow, ArrowRight } from "lucide-react";

/* Workflow builder — end-to-end automatisering fra tilbud til betaling */

type WorkflowDefinition = {
  id: number;
  companyId?: number | null;
  name: string;
  trigger: string;
  steps: string;
  isActive?: boolean | null;
  description?: string | null;
  createdAt?: string | null;
};

type WorkflowRun = {
  id: number;
  workflowId: number;
  trigger: string;
  status: string;
  currentStep?: number | null;
  totalSteps?: number | null;
  result?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

const TRIGGERS = [
  { id: "tilbud_oprettet", label: "Tilbud oprettet" },
  { id: "kontrakt_underskrevet", label: "Kontrakt underskrevet" },
  { id: "opgave_afsluttet", label: "Opgave afsluttet" },
  { id: "faktura_sendt", label: "Faktura sendt" },
  { id: "betaling_modtaget", label: "Betaling modtaget" },
];

function triggerLabel(t: string): string {
  return TRIGGERS.find((x) => x.id === t)?.label ?? t;
}

const RUN_STATUS_STYLE: Record<string, string> = {
  startet: "badge-soft badge-soft-blue",
  igang: "badge-soft badge-soft-amber",
  gennemført: "badge-soft badge-soft-green",
  fejl: "badge-soft badge-soft-red",
};

const RUN_STATUS_LABEL: Record<string, string> = {
  startet: "Startet",
  igang: "I gang",
  gennemført: "Gennemført",
  fejl: "Fejl",
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function countSteps(steps: string): number {
  try {
    const parsed = JSON.parse(steps);
    if (Array.isArray(parsed)) return parsed.length;
  } catch {
    /* ignore */
  }
  return 0;
}

export default function WorkflowBuilder({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger: "tilbud_oprettet",
    description: "",
    steps: '[\n  { "type": "opret_kontrakt" },\n  { "type": "opret_opgave" }\n]',
    isActive: true,
  });

  const defsQueryKey = ["/api/workflow-definitions", companyId];
  const runsQueryKey = ["/api/workflow-runs", companyId];

  const { data: defsData, isLoading: defsLoading } = useQuery<WorkflowDefinition[]>({
    queryKey: defsQueryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflow-definitions");
      const json = await res.json();
      const items: WorkflowDefinition[] = Array.isArray(json) ? json : (json?.items ?? []);
      return items.filter((w) => w.companyId == null || w.companyId === companyId);
    },
  });

  const { data: runsData, isLoading: runsLoading } = useQuery<WorkflowRun[]>({
    queryKey: runsQueryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflow-runs");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const definitions = defsData ?? [];
  const runs = (runsData ?? [])
    .slice()
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
    .slice(0, 25);

  const createMut = useMutation({
    mutationFn: async () => {
      let stepsJson = form.steps.trim() || "[]";
      try {
        JSON.parse(stepsJson);
      } catch {
        throw new Error("Steps skal være gyldig JSON");
      }
      const res = await apiRequest("POST", "/api/workflow-definitions", {
        companyId,
        name: form.name,
        trigger: form.trigger,
        description: form.description || null,
        steps: stepsJson,
        isActive: form.isActive,
        createdAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workflow-definitions"] });
      toast({ title: "Workflow oprettet", description: "Workflowet er klar til brug." });
      setDialogOpen(false);
      setForm({
        name: "",
        trigger: "tilbud_oprettet",
        description: "",
        steps: '[\n  { "type": "opret_kontrakt" },\n  { "type": "opret_opgave" }\n]',
        isActive: true,
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette workflow", description: message, variant: "destructive" });
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/workflow-definitions/${id}`, { isActive });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workflow-definitions"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const runMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/workflow-definitions/${id}/run`, {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workflow-runs"] });
      toast({ title: "Workflow kørt", description: "Se resultatet i seneste kørsler nedenfor." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke køre workflow", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/workflow-definitions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workflow-definitions"] });
      toast({ title: "Workflow slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  function defName(id: number): string {
    return definitions.find((d) => d.id === id)?.name ?? `#${id}`;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Workflow builder</h2>
          <p className="text-sm text-muted-foreground">
            Automatiser tværgående processer med udløsere og trin.
          </p>
        </div>
        <Button data-testid="add-workflow-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret workflow
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300">
        <Workflow className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>End-to-end flow:</span>
          {["Tilbud", "Kontrakt", "Opgaver", "Timer", "Løn", "Faktura", "Bogføring", "Betaling", "Rapport"].map(
            (step, i, arr) => (
              <span key={step} className="inline-flex items-center gap-1.5">
                <span className="font-medium">{step}</span>
                {i < arr.length - 1 && <ArrowRight className="h-3 w-3" />}
              </span>
            ),
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Workflow-definitioner</h3>
        {defsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : definitions.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Ingen workflows endnu. Opret det første workflow ovenfor.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="px-3 py-2">Navn</th>
                  <th className="px-3 py-2">Udløser</th>
                  <th className="px-3 py-2">Aktiv</th>
                  <th className="px-3 py-2">Beskrivelse</th>
                  <th className="px-3 py-2">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {definitions.map((w) => (
                  <tr key={w.id} data-testid={`workflow-row-${w.id}`}>
                    <td className="px-3 py-2 font-medium">{w.name}</td>
                    <td className="px-3 py-2">
                      <span className="badge-soft badge-soft-blue" data-testid={`trigger-badge-${w.id}`}>
                        {triggerLabel(w.trigger)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={!!w.isActive}
                        data-testid={`active-switch-${w.id}`}
                        onCheckedChange={(v) => toggleActiveMut.mutate({ id: w.id, isActive: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-2 max-w-xs">
                      {w.description || `${countSteps(w.steps)} trin`}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`run-btn-${w.id}`}
                          onClick={() => runMut.mutate(w.id)}
                          disabled={runMut.isPending}
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" /> Kør
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          data-testid={`delete-btn-${w.id}`}
                          onClick={() => deleteMut.mutate(w.id)}
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Seneste workflow-kørsler</h3>
        {runsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : runs.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Ingen kørsler endnu.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="px-3 py-2">Workflow</th>
                  <th className="px-3 py-2">Udløser</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Trin</th>
                  <th className="px-3 py-2">Resultat</th>
                  <th className="px-3 py-2">Startet</th>
                  <th className="px-3 py-2">Afsluttet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r) => (
                  <tr key={r.id} data-testid={`run-row-${r.id}`}>
                    <td className="px-3 py-2 font-medium">{defName(r.workflowId)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{triggerLabel(r.trigger)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={RUN_STATUS_STYLE[r.status] ?? "badge-soft badge-soft-gray"}
                        data-testid={`run-status-${r.id}`}
                      >
                        {RUN_STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.currentStep ?? 0}/{r.totalSteps ?? 0}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                      {r.errorMessage || r.result || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(r.startedAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(r.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Opret workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Navn</Label>
              <Input
                id="wf-name"
                data-testid="form-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="F.eks. Fra tilbud til faktura"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-trigger">Udløser</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}>
                <SelectTrigger id="wf-trigger" data-testid="form-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-description">Beskrivelse</Label>
              <Input
                id="wf-description"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Kort beskrivelse af workflowet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-steps">Trin (JSON)</Label>
              <Textarea
                id="wf-steps"
                data-testid="form-steps"
                value={form.steps}
                onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))}
                className="min-h-32 font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="wf-active">Aktiv fra oprettelse</Label>
              <Switch
                id="wf-active"
                data-testid="form-isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.name.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

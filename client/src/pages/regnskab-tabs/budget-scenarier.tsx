import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  TrendingUp,
  TrendingDown,
  Target,
  GitBranch,
} from "lucide-react";

/* Budget & scenarier — budgetversioner og scenarieanalyse */

type BudgetVersion = {
  id: number;
  companyId?: number | null;
  name?: string | null;
  year?: number | null;
  scenario?: string | null;
  version?: number | null;
  totalRevenue?: number | null;
  totalCosts?: number | null;
  totalResult?: number | null;
  status?: string | null;
  createdAt?: string | null;
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

/* ---------- farver & labels ---------- */

const BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${BADGE_COLORS[color] ?? BADGE_COLORS.gray}`}
    >
      {children}
    </span>
  );
}

const SCENARIO_COLOR: Record<string, string> = {
  basis: "blue",
  optimistisk: "green",
  pessimistisk: "red",
  stress_test: "orange",
};

const SCENARIO_LABEL: Record<string, string> = {
  basis: "Basis",
  optimistisk: "Optimistisk",
  pessimistisk: "Pessimistisk",
  stress_test: "Stress test",
};

const STATUS_COLOR: Record<string, string> = {
  kladde: "gray",
  godkendt: "green",
  arkiveret: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  godkendt: "Godkendt",
  arkiveret: "Arkiveret",
};

const SCENARIOS = ["basis", "optimistisk", "pessimistisk", "stress_test"] as const;
const STATUSES = ["kladde", "godkendt", "arkiveret"] as const;

function currentYear() {
  return new Date().getFullYear();
}

export default function BudgetScenarier({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetVersion | null>(null);

  const queryKey = ["/api/budget-versions", companyId] as const;

  const { data, isLoading } = useQuery<BudgetVersion[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/budget-versions?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = data ?? [];

  // Find nyeste version (højst version-nummer)
  const currentVersion = items.length > 0
    ? Math.max(...items.map((i) => Number(i.version ?? 0)))
    : 0;
  const totalResult = items.reduce((sum, i) => sum + (Number(i.totalResult) || 0), 0);

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/budget-versions?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Budget oprettet", description: "Budgetversion er oprettet som kladde." });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette budget", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/budget-versions/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Budget opdateret" });
      setOpen(false);
      setEditing(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/budget-versions/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Budget slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/budget-versions/${id}?companyId=${companyId}`, { status: "godkendt" })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Budget godkendt" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke godkende", description: message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: BudgetVersion) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Budget & scenarier</h2>
          <p className="text-sm text-muted-foreground">
            Budgetversioner og scenarieanalyse — basis, optimistisk, pessimistisk og stress test.
          </p>
        </div>
        <Button data-testid="add-budget-btn" onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Opret budget
        </Button>
      </div>

      {/* Sammenfatning */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
            <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Nuværende version</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-current-version">
              v{currentVersion}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlet resultat</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-result">
              {fmtDKK.format(totalResult)}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/40">
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Budgetter</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-count">
              {items.length}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Target className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen budgetversioner endnu. Opret et budget for at starte.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Navn</th>
                <th className="px-3 py-2 font-medium">År</th>
                <th className="px-3 py-2 font-medium">Scenarie</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium text-right">Indtægter</th>
                <th className="px-3 py-2 font-medium text-right">Omkostninger</th>
                <th className="px-3 py-2 font-medium text-right">Resultat</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const result = Number(item.totalResult ?? 0);
                const isPositive = result >= 0;
                return (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{item.name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{item.year ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge color={SCENARIO_COLOR[item.scenario ?? ""] ?? "gray"}>
                        {SCENARIO_LABEL[item.scenario ?? ""] ?? item.scenario}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                        v{item.version ?? 1}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(Number(item.totalRevenue ?? 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDKK.format(Number(item.totalCosts ?? 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {fmtDKK.format(result)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={STATUS_COLOR[item.status ?? "kladde"] ?? "gray"}>
                        {STATUS_LABEL[item.status ?? "kladde"] ?? item.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === "kladde" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`approve-btn-${item.id}`}
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(item.id)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Godkend
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`edit-btn-${item.id}`}
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          data-testid={`delete-btn-${item.id}`}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(item.id)}
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

      <BudgetDialog
        key={editing ? `edit-${editing.id}` : "new"}
        open={open}
        editing={editing}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        onSubmit={(body) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, body });
          } else {
            createMutation.mutate(body);
          }
        }}
        pending={createMutation.isPending || updateMutation.isPending}
        nextVersion={currentVersion + 1}
      />
    </div>
  );
}

/* ---------- dialog ---------- */

function BudgetDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
  nextVersion,
}: {
  open: boolean;
  editing: BudgetVersion | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
  nextVersion: number;
}) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(currentYear()));
  const [scenario, setScenario] = useState<string>("basis");
  const [totalRevenue, setTotalRevenue] = useState("");
  const [totalCosts, setTotalCosts] = useState("");
  const [status, setStatus] = useState("kladde");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name ?? "");
      setYear(String(editing.year ?? currentYear()));
      setScenario(editing.scenario ?? "basis");
      setTotalRevenue(String(editing.totalRevenue ?? ""));
      setTotalCosts(String(editing.totalCosts ?? ""));
      setStatus(editing.status ?? "kladde");
    } else {
      setName("");
      setYear(String(currentYear()));
      setScenario("basis");
      setTotalRevenue("");
      setTotalCosts("");
      setStatus("kladde");
    }
  }, [open, editing]);

  const revenue = Number(totalRevenue) || 0;
  const costs = Number(totalCosts) || 0;
  // Auto-calc resultat
  const totalResult = revenue - costs;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim() || null,
      year: Number(year) || currentYear(),
      scenario,
      version: editing?.version ?? nextVersion,
      totalRevenue: revenue,
      totalCosts: costs,
      totalResult,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Rediger budget" : "Opret budget"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Navn</Label>
            <Input
              id="b-name"
              data-testid="form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Budget 2026 — drift"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-year">År</Label>
              <Input
                id="b-year"
                type="number"
                data-testid="form-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scenarie</Label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger data-testid="form-scenario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SCENARIO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-revenue">Samlede indtægter (DKK)</Label>
              <Input
                id="b-revenue"
                type="number"
                inputMode="decimal"
                data-testid="form-totalRevenue"
                value={totalRevenue}
                onChange={(e) => setTotalRevenue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-costs">Samlede omkostninger (DKK)</Label>
              <Input
                id="b-costs"
                type="number"
                inputMode="decimal"
                data-testid="form-totalCosts"
                value={totalCosts}
                onChange={(e) => setTotalCosts(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-result">Samlet resultat (auto)</Label>
            <Input
              id="b-result"
              data-testid="form-totalResult"
              value={fmtDKK.format(totalResult)}
              readOnly
              className="bg-muted/40 font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Version</Label>
            <Input
              data-testid="form-version"
              value={`v${editing?.version ?? nextVersion}`}
              readOnly
              className="bg-muted/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="form-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="form-cancel"
              onClick={() => onOpenChange(false)}
            >
              Annuller
            </Button>
            <Button type="submit" disabled={pending} data-testid="form-save">
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

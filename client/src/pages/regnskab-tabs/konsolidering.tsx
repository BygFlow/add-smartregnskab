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
import { Plus, Trash2, Pencil, GitMerge, Layers, Building2 } from "lucide-react";

/* Konsolidering — gruppekonsolidering og elimineringer */

type ConsolidationEntry = {
  id: number;
  companyId?: number | null;
  period?: string | null;
  parentCompany?: string | null;
  subsidiaryCompany?: string | null;
  type?: string | null;
  accountNumber?: string | null;
  description?: string | null;
  amount?: number | null;
  eliminationType?: string | null;
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
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
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

const TYPE_COLOR: Record<string, string> = {
  eliminering: "blue",
  intern_handel: "green",
  intercompany: "orange",
  goodwill: "purple",
};

const TYPE_LABEL: Record<string, string> = {
  eliminering: "Eliminering",
  intern_handel: "Intern handel",
  intercompany: "Intercompany",
  goodwill: "Goodwill",
};

const STATUS_COLOR: Record<string, string> = {
  kladde: "gray",
  bogført: "green",
};

const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  bogført: "Bogført",
};

const TYPES = ["eliminering", "intern_handel", "intercompany", "goodwill"] as const;
const STATUSES = ["kladde", "bogført"] as const;

function currentPeriod() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

export default function Konsolidering({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsolidationEntry | null>(null);

  const queryKey = ["/api/consolidation", companyId] as const;

  const { data, isLoading } = useQuery<ConsolidationEntry[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/consolidation?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = data ?? [];

  const totalEliminations = items.reduce(
    (sum, i) => sum + (Number(i.amount) || 0),
    0,
  );
  const currentPeriodValue = items[0]?.period ?? currentPeriod();

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/consolidation?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering oprettet", description: "Konsolideringspost er tilføjet." });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette postering", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/consolidation/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering opdateret" });
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
      apiRequest("DELETE", `/api/consolidation/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/consolidation/${id}?companyId=${companyId}`, { status: "bogført" })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering bogført" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke bogføre", description: message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: ConsolidationEntry) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Konsolidering</h2>
          <p className="text-sm text-muted-foreground">
            Gruppekonsolidering med eliminering af intern handel, intercompany og goodwill.
          </p>
        </div>
        <Button data-testid="add-entry-btn" onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Tilføj postering
        </Button>
      </div>

      {/* Sammenfatning */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlede elimineringer</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-eliminations">
              {fmtDKK.format(totalEliminations)}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <GitMerge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Periode</div>
            <div className="text-lg font-semibold" data-testid="summary-period">
              {currentPeriodValue}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/40">
            <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Posteringer</div>
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
          <GitMerge className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen konsolideringsposter endnu. Tilføj en postering for at starte.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Periode</th>
                <th className="px-3 py-2 font-medium">Moderselskab</th>
                <th className="px-3 py-2 font-medium">Datterselskab</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Konto</th>
                <th className="px-3 py-2 font-medium">Beskrivelse</th>
                <th className="px-3 py-2 font-medium text-right">Beløb</th>
                <th className="px-3 py-2 font-medium">Elimineringstype</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{entry.period ?? "—"}</td>
                  <td className="px-3 py-2">{entry.parentCompany ?? "—"}</td>
                  <td className="px-3 py-2">{entry.subsidiaryCompany ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge color={TYPE_COLOR[entry.type ?? ""] ?? "gray"}>
                      {TYPE_LABEL[entry.type ?? ""] ?? entry.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums">{entry.accountNumber ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[16rem] truncate text-muted-foreground">
                    {entry.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmtDKK.format(Number(entry.amount ?? 0))}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={TYPE_COLOR[entry.eliminationType ?? ""] ?? "gray"}>
                      {TYPE_LABEL[entry.eliminationType ?? ""] ?? entry.eliminationType}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={STATUS_COLOR[entry.status ?? "kladde"] ?? "gray"}>
                      {STATUS_LABEL[entry.status ?? "kladde"] ?? entry.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {entry.status !== "bogført" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`book-btn-${entry.id}`}
                          disabled={bookMutation.isPending}
                          onClick={() => bookMutation.mutate(entry.id)}
                        >
                          Bogfør
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`edit-btn-${entry.id}`}
                        onClick={() => openEdit(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        data-testid={`delete-btn-${entry.id}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr className="font-medium">
                <td className="px-3 py-2" colSpan={6}>Samlede elimineringer</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(totalEliminations)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ConsolidationDialog
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
      />
    </div>
  );
}

/* ---------- dialog ---------- */

function ConsolidationDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: ConsolidationEntry | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [parentCompany, setParentCompany] = useState("");
  const [subsidiaryCompany, setSubsidiaryCompany] = useState("");
  const [type, setType] = useState<string>("eliminering");
  const [accountNumber, setAccountNumber] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [eliminationType, setEliminationType] = useState<string>("eliminering");
  const [status, setStatus] = useState("kladde");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPeriod(editing.period ?? currentPeriod());
      setParentCompany(editing.parentCompany ?? "");
      setSubsidiaryCompany(editing.subsidiaryCompany ?? "");
      setType(editing.type ?? "eliminering");
      setAccountNumber(editing.accountNumber ?? "");
      setDescription(editing.description ?? "");
      setAmount(String(editing.amount ?? ""));
      setEliminationType(editing.eliminationType ?? "eliminering");
      setStatus(editing.status ?? "kladde");
    } else {
      setPeriod(currentPeriod());
      setParentCompany("");
      setSubsidiaryCompany("");
      setType("eliminering");
      setAccountNumber("");
      setDescription("");
      setAmount("");
      setEliminationType("eliminering");
      setStatus("kladde");
    }
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      period,
      parentCompany: parentCompany.trim() || null,
      subsidiaryCompany: subsidiaryCompany.trim() || null,
      type,
      accountNumber: accountNumber.trim() || null,
      description: description.trim() || null,
      amount: Number(amount) || 0,
      eliminationType,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Rediger postering" : "Tilføj postering"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-period">Periode (YYYY-MM)</Label>
              <Input
                id="c-period"
                data-testid="form-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-08"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-account">Kontonummer</Label>
              <Input
                id="c-account"
                data-testid="form-accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="F.eks. 1200"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-parent">Moderselskab</Label>
              <Input
                id="c-parent"
                data-testid="form-parentCompany"
                value={parentCompany}
                onChange={(e) => setParentCompany(e.target.value)}
                placeholder="F.eks. Holding A/S"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-subsidiary">Datterselskab</Label>
              <Input
                id="c-subsidiary"
                data-testid="form-subsidiaryCompany"
                value={subsidiaryCompany}
                onChange={(e) => setSubsidiaryCompany(e.target.value)}
                placeholder="F.eks. Datter ApS"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Elimineringstype</Label>
              <Select value={eliminationType} onValueChange={setEliminationType}>
                <SelectTrigger data-testid="form-eliminationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Beskrivelse</Label>
            <Input
              id="c-desc"
              data-testid="form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. Eliminering af intern salg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-amount">Beløb (DKK)</Label>
              <Input
                id="c-amount"
                type="number"
                inputMode="decimal"
                data-testid="form-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
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
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret postering"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

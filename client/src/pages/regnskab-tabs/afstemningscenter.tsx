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
  Landmark,
  CheckCircle2,
  XCircle,
  Scale,
} from "lucide-react";

/* Afstemningscenter — automatisk afstemning af konti */

type Reconciliation = {
  id: number;
  companyId?: number | null;
  period?: string | null;
  type?: string | null;
  accountNumber?: string | null;
  bookAmount?: number | null;
  externalAmount?: number | null;
  difference?: number | null;
  matchedTransactions?: number | null;
  unmatchedTransactions?: number | null;
  autoMatched?: number | boolean | null;
  status?: string | null;
  createdAt?: string | null;
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 2,
});

/* ---------- farver & labels ---------- */

const BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  yellow: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
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
  bank: "blue",
  debitor: "green",
  kreditor: "orange",
  moms: "purple",
  skattekonto: "red",
  lon: "teal",
  lager: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  bank: "Bank",
  debitor: "Debitor",
  kreditor: "Kreditor",
  moms: "Moms",
  skattekonto: "Skattekonto",
  lon: "Løn",
  lager: "Lager",
};

const STATUS_COLOR: Record<string, string> = {
  afventer: "yellow",
  afstemt: "green",
  uafstemt: "red",
};

const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  afstemt: "Afstemt",
  uafstemt: "Uafstemt",
};

const TYPES = ["bank", "debitor", "kreditor", "moms", "skattekonto", "lon", "lager"] as const;
const STATUSES = ["afventer", "afstemt", "uafstemt"] as const;

function currentPeriod() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

// Farvekodning af difference: green = 0, yellow < 100, red > 100
function diffColor(diff: number): string {
  const abs = Math.abs(diff);
  if (abs === 0) return "green";
  if (abs < 100) return "yellow";
  return "red";
}

export default function Afstemningscenter({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reconciliation | null>(null);

  const queryKey = ["/api/reconciliation-center", companyId] as const;

  const { data, isLoading } = useQuery<Reconciliation[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reconciliation-center?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = data ?? [];

  const totalMatched = items.reduce((sum, i) => sum + (Number(i.matchedTransactions) || 0), 0);
  const totalUnmatched = items.reduce((sum, i) => sum + (Number(i.unmatchedTransactions) || 0), 0);
  const totalDifferences = items.reduce((sum, i) => sum + Math.abs(Number(i.difference) || 0), 0);

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/reconciliation-center?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Afstemning oprettet", description: "Afstemning er oprettet." });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette afstemning", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/reconciliation-center/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Afstemning opdateret" });
      setOpen(false);
      setEditing(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: Reconciliation) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Afstemningscenter</h2>
          <p className="text-sm text-muted-foreground">
            Automatisk afstemning af bank, debitor, kreditor, moms, skattekonto, løn og lager.
          </p>
        </div>
        <Button data-testid="add-recon-btn" onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Opret afstemning
        </Button>
      </div>

      {/* Sammenfatning */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlede matchede</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-matched">
              {totalMatched}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/40">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlede uafstemte</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-unmatched">
              {totalUnmatched}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950/40">
            <Scale className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlele difference</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-differences">
              {fmtDKK.format(totalDifferences)}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Landmark className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen afstemninger endnu. Opret en afstemning for at starte.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Periode</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Konto</th>
                <th className="px-3 py-2 font-medium text-right">Bogført</th>
                <th className="px-3 py-2 font-medium text-right">Ekstern</th>
                <th className="px-3 py-2 font-medium text-right">Difference</th>
                <th className="px-3 py-2 font-medium text-right">Matchede</th>
                <th className="px-3 py-2 font-medium text-right">Uafstemte</th>
                <th className="px-3 py-2 font-medium">Auto</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const diff = Number(item.difference ?? 0);
                const dColor = diffColor(diff);
                return (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">{item.period ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge color={TYPE_COLOR[item.type ?? ""] ?? "gray"}>
                        {TYPE_LABEL[item.type ?? ""] ?? item.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums">{item.accountNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(Number(item.bookAmount ?? 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(Number(item.externalAmount ?? 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Badge color={dColor}>{fmtDKK.format(diff)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.matchedTransactions ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.unmatchedTransactions ?? 0}</td>
                    <td className="px-3 py-2">
                      {item.autoMatched ? (
                        <Badge color="green">Ja</Badge>
                      ) : (
                        <Badge color="gray">Nej</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={STATUS_COLOR[item.status ?? "afventer"] ?? "gray"}>
                        {STATUS_LABEL[item.status ?? "afventer"] ?? item.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {item.status !== "afstemt" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`reconcile-btn-${item.id}`}
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                id: item.id,
                                body: {
                                  status: "afstemt",
                                  difference: 0,
                                },
                              })
                            }
                          >
                            Afstem
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`edit-btn-${item.id}`}
                          onClick={() => openEdit(item)}
                        >
                          Rediger
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr className="font-medium">
                <td className="px-3 py-2" colSpan={6}>I alt</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalMatched}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalUnmatched}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ReconciliationDialog
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

function ReconciliationDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: Reconciliation | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [type, setType] = useState<string>("bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [bookAmount, setBookAmount] = useState("");
  const [externalAmount, setExternalAmount] = useState("");
  const [matchedTransactions, setMatchedTransactions] = useState("");
  const [unmatchedTransactions, setUnmatchedTransactions] = useState("");
  const [autoMatched, setAutoMatched] = useState(false);
  const [status, setStatus] = useState("afventer");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPeriod(editing.period ?? currentPeriod());
      setType(editing.type ?? "bank");
      setAccountNumber(editing.accountNumber ?? "");
      setBookAmount(String(editing.bookAmount ?? ""));
      setExternalAmount(String(editing.externalAmount ?? ""));
      setMatchedTransactions(String(editing.matchedTransactions ?? ""));
      setUnmatchedTransactions(String(editing.unmatchedTransactions ?? ""));
      setAutoMatched(!!editing.autoMatched);
      setStatus(editing.status ?? "afventer");
    } else {
      setPeriod(currentPeriod());
      setType("bank");
      setAccountNumber("");
      setBookAmount("");
      setExternalAmount("");
      setMatchedTransactions("");
      setUnmatchedTransactions("");
      setAutoMatched(false);
      setStatus("afventer");
    }
  }, [open, editing]);

  const bookNum = Number(bookAmount) || 0;
  const extNum = Number(externalAmount) || 0;
  // Auto-calc difference
  const difference = bookNum - extNum;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      period,
      type,
      accountNumber: accountNumber.trim() || null,
      bookAmount: bookNum,
      externalAmount: extNum,
      difference,
      matchedTransactions: Number(matchedTransactions) || 0,
      unmatchedTransactions: Number(unmatchedTransactions) || 0,
      autoMatched: autoMatched ? 1 : 0,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Rediger afstemning" : "Opret afstemning"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-period">Periode (YYYY-MM)</Label>
              <Input
                id="r-period"
                data-testid="form-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-08"
              />
            </div>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-account">Kontonummer</Label>
            <Input
              id="r-account"
              data-testid="form-accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="F.eks. 5400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-book">Bogført beløb (DKK)</Label>
              <Input
                id="r-book"
                type="number"
                inputMode="decimal"
                step="0.01"
                data-testid="form-bookAmount"
                value={bookAmount}
                onChange={(e) => setBookAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-external">Eksternt beløb (DKK)</Label>
              <Input
                id="r-external"
                type="number"
                inputMode="decimal"
                step="0.01"
                data-testid="form-externalAmount"
                value={externalAmount}
                onChange={(e) => setExternalAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-diff">Difference (auto)</Label>
            <Input
              id="r-diff"
              data-testid="form-difference"
              value={fmtDKK.format(difference)}
              readOnly
              className={`font-medium ${
                diffColor(difference) === "green"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                  : diffColor(difference) === "yellow"
                    ? "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400"
                    : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
              }`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-matched">Matchede transaktioner</Label>
              <Input
                id="r-matched"
                type="number"
                data-testid="form-matchedTransactions"
                value={matchedTransactions}
                onChange={(e) => setMatchedTransactions(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-unmatched">Uafstemte transaktioner</Label>
              <Input
                id="r-unmatched"
                type="number"
                data-testid="form-unmatchedTransactions"
                value={unmatchedTransactions}
                onChange={(e) => setUnmatchedTransactions(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Auto-match</Label>
              <Select
                value={autoMatched ? "ja" : "nej"}
                onValueChange={(v) => setAutoMatched(v === "ja")}
              >
                <SelectTrigger data-testid="form-autoMatched">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">Ja</SelectItem>
                  <SelectItem value="nej">Nej</SelectItem>
                </SelectContent>
              </Select>
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
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret afstemning"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

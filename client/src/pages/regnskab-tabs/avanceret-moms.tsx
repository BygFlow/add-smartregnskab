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
import { Plus, Trash2, Pencil, Receipt, Calculator, Globe } from "lucide-react";

/* Avanceret moms — avanceret momsbehandling og fradrag */

type AdvancedVatEntry = {
  id: number;
  companyId?: number | null;
  period?: string | null;
  vatType?: string | null;
  country?: string | null;
  basis?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  deductionRate?: number | null;
  deductibleAmount?: number | null;
  description?: string | null;
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
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
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

const VAT_TYPE_COLOR: Record<string, string> = {
  indenlandsk: "blue",
  eu_med_vat: "green",
  eu_uden_vat: "teal",
  reverse_charge: "orange",
  import_moms: "purple",
  oss: "red",
  intrastat: "gray",
};

const VAT_TYPE_LABEL: Record<string, string> = {
  indenlandsk: "Indenlandsk",
  eu_med_vat: "EU m/ moms",
  eu_uden_vat: "EU u/ moms",
  reverse_charge: "Reverse charge",
  import_moms: "Importmoms",
  oss: "OSS",
  intrastat: "Intrastat",
};

const COUNTRY_COLOR: Record<string, string> = {
  DK: "blue",
  DE: "green",
  SE: "teal",
  NL: "orange",
  GB: "purple",
  FR: "red",
  PL: "gray",
  NO: "blue",
  FI: "green",
};

const VAT_TYPES = [
  "indenlandsk",
  "eu_med_vat",
  "eu_uden_vat",
  "reverse_charge",
  "import_moms",
  "oss",
  "intrastat",
] as const;

const COUNTRIES = ["DK", "DE", "SE", "NL", "GB", "FR", "PL", "NO", "FI"] as const;

function currentPeriod() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

export default function AvanceretMoms({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdvancedVatEntry | null>(null);

  const queryKey = ["/api/advanced-vat", companyId] as const;

  const { data, isLoading } = useQuery<AdvancedVatEntry[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/advanced-vat?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = data ?? [];

  const totalVat = items.reduce((sum, i) => sum + (Number(i.vatAmount) || 0), 0);
  const totalDeductible = items.reduce(
    (sum, i) => sum + (Number(i.deductibleAmount) || 0),
    0,
  );

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/advanced-vat?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering oprettet", description: "Momspostering er tilføjet." });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette postering", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/advanced-vat/${id}?companyId=${companyId}`, body)).json(),
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
      apiRequest("DELETE", `/api/advanced-vat/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: AdvancedVatEntry) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Avanceret moms</h2>
          <p className="text-sm text-muted-foreground">
            Avanceret momsbehandling med fradragsberegning for indenlandsk, EU, import, OSS og Intrastat.
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
            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlet moms</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-vat">
              {fmtDKK.format(totalVat)}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <Calculator className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlet fradragsberettiget</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-deductible">
              {fmtDKK.format(totalDeductible)}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/40">
            <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
          <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen momsposteringer endnu. Tilføj en postering for at starte.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Periode</th>
                <th className="px-3 py-2 font-medium">Momstype</th>
                <th className="px-3 py-2 font-medium">Land</th>
                <th className="px-3 py-2 font-medium text-right">Grundlag</th>
                <th className="px-3 py-2 font-medium text-right">Moms %</th>
                <th className="px-3 py-2 font-medium text-right">Momsbeløb</th>
                <th className="px-3 py-2 font-medium text-right">Fradrag %</th>
                <th className="px-3 py-2 font-medium text-right">Fradragsbeløb</th>
                <th className="px-3 py-2 font-medium">Beskrivelse</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{entry.period ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge color={VAT_TYPE_COLOR[entry.vatType ?? ""] ?? "gray"}>
                      {VAT_TYPE_LABEL[entry.vatType ?? ""] ?? entry.vatType}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={COUNTRY_COLOR[entry.country ?? ""] ?? "gray"}>
                      {entry.country ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(Number(entry.basis ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {Number(entry.vatRate ?? 0).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmtDKK.format(Number(entry.vatAmount ?? 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {Number(entry.deductionRate ?? 0).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmtDKK.format(Number(entry.deductibleAmount ?? 0))}
                  </td>
                  <td className="px-3 py-2 max-w-[14rem] truncate text-muted-foreground">
                    {entry.description ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
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
                <td className="px-3 py-2" colSpan={5}>I alt</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(totalVat)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(totalDeductible)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <VatDialog
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

function VatDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: AdvancedVatEntry | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [vatType, setVatType] = useState<string>("indenlandsk");
  const [country, setCountry] = useState<string>("DK");
  const [basis, setBasis] = useState("");
  const [vatRate, setVatRate] = useState("25");
  const [deductionRate, setDeductionRate] = useState("100");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPeriod(editing.period ?? currentPeriod());
      setVatType(editing.vatType ?? "indenlandsk");
      setCountry(editing.country ?? "DK");
      setBasis(String(editing.basis ?? ""));
      setVatRate(String(editing.vatRate ?? "25"));
      setDeductionRate(String(editing.deductionRate ?? "100"));
      setDescription(editing.description ?? "");
    } else {
      setPeriod(currentPeriod());
      setVatType("indenlandsk");
      setCountry("DK");
      setBasis("");
      setVatRate("25");
      setDeductionRate("100");
      setDescription("");
    }
  }, [open, editing]);

  // Auto-calc: vatAmount = basis * vatRate / 100
  const basisNum = Number(basis) || 0;
  const vatRateNum = Number(vatRate) || 0;
  const deductionRateNum = Number(deductionRate) || 0;
  const vatAmount = (basisNum * vatRateNum) / 100;
  // deductibleAmount = vatAmount * deductionRate / 100
  const deductibleAmount = (vatAmount * deductionRateNum) / 100;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      period,
      vatType,
      country,
      basis: basisNum,
      vatRate: vatRateNum,
      vatAmount,
      deductionRate: deductionRateNum,
      deductibleAmount,
      description: description.trim() || null,
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
              <Label htmlFor="v-period">Periode (YYYY-MM)</Label>
              <Input
                id="v-period"
                data-testid="form-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-08"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-country">Land</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger data-testid="form-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Momstype</Label>
            <Select value={vatType} onValueChange={setVatType}>
              <SelectTrigger data-testid="form-vatType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {VAT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-basis">Grundlag (DKK)</Label>
              <Input
                id="v-basis"
                type="number"
                inputMode="decimal"
                step="0.01"
                data-testid="form-basis"
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-vatRate">Moms %</Label>
              <Input
                id="v-vatRate"
                type="number"
                inputMode="decimal"
                step="0.1"
                data-testid="form-vatRate"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                placeholder="25"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-deductionRate">Fradrag %</Label>
              <Input
                id="v-deductionRate"
                type="number"
                inputMode="decimal"
                step="1"
                data-testid="form-deductionRate"
                value={deductionRate}
                onChange={(e) => setDeductionRate(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-vatAmount">Momsbeløb (auto)</Label>
              <Input
                id="v-vatAmount"
                data-testid="form-vatAmount"
                value={fmtDKK.format(vatAmount)}
                readOnly
                className="bg-muted/40 font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-deductible">Fradragsbeløb (auto)</Label>
              <Input
                id="v-deductible"
                data-testid="form-deductibleAmount"
                value={fmtDKK.format(deductibleAmount)}
                readOnly
                className="bg-muted/40 font-medium"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-desc">Beskrivelse</Label>
            <Input
              id="v-desc"
              data-testid="form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. Køb fra tysk leverandør"
            />
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

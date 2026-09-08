import { useState, useMemo, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { Plus, Trash2, Pencil, ArrowLeftRight, Coins, Receipt } from "lucide-react";

/* ---------- hjælpere ---------- */

function money(value?: number | null) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}
function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- farver & labels ---------- */

const CURRENCY_VARIANT: Record<string, "blue" | "green" | "purple" | "gray"> = {
  EUR: "blue",
  USD: "green",
  GBP: "purple",
};
const VAT_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  eu_moms: "blue",
  reverse_charge: "amber",
  oss: "green",
  intrastat: "red",
};
const VAT_LABEL: Record<string, string> = {
  eu_moms: "EU-moms",
  reverse_charge: "Reverse charge",
  oss: "OSS",
  intrastat: "Intrastat",
};
const STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  kladde: "amber",
  bogført: "green",
  afstemt: "blue",
  afvist: "red",
};
const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  bogført: "Bogført",
  afstemt: "Afstemt",
  afvist: "Afvist",
};

const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "CHF"] as const;
const VAT_TYPES = ["eu_moms", "reverse_charge", "oss", "intrastat"] as const;

/* ---------- typer ---------- */

type CurrencyTransaction = {
  id: number;
  date?: string | null;
  currency: string;
  amount: number;
  rate: number;
  dkkAmount: number;
  vatType: string;
  description?: string | null;
  status: string;
};

/* ---------- komponent ---------- */

export default function ValutaMoms({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CurrencyTransaction | null>(null);

  const queryKey = useMemo(
    () => ["/api/currency-transactions", companyId] as const,
    [companyId],
  );

  const { data, isLoading } = useQuery<CurrencyTransaction[]>({
    queryKey,
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/currency-transactions?companyId=${companyId}`,
        )
      ).json(),
  });

  const items = data ?? [];
  const totalDkk = items.reduce(
    (sum, i) => sum + (Number(i.dkkAmount) || 0),
    0,
  );

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/currency-transactions?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering oprettet" });
      setOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/currency-transactions/${id}?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering opdateret" });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) =>
      toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(
        "DELETE",
        `/api/currency-transactions/${id}?companyId=${companyId}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Postering slettet" });
    },
    onError: (e: Error) =>
      toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: CurrencyTransaction) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Valuta & udenlandsk moms"
        description="Valutaposteringer, kurser og udenlandsk moms (EU-moms, reverse charge, OSS, Intrastat)."
        action={
          <Button data-testid="add-tx-btn" onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Tilføj postering
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
        <MetricCard
          icon={<Coins className="w-4 h-4" />}
          value={money(totalDkk)}
          label="Samlet i DKK"
          variant="primary"
          valueTestId="total-dkk-amount"
        />
        <MetricCard
          icon={<ArrowLeftRight className="w-4 h-4" />}
          value={items.length}
          label="Posteringer"
          variant="blue"
        />
        <MetricCard
          icon={<Receipt className="w-4 h-4" />}
          value={items.filter((i) => i.status === "afstemt").length}
          label="Afstemte"
          variant="green"
        />
      </div>

      <SectionCard
        title="Valutaposteringer"
        icon={<Coins className="w-4 h-4" />}
        noPadding
      >
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Ingen valutaposteringer endnu. Tryk “Tilføj postering” for at oprette den første.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Dato</th>
                  <th className="px-3 py-2 font-medium">Valuta</th>
                  <th className="px-3 py-2 font-medium text-right">Beløb</th>
                  <th className="px-3 py-2 font-medium text-right">Kurs</th>
                  <th className="px-3 py-2 font-medium text-right">DKK</th>
                  <th className="px-3 py-2 font-medium">Moms-type</th>
                  <th className="px-3 py-2 font-medium">Beskrivelse</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {dk(tx.date)}
                    </td>
                    <td className="px-3 py-2">
                      <CurrencyBadge currency={tx.currency} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {new Intl.NumberFormat("da-DK", {
                        maximumFractionDigits: 2,
                      }).format(tx.amount)}{" "}
                      {tx.currency}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {tx.rate}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(tx.dkkAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip
                        data-testid={`vat-${tx.id}`}
                        status={VAT_LABEL[tx.vatType] ?? tx.vatType}
                        variant={VAT_VARIANT[tx.vatType] ?? "gray"}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-[18rem] truncate text-muted-foreground">
                      {tx.description || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip
                        data-testid={`status-${tx.id}`}
                        status={STATUS_LABEL[tx.status] ?? tx.status}
                        variant={STATUS_VARIANT[tx.status] ?? "gray"}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          data-testid={`edit-btn-${tx.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(tx)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          data-testid={`delete-btn-${tx.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(tx.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50">
                <tr className="font-medium">
                  <td className="px-3 py-2" colSpan={4}>I alt DKK</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(totalDkk)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <TxDialog
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

/* ---------- valuta-badge ---------- */

function CurrencyBadge({ currency }: { currency: string }) {
  const variant = CURRENCY_VARIANT[currency] ?? "gray";
  const cls: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  };
  return (
    <span
      data-testid={`currency-${currency}`}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls[variant]}`}
    >
      {currency}
    </span>
  );
}

/* ---------- dialog ---------- */

function TxDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: CurrencyTransaction | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [date, setDate] = useState(today());
  const [currency, setCurrency] = useState<string>("EUR");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [vatType, setVatType] = useState<string>("eu_moms");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("kladde");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.date?.slice(0, 10) ?? today());
      setCurrency(editing.currency ?? "EUR");
      setAmount(String(editing.amount ?? ""));
      setRate(String(editing.rate ?? ""));
      setVatType(editing.vatType ?? "eu_moms");
      setDescription(editing.description ?? "");
      setStatus(editing.status ?? "kladde");
    } else {
      setDate(today());
      setCurrency("EUR");
      setAmount("");
      setRate("");
      setVatType("eu_moms");
      setDescription("");
      setStatus("kladde");
    }
  }, [open, editing]);

  const amt = Number(amount) || 0;
  const r = Number(rate) || 0;
  const dkkAmount = amt * r;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      date,
      currency,
      amount: amt,
      rate: r,
      dkkAmount,
      vatType,
      description: description.trim() || null,
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
              <Label htmlFor="tx-date">Dato</Label>
              <Input
                id="tx-date"
                data-testid="input-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valuta</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger data-testid="input-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Beløb</Label>
              <Input
                id="tx-amount"
                data-testid="input-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-rate">Kurs</Label>
              <Input
                id="tx-rate"
                data-testid="input-rate"
                type="number"
                min="0"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-dkk">Beløb i DKK (auto)</Label>
            <Input
              id="tx-dkk"
              data-testid="input-dkkAmount"
              value={money(dkkAmount)}
              readOnly
              className="bg-muted/40 font-medium"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Moms-type</Label>
              <Select value={vatType} onValueChange={setVatType}>
                <SelectTrigger data-testid="input-vatType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {VAT_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="input-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kladde">Kladde</SelectItem>
                  <SelectItem value="bogført">Bogført</SelectItem>
                  <SelectItem value="afstemt">Afstemt</SelectItem>
                  <SelectItem value="afvist">Afvist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Beskrivelse</Label>
            <Input
              id="tx-desc"
              data-testid="input-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. Factura #12345, Leverandør GmbH"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="cancel-btn"
            >
              Annuller
            </Button>
            <Button type="submit" disabled={pending} data-testid="save-btn">
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret postering"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

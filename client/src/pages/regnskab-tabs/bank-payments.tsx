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
import { Plus, Check, X, Landmark } from "lucide-react";

/* Bankbetalinger — oprettelse, godkendelse og afsendelse */

type BankPayment = {
  id: number;
  companyId?: number | null;
  recipientName?: string | null;
  recipientAccount?: string | null;
  recipientReg?: string | null;
  amount?: string | null;
  currency?: string | null;
  paymentDate?: string | null;
  status?: string | null;
  bankStatus?: string | null;
  message?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  kladde: "badge-soft badge-soft-gray",
  til_godkendelse: "badge-soft badge-soft-amber",
  godkendt: "badge-soft badge-soft-blue",
  sendt: "badge-soft badge-soft-blue",
  gennemført: "badge-soft badge-soft-green",
  fejl: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  til_godkendelse: "Til godkendelse",
  godkendt: "Godkendt",
  sendt: "Sendt",
  gennemført: "Gennemført",
  fejl: "Fejl",
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

function fmtAmount(amount?: string | null, currency = "DKK"): string {
  const n = Number(amount);
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(n);
}

export default function BankPayments({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    recipientName: "",
    recipientAccount: "",
    recipientReg: "",
    amount: "",
    currency: "DKK",
    paymentDate: "",
    message: "",
  });

  const queryKey = ["/api/bank-payments", companyId];

  const { data, isLoading } = useQuery<BankPayment[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bank-payments?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const payments = data ?? [];

  const pending = payments.filter((p) => p.status === "til_godkendelse").length;
  const approved = payments.filter((p) => p.status === "godkendt").length;
  const totalAmount = payments
    .filter((p) => p.status !== "gennemført" && p.status !== "fejl")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bank-payments", {
        recipientName: form.recipientName,
        recipientAccount: form.recipientAccount,
        recipientReg: form.recipientReg || null,
        amount: form.amount,
        currency: form.currency,
        paymentDate: form.paymentDate || new Date().toISOString().slice(0, 10),
        status: "kladde",
        message: form.message || null,
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-payments"] });
      toast({ title: "Betaling oprettet", description: "Betalingen er oprettet som kladde." });
      setDialogOpen(false);
      setForm({
        recipientName: "",
        recipientAccount: "",
        recipientReg: "",
        amount: "",
        currency: "DKK",
        paymentDate: "",
        message: "",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette betaling", description: message, variant: "destructive" });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<BankPayment> }) => {
      const res = await apiRequest("PATCH", `/api/bank-payments/${id}?companyId=${companyId}`, patch);
      return await res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/bank-payments"] });
      const label =
        vars.patch.status === "godkendt"
          ? "Betaling godkendt — sendes ikke automatisk."
          : vars.patch.status === "afvist"
            ? "Betaling afvist."
            : "Betaling opdateret.";
      toast({ title: label });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Bankbetalinger</h2>
          <p className="text-sm text-muted-foreground">
            Opret, godkend og send betalinger via bankintegration. Afsendelse sker aldrig automatisk.
          </p>
        </div>
        <Button data-testid="create-payment-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret betaling
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Bankbetalinger (beta) — Kræver API-aftale hos bank.
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground">Til godkendelse</p>
          <p className="text-xl font-semibold" data-testid="summary-pending">{pending}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground">Godkendt</p>
          <p className="text-xl font-semibold" data-testid="summary-approved">{approved}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground">Samlet beløb (aktive)</p>
          <p className="text-xl font-semibold" data-testid="summary-amount">
            {new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(totalAmount)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : payments.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen betalinger endnu. Opret den første betaling ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Modtager</th>
                <th className="px-3 py-2">Konto / reg.</th>
                <th className="px-3 py-2">Beløb</th>
                <th className="px-3 py-2">Betalingsdato</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Bank-status</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p.id} data-testid={`payment-row-${p.id}`}>
                  <td className="px-3 py-2 font-medium">{p.recipientName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="font-mono text-xs">{p.recipientAccount ?? "—"}</span>
                    {p.recipientReg && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">/ {p.recipientReg}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{fmtAmount(p.amount, p.currency ?? "DKK")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(p.paymentDate)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={STATUS_STYLE[p.status ?? "kladde"] ?? "badge-soft badge-soft-gray"}
                      data-testid={`status-${p.id}`}
                    >
                      {STATUS_LABEL[p.status ?? "kladde"] ?? p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.bankStatus ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`approve-btn-${p.id}`}
                        disabled={p.status === "godkendt" || p.status === "gennemført"}
                        onClick={() => patchMut.mutate({ id: p.id, patch: { status: "godkendt" } })}
                      >
                        <Check className="h-3.5 w-3.5" /> Godkend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        data-testid={`reject-btn-${p.id}`}
                        disabled={p.status === "gennemført" || p.status === "fejl"}
                        onClick={() => patchMut.mutate({ id: p.id, patch: { status: "afvist" } })}
                      >
                        <X className="h-3.5 w-3.5" /> Afvis
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
            <DialogTitle>Opret betaling</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bp-recipient">Modtager</Label>
              <Input
                id="bp-recipient"
                data-testid="form-recipientName"
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                placeholder="F.eks. Leverandør A/S"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bp-reg">Reg.nr.</Label>
                <Input
                  id="bp-reg"
                  data-testid="form-recipientReg"
                  value={form.recipientReg}
                  onChange={(e) => setForm((f) => ({ ...f, recipientReg: e.target.value }))}
                  placeholder="F.eks. 1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-account">Kontonr.</Label>
                <Input
                  id="bp-account"
                  data-testid="form-recipientAccount"
                  value={form.recipientAccount}
                  onChange={(e) => setForm((f) => ({ ...f, recipientAccount: e.target.value }))}
                  placeholder="F.eks. 1234567890"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bp-amount">Beløb</Label>
                <Input
                  id="bp-amount"
                  type="number"
                  step="0.01"
                  data-testid="form-amount"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-currency">Valuta</Label>
                <Input
                  id="bp-currency"
                  data-testid="form-currency"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  placeholder="DKK"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-date">Betalingsdato</Label>
              <Input
                id="bp-date"
                type="date"
                data-testid="form-paymentDate"
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-msg">Besked til modtager</Label>
              <Input
                id="bp-msg"
                data-testid="form-message"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="F.eks. Faktura 12345"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={
                createMut.isPending ||
                !form.recipientName.trim() ||
                !form.amount.trim() ||
                !form.recipientAccount.trim()
              }
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Opret kladde"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

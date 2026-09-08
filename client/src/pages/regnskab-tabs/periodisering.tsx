import { useMemo, useState } from "react";
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
import { Plus, Trash2, CalendarClock } from "lucide-react";

/* Periodisering (accruals) */

type Accrual = {
  id: number;
  companyId?: number | null;
  description?: string | null;
  type?: string | null;
  amount?: number | null;
  monthlyAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  accountNumber?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

const ACCRUAL_TYPES = [
  { id: "forudbetalt", label: "Forudbetalt udgift" },
  { id: "skyldig", label: "Skyldig udgift" },
  { id: "tilbagevendende", label: "Tilbagevendende udgift" },
  { id: "lan", label: "Lån" },
  { id: "leasing", label: "Leasing" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ACCRUAL_TYPES.map((t) => [t.id, t.label]),
);

const TYPE_STYLE: Record<string, string> = {
  forudbetalt: "badge-soft badge-soft-blue",
  skyldig: "badge-soft badge-soft-amber",
  tilbagevendende: "badge-soft badge-soft-green",
  lan: "badge-soft badge-soft-red",
  leasing: "badge-soft badge-soft-gray",
};

const STATUS_STYLE: Record<string, string> = {
  aktiv: "badge-soft badge-soft-green",
  afsluttet: "badge-soft badge-soft-gray",
  pauset: "badge-soft badge-soft-amber",
};

const STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  afsluttet: "Afsluttet",
  pauset: "Pauset",
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 2,
});

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

/** Auto-beregn månedligt beløb (svarer til backendens beregning). */
function calcMonthly(amount: number, startDate: string, endDate: string): number {
  if (!amount || !startDate || !endDate) return 0;
  const months = Math.max(
    1,
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
    ),
  );
  return amount / months;
}

export default function Periodisering({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    type: "forudbetalt",
    amount: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    accountNumber: "",
    status: "aktiv",
  });

  const { data, isLoading } = useQuery<Accrual[]>({
    queryKey: ["/api/accruals", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/accruals");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const accruals = data ?? [];

  const previewMonthly = useMemo(
    () => calcMonthly(Number(form.amount) || 0, form.startDate, form.endDate),
    [form.amount, form.startDate, form.endDate],
  );

  const totalMonthly = accruals
    .filter((a) => a.status === "aktiv")
    .reduce((s, a) => s + Number(a.monthlyAmount ?? 0), 0);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accruals", {
        description: form.description,
        type: form.type,
        amount: Number(form.amount) || 0,
        startDate: form.startDate,
        endDate: form.endDate || null,
        accountNumber: form.accountNumber || null,
        status: form.status,
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accruals"] });
      toast({ title: "Periodisering oprettet", description: "Månedligt beløb er auto-beregnet." });
      setDialogOpen(false);
      setForm({
        description: "",
        type: "forudbetalt",
        amount: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        accountNumber: "",
        status: "aktiv",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette periodisering", description: message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Accrual> }) => {
      const res = await apiRequest("PATCH", `/api/accruals/${id}`, patch);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accruals"] });
      toast({ title: "Periodisering opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/accruals/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accruals"] });
      toast({ title: "Periodisering slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Periodisering</h2>
          <p className="text-sm text-muted-foreground">
            Periodisering af forudbetalte, skyldige og tilbagevendende udgifter.
          </p>
        </div>
        <Button data-testid="add-accrual-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj periodisering
        </Button>
      </div>

      <div className="kpi-card flex items-center gap-3">
        <CalendarClock className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">Samlet månedligt beløb (aktive)</div>
          <div className="text-lg font-semibold tabular-nums">{fmtDKK.format(totalMonthly)}</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : accruals.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen periodiseringer endnu. Tilføj den første periodisering ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="p-2">Beskrivelse</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-right">Beløb</th>
                <th className="p-2 text-right">Pr. måned</th>
                <th className="p-2">Periode</th>
                <th className="p-2">Konto</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {accruals.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{a.description ?? "—"}</td>
                  <td className="p-2">
                    <span className={`badge-soft ${TYPE_STYLE[a.type ?? "forudbetalt"] ?? "badge-soft badge-soft-gray"}`}>
                      {TYPE_LABEL[a.type ?? "forudbetalt"] ?? a.type}
                    </span>
                  </td>
                  <td className="p-2 text-right tabular-nums">{fmtDKK.format(Number(a.amount ?? 0))}</td>
                  <td className="p-2 text-right tabular-nums">{fmtDKK.format(Number(a.monthlyAmount ?? 0))}</td>
                  <td className="p-2 whitespace-nowrap text-xs">
                    {dkDate(a.startDate)} → {dkDate(a.endDate)}
                  </td>
                  <td className="p-2 whitespace-nowrap">{a.accountNumber ?? "—"}</td>
                  <td className="p-2">
                    <Select
                      value={a.status ?? "aktiv"}
                      onValueChange={(v) => updateMut.mutate({ id: a.id, patch: { status: v } })}
                    >
                      <SelectTrigger className="h-8 w-32" data-testid={`status-select-${a.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktiv">{STATUS_LABEL.aktiv}</SelectItem>
                        <SelectItem value="pauset">{STATUS_LABEL.pauset}</SelectItem>
                        <SelectItem value="afsluttet">{STATUS_LABEL.afsluttet}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      data-testid={`delete-${a.id}`}
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
            <DialogTitle>Tilføj periodisering</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ac-desc">Beskrivelse</Label>
              <Input
                id="ac-desc"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="F.eks. Forsikring 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-type">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger id="ac-type" data-testid="form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCRUAL_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-account">Kontonummer</Label>
              <Input
                id="ac-account"
                data-testid="form-accountNumber"
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                placeholder="F.eks. 1490"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-amount">Beløb (DKK)</Label>
              <Input
                id="ac-amount"
                type="number"
                inputMode="decimal"
                data-testid="form-amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger id="ac-status" data-testid="form-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">{STATUS_LABEL.aktiv}</SelectItem>
                  <SelectItem value="pauset">{STATUS_LABEL.pauset}</SelectItem>
                  <SelectItem value="afsluttet">{STATUS_LABEL.afsluttet}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-start">Startdato</Label>
              <Input
                id="ac-start"
                type="date"
                data-testid="form-startDate"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-end">Slutdato</Label>
              <Input
                id="ac-end"
                type="date"
                data-testid="form-endDate"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Auto-beregnet månedligt beløb: </span>
              <span className="font-semibold tabular-nums">{fmtDKK.format(previewMonthly)}</span>
              <span className="text-xs text-muted-foreground"> / måned</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.description.trim() || !form.amount}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Opret periodisering"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

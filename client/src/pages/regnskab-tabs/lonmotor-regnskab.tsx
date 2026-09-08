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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Check,
  Send,
  Users,
  Banknote,
  Wallet,
  ScrollText,
} from "lucide-react";

/* Lønmotor (beta) — fuld lønmotor med eIndkomst og FerieKonto */

type PayrollEntry = {
  id: number;
  companyId?: number | null;
  employeeName?: string | null;
  period?: string | null;
  payslipNumber?: string | null;
  grossSalary?: number | null;
  aTax?: number | null;
  atp?: number | null;
  amContribution?: number | null;
  holidayPay?: number | null;
  pension?: number | null;
  netSalary?: number | null;
  eindkomstStatus?: string | null;
  feriekontoStatus?: string | null;
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

const EINDKOMST_COLOR: Record<string, string> = {
  ikke_sendt: "gray",
  sendt: "blue",
  godkendt: "green",
};

const EINDKOMST_LABEL: Record<string, string> = {
  ikke_sendt: "Ikke sendt",
  sendt: "Sendt",
  godkendt: "Godkendt",
};

const FERIE_COLOR: Record<string, string> = {
  ikke_sendt: "gray",
  sendt: "blue",
  godkendt: "green",
};

const FERIE_LABEL: Record<string, string> = {
  ikke_sendt: "Ikke sendt",
  sendt: "Sendt",
  godkendt: "Godkendt",
};

const STATUS_COLOR: Record<string, string> = {
  kladde: "gray",
  godkendt: "green",
  sendt: "blue",
};

const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  godkendt: "Godkendt",
  sendt: "Sendt",
};

function currentPeriod() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

export default function LonmotorRegnskab({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const queryKey = ["/api/payroll-engine", companyId] as const;

  const { data, isLoading } = useQuery<PayrollEntry[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/payroll-engine?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = data ?? [];

  const totalGross = items.reduce((sum, i) => sum + (Number(i.grossSalary) || 0), 0);
  const totalNet = items.reduce((sum, i) => sum + (Number(i.netSalary) || 0), 0);
  const totalATax = items.reduce((sum, i) => sum + (Number(i.aTax) || 0), 0);

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/payroll-engine?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Lønseddel oprettet", description: "Lønsedlen er oprettet som kladde." });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette lønseddel", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/payroll-engine/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: (_data, { body }) => {
      qc.invalidateQueries({ queryKey });
      const patch = body as Partial<PayrollEntry>;
      toast({
        title: "Lønseddel opdateret",
        description: `Status: ${patch.status ?? patch.eindkomstStatus ?? "—"}`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Lønmotor</h2>
          <p className="text-sm text-muted-foreground">
            Fuld lønmotor med lønsedler, A-skat, ATP, AM-bidrag, feriepenge og pension.
          </p>
        </div>
        <Button data-testid="add-payslip-btn" onClick={() => setOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Opret lønseddel
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Lønmotor (beta) — Kræver eIndkomst API-aftale. AI sender aldrig automatisk.
      </div>

      {/* Sammenfatning */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlet brutto</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-gross">
              {fmtDKK.format(totalGross)}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlet netto</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-net">
              {fmtDKK.format(totalNet)}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/40">
            <ScrollText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlet A-skat</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-atax">
              {fmtDKK.format(totalATax)}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen lønsedler endnu. Opret en lønseddel for at starte.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Medarbejder</th>
                <th className="px-3 py-2 font-medium">Periode</th>
                <th className="px-3 py-2 font-medium">Lønnr.</th>
                <th className="px-3 py-2 font-medium text-right">Brutto</th>
                <th className="px-3 py-2 font-medium text-right">A-skat</th>
                <th className="px-3 py-2 font-medium text-right">ATP</th>
                <th className="px-3 py-2 font-medium text-right">AM-bidrag</th>
                <th className="px-3 py-2 font-medium text-right">Ferie</th>
                <th className="px-3 py-2 font-medium text-right">Pension</th>
                <th className="px-3 py-2 font-medium text-right">Netto</th>
                <th className="px-3 py-2 font-medium">eIndkomst</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{entry.employeeName ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{entry.period ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.payslipNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(Number(entry.grossSalary ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(Number(entry.aTax ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDKK.format(Number(entry.atp ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDKK.format(Number(entry.amContribution ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDKK.format(Number(entry.holidayPay ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDKK.format(Number(entry.pension ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtDKK.format(Number(entry.netSalary ?? 0))}</td>
                  <td className="px-3 py-2">
                    <Badge color={EINDKOMST_COLOR[entry.eindkomstStatus ?? "ikke_sendt"] ?? "gray"}>
                      {EINDKOMST_LABEL[entry.eindkomstStatus ?? "ikke_sendt"] ?? entry.eindkomstStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={STATUS_COLOR[entry.status ?? "kladde"] ?? "gray"}>
                      {STATUS_LABEL[entry.status ?? "kladde"] ?? entry.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {entry.status !== "godkendt" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`approve-btn-${entry.id}`}
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: entry.id,
                              body: { status: "godkendt" },
                            })
                          }
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Godkend
                        </Button>
                      )}
                      {entry.eindkomstStatus !== "godkendt" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`send-eindkomst-${entry.id}`}
                          disabled={updateMutation.isPending || entry.status !== "godkendt"}
                          onClick={() =>
                            updateMutation.mutate({
                              id: entry.id,
                              body: {
                                eindkomstStatus: "sendt",
                                status: "sendt",
                                feriekontoStatus: "sendt",
                              },
                            })
                          }
                          title={entry.status !== "godkendt" ? "Godkend lønseddel først" : undefined}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" /> Send til eIndkomst
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr className="font-medium">
                <td className="px-3 py-2" colSpan={3}>I alt</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(totalGross)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(totalATax)}</td>
                <td colSpan={4}></td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtDKK.format(totalNet)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PayslipDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(body) => createMutation.mutate(body)}
        pending={createMutation.isPending}
      />
    </div>
  );
}

/* ---------- dialog ---------- */

function PayslipDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [payslipNumber, setPayslipNumber] = useState("");
  const [grossSalary, setGrossSalary] = useState("");
  const [aTax, setATax] = useState("");
  const [atp, setAtp] = useState("");
  const [amContribution, setAmContribution] = useState("");
  const [holidayPay, setHolidayPay] = useState("");
  const [pension, setPension] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmployeeName("");
    setPeriod(currentPeriod());
    setPayslipNumber("");
    setGrossSalary("");
    setATax("");
    setAtp("");
    setAmContribution("");
    setHolidayPay("");
    setPension("");
  }, [open]);

  const gross = Number(grossSalary) || 0;
  const tax = Number(aTax) || 0;
  const atpVal = Number(atp) || 0;
  const amVal = Number(amContribution) || 0;
  const holidayVal = Number(holidayPay) || 0;
  const pensionVal = Number(pension) || 0;
  // Auto-calc netto
  const netSalary = gross - tax - atpVal - amVal - holidayVal - pensionVal;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      employeeName: employeeName.trim() || null,
      period,
      payslipNumber: payslipNumber.trim() || null,
      grossSalary: gross,
      aTax: tax,
      atp: atpVal,
      amContribution: amVal,
      holidayPay: holidayVal,
      pension: pensionVal,
      netSalary,
      eindkomstStatus: "ikke_sendt",
      feriekontoStatus: "ikke_sendt",
      status: "kladde",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opret lønseddel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Medarbejder</Label>
              <Input
                id="p-name"
                data-testid="form-employeeName"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="F.eks. Jens Hansen"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-period">Periode (YYYY-MM)</Label>
              <Input
                id="p-period"
                data-testid="form-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-08"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-payslip">Lønseddelnummer</Label>
              <Input
                id="p-payslip"
                data-testid="form-payslipNumber"
                value={payslipNumber}
                onChange={(e) => setPayslipNumber(e.target.value)}
                placeholder="F.eks. 2026-08-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-gross">Bruttoløn (DKK)</Label>
              <Input
                id="p-gross"
                type="number"
                inputMode="decimal"
                data-testid="form-grossSalary"
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-atax">A-skat (DKK)</Label>
              <Input
                id="p-atax"
                type="number"
                inputMode="decimal"
                data-testid="form-aTax"
                value={aTax}
                onChange={(e) => setATax(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-atp">ATP (DKK)</Label>
              <Input
                id="p-atp"
                type="number"
                inputMode="decimal"
                data-testid="form-atp"
                value={atp}
                onChange={(e) => setAtp(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-am">AM-bidrag (DKK)</Label>
              <Input
                id="p-am"
                type="number"
                inputMode="decimal"
                data-testid="form-amContribution"
                value={amContribution}
                onChange={(e) => setAmContribution(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-holiday">Feriepenge (DKK)</Label>
              <Input
                id="p-holiday"
                type="number"
                inputMode="decimal"
                data-testid="form-holidayPay"
                value={holidayPay}
                onChange={(e) => setHolidayPay(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pension">Pension (DKK)</Label>
              <Input
                id="p-pension"
                type="number"
                inputMode="decimal"
                data-testid="form-pension"
                value={pension}
                onChange={(e) => setPension(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-net">Nettoløn (auto)</Label>
            <Input
              id="p-net"
              data-testid="form-netSalary"
              value={fmtDKK.format(netSalary)}
              readOnly
              className="bg-muted/40 font-medium"
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
              {pending ? "Gemmer…" : "Opret lønseddel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

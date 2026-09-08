import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, CheckCircle2, Send, Wallet } from "lucide-react";

type PayrollStatus = "kladde" | "godkendt" | "sendt";

interface PayrollCalculation {
  id: number;
  companyId: number;
  employeeName: string;
  period?: string | null;
  baseHours?: number | string | null;
  overtimeHours?: number | string | null;
  holidayHours?: number | string | null;
  nightHours?: number | string | null;
  weekendHours?: number | string | null;
  basePay?: number | string | null;
  overtimePay?: number | string | null;
  holidayPay?: number | string | null;
  nightSurcharge?: number | string | null;
  weekendSurcharge?: number | string | null;
  mileageAllowance?: number | string | null;
  grossSalary?: number | string | null;
  netSalary?: number | string | null;
  vacationPay?: number | string | null;
  status: PayrollStatus;
}

const STATUS_LABELS: Record<PayrollStatus, string> = {
  kladde: "Kladde",
  godkendt: "Godkendt",
  sendt: "Sendt",
};

const STATUS_CLASSES: Record<PayrollStatus, string> = {
  kladde: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  godkendt: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  sendt: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

function money(value?: number | null): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function computeGross(values: Record<string, number>): number {
  return (
    values.basePay +
    values.overtimePay +
    values.holidayPay +
    values.nightSurcharge +
    values.weekendSurcharge +
    values.mileageAllowance
  );
}

function PayrollForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState("");
  const [baseHours, setBaseHours] = useState("0");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [holidayHours, setHolidayHours] = useState("0");
  const [nightHours, setNightHours] = useState("0");
  const [weekendHours, setWeekendHours] = useState("0");
  const [basePay, setBasePay] = useState("");
  const [overtimePay, setOvertimePay] = useState("");
  const [holidayPay, setHolidayPay] = useState("");
  const [nightSurcharge, setNightSurcharge] = useState("");
  const [weekendSurcharge, setWeekendSurcharge] = useState("");
  const [mileageAllowance, setMileageAllowance] = useState("");

  const vals: Record<string, number> = {
    basePay: num(basePay),
    overtimePay: num(overtimePay),
    holidayPay: num(holidayPay),
    nightSurcharge: num(nightSurcharge),
    weekendSurcharge: num(weekendSurcharge),
    mileageAllowance: num(mileageAllowance),
  };
  const gross = computeGross(vals);

  const submit = () => {
    if (!employeeName.trim()) return;
    onSubmit({
      employeeName: employeeName.trim(),
      period: period.trim() || null,
      baseHours: num(baseHours),
      overtimeHours: num(overtimeHours),
      holidayHours: num(holidayHours),
      nightHours: num(nightHours),
      weekendHours: num(weekendHours),
      basePay: vals.basePay,
      overtimePay: vals.overtimePay,
      holidayPay: vals.holidayPay,
      nightSurcharge: vals.nightSurcharge,
      weekendSurcharge: vals.weekendSurcharge,
      mileageAllowance: vals.mileageAllowance,
      grossSalary: gross,
      netSalary: gross * 0.63,
      vacationPay: gross * 0.12,
      status: "kladde",
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="payroll-employee">Medarbejder *</Label>
          <Input
            id="payroll-employee"
            data-testid="input-payroll-employee"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="F.eks. Jens Hansen"
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="payroll-period">Periode</Label>
          <Input
            id="payroll-period"
            data-testid="input-payroll-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="F.eks. 2026-08"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="payroll-base-hours">Basistimer</Label>
          <Input
            id="payroll-base-hours"
            data-testid="input-base-hours"
            type="number"
            value={baseHours}
            onChange={(e) => setBaseHours(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-overtime-hours">Overtid</Label>
          <Input
            id="payroll-overtime-hours"
            data-testid="input-overtime-hours"
            type="number"
            value={overtimeHours}
            onChange={(e) => setOvertimeHours(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-holiday-hours">Helligdagstimer</Label>
          <Input
            id="payroll-holiday-hours"
            data-testid="input-holiday-hours"
            type="number"
            value={holidayHours}
            onChange={(e) => setHolidayHours(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-night-hours">Nat-timer</Label>
          <Input
            id="payroll-night-hours"
            data-testid="input-night-hours"
            type="number"
            value={nightHours}
            onChange={(e) => setNightHours(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-weekend-hours">Weekend-timer</Label>
          <Input
            id="payroll-weekend-hours"
            data-testid="input-weekend-hours"
            type="number"
            value={weekendHours}
            onChange={(e) => setWeekendHours(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="payroll-base-pay">Basisløn (kr)</Label>
          <Input
            id="payroll-base-pay"
            data-testid="input-base-pay"
            type="number"
            value={basePay}
            onChange={(e) => setBasePay(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-overtime-pay">Overtidsbetaling (kr)</Label>
          <Input
            id="payroll-overtime-pay"
            data-testid="input-overtime-pay"
            type="number"
            value={overtimePay}
            onChange={(e) => setOvertimePay(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-holiday-pay">Helligdagsbetaling (kr)</Label>
          <Input
            id="payroll-holiday-pay"
            data-testid="input-holiday-pay"
            type="number"
            value={holidayPay}
            onChange={(e) => setHolidayPay(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-night-surcharge">Nattillæg (kr)</Label>
          <Input
            id="payroll-night-surcharge"
            data-testid="input-night-surcharge"
            type="number"
            value={nightSurcharge}
            onChange={(e) => setNightSurcharge(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-weekend-surcharge">Weekendtillæg (kr)</Label>
          <Input
            id="payroll-weekend-surcharge"
            data-testid="input-weekend-surcharge"
            type="number"
            value={weekendSurcharge}
            onChange={(e) => setWeekendSurcharge(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-mileage">Kørselsgodtgørelse (kr)</Label>
          <Input
            id="payroll-mileage"
            data-testid="input-mileage-allowance"
            type="number"
            value={mileageAllowance}
            onChange={(e) => setMileageAllowance(e.target.value)}
          />
        </div>
      </div>
      <div className="rounded-md border bg-muted/30 p-3 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Beregnet bruttoløn</span>
          <span
            className="font-semibold tabular-nums"
            data-testid="computed-gross-salary"
          >
            {money(gross)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimeret nettoløn (63%)</span>
          <span className="font-medium tabular-nums">{money(gross * 0.63)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Feriepenge (12%)</span>
          <span className="font-medium tabular-nums">{money(gross * 0.12)}</span>
        </div>
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-payroll"
          disabled={pending || !employeeName.trim()}
          onClick={submit}
        >
          <Calculator className="w-4 h-4 mr-1.5" />
          Opret lønberegning
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Lonmotor({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<PayrollCalculation[]>({
    queryKey: ["/api/payroll-calculations", companyId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/payroll-calculations?companyId=${companyId}`,
        )
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/payroll-calculations"] });

  const createPayroll = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/payroll-calculations?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Lønberegning oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette lønberegning",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: PayrollStatus }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/payroll-calculations/${id}?companyId=${companyId}`,
          { status },
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Status opdateret" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere status",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];

  const summary = useMemo(() => {
    const totalGross = items.reduce((s, i) => s + num(i.grossSalary), 0);
    const totalNet = items.reduce((s, i) => s + num(i.netSalary), 0);
    const totalVacation = items.reduce((s, i) => s + num(i.vacationPay), 0);
    return { totalGross, totalNet, totalVacation };
  }, [items]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-7xl mx-auto pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lønmotor</h1>
          <p className="text-sm text-muted-foreground">
            Lønberegning og overenskomstmotor
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-payroll" onClick={() => setOpen(true)}>
            <Calculator className="w-4 h-4 mr-1.5" />
            Opret lønberegning
          </Button>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Opret lønberegning</DialogTitle>
            </DialogHeader>
            <PayrollForm
              pending={createPayroll.isPending}
              onSubmit={(body) => createPayroll.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-gross">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet bruttoløn
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalGross)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-net">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet nettoløn
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalNet)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-vacation">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlede feriepenge
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalVacation)}
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-payroll"
        >
          <Calculator className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen lønberegninger endnu.
        </div>
      ) : (
        <Card data-testid="card-payroll-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Basistimer</TableHead>
                    <TableHead className="text-right">Overtid</TableHead>
                    <TableHead className="text-right">Helligdage</TableHead>
                    <TableHead className="text-right">Nat-timer</TableHead>
                    <TableHead className="text-right">Weekend</TableHead>
                    <TableHead className="text-right">Bruttoløn</TableHead>
                    <TableHead className="text-right">Nettoløn</TableHead>
                    <TableHead className="text-right">Feriepenge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      data-testid={`row-payroll-${item.id}`}
                    >
                      <TableCell className="font-medium max-w-40 truncate">
                        {item.employeeName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.period ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(item.baseHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(item.overtimeHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(item.holidayHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(item.nightHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(item.weekendHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {money(num(item.grossSalary))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(num(item.netSalary))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(num(item.vacationPay))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_CLASSES[item.status]}
                          data-testid={`badge-status-${item.id}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.status === "kladde" && (
                            <button
                              className="p-1.5 rounded-md hover:bg-muted text-green-600"
                              data-testid={`button-approve-${item.id}`}
                              onClick={() =>
                                updateStatus.mutate({
                                  id: item.id,
                                  status: "godkendt",
                                })
                              }
                              aria-label="Godkend"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {item.status === "godkendt" && (
                            <button
                              className="p-1.5 rounded-md hover:bg-muted text-blue-600"
                              data-testid={`button-send-${item.id}`}
                              onClick={() =>
                                updateStatus.mutate({
                                  id: item.id,
                                  status: "sendt",
                                })
                              }
                              aria-label="Send"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

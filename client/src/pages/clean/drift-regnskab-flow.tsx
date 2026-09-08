import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, Wallet, Car, FileText, CheckCircle2, ArrowRight,
} from "lucide-react";

/* ---------- Typer ---------- */

type ExportStatus = "eksporteret" | "bogfoert" | "fejlet";
type SourceType = "expense" | "mileage" | "timesheet";

interface AccountingExport {
  id: number; companyId: number; sourceType: SourceType; sourceId: number;
  exportDate: string | null; status: ExportStatus; voucherNumber: string | null;
  accountNumber: string | null; amount: number | string | null;
  description: string | null; exportedBy: number | null; createdAt: string;
}

interface ExpenseReport {
  id: number; companyId: number; amount: number | string | null; status: string;
}

interface MileageReport {
  id: number; companyId: number; kilometers: number | string | null;
  compensation: number | string | null; status: string;
}

/* ---------- Hjælpefunktioner ---------- */

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

const money = new Intl.NumberFormat("da-DK", {
  style: "currency", currency: "DKK", maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "2-digit", month: "2-digit", year: "numeric",
});

const fmtMoney = (v?: number | null) => money.format(v ?? 0);

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

const SOURCE_LABELS: Record<SourceType, string> = {
  expense: "Udgift",
  mileage: "Kørsel",
  timesheet: "Timeseddel",
};

const STATUS_STYLES: Record<ExportStatus, string> = {
  eksporteret: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  bogfoert: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  fejlet: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const STATUS_LABELS: Record<ExportStatus, string> = {
  eksporteret: "Eksporteret",
  bogfoert: "Bogført",
  fejlet: "Fejlet",
};

function isThisMonth(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function StatCard({
  label, value, icon: Icon, testId,
}: { label: string; value: string; icon: React.ElementType; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function DriftRegnskabFlow({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmType, setConfirmType] = useState<"expense" | "mileage" | null>(null);

  /* --- Queries --- */

  const expenseQ = useQuery<ExpenseReport[]>({
    queryKey: ["/api/expense-reports", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/expense-reports?companyId=${companyId}`)).json(),
  });
  const mileageQ = useQuery<MileageReport[]>({
    queryKey: ["/api/mileage-reports", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/mileage-reports?companyId=${companyId}`)).json(),
  });
  const exportsQ = useQuery<AccountingExport[]>({
    queryKey: ["/api/accounting-exports", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/accounting-exports?companyId=${companyId}`)).json(),
  });

  /* --- Godkendte poster klar til eksport --- */

  const approvedExpenses = useMemo(
    () => (expenseQ.data ?? []).filter((r) => r.status === "godkendt"), [expenseQ.data],
  );
  const approvedMileage = useMemo(
    () => (mileageQ.data ?? []).filter((r) => r.status === "godkendt"), [mileageQ.data],
  );
  const expenseTotal = useMemo(
    () => approvedExpenses.reduce((s, r) => s + num(r.amount), 0), [approvedExpenses],
  );
  const mileageKm = useMemo(
    () => approvedMileage.reduce((s, r) => s + num(r.kilometers), 0), [approvedMileage],
  );
  const mileageComp = useMemo(
    () => approvedMileage.reduce((s, r) => s + num(r.compensation), 0), [approvedMileage],
  );

  /* --- Stats for eksporteret sektion --- */

  const exports = exportsQ.data ?? [];
  const stats = useMemo(() => {
    const thisMonth = exports.filter((e) => isThisMonth(e.createdAt) || isThisMonth(e.exportDate));
    return {
      monthCount: thisMonth.length,
      totalAmount: exports.reduce((s, e) => s + num(e.amount), 0),
      pendingCount: approvedExpenses.length + approvedMileage.length,
    };
  }, [exports, approvedExpenses.length, approvedMileage.length]);

  /* --- Mutations --- */

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/accounting-exports"] });
    qc.invalidateQueries({ queryKey: ["/api/expense-reports"] });
    qc.invalidateQueries({ queryKey: ["/api/mileage-reports"] });
  };

  const exportExpenses = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/accounting-exports/export-expenses", {
        companyId, exportedBy: user?.id ?? null,
      })).json() as Promise<{ exported: number }>,
    onSuccess: (res) => {
      invalidateAll();
      setConfirmType(null);
      toast({ title: "Eksport fuldført", description: `${res.exported} udgift(er) eksporteret til bogføring.` });
    },
    onError: (e: Error) =>
      toast({ title: "Eksport fejlede", description: e.message, variant: "destructive" }),
  });

  const exportMileage = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/accounting-exports/export-mileage", {
        companyId, exportedBy: user?.id ?? null,
      })).json() as Promise<{ exported: number }>,
    onSuccess: (res) => {
      invalidateAll();
      setConfirmType(null);
      toast({ title: "Eksport fuldført", description: `${res.exported} kørselsregistrering(er) eksporteret til løn.` });
    },
    onError: (e: Error) =>
      toast({ title: "Eksport fejlede", description: e.message, variant: "destructive" }),
  });

  const isLoading = expenseQ.isLoading || mileageQ.isLoading || exportsQ.isLoading;
  const pending = exportExpenses.isPending || exportMileage.isPending;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const noPending = approvedExpenses.length === 0 && approvedMileage.length === 0;

  return (
    <div className="p-3 md:p-4 space-y-5 max-w-7xl mx-auto pb-24">
      {/* Overskrift */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Drift-regnskab flow</h1>
        <p className="text-sm text-muted-foreground">
          Eksporter godkendte udgifter og kørsel til bogføring og løn
        </p>
      </div>

      {/* Stats-kort */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Eksporteret denne måned"
          value={String(stats.monthCount)}
          icon={ArrowRight}
          testId="card-exports-month"
        />
        <StatCard
          label="Samlet eksporteret beløb"
          value={fmtMoney(stats.totalAmount)}
          icon={Wallet}
          testId="card-exports-total"
        />
        <StatCard
          label="Klar til eksport"
          value={String(stats.pendingCount)}
          icon={Upload}
          testId="card-pending-count"
        />
      </div>

      {/* Klar til eksport */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Klar til eksport</h2>

        {noPending ? (
          <div
            className="text-center py-12 text-muted-foreground border border-dashed rounded-lg"
            data-testid="empty-ready"
          >
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Ingen godkendte poster klar til eksport
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Udgift-kort */}
            <Card data-testid="card-ready-expenses">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Godkendte udgifter
                </CardTitle>
                <FileText className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xl font-semibold tabular-nums">
                    {fmtMoney(expenseTotal)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {approvedExpenses.length} udgift(er)
                  </div>
                </div>
                <Button
                  data-testid="button-export-expenses"
                  disabled={approvedExpenses.length === 0 || pending}
                  onClick={() => setConfirmType("expense")}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Eksporter til bogføring
                </Button>
              </CardContent>
            </Card>

            {/* Kørsel-kort */}
            <Card data-testid="card-ready-mileage">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Godkendt kørsel
                </CardTitle>
                <Car className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xl font-semibold tabular-nums">
                    {fmtMoney(mileageComp)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {approvedMileage.length} kørsel(er) · {mileageKm.toFixed(1)} km
                  </div>
                </div>
                <Button
                  data-testid="button-export-mileage"
                  disabled={approvedMileage.length === 0 || pending}
                  onClick={() => setConfirmType("mileage")}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Eksporter til løn
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Eksporteret */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Eksporteret</h2>

        {exports.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground border border-dashed rounded-lg"
            data-testid="empty-exports"
          >
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Ingen eksporter endnu
          </div>
        ) : (
          <Card data-testid="card-exports-table">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dato</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Bilagsnr.</TableHead>
                      <TableHead>Konto</TableHead>
                      <TableHead className="text-right">Beløb</TableHead>
                      <TableHead>Beskrivelse</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exp) => (
                      <TableRow key={exp.id} data-testid={`row-export-${exp.id}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {fmtDate(exp.exportDate ?? exp.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              exp.sourceType === "expense"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }
                            data-testid={`badge-type-${exp.id}`}
                          >
                            {SOURCE_LABELS[exp.sourceType] ?? exp.sourceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {exp.voucherNumber ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {exp.accountNumber ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmtMoney(num(exp.amount))}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-muted-foreground">
                          {exp.description ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_STYLES[exp.status] ?? STATUS_STYLES.eksporteret}
                            data-testid={`badge-status-${exp.id}`}
                          >
                            {STATUS_LABELS[exp.status] ?? exp.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Bekræftelsesdialog */}
      <Dialog open={confirmType !== null} onOpenChange={(o) => !o && setConfirmType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekræft eksport</DialogTitle>
            <DialogDescription>
              {confirmType === "expense"
                ? `Eksportér ${approvedExpenses.length} godkendt(e) udgift(er) til en samlet værdi af ${fmtMoney(
                    expenseTotal,
                  )} til bogføring?`
                : `Eksportér ${approvedMileage.length} godkendt(e) kørselsregistrering(er) (${mileageKm.toFixed(
                    1,
                  )} km, ${fmtMoney(mileageComp)}) til løn?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              data-testid="button-cancel-export"
              onClick={() => setConfirmType(null)}
              disabled={pending}
            >
              Annullér
            </Button>
            <Button
              data-testid="button-confirm-export"
              disabled={pending}
              onClick={() => {
                if (confirmType === "expense") exportExpenses.mutate();
                if (confirmType === "mileage") exportMileage.mutate();
              }}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {pending ? "Eksporterer…" : "Bekræft eksport"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

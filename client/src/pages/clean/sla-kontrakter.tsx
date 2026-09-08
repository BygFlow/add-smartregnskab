import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Plus,
  Trash2,
  FileText,
  CalendarClock,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

type ContractType = "fast_pris" | "timeafregnet" | "abonnement";
type ContractStatus = "aktiv" | "pauset" | "opsagt" | "udløbet";
type BillingCycle = "månedlig" | "kvartal" | "årlig" | "engangs";
type SlaLevel = "basis" | "standard" | "premium" | "kritisk";

interface ServiceContract {
  id: number;
  companyId: number;
  customerName: string;
  contractNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  type: ContractType;
  price: number | string | null;
  billingCycle: BillingCycle;
  slaLevel: SlaLevel;
  status: ContractStatus;
  notes?: string | null;
}

const TYPE_LABELS: Record<ContractType, string> = {
  fast_pris: "Fast pris",
  timeafregnet: "Timeafregnet",
  abonnement: "Abonnement",
};

const TYPE_VARIANTS: Record<ContractType, "default" | "secondary" | "outline"> = {
  fast_pris: "default",
  timeafregnet: "secondary",
  abonnement: "outline",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  aktiv: "Aktiv",
  pauset: "Pauset",
  opsagt: "Opsagt",
  udløbet: "Udløbet",
};

const STATUS_VARIANTS: Record<
  ContractStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  aktiv: "default",
  pauset: "secondary",
  opsagt: "destructive",
  udløbet: "outline",
};

const BILLING_LABELS: Record<BillingCycle, string> = {
  månedlig: "Månedlig",
  kvartal: "Kvartal",
  årlig: "Årlig",
  engangs: "Engangs",
};

const SLA_LABELS: Record<SlaLevel, string> = {
  basis: "Basis",
  standard: "Standard",
  premium: "Premium",
  kritisk: "Kritisk",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

function money(value?: number | null): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function date(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}.${month}.${year}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTHS_PER_CYCLE: Record<BillingCycle, number> = {
  månedlig: 1,
  kvartal: 3,
  årlig: 12,
  engangs: 0,
};

function ContractForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const todayStr = today();
  const [customerName, setCustomerName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<ContractType>("abonnement");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("månedlig");
  const [slaLevel, setSlaLevel] = useState<SlaLevel>("standard");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!customerName.trim()) return;
    onSubmit({
      customerName: customerName.trim(),
      contractNumber: contractNumber.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      type,
      price: price ? num(price) : 0,
      billingCycle,
      slaLevel,
      status: "aktiv",
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="cust-name">Kundenavn *</Label>
          <Input
            id="cust-name"
            data-testid="input-customer-name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="F.eks. ACME A/S"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-no">Kontraktnummer</Label>
          <Input
            id="contract-no"
            data-testid="input-contract-number"
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            placeholder="F.eks. SLA-2026-001"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kontrakttype</Label>
          <Select value={type} onValueChange={(v) => setType(v as ContractType)}>
            <SelectTrigger data-testid="select-contract-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as ContractType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start-date">Startdato</Label>
          <Input
            id="start-date"
            data-testid="input-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end-date">Slutdato</Label>
          <Input
            id="end-date"
            data-testid="input-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Pris (kr)</Label>
          <Input
            id="price"
            data-testid="input-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Faktureringscyklus</Label>
          <Select
            value={billingCycle}
            onValueChange={(v) => setBillingCycle(v as BillingCycle)}
          >
            <SelectTrigger data-testid="select-billing-cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BILLING_LABELS) as BillingCycle[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {BILLING_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>SLA-niveau</Label>
        <Select value={slaLevel} onValueChange={(v) => setSlaLevel(v as SlaLevel)}>
          <SelectTrigger data-testid="select-sla-level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SLA_LABELS) as SlaLevel[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SLA_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contract-notes">Noter</Label>
        <Input
          id="contract-notes"
          data-testid="input-contract-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-contract"
          disabled={pending || !customerName.trim()}
          onClick={submit}
        >
          Gem kontrakt
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function SlaKontrakter({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const todayStr = today();
  const soonStr = addDays(todayStr, 30);

  const { data, isLoading } = useQuery<ServiceContract[]>({
    queryKey: ["/api/service-contracts", companyId],
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/service-contracts?companyId=${companyId}`)
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });

  const createContract = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/service-contracts?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Kontrakt oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette kontrakt",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: ContractStatus;
    }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/service-contracts/${id}?companyId=${companyId}`,
          { status },
        )
      ).json(),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere kontrakt",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        "DELETE",
        `/api/service-contracts/${id}?companyId=${companyId}`,
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Kontrakt slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette kontrakt",
        description: e.message,
        variant: "destructive",
      }),
  });

  const contracts = data ?? [];

  const summary = useMemo(() => {
    const active = contracts.filter((c) => c.status === "aktiv");
    const activeCount = active.length;
    const monthlyValue = active.reduce((sum, c) => {
      const months = MONTHS_PER_CYCLE[c.billingCycle] ?? 0;
      if (months <= 0) return sum;
      return sum + (num(c.price) / months);
    }, 0);
    const expiringSoon = active.filter(
      (c) =>
        !!c.endDate &&
        c.endDate.slice(0, 10) >= todayStr &&
        c.endDate.slice(0, 10) <= soonStr,
    ).length;
    return { activeCount, monthlyValue, expiringSoon };
  }, [contracts, todayStr, soonStr]);

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
          <h1 className="text-xl font-semibold tracking-tight">SLA Kontrakter</h1>
          <p className="text-sm text-muted-foreground">
            Service- og vedligeholdelseskontrakter
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-contract" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tilføj kontrakt
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tilføj kontrakt</DialogTitle>
            </DialogHeader>
            <ContractForm
              pending={createContract.isPending}
              onSubmit={(body) => createContract.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-active-contracts">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Aktive kontrakter
              </p>
              <p className="text-xl font-semibold">{summary.activeCount}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </CardContent>
        </Card>
        <Card data-testid="card-monthly-value">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Samlet månedlig værdi
              </p>
              <p className="text-xl font-semibold">{money(summary.monthlyValue)}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card data-testid="card-expiring-soon">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Udløber snart (30 dage)
              </p>
              <p className="text-xl font-semibold text-amber-600 dark:text-amber-500">
                {summary.expiringSoon}
              </p>
            </div>
            <CalendarClock className="w-5 h-5 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      {contracts.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-contracts"
        >
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen kontrakter registreret endnu.
        </div>
      ) : (
        <Card data-testid="card-contracts-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Kontraktnr.</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Pris</TableHead>
                    <TableHead>Fakturering</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const expiring =
                      contract.status === "aktiv" &&
                      !!contract.endDate &&
                      contract.endDate.slice(0, 10) >= todayStr &&
                      contract.endDate.slice(0, 10) <= soonStr;
                    return (
                      <TableRow
                        key={contract.id}
                        data-testid={`row-contract-${contract.id}`}
                        className={expiring ? "bg-amber-500/5" : ""}
                      >
                        <TableCell className="font-medium max-w-44 truncate">
                          {contract.customerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contract.contractNumber ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {date(contract.startDate)} – {date(contract.endDate)}
                          {expiring && (
                            <Badge variant="destructive" className="ml-2" data-testid={`badge-expiring-${contract.id}`}>
                              Udløber snart
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={TYPE_VARIANTS[contract.type]}>
                            {TYPE_LABELS[contract.type] ?? contract.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {money(num(contract.price))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {BILLING_LABELS[contract.billingCycle] ?? contract.billingCycle}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SLA_LABELS[contract.slaLevel] ?? contract.slaLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[contract.status]}>
                            {STATUS_LABELS[contract.status] ?? contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Select
                              value={contract.status}
                              onValueChange={(v) =>
                                updateStatus.mutate({
                                  id: contract.id,
                                  status: v as ContractStatus,
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-8 w-32 text-xs"
                                data-testid={`select-status-${contract.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(STATUS_LABELS) as ContractStatus[]).map(
                                  (s) => (
                                    <SelectItem key={s} value={s}>
                                      {STATUS_LABELS[s]}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <button
                              className="p-1.5 rounded-md hover:bg-muted text-destructive"
                              data-testid={`button-delete-contract-${contract.id}`}
                              onClick={() => deleteContract.mutate(contract.id)}
                              aria-label="Slet kontrakt"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

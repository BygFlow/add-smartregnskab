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
import {
  CheckCircle2,
  ClipboardList,
  Package,
  Plus,
  Truck,
  Wallet,
} from "lucide-react";

type PoStatus =
  | "kladde"
  | "sendt"
  | "modtaget"
  | "delvis"
  | "afsluttet"
  | "annulleret";

interface PurchaseOrder {
  id: number;
  companyId: number;
  poNumber: string;
  supplier: string;
  items?: unknown | null;
  totalAmount?: number | string | null;
  status: PoStatus;
  expectedDate?: string | null;
  receivedDate?: string | null;
}

const STATUS_LABELS: Record<PoStatus, string> = {
  kladde: "Kladde",
  sendt: "Sendt",
  modtaget: "Modtaget",
  delvis: "Delvis",
  afsluttet: "Afsluttet",
  annulleret: "Annulleret",
};

const STATUS_CLASSES: Record<PoStatus, string> = {
  kladde: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  sendt: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  modtaget: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  delvis: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  afsluttet: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  annulleret: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
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

function date(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function PoForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [poNumber, setPoNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [itemsJson, setItemsJson] = useState("[]");
  const [totalAmount, setTotalAmount] = useState("");
  const [expectedDate, setExpectedDate] = useState("");

  const submit = () => {
    if (!supplier.trim()) return;
    let items: unknown = [];
    try {
      items = JSON.parse(itemsJson || "[]");
    } catch {
      items = [];
    }
    onSubmit({
      poNumber: poNumber.trim() || `PO-${Date.now()}`,
      supplier: supplier.trim(),
      items,
      totalAmount: totalAmount ? num(totalAmount) : 0,
      status: "kladde",
      expectedDate: expectedDate || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="po-number">Ordrenummer</Label>
          <Input
            id="po-number"
            data-testid="input-po-number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="Auto-genereres hvis tomt"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-supplier">Leverandør *</Label>
          <Input
            id="po-supplier"
            data-testid="input-po-supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="F.eks. ABC Rengøring A/S"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="po-items">Varer (JSON)</Label>
        <Input
          id="po-items"
          data-testid="input-po-items"
          value={itemsJson}
          onChange={(e) => setItemsJson(e.target.value)}
          placeholder='[{"name":"Middel","qty":5,"price":100}]'
        />
        <p className="text-xs text-muted-foreground">
          Angiv varer som JSON-array med navn, antal og pris.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="po-total">Samlet beløb (kr)</Label>
          <Input
            id="po-total"
            data-testid="input-po-total"
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-expected">Forventet levering</Label>
          <Input
            id="po-expected"
            data-testid="input-po-expected"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-po"
          disabled={pending || !supplier.trim()}
          onClick={submit}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Opret indkøbsordre
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Indkob({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders", companyId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/purchase-orders?companyId=${companyId}`,
        )
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });

  const createPo = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/purchase-orders?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Indkøbsordre oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette indkøbsordre",
        description: e.message,
        variant: "destructive",
      }),
  });

  const receivePo = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest(
          "PATCH",
          `/api/purchase-orders/${id}?companyId=${companyId}`,
          { status: "modtaget", receivedDate: new Date().toISOString() },
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ordre markeret som modtaget" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere ordre",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deletePo = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        "DELETE",
        `/api/purchase-orders/${id}?companyId=${companyId}`,
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Ordre slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette ordre",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];

  const summary = useMemo(() => {
    const pending = items.filter(
      (i) => i.status === "kladde" || i.status === "sendt" || i.status === "delvis",
    ).length;
    const totalAmount = items.reduce((s, i) => s + num(i.totalAmount), 0);
    return { total: items.length, pending, totalAmount };
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
          <h1 className="text-xl font-semibold tracking-tight">Indkøb</h1>
          <p className="text-sm text-muted-foreground">
            Indkøbsordrer og leverandører
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-po" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Opret indkøbsordre
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Opret indkøbsordre</DialogTitle>
            </DialogHeader>
            <PoForm
              pending={createPo.isPending}
              onSubmit={(body) => createPo.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-pos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlede ordrer
            </CardTitle>
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-pos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Afventende
            </CardTitle>
            <Truck className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-500">
              {summary.pending}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-amount">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet beløb
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-pos"
        >
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen indkøbsordrer endnu.
        </div>
      ) : (
        <Card data-testid="card-po-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordrenr.</TableHead>
                    <TableHead>Leverandør</TableHead>
                    <TableHead>Varer</TableHead>
                    <TableHead className="text-right">Beløb</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Forventet</TableHead>
                    <TableHead>Modtaget</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const itemCount = Array.isArray(item.items)
                      ? item.items.length
                      : 0;
                    return (
                      <TableRow key={item.id} data-testid={`row-po-${item.id}`}>
                        <TableCell className="font-medium">
                          {item.poNumber}
                        </TableCell>
                        <TableCell className="max-w-40 truncate">
                          {item.supplier}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {itemCount > 0 ? `${itemCount} varer` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {money(num(item.totalAmount))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_CLASSES[item.status]}
                            data-testid={`badge-po-status-${item.id}`}
                          >
                            {STATUS_LABELS[item.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {date(item.expectedDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {date(item.receivedDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {item.status === "sendt" ||
                            item.status === "delvis" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-receive-${item.id}`}
                                disabled={receivePo.isPending}
                                onClick={() => receivePo.mutate(item.id)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Modtag
                              </Button>
                            ) : null}
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

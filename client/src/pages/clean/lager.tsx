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
import { Switch } from "@/components/ui/switch";
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
  Boxes,
  AlertTriangle,
  Package,
  RefreshCw,
} from "lucide-react";

interface InventoryItem {
  id: number;
  companyId: number;
  name: string;
  sku?: string | null;
  category?: string | null;
  quantity: number | string | null;
  minQuantity: number | string | null;
  costPrice: number | string | null;
  salePrice: number | string | null;
  location?: string | null;
  supplier?: string | null;
  autoReorder?: boolean | null;
}

const CATEGORIES = [
  "Rengøringsmidler",
  "Engangsvarer",
  "Maskiner",
  "Værktøj",
  "Sikkerhed",
  "Kontor",
  "Andet",
];

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

function ItemForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("0");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [location, setLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  const [autoReorder, setAutoReorder] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      sku: sku.trim() || null,
      category,
      quantity: num(quantity),
      minQuantity: num(minQuantity),
      costPrice: costPrice ? num(costPrice) : 0,
      salePrice: salePrice ? num(salePrice) : 0,
      location: location.trim() || null,
      supplier: supplier.trim() || null,
      autoReorder,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="item-name">Varenavn *</Label>
          <Input
            id="item-name"
            data-testid="input-item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="F.eks. Universalmiddel 5L"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-sku">Varenummer (SKU)</Label>
          <Input
            id="item-sku"
            data-testid="input-item-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
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
          <Label htmlFor="item-quantity">Beholdning</Label>
          <Input
            id="item-quantity"
            data-testid="input-quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-min-quantity">Minimum beholdning</Label>
          <Input
            id="item-min-quantity"
            data-testid="input-min-quantity"
            type="number"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-cost">Kostpris (kr)</Label>
          <Input
            id="item-cost"
            data-testid="input-cost-price"
            type="number"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-sale">Salgspris (kr)</Label>
          <Input
            id="item-sale"
            data-testid="input-sale-price"
            type="number"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-location">Lokation</Label>
          <Input
            id="item-location"
            data-testid="input-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="F.eks. Lager A, hylde 3"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-supplier">Leverandør</Label>
          <Input
            id="item-supplier"
            data-testid="input-supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="item-auto-reorder">Auto-genbestilling</Label>
          <p className="text-xs text-muted-foreground">
            Bestil automatisk ved undergang af minimum
          </p>
        </div>
        <Switch
          id="item-auto-reorder"
          data-testid="switch-auto-reorder"
          checked={autoReorder}
          onCheckedChange={setAutoReorder}
        />
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-item"
          disabled={pending || !name.trim()}
          onClick={submit}
        >
          Gem vare
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Lager({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/inventory?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });

  const createItem = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest("POST", `/api/inventory?companyId=${companyId}`, body)
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Vare oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette vare",
        description: e.message,
        variant: "destructive",
      }),
  });

  const toggleReorder = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: boolean }) =>
      (
        await apiRequest("PATCH", `/api/inventory/${id}?companyId=${companyId}`, {
          autoReorder: value,
        })
      ).json(),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere vare",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inventory/${id}?companyId=${companyId}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Vare slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette vare",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];
  const lowStockIds = useMemo(
    () =>
      items
        .filter((i) => num(i.quantity) <= num(i.minQuantity))
        .map((i) => i.id),
    [items],
  );
  const lowStockSet = new Set(lowStockIds);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const lowStockCount = lowStockIds.length;
    const totalValue = items.reduce(
      (sum, i) => sum + num(i.quantity) * num(i.costPrice),
      0,
    );
    return { totalItems, lowStockCount, totalValue };
  }, [items, lowStockIds]);

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
          <h1 className="text-xl font-semibold tracking-tight">Lager</h1>
          <p className="text-sm text-muted-foreground">
            Varebeholdning og indkøb
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-item" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tilføj vare
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tilføj vare</DialogTitle>
            </DialogHeader>
            <ItemForm
              pending={createItem.isPending}
              onSubmit={(body) => createItem.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-items">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Antal varer
            </CardTitle>
            <Boxes className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.totalItems}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Varer under minimum
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-500">
              {summary.lowStockCount}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-value">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet lagerværdi
            </CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{money(summary.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-inventory"
        >
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen varer på lageret endnu.
        </div>
      ) : (
        <Card data-testid="card-inventory-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Beholdning</TableHead>
                    <TableHead className="text-right">Minimum</TableHead>
                    <TableHead className="text-right">Kostpris</TableHead>
                    <TableHead className="text-right">Salgspris</TableHead>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Leverandør</TableHead>
                    <TableHead className="text-center">Auto-bestil</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isLow = lowStockSet.has(item.id);
                    return (
                      <TableRow
                        key={item.id}
                        data-testid={`row-item-${item.id}`}
                        className={isLow ? "bg-amber-500/5" : ""}
                      >
                        <TableCell className="font-medium max-w-48 truncate">
                          {item.name}
                          {isLow && (
                            <Badge
                              variant="destructive"
                              className="ml-2"
                              data-testid={`badge-low-stock-${item.id}`}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Lav beholdning
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.sku ?? "—"}
                        </TableCell>
                        <TableCell>
                          {item.category ? (
                            <Badge variant="secondary">{item.category}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {num(item.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {num(item.minQuantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(num(item.costPrice))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(num(item.salePrice))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.location ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.supplier ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Switch
                              data-testid={`switch-reorder-${item.id}`}
                              checked={!!item.autoReorder}
                              disabled={toggleReorder.isPending}
                              onCheckedChange={(v) =>
                                toggleReorder.mutate({ id: item.id, value: v })
                              }
                            />
                            {item.autoReorder && (
                              <RefreshCw className="w-3 h-3 ml-1.5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            className="p-1.5 rounded-md hover:bg-muted text-destructive"
                            data-testid={`button-delete-item-${item.id}`}
                            onClick={() => deleteItem.mutate(item.id)}
                            aria-label="Slet vare"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

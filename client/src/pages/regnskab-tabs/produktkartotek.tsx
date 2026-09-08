import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Plus, Search, Edit, Trash2, AlertTriangle, Box, Wrench,
  TrendingUp, Percent, CheckCircle2, XCircle,
} from "lucide-react";

type ProductType = "vare" | "ydelse";
type ProductUnit = "stk" | "timer" | "kg" | "l" | "m" | "pakke";

type Product = {
  id: number;
  companyId: number;
  productNumber?: string | null;
  name: string;
  description?: string | null;
  type: ProductType;
  unit: ProductUnit;
  salesPrice?: number | null;
  costPrice?: number | null;
  vatRate?: number | null;
  accountNumber?: string | null;
  inventoryTracked?: number | boolean | null;
  stockQuantity?: number | null;
  minStock?: number | null;
  isActive?: number | boolean | null;
};

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "stk", label: "Stk" }, { value: "timer", label: "Timer" },
  { value: "kg", label: "Kg" }, { value: "l", label: "Liter" },
  { value: "m", label: "Meter" }, { value: "pakke", label: "Pakke" },
];

const UNIT_LABEL: Record<ProductUnit, string> = {
  stk: "Stk", timer: "Timer", kg: "Kg", l: "Liter", m: "Meter", pakke: "Pakke",
};

function fmtKr(n: number): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(n || 0);
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

function margin(p: Product): number {
  return (p.salesPrice || 0) - (p.costPrice || 0);
}

function marginPct(p: Product): number {
  const sp = p.salesPrice || 0;
  const cp = p.costPrice || 0;
  if (sp <= 0) return 0;
  return ((sp - cp) / sp) * 100;
}

function isLowStock(p: Product): boolean {
  if (!toBool(p.inventoryTracked)) return false;
  return (p.stockQuantity || 0) < (p.minStock || 0);
}

export default function Produktkartotek({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("alle");
  const [activeFilter, setActiveFilter] = useState("alle");
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/products?companyId=${companyId}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Produkt slettet" });
      qc.invalidateQueries({ queryKey: ["/api/products", companyId] });
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (typeFilter !== "alle" && p.type !== typeFilter) return false;
      if (activeFilter !== "alle") {
        const active = toBool(p.isActive);
        if (activeFilter === "aktive" && !active) return false;
        if (activeFilter === "inaktive" && active) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(s) ||
          (p.productNumber || "").toLowerCase().includes(s) ||
          (p.description || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [products, search, typeFilter, activeFilter]);

  const stats = useMemo(() => ({
    total: products.length,
    varer: products.filter((p) => p.type === "vare").length,
    ydelser: products.filter((p) => p.type === "ydelse").length,
    lowStock: products.filter(isLowStock).length,
  }), [products]);

  const StatCard = ({ icon: Icon, iconColor, label, value, valueColor }: any) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${valueColor || ""}`}>{value}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            Produktkartotek
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Håndtér varer og ydelser — priser, kostpris, lagerbeholdning og avance
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-product">
          <Plus className="h-4 w-4 mr-2" />
          Opret produkt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Package} iconColor="text-muted-foreground" label="Produkter i alt" value={stats.total} />
        <StatCard icon={Box} iconColor="text-blue-500" label="Varer" value={stats.varer} />
        <StatCard icon={Wrench} iconColor="text-emerald-500" label="Ydelser" value={stats.ydelser} />
        <StatCard icon={AlertTriangle} iconColor="text-orange-500" label="Lav lagerbeholdning" value={stats.lowStock} valueColor="text-orange-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg varenr., navn, beskrivelse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-product"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            <SelectItem value="vare">Varer</SelectItem>
            <SelectItem value="ydelse">Ydelser</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-40" data-testid="select-active-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle status</SelectItem>
            <SelectItem value="aktive">Aktive</SelectItem>
            <SelectItem value="inaktive">Inaktive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Indlæser produkter...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Ingen produkter fundet. Klik "Opret produkt" for at komme i gang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Varenr.</TableHead>
                    <TableHead>Navn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Enhed</TableHead>
                    <TableHead className="text-right">Salgspris</TableHead>
                    <TableHead className="text-right">Kostpris</TableHead>
                    <TableHead className="text-right">Avance</TableHead>
                    <TableHead className="text-right">Moms%</TableHead>
                    <TableHead className="text-right">Lager</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const m = margin(p);
                    const mp = marginPct(p);
                    const tracked = toBool(p.inventoryTracked);
                    const low = isLowStock(p);
                    const active = toBool(p.isActive);
                    return (
                      <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                        <TableCell className="font-mono text-sm">
                          {p.productNumber || `V-${p.id}`}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.type === "vare" ? (
                            <Badge className="bg-blue-100 text-blue-700">Vare</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">Ydelse</Badge>
                          )}
                        </TableCell>
                        <TableCell>{UNIT_LABEL[p.unit]}</TableCell>
                        <TableCell className="text-right font-medium">{fmtKr(p.salesPrice || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtKr(p.costPrice || 0)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className={m >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                              {fmtKr(m)}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Percent className="h-3 w-3" />{mp.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(p.vatRate || 0)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {tracked ? (
                            <div className="flex flex-col items-end">
                              <span className={low ? "text-orange-600 font-medium" : ""}>
                                {p.stockQuantity ?? 0} / {p.minStock ?? 0}
                              </span>
                              {low && (
                                <Badge className="bg-orange-100 text-orange-700 mt-0.5 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />Lav lagerbeholdning
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {active ? (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Aktiv
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />Inaktiv
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setEditProduct(p)}
                              title="Rediger"
                              data-testid={`button-edit-product-${p.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => {
                                if (confirm(`Slet produktet "${p.name}"?`)) deleteMutation.mutate(p.id);
                              }}
                              title="Slet"
                              data-testid={`button-delete-product-${p.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <ProductDialog
        open={showCreate || !!editProduct}
        product={editProduct}
        onClose={() => { setShowCreate(false); setEditProduct(null); }}
        companyId={companyId}
      />
    </div>
  );
}

// ── Product Create/Edit Dialog ──

function ProductDialog({
  open, product, onClose, companyId,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  companyId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!product;

  const [productNumber, setProductNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProductType>("vare");
  const [unit, setUnit] = useState<ProductUnit>("stk");
  const [salesPrice, setSalesPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [vatRate, setVatRate] = useState("25");
  const [accountNumber, setAccountNumber] = useState("");
  const [inventoryTracked, setInventoryTracked] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("");
  const [minStock, setMinStock] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Reset when dialog opens with new product
  useMemo(() => {
    if (open) {
      setProductNumber(product?.productNumber || "");
      setName(product?.name || "");
      setDescription(product?.description || "");
      setType((product?.type as ProductType) || "vare");
      setUnit((product?.unit as ProductUnit) || "stk");
      setSalesPrice(product?.salesPrice != null ? String(product.salesPrice) : "");
      setCostPrice(product?.costPrice != null ? String(product.costPrice) : "");
      setVatRate(product?.vatRate != null ? String(product.vatRate) : "25");
      setAccountNumber(product?.accountNumber || "");
      setInventoryTracked(toBool(product?.inventoryTracked));
      setStockQuantity(product?.stockQuantity != null ? String(product.stockQuantity) : "");
      setMinStock(product?.minStock != null ? String(product.minStock) : "");
      setIsActive(product == null ? true : toBool(product.isActive));
    }
  }, [open, product]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit && product) {
        const res = await apiRequest("PATCH", `/api/products/${product.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/products", { ...data, companyId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Produkt opdateret" : "Produkt oprettet" });
      qc.invalidateQueries({ queryKey: ["/api/products", companyId] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const numOr = (s: string, def: number | null = null): number | null => {
    if (s.trim() === "") return def;
    const n = Number(s.replace(",", "."));
    return isNaN(n) ? def : n;
  };

  function handleSubmit() {
    if (!name.trim()) return;
    const payload: any = {
      productNumber: productNumber || null,
      name: name.trim(),
      description: description || null,
      type,
      unit,
      salesPrice: numOr(salesPrice, 0),
      costPrice: numOr(costPrice, 0),
      vatRate: numOr(vatRate, 25),
      accountNumber: accountNumber || null,
      inventoryTracked: inventoryTracked ? 1 : 0,
      stockQuantity: inventoryTracked ? numOr(stockQuantity, 0) : null,
      minStock: inventoryTracked ? numOr(minStock, 0) : null,
      isActive: isActive ? 1 : 0,
    };
    mutation.mutate(payload);
  }

  const liveMargin = (numOr(salesPrice, 0) || 0) - (numOr(costPrice, 0) || 0);
  const liveSp = numOr(salesPrice, 0) || 0;
  const livePct = liveSp > 0 ? (((liveSp - (numOr(costPrice, 0) || 0)) / liveSp) * 100).toFixed(1) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            {isEdit ? "Rediger produkt" : "Opret produkt"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Varenummer</Label>
              <Input
                value={productNumber}
                onChange={(e) => setProductNumber(e.target.value)}
                placeholder="F.eks. V-001"
                data-testid="input-product-number"
              />
            </div>
            <div>
              <Label>Navn *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Produktnavn"
                data-testid="input-product-name"
              />
            </div>
          </div>

          <div>
            <Label>Beskrivelse</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Valgfri beskrivelse af produktet" rows={2} data-testid="input-product-description" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ProductType)}>
                <SelectTrigger data-testid="select-product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vare">Vare</SelectItem>
                  <SelectItem value="ydelse">Ydelse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Enhed</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as ProductUnit)}>
                <SelectTrigger data-testid="select-product-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Salgspris (DKK)</Label>
              <Input type="number" step="0.01" value={salesPrice} onChange={(e) => setSalesPrice(e.target.value)} placeholder="0,00" data-testid="input-sales-price" />
            </div>
            <div>
              <Label>Kostpris (DKK)</Label>
              <Input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0,00" data-testid="input-cost-price" />
            </div>
            <div>
              <Label>Moms (%)</Label>
              <Select value={vatRate} onValueChange={setVatRate}>
                <SelectTrigger data-testid="select-vat-rate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="6">6%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kontonummer</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="F.eks. 1000" data-testid="input-account-number" />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 w-full">
                <input type="checkbox" id="inventory-tracked" checked={inventoryTracked} onChange={(e) => setInventoryTracked(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-emerald-600" data-testid="checkbox-inventory-tracked" />
                <Label htmlFor="inventory-tracked" className="cursor-pointer mb-0">Lagerstyring</Label>
              </div>
            </div>
          </div>

          {inventoryTracked && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lagerbeholdning</Label>
                <Input type="number" step="1" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="0" data-testid="input-stock-quantity" />
              </div>
              <div>
                <Label>Minimumslager</Label>
                <Input type="number" step="1" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" data-testid="input-min-stock" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <input type="checkbox" id="is-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-emerald-600" data-testid="checkbox-is-active" />
            <Label htmlFor="is-active" className="cursor-pointer mb-0">Aktiv produkt</Label>
          </div>

          {/* Live margin preview */}
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 rounded-md px-3 py-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Avance
            </span>
            <span className={liveMargin >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
              {fmtKr(liveMargin)}
              {livePct && <span className="text-xs text-muted-foreground ml-1">({livePct}%)</span>}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-product">Annuller</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || mutation.isPending}
            data-testid="button-save-product"
          >
            {mutation.isPending ? "Gemmer..." : isEdit ? "Opdater produkt" : "Opret produkt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

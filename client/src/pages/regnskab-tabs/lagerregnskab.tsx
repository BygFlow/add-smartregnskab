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
import { Plus, Trash2, Pencil, Boxes, MapPin, Calendar } from "lucide-react";

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

const STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  aktiv: "green",
  optalt: "blue",
  mangler: "amber",
  udgået: "red",
};
const STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  optalt: "Optalt",
  mangler: "Mangler optælling",
  udgået: "Udgået",
};

/* ---------- typer ---------- */

type InventoryItem = {
  id: number;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  location?: string | null;
  lastCountDate?: string | null;
  status: string;
};

/* ---------- komponent ---------- */

export default function Lagerregnskab({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const queryKey = useMemo(
    () => ["/api/inventory-accounts", companyId] as const,
    [companyId],
  );

  const { data, isLoading } = useQuery<InventoryItem[]>({
    queryKey,
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/inventory-accounts?companyId=${companyId}`,
        )
      ).json(),
  });

  const items = data ?? [];
  const totalValue = items.reduce((sum, i) => sum + (Number(i.totalValue) || 0), 0);

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/inventory-accounts?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Vare oprettet", description: "Lagerbeholdningen er opdateret." });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/inventory-accounts/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Vare opdateret" });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/inventory-accounts/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Vare slettet" });
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: InventoryItem) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Lagerregnskab"
        description="Værdiansættelse og beholdning af lagervarer."
        action={
          <Button data-testid="add-item-btn" onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Tilføj vare
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
        <MetricCard
          icon={<Boxes className="w-4 h-4" />}
          value={money(totalValue)}
          label="Samlet lagerværdi"
          variant="primary"
          valueTestId="total-inventory-value"
        />
        <MetricCard
          icon={<Boxes className="w-4 h-4" />}
          value={items.length}
          label="Antal varer"
          variant="blue"
          valueTestId="item-count"
        />
        <MetricCard
          icon={<Calendar className="w-4 h-4" />}
          value={
            items.filter((i) => i.status === "mangler").length
          }
          label="Mangler optælling"
          variant="amber"
        />
      </div>

      <SectionCard
        title="Lagerbeholdning"
        icon={<Boxes className="w-4 h-4" />}
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
            Ingen varer på lager endnu. Tryk “Tilføj vare” for at oprette den første.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Vare</th>
                  <th className="px-3 py-2 font-medium text-right">Antal</th>
                  <th className="px-3 py-2 font-medium text-right">Stk. pris</th>
                  <th className="px-3 py-2 font-medium text-right">Samlet værdi</th>
                  <th className="px-3 py-2 font-medium">Lokation</th>
                  <th className="px-3 py-2 font-medium">Sidste optælling</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{item.itemName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(item.unitCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(item.totalValue)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {item.location || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dk(item.lastCountDate)}</td>
                    <td className="px-3 py-2">
                      <StatusChip
                        data-testid={`status-${item.id}`}
                        status={STATUS_LABEL[item.status] ?? item.status}
                        variant={STATUS_VARIANT[item.status] ?? "gray"}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          data-testid={`edit-btn-${item.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          data-testid={`delete-btn-${item.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
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
                  <td className="px-3 py-2" colSpan={3}>I alt</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(totalValue)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <ItemDialog
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

/* ---------- dialog ---------- */

function ItemDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: InventoryItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [location, setLocation] = useState("");
  const [lastCountDate, setLastCountDate] = useState(today());
  const [status, setStatus] = useState("aktiv");

  // Komponenten remountes via key når editing skifter — felter initialiseres én gang.
  // Hvis alligevel åbnet uden remount, synkroniseres felterne ved åbning.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setItemName(editing.itemName ?? "");
      setQuantity(String(editing.quantity ?? ""));
      setUnitCost(String(editing.unitCost ?? ""));
      setLocation(editing.location ?? "");
      setLastCountDate(editing.lastCountDate?.slice(0, 10) ?? today());
      setStatus(editing.status ?? "aktiv");
    } else {
      setItemName("");
      setQuantity("");
      setUnitCost("");
      setLocation("");
      setLastCountDate(today());
      setStatus("aktiv");
    }
  }, [open, editing]);

  const qty = Number(quantity) || 0;
  const cost = Number(unitCost) || 0;
  const totalValue = qty * cost;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      itemName: itemName.trim(),
      quantity: qty,
      unitCost: cost,
      totalValue,
      location: location.trim() || null,
      lastCountDate: lastCountDate || null,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger vare" : "Tilføj vare"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Varenavn</Label>
            <Input
              id="item-name"
              data-testid="input-itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-quantity">Antal</Label>
              <Input
                id="item-quantity"
                data-testid="input-quantity"
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-unitcost">Stk. pris (DKK)</Label>
              <Input
                id="item-unitcost"
                data-testid="input-unitCost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-total">Samlet værdi (auto)</Label>
            <Input
              id="item-total"
              data-testid="input-totalValue"
              value={money(totalValue)}
              readOnly
              className="bg-muted/40 font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-location">Lokation</Label>
            <Input
              id="item-location"
              data-testid="input-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="F.eks. Lager A, Hylde 3"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-date">Sidste optælling</Label>
              <Input
                id="item-date"
                data-testid="input-lastCountDate"
                type="date"
                value={lastCountDate}
                onChange={(e) => setLastCountDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="input-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="optalt">Optalt</SelectItem>
                  <SelectItem value="mangler">Mangler optælling</SelectItem>
                  <SelectItem value="udgået">Udgået</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret vare"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

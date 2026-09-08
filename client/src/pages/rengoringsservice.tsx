import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SectionCard } from "@/components/premium";
import {
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Eye,
  Clock,
  Package,
} from "lucide-react";

type UnitType = "time" | "kvm" | "fast_pris" | "pr_omgang" | "pr_lokation";
type VatCode = "I25" | "S25" | "FRI";

interface CleaningService {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  unitType: UnitType;
  price: string | number | null;
  hourlyRate: string | number | null;
  estimatedHours: string | number | null;
  estimatedTime: string | number | null; // minutter
  category: string | null;
  active: number;
  vatCode: string | null;
  weekendSurcharge: string | number | null;
  eveningSurcharge: string | number | null;
  materialSurcharge: string | number | null;
  transportSurcharge: string | number | null;
  standardTasks: string | null; // JSON array of strings
  standardMaterials: string | null; // JSON array of {name, qty, unit}
  itemNumber: string | null; // varenummer — auto-genereres
  createdAt: string | null;
}

interface StandardMaterial {
  name: string;
  qty: string;
  unit: string;
}

const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: "time", label: "Time" },
  { value: "kvm", label: "Pr. m²" },
  { value: "fast_pris", label: "Fast pris" },
  { value: "pr_omgang", label: "Pr. omgang" },
  { value: "pr_lokation", label: "Pr. lokation" },
];

const UNIT_LABELS: Record<UnitType, string> = {
  time: "Time",
  kvm: "Pr. m²",
  fast_pris: "Fast pris",
  pr_omgang: "Pr. omgang",
  pr_lokation: "Pr. lokation",
};

const CATEGORIES = [
  "Kontor",
  "Bolig",
  "Industri",
  "Special",
  "Trapper",
  "Vinduer",
  "Gulve",
  "Andet",
];

const VAT_CODES: { value: VatCode; label: string }[] = [
  { value: "I25", label: "I25 (25% moms)" },
  { value: "S25", label: "S25 (services 25%)" },
  { value: "FRI", label: "FRI (momsfri)" },
];

function money(value?: string | number | null) {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n);
}

function num(value?: string | number | null): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return isNaN(n) ? 0 : n;
}

function parseTasks(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMaterials(raw: string | null): StandardMaterial[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Beregn næste varenummer (V-0001, V-0002, …) ud fra eksisterende ydelser. */
function nextItemNumber(services: CleaningService[] | undefined): string {
  const maxNum = (services ?? []).reduce((max, s) => {
    const m = /^V-(\d+)$/.exec(s.itemNumber || "");
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `V-${String(maxNum + 1).padStart(4, "0")}`;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  unitType: UnitType;
  price: string;
  hourlyRate: string;
  estimatedTime: string; // minutter
  vatCode: VatCode;
  weekendSurcharge: string;
  eveningSurcharge: string;
  materialSurcharge: string;
  transportSurcharge: string;
  active: boolean;
  itemNumber: string;
  standardTasks: string[];
  standardMaterials: StandardMaterial[];
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "Kontor",
  unitType: "time",
  price: "",
  hourlyRate: "",
  estimatedTime: "",
  vatCode: "I25",
  weekendSurcharge: "",
  eveningSurcharge: "",
  materialSurcharge: "",
  transportSurcharge: "",
  active: true,
  itemNumber: "",
  standardTasks: [],
  standardMaterials: [],
};

export default function RengoringsService() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<CleaningService | null>(null);
  const [detail, setDetail] = useState<CleaningService | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [newTask, setNewTask] = useState("");

  const { data: services, isLoading } = useQuery<CleaningService[]>({
    queryKey: ["cleaning-services", companyId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/cleaning-services?companyId=${companyId}`,
      );
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<CleaningService>) => {
      const res = await apiRequest("POST", "/api/cleaning-services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cleaning-services"] });
      toast({ title: "Ydelse oprettet" });
      closeDialog();
    },
    onError: () => toast({ title: "Kunne ikke oprette ydelse", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CleaningService> }) => {
      const res = await apiRequest("PATCH", `/api/cleaning-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cleaning-services"] });
      toast({ title: "Ydelse opdateret" });
      closeDialog();
    },
    onError: () => toast({ title: "Kunne ikke opdatere ydelse", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cleaning-services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cleaning-services"] });
      toast({ title: "Ydelse slettet" });
    },
    onError: () => toast({ title: "Kunne ikke slette ydelse", variant: "destructive" }),
  });

  const pending = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, itemNumber: nextItemNumber(services) });
    setNewTask("");
  }

  function openEdit(s: CleaningService) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      category: s.category || "Kontor",
      unitType: (s.unitType as UnitType) || "time",
      price: String(num(s.price)),
      hourlyRate: String(num(s.hourlyRate)),
      estimatedTime: String(num(s.estimatedTime)),
      vatCode: (s.vatCode as VatCode) || "I25",
      weekendSurcharge: String(num(s.weekendSurcharge)),
      eveningSurcharge: String(num(s.eveningSurcharge)),
      materialSurcharge: String(num(s.materialSurcharge)),
      transportSurcharge: String(num(s.transportSurcharge)),
      active: s.active !== 0,
      itemNumber: s.itemNumber ?? "",
      standardTasks: parseTasks(s.standardTasks),
      standardMaterials: parseMaterials(s.standardMaterials),
    });
    setNewTask("");
    setDialogOpen(true);
  }

  function openDetail(s: CleaningService) {
    setDetail(s);
    setDetailOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function addTask() {
    const t = newTask.trim();
    if (!t) return;
    setForm({ ...form, standardTasks: [...form.standardTasks, t] });
    setNewTask("");
  }

  function removeTask(idx: number) {
    setForm({
      ...form,
      standardTasks: form.standardTasks.filter((_, i) => i !== idx),
    });
  }

  function addMaterial() {
    setForm({
      ...form,
      standardMaterials: [
        ...form.standardMaterials,
        { name: "", qty: "", unit: "stk" },
      ],
    });
  }

  function updateMaterial(idx: number, field: keyof StandardMaterial, value: string) {
    setForm({
      ...form,
      standardMaterials: form.standardMaterials.map((m, i) =>
        i === idx ? { ...m, [field]: value } : m,
      ),
    });
  }

  function removeMaterial(idx: number) {
    setForm({
      ...form,
      standardMaterials: form.standardMaterials.filter((_, i) => i !== idx),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Navn er påkrævet", variant: "destructive" });
      return;
    }
    const payload: Partial<CleaningService> = {
      companyId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      unitType: form.unitType,
      price: num(form.price),
      hourlyRate: num(form.hourlyRate),
      estimatedTime: num(form.estimatedTime),
      vatCode: form.vatCode,
      weekendSurcharge: num(form.weekendSurcharge),
      eveningSurcharge: num(form.eveningSurcharge),
      materialSurcharge: num(form.materialSurcharge),
      transportSurcharge: num(form.transportSurcharge),
      active: form.active ? 1 : 0,
      itemNumber: form.itemNumber || null,
      standardTasks: JSON.stringify(form.standardTasks),
      standardMaterials: JSON.stringify(form.standardMaterials),
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Ydelser"
        title="Rengøringsydelser"
        description="Administrer virksomhedens rengøringsydelser og priser"
      />

      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            openCreate();
            setDialogOpen(true);
          }}
          data-testid="button-new-service"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Opret ydelse
        </Button>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Rediger ydelse" : "Ny ydelse"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="svc-name">Navn *</Label>
                <Input
                  id="svc-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="f.eks. Kontorrengøring"
                  required
                  data-testid="input-service-name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-item">Varenummer</Label>
                <Input
                  id="svc-item"
                  value={form.itemNumber}
                  readOnly
                  className="bg-muted/50 font-mono"
                  data-testid="input-service-itemnumber"
                  placeholder="Auto-genereres"
                />
                <p className="text-[11px] text-muted-foreground">Auto-genereres (V-0001, V-0002, …)</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-desc">Beskrivelse</Label>
              <Textarea
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                data-testid="input-service-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="svc-cat">Kategori</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="svc-cat" data-testid="select-service-category">
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
              <div className="space-y-1">
                <Label htmlFor="svc-unit">Enhedstype</Label>
                <Select
                  value={form.unitType}
                  onValueChange={(v: UnitType) => setForm({ ...form, unitType: v })}
                >
                  <SelectTrigger id="svc-unit" data-testid="select-service-unittype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="svc-price">Pris (DKK)</Label>
                <Input
                  id="svc-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  data-testid="input-service-price"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-hourly">Timepris (DKK)</Label>
                <Input
                  id="svc-hourly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  data-testid="input-service-hourlyrate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="svc-time">Estimeret tid (minutter)</Label>
                <Input
                  id="svc-time"
                  type="number"
                  step="1"
                  min="0"
                  value={form.estimatedTime}
                  onChange={(e) => setForm({ ...form, estimatedTime: e.target.value })}
                  data-testid="input-service-estimatedtime"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-vat">Momskode</Label>
                <Select
                  value={form.vatCode}
                  onValueChange={(v: VatCode) => setForm({ ...form, vatCode: v })}
                >
                  <SelectTrigger id="svc-vat" data-testid="select-service-vatcode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_CODES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tillæg */}
            <div className="space-y-2">
              <Label>Tillæg</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="svc-weekend" className="text-xs text-muted-foreground">
                    Weekentillæg (%)
                  </Label>
                  <Input
                    id="svc-weekend"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.weekendSurcharge}
                    onChange={(e) => setForm({ ...form, weekendSurcharge: e.target.value })}
                    data-testid="input-service-weekend"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="svc-evening" className="text-xs text-muted-foreground">
                    Aftentillæg (%)
                  </Label>
                  <Input
                    id="svc-evening"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.eveningSurcharge}
                    onChange={(e) => setForm({ ...form, eveningSurcharge: e.target.value })}
                    data-testid="input-service-evening"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="svc-material" className="text-xs text-muted-foreground">
                    Materialtillæg (%)
                  </Label>
                  <Input
                    id="svc-material"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.materialSurcharge}
                    onChange={(e) => setForm({ ...form, materialSurcharge: e.target.value })}
                    data-testid="input-service-material"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="svc-transport" className="text-xs text-muted-foreground">
                    Kørselstillæg (kr/km)
                  </Label>
                  <Input
                    id="svc-transport"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.transportSurcharge}
                    onChange={(e) => setForm({ ...form, transportSurcharge: e.target.value })}
                    data-testid="input-service-transport"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="svc-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v === true })}
                data-testid="checkbox-service-active"
              />
              <Label htmlFor="svc-active">Aktiv</Label>
            </div>

            {/* Standardopgaver */}
            <div className="space-y-2">
              <Label>Standardopgaver</Label>
              <div className="flex gap-2">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="f.eks. Støvsugning"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  data-testid="input-service-newtask"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addTask}
                  data-testid="button-service-addtask"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {form.standardTasks.length > 0 && (
                <ul className="space-y-1">
                  {form.standardTasks.map((t, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
                      data-testid={`task-item-${idx}`}
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => removeTask(idx)}
                        className="p-1 rounded-md hover:bg-muted text-destructive"
                        data-testid={`button-removetask-${idx}`}
                        aria-label="Fjern opgave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Standardmaterialer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Standardmaterialer</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addMaterial}
                  data-testid="button-service-addmaterial"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Tilføj
                </Button>
              </div>
              {form.standardMaterials.length > 0 && (
                <div className="space-y-2">
                  {form.standardMaterials.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-end gap-2"
                      data-testid={`material-item-${idx}`}
                    >
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`mat-name-${idx}`} className="text-xs text-muted-foreground">
                          Navn
                        </Label>
                        <Input
                          id={`mat-name-${idx}`}
                          value={m.name}
                          onChange={(e) => updateMaterial(idx, "name", e.target.value)}
                          placeholder="f.eks. Universalrengøringsmiddel"
                          data-testid={`input-material-name-${idx}`}
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label htmlFor={`mat-qty-${idx}`} className="text-xs text-muted-foreground">
                          Antal
                        </Label>
                        <Input
                          id={`mat-qty-${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={m.qty}
                          onChange={(e) => updateMaterial(idx, "qty", e.target.value)}
                          data-testid={`input-material-qty-${idx}`}
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label htmlFor={`mat-unit-${idx}`} className="text-xs text-muted-foreground">
                          Enhed
                        </Label>
                        <Input
                          id={`mat-unit-${idx}`}
                          value={m.unit}
                          onChange={(e) => updateMaterial(idx, "unit", e.target.value)}
                          placeholder="stk, l, kg"
                          data-testid={`input-material-unit-${idx}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMaterial(idx)}
                        className="p-2 rounded-md hover:bg-muted text-destructive mb-0.5"
                        data-testid={`button-removematerial-${idx}`}
                        aria-label="Fjern materiale"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                data-testid="button-cancel-service"
              >
                Annuller
              </Button>
              <Button type="submit" disabled={pending} data-testid="button-save-service">
                {editing ? "Gem ændringer" : "Opret ydelse"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {detail.description && (
                <p className="text-sm text-muted-foreground">{detail.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Varenummer</p>
                  <p className="font-mono text-sm font-medium" data-testid="text-detail-itemnumber">{detail.itemNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kategori</p>
                  <p className="font-medium">{detail.category || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enhedstype</p>
                  <p className="font-medium">{detail.unitType ? UNIT_LABELS[detail.unitType] ?? detail.unitType : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pris</p>
                  <p className="font-medium">{money(detail.price)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timepris</p>
                  <p className="font-medium">{money(detail.hourlyRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estimeret tid</p>
                  <p className="font-medium">{num(detail.estimatedTime) > 0 ? `${num(detail.estimatedTime)} min` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Momskode</p>
                  <p className="font-medium">{detail.vatCode || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Weekentillæg</p>
                  <p className="font-medium">{num(detail.weekendSurcharge)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aftentillæg</p>
                  <p className="font-medium">{num(detail.eveningSurcharge)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Materialtillæg</p>
                  <p className="font-medium">{num(detail.materialSurcharge)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kørselstillæg</p>
                  <p className="font-medium">{money(detail.transportSurcharge)}/km</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge variant={detail.active ? "default" : "secondary"} data-testid={`badge-status-${detail.id}`}>
                  {detail.active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </div>

              {parseTasks(detail.standardTasks).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Standardopgaver
                    </h4>
                  </div>
                  <ul className="space-y-1">
                    {parseTasks(detail.standardTasks).map((t, idx) => (
                      <li key={idx} className="text-sm rounded-md border border-border px-2.5 py-1.5">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parseMaterials(detail.standardMaterials).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Standardmaterialer
                    </h4>
                  </div>
                  <ul className="space-y-1">
                    {parseMaterials(detail.standardMaterials).map((m, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm rounded-md border border-border px-2.5 py-1.5">
                        <span>{m.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {m.qty} {m.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      ) : (
        <SectionCard
          data-testid="card-services"
          title="Ydelser"
          icon={<Sparkles className="w-4 h-4" />}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="table-premium w-full min-w-[960px] text-sm">
              <thead>
                <tr>
                  <th>Varenummer</th>
                  <th>Navn</th>
                  <th>Kategori</th>
                  <th>Enhed</th>
                  <th className="text-right">Pris</th>
                  <th className="text-right">Timepris</th>
                  <th className="text-right">Est. tid</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(services ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-4 text-center text-muted-foreground"
                      data-testid="empty-services"
                    >
                      Ingen ydelser oprettet endnu.
                    </td>
                  </tr>
                ) : (
                  (services ?? []).map((s) => (
                    <tr key={s.id} data-testid={`row-service-${s.id}`} className="cursor-pointer hover:bg-muted/40">
                      <td
                        className="p-3 font-mono text-xs text-muted-foreground"
                        onClick={() => openDetail(s)}
                        data-testid={`text-service-itemnumber-${s.id}`}
                      >
                        {s.itemNumber || "—"}
                      </td>
                      <td
                        className="p-3 font-medium text-foreground"
                        onClick={() => openDetail(s)}
                      >
                        {s.name}
                      </td>
                      <td className="p-3 text-muted-foreground" onClick={() => openDetail(s)}>
                        {s.category || "—"}
                      </td>
                      <td className="p-3" onClick={() => openDetail(s)}>
                        {s.unitType ? UNIT_LABELS[s.unitType] ?? s.unitType : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums" onClick={() => openDetail(s)}>
                        {money(s.price)}
                      </td>
                      <td className="p-3 text-right tabular-nums" onClick={() => openDetail(s)}>
                        {num(s.hourlyRate) > 0 ? money(s.hourlyRate) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums" onClick={() => openDetail(s)}>
                        {num(s.estimatedTime) > 0 ? `${num(s.estimatedTime)} min` : "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant={s.active ? "default" : "secondary"} data-testid={`badge-status-${s.id}`}>
                          {s.active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openDetail(s)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            data-testid={`button-view-service-${s.id}`}
                            aria-label="Vis ydelse"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            data-testid={`button-edit-service-${s.id}`}
                            aria-label="Rediger ydelse"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(s.id)}
                            className="p-1.5 rounded-md hover:bg-muted text-destructive"
                            data-testid={`button-delete-service-${s.id}`}
                            aria-label="Slet ydelse"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SectionCard } from "@/components/premium";
import {
  Plus,
  Trash2,
  Edit2,
  ClipboardList,
  Eye,
  Printer,
  MapPin,
  Clock,
  X,
} from "lucide-react";

// ── Typer ──
type Frequency =
  | "dagligt"
  | "hver_2_dag"
  | "hver_3_dag"
  | "hver_4_dag"
  | "hver_5_dag"
  | "ugentligt"
  | "hver_14_dag"
  | "hver_3_uge"
  | "maanedligt"
  | "manuelt";

type ScheduleType = "fast" | "fleksibelt";

interface Customer {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  role?: string | null;
}

interface Agreement {
  id: number;
  agreementNumber: string | null;
  customerId: number;
  name: string;
}

interface PlanTask {
  description: string;
  frequency: string;
  estimatedMinutes: number;
  materials: string[];
}

interface PlanArea {
  name: string;
  tasks: PlanTask[];
  assignedEmployeeId: number | null;
}

interface CleaningPlan {
  id: number;
  companyId: number;
  customerId: number;
  agreementId: number | null;
  name: string;
  area: string | null;
  tasks: string | null;
  frequency: string | null;
  active: number | boolean | null;
  planNumber: string | null;
  location: string | null;
  areas: string | null;
  scheduleType: string | null;
  startDate: string | null;
  endDate: string | null;
  nextScheduledDate: string | null;
  totalEstimatedMinutes: number | string | null;
  checklistEnabled: number | boolean | null;
}

// ── Konstanter ──
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "dagligt", label: "Dagligt" },
  { value: "hver_2_dag", label: "Hver 2. dag" },
  { value: "hver_3_dag", label: "Hver 3. dag" },
  { value: "hver_4_dag", label: "Hver 4. dag" },
  { value: "hver_5_dag", label: "Hver 5. dag" },
  { value: "ugentligt", label: "Ugentligt" },
  { value: "hver_14_dag", label: "Hver 14. dag" },
  { value: "hver_3_uge", label: "Hver 3. uge" },
  { value: "maanedligt", label: "Månedligt" },
  { value: "manuelt", label: "Manuelt" },
];

const FREQ_LABELS: Record<string, string> = Object.fromEntries(
  FREQUENCIES.map((f) => [f.value, f.label]),
);

const BADGE_VARIANTS: Record<string, string> = {
  dagligt: "badge-soft badge-soft-blue",
  ugentligt: "badge-soft badge-soft-blue",
  maanedligt: "badge-soft badge-soft-gray",
  manuelt: "badge-soft badge-soft-amber",
};

function freqBadgeClass(freq: string) {
  return BADGE_VARIANTS[freq] ?? "badge-soft badge-soft-gray";
}

// ── Hjælpefunktioner ──
function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function num(value?: number | string | null) {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return isNaN(n) ? 0 : n;
}

function minutesToTime(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} t` : `${h} t ${m} min`;
}

function emptyTask(): PlanTask {
  return {
    description: "",
    frequency: "dagligt",
    estimatedMinutes: 0,
    materials: [],
  };
}

function emptyArea(): PlanArea {
  return {
    name: "",
    tasks: [emptyTask()],
    assignedEmployeeId: null,
  };
}

interface FormState {
  customerId: string;
  agreementId: string;
  location: string;
  scheduleType: ScheduleType;
  startDate: string;
  endDate: string;
  nextScheduledDate: string;
  checklistEnabled: boolean;
  areas: PlanArea[];
}

const EMPTY_FORM: FormState = {
  customerId: "",
  agreementId: "",
  location: "",
  scheduleType: "fast",
  startDate: today(),
  endDate: "",
  nextScheduledDate: today(),
  checklistEnabled: true,
  areas: [emptyArea()],
};

export default function RengoringsPlaner() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CleaningPlan | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [materialInput, setMaterialInput] = useState<Record<string, string>>({});

  // ── Data ──
  const { data: plans, isLoading } = useQuery<CleaningPlan[]>({
    queryKey: ["/api/cleaning-plans", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/cleaning-plans?companyId=${companyId}`)).json(),
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });

  const { data: agreements } = useQuery<Agreement[]>({
    queryKey: ["/api/cleaning-agreements", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/cleaning-agreements?companyId=${companyId}`)).json(),
  });

  const customerName = (id: number) =>
    customers?.find((c) => c.id === id)?.name ?? `Kunde #${id}`;

  const employeeName = (id: number | null) =>
    id === null || id === undefined
      ? "—"
      : employees?.find((e) => e.id === id)?.name ?? `Medarbejder #${id}`;

  const detailPlan = useMemo(
    () => plans?.find((p) => p.id === detailId) ?? null,
    [plans, detailId],
  );

  function parseAreas(p: CleaningPlan | null): PlanArea[] {
    if (!p) return [];
    try {
      const raw = p.areas ? JSON.parse(p.areas) : [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const seq = (plans?.length ?? 0) + 1;
      const planNumber = `P-${String(seq).padStart(4, "0")}`;
      const totalMinutes = data.areas.reduce(
        (sum, area) =>
          sum + area.tasks.reduce((s, t) => s + num(t.estimatedMinutes), 0),
        0,
      );
      const customer = customers?.find((c) => c.id === Number(data.customerId));
      const res = await apiRequest("POST", "/api/cleaning-plans", {
        companyId,
        customerId: data.customerId ? parseInt(data.customerId) : 0,
        agreementId: data.agreementId ? parseInt(data.agreementId) : null,
        name: customer?.name ? `${customer.name} — rengøringsplan` : "Rengøringsplan",
        area: data.location || null,
        tasks: "[]",
        frequency: "ugentligt",
        active: 1,
        planNumber,
        location: data.location || null,
        areas: JSON.stringify(data.areas),
        scheduleType: data.scheduleType,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        nextScheduledDate: data.nextScheduledDate || null,
        totalEstimatedMinutes: totalMinutes,
        checklistEnabled: data.checklistEnabled ? 1 : 0,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-plans"] });
      toast({ title: "Planen er oprettet" });
      closeDialog();
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette plan",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState }) => {
      const totalMinutes = data.areas.reduce(
        (sum, area) =>
          sum + area.tasks.reduce((s, t) => s + num(t.estimatedMinutes), 0),
        0,
      );
      const customer = customers?.find((c) => c.id === Number(data.customerId));
      const res = await apiRequest("PATCH", `/api/cleaning-plans/${id}`, {
        customerId: data.customerId ? parseInt(data.customerId) : 0,
        agreementId: data.agreementId ? parseInt(data.agreementId) : null,
        name: customer?.name ? `${customer.name} — rengøringsplan` : "Rengøringsplan",
        area: data.location || null,
        areas: JSON.stringify(data.areas),
        scheduleType: data.scheduleType,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        nextScheduledDate: data.nextScheduledDate || null,
        totalEstimatedMinutes: totalMinutes,
        checklistEnabled: data.checklistEnabled ? 1 : 0,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-plans"] });
      toast({ title: "Planen er opdateret" });
      closeDialog();
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere plan",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cleaning-plans/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-plans"] });
      toast({ title: "Planen er slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette plan",
        description: e.message,
        variant: "destructive",
      }),
  });

  // ── Form-håndtering ──
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: CleaningPlan) {
    setEditing(p);
    let parsedAreas: PlanArea[] = [emptyArea()];
    try {
      const raw = p.areas ? JSON.parse(p.areas) : [];
      if (Array.isArray(raw) && raw.length > 0) parsedAreas = raw;
    } catch {
      // ignorer
    }
    setForm({
      customerId: p.customerId ? String(p.customerId) : "",
      agreementId: p.agreementId ? String(p.agreementId) : "",
      location: p.location ?? "",
      scheduleType: (p.scheduleType as ScheduleType) ?? "fast",
      startDate: p.startDate?.slice(0, 10) ?? today(),
      endDate: p.endDate?.slice(0, 10) ?? "",
      nextScheduledDate: p.nextScheduledDate?.slice(0, 10) ?? today(),
      checklistEnabled: p.checklistEnabled ? Number(p.checklistEnabled) === 1 : true,
      areas: parsedAreas,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setMaterialInput({});
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  // ── Områder ──
  function updateArea(idx: number, patch: Partial<PlanArea>) {
    setForm((prev) => {
      const areas = [...prev.areas];
      areas[idx] = { ...areas[idx], ...patch };
      return { ...prev, areas };
    });
  }

  function addArea() {
    setForm((prev) => ({ ...prev, areas: [...prev.areas, emptyArea()] }));
  }

  function removeArea(idx: number) {
    setForm((prev) => ({
      ...prev,
      areas:
        prev.areas.length > 1
          ? prev.areas.filter((_, i) => i !== idx)
          : prev.areas,
    }));
  }

  // ── Opgaver ──
  function updateTask(
    areaIdx: number,
    taskIdx: number,
    patch: Partial<PlanTask>,
  ) {
    setForm((prev) => {
      const areas = [...prev.areas];
      const tasks = [...areas[areaIdx].tasks];
      tasks[taskIdx] = { ...tasks[taskIdx], ...patch };
      areas[areaIdx] = { ...areas[areaIdx], tasks };
      return { ...prev, areas };
    });
  }

  function addTask(areaIdx: number) {
    setForm((prev) => {
      const areas = [...prev.areas];
      areas[areaIdx] = {
        ...areas[areaIdx],
        tasks: [...areas[areaIdx].tasks, emptyTask()],
      };
      return { ...prev, areas };
    });
  }

  function removeTask(areaIdx: number, taskIdx: number) {
    setForm((prev) => {
      const areas = [...prev.areas];
      const tasks = areas[areaIdx].tasks;
      areas[areaIdx] = {
        ...areas[areaIdx],
        tasks:
          tasks.length > 1
            ? tasks.filter((_, i) => i !== taskIdx)
            : tasks,
      };
      return { ...prev, areas };
    });
  }

  // ── Materialer ──
  function addMaterial(areaIdx: number, taskIdx: number, value: string) {
    if (!value.trim()) return;
    setForm((prev) => {
      const areas = [...prev.areas];
      const tasks = [...areas[areaIdx].tasks];
      tasks[taskIdx] = {
        ...tasks[taskIdx],
        materials: [...tasks[taskIdx].materials, value.trim()],
      };
      areas[areaIdx] = { ...areas[areaIdx], tasks };
      return { ...prev, areas };
    });
    setMaterialInput((prev) => ({ ...prev, [`${areaIdx}-${taskIdx}`]: "" }));
  }

  function removeMaterial(areaIdx: number, taskIdx: number, matIdx: number) {
    setForm((prev) => {
      const areas = [...prev.areas];
      const tasks = [...areas[areaIdx].tasks];
      tasks[taskIdx] = {
        ...tasks[taskIdx],
        materials: tasks[taskIdx].materials.filter((_, i) => i !== matIdx),
      };
      areas[areaIdx] = { ...areas[areaIdx], tasks };
      return { ...prev, areas };
    });
  }

  const totalEstimated = form.areas.reduce(
    (sum, area) => sum + area.tasks.reduce((s, t) => s + num(t.estimatedMinutes), 0),
    0,
  );
  const pending = createMutation.isPending || updateMutation.isPending;

  function printChecklist() {
    window.print();
  }

  // ── Render ──
  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <PageHeader
        title="Rengøringsplaner"
        description="Strukturerede rengøringsplaner og tjeklister pr. lokation"
      />

      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-plan">
              <Plus className="w-4 h-4 mr-1.5" />
              Opret plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Rediger plan" : "Ny rengøringsplan"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Grundlæggende */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Grundlæggende oplysninger
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="plan-number">Plannummer</Label>
                    <Input
                      id="plan-number"
                      value={
                        editing?.planNumber ??
                        `P-${String((plans?.length ?? 0) + 1).padStart(4, "0")}`
                      }
                      disabled
                      data-testid="input-plan-number"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-customer">Kunde</Label>
                    <Select
                      value={form.customerId}
                      onValueChange={(v) => setForm({ ...form, customerId: v })}
                    >
                      <SelectTrigger id="plan-customer" data-testid="select-plan-customer">
                        <SelectValue placeholder="Vælg kunde" />
                      </SelectTrigger>
                      <SelectContent>
                        {(customers ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-agreement">Tilknyttet aftale</Label>
                    <Select
                      value={form.agreementId}
                      onValueChange={(v) =>
                        setForm({ ...form, agreementId: v })
                      }
                    >
                      <SelectTrigger id="plan-agreement" data-testid="select-plan-agreement">
                        <SelectValue placeholder="Ingen aftale" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ingen aftale</SelectItem>
                        {(agreements ?? []).map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.agreementNumber ?? `A-${a.id}`} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-location">Lokation</Label>
                    <Input
                      id="plan-location"
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                      placeholder="Adresse eller lokationsnavn"
                      data-testid="input-plan-location"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-type">Plan-type</Label>
                    <Select
                      value={form.scheduleType}
                      onValueChange={(v: ScheduleType) =>
                        setForm({ ...form, scheduleType: v })
                      }
                    >
                      <SelectTrigger id="plan-type" data-testid="select-plan-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">Fast</SelectItem>
                        <SelectItem value="fleksibelt">Fleksibelt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-next">Næste planlagte dato</Label>
                    <Input
                      id="plan-next"
                      type="date"
                      value={form.nextScheduledDate}
                      onChange={(e) =>
                        setForm({ ...form, nextScheduledDate: e.target.value })
                      }
                      data-testid="input-plan-next-date"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-start">Startdato</Label>
                    <Input
                      id="plan-start"
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm({ ...form, startDate: e.target.value })
                      }
                      data-testid="input-plan-startdate"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="plan-end">Slutdato</Label>
                    <Input
                      id="plan-end"
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                      data-testid="input-plan-enddate"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="plan-checklist"
                    checked={form.checklistEnabled}
                    onCheckedChange={(v) =>
                      setForm({ ...form, checklistEnabled: v === true })
                    }
                    data-testid="checkbox-plan-checklist"
                  />
                  <Label htmlFor="plan-checklist" className="cursor-pointer">
                    Tjekliste aktiveret
                  </Label>
                </div>
              </div>

              <Separator />

              {/* Områder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Områder
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addArea}
                    data-testid="button-add-area"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tilføj område
                  </Button>
                </div>

                {form.areas.map((area, areaIdx) => (
                  <div
                    key={areaIdx}
                    className="space-y-3 p-3 rounded-md border border-border bg-muted/30"
                    data-testid={`plan-area-${areaIdx}`}
                  >
                    {/* Område-header */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6 space-y-1">
                        <Label className="text-[11px]">Områdenavn</Label>
                        <Input
                          className="h-8"
                          value={area.name}
                          onChange={(e) =>
                            updateArea(areaIdx, { name: e.target.value })
                          }
                          placeholder="f.eks. Kontor 1. sal"
                          data-testid={`input-area-name-${areaIdx}`}
                        />
                      </div>
                      <div className="col-span-5 space-y-1">
                        <Label className="text-[11px]">Tildelt medarbejder</Label>
                        <Select
                          value={
                            area.assignedEmployeeId
                              ? String(area.assignedEmployeeId)
                              : ""
                          }
                          onValueChange={(v) =>
                            updateArea(areaIdx, {
                              assignedEmployeeId: v === "none" ? null : Number(v),
                            })
                          }
                        >
                          <SelectTrigger
                            className="h-8"
                            data-testid={`select-area-employee-${areaIdx}`}
                          >
                            <SelectValue placeholder="Ingen tildelt" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Ingen tildelt</SelectItem>
                            {(employees ?? []).map((emp) => (
                              <SelectItem key={emp.id} value={String(emp.id)}>
                                {emp.name}
                                {emp.role ? ` — ${emp.role}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeArea(areaIdx)}
                          className="p-1.5 rounded-md hover:bg-muted text-destructive"
                          data-testid={`button-remove-area-${areaIdx}`}
                          aria-label="Fjern område"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <Separator />

                    {/* Opgaver */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Opgaver
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addTask(areaIdx)}
                          data-testid={`button-add-task-${areaIdx}`}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Tilføj opgave
                        </Button>
                      </div>
                      {area.tasks.map((task, taskIdx) => (
                        <div
                          key={taskIdx}
                          className="space-y-2 p-2 rounded-md border border-border bg-background"
                          data-testid={`plan-task-${areaIdx}-${taskIdx}`}
                        >
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5 space-y-1">
                              <Label className="text-[11px]">Beskrivelse</Label>
                              <Input
                                className="h-8"
                                value={task.description}
                                onChange={(e) =>
                                  updateTask(areaIdx, taskIdx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="f.eks. Støvsug gulv"
                                data-testid={`input-task-description-${areaIdx}-${taskIdx}`}
                              />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-[11px]">Frekvens</Label>
                              <Select
                                value={task.frequency}
                                onValueChange={(v) =>
                                  updateTask(areaIdx, taskIdx, { frequency: v })
                                }
                              >
                                <SelectTrigger
                                  className="h-8"
                                  data-testid={`select-task-frequency-${areaIdx}-${taskIdx}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FREQUENCIES.map((f) => (
                                    <SelectItem key={f.value} value={f.value}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-[11px]">Tid (min)</Label>
                              <Input
                                className="h-8"
                                type="number"
                                min="0"
                                value={task.estimatedMinutes}
                                onChange={(e) =>
                                  updateTask(areaIdx, taskIdx, {
                                    estimatedMinutes: Number(e.target.value),
                                  })
                                }
                                data-testid={`input-task-minutes-${areaIdx}-${taskIdx}`}
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeTask(areaIdx, taskIdx)}
                                className="p-1.5 rounded-md hover:bg-muted text-destructive"
                                data-testid={`button-remove-task-${areaIdx}-${taskIdx}`}
                                aria-label="Fjern opgave"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {/* Materialer */}
                          <div className="space-y-1">
                            <Label className="text-[11px]">Materialer</Label>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {task.materials.map((mat, matIdx) => (
                                <span
                                  key={matIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted"
                                  data-testid={`material-tag-${areaIdx}-${taskIdx}-${matIdx}`}
                                >
                                  {mat}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeMaterial(areaIdx, taskIdx, matIdx)
                                    }
                                    className="text-muted-foreground hover:text-destructive"
                                    data-testid={`button-remove-material-${areaIdx}-${taskIdx}-${matIdx}`}
                                    aria-label={`Fjern ${mat}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              <Input
                                className="h-7 w-40 inline-flex"
                                value={materialInput[`${areaIdx}-${taskIdx}`] ?? ""}
                                onChange={(e) =>
                                  setMaterialInput((prev) => ({
                                    ...prev,
                                    [`${areaIdx}-${taskIdx}`]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addMaterial(
                                      areaIdx,
                                      taskIdx,
                                      (e.target as HTMLInputElement).value,
                                    );
                                  }
                                }}
                                placeholder="Tilføj materiale + Enter"
                                data-testid={`input-material-${areaIdx}-${taskIdx}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Samlet estimeret tid
                  </span>
                  <span
                    className="text-base font-bold tabular-nums"
                    data-testid="total-estimated-time"
                  >
                    {minutesToTime(totalEstimated)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background py-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeDialog}
                  data-testid="button-cancel-plan"
                >
                  Annuller
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  data-testid="button-save-plan"
                >
                  {pending ? "Gemmer..." : editing ? "Gem ændringer" : "Opret plan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      ) : (
        <SectionCard
          data-testid="card-plans"
          title="Planer"
          icon={<ClipboardList className="w-4 h-4" />}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="table-premium w-full min-w-[860px] text-sm">
              <thead>
                <tr>
                  <th>Plannummer</th>
                  <th>Kunde</th>
                  <th>Lokation</th>
                  <th className="text-center">Områder</th>
                  <th>Næste planlagt</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(plans ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-4 text-center text-muted-foreground"
                      data-testid="empty-plans"
                    >
                      Ingen planer oprettet endnu.
                    </td>
                  </tr>
                ) : (
                  (plans ?? []).map((p) => {
                    const areas = parseAreas(p);
                    return (
                      <tr key={p.id} data-testid={`row-plan-${p.id}`}>
                        <td className="p-3 font-medium text-foreground tabular-nums">
                          {p.planNumber ?? `P-${String(p.id).padStart(4, "0")}`}
                        </td>
                        <td className="p-3 font-medium">
                          {customerName(p.customerId)}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {p.location || "—"}
                        </td>
                        <td className="p-3 text-center tabular-nums">
                          {areas.length}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {dk(p.nextScheduledDate)}
                        </td>
                        <td className="p-3">
                          {p.active === 1 || p.active === true ? (
                            <span className="badge-soft badge-soft-green">
                              Aktiv
                            </span>
                          ) : (
                            <span className="badge-soft badge-soft-gray">
                              Inaktiv
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setDetailId(p.id)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                              data-testid={`button-view-plan-${p.id}`}
                              aria-label="Vis plan"
                              title="Vis plan"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                              data-testid={`button-edit-plan-${p.id}`}
                              aria-label="Rediger plan"
                              title="Rediger plan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(p.id)}
                              className="p-1.5 rounded-md hover:bg-muted text-destructive"
                              data-testid={`button-delete-plan-${p.id}`}
                              aria-label="Slet plan"
                              title="Slet plan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Detaljevisning / tjekliste ── */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detailPlan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap text-xl">
                  <span>
                    {detailPlan.planNumber ?? `P-${String(detailPlan.id).padStart(4, "0")}`}
                  </span>
                  {detailPlan.active === 1 || detailPlan.active === true ? (
                    <span className="badge-soft badge-soft-green">Aktiv</span>
                  ) : (
                    <span className="badge-soft badge-soft-gray">Inaktiv</span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Overskrift til tjekliste */}
                <div className="p-4 rounded-md border border-border bg-muted/30 print:border-2 print:bg-white">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-xl font-bold">
                        Rengøringsplan
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {detailPlan.planNumber ?? `P-${String(detailPlan.id).padStart(4, "0")}`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{customerName(detailPlan.customerId)}</p>
                      {detailPlan.location && (
                        <p className="text-muted-foreground flex items-center gap-1 justify-end">
                          <MapPin className="w-3.5 h-3.5" />
                          {detailPlan.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Plan-type</p>
                      <p className="font-medium">
                        {detailPlan.scheduleType === "fleksibelt" ? "Fleksibelt" : "Fast"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Næste planlagt</p>
                      <p className="font-medium">{dk(detailPlan.nextScheduledDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Samlet tid</p>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {minutesToTime(num(detailPlan.totalEstimatedMinutes))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Områder som tjekliste */}
                {parseAreas(detailPlan).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-4">
                    Ingen områder defineret for denne plan.
                  </p>
                ) : (
                  parseAreas(detailPlan).map((area, areaIdx) => (
                    <div
                      key={areaIdx}
                      className="space-y-2 p-3 rounded-md border border-border print:border-2"
                      data-testid={`detail-area-${areaIdx}`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-base font-semibold">
                          {area.name || `Område ${areaIdx + 1}`}
                        </h4>
                        <div className="text-sm text-muted-foreground">
                          Tildelt: <span className="font-medium text-foreground">{employeeName(area.assignedEmployeeId)}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {area.tasks.map((task, taskIdx) => (
                          <div
                            key={taskIdx}
                            className="flex items-start gap-2 p-2 rounded bg-muted/30 print:bg-white print:border print:border-border"
                            data-testid={`detail-task-${areaIdx}-${taskIdx}`}
                          >
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => {}}
                              className="mt-0.5 print:hidden"
                              data-testid={`detail-checkbox-${areaIdx}-${taskIdx}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {task.description || "Uden beskrivelse"}
                                </span>
                                <span className={freqBadgeClass(task.frequency)}>
                                  {FREQ_LABELS[task.frequency] ?? task.frequency}
                                </span>
                                {num(task.estimatedMinutes) > 0 && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" />
                                    {minutesToTime(num(task.estimatedMinutes))}
                                  </span>
                                )}
                              </div>
                              {task.materials.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    Materialer:
                                  </span>
                                  {task.materials.map((mat, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className="text-xs px-1.5 py-0.5 rounded bg-muted"
                                    >
                                      {mat}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                {/* Handlinger */}
                <Separator className="print:hidden" />
                <div className="flex justify-end gap-2 print:hidden">
                  <Button
                    variant="ghost"
                    onClick={() => setDetailId(null)}
                    data-testid="button-close-detail-plan"
                  >
                    Luk
                  </Button>
                  <Button
                    onClick={printChecklist}
                    data-testid="button-print-checklist"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Print tjekliste
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

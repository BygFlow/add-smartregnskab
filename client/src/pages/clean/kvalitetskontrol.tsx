import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ClipboardCheck, Check, X, ShieldCheck, AlertTriangle } from "lucide-react";

type InspectionStatus = "afventer" | "godkendt" | "afvigelse";

interface ChecklistItem {
  item: string;
  passed: boolean;
}

interface QualityInspection {
  id: number;
  companyId: number;
  inspectorName: string;
  date: string;
  score?: number | string | null;
  maxScore?: number | string | null;
  customerName?: string | null;
  checklist?: string | ChecklistItem[] | null;
  status: InspectionStatus | string;
}

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  godkendt: "badge-soft badge-soft-green",
  afvigelse: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  godkendt: "Godkendt",
  afvigelse: "Afvigelse",
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

function parseChecklist(
  raw: string | ChecklistItem[] | null | undefined
): ChecklistItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scorePercent(score: number | string | null | undefined, max: number | string | null | undefined): number {
  const s = Number(score) || 0;
  const m = Number(max) || 0;
  if (m <= 0) return 0;
  return (s / m) * 100;
}

function scoreToneClass(pct: number): string {
  if (pct > 80) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function scoreBarClass(pct: number): string {
  if (pct > 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export default function Kvalitetskontrol({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: inspections, isLoading } = useQuery<QualityInspection[]>({
    queryKey: ["/api/quality-inspections", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/quality-inspections?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/quality-inspections"] });

  const createInspection = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/quality-inspections?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Inspektion oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette inspektion",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateInspection = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/quality-inspections/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Inspektion opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere inspektion",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteInspection = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/quality-inspections/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Inspektion slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette inspektion",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-inspections">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const list = inspections ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kvalitetskontrol</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registrer og følg op på kvalitetsinspektioner
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-inspection" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Opret inspektion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ny kvalitetsinspektion</DialogTitle>
            </DialogHeader>
            <InspectionForm
              pending={createInspection.isPending}
              onSubmit={async (data) => {
                await createInspection.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-inspections"
        >
          <ClipboardCheck className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen inspektioner endnu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((inspection) => {
            const pct = scorePercent(inspection.score, inspection.maxScore);
            const checklist = parseChecklist(inspection.checklist);
            const passed = checklist.filter((c) => c.passed).length;
            return (
              <Card key={inspection.id} data-testid={`card-inspection-${inspection.id}`} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-1.5 truncate">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span className="truncate">{inspection.customerName || "Uden kunde"}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dk(inspection.date)} · {inspection.inspectorName}
                      </p>
                    </div>
                    <span
                      className={STATUS_STYLE[inspection.status as string] ?? "badge-soft badge-soft-amber"}
                      data-testid={`badge-inspection-status-${inspection.id}`}
                    >
                      {STATUS_LABEL[inspection.status as string] ?? inspection.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5" data-testid={`score-inspection-${inspection.id}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Score</span>
                      <span
                        className={`text-lg font-bold tabular-nums ${scoreToneClass(pct)}`}
                        data-testid={`text-inspection-score-${inspection.id}`}
                      >
                        {inspection.score ?? "0"} / {inspection.maxScore ?? "0"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreBarClass(pct)}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground text-right">
                      {pct.toLocaleString("da-DK", { maximumFractionDigits: 0 })}%
                    </p>
                  </div>

                  {checklist.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Tjekliste ({passed}/{checklist.length} godkendt)
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {checklist.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-xs"
                            data-testid={`checklist-item-${inspection.id}-${i}`}
                          >
                            {c.passed ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                            )}
                            <span className={c.passed ? "text-muted-foreground" : "text-foreground"}>
                              {c.item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-1">
                    {inspection.status === "afventer" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-approve-inspection-${inspection.id}`}
                          disabled={updateInspection.isPending}
                          onClick={() =>
                            updateInspection.mutate({
                              id: inspection.id,
                              data: { status: "godkendt" },
                            })
                          }
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />Godkend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-deviation-inspection-${inspection.id}`}
                          disabled={updateInspection.isPending}
                          onClick={() =>
                            updateInspection.mutate({
                              id: inspection.id,
                              data: { status: "afvigelse" },
                            })
                          }
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />Afvigelse
                        </Button>
                      </>
                    )}
                    <button
                      onClick={() => deleteInspection.mutate(inspection.id)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground ml-auto"
                      data-testid={`button-delete-inspection-${inspection.id}`}
                      title="Slet inspektion"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InspectionForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [inspectorName, setInspectorName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { item: "", passed: true },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () =>
    setChecklist((prev) => [...prev, { item: "", passed: true }]);
  const removeRow = (i: number) =>
    setChecklist((prev) => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<ChecklistItem>) =>
    setChecklist((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const validChecklist = checklist.filter((c) => c.item.trim());
    const payload = {
      inspectorName,
      customerName: customerName || null,
      date,
      score: score ? Number(score) : 0,
      maxScore: maxScore ? Number(maxScore) : 100,
      checklist: JSON.stringify(validChecklist),
      status: "afventer",
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inspection-inspector">Inspektør *</Label>
          <Input
            id="inspection-inspector"
            data-testid="input-inspection-inspector"
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inspection-date">Dato</Label>
          <Input
            id="inspection-date"
            type="date"
            data-testid="input-inspection-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inspection-customer">Kunde</Label>
        <Input
          id="inspection-customer"
          data-testid="input-inspection-customer"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Valgfrit"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inspection-score">Score</Label>
          <Input
            id="inspection-score"
            type="number"
            data-testid="input-inspection-score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inspection-max">Maks score</Label>
          <Input
            id="inspection-max"
            type="number"
            data-testid="input-inspection-max"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tjekliste</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            data-testid="button-add-checklist-row"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />Tilføj punkt
          </Button>
        </div>
        <div className="space-y-2">
          {checklist.map((c, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`checklist-form-row-${i}`}>
              <Input
                placeholder="Punkt"
                value={c.item}
                onChange={(e) => updateRow(i, { item: e.target.value })}
                data-testid={`input-checklist-item-${i}`}
              />
              <button
                type="button"
                onClick={() => updateRow(i, { passed: !c.passed })}
                className={`shrink-0 px-2 py-2 rounded-md border text-xs font-medium ${
                  c.passed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                }`}
                data-testid={`button-checklist-passed-${i}`}
              >
                {c.passed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="shrink-0 p-2 rounded-md hover:bg-muted text-muted-foreground"
                data-testid={`button-remove-checklist-row-${i}`}
                title="Fjern"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-inspection"
        >
          {submitting || pending ? "Gemmer..." : "Gem inspektion"}
        </Button>
      </DialogFooter>
    </form>
  );
}

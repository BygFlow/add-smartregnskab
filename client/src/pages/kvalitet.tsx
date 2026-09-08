import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCustomers, useEmployees, useTasks } from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import type { Customer, Employee, Inspection, Task } from "@shared/schema";
import { PageHeader, MetricCard, SectionCard } from "@/components/premium";

type Area = { key: string; label: string; weight: number };
type Score = { area: string; score: number; weight?: number };
type InspectionResponse = {
  inspections: Inspection[];
  averageScore: number;
  areas: Area[];
  openFollowUps: number;
};

const RESULT_LABEL: Record<string, string> = {
  godkendt: "Godkendt",
  anmaerkning: "Anmærkning",
  ikke_godkendt: "Ikke godkendt",
};
const RESULT_STYLE: Record<string, string> = {
  godkendt: "badge-soft badge-soft-green",
  anmaerkning: "badge-soft badge-soft-amber",
  ikke_godkendt: "badge-soft badge-soft-red",
};

function dk(date?: string | null) {
  if (!date) return "—";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

function parseScores(raw: string): Score[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scoreTone(score: number) {
  return score >= 90
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 75
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";
}

export default function Kvalitet() {
  const { companyId, user, hasFeature, plan } = useAuth();
  const { toast } = useToast();
  const allowed = hasFeature("kvalitetskontrol");
  const canCreate = ["leder", "holdleder", "platform_admin"].includes(
    user?.role ?? "",
  );
  const canDelete = ["leder", "platform_admin"].includes(user?.role ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: employees } = useEmployees(companyId);
  const { data: customers } = useCustomers(companyId);
  const { data: tasks } = useTasks(companyId);
  const { data, isLoading } = useQuery<InspectionResponse>({
    queryKey: ["/api/inspections", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/inspections")).json(),
    enabled: allowed,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/inspections", companyId],
    });
  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await apiRequest("POST", "/api/inspections", payload)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Kvalitetskontrollen er gemt" });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke gemme kontrollen",
        description: error.message,
        variant: "destructive",
      }),
  });
  const finishFollowUp = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest("PATCH", `/api/inspections/${id}`, { followUpDone: 1 })
      ).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Opfølgningen er markeret som klaret" });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke opdatere opfølgningen",
        description: error.message,
        variant: "destructive",
      }),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inspections/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Kvalitetskontrollen er slettet" });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke slette kontrollen",
        description: error.message,
        variant: "destructive",
      }),
  });

  const customerName = (id: number) =>
    customers?.find((customer) => customer.id === id)?.name ?? `Kunde #${id}`;
  const employeeName = (id?: number | null) =>
    id
      ? (employees?.find((employee) => employee.id === id)?.name ??
        `Ansat #${id}`)
      : "—";
  const areas = data?.areas ?? [];
  const inspections = useMemo(
    () =>
      [...(data?.inspections ?? [])].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [data?.inspections],
  );

  if (!allowed) {
    return (
      <div className="p-3 md:p-4 max-w-2xl mx-auto">
        <div
          className="rounded-md border border-border/50 bg-card p-4 text-center space-y-2"
          data-testid="notice-feature-locked"
        >
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">
            Kvalitetskontrol er ikke med i din pakke
          </h1>
          <p className="text-sm text-muted-foreground">
            Pakken {plan?.name ?? "din nuværende"} indeholder ikke
            kvalitetskontrol. Opgradér på abonnementssiden for at få adgang.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto"
        data-testid="loading-inspections"
      >
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-md" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <PageHeader
        eyebrow="Kontrol"
        title="Kvalitetskontrol"
        description="Kvalitetstjek og kontrol"
        action={
          canCreate ? (
            <Button
              data-testid="button-new-inspection"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ny kontrol
            </Button>
          ) : undefined
        }
      />

      {user?.role === "assistent" && (
        <div
          className="rounded-md border border-border/50 bg-muted/30 px-4 py-3 flex gap-2 text-xs text-muted-foreground"
          data-testid="notice-assistant-inspections"
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          Du ser kun kvalitetskontroller, der vedrører dig.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          data-testid="card-text-inspections-average"
          valueTestId="text-inspections-average"
          icon={<ClipboardCheck className="w-5 h-5" />}
          value={(data?.averageScore ?? 0).toLocaleString("da-DK", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          label="Gennemsnitsscore"
          variant={(data?.averageScore ?? 0) >= 90 ? "green" : (data?.averageScore ?? 0) >= 75 ? "amber" : "red"}
        />
        <MetricCard
          data-testid="card-text-inspections-count"
          valueTestId="text-inspections-count"
          icon={<CheckCircle2 className="w-5 h-5" />}
          value={String(inspections.length)}
          label="Kontroller"
          variant="blue"
        />
        <MetricCard
          data-testid="card-text-inspections-follow-ups"
          valueTestId="text-inspections-follow-ups"
          icon={<AlertTriangle className="w-5 h-5" />}
          value={String(data?.openFollowUps ?? 0)}
          label="Åbne opfølgninger"
          variant={(data?.openFollowUps ?? 0) > 0 ? "amber" : "gray"}
        />
      </div>

      <SectionCard title="Kvalitetskontroller" icon={<ShieldCheck className="w-4 h-4" />} noPadding>
      {inspections.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border m-3 p-10 text-center"
          data-testid="empty-inspections"
        >
          <ClipboardCheck className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Der er endnu ingen kvalitetskontroller at vise.
          </p>
          {canCreate && (
            <Button
              size="sm"
              className="mt-3"
              data-testid="button-empty-new-inspection"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Opret den første
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {inspections.map((inspection) => {
            const expanded = inspection.id === expandedId;
            return (
              <div
                key={inspection.id}
                className="rounded-md border border-border/50 bg-card overflow-hidden"
                data-testid={`card-inspection-${inspection.id}`}
              >
                <div className="p-3 flex flex-wrap items-center gap-2">
                  <div
                    className={`text-lg font-bold tabular-nums shrink-0 ${scoreTone(inspection.totalScore)}`}
                    data-testid={`text-inspection-score-${inspection.id}`}
                  >
                    {inspection.totalScore.toLocaleString("da-DK", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="font-medium text-xs text-foreground truncate">
                        {customerName(inspection.customerId)}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${RESULT_STYLE[inspection.result] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {RESULT_LABEL[inspection.result] ?? inspection.result}
                      </span>
                      {inspection.customerVisible === 1 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Kunden kan se
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {dk(inspection.date)} · Ansat:{" "}
                      {employeeName(inspection.employeeId)} · Inspektør:{" "}
                      {employeeName(inspection.inspectorId)}
                    </p>
                    {inspection.followUpDate && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Opfølgning: {dk(inspection.followUpDate)}
                        {inspection.followUpDone === 1
                          ? " · Klaret"
                          : " · Åben"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {canCreate &&
                      inspection.followUpDate &&
                      inspection.followUpDone === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-complete-follow-up-${inspection.id}`}
                          disabled={finishFollowUp.isPending}
                          onClick={() => finishFollowUp.mutate(inspection.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Markér opfølgning som klaret
                        </Button>
                      )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Slet kvalitetskontrol"
                        data-testid={`button-delete-inspection-${inspection.id}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(inspection.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={
                        expanded ? "Skjul områdescorer" : "Vis områdescorer"
                      }
                      data-testid={`button-toggle-inspection-${inspection.id}`}
                      onClick={() =>
                        setExpandedId(expanded ? null : inspection.id)
                      }
                    >
                      {expanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <InspectionDetail inspection={inspection} areas={areas} />
                )}
              </div>
            );
          })}
        </div>
      )}
      </SectionCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ny kvalitetskontrol</DialogTitle>
          </DialogHeader>
          <InspectionForm
            key={areas.map((area) => area.key).join("-")}
            areas={areas}
            customers={customers ?? []}
            employees={employees ?? []}
            tasks={tasks ?? []}
            pending={create.isPending}
            onSubmit={(payload) => create.mutate(payload)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  testId,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  testId: string;
  tone?: string;
}) {
  return (
    <div
      className="kpi-card"
      data-testid={`card-${testId}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${tone}`}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

function InspectionDetail({
  inspection,
  areas,
}: {
  inspection: Inspection;
  areas: Area[];
}) {
  const scores = parseScores(inspection.scores);
  const scoreByArea = new Map(scores.map((score) => [score.area, score]));
  const visibleAreas = areas.length
    ? areas
    : scores.map((score) => ({
        key: score.area,
        label: score.area,
        weight: score.weight ?? 0,
      }));
  return (
    <div
      className="border-t border-border bg-muted/20 p-3 space-y-2"
      data-testid={`section-inspection-scores-${inspection.id}`}
    >
      <h2 className="text-xs font-medium text-foreground">
        Bedømmelsesområder
      </h2>
      {visibleAreas.map((area) => {
        const score = scoreByArea.get(area.key);
        const value = Math.max(0, Math.min(5, score?.score ?? 0));
        return (
          <div
            key={area.key}
            data-testid={`score-area-${inspection.id}-${area.key}`}
          >
            <div className="flex justify-between gap-2 text-[11px] mb-1">
              <span className="text-foreground truncate">
                {area.label}{" "}
                <span className="text-muted-foreground">({area.weight} %)</span>
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {value}/5
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${value >= 4.5 ? "bg-emerald-500" : value >= 3.75 ? "bg-amber-500" : "bg-destructive"}`}
                style={{ width: `${(value / 5) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      {inspection.note && (
        <div className="rounded-md border border-border/50 bg-card p-3">
          <p className="text-[11px] font-medium text-foreground">Note</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
            {inspection.note}
          </p>
        </div>
      )}
    </div>
  );
}

function InspectionForm({
  areas,
  customers,
  employees,
  tasks,
  pending,
  onSubmit,
}: {
  areas: Area[];
  customers: Customer[];
  employees: Employee[];
  tasks: Task[];
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [customerId, setCustomerId] = useState(String(customers[0]?.id ?? ""));
  const [employeeId, setEmployeeId] = useState("none");
  const [taskId, setTaskId] = useState("none");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(areas.map((area) => [area.key, 5])),
  );
  const [followUpDate, setFollowUpDate] = useState("");
  const [customerVisible, setCustomerVisible] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const totalWeight = areas.reduce((sum, area) => sum + area.weight, 0);
  const totalScore = totalWeight
    ? (areas.reduce(
        (sum, area) => sum + (values[area.key] ?? 0) * area.weight,
        0,
      ) /
        (totalWeight * 5)) *
      100
    : 0;
  const result =
    totalScore >= 90
      ? "godkendt"
      : totalScore >= 75
        ? "anmaerkning"
        : "ikke_godkendt";
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerId) return setError("Vælg en kunde.");
    if (areas.length === 0)
      return setError("Bedømmelsesområderne kunne ikke hentes.");
    setError(null);
    onSubmit({
      customerId: Number(customerId),
      employeeId: employeeId === "none" ? null : Number(employeeId),
      taskId: taskId === "none" ? null : Number(taskId),
      date,
      scores: areas.map((area) => ({
        area: area.key,
        weight: area.weight,
        score: values[area.key] ?? 0,
      })),
      followUpDate: followUpDate || null,
      customerVisible,
      note: note.trim() || null,
    });
  };
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label>Kunde</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger data-testid="select-inspection-customer">
            <SelectValue placeholder="Vælg kunde" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={String(customer.id)}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Ansat</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger data-testid="select-inspection-employee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ikke knyttet til en ansat</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={String(employee.id)}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inspection-date">Dato</Label>
          <Input
            id="inspection-date"
            type="date"
            data-testid="input-inspection-date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Opgave</Label>
        <Select value={taskId} onValueChange={setTaskId}>
          <SelectTrigger data-testid="select-inspection-task">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen specifik opgave</SelectItem>
            {tasks.map((task) => (
              <SelectItem key={task.id} value={String(task.id)}>
                {task.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          Bedømmelse
        </legend>
        {areas.map((area) => (
          <div
            key={area.key}
            className="rounded-md border border-border/50 p-3"
            data-testid={`field-inspection-area-${area.key}`}
          >
            <div className="flex justify-between gap-3 mb-2">
              <span className="text-sm text-foreground">{area.label}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                Vægt {area.weight} %
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <Button
                  type="button"
                  key={value}
                  size="sm"
                  variant={values[area.key] === value ? "default" : "outline"}
                  className="h-9 px-0"
                  data-testid={`button-inspection-score-${area.key}-${value}`}
                  onClick={() =>
                    setValues((current) => ({ ...current, [area.key]: value }))
                  }
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <div
        className="rounded-md bg-muted/50 p-3 flex items-center justify-between gap-3"
        data-testid="card-inspection-live-score"
      >
        <div>
          <p className="text-xs text-muted-foreground">Beregnet score</p>
          <p
            className={`text-lg font-bold tabular-nums ${scoreTone(totalScore)}`}
            data-testid="text-inspection-live-score"
          >
            {totalScore.toLocaleString("da-DK", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </p>
        </div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${RESULT_STYLE[result]}`}
        >
          {RESULT_LABEL[result]}
        </span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inspection-followup">Opfølgningsdato</Label>
        <Input
          id="inspection-followup"
          type="date"
          data-testid="input-inspection-follow-up"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Bruges ved anmærkning eller ikke godkendt. Serveren sætter ellers en
          frist automatisk.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="inspection-customer-visible"
          checked={customerVisible}
          onCheckedChange={(checked) => setCustomerVisible(checked === true)}
          data-testid="checkbox-inspection-customer-visible"
        />
        <Label
          htmlFor="inspection-customer-visible"
          className="text-sm font-normal"
        >
          Kunden kan se rapporten
        </Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inspection-note">Note</Label>
        <Textarea
          id="inspection-note"
          rows={3}
          data-testid="input-inspection-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Valgfri bemærkning"
        />
      </div>
      {error && (
        <p
          className="text-xs text-destructive"
          data-testid="text-inspection-form-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        data-testid="button-save-inspection"
        disabled={pending}
      >
        {pending ? "Gemmer..." : "Gem kvalitetskontrol"}
      </Button>
    </form>
  );
}

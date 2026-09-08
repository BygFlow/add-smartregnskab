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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ArrowRight, TrendingUp, Trophy, XCircle } from "lucide-react";

type Stage =
  | "ny"
  | "kontaktet"
  | "tilbud_sendt"
  | "forhandling"
  | "vundet"
  | "tabt";

type Source = "ai_leads" | "manual" | "referral" | "website";

interface PipelineLead {
  id: number;
  companyId: number;
  leadName: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  estimatedValue: number | string | null;
  probability: number | string | null;
  expectedCloseDate?: string | null;
  stage: Stage;
  source: Source;
  notes?: string | null;
}

const STAGES: { key: Stage; label: string }[] = [
  { key: "ny", label: "Ny" },
  { key: "kontaktet", label: "Kontaktet" },
  { key: "tilbud_sendt", label: "Tilbud sendt" },
  { key: "forhandling", label: "Forhandling" },
  { key: "vundet", label: "Vundet" },
  { key: "tabt", label: "Tabt" },
];

const STAGE_ORDER: Stage[] = [
  "ny",
  "kontaktet",
  "tilbud_sendt",
  "forhandling",
  "vundet",
  "tabt",
];

const SOURCE_LABELS: Record<Source, string> = {
  ai_leads: "AI Lead",
  manual: "Manuel",
  referral: "Henvisning",
  website: "Hjemmeside",
};

const SOURCE_VARIANTS: Record<Source, "default" | "secondary" | "outline"> = {
  ai_leads: "default",
  manual: "secondary",
  referral: "outline",
  website: "outline",
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

function LeadForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [leadName, setLeadName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [probability, setProbability] = useState("0");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [stage, setStage] = useState<Stage>("ny");
  const [source, setSource] = useState<Source>("manual");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!leadName.trim()) return;
    onSubmit({
      leadName: leadName.trim(),
      contactPerson: contactPerson.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      estimatedValue: estimatedValue ? num(estimatedValue) : 0,
      probability: probability ? num(probability) : 0,
      expectedCloseDate: expectedCloseDate || null,
      stage,
      source,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Lead-navn *</Label>
        <Input
          id="lead-name"
          data-testid="input-lead-name"
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          placeholder="F.eks. Kontorrengøring hos ACME"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contact-person">Kontaktperson</Label>
          <Input
            id="contact-person"
            data-testid="input-contact-person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">Telefon</Label>
          <Input
            id="contact-phone"
            data-testid="input-contact-phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-email">E-mail</Label>
        <Input
          id="contact-email"
          data-testid="input-contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="estimated-value">Estimeret værdi (kr)</Label>
          <Input
            id="estimated-value"
            data-testid="input-estimated-value"
            type="number"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="probability">Sandsynlighed (%)</Label>
          <Input
            id="probability"
            data-testid="input-probability"
            type="number"
            min={0}
            max={100}
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="expected-close">Forventet lukning</Label>
          <Input
            id="expected-close"
            data-testid="input-expected-close"
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kilde</Label>
          <Select value={source} onValueChange={(v) => setSource(v as Source)}>
            <SelectTrigger data-testid="select-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-stage">Fase</Label>
        <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
          <SelectTrigger data-testid="select-stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-notes">Noter</Label>
        <Textarea
          id="lead-notes"
          data-testid="input-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-lead"
          disabled={pending || !leadName.trim()}
          onClick={submit}
        >
          Gem lead
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function CrmPipeline({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<PipelineLead[]>({
    queryKey: ["/api/sales-pipeline", companyId],
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/sales-pipeline?companyId=${companyId}`)
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/sales-pipeline"] });

  const createLead = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/sales-pipeline?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Lead oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette lead",
        description: e.message,
        variant: "destructive",
      }),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: Stage }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/sales-pipeline/${id}?companyId=${companyId}`,
          { stage },
        )
      ).json(),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke flytte lead",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        "DELETE",
        `/api/sales-pipeline/${id}?companyId=${companyId}`,
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Lead slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette lead",
        description: e.message,
        variant: "destructive",
      }),
  });

  const leads = data ?? [];
  const byStage = useMemo(() => {
    const map: Record<Stage, PipelineLead[]> = {
      ny: [],
      kontaktet: [],
      tilbud_sendt: [],
      forhandling: [],
      vundet: [],
      tabt: [],
    };
    for (const lead of leads) {
      if (map[lead.stage]) map[lead.stage].push(lead);
    }
    return map;
  }, [leads]);

  const summary = useMemo(() => {
    const openStages: Stage[] = ["ny", "kontaktet", "tilbud_sendt", "forhandling"];
    const pipelineValue = leads
      .filter((l) => openStages.includes(l.stage))
      .reduce((sum, l) => sum + num(l.estimatedValue), 0);
    const wonValue = byStage.vundet.reduce(
      (sum, l) => sum + num(l.estimatedValue),
      0,
    );
    const lostCount = byStage.tabt.length;
    return { pipelineValue, wonValue, lostCount };
  }, [leads, byStage]);

  const nextStage = (stage: Stage): Stage | null => {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
    return STAGE_ORDER[idx + 1];
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-7xl mx-auto pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CRM Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Salgsleads og muligheder
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-lead" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tilføj lead
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tilføj lead</DialogTitle>
            </DialogHeader>
            <LeadForm
              pending={createLead.isPending}
              onSubmit={(body) => createLead.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-pipeline-value">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet pipeline-værdi
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {money(summary.pipelineValue)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-won-value">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vundet værdi
            </CardTitle>
            <Trophy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-green-600 dark:text-green-500">
              {money(summary.wonValue)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-lost-count">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tabte leads
            </CardTitle>
            <XCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {summary.lostCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3"
        data-testid="kanban-board"
      >
        {STAGES.map((stage) => {
          const stageLeads = byStage[stage.key];
          const stageValue = stageLeads.reduce(
            (sum, l) => sum + num(l.estimatedValue),
            0,
          );
          return (
            <div
              key={stage.key}
              className="flex flex-col rounded-lg border bg-card min-h-[12rem]"
              data-testid={`column-${stage.key}`}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-sm font-medium">{stage.label}</span>
                <Badge variant="secondary">{stageLeads.length}</Badge>
              </div>
              <div className="text-[11px] text-muted-foreground px-3 pb-2">
                {money(stageValue)}
              </div>
              <div className="flex flex-col gap-2 p-2 flex-1">
                {stageLeads.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Ingen leads
                  </div>
                )}
                {stageLeads.map((lead) => {
                  const ns = nextStage(lead.stage);
                  return (
                    <div
                      key={lead.id}
                      className="rounded-md border bg-background p-2.5 space-y-2 shadow-sm"
                      data-testid={`card-lead-${lead.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm leading-tight">
                          {lead.leadName}
                        </div>
                        <button
                          className="p-1 rounded hover:bg-muted text-destructive"
                          data-testid={`button-delete-lead-${lead.id}`}
                          onClick={() => deleteLead.mutate(lead.id)}
                          aria-label="Slet lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {lead.contactPerson && (
                        <div className="text-xs text-muted-foreground truncate">
                          {lead.contactPerson}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium tabular-nums">
                          {money(num(lead.estimatedValue))}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {num(lead.probability)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={SOURCE_VARIANTS[lead.source]}>
                          {SOURCE_LABELS[lead.source]}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {date(lead.expectedCloseDate)}
                        </span>
                      </div>
                      {ns && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs"
                          data-testid={`button-move-lead-${lead.id}`}
                          disabled={moveStage.isPending}
                          onClick={() =>
                            moveStage.mutate({ id: lead.id, stage: ns })
                          }
                        >
                          Flyt til{" "}
                          {STAGES.find((s) => s.key === ns)?.label}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

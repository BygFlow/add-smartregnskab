import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Bot, Check, Clock3, ExternalLink, FileCheck2, Gavel, RefreshCw,
  ShieldAlert, ShieldCheck, Sparkles, X,
} from "lucide-react";

type Governance = {
  settings: {
    enabled: boolean;
    targetAutonomyPercent: number;
    minimumConfidence: number;
    requireEvidence: boolean;
    approvalActions: string[];
  };
  decisions: Array<{
    id: number;
    actionType: string;
    recommendation: string;
    reasoning: string;
    confidence: number;
    riskLevel: string;
    status: string;
    proposedAt: string;
  }>;
  regulatorySources: Array<{
    id: number;
    name: string;
    url: string;
    jurisdiction: string;
    lastCheckedAt?: string | null;
    lastHttpStatus?: number | null;
  }>;
  regulatoryChanges: Array<{ id: number; status: string; detectedAt: string; summary?: string | null }>;
  summary: { pendingApprovals: number; automaticallyCleared: number; pendingLegalReviews: number };
};

const actionLabels: Record<string, string> = {
  tax_submission: "Skatteindberetning",
  vat_submission: "Momsindberetning",
  payment: "Betaling",
  payroll_submission: "Lønindberetning",
  period_close: "Periodelukning",
  annual_report: "Årsrapport",
  audit_statement: "Revisorerklæring",
  credit_note: "Kreditnota",
  legal_rule_change: "Aktivering af lovændring",
  user_access: "Ændring af adgang",
  data_deletion: "Sletning af data",
};

export default function AiStyring({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { user, isPlatformAdmin } = useAuth();
  const { toast } = useToast();
  const key = ["/api/ai-governance", companyId] as const;
  const query = useQuery<Governance>({
    queryKey: key,
    queryFn: async () => (await apiRequest("GET", "/api/ai-governance")).json(),
    refetchInterval: 60_000,
  });

  const updateSettings = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiRequest("PATCH", "/api/ai-governance/settings", body)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: "AI-politikken er opdateret" }); },
  });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: "approve" | "reject" }) =>
      (await apiRequest("POST", `/api/ai-governance/decisions/${id}/${decision}`, {})).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const monitor = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/regulatory-monitor/run", {})).json(),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Officielle kilder kontrolleret", description: `${result.checked} kontrolleret, ${result.changed} ændret, ${result.failed} fejl.` });
    },
  });

  if (query.isLoading || !query.data) return <Skeleton className="h-[520px] w-full" />;
  const data = query.data;
  const pending = data.decisions.filter((item) => item.status === "afventer_godkendelse");

  return (
    <div className="space-y-5" data-testid="ai-governance-center">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Bot className="h-6 w-6 text-violet-600" /><h2 className="text-xl font-semibold">AI-styring</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Autopilot til rutinearbejde med ufravigelige godkendelsesporte og komplet beslutningsspor.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="text-sm font-medium">Autopilot</span>
          <Switch
            checked={data.settings.enabled}
            onCheckedChange={(enabled) => updateSettings.mutate({ enabled })}
            disabled={!isPlatformAdmin && user?.role !== "leder"}
          />
        </div>
      </div>

      <section className="grid gap-4 rounded-xl border bg-card p-5 lg:grid-cols-[210px_1fr]">
        <div className="lg:border-r lg:pr-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Målsat autonomi</p>
          <p className="mt-1 text-5xl font-bold text-violet-600">{data.settings.targetAutonomyPercent}%</p>
          <p className="mt-2 text-xs text-muted-foreground">Kun når sikkerhed ≥ {(data.settings.minimumConfidence * 100).toFixed(0)} % og evidens findes.</p>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Automatiseringsmål</span><span>{data.settings.targetAutonomyPercent}/100</span></div>
          <Progress value={data.settings.targetAutonomyPercent} className="h-2.5" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Afventer menneske" value={data.summary.pendingApprovals} icon={<Clock3 className="h-4 w-4 text-amber-600" />} />
            <Stat label="Klar til automatik" value={data.summary.automaticallyCleared} icon={<Sparkles className="h-4 w-4 text-violet-600" />} />
            <Stat label="Lovændringer til review" value={data.summary.pendingLegalReviews} icon={<Gavel className="h-4 w-4 text-blue-600" />} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-semibold">Den obligatoriske godkendelsesport</h3><p className="text-xs text-muted-foreground">Disse handlinger må AI aldrig gennemføre alene.</p></div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {data.settings.approvalActions.map((action) => (
              <div key={action} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />{actionLabels[action] ?? action}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-semibold">Godkendelseskø</h3><p className="text-xs text-muted-foreground">Lav sikkerhed, manglende evidens eller høj risiko eskaleres automatisk.</p></div>
          <div className="max-h-80 space-y-2 overflow-auto p-3">
            {pending.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Ingen AI-beslutninger afventer.</p> : pending.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{actionLabels[item.actionType] ?? item.actionType}</p><span className="text-xs tabular-nums">{Math.round(item.confidence * 100)} %</span></div>
                <p className="mt-1 text-xs">{item.recommendation}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.reasoning}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => decide.mutate({ id: item.id, decision: "approve" })}><Check className="mr-1 h-3.5 w-3.5" />Godkend</Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: item.id, decision: "reject" })}><X className="mr-1 h-3.5 w-3.5" />Afvis</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div><h3 className="font-semibold">Automatisk regelovervågning</h3><p className="text-xs text-muted-foreground">Officielle kilder kontrolleres dagligt. En ændring bliver aldrig automatisk til en bogføringsregel.</p></div>
          {isPlatformAdmin && <Button size="sm" variant="outline" onClick={() => monitor.mutate()} disabled={monitor.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${monitor.isPending ? "animate-spin" : ""}`} />Kontrollér nu</Button>}
        </div>
        <div className="divide-y">
          {data.regulatorySources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div><p className="font-medium">{source.name}</p><p className="text-xs text-muted-foreground">{source.jurisdiction} · {source.lastCheckedAt ? `Kontrolleret ${new Date(source.lastCheckedAt).toLocaleString("da-DK")}` : "Første kontrol afventer"}</p></div>
              <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">Officiel kilde <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div><p className="text-sm font-semibold">AI kan arbejde som regnskabsassistent — ikke være godkendt revisor</p><p className="mt-1 text-xs opacity-80">Systemet kan kontrollere, forklare og forberede næsten alt. Lovpligtige erklæringer og faglige fortolkninger skal fortsat udføres eller godkendes af den ansvarlige person med rette kompetence.</p></div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

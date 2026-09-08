import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import {
  Sparkles, LifeBuoy, Building2, Bot, AlertCircle, Check, X, Send, BrainCircuit, BookOpen, Wand2,
} from "lucide-react";

type AiOverview = {
  totalCompanies: number;
  aiActive: number;
  openSupportCases: number;
  pendingLeads: number;
};

type SupportCase = {
  id: number;
  companyId: number;
  companyName: string | null;
  subject: string | null;
  message: string | null;
  status: string;
  priority: string;
  createdAt: string;
  reply: string | null;
  replyStatus: string | null;
};

type Lead = {
  id: number;
  companyId: number;
  companyName: string | null;
  source: string | null;
  customerName: string | null;
  status: string;
  createdAt: string;
};

type AiReplyResponse = { reply: string };
type LeadAnalysis = {
  offer: string;
  reply: string;
  estimatedValue: number | null;
  notes: string | null;
};

const CASE_STATUS: Record<string, { label: string; variant: "blue" | "amber" | "gray" }> = {
  aaben: { label: "Åben", variant: "blue" },
  under_behandling: { label: "Under behandling", variant: "amber" },
  lukket: { label: "Lukket", variant: "gray" },
};

const PRIORITY: Record<string, { label: string; variant: "red" | "amber" | "gray" }> = {
  hoej: { label: "Høj", variant: "red" },
  mellem: { label: "Mellem", variant: "amber" },
  lav: { label: "Lav", variant: "gray" },
};

const LEAD_STATUS: Record<string, { label: string; variant: "blue" | "amber" | "green" | "red" | "gray" }> = {
  ny: { label: "Ny", variant: "blue" },
  under_behandling: { label: "Under behandling", variant: "amber" },
  godkendt: { label: "Godkendt", variant: "green" },
  afvist: { label: "Afvist", variant: "red" },
};

function date(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

/** Lokal vidensbase med almindelige spørgsmål og foreslåede rettelser.
 *  Frontend-mock: matcher på nøgleord og foreslår en rettelse. Anvendelse kræver altid godkendelse. */
const KNOWLEDGE_BASE: { id: string; sporsmaal: string; svar: string; keywords: string[]; rettelse?: { label: string; description: string } }[] = [
  {
    id: "kb-faktura-rykker",
    sporsmaal: "Hvordan sender jeg en rykker til en ubetalt faktura?",
    svar: "Åbn fakturaen under Fakturaer, vælg status 'rykket', og klik 'Send rykker'. Der oprettes automatisk en e-mail med rykkergebyr.",
    keywords: ["rykker", "ubetalt", "faktura", "reminder"],
    rettelse: { label: "Sæt faktura til 'rykket'", description: "Marker valgte faktura som rykket og opret rykker-e-mail." },
  },
  {
    id: "kb-kreditnota",
    sporsmaal: "Hvordan opretter jeg en kreditnota?",
    svar: "På fakturaen vælges 'Kreditnota'. Der oprettes en kreditnota med samme beløb og fakturaen markeres 'kreditnoteret'.",
    keywords: ["kreditnota", "kredit", "tilbagebetaling", "credit"],
    rettelse: { label: "Opret kreditnota", description: "Opretter en kreditnota til den valgte faktura." },
  },
  {
    id: "kb-overdrag",
 sporsmaal: "Hvad betyder 'overdraget' for en faktura?",
    svar: "'Overdraget' betyder at kravet er overdraget til inkasso. Fakturaen kan herefter ikke længere redigeres.",
    keywords: ["overdraget", "inkasso", "overdrag"],
    rettelse: { label: "Sæt faktura til 'overdraget'", description: "Markerer fakturaen som overdraget til inkasso." },
  },
  {
    id: "kb-gdpr-sletning",
    sporsmaal: "Hvordan sletter jeg data for en opsiget virksomhed?",
    svar: "Under GDPR findes virksomheden med status 'opsagt'. Klik ikonet 'Slet virksomhedens data' — sletningen udføres af GDPR-oprydningsjobbet.",
    keywords: ["gdpr", "slet", "data", "oprigt", "opsgt"],
    rettelse: { label: "Eksporter data før sletning", description: "Eksporter virksomhedens data som JSON inden sletning." },
  },
  {
    id: "kb-backup-auto",
    sporsmaal: "Hvordan aktiverer jeg automatisk daglig backup?",
    svar: "Under Backup tændes 'Auto-sync'. Platformen opretter dagligt en sikkerhedskopi til cloud-destinationen.",
    keywords: ["backup", "auto", "sync", "sikkerhedskopi"],
    rettelse: { label: "Aktivér auto-sync", description: "Tænder automatisk daglig backup for platformen." },
  },
  {
    id: "kb-revisionsspor",
    sporsmaal: "Hvorfor viser revisionssporet også virksomhedshændelser?",
    svar: "Revisionssporet har et scope-filter: 'Platform' viser kun platform-hændelser, 'Virksomhed' viser virksomhedshændelser, 'Ansat' viser ansat-relaterede hændelser. Standard er 'Platform'.",
    keywords: ["revision", "audit", "scope", "log"],
  },
];

function matchKnowledge(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return KNOWLEDGE_BASE.filter((k) => k.keywords.some((kw) => q.includes(kw)) || k.sporsmaal.toLowerCase().includes(q));
}

export default function PlatformAi() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);

  const overview = useQuery<AiOverview>({
    queryKey: ["/api/platform/ai-overview"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/ai-overview")).json(),
  });

  const cases = useQuery<SupportCase[]>({
    queryKey: ["/api/support-cases"],
    queryFn: async () => (await apiRequest("GET", "/api/support-cases")).json(),
  });

  const leads = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    queryFn: async () => (await apiRequest("GET", "/api/leads")).json(),
  });

  const aiReply = useMutation({
    mutationFn: async (caseId: number) =>
      (await apiRequest("POST", `/api/support-cases/${caseId}/ai-reply`)).json() as Promise<AiReplyResponse>,
    onSuccess: (data, caseId) => {
      setDrafts((prev) => ({ ...prev, [caseId]: data.reply }));
      toast({ title: "AI-udkast klar", description: "Gennemgå og godkend før afsendelse." });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke generere svar", description: e.message, variant: "destructive" }),
  });

  const approveReply = useMutation({
    mutationFn: async (c: SupportCase) =>
      (await apiRequest("PATCH", `/api/support-cases/${c.id}`, {
        reply: drafts[c.id],
        replyStatus: "godkendt",
        status: "lukket",
      })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-cases"] });
      toast({ title: "Svar sendt", description: "Sagen er lukket." });
    },
    onError: (e: Error) => toast({ title: "Fejl ved afsendelse", description: e.message, variant: "destructive" }),
  });

  const analyzeLead = useMutation({
    mutationFn: async (leadId: number) =>
      (await apiRequest("POST", `/api/leads/${leadId}/analyze`)).json() as Promise<LeadAnalysis>,
    onSuccess: (data, leadId) => {
      setAnalysis(data);
      setAnalyzingId(leadId);
      toast({ title: "AI-analyse klar", description: "Gennemgå udkast — virksomheden skal godkende." });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke analysere lead", description: e.message, variant: "destructive" }),
  });

  const decideLead = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: number; status: string }) =>
      (await apiRequest("PATCH", `/api/leads/${leadId}`, { status })).json(),
    onSuccess: (_d, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setAnalysis(null);
      setAnalyzingId(null);
      toast({
        title: status === "godkendt" ? "Lead godkendt" : "Lead afvist",
        description: status === "godkendt" ? "Tilbud er gjort klar til virksomheden." : "Leadet er markeret som afvist.",
      });
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const o = overview.data;
  const [kbQuery, setKbQuery] = useState("");
  const [kbResults, setKbResults] = useState<typeof KNOWLEDGE_BASE>([]);
  const [pendingFix, setPendingFix] = useState<{ id: string; label: string; description: string } | null>(null);

  const searchKb = (q: string) => {
    setKbQuery(q);
    setKbResults(q.trim().length >= 2 ? matchKnowledge(q) : []);
  };

  const applyFix = useMutation({
    mutationFn: async (_fix: { id: string; label: string; description: string }) => {
      // Frontend-mock: ingen reel backend-ændring. Kun log + toast.
      await new Promise((r) => setTimeout(r, 400));
      return { ok: true };
    },
    onSuccess: (_d, fix) => {
      setPendingFix(null);
      toast({ title: "Rettelse anvendt", description: `${fix.label} — udført med godkendelse.` });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke anvende rettelse", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-3" data-testid="page-platform-ai">
      <PageHeader
        title="Platform AI & Support"
        description="AI-overblik, supportsager og leads på tværs af alle virksomheder"
        action={
          <Button
            variant="outline"
            size="sm"
            data-testid="button-refresh-ai"
            onClick={() => {
              overview.refetch();
              cases.refetch();
              leads.refetch();
            }}
          >
            <Sparkles className="w-4 h-4" /> Opdater
          </Button>
        }
      />

      {/* AI oversigt metrics */}
      {overview.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <MetricCard data-testid="metric-total-companies" icon={<Building2 className="w-4 h-4" />} value={o?.totalCompanies ?? 0} label="Virksomheder" variant="primary" valueTestId="value-total-companies" />
          <MetricCard data-testid="metric-ai-active" icon={<Bot className="w-4 h-4" />} value={o?.aiActive ?? 0} label="AI aktive" variant="blue" valueTestId="value-ai-active" />
          <MetricCard data-testid="metric-open-cases" icon={<LifeBuoy className="w-4 h-4" />} value={o?.openSupportCases ?? 0} label="Åbne sager" variant="amber" valueTestId="value-open-cases" />
          <MetricCard data-testid="metric-pending-leads" icon={<AlertCircle className="w-4 h-4" />} value={o?.pendingLeads ?? 0} label="Afventende leads" variant="gray" valueTestId="value-pending-leads" />
        </div>
      )}

      {/* Vidensbase & Foreslå rettelse */}
      <SectionCard
        title="Vidensbase & foreslåede rettelser"
        icon={<BookOpen className="w-4 h-4" />}
        className="space-y-3"
      >
        <p className="text-xs text-muted-foreground">
          Spørg om platformens funktioner. AI foreslår en rettelse du skal godkende — der foretages aldrig ændringer automatisk.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={kbQuery}
            onChange={(e) => searchKb(e.target.value)}
            placeholder="Fx 'hvordan sender jeg en rykker' eller 'kreditnota'…"
            data-testid="input-kb-query"
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {kbQuery.trim().length >= 2 && kbResults.length === 0 && (
          <p className="text-xs text-muted-foreground" data-testid="empty-kb-results">Ingen relevante svar fundet — prøv et andet ord.</p>
        )}

        {kbResults.length > 0 && (
          <div className="space-y-2" data-testid="block-kb-results">
            {kbResults.map((k) => (
              <div key={k.id} className="rounded-md border border-border p-3 space-y-2" data-testid={`row-kb-${k.id}`}>
                <p className="text-sm font-medium text-foreground flex items-start gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />{k.sporsmaal}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{k.svar}</p>
                {k.rettelse && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <Wand2 className="w-3.5 h-3.5 inline mr-1 text-primary" />
                      Foreslået rettelse: <span className="text-foreground font-medium">{k.rettelse.label}</span> — {k.rettelse.description}
                    </p>
                    {pendingFix?.id === k.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Afventer godkendelse
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-cancel-fix-${k.id}`}
                          onClick={() => setPendingFix(null)}
                        >
                          <X className="w-3.5 h-3.5" /> Annullér
                        </Button>
                        <Button
                          size="sm"
                          data-testid={`button-apply-fix-${k.id}`}
                          disabled={applyFix.isPending}
                          onClick={() => applyFix.mutate({ id: k.id, label: k.rettelse!.label, description: k.rettelse!.description })}
                        >
                          <Check className="w-3.5 h-3.5" /> Anvend rettelse
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-suggest-fix-${k.id}`}
                        onClick={() => setPendingFix({ id: k.id, label: k.rettelse!.label, description: k.rettelse!.description })}
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Foreslå rettelse
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Supportsager */}
      <SectionCard
        title="Supportsager — alle virksomheder"
        icon={<LifeBuoy className="w-4 h-4" />}
        noPadding
        className="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[860px] text-sm">
            <thead>
              <tr>
                <th>Virksomhed</th>
                <th>Emne</th>
                <th>Prioritet</th>
                <th>Status</th>
                <th>Dato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cases.isLoading ? (
                <tr><td colSpan={6} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
              ) : (cases.data ?? []).length === 0 ? (
                <tr data-testid="empty-support-cases"><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Ingen supportsager.</td></tr>
              ) : (cases.data ?? []).map((c) => {
                const cs = CASE_STATUS[c.status] ?? { label: c.status, variant: "gray" as const };
                const pr = PRIORITY[c.priority] ?? { label: c.priority, variant: "gray" as const };
                const draft = drafts[c.id];
                return (
                  <tr key={c.id} data-testid={`row-support-case-${c.id}`}>
                    <td className="p-3 max-w-40 truncate">{c.companyName ?? `#${c.companyId}`}</td>
                    <td className="p-3 max-w-56 truncate">{c.subject ?? "—"}</td>
                    <td className="p-3"><StatusChip status={pr.label} variant={pr.variant} /></td>
                    <td className="p-3"><StatusChip status={cs.label} variant={cs.variant} /></td>
                    <td className="p-3 whitespace-nowrap">{date(c.createdAt)}</td>
                    <td className="p-3 text-right">
                      {c.status === "lukket" ? (
                        <span className="text-xs text-muted-foreground">Lukket</span>
                      ) : draft ? (
                        <Button
                          size="sm"
                          data-testid={`button-approve-reply-${c.id}`}
                          disabled={approveReply.isPending}
                          onClick={() => approveReply.mutate(c)}
                        >
                          <Send className="w-4 h-4" /> Godkend og send
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-ai-reply-${c.id}`}
                          disabled={aiReply.isPending}
                          onClick={() => aiReply.mutate(c.id)}
                        >
                          <Sparkles className="w-4 h-4" /> AI svar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Udkastvisning */}
        {Object.keys(drafts).length > 0 && (
          <div className="px-3 py-2 border-t border-border space-y-2">
            {Object.entries(drafts).map(([id, draft]) => (
              <div key={id} className="space-y-1.5" data-testid={`draft-support-case-${id}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">AI-udkast — sag #{id}</span>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    data-testid={`button-clear-draft-${id}`}
                    onClick={() => setDrafts((prev) => {
                      const next = { ...prev };
                      delete next[Number(id)];
                      return next;
                    })}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Textarea
                  data-testid={`textarea-draft-${id}`}
                  className="min-h-[80px] text-xs"
                  value={draft}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [Number(id)]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Leads */}
      <SectionCard
        title="Leads — alle virksomheder"
        icon={<BrainCircuit className="w-4 h-4" />}
        noPadding
        className="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[860px] text-sm">
            <thead>
              <tr>
                <th>Kilde</th>
                <th>Kunde</th>
                <th>Virksomhed</th>
                <th>Status</th>
                <th>Dato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.isLoading ? (
                <tr><td colSpan={6} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
              ) : (leads.data ?? []).length === 0 ? (
                <tr data-testid="empty-leads"><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Ingen leads.</td></tr>
              ) : (leads.data ?? []).map((l) => {
                const ls = LEAD_STATUS[l.status] ?? { label: l.status, variant: "gray" as const };
                return (
                  <tr key={l.id} data-testid={`row-lead-${l.id}`}>
                    <td className="p-3">{l.source ?? "—"}</td>
                    <td className="p-3 max-w-48 truncate">{l.customerName ?? "—"}</td>
                    <td className="p-3 max-w-40 truncate">{l.companyName ?? `#${l.companyId}`}</td>
                    <td className="p-3"><StatusChip status={ls.label} variant={ls.variant} /></td>
                    <td className="p-3 whitespace-nowrap">{date(l.createdAt)}</td>
                    <td className="p-3 text-right">
                      {l.status === "ny" || l.status === "under_behandling" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-analyze-lead-${l.id}`}
                          disabled={analyzeLead.isPending}
                          onClick={() => analyzeLead.mutate(l.id)}
                        >
                          <Sparkles className="w-4 h-4" /> AI analyse
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Afsluttet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* AI-analyse dialog */}
      <Dialog open={analysis !== null} onOpenChange={(open) => { if (!open) { setAnalysis(null); setAnalyzingId(null); } }}>
        <DialogContent className="max-w-lg" data-testid="dialog-lead-analysis">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <BrainCircuit className="w-5 h-5" /> AI lead-analyse
            </DialogTitle>
          </DialogHeader>
          {analysis && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Tilbudsudkast</p>
                <Textarea data-testid="textarea-lead-offer" className="min-h-[100px] text-xs" value={analysis.offer} readOnly />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Svarudkast</p>
                <Textarea data-testid="textarea-lead-reply" className="min-h-[80px] text-xs" value={analysis.reply} readOnly />
              </div>
              {analysis.estimatedValue != null && (
                <p className="text-xs text-muted-foreground">
                  Estimeret værdi: <span className="font-medium text-foreground">{analysis.estimatedValue} kr.</span>
                </p>
              )}
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> AI sender aldrig automatisk — virksomheden skal godkende.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-reject-lead"
                  disabled={decideLead.isPending}
                  onClick={() => analyzingId && decideLead.mutate({ leadId: analyzingId, status: "afvist" })}
                >
                  <X className="w-4 h-4" /> Afvis
                </Button>
                <Button
                  size="sm"
                  data-testid="button-approve-lead"
                  disabled={decideLead.isPending}
                  onClick={() => analyzingId && decideLead.mutate({ leadId: analyzingId, status: "godkendt" })}
                >
                  <Check className="w-4 h-4" /> Godkend
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

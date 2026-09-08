import { Fragment, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Users, Sparkles, Check, X, Send, Mail, AlertTriangle, Download, Bot, RefreshCw,
  Megaphone, Facebook, Globe, Webhook, Settings, Trash2,
} from "lucide-react";

function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

const SOURCE_VARIANT: Record<string, string> = {
  email: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  google_ads: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  facebook: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  website: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  manual: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  phone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};
const SOURCE_LABEL: Record<string, string> = {
  email: "Email",
  google_ads: "Google Ads",
  facebook: "Facebook",
  website: "Hjemmeside",
  manual: "Manuel",
  phone: "Telefon",
};
const STATUS_VARIANT: Record<string, string> = {
  ny: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  analyseret: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  tilbud_kladde: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  afventer_godkendelse: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  godkendt: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  klar_til_afsendelse: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  afsendt: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  afvist: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  ny: "Ny",
  analyseret: "Analyseret",
  tilbud_kladde: "Tilbudskladde",
  afventer_godkendelse: "Afventer godkendelse",
  godkendt: "Godkendt",
  klar_til_afsendelse: "Klar til afsendelse",
  afsendt: "Afsendt",
  afvist: "Afvist",
};

type Lead = {
  id: number; source?: string | null; customerName?: string | null;
  customerEmail?: string | null; customerPhone?: string | null;
  customerAddress?: string | null; message?: string | null;
  status?: string | null; createdAt?: string | null;
  aiAnalysis?: string | null;
  aiOfferDraft?: string | null; aiReplyDraft?: string | null;
};

type LeadIntegration = {
  id: number;
  provider: string;
  displayName?: string | null;
  status?: string | null;
  config?: Record<string, string> | null;
  autoImport?: boolean | number | null;
  lastSyncAt?: string | null;
  importedCount?: number | null;
};

type ProviderField = { key: string; label: string; type?: string; placeholder?: string };
type ProviderDef = {
  id: string;
  label: string;
  icon: typeof Mail;
  fields: ProviderField[];
};

const LEAD_PROVIDERS: ProviderDef[] = [
  {
    id: "email_inbox",
    label: "Email Inbox",
    icon: Mail,
    fields: [
      { key: "email", label: "Email", type: "email", placeholder: "f.eks. indbakke@firma.dk" },
      { key: "imapHost", label: "IMAP Host", placeholder: "f.eks. imap.gmail.com" },
      { key: "imapPort", label: "IMAP Port", placeholder: "f.eks. 993" },
    ],
  },
  {
    id: "google_ads",
    label: "Google Ads",
    icon: Megaphone,
    fields: [
      { key: "customerId", label: "Kunde-ID", placeholder: "f.eks. 123-456-7890" },
      { key: "apiKey", label: "API-nøgle", placeholder: "Google Ads API-nøgle" },
      { key: "conversionActionId", label: "Conversion Action ID" },
    ],
  },
  {
    id: "facebook_lead_ads",
    label: "Facebook Lead Ads",
    icon: Facebook,
    fields: [
      { key: "pageId", label: "Page ID" },
      { key: "accessToken", label: "Access Token" },
      { key: "formId", label: "Form ID" },
    ],
  },
  {
    id: "website_form",
    label: "Website Form",
    icon: Globe,
    fields: [
      { key: "formUrl", label: "Form URL", placeholder: "https://..." },
      { key: "webhookSecret", label: "Webhook Secret" },
    ],
  },
  {
    id: "api_webhook",
    label: "API Webhook",
    icon: Webhook,
    fields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://..." },
      { key: "apiKey", label: "API-nøgle" },
    ],
  },
  {
    id: "mailchimp",
    label: "Mailchimp",
    icon: Users,
    fields: [
      { key: "apiKey", label: "API-nøgle" },
      { key: "listId", label: "List ID" },
    ],
  },
];

const providerById = (id: string) => LEAD_PROVIDERS.find((p) => p.id === id);

const INTEGRATION_STATUS_VARIANT: Record<string, "green" | "gray" | "red"> = {
  aktiv: "green",
  ikke_aktiv: "gray",
  fejl: "red",
};
const INTEGRATION_STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  ikke_aktiv: "Ikke aktiv",
  fejl: "Fejl",
};

export default function Leads() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/leads?companyId=${companyId}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/leads"] });

  const createLead = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/leads?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); setCreateOpen(false); toast({ title: "Lead oprettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke oprette lead", description: e.message, variant: "destructive" }),
  });
  const analyzeLead = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/leads/${id}/analyze?companyId=${companyId}`, {})).json(),
    onSuccess: (d: any) => {
      invalidate();
      setExpanded(d.id ?? null);
      toast({ title: "AI-analyse klar", description: "Udkast og svar er genereret. Kræver manuel godkendelse." });
    },
    onError: (e: any) => toast({ title: "AI-analyse mislykkedes", description: e.message, variant: "destructive" }),
  });
  const patchLead = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await apiRequest("PATCH", `/api/leads/${id}?companyId=${companyId}`, { status })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Lead opdateret" }); },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere lead", description: e.message, variant: "destructive" }),
  });

  // Hent nye leads automatisk fra e-mail (mock — opretter en eksempel-lead)
  const fetchNewLeads = useMutation({
    mutationFn: async () => {
      const samples = [
        { source: "email", customerName: "Maria Nielsen", customerEmail: "maria.nielsen@email.dk", customerPhone: "22 33 44 55", customerAddress: "Bækkevej 12, 2800 Kongens Lyngby", message: "Hej, vi har brug for ugentlig rengøring af vores kontor på ca. 150 kvm. Hvad koster det?" },
        { source: "email", customerName: "Thomas Berg", customerEmail: "thomas.berg@firma.dk", customerPhone: "33 44 55 66", customerAddress: "Industriparken 5, 2600 Glostrup", message: "Vi søger et rengøringsselskab til vores lagerhal på 800 kvm. Trappevask og grundrengøring ønskes." },
        { source: "email", customerName: "Sofie Lund", customerEmail: "sofie.lund@email.dk", customerPhone: "44 55 66 77", customerAddress: "Haveforeningen Solbakken, 2000 Frederiksberg", message: "Vores lejlighedsforening har brug for trappevask hver 14. dag. Send venligst et tilbud." },
      ];
      const sample = samples[Math.floor(Math.random() * samples.length)];
      return (await apiRequest("POST", `/api/leads?companyId=${companyId}`, {
        ...sample,
        customerEmail: sample.customerEmail || null,
        customerPhone: sample.customerPhone || null,
        customerAddress: sample.customerAddress || null,
        message: sample.message || null,
      })).json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Nye leads hentet", description: "AI har hentet nye leads fra e-mail og tilføjet dem." });
    },
    onError: (e: any) => toast({ title: "Kunne ikke hente leads", description: e.message, variant: "destructive" }),
  });

  // --- Lead-integrationer ---
  const integrationsQ = useQuery<LeadIntegration[]>({
    queryKey: ["/api/lead-integrations"],
    queryFn: async () => (await apiRequest("GET", `/api/lead-integrations`)).json(),
  });
  const invalidateIntegrations = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/lead-integrations"] });

  const createIntegration = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/lead-integrations`, body)).json(),
    onSuccess: () => { invalidateIntegrations(); toast({ title: "Lead-kilde tilføjet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke tilføje lead-kilde", description: e.message, variant: "destructive" }),
  });
  const updateIntegration = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/lead-integrations/${id}`, body)).json(),
    onSuccess: () => { invalidateIntegrations(); toast({ title: "Lead-kilde opdateret" }); },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere", description: e.message, variant: "destructive" }),
  });
  const deleteIntegration = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/lead-integrations/${id}`)).json(),
    onSuccess: () => { invalidateIntegrations(); toast({ title: "Lead-kilde slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });
  const testIntegration = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/lead-integrations/${id}/test`, {})).json(),
    onSuccess: (d: any) => toast({ title: d?.ok ? "Forbindelse OK" : "Forbindelse fejlede", description: d?.message }),
    onError: (e: any) => toast({ title: "Test mislykkedes", description: e.message, variant: "destructive" }),
  });
  const importIntegration = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/lead-integrations/${id}/import`, {})).json(),
    onSuccess: (d: any) => {
      invalidateIntegrations();
      invalidate();
      toast({ title: d?.ok ? "Import fuldført" : "Import fejlede", description: d?.message ?? (d?.count != null ? `${d.count} leads importeret` : undefined) });
    },
    onError: (e: any) => toast({ title: "Import mislykkedes", description: e.message, variant: "destructive" }),
  });

  // Hent kommunikationsintegration
  const integrations = useQuery({
    queryKey: ["/api/communication-integrations", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/communication-integrations?companyId=${companyId}`)).json(),
    enabled: !!companyId,
  });

  // Hent indkommende beskeder for leads
  const inboundMsgs = useQuery({
    queryKey: ["/api/inbound-messages", companyId, "lead"],
    queryFn: async () => (await apiRequest("GET", `/api/inbound-messages?companyId=${companyId}&relatedType=lead`)).json(),
    enabled: !!companyId,
  });

  // Send lead som outbound message
  const sendLead = useMutation({
    mutationFn: async (lead: any) => {
      const integration = (integrations.data as any[])?.find((i: any) => i.status === "aktiv");
      if (!integration) {
        throw new Error("Ingen aktiv e-mailintegration. Tilslut en integration under Integrationer først.");
      }
      const replyBody = lead.aiReplyDraft || `Kære ${lead.customerName}\n\nMange tak for din henvendelse.\n\nVi har modtaget din forespørgsel og sender dig et tilbud hurtigst muligt.\n\nMed venlig hilsen`;
      const msg = await apiRequest("POST", `/api/outbound-messages?companyId=${companyId}`, {
        customerId: null,
        relatedType: "lead",
        relatedId: lead.id,
        channel: "email",
        recipientName: lead.customerName,
        recipientEmail: lead.customerEmail,
        subject: `Svar på din henvendelse — ${lead.customerName}`,
        body: replyBody,
        status: "godkendt",
        aiGenerated: 1,
      });
      const msgJson = await msg.json();
      // Send via integration
      const sendResult = await apiRequest("POST", `/api/outbound-messages/${msgJson.id}/send?companyId=${companyId}`, {});
      const sendJson = await sendResult.json();
      // Update lead status
      await apiRequest("PATCH", `/api/leads/${lead.id}?companyId=${companyId}`, {
        status: "afsendt",
        sentAt: sendJson.sentAt || new Date().toISOString(),
      });
      return sendJson;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/outbound-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-messages"] });
      toast({ title: "Besked sendt", description: "Svaret er sendt til kunden. Indkommende svar vises her." });
    },
    onError: (e: any) => toast({ title: "Kunne ikke sende", description: e.message, variant: "destructive" }),
  });

  const list = leads ?? [];
  const nyCount = list.filter((l) => l.status === "ny").length;
  const approvedCount = list.filter((l) => l.status === "godkendt" || l.status === "klar_til_afsendelse").length;
  const sentCount = list.filter((l) => l.status === "afsendt").length;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <PageHeader
        eyebrow="Salg"
        title="Leads"
        description="AI-leadfangst — kilder, analyse og tilbudsudkast"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchNewLeads.mutate()} disabled={fetchNewLeads.isPending}
              data-testid="button-fetch-leads">
              <Download className={`w-4 h-4 mr-1.5 ${fetchNewLeads.isPending ? "animate-bounce" : ""}`} />
              {fetchNewLeads.isPending ? "Henter…" : "Hent nye leads"}
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-lead">
                  <Plus className="w-4 h-4 mr-1.5" />Opret lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Ny lead</DialogTitle></DialogHeader>
                <LeadForm pending={createLead.isPending} onSubmit={(b) => createLead.mutate(b)} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<Users className="w-5 h-5" />} value={String(list.length)} label="Leads i alt" variant="primary" valueTestId="metric-total-leads" />
        <MetricCard icon={<Sparkles className="w-5 h-5" />} value={String(nyCount)} label="Nye" variant="blue" valueTestId="metric-new-leads" />
        <MetricCard icon={<Check className="w-5 h-5" />} value={String(approvedCount)} label="Godkendte" variant="green" valueTestId="metric-approved-leads" />
        <MetricCard icon={<Send className="w-5 h-5" />} value={String(sentCount)} label="Afsendte" variant="gray" valueTestId="metric-sent-leads" />
      </div>

      <LeadIntegrationsPanel
        integrations={integrationsQ.data ?? []}
        isLoading={integrationsQ.isLoading}
        testingId={testIntegration.isPending ? testIntegration.variables ?? null : null}
        importingId={importIntegration.isPending ? importIntegration.variables ?? null : null}
        pendingCreate={createIntegration.isPending}
        pendingUpdate={updateIntegration.isPending}
        pendingDelete={deleteIntegration.isPending}
        onTest={(id) => testIntegration.mutate(id)}
        onImport={(id) => importIntegration.mutate(id)}
        onDelete={(id) => deleteIntegration.mutate(id)}
        onCreate={(body) => createIntegration.mutate(body)}
        onUpdate={(id, body) => updateIntegration.mutate({ id, body })}
      />

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex gap-2 items-start">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed" data-testid="ai-safety-info">
            AI genererer kun udkast og svar — den sender aldrig automatisk. Alle handlinger kræver manuel godkendelse.
          </p>
          {(integrations.data as any[])?.some((i: any) => i.status === "aktiv") ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5" data-testid="integration-active">
                <Bot className="w-3.5 h-3.5" />E-mailintegration aktiv — beskeder kan sendes via Send-knappen.
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5" data-testid="ai-auto-fetch-indicator">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />AI henter leads automatisk
              </p>
            </div>
          ) : (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1" data-testid="integration-missing">
              Ingen aktiv e-mailintegration — tilslut en under Integrationer for at sende til kunder.
            </p>
          )}
        </div>
      </div>

      <SectionCard title="Leads" icon={<Users className="w-4 h-4" />} noPadding>
        {list.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs">Ingen leads endnu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium w-full min-w-[960px] text-sm">
              <thead>
                <tr>
                  <th>Kunde</th><th>Kilde</th><th>Status</th><th>Oprettet</th><th>Handling</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <Fragment key={l.id}>
                    <tr data-testid={`row-lead-${l.id}`}>
                      <td className="p-3">
                        <div className="font-medium max-w-48 truncate">{l.customerName || "Ukendt"}</div>
                        {l.customerEmail && <div className="text-[11px] text-muted-foreground truncate">{l.customerEmail}</div>}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${SOURCE_VARIANT[l.source ?? "manual"] ?? SOURCE_VARIANT.manual}`}
                          data-testid={`badge-lead-source-${l.id}`}>
                          {SOURCE_LABEL[l.source ?? "manual"] ?? l.source}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_VARIANT[l.status ?? "ny"] ?? STATUS_VARIANT.ny}`}
                          data-testid={`badge-lead-status-${l.id}`}>
                          {STATUS_LABEL[l.status ?? "ny"] ?? l.status}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">{dk(l.createdAt)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {l.status === "ny" && (
                            <Button size="sm" variant="outline" disabled={analyzeLead.isPending}
                              onClick={() => analyzeLead.mutate(l.id)}
                              data-testid={`button-analyze-lead-${l.id}`}>
                              <Sparkles className="w-3.5 h-3.5 mr-1" />AI analyse
                            </Button>
                          )}
                          {(l.aiOfferDraft || l.aiReplyDraft || l.aiAnalysis) && (
                            <Button size="sm" variant="outline"
                              onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                              data-testid={`button-toggle-draft-${l.id}`}>
                              {expanded === l.id ? "Skjul udkast" : "Vis udkast"}
                            </Button>
                          )}
                          {(l.status === "godkendt" || l.status === "klar_til_afsendelse") && (
                            <Button size="sm" disabled={sendLead.isPending}
                              onClick={() => sendLead.mutate(l)}
                              data-testid={`button-send-lead-${l.id}`}>
                              <Send className="w-3.5 h-3.5 mr-1" />Send svar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === l.id && (l.aiOfferDraft || l.aiReplyDraft || l.aiAnalysis) && (
                      <tr data-testid={`row-lead-draft-${l.id}`}>
                        <td colSpan={5} className="p-3 bg-muted/30 border-t border-border/50">
                          <div className="space-y-3">
                            {l.aiAnalysis && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI-analyse</p>
                                </div>
                                <div className="rounded-md border border-border/50 bg-card p-3 text-sm whitespace-pre-wrap" data-testid={`text-ai-analysis-${l.id}`}>
                                  {l.aiAnalysis}
                                </div>
                              </div>
                            )}
                            {l.aiOfferDraft && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tilbudsudkast (AI)</p>
                                </div>
                                <div className="rounded-md border border-border/50 bg-card p-3 text-sm whitespace-pre-wrap" data-testid={`text-offer-draft-${l.id}`}>
                                  {l.aiOfferDraft}
                                </div>
                              </div>
                            )}
                            {l.aiReplyDraft && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Svarudkast (AI)</p>
                                </div>
                                <div className="rounded-md border border-border/50 bg-card p-3 text-sm whitespace-pre-wrap" data-testid={`text-reply-draft-${l.id}`}>
                                  {l.aiReplyDraft}
                                </div>
                              </div>
                            )}
                            {(l.status === "tilbud_kladde" || l.status === "afventer_godkendelse" || l.status === "analyseret" || l.status === "ny") && (
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" disabled={patchLead.isPending}
                                  onClick={() => patchLead.mutate({ id: l.id, status: "godkendt" })}
                                  data-testid={`button-approve-lead-${l.id}`}>
                                  <Check className="w-3.5 h-3.5 mr-1" />Godkend
                                </Button>
                                <Button size="sm" variant="outline" disabled={patchLead.isPending}
                                  onClick={() => patchLead.mutate({ id: l.id, status: "afvist" })}
                                  data-testid={`button-reject-lead-${l.id}`}>
                                  <X className="w-3.5 h-3.5 mr-1" />Afvis
                                </Button>
                              </div>
                            )}
                            {/* Vis kundens svar hvis afsendt */}
                            {l.status === "afsendt" && (inboundMsgs.data as any[])?.filter((m: any) => m.relatedId === l.id).map((msg: any) => (
                              <div key={msg.id} className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                    Svar fra kunde — {new Date(msg.receivedAt).toLocaleDateString("da-DK")}
                                  </p>
                                </div>
                                <div className="text-xs text-muted-foreground mb-1">Fra: {msg.fromEmail}</div>
                                <div className="text-sm whitespace-pre-wrap" data-testid={`text-inbound-${l.id}-${msg.id}`}>{msg.body}</div>
                              </div>
                            ))}
                            {l.status === "afsendt" && !((inboundMsgs.data as any[])?.some((m: any) => m.relatedId === l.id)) && (
                              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="w-3.5 h-3.5" />
                                Afventer svar fra kunde…
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function LeadForm({ pending, onSubmit }: { pending: boolean; onSubmit: (body: unknown) => void }) {
  const [source, setSource] = useState("manual");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      source,
      customerName,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      customerAddress: customerAddress || null,
      message: message || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Kilde</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger data-testid="select-lead-source"><SelectValue placeholder="Vælg kilde" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="google_ads">Google Ads</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="website">Hjemmeside</SelectItem>
            <SelectItem value="manual">Manuel</SelectItem>
            <SelectItem value="phone">Telefon</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Kundenavn</Label>
        <Input id="lead-name" data-testid="input-lead-name" value={customerName}
          onChange={(e) => setCustomerName(e.target.value)} placeholder="f.eks. Jens Hansen" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-email">Email</Label>
        <Input id="lead-email" type="email" data-testid="input-lead-email" value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)} placeholder="f.eks. jens@eksempel.dk" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-phone">Telefon</Label>
        <Input id="lead-phone" data-testid="input-lead-phone" value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)} placeholder="f.eks. 12 34 56 78" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-address">Adresse</Label>
        <Input id="lead-address" data-testid="input-lead-address" value={customerAddress}
          onChange={(e) => setCustomerAddress(e.target.value)} placeholder="f.eks. Hovedgaden 1, 1000 København" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-message">Besked</Label>
        <Textarea id="lead-message" data-testid="input-lead-message" value={message}
          onChange={(e) => setMessage(e.target.value)} placeholder="Kundens henvendelse" />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !customerName}
        data-testid="button-save-lead">
        {pending ? "Opretter..." : "Opret lead"}
      </Button>
    </form>
  );
}

type PanelProps = {
  integrations: LeadIntegration[];
  isLoading: boolean;
  testingId: number | null;
  importingId: number | null;
  pendingCreate: boolean;
  pendingUpdate: boolean;
  pendingDelete: boolean;
  onTest: (id: number) => void;
  onImport: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: (body: unknown) => void;
  onUpdate: (id: number, body: unknown) => void;
};

function LeadIntegrationsPanel({
  integrations, isLoading, testingId, importingId,
  pendingCreate, pendingUpdate, pendingDelete,
  onTest, onImport, onDelete, onCreate, onUpdate,
}: PanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<LeadIntegration | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadIntegration | null>(null);

  return (
    <SectionCard
      title="Lead-kilder & integrationer"
      icon={<Settings className="w-4 h-4" />}
      noPadding
      data-testid="section-lead-integrations"
      action={
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-lead-source"
              onClick={() => { setEditing(null); setAddOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />Tilføj lead-kilde
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Rediger lead-kilde" : "Tilføj lead-kilde"}</DialogTitle>
            </DialogHeader>
            <IntegrationForm
              initial={editing}
              pending={editing ? pendingUpdate : pendingCreate}
              onSubmit={(body) => {
                if (editing) onUpdate(editing.id, body);
                else onCreate(body);
                setAddOpen(false);
                setEditing(null);
              }}
            />
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <div className="p-3 space-y-2" data-testid="integrations-loading">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground" data-testid="integrations-empty">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-xs">Ingen lead-kilder tilsluttet endnu</p>
          <p className="text-[11px] mt-1">Klik på “Tilføj lead-kilde” for at forbinde en ekstern kilde.</p>
        </div>
      ) : (
        <div className="divide-y divide-border" data-testid="integrations-list">
          {integrations.map((it) => {
            const prov = providerById(it.provider);
            const Icon = prov?.icon ?? Settings;
            const status = it.status ?? "ikke_aktiv";
            const statusLabel = INTEGRATION_STATUS_LABEL[status] ?? status;
            const statusVariant = INTEGRATION_STATUS_VARIANT[status] ?? "gray";
            const isTesting = testingId === it.id;
            const isImporting = importingId === it.id;
            const autoOn = it.autoImport === true || it.autoImport === 1;
            return (
              <div key={it.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-testid={`integration-card-${it.id}`}>
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="shrink-0 rounded-md bg-muted p-2">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" data-testid={`integration-name-${it.id}`}>
                        {it.displayName || prov?.label || it.provider}
                      </span>
                      <StatusChip
                        status={statusLabel}
                        variant={statusVariant}
                        data-testid={`integration-status-${it.id}`}
                      />
                      {autoOn && (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" data-testid={`integration-auto-${it.id}`}>
                          <RefreshCw className="w-3 h-3" />Auto-import
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span data-testid={`integration-provider-${it.id}`}>{prov?.label ?? it.provider}</span>
                      <span data-testid={`integration-last-sync-${it.id}`}>Seneste sync: {dk(it.lastSyncAt)}</span>
                      <span data-testid={`integration-count-${it.id}`}>Importerede: {it.importedCount ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" disabled={isTesting}
                    onClick={() => onTest(it.id)}
                    data-testid={`button-test-integration-${it.id}`}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isTesting ? "animate-spin" : ""}`} />
                    {isTesting ? "Tester…" : "Test forbindelse"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isImporting}
                    onClick={() => onImport(it.id)}
                    data-testid={`button-import-integration-${it.id}`}>
                    <Download className={`w-3.5 h-3.5 mr-1 ${isImporting ? "animate-bounce" : ""}`} />
                    {isImporting ? "Importer…" : "Importer leads"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pendingUpdate || isTesting || isImporting}
                    onClick={() => { setEditing(it); setAddOpen(true); }}
                    data-testid={`button-edit-integration-${it.id}`}>
                    <Settings className="w-3.5 h-3.5 mr-1" />Rediger
                  </Button>
                  <Dialog
                    open={confirmDelete?.id === it.id}
                    onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" disabled={pendingDelete}
                        onClick={() => setConfirmDelete(it)}
                        data-testid={`button-delete-integration-${it.id}`}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />Slet
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>Slet lead-kilde?</DialogTitle></DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Vil du slette “{it.displayName || prov?.label || it.provider}”? Handlingen kan ikke fortrydes.
                      </p>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Annuller</Button>
                        <Button size="sm" variant="destructive" disabled={pendingDelete}
                          onClick={() => { onDelete(it.id); setConfirmDelete(null); }}
                          data-testid={`button-confirm-delete-integration-${it.id}`}>
                          {pendingDelete ? "Sletter…" : "Slet"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function IntegrationForm({
  initial, pending, onSubmit,
}: {
  initial: LeadIntegration | null;
  pending: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const [provider, setProvider] = useState(initial?.provider ?? LEAD_PROVIDERS[0].id);
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [autoImport, setAutoImport] = useState<boolean>(
    initial?.autoImport === true || initial?.autoImport === 1,
  );
  const [config, setConfig] = useState<Record<string, string>>(
    (initial?.config as Record<string, string>) ?? {},
  );

  const prov = providerById(provider)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      provider,
      displayName: displayName || null,
      config,
      autoImport,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Udbyder</Label>
        <Select
          value={provider}
          onValueChange={(v) => { setProvider(v); setConfig({}); }}
          disabled={!!initial}
        >
          <SelectTrigger data-testid="select-integration-provider">
            <SelectValue placeholder="Vælg udbyder" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="integration-display-name">Visningsnavn</Label>
        <Input
          id="integration-display-name"
          data-testid="input-integration-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={`f.eks. ${prov.label}`}
        />
      </div>

      <div className="space-y-2 rounded-md border border-border/60 p-3 bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Konfiguration</p>
        {prov.fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`cfg-${f.key}`}>{f.label}</Label>
            <Input
              id={`cfg-${f.key}`}
              type={f.type ?? "text"}
              data-testid={`input-integration-config-${f.key}`}
              value={config[f.key] ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder ?? ""}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
        <div>
          <Label htmlFor="integration-auto" className="cursor-pointer">Auto-import</Label>
          <p className="text-[11px] text-muted-foreground">Importer nye leads automatisk</p>
        </div>
        <Switch
          id="integration-auto"
          checked={autoImport}
          onCheckedChange={setAutoImport}
          data-testid="switch-integration-auto-import"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-integration">
        {pending ? "Gemmer…" : initial ? "Gem ændringer" : "Tilføj lead-kilde"}
      </Button>
    </form>
  );
}

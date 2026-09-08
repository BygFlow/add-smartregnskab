import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCustomers } from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, openAuthedFile, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FunctionMenu, type FunctionMenuItem } from "@/components/function-menu";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { Check, ChevronDown, FileText, Lock, Plus, Send, Trash2, X, Sparkles, AlertTriangle, CheckCircle, RefreshCw, FilePlus, XCircle, TrendingUp, ScrollText, Eye, Mail } from "lucide-react";
import type { Contract, Quote, QuoteItem, Template, Customer, Company, CleaningService } from "@shared/schema";

const STATUS: Record<string, { label: string; style: string }> = {
  kladde: { label: "Kladde", style: "bg-muted text-muted-foreground" },
  sendt: { label: "Udsendt", style: "badge-soft badge-soft-blue" },
  accepteret: { label: "Accepteret", style: "badge-soft badge-soft-green" },
  afvist: { label: "Afvist", style: "badge-soft badge-soft-red" },
};
const quoteStatusVariant: Record<string, "blue" | "green" | "red" | "gray" | "amber"> = {
  kladde: "gray",
  sendt: "blue",
  accepteret: "green",
  afvist: "red",
  "udløbet": "amber",
};
const PRICING = [
  ["timepris", "Timepris"],
  ["fast_maaned", "Fast månedspris"],
  ["pr_besoeg", "Pris pr. besøg"],
  ["pr_m2", "Pris pr. m²"],
] as const;
const FREQUENCIES = [
  ["dagligt", "Dagligt"],
  ["ugentlig", "Ugentlig"],
  ["hver_14_dag", "Hver 14. dag"],
  ["maanedlig", "Månedlig"],
] as const;
const UNITS = ["timer", "md", "stk", "m2", "gang"];

// ── Template helpers ──────────────────────────────────────────
interface TemplateColumn { key: string; label: string; width: string; }

const DEFAULT_COLUMNS: TemplateColumn[] = [
  { key: "description", label: "Beskrivelse", width: "40" },
  { key: "qty", label: "Antal", width: "15" },
  { key: "unit", label: "Enhed", width: "15" },
  { key: "price", label: "Pris", width: "15" },
  { key: "total", label: "Total", width: "15" },
];

function parseColumns(raw: string | null): TemplateColumn[] {
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

const FALLBACK_TEMPLATE: Template = {
  id: 0,
  companyId: null,
  type: "tilbud",
  name: "Standard",
  subject: null,
  body: null,
  isDefault: 1,
  logoPosition: "left",
  primaryColor: "#2176d4",
  headerLayout: "classic",
  showBankInfo: 1,
  showPaymentTerms: 1,
  showEAN: 0,
  columns: JSON.stringify(DEFAULT_COLUMNS),
  footerText: null,
  termsConditions: null,
  createdAt: null,
} as unknown as Template;

function activeTilbudTemplate(templates: Template[] | undefined): Template {
  if (!templates || templates.length === 0) return FALLBACK_TEMPLATE;
  const tilbud = templates.filter((t) => t.type === "tilbud");
  if (tilbud.length === 0) return FALLBACK_TEMPLATE;
  return tilbud.find((t) => t.isDefault === 1) ?? tilbud[0];
}

/** Replace {placeholders} in template text with actual values. */
function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/** Map a quote item field to a column key for template-driven rendering. */
function columnValue(item: QuoteItem, key: string): string {
  switch (key) {
    case "description": return item.description;
    case "qty": case "quantity": return String(item.quantity);
    case "unit": return item.unit === "m2" ? "m²" : item.unit;
    case "price": case "unitPrice": case "unit_price": return money(item.unitPrice);
    case "total": case "amount": return money(item.amount);
    default: return "";
  }
}

function money(value?: number | null) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(value ?? 0);
}
function moneyPlain(value?: number | null) {
  return new Intl.NumberFormat("da-DK").format(value ?? 0);
}
function date(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function ago30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function Tilbud() {
  const { companyId, user, hasFeature, plan } = useAuth();
  const { toast } = useToast();
  const allowed = hasFeature("tilbud");
  const canManage = ["leder", "holdleder", "platform_admin"].includes(user?.role ?? "");
  const canDelete = ["leder", "platform_admin"].includes(user?.role ?? "");
  const canContractManage = ["leder", "platform_admin"].includes(user?.role ?? "");
  const { data: customers } = useCustomers(companyId);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [previewQuoteId, setPreviewQuoteId] = useState<number | null>(null);
  const [chargeContract, setChargeContract] = useState<Contract | null>(null);
  const [chargeFrom, setChargeFrom] = useState(ago30());
  const [chargeTo, setChargeTo] = useState(today());
  const [activeTab, setActiveTab] = useState("quotes");

  const tabItems: FunctionMenuItem[] = [
    { id: "quotes", label: "Tilbud", icon: <FileText className="w-4 h-4" /> },
    { id: "contracts", label: "Aftaler", icon: <ScrollText className="w-4 h-4" /> },
  ];

  const { data: quotes, isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/quotes?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/contracts?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: quoteDetail, isLoading: detailLoading } = useQuery<{ quote: Quote; items: QuoteItem[] }>({
    queryKey: ["/api/quotes", previewQuoteId, companyId],
    queryFn: async () => (await apiRequest("GET", `/api/quotes/${previewQuoteId}?companyId=${companyId}`)).json(),
    enabled: allowed && previewQuoteId !== null,
  });
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/templates?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: company } = useQuery<Company>({
    queryKey: ["/api/company", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/company?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: cleaningServices } = useQuery<CleaningService[]>({
    queryKey: ["/api/cleaning-services", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/cleaning-services?companyId=${companyId}`)).json(),
    enabled: allowed,
  });
  const { data: charge, isFetching: chargeLoading } = useQuery<any>({
    queryKey: ["/api/contracts/charge", chargeContract?.id, chargeFrom, chargeTo, companyId],
    queryFn: async () => (await apiRequest("GET", `/api/contracts/${chargeContract?.id}/charge?from=${chargeFrom}&to=${chargeTo}&companyId=${companyId}`)).json(),
    enabled: allowed && chargeContract !== null,
  });

  const invalidateQuotes = () => queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
  const invalidateContracts = () => queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
  const currentTemplate = activeTilbudTemplate(templates);

  const createQuote = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/quotes?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidateQuotes(); setQuoteOpen(false); toast({ title: "Tilbud oprettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke oprette tilbud", description: e.message, variant: "destructive" }),
  });

  /** Enhanced send flow: creates an outbound message using the template's
   *  email subject/body, sends it via the communication integration, and
   *  updates the quote status to "sendt". */
  const sendQuote = useMutation({
    mutationFn: async (quote: Quote) => {
      const customer = customers?.find((c) => c.id === quote.customerId);
      const tpl = currentTemplate;
      const vars: Record<string, string> = {
        quoteNumber: quote.quoteNumber,
        totalAmount: moneyPlain(quote.totalAmount),
        validUntil: date(quote.validUntil),
        customerName: customer?.name ?? "kunde",
        companyName: company?.name ?? "os",
        title: quote.title,
      };
      const subject = (tpl.subject ? fillTemplate(tpl.subject, vars) : `Tilbud ${quote.quoteNumber} fra ${company?.name ?? "os"}`).trim();
      const defaultBody = `Hej ${vars.customerName},\n\nTak for din henvendelse. Vedhæftet finder du vores tilbud ${quote.quoteNumber} på ${moneyPlain(quote.totalAmount)} kr. inkl. moms.\n\nTilbuddet er gyldigt til ${date(quote.validUntil)}.\n\nMed venlig hilsen\n${company?.name ?? "ADD SmartRegnskab"}`;
      const body = tpl.body ? fillTemplate(tpl.body, vars) : defaultBody;
      const recipient = customer?.invoiceEmail || customer?.email;
      if (!recipient) throw new Error("Kunden har ingen e-mailadresse.");

      // 1. Create outbound message using template content
      const msgRes = await apiRequest("POST", `/api/outbound-messages?companyId=${companyId}`, {
        companyId,
        customerId: quote.customerId,
        relatedType: "tilbud",
        relatedId: quote.id,
        channel: "email",
        recipientName: customer?.name ?? null,
        recipientEmail: recipient,
        subject,
        body,
        status: "klar_til_afsendelse",
      });
      const msg = await msgRes.json();

      // 2. Send via the communication integration
      const sendRes = await apiRequest("POST", `/api/outbound-messages/${msg.id}/send?companyId=${companyId}`, {});
      const sent = await sendRes.json();

      // 3. Update quote status to "sendt"
      const quoteRes = await apiRequest("PATCH", `/api/quotes/${quote.id}?companyId=${companyId}`, { status: "sendt" });
      return { quote: await quoteRes.json(), message: sent };
    },
    onSuccess: (data: any) => {
      invalidateQuotes();
      queryClient.invalidateQueries({ queryKey: ["/api/outbound-messages"] });
      const errMsg = data?.message?.errorMessage;
      if (errMsg) {
        toast({ title: "Tilbud markeret som sendt", description: errMsg });
      } else {
        toast({ title: "Tilbud sendt til kunden", description: "E-mailen er afsendt." });
      }
    },
    onError: (e: any) => toast({ title: "Kunne ikke sende tilbud", description: e.message, variant: "destructive" }),
  });

  const quoteAction = useMutation({
    mutationFn: async ({ id, path, body }: { id: number; path: string; body?: unknown }) =>
      (await apiRequest("POST", `/api/quotes/${id}/${path}?companyId=${companyId}`, body ?? {})).json(),
    onSuccess: (data: any, variables) => {
      invalidateQuotes();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      if (variables.path === "respond" && data.contract) {
        invalidateContracts();
        toast({
          title: "Tilbud accepteret",
          description: `Der er nu oprettet en aftale for kunden.${data.portalActivated ? " Kundeportaladgang er aktiveret og kunden er underrettet." : ""}`,
        });
      } else if (variables.path === "respond") {
        toast({ title: "Tilbud afvist", description: "Kunden er blevet underrettet." });
      }
      else toast({ title: "Tilbud sendt til kunden" });
    },
    onError: (e: any) => toast({ title: "Handlingen mislykkedes", description: e.message, variant: "destructive" }),
  });
  const deleteQuote = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/quotes/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidateQuotes(); toast({ title: "Tilbud slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette tilbud", description: e.message, variant: "destructive" }),
  });
  const saveContract = useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: unknown }) =>
      (await apiRequest(id ? "PATCH" : "POST", `/api/contracts${id ? `/${id}` : ""}?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidateContracts(); setContractOpen(false); setEditingContract(null); toast({ title: "Aftale gemt" }); },
    onError: (e: any) => toast({ title: "Kunne ikke gemme aftale", description: e.message, variant: "destructive" }),
  });
  const deleteContract = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/contracts/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidateContracts(); toast({ title: "Aftale slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette aftale", description: e.message, variant: "destructive" }),
  });
  const customerName = (id: number) => customers?.find((c) => c.id === id)?.name ?? `Kunde #${id}`;
  const customerById = (id: number): Customer | undefined => customers?.find((c) => c.id === id);

  if (!allowed) return <Locked planName={plan?.name} />;
  if (quotesLoading || contractsLoading) return <Loading />;

  const quoteList = quotes ?? [];
  const nyeTilbud = quoteList.filter((q) => q.status === "kladde").length;
  const accepteretCount = quoteList.filter((q) => q.status === "accepteret").length;
  const afvistCount = quoteList.filter((q) => q.status === "afvist").length;
  const totalQuoteValue = quoteList.reduce((s, q) => s + (q.totalAmount ?? 0), 0);

  return (
    <div className="p-4 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <PageHeader eyebrow="Salg" title="Tilbud" description="Tilbud og leads" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<FilePlus className="w-5 h-5" />} value={nyeTilbud} label="Nye tilbud" variant="blue" />
        <MetricCard icon={<CheckCircle className="w-5 h-5" />} value={accepteretCount} label="Accepteret" variant="green" />
        <MetricCard icon={<XCircle className="w-5 h-5" />} value={afvistCount} label="Afvist" variant="red" />
        <MetricCard icon={<TrendingUp className="w-5 h-5" />} value={money(totalQuoteValue)} label="Total værdi" variant="primary" />
      </div>
      <FunctionMenu items={tabItems} active={activeTab} onChange={setActiveTab} />
      {activeTab === "quotes" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {canManage && <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
              <DialogTrigger asChild><Button data-testid="button-new-quote"><Plus className="w-4 h-4 mr-1.5" />Opret tilbud</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Opret tilbud</DialogTitle></DialogHeader>
                <QuoteForm
                  customers={customers ?? []}
                  templates={(templates ?? []).filter((t) => t.type === "tilbud")}
                  cleaningServices={cleaningServices ?? []}
                  defaultTemplateId={currentTemplate.id}
                  pending={createQuote.isPending}
                  onSubmit={(body) => createQuote.mutate(body)}
                />
              </DialogContent>
            </Dialog>}
          </div>
          {(quotes ?? []).length === 0 ? <Empty icon={<FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />} testId="empty-quotes" text="Der er ingen tilbud endnu." /> : (
            <div data-testid="card-quotes">
              <SectionCard icon={<FileText className="w-4 h-4" />} noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                <table className="table-premium w-full min-w-[800px] text-sm">
                  <thead><tr>
                    <th>Nummer</th><th>Kunde</th><th>Titel</th>
                    <th className="text-right">Beløb inkl. moms</th><th>Status</th><th>Gyldig til</th><th className="w-48" />
                  </tr></thead>
                  <tbody>{quotes?.map((quote) => <QuoteRow key={quote.id} quote={quote} customer={customerName(quote.customerId)}
                    canManage={canManage} canDelete={canDelete}
                    busy={sendQuote.isPending || quoteAction.isPending || deleteQuote.isPending}
                    onPreview={() => setPreviewQuoteId(quote.id)}
                    onSend={() => sendQuote.mutate(quote)}
                    onRespond={(accepted: boolean) => quoteAction.mutate({ id: quote.id, path: "respond", body: { accepted, frequency: "ugentlig", startDate: today() } })}
                    onDelete={() => deleteQuote.mutate(quote.id)}
                    onPdf={() => openAuthedFile(`/api/quotes/${quote.id}/pdf?companyId=${companyId}`)}
                  />)}</tbody>
                </table>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}
      {activeTab === "contracts" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {canContractManage && <Dialog open={contractOpen} onOpenChange={(open) => { setContractOpen(open); if (!open) setEditingContract(null); }}>
              <DialogTrigger asChild><Button data-testid="button-new-contract"><Plus className="w-4 h-4 mr-1.5" />Opret aftale</Button></DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingContract ? "Redigér aftale" : "Opret aftale"}</DialogTitle></DialogHeader>
                <ContractForm key={editingContract?.id ?? "new"} customers={customers ?? []} contract={editingContract} pending={saveContract.isPending}
                  onSubmit={(body) => saveContract.mutate({ id: editingContract?.id, body })} />
              </DialogContent>
            </Dialog>}
          </div>
          {(contracts ?? []).length === 0 ? <Empty icon={<FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />} testId="empty-contracts" text="Der er ingen aftaler endnu." /> : (
            <div className="rounded-md border border-border/50 bg-card overflow-hidden" data-testid="card-contracts">
              <div className="overflow-x-auto"><table className="table-premium w-full min-w-[900px] text-sm">
                <thead><tr>
                  <th>Nummer</th><th>Kunde</th><th>Titel</th><th>Prismodel</th>
                  <th className="text-right">Aftalt sats</th><th className="text-right">Inkl. timer</th><th>Frekvens</th><th>Startdato</th><th>Status</th><th />
                </tr></thead>
                <tbody>{contracts?.map((contract) => <tr key={contract.id} className="border-b border-border/50 last:border-0" data-testid={`row-contract-${contract.id}`}>
                  <td className="p-3 font-medium whitespace-nowrap">{contract.contractNumber}</td><td className="p-3 max-w-40 truncate">{customerName(contract.customerId)}</td><td className="p-3 max-w-48 truncate">{contract.title}</td>
                  <td className="p-3">{PRICING.find(([id]) => id === contract.pricingModel)?.[1] ?? contract.pricingModel}</td><td className="p-3 text-right tabular-nums">{money(contract.agreedRate)}</td>
                  <td className="p-3 text-right tabular-nums">{contract.pricingModel === "fast_maaned" ? contract.hoursIncluded ?? 0 : "—"}</td><td className="p-3">{FREQUENCIES.find(([id]) => id === contract.frequency)?.[1] ?? contract.frequency}</td>
                  <td className="p-3 whitespace-nowrap">{date(contract.startDate)}</td><td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{contract.status}</span></td>
                  <td className="p-3"><div className="flex gap-1 justify-end">
                    <Button variant="outline" size="sm" data-testid={`button-charge-contract-${contract.id}`} onClick={() => setChargeContract(contract)}>Beregn periode</Button>
                    {canContractManage && <><button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-edit-contract-${contract.id}`} onClick={() => { setEditingContract(contract); setContractOpen(true); }}><FileText className="w-4 h-4" /></button>
                    <button className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-delete-contract-${contract.id}`} onClick={() => deleteContract.mutate(contract.id)}><Trash2 className="w-4 h-4" /></button></>}
                  </div></td>
                </tr>)}</tbody>
              </table></div>
            </div>
          )}
        </div>
      )}
      <ChargeDialog contract={chargeContract} charge={charge} loading={chargeLoading} from={chargeFrom} to={chargeTo} onFrom={setChargeFrom} onTo={setChargeTo} onClose={() => setChargeContract(null)} />
      <AiTilbudPanel customers={customers ?? []} companyId={companyId} />

      {/* Professional quote preview dialog */}
      <QuotePreviewDialog
        quoteId={previewQuoteId}
        detail={quoteDetail}
        detailLoading={detailLoading}
        template={currentTemplate}
        company={company ?? null}
        customer={previewQuoteId !== null ? customerById(quoteDetail?.quote.customerId ?? previewQuoteId) ?? null : null}
        canManage={canManage}
        canDelete={canDelete}
        busy={sendQuote.isPending || quoteAction.isPending || deleteQuote.isPending}
        onClose={() => setPreviewQuoteId(null)}
        onSend={() => { if (quoteDetail?.quote) sendQuote.mutate(quoteDetail.quote); }}
        onRespond={(accepted: boolean, message?: string) => { if (quoteDetail?.quote) quoteAction.mutate({ id: quoteDetail.quote.id, path: "respond", body: { accepted, message: message ?? null, frequency: "ugentlig", startDate: today() } }); }}
        onDelete={() => { if (quoteDetail?.quote) { deleteQuote.mutate(quoteDetail.quote.id); setPreviewQuoteId(null); } }}
        onPdf={() => { if (previewQuoteId !== null) openAuthedFile(`/api/quotes/${previewQuoteId}/pdf?companyId=${companyId}`); }}
      />
    </div>
  );
}

// ── Quote table row ───────────────────────────────────────────
function QuoteRow({ quote, customer, canManage, canDelete, busy, onPreview, onSend, onRespond, onDelete, onPdf }: any) {
  const status = STATUS[quote.status]?.label ?? quote.status;
  return <tr className="border-b border-border/50" data-testid={`row-quote-${quote.id}`}>
    <td className="p-3 font-medium whitespace-nowrap">{quote.quoteNumber}</td><td className="p-3 max-w-40 truncate">{customer}</td><td className="p-3 max-w-56 truncate">{quote.title}</td><td className="p-3 text-right font-medium tabular-nums">{money(quote.totalAmount)}</td>
    <td className="p-3"><span data-testid={`status-quote-${quote.id}`} className="inline-flex items-center gap-1"><StatusChip status={status} variant={quoteStatusVariant[quote.status] ?? "gray"} />{quote.customerMessage && <span title="Kunden har lagt en besked"><Mail className="w-3.5 h-3.5 text-muted-foreground" data-testid={`badge-quote-message-${quote.id}`} /></span>}</span></td><td className="p-3 whitespace-nowrap">{date(quote.validUntil)}</td>
    <td className="p-3"><div className="flex gap-1 justify-end">
      <button onClick={onPreview} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-preview-quote-${quote.id}`} title="Vis tilbud"><Eye className="w-4 h-4" /></button>
      <button onClick={onPdf} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-pdf-quote-${quote.id}`} title="Hent PDF"><FileText className="w-4 h-4" /></button>
      {canManage && quote.status === "kladde" && <button onClick={onSend} disabled={busy} className="p-1.5 rounded-md hover:bg-muted text-blue-700 dark:text-blue-400" data-testid={`button-send-quote-${quote.id}`} title="Send til kunde"><Send className="w-4 h-4" /></button>}
      {canManage && ["kladde", "sendt"].includes(quote.status) && <><button onClick={() => onRespond(true)} disabled={busy} className="p-1.5 rounded-md hover:bg-muted text-emerald-600" data-testid={`button-accept-quote-${quote.id}`} title="Accepteret"><Check className="w-4 h-4" /></button><button onClick={() => onRespond(false)} disabled={busy} className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-reject-quote-${quote.id}`} title="Afvist"><X className="w-4 h-4" /></button></>}
      {canDelete && <button onClick={onDelete} disabled={busy} className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-delete-quote-${quote.id}`} title="Slet"><Trash2 className="w-4 h-4" /></button>}
    </div></td>
  </tr>;
}

// ── Create quote form (with template selector) ────────────────
function QuoteForm({ customers, templates, cleaningServices, defaultTemplateId, pending, onSubmit }: {
  customers: { id: number; name: string }[];
  templates: Template[];
  cleaningServices: CleaningService[];
  defaultTemplateId: number;
  pending: boolean;
  onSubmit: (data: unknown) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [templateId, setTemplateId] = useState(String(defaultTemplateId));
  const [items, setItems] = useState([{ description: "", quantity: "1", unit: "timer", unitPrice: "0" }]);
  const [error, setError] = useState("");
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity.replace(",", ".")) || 0) * (Number(item.unitPrice.replace(",", ".")) || 0), 0), [items]);
  const update = (index: number, key: string, value: string) => setItems(items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const addService = (serviceId: string) => {
    if (!serviceId) return;
    const svc = cleaningServices.find((s) => s.id === Number(serviceId));
    if (!svc) return;
    const unit = svc.unitType === "time" ? "timer" : svc.unitType === "kvm" ? "m2" : svc.unitType === "fast_pris" ? "md" : "stk";
    setItems([...items, { description: svc.name + (svc.description ? ` — ${svc.description}` : ""), quantity: String(svc.estimatedHours || 1), unit, unitPrice: String(svc.price || svc.hourlyRate || 0) }]);
  };
  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!customerId || !title.trim() || !validUntil) return setError("Vælg kunde og udfyld titel og gyldighed.");
    if (items.some((item) => !item.description.trim())) return setError("Alle linjer skal have en beskrivelse.");
    setError("");
    onSubmit({ customerId: Number(customerId), title: title.trim(), description: description.trim() || null, validUntil, items: items.map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity.replace(",", ".")) || 0, unit: i.unit, unitPrice: Number(i.unitPrice.replace(",", ".")) || 0 })) });
  };
  return <form className="space-y-3" onSubmit={submit}>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Kunde"><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger data-testid="select-quote-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Gyldig til"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} data-testid="input-quote-valid-until" required /></Field></div>
    <Field label="Titel"><Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-quote-title" required /></Field>
    <Field label="Skabelon"><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger data-testid="select-quote-template"><SelectValue placeholder="Vælg skabelon" /></SelectTrigger><SelectContent>{templates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.isDefault === 1 ? " (standard)" : ""}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Beskrivelse"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-quote-description" rows={3} /></Field>
    <div className="space-y-2">
      <div className="flex justify-between gap-2 items-center flex-wrap">
        <Label>Tilbudslinjer</Label>
        <div className="flex gap-2">
          {cleaningServices.length > 0 && <Select value="" onValueChange={addService}><SelectTrigger data-testid="select-quote-add-service" className="w-auto h-9 text-xs"><SelectValue placeholder="+ Tilføj ydelse" /></SelectTrigger><SelectContent>{cleaningServices.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>}
          <Button type="button" size="sm" variant="outline" data-testid="button-add-quote-line" onClick={() => setItems([...items, { description: "", quantity: "1", unit: "timer", unitPrice: "0" }])}><Plus className="w-3.5 h-3.5 mr-1" />Tilføj linje</Button>
        </div>
      </div>
      {items.map((item, index) => <div className="grid grid-cols-[minmax(0,1fr)_74px_92px_94px_32px] gap-2 items-end" key={index} data-testid={`quote-line-${index}`}><Field label={index === 0 ? "Beskrivelse" : undefined}><Input value={item.description} onChange={(e) => update(index, "description", e.target.value)} data-testid={`input-quote-line-description-${index}`} /></Field><Field label={index === 0 ? "Antal" : undefined}><Input inputMode="decimal" value={item.quantity} onChange={(e) => update(index, "quantity", e.target.value)} data-testid={`input-quote-line-quantity-${index}`} /></Field><Field label={index === 0 ? "Enhed" : undefined}><Select value={item.unit} onValueChange={(v) => update(index, "unit", v)}><SelectTrigger data-testid={`select-quote-line-unit-${index}`}><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u === "m2" ? "m²" : u}</SelectItem>)}</SelectContent></Select></Field><Field label={index === 0 ? "Enhedspris" : undefined}><Input inputMode="decimal" value={item.unitPrice} onChange={(e) => update(index, "unitPrice", e.target.value)} data-testid={`input-quote-line-price-${index}`} /></Field><button type="button" disabled={items.length === 1} className="h-10 text-muted-foreground hover:text-destructive disabled:opacity-30" data-testid={`button-remove-quote-line-${index}`} onClick={() => setItems(items.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></button></div>)}
    </div>
    <div className="ml-auto w-full sm:w-64 rounded-md bg-muted/60 p-3 text-xs space-y-1" data-testid="card-quote-totals"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>Moms (25 %)</span><span>{money(subtotal * .25)}</span></div><div className="flex justify-between font-bold border-t border-border pt-1"><span>Total</span><span>{money(subtotal * 1.25)}</span></div></div>
    {error && <p className="text-xs text-destructive" data-testid="text-quote-error">{error}</p>}<Button className="w-full" type="submit" disabled={pending} data-testid="button-save-quote">{pending ? "Gemmer..." : "Opret tilbud"}</Button>
  </form>;
}

// ── Quote preview dialog ─────────────────────────────────────
function QuotePreviewDialog({ quoteId, detail, detailLoading, template, company, customer, canManage, canDelete, busy, onClose, onSend, onRespond, onDelete, onPdf }: any) {
  const open = quoteId !== null;
  const quote: Quote | undefined = detail?.quote;
  const items: QuoteItem[] = detail?.items ?? [];
  const [responseMessage, setResponseMessage] = useState("");
  const responded = quote && (quote.status === "accepteret" || quote.status === "afvist");
  return <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-quote-preview">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Tilbudsforhåndsvisning</DialogTitle></DialogHeader>
      {detailLoading ? <Skeleton className="h-96 rounded-md" /> : quote ? (
        <div className="space-y-3">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" data-testid="button-preview-pdf" onClick={onPdf}><FileText className="w-3.5 h-3.5 mr-1" />Hent PDF</Button>
            {canManage && quote.status === "kladde" && <Button size="sm" data-testid="button-preview-send" disabled={busy} onClick={onSend}><Send className="w-3.5 h-3.5 mr-1" />Send til kunde</Button>}
            {canManage && ["kladde", "sendt"].includes(quote.status) && <>
              <Button size="sm" variant="outline" data-testid="button-preview-accept" disabled={busy} onClick={() => onRespond(true, responseMessage.trim() || undefined)} className="text-emerald-600 border-emerald-600/30"><Check className="w-3.5 h-3.5 mr-1" />Accepter</Button>
              <Button size="sm" variant="outline" data-testid="button-preview-reject" disabled={busy} onClick={() => onRespond(false, responseMessage.trim() || undefined)} className="text-destructive border-destructive/30"><X className="w-3.5 h-3.5 mr-1" />Afvis</Button>
            </>}
            {canDelete && <Button size="sm" variant="outline" data-testid="button-preview-delete" disabled={busy} onClick={onDelete} className="text-destructive border-destructive/30"><Trash2 className="w-3.5 h-3.5 mr-1" />Slet</Button>}
          </div>

          {/* Customer response banner */}
          {responded && (
            <div className={`rounded-md border px-3 py-2 text-xs ${quote.status === "accepteret" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300" : "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 text-red-800 dark:text-red-300"}`} data-testid="banner-customer-response">
              <div className="flex items-center gap-1.5 font-medium">
                {quote.status === "accepteret" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {quote.status === "accepteret" ? "Kunden har accepteret tilbuddet" : "Kunden har afvist tilbuddet"}
                {quote.respondedAt && <span className="opacity-70">· {date(quote.respondedAt)}</span>}
              </div>
              {quote.customerMessage && <p className="mt-1 italic opacity-90" data-testid="text-customer-message">“{quote.customerMessage}”</p>}
            </div>
          )}

          {/* Message field for manual response (company acts on behalf of customer) */}
          {canManage && ["kladde", "sendt"].includes(quote.status) && (
            <div className="space-y-1.5" data-testid="block-response-message">
              <Label htmlFor="response-message" className="text-xs">Besked ved svar (valgfrit)</Label>
              <Textarea
                id="response-message"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                rows={2}
                placeholder="Tilføj en besked som følger med kundens accept/afvisning"
                data-testid="input-response-message"
              />
            </div>
          )}

          {/* Professional document */}
          <QuoteDocumentPreview quote={quote} items={items} template={template} company={company} customer={customer} />
        </div>
      ) : <p className="text-sm text-muted-foreground">Tilbuddet kunne ikke indlæses.</p>}
    </DialogContent>
  </Dialog>;
}

// ── Professional document preview (template-driven) ──────────
function QuoteDocumentPreview({ quote, items, template, company, customer }: {
  quote: Quote;
  items: QuoteItem[];
  template: Template;
  company: Company | null;
  customer: Customer | null;
}) {
  const accent = template.primaryColor || "#2176d4";
  const logoPosition = template.logoPosition || "left";
  const headerLayout = template.headerLayout || "classic";
  const showBankInfo = template.showBankInfo !== 0;
  const showPaymentTerms = template.showPaymentTerms !== 0;
  const showEAN = template.showEAN === 1;
  const columns = parseColumns(template.columns);
  const footerText = template.footerText;
  const termsConditions = template.termsConditions;

  const netAmount = quote.netAmount ?? items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const vatAmount = quote.vatAmount ?? Math.round(netAmount * 0.25 * 100) / 100;
  const totalAmount = quote.totalAmount ?? netAmount + vatAmount;
  const companyName = company?.name ?? "Virksomhed";
  const companyAddress = company?.address ?? "";
  const companyCvr = company?.cvr ?? "";
  const companyPhone = company?.phone ?? "";
  const companyEmail = company?.email ?? "";
  const paymentTermsDays = company?.paymentTerms ?? 8;

  const customerName = customer?.name ?? `Kunde #${quote.customerId}`;
  const customerContact = customer?.contactPerson || customer?.contact || "";
  const customerAddress = customer?.address ?? "";
  const customerEan = customer?.ean ?? "";

  const logoBlock = logoPosition !== "none" ? (
    <div className="w-14 h-14 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: accent }}>
      {(companyName || "LOGO").slice(0, 2).toUpperCase()}
    </div>
  ) : null;
  const headerJustify =
    logoPosition === "right" ? "justify-end" :
    logoPosition === "center" ? "justify-center" : "justify-start";

  const totalColWidth = columns.reduce((sum, c) => {
    const n = parseInt(c.width, 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0) || 100;

  return (
    <div className="bg-white text-gray-900 rounded-md shadow-sm border border-gray-200 overflow-hidden mx-auto" style={{ maxWidth: "680px" }} data-testid="document-preview">
      {/* Color accent bar */}
      <div className="h-1.5" style={{ backgroundColor: accent }} />

      <div className="p-5">
        {/* Header */}
        {headerLayout === "minimal" ? (
          <div className="mb-4">
            <div className={`flex items-center gap-3 ${headerJustify}`}>
              {logoBlock}
              <div>
                <p className="text-base font-bold" style={{ color: accent }}>{companyName}</p>
                {companyAddress && <p className="text-[10px] text-gray-500">{companyAddress}</p>}
              </div>
            </div>
          </div>
        ) : headerLayout === "modern" ? (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className={`flex items-center gap-3 ${headerJustify}`}>
              {logoBlock}
              <div>
                <p className="text-base font-bold" style={{ color: accent }}>{companyName}</p>
                {companyAddress && <p className="text-[10px] text-gray-500">{companyAddress}</p>}
                {companyCvr && <p className="text-[10px] text-gray-500">CVR {companyCvr}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold" style={{ color: accent }}>Tilbud</p>
              <p className="text-[10px] text-gray-500">{quote.quoteNumber}</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className={`flex items-center gap-3 ${headerJustify}`}>
              {logoBlock}
              <div>
                <p className="text-base font-bold" style={{ color: accent }}>{companyName}</p>
                {companyAddress && <p className="text-[10px] text-gray-500">{companyAddress}</p>}
                {companyCvr && <p className="text-[10px] text-gray-500">CVR {companyCvr}</p>}
                {companyPhone && <p className="text-[10px] text-gray-500">{companyPhone}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-gray-900">Tilbud</p>
              <p className="text-[10px] text-gray-500">Dato: {date(quote.issueDate)}</p>
              <p className="text-[10px] text-gray-500">Nr. {quote.quoteNumber}</p>
              <p className="text-[10px] text-gray-500">Gyldig til: {date(quote.validUntil)}</p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-800">{quote.title}</p>
          {quote.description && <p className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap">{quote.description}</p>}
        </div>

        {/* Customer block */}
        <div className="mb-4 rounded border border-gray-200 p-3" style={{ borderColor: `${accent}40` }}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Til kunde</p>
          <p className="text-sm font-medium">{customerName}</p>
          {customerContact && <p className="text-[11px] text-gray-600">Att. {customerContact}</p>}
          {customerAddress && <p className="text-[11px] text-gray-600">{customerAddress}</p>}
          {customer?.cvr && <p className="text-[11px] text-gray-600">CVR {customer.cvr}</p>}
          {showEAN && customerEan && <p className="text-[11px] text-gray-600 mt-1">EAN: {customerEan}</p>}
          {showEAN && !customerEan && <p className="text-[11px] text-gray-400 mt-1">EAN: —</p>}
        </div>

        {/* Line items table */}
        {items.length > 0 && (
          <div className="mb-4">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr style={{ backgroundColor: accent }}>
                  {columns.map((c) => (
                    <th key={c.key} className="px-2 py-1.5 text-white font-semibold text-left first:rounded-l first:pl-2.5 last:rounded-r" style={{ width: `${(parseInt(c.width, 10) / totalColWidth) * 100}%` }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-2 py-1.5 first:pl-2.5 text-gray-700 ${["price", "total", "qty"].includes(c.key) ? "text-right tabular-nums" : ""}`}>
                        {columnValue(item, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-52 text-[11px]">
            <div className="flex justify-between py-1"><span className="text-gray-500">Subtotal ekskl. moms</span><span className="tabular-nums">{moneyPlain(netAmount)} kr.</span></div>
            <div className="flex justify-between py-1"><span className="text-gray-500">Moms (25 %)</span><span className="tabular-nums">{moneyPlain(vatAmount)} kr.</span></div>
            <div className="flex justify-between py-1.5 mt-1 border-t font-bold text-white px-2 rounded" style={{ backgroundColor: accent }}>
              <span>Total inkl. moms</span>
              <span className="tabular-nums">{moneyPlain(totalAmount)} kr.</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        {showPaymentTerms && (
          <div className="mb-3 text-[11px]">
            <p className="font-semibold text-gray-700 mb-0.5">Betalingsbetingelser</p>
            <p className="text-gray-500">Betalingsfrist: {paymentTermsDays} dage fra fakturadato. Betaling via bankoverførsel.</p>
          </div>
        )}

        {/* Bank info */}
        {showBankInfo && (company?.bankName || company?.bankAccount || company?.iban) && (
          <div className="mb-3 text-[11px]">
            <p className="font-semibold text-gray-700 mb-0.5">Bankoplysninger</p>
            <p className="text-gray-500">
              {company?.bankName && `Bank: ${company.bankName}`}
              {company?.bankAccount && ` · Regnr/Kontonr: ${company.bankAccount}`}
              {company?.iban && ` · IBAN: ${company.iban}`}
              {company?.swift && ` · SWIFT: ${company.swift}`}
            </p>
          </div>
        )}

        {/* Footer */}
        {footerText && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500 whitespace-pre-wrap">
            {footerText}
          </div>
        )}

        {/* Terms and conditions */}
        {termsConditions && (
          <div className="mt-3 text-[10px] text-gray-400 leading-relaxed whitespace-pre-wrap">
            <p className="font-semibold text-gray-500 mb-0.5">Vilkår og betingelser</p>
            {termsConditions}
          </div>
        )}

        {/* Company contact line */}
        {(companyEmail || companyPhone) && (
          <div className="mt-4 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
            {companyEmail && <span>{companyEmail}</span>}
            {companyEmail && companyPhone && <span> · </span>}
            {companyPhone && <span>{companyPhone}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ContractForm({ customers, contract, pending, onSubmit }: { customers: { id: number; name: string }[]; contract: Contract | null; pending: boolean; onSubmit: (data: unknown) => void }) {
  const [customerId, setCustomerId] = useState(String(contract?.customerId ?? ""));
  const [title, setTitle] = useState(contract?.title ?? "");
  const [pricingModel, setPricingModel] = useState(contract?.pricingModel ?? "timepris");
  const [agreedRate, setAgreedRate] = useState(String(contract?.agreedRate ?? 0));
  const [hoursIncluded, setHoursIncluded] = useState(String(contract?.hoursIncluded ?? 0));
  const [overtimeRate, setOvertimeRate] = useState(String(contract?.overtimeRate ?? 0));
  const [frequency, setFrequency] = useState(contract?.frequency ?? "ugentlig");
  const [startDate, setStartDate] = useState(contract?.startDate ?? today());
  const [endDate, setEndDate] = useState(contract?.endDate ?? "");
  const [noticeMonths, setNoticeMonths] = useState(String(contract?.noticeMonths ?? 1));
  const [terms, setTerms] = useState(contract?.terms ?? "");
  const [error, setError] = useState("");
  const submit = (e: { preventDefault(): void }) => { e.preventDefault(); if (!customerId || !title.trim()) return setError("Vælg kunde og angiv en titel."); setError(""); onSubmit({ customerId: Number(customerId), title: title.trim(), pricingModel, agreedRate: Number(agreedRate.replace(",", ".")) || 0, hoursIncluded: pricingModel === "fast_maaned" ? Number(hoursIncluded.replace(",", ".")) || 0 : 0, overtimeRate: pricingModel === "fast_maaned" ? Number(overtimeRate.replace(",", ".")) || 0 : 0, frequency, startDate, endDate: endDate || null, noticeMonths: Number(noticeMonths) || 0, terms: terms.trim() || null }); };
  return <form onSubmit={submit} className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Kunde"><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger data-testid="select-contract-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Prismodel"><Select value={pricingModel} onValueChange={setPricingModel}><SelectTrigger data-testid="select-contract-pricing"><SelectValue /></SelectTrigger><SelectContent>{PRICING.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Titel"><Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-contract-title" required /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Aftalt sats"><Input inputMode="decimal" value={agreedRate} onChange={(e) => setAgreedRate(e.target.value)} data-testid="input-contract-rate" /></Field><Field label="Frekvens"><Select value={frequency} onValueChange={setFrequency}><SelectTrigger data-testid="select-contract-frequency"><SelectValue /></SelectTrigger><SelectContent>{FREQUENCIES.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></Field></div>{pricingModel === "fast_maaned" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Inkluderede timer"><Input inputMode="decimal" value={hoursIncluded} onChange={(e) => setHoursIncluded(e.target.value)} data-testid="input-contract-hours-included" /></Field><Field label="Overtidssats"><Input inputMode="decimal" value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} data-testid="input-contract-overtime-rate" /></Field></div>}<div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Field label="Startdato"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-contract-start-date" /></Field><Field label="Slutdato"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-contract-end-date" /></Field><Field label="Opsigelsesperiod (mdr)"><Input type="number" min="0" value={noticeMonths} onChange={(e) => setNoticeMonths(e.target.value)} data-testid="input-contract-notice" /></Field></div><Field label="Betingelser"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} data-testid="input-contract-terms" rows={3} /></Field>{error && <p className="text-xs text-destructive" data-testid="text-contract-error">{error}</p>}<Button className="w-full" type="submit" disabled={pending} data-testid="button-save-contract">{pending ? "Gemmer..." : "Gem aftale"}</Button></form>;
}

function ChargeDialog({ contract, charge, loading, from, to, onFrom, onTo, onClose }: any) {
  const c = charge?.charge; const totals = charge?.totals;
  return <Dialog open={!!contract} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Beregn periode{contract ? ` · ${contract.contractNumber}` : ""}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><Field label="Fra"><Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} data-testid="input-charge-from" /></Field><Field label="Til"><Input type="date" value={to} onChange={(e) => onTo(e.target.value)} data-testid="input-charge-to" /></Field></div>{loading ? <Skeleton className="h-52 rounded-md" /> : c && <div className="space-y-3" data-testid="card-charge-result"><p className="text-xs text-muted-foreground">{c.model === "fast_maaned" ? `Der er registreret ${c.hours} timer, hvor ${c.includedHours} er dækket af den faste månedspris.` : c.description}</p><div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs"><Result label="Registrerede timer" value={c.hours} /><Result label="Inkluderede timer" value={c.includedHours} /><Result label="Overtimer" value={c.overtimeHours} /><Result label="Grundbeløb" value={money(c.baseAmount)} /><Result label="Overtidsbeløb" value={money(c.overtimeAmount)} /><Result label="Netto" value={money(c.netAmount)} /><Result label="Moms" value={money(totals?.vatAmount)} /><Result label="Total" value={money(totals?.totalAmount)} bold /></div></div>}</DialogContent></Dialog>;
}
function Result({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) { return <div className={bold ? "font-bold" : ""}><div className="text-[11px] text-muted-foreground">{label}</div><div className="tabular-nums">{value}</div></div>; }
function Field({ label, children }: { label?: string; children: any }) { return <div className="space-y-1.5 min-w-0">{label && <Label>{label}</Label>}{children}</div>; }
function Empty({ icon, testId, text }: { icon: any; testId: string; text: string }) { return <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid={testId}>{icon}<p className="text-xs text-muted-foreground">{text}</p></div>; }
function Loading() { return <div className="p-4 space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-10 w-48" /><Skeleton className="h-80 rounded-md" /></div>; }
function Locked({ planName }: { planName?: string }) { return <div className="p-4 md:p-4 max-w-2xl mx-auto"><div className="rounded-md border border-border/50 bg-card p-4 text-center space-y-3" data-testid="notice-feature-locked"><Lock className="w-8 h-8 mx-auto text-muted-foreground" /><h1 className="text-lg font-bold text-foreground">Tilbud og aftaler er ikke med i din pakke</h1><p className="text-xs text-muted-foreground">Pakken {planName ?? "din nuværende"} indeholder ikke tilbud og aftaler. Opgradér på abonnementssiden for at få adgang.</p></div></div>; }

/** AI-panel der foreslår tilbudslinjer for en valgt kunde via /api/ai/assist. */
function AiTilbudPanel({ customers, companyId }: { customers: { id: number; name: string }[]; companyId: number }) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");

  const generate = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", "/api/ai/assist", { contextType: "tilbud", intent: "draft", companyId, entityId: id })).json(),
    onError: (e: any) => toast({ title: "Kunne ikke generere tilbudsforslag", description: e.message, variant: "destructive" }),
  });

  const data = generate.data as { items: { description: string; quantity: number; unit: string; unitPrice: number; total: number }[]; total: number; summary: string } | undefined;
  const pending = generate.isPending;

  return (
    <div data-testid="panel-ai-tilbud">
      <SectionCard title="AI lead-scoring" icon={<Sparkles className="w-4 h-4" />}>
        <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Kunde</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger data-testid="select-ai-tilbud-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          data-testid="button-ai-generate"
          disabled={!customerId || pending}
          onClick={() => customerId && generate.mutate(Number(customerId))}
        >
          {pending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          {pending ? "Genererer..." : "Generer tilbudsforslag"}
        </Button>
      </div>

      {!customerId ? (
        <p className="text-xs text-muted-foreground" data-testid="text-ai-tilbud-no-customer">
          Vælg en kunde først for at generere et tilbudsforslag.
        </p>
      ) : pending ? (
        <div className="space-y-2" data-testid="ai-tilbud-loading">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : generate.isError ? (
        <p className="text-xs text-destructive" data-testid="text-ai-tilbud-error">
          Forslaget kunne ikke hentes.
          <Button size="sm" variant="ghost" data-testid="button-ai-tilbud-retry" onClick={() => customerId && generate.mutate(Number(customerId))}>Prøv igen</Button>
        </p>
      ) : data ? (
        <div className="space-y-3" data-testid="block-ai-tilbud-result">
          <div className="overflow-x-auto rounded-md border border-border/50">
            <table className="table-premium w-full min-w-[480px] text-xs">
              <thead>
                <tr>
                  <th>Beskrivelse</th>
                  <th className="text-right">Antal</th>
                  <th>Enhed</th>
                  <th className="text-right">Enhedspris</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0" data-testid={`row-ai-tilbud-item-${i}`}>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="p-2">{item.unit}</td>
                    <td className="p-2 text-right tabular-nums">{money(item.unitPrice)}</td>
                    <td className="p-2 text-right font-medium tabular-nums">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40">
                  <td className="p-2 font-medium text-right" colSpan={4}>I alt</td>
                  <td className="p-2 text-right font-bold tabular-nums" data-testid="text-ai-tilbud-total">{money(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground" data-testid="text-ai-tilbud-summary">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <span>{data.summary}</span>
          </div>
        </div>
      ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

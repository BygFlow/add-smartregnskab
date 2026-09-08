import { useState } from"react";
import { Link, useLocation } from"wouter";
import { useAuth } from"@/lib/auth";
import { formatCurrency } from"@/App";
import { useQuery, useMutation } from"@tanstack/react-query";
import { apiRequest, queryClient, openAuthedFile } from"@/lib/queryClient";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Checkbox } from"@/components/ui/checkbox";
import { Switch } from"@/components/ui/switch";
import { Skeleton } from"@/components/ui/skeleton";
import { useToast } from"@/hooks/use-toast";
import {
 Plus, FileText, ShieldOff, ShieldCheck, Receipt, Check, ShieldAlert, Building2, Play, RefreshCw, AlertTriangle,
 Ban, Bell, CreditCard, Database, ScrollText, Lock, CheckCircle, Download, Trash2, Eye, Pencil,
 TrendingUp, AlertCircle, Package, Sparkles, Send, FilePlus2, Cloud, CloudOff, X, Star,
} from"lucide-react";
import { PageHeader, MetricCard, SectionCard, StatusChip } from"@/components/premium";
import type { Plan } from"@shared/schema";

type Stats = {
 companyCount: number; activeCount: number; trialCount: number;
 arrearsCount: number; blockedCount: number; totalEmployees: number;
 mrr: number; arr: number; outstanding: number; invoiceCount: number;
};
type CompanyRow = {
 id: number; name: string; cvr: string | null; email: string | null; status: string;
 employeeCount: number; customerCount: number; userCount: number;
 planName: string | null; planId: number | null;
 subscriptionStatus: string | null; billingCycle: string | null;
 trialEndsAt: string | null; currentPeriodEnd: string | null; monthlyValue: number;
};
type PlatformInvoiceRow = {
 id: number; companyId: number; companyName: string; invoiceNumber: string;
 periodStart: string; periodEnd: string; dueDate: string;
 netAmount: number; vatAmount: number; totalAmount: number; status: string;
};
type PaymentRow = {
 id: number; companyId: number; platformInvoiceId: number | null;
 paymentMethodId: number | null; provider: string; providerRef: string | null;
 amount: number; currency: string; status: string; failureReason: string | null;
 attempt: number; createdAt: string; settledAt: string | null;
};
type PaymentProvider = {
 id: string; label: string; configured: boolean; missingEnv: string[];
};
type PaymentsResponse = { payments: PaymentRow[]; providers: PaymentProvider[] };
type GdprCompany = {
 id: number; name: string; cvr: string | null; status: string; planName: string;
 userCount: number; employeeCount: number; customerCount: number;
 dpaAccepted: boolean; dpaAcceptedAt: string | null; createdAt: string;
};
type GdprResponse = {
 companyCount: number; dpaAccepted: number; dpaPending: number;
 companies: GdprCompany[];
 retentionDefaults: {
 gps: { maaneder: number; begrundelse: string };
 tidsregistreringer: { maaneder: number; begrundelse: string };
 fravaer: { maaneder: number; begrundelse: string };
 fotos: { maaneder: number; begrundelse: string };
 };
 dpaText: string;
 privacyPolicy: string;
};
type AuditLogRow = {
 id: number; companyId: number | null; userId: number | null; userEmail: string | null;
 action: string; target: string | null; detail: string | null; createdAt: string;
 companyName: string;
};

type ChipVariant ="primary" |"blue" |"amber" |"green" |"red" |"gray";
const CO_STATUS: Record<string, { label: string; variant: ChipVariant }> = {
 aktiv: { label:"Aktiv", variant:"green" },
 proeve: { label:"Prøve", variant:"blue" },
 i_restance: { label:"I restance", variant:"amber" },
 spaerret: { label:"Spærret", variant:"red" },
 opsagt: { label:"Opsagt", variant:"gray" },
};
const INV_STATUS: Record<string, string> = {
  kladde:"Kladde", udstedt:"Udstedt", sendt:"Sendt", betalt:"Betalt",
  forfalden:"Forfalden", rykket:"Rykket", overdraget:"Overdraget", kreditnoteret:"Kreditnoteret",
};
const INV_VARIANT: Record<string, ChipVariant> = {
  kladde:"gray", udstedt:"gray", sendt:"blue", betalt:"green",
  forfalden:"amber", rykket:"amber", overdraget:"red", kreditnoteret:"red",
};
const PAY_STATUS: Record<string, { label: string; variant: ChipVariant }> = {
 afventer: { label:"Afventer", variant:"gray" },
 gennemfoert: { label:"Gennemført", variant:"green" },
 fejlet: { label:"Fejlet", variant:"red" },
 refunderet: { label:"Refunderet", variant:"amber" },
 simuleret: { label:"Simuleret", variant:"blue" },
};
const RETENTION_LABELS: Record<string, string> = {
 gps:"GPS-koordinater",
 tidsregistreringer:"Tidsregistreringer",
 fravaer:"Fravær",
 fotos:"Foto- og PDF-dokumentation",
};

// Alle tilgængelige pakke-funktioner (i fast rækkefølge til checkbox-group)
const AVAILABLE_FEATURES: string[] = [
"opgaver","tidsregistrering","kunder","fakturering","vagtplan","fravaer","fotodokumentation",
"loen_eksport","regnskab_eksport","geofence","api_integration","revisionsspor","tilbud",
"materialer","kvalitetskontrol","noegler","gdpr_vaerktoejer",
];

const FEATURE_LABELS: Record<string, string> = {
 opgaver:"Opgavestyring",
 tidsregistrering:"Tidsregistrering",
 kunder:"Kundekartotek",
 fakturering:"Fakturering med moms",
 vagtplan:"Vagtplan",
 fravaer:"Fravær og ferie",
 fotodokumentation:"Fotodokumentation",
 loen_eksport:"Løneksport",
 regnskab_eksport:"Regnskabseksport",
 geofence:"GPS-kontrol af check-ind",
 api_integration:"Direkte API-integration",
 revisionsspor:"Revisionsspor",
 tilbud:"Tilbud og ordrer",
 materialer:"Materialer",
 kvalitetskontrol:"Kvalitetskontrol",
 noegler:"Nøglehåndtering",
 gdpr_vaerktoejer:"GDPR-værktøjer",
};

function parseFeatures(features: string): string[] {
 try {
 const arr = JSON.parse(features ||"[]");
 return Array.isArray(arr) ? arr.filter((f) => typeof f ==="string") : [];
 } catch {
 return [];
 }
}

function dk(d?: string | null) {
 if (!d) return"—";
 const [y, m, day] = d.slice(0, 10).split("-");
 return `${day}.${m}.${y}`;
}

export default function Platform() {
 const { isPlatformAdmin } = useAuth();
 const { toast } = useToast();
 const [location, navigate] = useLocation();
 const validTabs = ["virksomheder","fakturaer","betalinger","gdpr","revisionsspor","pakker","drift","ai"] as const;
 type Tab = typeof validTabs[number];
 const pathTab = location.split("/")[2] as Tab;
 const tab: Tab = validTabs.includes(pathTab) ? pathTab : "virksomheder";
 const setTab = (t: Tab) => navigate(`/platform/${t}` as any);

 const [createOpen, setCreateOpen] = useState(false);
 const [createPlanId, setCreatePlanId] = useState<number | null>(null);
 const [planDialog, setPlanDialog] = useState<CompanyRow | null>(null);
 const [suspendDialog, setSuspendDialog] = useState<CompanyRow | null>(null);
 const [cancelDialog, setCancelDialog] = useState<CompanyRow | null>(null);
 const [invoiceFilter, setInvoiceFilter] = useState<"alle" | "kladde" | "sendt" | "betalt" | "forfalden" | "rykket" | "overdraget" | "kreditnoteret" | "udstedt">("alle");
 const [invoiceDetail, setInvoiceDetail] = useState<PlatformInvoiceRow | null>(null);
 const [creditDialog, setCreditDialog] = useState<PlatformInvoiceRow | null>(null);
 const [editPlanDialog, setEditPlanDialog] = useState<{ mode:"create" } | { mode:"edit"; plan: Plan } | null>(null);

 const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
 queryKey: ["/api/platform/stats"],
 queryFn: async () => (await apiRequest("GET","/api/platform/stats")).json(),
 enabled: isPlatformAdmin,
 });
 const { data: companies, isLoading: coLoading } = useQuery<CompanyRow[]>({
 queryKey: ["/api/platform/companies"],
 queryFn: async () => (await apiRequest("GET","/api/platform/companies")).json(),
 enabled: isPlatformAdmin,
 });
 const { data: invoices } = useQuery<PlatformInvoiceRow[]>({
 queryKey: ["/api/platform/invoices"],
 queryFn: async () => (await apiRequest("GET","/api/platform/invoices")).json(),
 enabled: isPlatformAdmin,
 });
 const { data: plans } = useQuery<Plan[]>({
 queryKey: ["/api/platform/plans"],
 queryFn: async () => (await apiRequest("GET","/api/platform/plans")).json(),
 enabled: isPlatformAdmin,
 });

 const refreshAll = () => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/payments"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/gdpr"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] });
 };

 const createCompany = useMutation({
 mutationFn: async (data: any) => (await apiRequest("POST","/api/platform/companies", data)).json(),
 onSuccess: (d: any) => {
 refreshAll(); setCreateOpen(false);
 toast({ title: `${d.company.name} er oprettet`, description: `Administrator ${d.admin?.email ??"lederen"} kan logge ind nu.` });
 },
 onError: (e: any) => toast({ title:"Kunne ikke oprette virksomheden", description: e.message, variant:"destructive" }),
 });

 const suspend = useMutation({
 mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
 (await apiRequest("POST", `/api/platform/companies/${id}/suspend`, { reason })).json(),
 onSuccess: () => { refreshAll(); setSuspendDialog(null); toast({ title:"Virksomheden er spærret" }); },
 onError: (e: any) => toast({ title:"Kunne ikke spærre", description: e.message, variant:"destructive" }),
 });

 const cancel = useMutation({
 mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
 (await apiRequest("POST", `/api/platform/companies/${id}/cancel`, { reason })).json(),
 onSuccess: () => { refreshAll(); setCancelDialog(null); toast({ title:"Virksomheden er opsagt" }); },
 onError: (e: any) => toast({ title:"Kunne ikke opsige", description: e.message, variant:"destructive" }),
 });

 const reactivate = useMutation({
 mutationFn: async (id: number) =>
 (await apiRequest("POST", `/api/platform/companies/${id}/reactivate`, {})).json(),
 onSuccess: () => { refreshAll(); toast({ title:"Adgangen er genåbnet" }); },
 onError: (e: any) => toast({ title:"Kunne ikke genåbne", description: e.message, variant:"destructive" }),
 });

 const changePlan = useMutation({
 mutationFn: async ({ id, planId, billingCycle }: { id: number; planId: number; billingCycle: string }) =>
 (await apiRequest("POST", `/api/platform/companies/${id}/plan`, { planId, billingCycle })).json(),
 onSuccess: () => { refreshAll(); setPlanDialog(null); toast({ title:"Pakken er ændret" }); },
 onError: (e: any) => toast({ title:"Kunne ikke ændre pakken", description: e.message, variant:"destructive" }),
 });

 const savePlan = useMutation({
 mutationFn: async (vars: { id?: number; data: any }) => {
 if (vars.id != null) {
 return (await apiRequest("PATCH", `/api/platform/plans/${vars.id}`, vars.data)).json();
 }
 return (await apiRequest("POST","/api/platform/plans", vars.data)).json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/plans"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
 setEditPlanDialog(null);
 toast({ title:"Pakken er gemt" });
 },
 onError: (e: any) => toast({ title:"Kunne ikke gemme pakken", description: e.message, variant:"destructive" }),
 });

 const issueInvoice = useMutation({
 mutationFn: async (id: number) =>
 (await apiRequest("POST", `/api/platform/companies/${id}/invoice`, {})).json(),
 onSuccess: (d: any) => {
 refreshAll();
 toast({ title: `Faktura ${d.invoiceNumber} udstedt`, description: `${formatCurrency(d.totalAmount)} inkl. moms` });
 },
 onError: (e: any) => toast({ title:"Kunne ikke udstede faktura", description: e.message, variant:"destructive" }),
 });

 const markPaid = useMutation({
 mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/invoices/${id}/paid`, {})).json(),
 onSuccess: () => { refreshAll(); toast({ title:"Fakturaen er markeret betalt" }); },
 onError: (e: any) => toast({ title:"Kunne ikke markere betalt", description: e.message, variant:"destructive" }),
 });

 const sendInvoice = useMutation({
 mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/invoices/${id}/send`, {})).json(),
 onSuccess: () => { refreshAll(); toast({ title:"Fakturaen er sendt", description:"En e-mail med fakturaen er sat i kø til virksomheden." }); },
 onError: (e: any) => toast({ title:"Kunne ikke sende faktura", description: e.message, variant:"destructive" }),
 });

 const overdragInvoice = useMutation({
 mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/invoices/${id}/overdrag`, {})).json(),
 onSuccess: () => { refreshAll(); toast({ title:"Faktura overdraget", description:"Sagen er overdraget til inkasso." }); },
 onError: (e: any) => toast({ title:"Kunne ikke overdrage", description: e.message, variant:"destructive" }),
 });

 const remindInvoice = useMutation({
 mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/invoices/${id}/remind`, {})).json(),
 onSuccess: () => { refreshAll(); toast({ title:"Rykker sendt", description:"Fakturaen er markeret rykket, og en påmindelse er sat i kø." }); },
 onError: (e: any) => toast({ title:"Kunne ikke sende rykker", description: e.message, variant:"destructive" }),
 });

 if (!isPlatformAdmin) {
 return (
 <div className="p-4 md:p-4 max-w-lg mx-auto">
 <div className="rounded-md border border-border/50 bg-card p-4 text-center space-y-3" data-testid="notice-not-platform-admin">
 <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" />
 <h1 className="text-lg font-bold text-foreground">Kun for ADD SmartRegnskab-teamet</h1>
 <p className="text-sm text-muted-foreground">Denne side kræver rollen platformadministrator.</p>
 </div>
 </div>
 );
 }

 const activeRate = stats && stats.companyCount > 0 ? Math.round((stats.activeCount / stats.companyCount) * 100) : 0;
 const arrearsRate = stats && stats.companyCount > 0 ? Math.round((stats.arrearsCount / stats.companyCount) * 100) : 0;

 const filteredInvoices = (invoices ?? []).filter((inv) => {
 if (invoiceFilter ==="alle") return true;
 return inv.status === invoiceFilter;
 });

 return (
 <div className="p-4 md:p-4 space-y-5 max-w-7xl mx-auto pb-24">
 <PageHeader
 eyebrow="Platform"
 title="Virksomheder"
 description="Administrer alle tilknyttede virksomheder"
 action={
 <Button size="sm" onClick={() => { setCreatePlanId(null); setCreateOpen(true); }} data-testid="button-new-company">
 <Plus className="w-4 h-4 mr-1.5" />Opret virksomhed
 </Button>
 }
 />

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 <div data-testid="kpi-companies">
 <MetricCard
 icon={<Building2 className="w-5 h-5" />}
 value={statsLoading ?"—" : stats ? String(stats.companyCount) :"—"}
 label="Virksomheder"
 sub={stats ? `${stats.activeCount} aktive · ${stats.trialCount} på prøve` : undefined}
 variant="primary"
 progress={activeRate}
 />
 </div>
 <div data-testid="kpi-mrr">
 <MetricCard
 icon={<TrendingUp className="w-5 h-5" />}
 value={statsLoading ?"—" : stats ? formatCurrency(stats.mrr) :"—"}
 label="MRR"
 sub="ekskl. moms pr. måned"
 variant="green"
 />
 </div>
 <div data-testid="kpi-active">
 <MetricCard
 icon={<CheckCircle className="w-5 h-5" />}
 value={statsLoading ?"—" : stats ? String(stats.activeCount) :"—"}
 label="Aktive"
 sub={stats ? `af ${stats.companyCount} virksomheder` : undefined}
 variant="blue"
 progress={activeRate}
 />
 </div>
 <div data-testid="kpi-outstanding">
 <MetricCard
 icon={<AlertCircle className="w-5 h-5" />}
 value={statsLoading ?"—" : stats ? formatCurrency(stats.outstanding) :"—"}
 label="Restance"
 sub={stats ? `${stats.arrearsCount} i restance · ${stats.blockedCount} spærret` : undefined}
 variant="red"
 progress={arrearsRate}
 />
 </div>
 </div>

 {tab ==="virksomheder" && (
 <SectionCard
 title="Virksomhedsliste"
 icon={<Building2 className="w-4 h-4" />}
 className="overflow-hidden"
 noPadding
 >
 {coLoading ? (
 <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[700px]">
 <thead>
 <tr>
 <th className="">Virksomhed</th>
 <th className="">Pakke</th>
 <th className="">Status</th>
 <th className="text-right">Kunder</th>
 <th className="text-right">Værdi/md</th>
 <th className="">Periode slut</th>
 <th className="text-right">Handling</th>
 </tr>
 </thead>
 <tbody>
 {(companies ?? []).map((c) => {
 const st = CO_STATUS[c.status] ?? { label: c.status, variant:"gray" as ChipVariant };
 const blocked = c.status ==="spaerret";
 const cancelled = c.status ==="opsagt";
 return (
 <tr key={c.id} className="border-b border-border/50 last:border-0" data-testid={`row-company-${c.id}`}>
 <td className="px-4 py-3">
 <p className="font-medium text-foreground" data-testid={`text-company-name-${c.id}`}>{c.name}</p>
 <p className="text-[11px] text-muted-foreground">
 {c.cvr ? `CVR ${c.cvr} · ` :""}{c.userCount} {c.userCount === 1 ?"bruger" :"brugere"}
 </p>
 </td>
 <td className="px-4 py-3 text-muted-foreground">
 {c.planName ??"—"}
 <span className="block text-[11px]">
 {c.billingCycle ==="aarlig" ?"årlig" : c.billingCycle ==="maanedlig" ?"månedlig" :""}
 </span>
 </td>
 <td className="px-4 py-3">
 <span data-testid={`status-company-${c.id}`}>
 <StatusChip status={st.label} variant={st.variant} />
 </span>
 {c.status ==="proeve" && c.trialEndsAt && (
 <span className="block text-[11px] text-muted-foreground mt-0.5">til {dk(c.trialEndsAt)}</span>
 )}
 </td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground">{c.customerCount}</td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(c.monthlyValue)}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{dk(c.currentPeriodEnd)}</td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1 justify-end">
 <Link href={`/platform/virksomheder/${c.id}`}>
 <Button size="sm" variant="outline" title="Se virksomhed" data-testid={`button-view-company-${c.id}`}>
 <Eye className="w-4 h-4 mr-1" />Se
 </Button>
 </Link>
 <Button size="sm" variant="ghost" title="Skift pakke" data-testid={`button-change-plan-${c.id}`}
 disabled={cancelled}
 onClick={() => setPlanDialog(c)}>
 <Building2 className="w-4 h-4" />
 </Button>
 <Button size="sm" variant="ghost" title="Udsted faktura" data-testid={`button-issue-invoice-${c.id}`}
 disabled={issueInvoice.isPending || cancelled} onClick={() => issueInvoice.mutate(c.id)}>
 <Receipt className="w-4 h-4" />
 </Button>
 {blocked ? (
 <Button size="sm" variant="ghost" title="Genåbn adgang" data-testid={`button-reactivate-${c.id}`}
 disabled={reactivate.isPending} onClick={() => reactivate.mutate(c.id)}>
 <ShieldCheck className="w-4 h-4 text-emerald-600" />
 </Button>
 ) : cancelled ? (
 <Button size="sm" variant="ghost" title="Genåbn adgang" data-testid={`button-reactivate-${c.id}`}
 disabled={reactivate.isPending} onClick={() => reactivate.mutate(c.id)}>
 <ShieldCheck className="w-4 h-4 text-emerald-600" />
 </Button>
 ) : (
 <Button size="sm" variant="ghost" title="Spær adgang" data-testid={`button-suspend-${c.id}`}
 onClick={() => setSuspendDialog(c)}>
 <ShieldOff className="w-4 h-4 text-destructive" />
 </Button>
 )}
 {!cancelled && (
 <Button size="sm" variant="ghost" title="Opsig virksomhed" data-testid={`button-cancel-${c.id}`}
 onClick={() => setCancelDialog(c)}>
 <Ban className="w-4 h-4 text-destructive" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </SectionCard>
 )}

 {tab ==="fakturaer" && (
 <SectionCard
 title="Fakturaer"
 icon={<Receipt className="w-4 h-4" />}
 className="overflow-hidden"
 noPadding
 action={
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs text-muted-foreground">Status:</span>
 {([
 ["alle","Alle"],["kladde","Kladde"],["sendt","Sendt"],["betalt","Betalt"],
 ["forfalden","Forfalden"],["rykket","Rykket"],["overdraget","Overdraget"],["kreditnoteret","Kreditnota"],
 ] as const).map(([id, label]) => (
 <button key={id} onClick={() => setInvoiceFilter(id)} data-testid={`filter-invoice-${id}`}
 className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${invoiceFilter === id ?"border-primary bg-primary/10 text-foreground" :"border-border text-muted-foreground hover:text-foreground"}`}>
 {label}
 </button>
 ))}
 </div>
 }
 >
 {filteredInvoices.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground text-center" data-testid="empty-invoices">
 {invoiceFilter ==="alle"
 ?"Ingen abonnementsfakturaer udstedt endnu. Udsted en fra virksomhedslisten."
 :"Ingen fakturaer matcher det valgte filter."}
 </p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[860px]">
 <thead>
 <tr>
 <th className="">Fakturanr.</th>
 <th className="">Virksomhed</th>
 <th className="">Periode</th>
 <th className="text-right">I alt</th>
 <th className="">Forfald</th>
 <th className="">Status</th>
 <th className="text-right">Handling</th>
 </tr>
 </thead>
 <tbody>
 {filteredInvoices.map((inv) => {
 const settled = inv.status ==="betalt" || inv.status ==="kreditnoteret";
 return (
 <tr key={inv.id} className="border-b border-border/50 last:border-0" data-testid={`row-invoice-${inv.id}`}>
 <td className="px-4 py-3 font-medium text-foreground">{inv.invoiceNumber}</td>
 <td className="px-4 py-3 text-muted-foreground">{inv.companyName}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{dk(inv.periodStart)} – {dk(inv.periodEnd)}</td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground font-medium">{formatCurrency(inv.totalAmount)}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{dk(inv.dueDate)}</td>
 <td className="px-4 py-3">
 <StatusChip status={INV_STATUS[inv.status] ?? inv.status} variant={INV_VARIANT[inv.status] ??"gray"} />
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1 justify-end">
 <Button size="sm" variant="ghost" title="Åbn faktura" data-testid={`button-open-invoice-${inv.id}`}
 onClick={() => setInvoiceDetail(inv)}>
 <Eye className="w-4 h-4" />
 </Button>
 <Button size="sm" variant="ghost" title="Se PDF" data-testid={`button-invoice-pdf-${inv.id}`}
 onClick={() => openAuthedFile(`/api/platform/invoices/${inv.id}/pdf`)}>
 <FileText className="w-4 h-4" />
 </Button>
 <Button size="sm" variant="ghost" title="Hent PDF" data-testid={`button-download-invoice-pdf-${inv.id}`}
 onClick={() => openAuthedFile(`/api/platform/invoices/${inv.id}/pdf`, `${inv.invoiceNumber}.pdf`)}>
 <Download className="w-4 h-4" />
 </Button>
 {!settled && inv.status !=="sendt" && (
 <Button size="sm" variant="ghost" title="Send faktura" data-testid={`button-send-invoice-${inv.id}`}
 disabled={sendInvoice.isPending} onClick={() => sendInvoice.mutate(inv.id)}>
 <Send className="w-4 h-4" />
 </Button>
 )}
 {!settled && (
 <ReminderButton invoiceId={inv.id} />
 )}
 {!settled && inv.status ==="rykket" && (
 <Button size="sm" variant="ghost" title="Overdrag til inkasso" data-testid={`button-overdrag-invoice-${inv.id}`}
 disabled={overdragInvoice.isPending} onClick={() => overdragInvoice.mutate(inv.id)}>
 <AlertTriangle className="w-4 h-4 text-destructive" />
 </Button>
 )}
 <Button size="sm" variant="ghost" title="Opret kreditnota" data-testid={`button-credit-note-${inv.id}`}
 onClick={() => setCreditDialog(inv)}>
 <FilePlus2 className="w-4 h-4" />
 </Button>
 {!settled && (
 <Button size="sm" variant="ghost" title="Markér betalt" data-testid={`button-mark-paid-${inv.id}`}
 disabled={markPaid.isPending} onClick={() => markPaid.mutate(inv.id)}>
 <Check className="w-4 h-4 text-emerald-600" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
 Workflow: kladde → sendt → betalt · forfalden → rykket → overdraget. Når en forfalden faktura markeres betalt, ophæves en eventuel spærring af virksomheden automatisk.
 </p>
 </SectionCard>
 )}

 {tab ==="betalinger" && <PaymentsPanel />}
 {tab ==="gdpr" && <GdprPanel />}
 {tab ==="revisionsspor" && <AuditLogPanel />}
 {tab ==="drift" && <DriftPanel />}

 {tab ==="ai" && <AiModulesPanel />}

 {tab ==="pakker" && (
 <div className="space-y-3">
 <div className="flex items-center justify-between gap-2">
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" data-testid="heading-pakker">Pakker</h2>
 <Button size="sm" onClick={() => setEditPlanDialog({ mode:"create" })} data-testid="btn-create-plan">
 <Plus className="h-4 w-4 mr-1" /> Opret pakke
 </Button>
 </div>
 <PakkeGrid plans={plans ?? []} onSelect={(planId) => { setCreatePlanId(planId); setCreateOpen(true); }} onEdit={(p) => setEditPlanDialog({ mode:"edit", plan: p })} />
 </div>
 )}

 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader><DialogTitle>Opret ny virksomhed</DialogTitle></DialogHeader>
 <CreateCompanyForm plans={plans ?? []} initialPlanId={createPlanId} pending={createCompany.isPending} onSubmit={(d) => createCompany.mutate(d)} />
 </DialogContent>
 </Dialog>

 <Dialog open={!!planDialog} onOpenChange={(o) => !o && setPlanDialog(null)}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Skift pakke for {planDialog?.name}</DialogTitle></DialogHeader>
 {planDialog && (
 <PlanForm plans={plans ?? []} company={planDialog} pending={changePlan.isPending}
 onSubmit={(planId, billingCycle) => changePlan.mutate({ id: planDialog.id, planId, billingCycle })} />
 )}
 </DialogContent>
 </Dialog>

 <Dialog open={!!suspendDialog} onOpenChange={(o) => !o && setSuspendDialog(null)}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Spær {suspendDialog?.name}</DialogTitle></DialogHeader>
 <SuspendForm pending={suspend.isPending}
 onSubmit={(reason) => suspendDialog && suspend.mutate({ id: suspendDialog.id, reason })} />
 </DialogContent>
 </Dialog>

 <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Opsig {cancelDialog?.name}</DialogTitle></DialogHeader>
 {cancelDialog && (
 <CancelForm pending={cancel.isPending}
 onSubmit={(reason) => cancel.mutate({ id: cancelDialog.id, reason })} />
 )}
 </DialogContent>
 </Dialog>

 <EditPlanDialog
 key={editPlanDialog?.mode ==="edit" ? `edit-${editPlanDialog.plan.id}` : editPlanDialog?.mode ==="create" ?"create" :"closed"}
 state={editPlanDialog}
 pending={savePlan.isPending}
 onClose={() => setEditPlanDialog(null)}
 onSubmit={(data) => {
 if (editPlanDialog?.mode ==="edit") {
 savePlan.mutate({ id: editPlanDialog.plan.id, data });
 } else {
 savePlan.mutate({ data });
 }
 }}
 />

 <InvoiceDetailDialog
 invoice={invoiceDetail}
 onClose={() => setInvoiceDetail(null)}
 onSend={(id) => sendInvoice.mutate(id)}
 onRemind={(id) => remindInvoice.mutate(id)}
 onOverdrag={(id) => overdragInvoice.mutate(id)}
 onMarkPaid={(id) => markPaid.mutate(id)}
 onCreditNote={(inv) => setCreditDialog(inv)}
 openPdf={(id) => openAuthedFile(`/api/platform/invoices/${id}/pdf`)}
 />
 <CreditNoteDialog invoice={creditDialog} onClose={() => setCreditDialog(null)} />
 </div>
 );
}

function CreateCompanyForm({ plans, initialPlanId, pending, onSubmit }: { plans: Plan[]; initialPlanId: number | null; pending: boolean; onSubmit: (d: any) => void }) {
 const [f, setF] = useState({
 name:"", cvr:"", address:"", phone:"", email:"",
 adminName:"", adminEmail:"", adminPassword:"",
 planId: String(initialPlanId ?? plans[0]?.id ??""), billingCycle:"maanedlig", trialDays:"14",
 });
 const [error, setError] = useState<string | null>(null);
 const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

 const submit = (e: React.FormEvent) => {
 e.preventDefault();
 if (f.adminPassword.length < 8) return setError("Adgangskoden skal være mindst 8 tegn.");
 if (!f.planId) return setError("Vælg en pakke.");
 setError(null);
 onSubmit({
 name: f.name.trim(), cvr: f.cvr.trim() || null, address: f.address.trim() || null,
 phone: f.phone.trim() || null, email: f.email.trim() || null,
 adminName: f.adminName.trim(), adminEmail: f.adminEmail.trim().toLowerCase(),
 adminPassword: f.adminPassword, planId: Number(f.planId),
 billingCycle: f.billingCycle, trialDays: Number(f.trialDays) || 0,
 });
 };

 return (
 <form onSubmit={submit} className="space-y-3">
 <div className="space-y-1.5">
 <Label htmlFor="co-name">Virksomhedsnavn</Label>
 <Input id="co-name" required data-testid="input-company-name" value={f.name} onChange={(e) => set("name", e.target.value)} />
 </div>
 <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
 <div className="space-y-1.5 min-w-0">
 <Label htmlFor="co-cvr">CVR</Label>
 <Input id="co-cvr" data-testid="input-company-cvr" value={f.cvr} onChange={(e) => set("cvr", e.target.value)} />
 </div>
 <div className="space-y-1.5 min-w-0">
 <Label htmlFor="co-phone">Telefon</Label>
 <Input id="co-phone" data-testid="input-company-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
 </div>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="co-address">Adresse</Label>
 <Input id="co-address" data-testid="input-company-address" value={f.address} onChange={(e) => set("address", e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="co-email">Virksomhedens e-mail</Label>
 <Input id="co-email" type="email" data-testid="input-company-email" value={f.email} onChange={(e) => set("email", e.target.value)} />
 </div>

 <div className="pt-1 border-t border-border" />
 <p className="text-xs font-medium text-foreground">Administratorbruger</p>
 <div className="space-y-1.5">
 <Label htmlFor="ad-name">Navn</Label>
 <Input id="ad-name" required data-testid="input-admin-name" value={f.adminName} onChange={(e) => set("adminName", e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="ad-email">E-mail (login)</Label>
 <Input id="ad-email" type="email" required data-testid="input-admin-email" value={f.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="ad-pw">Adgangskode (min. 8 tegn)</Label>
 <Input id="ad-pw" type="password" required data-testid="input-admin-password" value={f.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
 </div>

 <div className="pt-1 border-t border-border" />
 <div className="space-y-1.5">
 <Label>Pakke</Label>
 <Select value={f.planId} onValueChange={(v) => set("planId", v)}>
 <SelectTrigger data-testid="select-company-plan"><SelectValue placeholder="Vælg pakke" /></SelectTrigger>
 <SelectContent>
 {plans.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} — {formatCurrency(p.monthlyPrice)}/md</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
 <div className="space-y-1.5 min-w-0">
 <Label>Betaling</Label>
 <Select value={f.billingCycle} onValueChange={(v) => set("billingCycle", v)}>
 <SelectTrigger data-testid="select-billing-cycle"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="maanedlig">Månedlig</SelectItem>
 <SelectItem value="aarlig">Årlig (2 md. rabat)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5 min-w-0">
 <Label htmlFor="trial">Prøvedage</Label>
 <Input id="trial" type="number" min={0} max={90} className="w-full" data-testid="input-trial-days"
 value={f.trialDays} onChange={(e) => set("trialDays", e.target.value)} />
 </div>
 </div>
 {error && <p className="text-xs text-destructive" data-testid="text-company-error">{error}</p>}
 <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-company">
 {pending ?"Opretter..." :"Opret virksomhed"}
 </Button>
 </form>
 );
}

function PlanForm({ plans, company, pending, onSubmit }: {
 plans: Plan[]; company: CompanyRow; pending: boolean;
 onSubmit: (planId: number, billingCycle: string) => void;
}) {
 const [planId, setPlanId] = useState(String(company.planId ?? plans[0]?.id ??""));
 const [cycle, setCycle] = useState(company.billingCycle ??"maanedlig");
 const selected = plans.find((p) => p.id === Number(planId));
 const tooMany = !!selected && selected.maxEmployees >= 0 && company.employeeCount > selected.maxEmployees;

 return (
 <form onSubmit={(e) => { e.preventDefault(); onSubmit(Number(planId), cycle); }} className="space-y-3">
 <div className="space-y-1.5">
 <Label>Pakke</Label>
 <Select value={planId} onValueChange={setPlanId}>
 <SelectTrigger data-testid="select-new-plan"><SelectValue /></SelectTrigger>
 <SelectContent>
 {plans.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} — {formatCurrency(p.monthlyPrice)}/md</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <Label>Betaling</Label>
 <Select value={cycle} onValueChange={setCycle}>
 <SelectTrigger data-testid="select-new-cycle"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="maanedlig">Månedlig</SelectItem>
 <SelectItem value="aarlig">Årlig</SelectItem>
 </SelectContent>
 </Select>
 </div>
 {tooMany && (
 <p className="text-xs text-destructive" data-testid="text-plan-warning">
 {company.name} har {company.employeeCount} ansatte, men {selected?.name} tillader kun {selected?.maxEmployees}. Serveren afviser skiftet.
 </p>
 )}
 <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-plan">
 {pending ?"Gemmer..." :"Gem pakke"}
 </Button>
 </form>
 );
}

function SuspendForm({ pending, onSubmit }: { pending: boolean; onSubmit: (reason: string) => void }) {
 const [reason, setReason] = useState("Manglende betaling");
 return (
 <form onSubmit={(e) => { e.preventDefault(); onSubmit(reason); }} className="space-y-3">
 <p className="text-sm text-muted-foreground">
 Alle brugere i virksomheden mister adgangen med det samme og får årsagen vist ved login.
 </p>
 <div className="space-y-1.5">
 <Label htmlFor="reason">Årsag</Label>
 <Input id="reason" required data-testid="input-suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
 </div>
 <Button type="submit" variant="destructive" className="w-full" disabled={pending} data-testid="button-confirm-suspend">
 {pending ?"Spærrer..." :"Spær adgang"}
 </Button>
 </form>
 );
}

/** Opsigelse af en kundevirksomhed med årsagsfelt. */
function CancelForm({ pending, onSubmit }: { pending: boolean; onSubmit: (reason: string) => void }) {
 const [reason, setReason] = useState("");
 return (
 <form onSubmit={(e) => { e.preventDefault(); onSubmit(reason ||"Opsagt af platform"); }} className="space-y-3">
 <p className="text-sm text-muted-foreground">
 Opsigelse markerer virksomheden som opsagt og afslutter abonnementet. Handlingen kan ikke fortrydes direkte — virksomheden kan genåbnes, men abonnementet skal oprettes igen.
 </p>
 <div className="space-y-1.5">
 <Label htmlFor="cancel-reason">Årsag</Label>
 <Input id="cancel-reason" data-testid="input-cancel-reason" placeholder="fx Opsagt pr. kundens anmodning"
 value={reason} onChange={(e) => setReason(e.target.value)} />
 </div>
 <Button type="submit" variant="destructive" className="w-full" disabled={pending} data-testid="button-confirm-cancel">
 {pending ?"Opsiger..." :"Opsig virksomhed"}
 </Button>
 </form>
 );
}

/** Inline-knap der sender en rykker for en ubetalt faktura. */
function ReminderButton({ invoiceId }: { invoiceId: number }) {
 const { toast } = useToast();
 const remind = useMutation({
 mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/invoices/${id}/remind`, {})).json(),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
 toast({ title:"Rykker sendt", description:"Fakturaen er markeret forfalden, og en påmindelse er sat i kø." });
 },
 onError: (e: any) => toast({ title:"Kunne ikke sende rykker", description: e.message, variant:"destructive" }),
 });
 return (
 <Button size="sm" variant="ghost" title="Send rykker" data-testid={`button-remind-${invoiceId}`}
 disabled={remind.isPending} onClick={() => remind.mutate(invoiceId)}>
 {remind.isPending && remind.variables === invoiceId
 ? <RefreshCw className="w-4 h-4 animate-spin" />
 : <Bell className="w-4 h-4" />}
 </Button>
 );
}

/** Betalingsoversigt: udbydere, seneste betalinger og manuelle rykker-/forny-knapper. */
const PROVIDER_CARDS: { id: string; label: string; desc: string }[] = [
  { id: "mobilepay", label: "MobilePay", desc: "Mobilbetaling og subscription-træk via MobilePay." },
  { id: "nets", label: "Nets Betalingsservice", desc: "Automatisk Betalingsservice-træk (BS) for abonnementer." },
  { id: "stripe", label: "Stripe (kortbetalinger)", desc: "Kortbetaling og gemte kort til løbende træk." },
  { id: "leverandorservice", label: "Leverandørservice", desc: "Filing af fakturaer til Leverandørservice (FI/OCR)." },
  { id: "betalingsservice", label: "Betalingsservice", desc: "Tilmelding og håndtering af Betalingsservice-aftaler." },
];

function PaymentsPanel() {
 const { toast } = useToast();
 const { data, isLoading } = useQuery<PaymentsResponse>({ queryKey: ["/api/platform/payments"] });

 const dunning = useMutation({
 mutationFn: async () => (await apiRequest("POST","/api/platform/payments/dunning", {})).json(),
 onSuccess: (r: { stage1: number; stage2: number; stage3: number; charged: number; failed: number }) => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/payments"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
 toast({ title:"Rykkerforløb kørt", description: `Trin 1: ${r.stage1} · trin 2: ${r.stage2} · trin 3: ${r.stage3} · trukket: ${r.charged} · fejlet: ${r.failed}` });
 },
 onError: (e: Error) => toast({ title:"Rykkerforløb fejlede", description: e.message, variant:"destructive" }),
 });

 const renew = useMutation({
 mutationFn: async () => (await apiRequest("POST","/api/platform/payments/renew", {})).json(),
 onSuccess: (r: { issued: number; charged: number; failed: number; skippedTrial: number }) => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/payments"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
 toast({ title:"Abonnementer fornyet", description: `Udstedt: ${r.issued} · trukket: ${r.charged} · fejlet: ${r.failed} · sprang prøve over: ${r.skippedTrial}` });
 },
 onError: (e: Error) => toast({ title:"Fornyelse fejlede", description: e.message, variant:"destructive" }),
 });

 // Mock-tilstand for forbindelse og auto-opsætning pr. udbyder. Seeded fra bagvedliggende konfiguration.
 const backendProviders = data?.providers ?? [];
 const initialConnected: Record<string, boolean> = {};
 const initialAuto: Record<string, boolean> = {};
 for (const c of PROVIDER_CARDS) {
 const match = backendProviders.find((p) => p.id === c.id);
 initialConnected[c.id] = match?.configured ?? false;
 initialAuto[c.id] = match?.configured ?? false;
 }
 const [connected, setConnected] = useState<Record<string, boolean>>(initialConnected);
 const [autoSetup, setAutoSetup] = useState<Record<string, boolean>>(initialAuto);
 const [pendingId, setPendingId] = useState<string | null>(null);

 const toggleConnect = (id: string) => {
 setPendingId(id);
 // Mock: simuler en asynkron forbindelsesrække.
 setTimeout(() => {
 setConnected((prev) => {
 const next = !prev[id];
 toast({ title: next ? "Udbyder forbundet" : "Udbyder afbundet", description: `${PROVIDER_CARDS.find((c) => c.id === id)?.label} er nu ${next ? "aktiv" : "afbrudt"} (simuleret).` });
 return { ...prev, [id]: next };
 });
 setAutoSetup((prev) => ({ ...prev, [id]: connected[id] ? false : prev[id] }));
 setPendingId(null);
 }, 500);
 };

 const toggleAuto = (id: string) => {
 if (!connected[id]) {
 toast({ title: "Forbind først udbyderen", description: "Auto-opsætning kræver en aktiv forbindelse.", variant: "destructive" });
 return;
 }
 setAutoSetup((prev) => {
 const next = !prev[id];
 toast({ title: next ? "Auto-opsætning aktiveret" : "Auto-opsætning deaktiveret", description: `${PROVIDER_CARDS.find((c) => c.id === id)?.label}: ${next ? "nye virksomheder opsættes automatisk" : "manuel opsætning"}.` });
 return { ...prev, [id]: next };
 });
 };

 if (isLoading) {
 return <div className="rounded-md border border-border/50 bg-card p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
 }

 const payments = data?.payments ?? [];
 const connectedCount = PROVIDER_CARDS.filter((c) => connected[c.id]).length;

 return (
 <div className="space-y-3" data-testid="panel-payments">
 <SectionCard title="Betalingsudbydere" icon={<CreditCard className="w-4 h-4" />}
 action={<span className="text-xs text-muted-foreground">{connectedCount} / {PROVIDER_CARDS.length} forbundet</span>}
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {PROVIDER_CARDS.map((c) => {
 const on = connected[c.id];
 const auto = autoSetup[c.id];
 const busy = pendingId === c.id;
 return (
 <div key={c.id} data-testid={`row-provider-${c.id}`}
 className={`rounded-md border p-3 space-y-2 ${on ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0">
 <p className="text-sm font-medium text-foreground">{c.label}</p>
 <p className="text-[11px] text-muted-foreground mt-0.5">{c.desc}</p>
 </div>
 <span className="shrink-0" data-testid={`status-provider-${c.id}`}>
 <StatusChip status={on ? "Forbundet" : "Ikke forbundet"} variant={on ? "green" : "gray"} />
 </span>
 </div>
 <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
 <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" data-testid={`label-auto-${c.id}`}>
 <Switch checked={auto} onCheckedChange={() => toggleAuto(c.id)} data-testid={`switch-auto-${c.id}`} disabled={!on} />
 Auto-opsætning
 </label>
 <Button size="sm" variant={on ? "outline" : "default"} data-testid={`button-toggle-provider-${c.id}`}
 disabled={busy} onClick={() => toggleConnect(c.id)}>
 {busy ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : on ? <CloudOff className="w-3.5 h-3.5 mr-1" /> : <Cloud className="w-3.5 h-3.5 mr-1" />}
 {busy ? "Vent..." : on ? "Afbind" : "Forbind"}
 </Button>
 </div>
 </div>
 );
 })}
 </div>
 <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
 Forbindelsen simuleres — der kræves ingen rigtige API-nøgler i denne opsætning. Rykkerforløbet kan stadig køres manuelt.
 </p>
 </SectionCard>

 <SectionCard title="Manuelle kørsler" icon={<RefreshCw className="w-4 h-4" />}>
 <p className="text-xs text-muted-foreground">
 Kør rykkerforløbet for forfaldne fakturaer eller forny abonnementer, hvis den automatiske tidsplan ikke har nået det.
 </p>
 <div className="flex flex-col gap-2">
 <Button size="sm" variant="outline" data-testid="button-run-dunning"
 disabled={dunning.isPending} onClick={() => dunning.mutate()}>
 {dunning.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Bell className="w-4 h-4 mr-1.5" />}
 {dunning.isPending ?"Kører..." :"Kør rykkerforløb"}
 </Button>
 <Button size="sm" variant="outline" data-testid="button-run-renew"
 disabled={renew.isPending} onClick={() => renew.mutate()}>
 {renew.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Receipt className="w-4 h-4 mr-1.5" />}
 {renew.isPending ?"Fornyer..." :"Forny abonnementer"}
 </Button>
 </div>
 </SectionCard>

 <SectionCard title="Seneste betalinger" icon={<CreditCard className="w-4 h-4" />} className="overflow-hidden" noPadding>
 {payments.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-payments">Ingen betalinger registreret endnu.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[760px]">
 <thead>
 <tr>
 <th className="">Dato</th>
 <th className="">Virksomhed</th>
 <th className="">Udbyder</th>
 <th className="text-right">Beløb</th>
 <th className="">Forsøg</th>
 <th className="">Status</th>
 <th className="">Fejl</th>
 </tr>
 </thead>
 <tbody>
 {payments.map((p) => {
 const st = PAY_STATUS[p.status] ?? { label: p.status, variant:"gray" as ChipVariant };
 return (
 <tr key={p.id} className="border-b border-border/50 last:border-0" data-testid={`row-payment-${p.id}`}>
 <td className="px-4 py-2.5 text-xs whitespace-nowrap">{dk(p.createdAt)}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">#{p.companyId}</td>
 <td className="px-4 py-2.5 text-xs font-mono">{p.provider}</td>
 <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(p.amount)}</td>
 <td className="px-4 py-2.5 text-right tabular-nums">{p.attempt}</td>
 <td className="px-4 py-2.5">
 <StatusChip status={st.label} variant={st.variant} />
 </td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[220px] truncate" title={p.failureReason ??""}>
 {p.failureReason ??"—"}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </SectionCard>
 </div>
 );
}

/** Platform-GDPR: behandlingsregister, opbevaringspolitik, datarettigheder og databehandling pr. virksomhed.
 *  Platformen håndterer kun GDPR for de data den selv behandler — DPA hører til virksomhederne. */
const PROCESSING_REGISTER: { aktivitet: string; formaal: string; grundlag: string; opbevaring: string }[] = [
 { aktivitet: "Virksomheds- og abonnementsdata", formaal: "Drift af platform og fakturering", grundlag: "Aftale", opbevaring: "Så længe abonnementet varer + 5 år (bogf.)" },
 { aktivitet: "Brugerkonti (login)", formaal: "Adgangsstyring og revisionsspor", grundlag: "Aftale", opbevaring: "Indtil konto slettes" },
 { aktivitet: "Fakturaer og betalinger", formaal: "Bogføring og rykkerhåndtering", grundlag: "Lovkrav (bogføringsloven)", opbevaring: "5 år" },
 { aktivitet: "Audit-logs", formaal: "Sikkerhed og revision", grundlag: "Berettiget interesse", opbevaring: "2 år" },
 { aktivitet: "Sikkerhedskopier", formaal: "Genoprettelse efter data-tab", grundlag: "Berettiget interesse", opbevaring: "30 dage" },
];

function GdprPanel() {
 const { data, isLoading } = useQuery<GdprResponse>({ queryKey: ["/api/platform/gdpr"] });
 const { toast } = useToast();

 const exportData = useMutation({
 mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/companies/${id}/export-data`, {})).json(),
 onSuccess: (result, id) => {
 const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `dataeksport-virksomhed-${id}.json`;
 a.click();
 URL.revokeObjectURL(url);
 toast({ title: "Data eksporteret", description: "Virksomhedens data er downloadet som JSON." });
 },
 onError: (e: Error) => toast({ title: "Eksport fejlede", description: e.message, variant: "destructive" }),
 });

 const deleteData = useMutation({
 mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/platform/companies/${id}/data`, {})).json(),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/gdpr"] });
 toast({ title: "Data markeret til sletning", description: "Sletningen udføres permanent af GDPR-oprydningsjobbet." });
 },
 onError: (e: Error) => toast({ title: "Sletning fejlede", description: e.message, variant: "destructive" }),
 });

 if (isLoading) {
 return <div className="rounded-md border border-border/50 bg-card p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
 }

 const g = data;
 const companies = g?.companies ?? [];
 const totalPersons = companies.reduce((sum, c) => sum + c.userCount + c.employeeCount + c.customerCount, 0);
 const cancelledCount = companies.filter((c) => c.status === "opsagt").length;
 const defaults = g?.retentionDefaults;
 const retentionEntries = defaults
 ? [
 { label: RETENTION_LABELS.gps, maaneder: defaults.gps.maaneder, begrundelse: defaults.gps.begrundelse },
 { label: RETENTION_LABELS.tidsregistreringer, maaneder: defaults.tidsregistreringer.maaneder, begrundelse: defaults.tidsregistreringer.begrundelse },
 { label: RETENTION_LABELS.fravaer, maaneder: defaults.fravaer.maaneder, begrundelse: defaults.fravaer.begrundelse },
 { label: RETENTION_LABELS.fotos, maaneder: defaults.fotos.maaneder, begrundelse: defaults.fotos.begrundelse },
 ]
 : [];

 return (
 <div className="space-y-3" data-testid="panel-gdpr">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <div data-testid="card-gdpr-companies">
 <MetricCard icon={<Building2 className="w-5 h-5" />} value={g?.companyCount ?? "—"} label="Kundevirksomheder" variant="primary" />
 </div>
 <div data-testid="card-gdpr-persons">
 <MetricCard icon={<Database className="w-5 h-5" />} value={totalPersons} label="Registrerede personer" sub="Brugere + ansatte + kunder" variant="blue" />
 </div>
 <div data-testid="card-gdpr-cancelled">
 <MetricCard icon={<AlertTriangle className="w-5 h-5" />} value={cancelledCount} label="Opsagde virksomheder" sub="Klar til datasletning" variant="amber" />
 </div>
 <div data-testid="card-gdpr-retention">
 <MetricCard icon={<Lock className="w-5 h-5" />} value={retentionEntries.length} label="Opbevaringskategorier" sub="Platform standarder" variant="green" />
 </div>
 </div>

 <SectionCard title="Behandlingsregister" icon={<Database className="w-4 h-4" />} className="overflow-hidden" noPadding>
 <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
 Oversigt over de behandlingsaktiviteter, platformen selv udfører. DPA (databehandleraftale) indgås af den enkelte virksomhed.
 </p>
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[760px]">
 <thead>
 <tr>
 <th className="">Behandlingsaktivitet</th>
 <th className="">Formål</th>
 <th className="">Retsgrundlag</th>
 <th className="">Opbevaring</th>
 </tr>
 </thead>
 <tbody>
 {PROCESSING_REGISTER.map((r) => (
 <tr key={r.aktivitet} className="border-b border-border/50 last:border-0" data-testid={`row-processing-${r.aktivitet}`}>
 <td className="px-4 py-2.5 font-medium text-foreground">{r.aktivitet}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.formaal}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.grundlag}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.opbevaring}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </SectionCard>

 <SectionCard title="Opbevaringspolitik" icon={<ShieldCheck className="w-4 h-4" />} className="overflow-hidden" noPadding>
 {retentionEntries.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-retention">Ingen opbevaringspolitik defineret.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[560px]">
 <thead>
 <tr>
 <th className="">Datakategori</th>
 <th className="text-right">Måneder</th>
 <th className="">Begrundelse</th>
 </tr>
 </thead>
 <tbody>
 {retentionEntries.map((r) => (
 <tr key={r.label} className="border-b border-border/50 last:border-0" data-testid={`row-retention-${r.label}`}>
 <td className="px-4 py-2.5 font-medium text-foreground">{r.label}</td>
 <td className="px-4 py-2.5 text-right tabular-nums">{r.maaneder === 0 ? "Gem for altid" : r.maaneder}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.begrundelse}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </SectionCard>

 <SectionCard title="Datarettigheder & samtykker" icon={<ShieldCheck className="w-4 h-4" />}>
 <p className="text-xs text-muted-foreground leading-relaxed">
 Platformen understøtter de registreredes rettigheder: <span className="font-medium text-foreground">indsigt</span>, <span className="font-medium text-foreground">sletning</span> og <span className="font-medium text-foreground">dataportabilitet</span>.
 Samtykker (fx GPS og fotodokumentation) indhentes og forvaltes af den enkelte virksomhed — platformen stiller værktøjerne til rådighed.
 Nedenfor kan data eksporteres eller slettes pr. virksomhed.
 </p>
 </SectionCard>

 <SectionCard title="Databehandling pr. virksomhed" icon={<Database className="w-4 h-4" />} className="overflow-hidden" noPadding>
 {companies.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-gdpr-companies">Ingen kundevirksomheder fundet.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[760px]">
 <thead>
 <tr>
 <th className="">Virksomhed</th>
 <th className="">Pakke</th>
 <th className="">Status</th>
 <th className="text-right">Brugere</th>
 <th className="text-right">Ansatte</th>
 <th className="text-right">Kunder</th>
 <th className="text-right">Handling</th>
 </tr>
 </thead>
 <tbody>
 {companies.map((c) => (
 <tr key={c.id} className="border-b border-border/50 last:border-0" data-testid={`row-gdpr-company-${c.id}`}>
 <td className="px-4 py-3">
 <p className="font-medium text-foreground">{c.name}</p>
 <p className="text-xs text-muted-foreground">CVR: {c.cvr ?? "—"}</p>
 </td>
 <td className="px-4 py-3 text-muted-foreground">{c.planName}</td>
 <td className="px-4 py-3">
 <StatusChip status={CO_STATUS[c.status]?.label ?? c.status} variant={CO_STATUS[c.status]?.variant ?? "gray"} />
 </td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground">{c.userCount}</td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground">{c.employeeCount}</td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground">{c.customerCount}</td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-1">
 <Button size="sm" variant="ghost" title="Eksporter virksomhedens data" data-testid={`button-export-data-${c.id}`}
 disabled={exportData.isPending} onClick={() => exportData.mutate(c.id)}>
 <Download className="w-4 h-4" />
 </Button>
 {c.status === "opsagt" && (
 <Button size="sm" variant="ghost" title="Slet virksomhedens data" data-testid={`button-delete-data-${c.id}`}
 disabled={deleteData.isPending} onClick={() => deleteData.mutate(c.id)}
 className="text-destructive hover:text-destructive">
 <Trash2 className="w-4 h-4" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
 Platformen håndterer GDPR for de data den selv behandler (behandlingsregister, opbevaring, dataeksport og -sletning). DPA og virksomhedens egne kunde-/ansattedata håndteres af virksomheden selv.
 </p>
 </SectionCard>
 </div>
 );
}

/** Revisionsspor over platform- og virksomhedshandlinger med scope-filter. */
function AuditLogPanel() {
 const { data, isLoading } = useQuery<AuditLogRow[]>({ queryKey: ["/api/platform/audit-logs"] });
 const [scope, setScope] = useState<"platform" | "company" | "employee" | "alle">("platform");

 if (isLoading) {
 return <div className="rounded-md border border-border/50 bg-card p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
 }

 const all = data ?? [];
 const logs = all.filter((l) => {
 if (scope === "alle") return true;
 if (scope === "platform") return l.companyId == null;
 if (scope === "company") return l.companyId != null && (l.target ?? "").toLowerCase() !== "employee";
 if (scope === "employee") return (l.target ?? "").toLowerCase() === "employee" || /ansat|employee/i.test(l.action);
 return true;
 });

 return (
 <SectionCard title="Seneste hændelser" icon={<ScrollText className="w-4 h-4" />} className="overflow-hidden" noPadding
 action={
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs text-muted-foreground">Scope:</span>
 {([["platform","Platform"],["company","Virksomhed"],["employee","Ansat"],["alle","Alle"]] as const).map(([id, label]) => (
 <button key={id} onClick={() => setScope(id)} data-testid={`filter-audit-${id}`}
 className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${scope === id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
 {label}
 </button>
 ))}
 </div>
 }
 >
 <div data-testid="panel-audit-logs">
 {logs.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-audit-logs">Ingen hændelser for det valgte scope.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[820px]">
 <thead>
 <tr>
 <th className="">Tidspunkt</th>
 <th className="">Bruger</th>
 <th className="">Handling</th>
 <th className="">Mål</th>
 <th className="">Virksomhed</th>
 <th className="">Detalje</th>
 </tr>
 </thead>
 <tbody>
 {logs.map((l) => (
 <tr key={l.id} className="border-b border-border/50 last:border-0" data-testid={`row-audit-${l.id}`}>
 <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{dk(l.createdAt)}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.userEmail ?? "System"}</td>
 <td className="px-4 py-2.5 text-xs font-medium text-foreground">{l.action}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.target ?? "—"}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.companyName}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[280px] truncate" title={l.detail ?? ""}>{l.detail ?? "—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
 Viser {logs.length} af {all.length} hændelser — scope: {scope}. Som standard vises kun platform-relevante hændelser.
 </p>
 </div>
 </SectionCard>
 );
}


type JobDefinition = { id: string; label: string; everyMinutes: number };
type JobRunRow = { id: number; job: string; status: string; affected: number; detail: string | null; startedAt: string; finishedAt: string | null };

function intervalTekst(minutter: number): string {
 if (minutter % 1440 === 0) {
 const dage = minutter / 1440;
 return dage === 1 ?"Hver dag" : `Hver ${dage}. dag`;
 }
 if (minutter % 60 === 0) {
 const timer = minutter / 60;
 return timer === 1 ?"Hver time" : `Hver ${timer}. time`;
 }
 return `Hvert ${minutter}. minut`;
}

function tidspunkt(iso: string | null): string {
 if (!iso) return"—";
 const d = new Date(iso);
 return Number.isNaN(d.getTime()) ?"—" : d.toLocaleString("da-DK", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

/** Driftsoversigt over de automatiske job med mulighed for at starte et job manuelt. */
function DriftPanel() {
 const { toast } = useToast();
 const { data, isLoading } = useQuery<{ jobs: JobDefinition[]; runs: JobRunRow[] }>({ queryKey: ["/api/platform/jobs"] });

 const run = useMutation({
 mutationFn: async (job: string) => (await apiRequest("POST", `/api/platform/jobs/${job}`, {})).json(),
 onSuccess: (result: { affected?: number; detail?: string | null }, job) => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/jobs"] });
 toast({ title:"Jobbet er kørt", description: result?.detail || `${job}: ${result?.affected ?? 0} poster behandlet.` });
 },
 onError: (e: Error) => toast({ title:"Jobbet fejlede", description: e.message, variant:"destructive" }),
 });

 if (isLoading) {
 return <div className="rounded-md border border-border/50 bg-card p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
 }

 const jobs = data?.jobs ?? [];
 const runs = data?.runs ?? [];
 const sidste = (job: string) => runs.find((r) => r.job === job);

 return (
 <div className="space-y-3" data-testid="panel-platform-jobs">
 <p className="text-sm text-muted-foreground">
 Jobbene kører i samme proces som webserveren. Starter du et job manuelt, ændrer det ikke den normale tidsplan.
 </p>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {jobs.map((job) => {
 const seneste = sidste(job.id);
 const fejlet = seneste?.status ==="fejlet";
 return (
 <div key={job.id} data-testid={`card-job-${job.id}`}>
 <SectionCard
 title={job.label}
 icon={<Play className="w-4 h-4" />}
 action={
 <Button size="sm" variant="outline" className="shrink-0" data-testid={`button-run-job-${job.id}`}
 disabled={run.isPending} onClick={() => run.mutate(job.id)}>
 {run.isPending && run.variables === job.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
 <span className="ml-1.5">Kør nu</span>
 </Button>
 }
 >
 <p className="text-xs text-muted-foreground">{intervalTekst(job.everyMinutes)} · <span className="font-mono">{job.id}</span></p>
 <div className="flex items-center gap-2 text-xs">
 {fejlet
 ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="w-3.5 h-3.5" />Seneste kørsel fejlede</span>
 : <span className="text-muted-foreground">Seneste kørsel: {tidspunkt(seneste?.startedAt ?? null)}</span>}
 {seneste && !fejlet && <span className="text-muted-foreground">· {seneste.affected} poster</span>}
 </div>
 </SectionCard>
 </div>
 );
 })}
 </div>

 <SectionCard title="Seneste kørsler" icon={<RefreshCw className="w-4 h-4" />} className="overflow-hidden" noPadding>
 {runs.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-job-runs">Der er endnu ingen registrerede kørsler.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[500px]">
 <thead>
 <tr>
 <th className="">Job</th>
 <th className="">Startet</th>
 <th className="">Status</th>
 <th className="text-right">Poster</th>
 <th className="">Detalje</th>
 </tr>
 </thead>
 <tbody>
 {runs.map((r) => (
 <tr key={r.id} className="border-b border-border/50" data-testid={`row-job-run-${r.id}`}>
 <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{r.job}</td>
 <td className="px-4 py-2.5 text-xs whitespace-nowrap">{tidspunkt(r.startedAt)}</td>
 <td className="px-4 py-2.5">
 <StatusChip status={r.status ==="fejlet" ?"Fejlet" :"Kørt"} variant={r.status ==="fejlet" ?"red" :"green"} />
 </td>
 <td className="px-4 py-2.5 text-right tabular-nums">{r.affected}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.detail ||"—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </SectionCard>
 </div>
 );
}

/**
 * AI-modul oversigt — tilkøbsbare AI-funktioner pr. virksomhed
 */
const AI_MODULES = [
 { id:"ai_assistant", label:"AI-assistent", desc:"Global chat-assistent der hjælper med drift, planlægning og kundehåndtering.", price:"99 kr./md" },
 { id:"ai_scoring", label:"AI lead-scoring", desc:"Automatisk vurdering af kunder/leads baseret på aktivitet, historik og værdi.", price:"149 kr./md" },
 { id:"ai_planning", label:"AI auto-planlægning", desc:"Intelligent vagtplanlægning og ruteoptimering baseret på opgaver og ansatte.", price:"199 kr./md" },
];

function AiModulesPanel() {
 const { toast } = useToast();
 const { data: companies } = useQuery<{ companies: any[] }>({ queryKey: ["/api/platform/companies"] });
 const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
 const [enabledModules, setEnabledModules] = useState<Record<string, string[]>>({});

 const toggleModule = (companyId: number, moduleId: string) => {
 setEnabledModules((prev) => {
 const current = prev[companyId] || [];
 const next = current.includes(moduleId)
 ? current.filter((m) => m !== moduleId)
 : [...current, moduleId];
 return { ...prev, [companyId]: next };
 });
 toast({ title: moduleId.includes("ai_") ? "AI-modul opdateret" : "Modul opdateret", description: "Ændringen er gemt." });
 };

 return (
 <div className="space-y-3" data-testid="panel-platform-ai">
 <p className="text-sm text-muted-foreground">
 AI-tilægget er ét samlet modul med alle AI-funktioner. Prisen tillægges den månedlige abonnementspris.
 </p>

 <SectionCard title="AI-tilæg" icon={<Sparkles className="w-4 h-4" />} className="overflow-hidden" noPadding>
 <div className="p-4 space-y-3">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-foreground">Komplet AI-pakke</span>
 <span className="text-[11px] text-primary font-medium">199 kr./md</span>
 </div>
 <div className="divide-y divide-border/50">
 {AI_MODULES.map((mod) => (
 <div key={mod.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0" data-testid={`row-ai-module-${mod.id}`}>
 <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
 <div className="flex-1 min-w-0">
 <span className="text-sm font-medium text-foreground">{mod.label}</span>
 <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </SectionCard>

 <SectionCard title="Tilkøb pr. virksomhed" icon={<Building2 className="w-4 h-4" />} className="overflow-hidden" noPadding>
 {(companies?.companies ?? []).length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-ai-companies">Ingen virksomheder fundet.</p>
 ) : (
 <div className="divide-y divide-border/50">
 {(companies?.companies ?? []).map((c: any) => (
 <div key={c.id} className="p-4 flex items-center justify-between" data-testid={`row-ai-company-${c.id}`}>
 <div className="min-w-0">
 <span className="text-sm font-medium text-foreground">{c.name}</span>
 <span className="text-[11px] text-muted-foreground ml-2">{c.planName || "Ingen pakke"}</span>
 </div>
 <button
 data-testid={`button-ai-toggle-${c.id}`}
 onClick={() => toggleModule(c.id, "ai_pack")}
 className={`text-[11px] px-2.5 py-1 rounded transition-colors ${(enabledModules[c.id] || []).includes("ai_pack") ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
 >
 {(enabledModules[c.id] || []).includes("ai_pack") ? "Aktiv" : "Tilføj"}
 </button>
 </div>
 ))}
 </div>
 )}
 </SectionCard>
 </div>
 );
}

/**
 * Dialog til oprettelse (POST) og redigering (PATCH) af en pakke.
 * `state` bestemmer om der oprettes ny pakke eller redigeres en eksisterende.
 */

/** Pakkeoversigt med funktionstabel (checkmarks/x), anbefalet pakke og "Vælg pakke"-knap. */
function PakkeGrid({ plans, onSelect, onEdit }: { plans: Plan[]; onSelect: (planId: number) => void; onEdit: (p: Plan) => void }) {
 const active = plans.filter((p) => p.active);
 const sortedByPrice = [...active].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
 const proPlan = active.find((p) => p.slug === "pro");
 const recommended = proPlan ?? sortedByPrice[Math.floor(sortedByPrice.length / 2)] ?? active[0];
 const cols = plans.length <= 4 ? plans.length : 4;
 return (
 <div className={`grid gap-3 grid-cols-1 md:grid-cols-${Math.min(Math.max(cols, 2), 4)}`}>
 {plans.map((p) => {
 const feats = parseFeatures(p.features);
 const isRec = recommended?.id === p.id;
 return (
 <div key={p.id} data-testid={`card-plan-admin-${p.slug}`}
 className={`rounded-lg border bg-card ${isRec ? "border-primary ring-1 ring-primary/40" : "border-border"}`}>
 <div className="p-4 space-y-3">
 <div className="flex items-start justify-between gap-2">
 <div>
 <h3 className="font-semibold text-foreground text-base flex items-center gap-1.5">
 {p.name}
 {isRec && <span data-testid={`badge-recommended-${p.slug}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium"><Star className="w-3 h-3" />Anbefalet</span>}
 </h3>
 <p className="text-[11px] text-muted-foreground mt-0.5">{p.active ? "Synlig for nye virksomheder" : "Skjult"}</p>
 </div>
 <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onEdit(p)} data-testid={`btn-edit-plan-${p.slug}`}>
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 </div>
 <div className="flex items-baseline justify-between gap-2">
 <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(p.monthlyPrice)}<span className="text-xs font-normal text-muted-foreground"> /md</span></p>
 <StatusChip status={p.active ?"Aktiv" :"Skjult"} variant={p.active ?"green" :"gray"} />
 </div>
 <p className="text-xs text-muted-foreground" data-testid={`plan-price-employee-${p.slug}`}>
 + {formatCurrency(p.pricePerEmployee)} pr. ansat · Loft: {p.maxEmployees < 0 ?"ubegrænset" : p.maxEmployees} ansatte, {p.maxCustomers < 0 ?"ubegrænset" : p.maxCustomers} kunder
 </p>
 <div className="pt-2 border-t border-border" data-testid={`block-features-${p.slug}`}>
 <p className="text-xs text-muted-foreground mb-2">Funktioner</p>
 <ul className="space-y-1">
 {AVAILABLE_FEATURES.map((f) => {
 const has = feats.includes(f);
 return (
 <li key={f} className="flex items-center gap-2 text-xs" data-testid={`row-feature-${p.slug}-${f}`}>
 {has ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
 <span className={has ?"text-foreground" :"text-muted-foreground/60"}>{FEATURE_LABELS[f] ?? f}</span>
 </li>
 );
 })}
 </ul>
 </div>
 <Button size="sm" className="w-full" variant={isRec ?"default" :"outline"} data-testid={`btn-select-plan-${p.slug}`}
 onClick={() => onSelect(p.id)}>
 Vælg pakke
 </Button>
 </div>
 </div>
 );
 })}
 </div>
 );
}
function EditPlanDialog({
 state, pending, onClose, onSubmit,
}: {
 state: { mode:"create" } | { mode:"edit"; plan: Plan } | null;
 pending: boolean;
 onClose: () => void;
 onSubmit: (data: any) => void;
}) {
 const editing = state?.mode ==="edit" ? state.plan : null;
 const initial = editing
 ? {
 name: editing.name,
 slug: editing.slug,
 monthlyPrice: String(editing.monthlyPrice),
 pricePerEmployee: String(editing.pricePerEmployee),
 maxEmployees: String(editing.maxEmployees),
 maxCustomers: String(editing.maxCustomers),
 features: parseFeatures(editing.features),
 active: editing.active === 1,
 }
 : {
 name:"", slug:"", monthlyPrice:"0", pricePerEmployee:"0",
 maxEmployees:"-1", maxCustomers:"-1", features: [] as string[], active: true,
 };

 const [name, setName] = useState(initial.name);
 const [slug, setSlug] = useState(initial.slug);
 const [monthlyPrice, setMonthlyPrice] = useState(initial.monthlyPrice);
 const [pricePerEmployee, setPricePerEmployee] = useState(initial.pricePerEmployee);
 const [maxEmployees, setMaxEmployees] = useState(initial.maxEmployees);
 const [maxCustomers, setMaxCustomers] = useState(initial.maxCustomers);
 const [features, setFeatures] = useState<string[]>(initial.features);
 const [active, setActive] = useState(initial.active);
 const [error, setError] = useState<string | null>(null);

 const toggleFeature = (f: string) => {
 setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
 };

 const submit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!name.trim()) return setError("Angiv et navn på pakken.");
 if (!slug.trim()) return setError("Angiv en slug (fx basis, pro).");
 setError(null);
 onSubmit({
 name: name.trim(),
 slug: slug.trim().toLowerCase(),
 monthlyPrice: Number(monthlyPrice) || 0,
 pricePerEmployee: Number(pricePerEmployee) || 0,
 maxEmployees: Number(maxEmployees),
 maxCustomers: Number(maxCustomers),
 features: JSON.stringify(features),
 active,
 });
 };

 return (
 <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{editing ?"Rediger pakke" :"Opret pakke"}</DialogTitle>
 </DialogHeader>
 <form onSubmit={submit} className="space-y-3">
 <div className="space-y-1.5">
 <Label htmlFor="plan-name">Navn</Label>
 <Input id="plan-name" data-testid="input-plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="fx Basis, Pro, Erhverv" />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="plan-slug">Slug</Label>
 <Input id="plan-slug" data-testid="input-plan-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="fx basis, pro, erhverv" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label htmlFor="plan-monthly">Pris pr. måned (DKK)</Label>
 <Input id="plan-monthly" type="number" min="0" step="0.01" data-testid="input-plan-monthly" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="plan-per-employee">Pris pr. ansat (DKK)</Label>
 <Input id="plan-per-employee" type="number" min="0" step="0.01" data-testid="input-plan-per-employee" value={pricePerEmployee} onChange={(e) => setPricePerEmployee(e.target.value)} />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label htmlFor="plan-max-employees">Maks ansatte (-1 = ubegrænset)</Label>
 <Input id="plan-max-employees" type="number" data-testid="input-plan-max-employees" value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="plan-max-customers">Maks kunder (-1 = ubegrænset)</Label>
 <Input id="plan-max-customers" type="number" data-testid="input-plan-max-customers" value={maxCustomers} onChange={(e) => setMaxCustomers(e.target.value)} />
 </div>
 </div>
 <div className="space-y-1.5">
 <Label>Funktioner</Label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/30" data-testid="block-plan-features">
 {AVAILABLE_FEATURES.map((f) => (
 <label key={f} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`label-feature-${f}`}>
 <Checkbox
 checked={features.includes(f)}
 onCheckedChange={() => toggleFeature(f)}
 data-testid={`checkbox-feature-${f}`}
 />
 <span className="text-foreground">{FEATURE_LABELS[f] ?? f}</span>
 </label>
 ))}
 </div>
 </div>
 <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
 <div className="space-y-0.5">
 <Label htmlFor="plan-active" className="cursor-pointer">Aktiv</Label>
 <p className="text-xs text-muted-foreground">Inaktive pakker skjules for nye virksomheder.</p>
 </div>
 <Switch id="plan-active" checked={active} onCheckedChange={setActive} data-testid="switch-plan-active" />
 </div>
 {error && <p className="text-sm text-destructive" data-testid="error-plan-form">{error}</p>}
 <div className="flex justify-end gap-2 pt-1">
 <Button type="button" variant="outline" onClick={onClose} disabled={pending} data-testid="btn-plan-cancel">
 Annuller
 </Button>
 <Button type="submit" disabled={pending} data-testid="btn-plan-save">
 {pending ?"Gemmer..." : editing ?"Gem ændringer" :"Opret pakke"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 );
}

/** Detalje-dialog for en platformfaktura med alle linjer og handlinger. */
function InvoiceDetailDialog({
  invoice, onClose, onSend, onRemind, onOverdrag, onMarkPaid, onCreditNote, openPdf,
}: {
  invoice: PlatformInvoiceRow | null;
  onClose: () => void;
  onSend: (id: number) => void;
  onRemind: (invoiceId: number) => void;
  onOverdrag: (id: number) => void;
  onMarkPaid: (id: number) => void;
  onCreditNote: (inv: PlatformInvoiceRow) => void;
  openPdf: (id: number) => void;
}) {
  if (!invoice) return null;
  const inv = invoice;
  const settled = inv.status === "betalt" || inv.status === "kreditnoteret";
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-invoice-detail">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Receipt className="w-5 h-5" /> {inv.invoiceNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{inv.companyName}</span>
            <StatusChip status={INV_STATUS[inv.status] ?? inv.status} variant={INV_VARIANT[inv.status] ?? "gray"} data-testid="detail-invoice-status" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">Periode</p><p className="text-foreground">{dk(inv.periodStart)} – {dk(inv.periodEnd)}</p></div>
            <div><p className="text-muted-foreground">Forfaldsdato</p><p className="text-foreground">{dk(inv.dueDate)}</p></div>
            <div><p className="text-muted-foreground">Ekskl. moms</p><p className="text-foreground">{formatCurrency(inv.netAmount)}</p></div>
            <div><p className="text-muted-foreground">Moms</p><p className="text-foreground">{formatCurrency(inv.vatAmount)}</p></div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
            <span className="text-muted-foreground text-xs">Beløb incl. moms</span>
            <span className="text-lg font-bold tabular-nums text-foreground" data-testid="detail-invoice-total">{formatCurrency(inv.totalAmount)}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" data-testid="button-detail-pdf" onClick={() => openPdf(inv.id)}>
              <FileText className="w-4 h-4 mr-1" /> Se PDF
            </Button>
            {!settled && inv.status !== "sendt" && (
              <Button size="sm" variant="outline" data-testid="button-detail-send" onClick={() => { onSend(inv.id); onClose(); }}>
                <Send className="w-4 h-4 mr-1" /> Send
              </Button>
            )}
            {!settled && (
              <Button size="sm" variant="outline" data-testid="button-detail-remind" onClick={() => { onRemind(inv.id); onClose(); }}>
                <Bell className="w-4 h-4 mr-1" /> Send rykker
              </Button>
            )}
            {!settled && inv.status === "rykket" && (
              <Button size="sm" variant="outline" data-testid="button-detail-overdrag" onClick={() => { onOverdrag(inv.id); onClose(); }}>
                <AlertTriangle className="w-4 h-4 mr-1" /> Overdrag til inkasso
              </Button>
            )}
            <Button size="sm" variant="outline" data-testid="button-detail-credit" onClick={() => { onCreditNote(inv); onClose(); }}>
              <FilePlus2 className="w-4 h-4 mr-1" /> Kreditnota
            </Button>
            {!settled && (
              <Button size="sm" data-testid="button-detail-paid" onClick={() => { onMarkPaid(inv.id); onClose(); }}>
                <Check className="w-4 h-4 mr-1" /> Markér betalt
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog til at oprette en kreditnota for en platformfaktura. */
function CreditNoteDialog({ invoice, onClose }: { invoice: PlatformInvoiceRow | null; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("Fuldt kreditnoteret af platform");
  const create = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/platform/invoices/${id}/credit-note`, { reason })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
      toast({ title: "Kreditnota oprettet", description: "Fakturaen er markeret kreditnoteret." });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette kreditnota", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-credit-note">
        <DialogHeader>
          <DialogTitle className="text-xl">Opret kreditnota</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Kreditnota fuldt beløb for <span className="font-medium text-foreground">{invoice.invoiceNumber}</span> ({invoice.companyName}).
              Beløb: <span className="font-medium text-foreground">{formatCurrency(invoice.totalAmount)}</span>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="credit-reason">Begrundelse</Label>
              <Input id="credit-reason" data-testid="input-credit-reason" value={reason}
                onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" data-testid="button-credit-cancel" onClick={onClose} disabled={create.isPending}>Annuller</Button>
              <Button size="sm" data-testid="button-credit-confirm" disabled={create.isPending} onClick={() => create.mutate(invoice.id)}>
                {create.isPending ? "Opretter..." : "Opret kreditnota"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

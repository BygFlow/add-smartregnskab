import { useState } from"react";
import { Link, useParams } from"wouter";
import { useAuth } from"@/lib/auth";
import { formatCurrency } from"@/App";
import { useQuery, useMutation } from"@tanstack/react-query";
import { apiRequest, queryClient, openAuthedFile } from"@/lib/queryClient";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Textarea } from"@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Skeleton } from"@/components/ui/skeleton";
import { useToast } from"@/hooks/use-toast";
import {
 ArrowLeft, FileText, ShieldOff, ShieldCheck, Receipt, Check, Bell, Building2,
 RefreshCw, AlertTriangle, Ban, CreditCard, Database, ScrollText, Lock,
 CheckCircle, Download, Trash2, Sparkles, Pencil, Users, Briefcase, ClipboardList,
} from"lucide-react";
import type { Plan } from"@shared/schema";

type Company = {
 id: number; name: string; address: string | null; cvr: string | null;
 phone: string | null; email: string | null; status: string;
 createdAt: string; notes: string | null; vatRate: string | null;
 vatMode: string | null; currency: string | null; kind: string | null;
 retentionTimeEntries: number | null; retentionGps: number | null;
 retentionAbsences: number | null; retentionPhotos: number | null;
 dpaAcceptedAt: string | null; dpaAcceptedBy: string | null;
};
type Subscription = {
 planId: number; status: string; billingCycle: string; trialEndsAt: string | null;
 currentPeriodStart: string | null; currentPeriodEnd: string | null; startedAt: string | null;
};
type DetailPlan = {
 id: number; name: string; monthlyPrice: number; pricePerEmployee: number;
 maxEmployees: number; maxCustomers: number; features: string;
};
type UserRow = { id: number; email: string; name: string | null; role: string; active: boolean };
type InvoiceRow = {
 id: number; invoiceNumber: string; companyId: number; netAmount: number;
 vatAmount: number; totalAmount: number; dueDate: string; status: string;
 paidAt: string | null; periodStart: string; periodEnd: string;
};
type PaymentRow = {
 id: number; provider: string; amount: number; currency: string;
 status: string; attempt: number; createdAt: string; settledAt: string | null;
};
type AuditLogRow = {
 id: number; action: string; target: string | null; detail: string | null;
 createdAt: string; userEmail: string | null;
};
type NextCharge = { totalAmount: number; periodEnd: string; planName: string; billingCycle: string; netAmount: number; vatAmount: number; employeeCount: number; basePrice: number } | null;
type Dpa = { accepted: boolean; acceptedAt: string | null };
type Summary = {
 outstanding: number; monthlyValue: number; unpaidCount: number;
 healthScore: number; activeUsers: number; employeeUtilization: number;
};
type CompanyDetail = {
 company: Company; subscription: Subscription | null; plan: DetailPlan | null;
 users: UserRow[]; employeeCount: number; customerCount: number; taskCount: number;
 invoices: InvoiceRow[]; payments: PaymentRow[]; auditLogs: AuditLogRow[];
 nextCharge: NextCharge | null; dpa: Dpa; summary: Summary;
};

type AiInsightResponse = {
 insights: string[]; risks: string[]; healthScore: number; summary: string;
};

const CO_STATUS: Record<string, { label: string; style: string }> = {
 aktiv: { label:"Aktiv", style:"badge-soft badge-soft-green" },
 proeve: { label:"Prøve", style:"badge-soft badge-soft-blue" },
 i_restance: { label:"I restance", style:"badge-soft badge-soft-amber" },
 spaerret: { label:"Spærret", style:"badge-soft badge-soft-red" },
 opsagt: { label:"Opsagt", style:"bg-muted text-muted-foreground" },
};
const INV_STATUS: Record<string, string> = { udstedt:"Udstedt", betalt:"Betalt", forfalden:"Forfalden" };
const ROLE_LABELS: Record<string, string> = {
 leder:"Leder",
 holdleder:"Holdleder",
 assistent:"Assistent",
 kunde:"Kunde",
 platform_admin:"Platformadministrator",
};
const KIND_LABELS: Record<string, string> = { kunde:"Kunde", platform:"Platform" };
const PAY_STATUS: Record<string, { label: string; style: string }> = {
 afventer: { label:"Afventer", style:"bg-muted text-muted-foreground" },
 gennemfoert: { label:"Gennemført", style:"badge-soft badge-soft-green" },
 fejlet: { label:"Fejlet", style:"badge-soft badge-soft-red" },
 refunderet: { label:"Refunderet", style:"badge-soft badge-soft-amber" },
 simuleret: { label:"Simuleret", style:"badge-soft badge-soft-blue" },
};

function dk(d?: string | null): string {
 if (!d) return"—";
 const [y, m, day] = d.slice(0, 10).split("-");
 if (!y || !m || !day) return d;
 return `${day}.${m}.${y}`;
}

function healthColor(score: number): string {
 if (score >= 80) return"bg-emerald-500";
 if (score >= 50) return"bg-amber-500";
 return"bg-destructive";
}

function parseFeatures(features: string): string[] {
 try {
 const arr = JSON.parse(features ||"[]");
 return Array.isArray(arr) ? arr.filter((f) => typeof f ==="string") : [];
 } catch {
 return [];
 }
}

const refreshCompanyDetail = (id: number) => {
 queryClient.invalidateQueries({ queryKey: ["/api/platform/companies", String(id)] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/payments"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/gdpr"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] });
};

export default function PlatformCompany() {
 const { id } = useParams<{ id: string }>();
 const companyId = Number(id);
 const { isPlatformAdmin } = useAuth();
 const { toast } = useToast();
 const [planDialog, setPlanDialog] = useState(false);
 const [suspendDialog, setSuspendDialog] = useState(false);
 const [cancelDialog, setCancelDialog] = useState(false);
 const [editDialog, setEditDialog] = useState(false);

 const { data, isLoading, isError } = useQuery<CompanyDetail>({
 queryKey: ["/api/platform/companies", String(companyId)],
 queryFn: async () => (await apiRequest("GET", `/api/platform/companies/${companyId}`)).json(),
 enabled: isPlatformAdmin && !!companyId,
 });

 const { data: plans } = useQuery<Plan[]>({
 queryKey: ["/api/platform/plans"],
 queryFn: async () => (await apiRequest("GET","/api/platform/plans")).json(),
 enabled: isPlatformAdmin,
 });

 const suspend = useMutation({
 mutationFn: async (reason: string) =>
 (await apiRequest("POST", `/api/platform/companies/${companyId}/suspend`, { reason })).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); setSuspendDialog(false); toast({ title:"Virksomheden er spærret" }); },
 onError: (e: Error) => toast({ title:"Kunne ikke spærre", description: e.message, variant:"destructive" }),
 });

 const reactivate = useMutation({
 mutationFn: async () =>
 (await apiRequest("POST", `/api/platform/companies/${companyId}/reactivate`, {})).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); toast({ title:"Adgangen er genåbnet" }); },
 onError: (e: Error) => toast({ title:"Kunne ikke genåbne", description: e.message, variant:"destructive" }),
 });

 const cancel = useMutation({
 mutationFn: async (reason: string) =>
 (await apiRequest("POST", `/api/platform/companies/${companyId}/cancel`, { reason })).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); setCancelDialog(false); toast({ title:"Virksomheden er opsagt" }); },
 onError: (e: Error) => toast({ title:"Kunne ikke opsige", description: e.message, variant:"destructive" }),
 });

 const changePlan = useMutation({
 mutationFn: async ({ planId, billingCycle }: { planId: number; billingCycle: string }) =>
 (await apiRequest("POST", `/api/platform/companies/${companyId}/plan`, { planId, billingCycle })).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); setPlanDialog(false); toast({ title:"Pakken er ændret" }); },
 onError: (e: Error) => toast({ title:"Kunne ikke ændre pakken", description: e.message, variant:"destructive" }),
 });

 const editCompany = useMutation({
 mutationFn: async (payload: Record<string, unknown>) =>
 (await apiRequest("PATCH", `/api/platform/companies/${companyId}`, payload)).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); setEditDialog(false); toast({ title:"Virksomheden er opdateret" }); },
 onError: (e: Error) => toast({ title:"Kunne ikke opdatere", description: e.message, variant:"destructive" }),
 });

 const issueInvoice = useMutation({
 mutationFn: async () => (await apiRequest("POST", `/api/platform/companies/${companyId}/invoice`, {})).json(),
 onSuccess: (d: { invoiceNumber: string; totalAmount: number }) => {
 refreshCompanyDetail(companyId);
 toast({ title: `Faktura ${d.invoiceNumber} udstedt`, description: `${formatCurrency(d.totalAmount)} inkl. moms` });
 },
 onError: (e: Error) => toast({ title:"Kunne ikke udstede faktura", description: e.message, variant:"destructive" }),
 });

 const markPaid = useMutation({
 mutationFn: async (invId: number) => (await apiRequest("POST", `/api/platform/invoices/${invId}/paid`, {})).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); toast({ title:"Fakturaen er markeret betalt" }); },
 onError: (e: Error) => toast({ title:"Kunne ikke markere betalt", description: e.message, variant:"destructive" }),
 });

 const exportData = useMutation({
 mutationFn: async () => (await apiRequest("POST", `/api/platform/companies/${companyId}/export-data`, {})).json(),
 onSuccess: (result: unknown) => {
 const blob = new Blob([JSON.stringify(result, null, 2)], { type:"application/json" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `dataeksport-virksomhed-${companyId}.json`;
 a.click();
 URL.revokeObjectURL(url);
 toast({ title:"Data eksporteret", description:"Virksomhedens data er downloadet som JSON." });
 },
 onError: (e: Error) => toast({ title:"Eksport fejlede", description: e.message, variant:"destructive" }),
 });

 const deleteData = useMutation({
 mutationFn: async () => (await apiRequest("DELETE", `/api/platform/companies/${companyId}/data`, {})).json(),
 onSuccess: () => { refreshCompanyDetail(companyId); toast({ title:"Data markeret til sletning", description:"Sletningen udføres permanent af GDPR-oprydningsjobbet." }); },
 onError: (e: Error) => toast({ title:"Sletning fejlede", description: e.message, variant:"destructive" }),
 });

 if (!isPlatformAdmin) {
 return (
 <div className="p-4 md:p-4 max-w-lg mx-auto">
 <div className="card-premium p-4 text-center space-y-3" data-testid="notice-not-platform-admin">
 <ShieldOff className="w-8 h-8 mx-auto text-muted-foreground" />
 <h1 className="text-lg font-bold text-foreground">Kun for platformadministratorer</h1>
 <p className="text-sm text-muted-foreground">Denne side kræver rollen platformadministrator.</p>
 </div>
 </div>
 );
 }

 if (isLoading) {
 return (
 <div className="p-4 md:p-4 space-y-3 max-w-5xl mx-auto" data-testid="page-loading">
 <Skeleton className="h-8 w-64" />
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <Skeleton className="h-40" />
 <Skeleton className="h-40" />
 </div>
 <Skeleton className="h-64" />
 <Skeleton className="h-48" />
 </div>
 );
 }

 if (isError || !data) {
 return (
 <div className="p-4 md:p-4 max-w-lg mx-auto">
 <div className="card-premium p-4 text-center space-y-3" data-testid="notice-error">
 <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
 <h1 className="text-lg font-bold text-foreground">Virksomheden blev ikke fundet</h1>
 <Link href="/platform">
 <Button variant="outline" size="sm" data-testid="button-back-error">
 <ArrowLeft className="w-4 h-4 mr-1.5" />Tilbage til Platform
 </Button>
 </Link>
 </div>
 </div>
 );
 }

 const { company, subscription, plan, users, summary, nextCharge, dpa, invoices, payments, auditLogs } = data;
 const st = CO_STATUS[company.status] ?? { label: company.status, style:"bg-muted text-muted-foreground" };
 const features = plan ? parseFeatures(plan.features) : [];
 const blocked = company.status ==="spaerret";
 const cancelled = company.status ==="opsagt";
 const canSuspend = ["aktiv","i_restance","proeve"].includes(company.status);
 const canReactivate = blocked || cancelled;

 return (
 <div className="p-4 md:p-4 space-y-5 max-w-6xl mx-auto" data-testid="page-platform-company">
 {/* Header */}
 <div className="flex flex-col gap-3" data-testid="section-header">
 <div className="flex items-center gap-3 flex-wrap">
 <Link href="/platform">
 <Button size="sm" variant="ghost" data-testid="button-back">
 <ArrowLeft className="w-4 h-4 mr-1.5" />Tilbage
 </Button>
 </Link>
 <div className="min-w-0">
 <h1 className="text-lg font-bold text-foreground" data-testid="text-company-name">{company.name}</h1>
 <p className="text-xs text-muted-foreground" data-testid="text-company-cvr">CVR {company.cvr ??"—"}</p>
 </div>
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.style}`} data-testid="status-company">
 {st.label}
 </span>
 </div>
 <div className="card-premium p-4" data-testid="card-health">
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs text-muted-foreground">Sundhedsscore</span>
 <span className="text-sm font-semibold text-foreground tabular-nums" data-testid="text-health-score">
 {summary.healthScore}/100
 </span>
 </div>
 <div className="h-2 rounded-full bg-muted overflow-hidden">
 <div className={`h-full rounded-full transition-all ${healthColor(summary.healthScore)}`}
 style={{ width: `${summary.healthScore}%` }} data-testid="bar-health" />
 </div>
 </div>
 </div>

 {/* Sektion 1: Virksomhedsoplysninger */}
 <section className="card-premium p-4 md:p-3 space-y-3" data-testid="section-company-info">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-2">
 <Building2 className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Virksomhedsoplysninger</h2>
 </div>
 <Button size="sm" variant="outline" data-testid="button-edit-company"
 onClick={() => setEditDialog(true)}>
 <Pencil className="w-4 h-4 mr-1.5" />Rediger
 </Button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
 <InfoRow label="Adresse" value={company.address} testId="text-address" />
 <InfoRow label="Telefon" value={company.phone} testId="text-phone" />
 <InfoRow label="E-mail" value={company.email} testId="text-email" />
 <InfoRow label="CVR" value={company.cvr} testId="text-cvr" />
 <InfoRow label="Oprettet" value={dk(company.createdAt)} testId="text-created" />
 <InfoRow label="Virksomhedstype" value={company.kind ? (KIND_LABELS[company.kind] ?? company.kind) : null} testId="text-kind" />
 <InfoRow label="Moms rate" value={company.vatRate ? `${company.vatRate}%` : null} testId="text-vat-rate" />
 <InfoRow label="Moms mode" value={company.vatMode} testId="text-vat-mode" />
 <InfoRow label="Valuta" value={company.currency} testId="text-currency" />
 <InfoRow label="DPA accepteret af" value={company.dpaAcceptedBy} testId="text-dpa-accepted-by" />
 </div>
 <div className="pt-2 border-t border-border" data-testid="block-retention">
 <p className="text-xs text-muted-foreground mb-2">Dataretention (måneder)</p>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
 <InfoRow label="Tidsregistreringer" value={company.retentionTimeEntries != null ? `${company.retentionTimeEntries}` : null} testId="text-retention-time" />
 <InfoRow label="GPS-data" value={company.retentionGps != null ? `${company.retentionGps}` : null} testId="text-retention-gps" />
 <InfoRow label="Fravær" value={company.retentionAbsences != null ? `${company.retentionAbsences}` : null} testId="text-retention-absences" />
 <InfoRow label="Fotos" value={company.retentionPhotos != null ? `${company.retentionPhotos}` : null} testId="text-retention-photos" />
 </div>
 </div>
 <div className="pt-2 border-t border-border">
 <p className="text-xs text-muted-foreground mb-1">Noter</p>
 <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-notes">
 {company.notes ||"Ingen noter."}
 </p>
 </div>
 </section>

 {/* Sektion 2: Abonnement & Pakke */}
 <section className="card-premium p-4 md:p-3 space-y-3" data-testid="section-subscription">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-2">
 <CreditCard className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Abonnement & Pakke</h2>
 </div>
 <Button size="sm" variant="outline" data-testid="button-change-plan"
 disabled={cancelled || changePlan.isPending} onClick={() => setPlanDialog(true)}>
 <Building2 className="w-4 h-4 mr-1.5" />Skift pakke
 </Button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
 <InfoRow label="Pakke" value={plan?.name} testId="text-plan-name" />
 <InfoRow label="Pris pr. måned" value={plan ? formatCurrency(plan.monthlyPrice) : null} testId="text-plan-price" />
 <InfoRow label="Pris pr. ansat" value={plan ? formatCurrency(plan.pricePerEmployee) : null} testId="text-plan-employee-price" />
 <InfoRow label="Fakturering" value={subscription?.billingCycle ==="aarlig" ?"Årlig" : subscription?.billingCycle ==="maanedlig" ?"Månedlig" : null} testId="text-billing-cycle" />
 <InfoRow label="Abonnementsstatus" value={subscription?.status} testId="text-sub-status" />
 <InfoRow label="Periode start" value={dk(subscription?.currentPeriodStart)} testId="text-period-start" />
 <InfoRow label="Periode slut" value={dk(subscription?.currentPeriodEnd)} testId="text-period-end" />
 <InfoRow label="Prøveperiode slut" value={dk(subscription?.trialEndsAt)} testId="text-trial-end" />
 <InfoRow label="Abonnement startet" value={dk(subscription?.startedAt)} testId="text-sub-started" />
 <InfoRow label="Næste opkrævning" value={nextCharge ? `${formatCurrency(nextCharge.totalAmount)} (${dk(nextCharge.periodEnd)})` : null} testId="text-next-charge" />
 </div>
 <div className="grid grid-cols-1 gap-3 text-sm">
 <div className="rounded-lg border border-border/50 p-3" data-testid="card-usage-customers">
 <p className="text-xs text-muted-foreground">Kunder</p>
 <p className="text-foreground tabular-nums" data-testid="text-customer-usage">
 {data.customerCount} / {plan ? (plan.maxCustomers < 0 ?"ubegrænset" : plan.maxCustomers) :"—"}
 </p>
 </div>
 </div>
 {features.length > 0 && (
 <div className="pt-2 border-t border-border" data-testid="block-features">
 <p className="text-xs text-muted-foreground mb-2">Funktioner i pakken</p>
 <div className="flex flex-wrap gap-1.5">
 {features.map((f) => (
 <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" data-testid={`tag-feature-${f}`}>
 {f}
 </span>
 ))}
 </div>
 </div>
 )}
 </section>

 {/* Sektion 3: Fakturaer & Betalinger */}
 <section className="card-premium overflow-hidden" data-testid="section-invoices">
 <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-2">
 <Receipt className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fakturaer & Betalinger</h2>
 </div>
 <Button size="sm" variant="outline" data-testid="button-issue-invoice"
 disabled={issueInvoice.isPending || cancelled} onClick={() => issueInvoice.mutate()}>
 <Receipt className="w-4 h-4 mr-1.5" />Udsted ny faktura
 </Button>
 </div>
 {invoices.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-invoices">Ingen abonnementsfakturaer udstedt endnu.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[820px]">
 <thead>
 <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/30">
 <th className="px-4 py-2.5 font-medium">Fakturanr.</th>
 <th className="px-4 py-2.5 font-medium">Periode</th>
 <th className="px-4 py-2.5 font-medium text-right">I alt</th>
 <th className="px-4 py-2.5 font-medium">Forfald</th>
 <th className="px-4 py-2.5 font-medium">Status</th>
 <th className="px-4 py-2.5 font-medium text-right">Handling</th>
 </tr>
 </thead>
 <tbody>
 {invoices.map((inv) => (
 <tr key={inv.id} className="border-b border-border/50 last:border-0" data-testid={`row-invoice-${inv.id}`}>
 <td className="px-4 py-3 font-medium text-foreground" data-testid={`text-invoice-number-${inv.id}`}>{inv.invoiceNumber}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{dk(inv.periodStart)} – {dk(inv.periodEnd)}</td>
 <td className="px-4 py-3 text-right tabular-nums text-foreground font-medium">{formatCurrency(inv.totalAmount)}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{dk(inv.dueDate)}</td>
 <td className="px-4 py-3">
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status ==="betalt" ?"badge-soft badge-soft-green" : inv.status ==="forfalden" ?"badge-soft badge-soft-red" :"bg-muted text-muted-foreground"}`}>
 {INV_STATUS[inv.status] ?? inv.status}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1 justify-end">
 <Button size="sm" variant="ghost" title="Hent PDF" data-testid={`button-invoice-pdf-${inv.id}`}
 onClick={() => openAuthedFile(`/api/platform/invoices/${inv.id}/pdf`)}>
 <FileText className="w-4 h-4" />
 </Button>
 {inv.status !=="betalt" && (
 <ReminderButton invoiceId={inv.id} />
 )}
 {inv.status !=="betalt" && (
 <Button size="sm" variant="ghost" title="Markér betalt" data-testid={`button-mark-paid-${inv.id}`}
 disabled={markPaid.isPending} onClick={() => markPaid.mutate(inv.id)}>
 <Check className="w-4 h-4 text-emerald-600" />
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

 <div className="px-4 py-3 border-t border-border" data-testid="block-payments">
 <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Betalinger</h3>
 {payments.length === 0 ? (
 <p className="text-sm text-muted-foreground" data-testid="empty-payments">Ingen betalinger registreret.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[640px]">
 <thead>
 <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/30">
 <th className="px-4 py-2.5 font-medium">Dato</th>
 <th className="px-4 py-2.5 font-medium">Udbyder</th>
 <th className="px-4 py-2.5 font-medium text-right">Beløb</th>
 <th className="px-4 py-2.5 font-medium text-right">Forsøg</th>
 <th className="px-4 py-2.5 font-medium">Status</th>
 </tr>
 </thead>
 <tbody>
 {payments.map((p) => {
 const pst = PAY_STATUS[p.status] ?? { label: p.status, style:"bg-muted text-muted-foreground" };
 return (
 <tr key={p.id} className="border-b border-border/50 last:border-0" data-testid={`row-payment-${p.id}`}>
 <td className="px-4 py-2.5 text-xs whitespace-nowrap">{dk(p.createdAt)}</td>
 <td className="px-4 py-2.5 text-xs font-mono">{p.provider}</td>
 <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(p.amount)} {p.currency}</td>
 <td className="px-4 py-2.5 text-right tabular-nums">{p.attempt}</td>
 <td className="px-4 py-2.5">
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pst.style}`}>{pst.label}</span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <div className="px-4 py-3 border-t border-border">
 <AiInsightPanel companyId={companyId} />
 </div>
 </section>

 {/* Sektion 5: Brugere */}
 <section className="card-premium p-4 md:p-3 space-y-3" data-testid="section-users">
 <div className="flex items-center gap-2">
 <Lock className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brugere</h2>
 </div>
 {users.length === 0 ? (
 <p className="text-sm text-muted-foreground" data-testid="empty-users">Ingen brugere fundet.</p>
 ) : (
 <div className="space-y-2">
 {users.map((u) => (
 <div key={u.id} data-testid={`row-user-${u.id}`}
 className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium text-foreground truncate" data-testid={`text-user-name-${u.id}`}>{u.name ??"—"}</p>
 <p className="text-xs text-muted-foreground truncate" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground" data-testid={`text-user-role-${u.id}`}>
 {ROLE_LABELS[u.role] ?? u.role}
 </span>
 {u.active ? (
 <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" data-testid={`text-user-status-${u.id}`}>
 <CheckCircle className="w-3.5 h-3.5" />Aktiv
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-user-status-${u.id}`}>
 <Ban className="w-3.5 h-3.5" />Inaktiv
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </section>

 {/* Sektion 5: GDPR & Compliance */}
 <section className="card-premium p-4 md:p-3 space-y-3" data-testid="section-gdpr">
 <div className="flex items-center gap-2">
 <Database className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GDPR & Compliance</h2>
 </div>
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="text-sm">
 <span className="text-muted-foreground">DPA-status: </span>
 {dpa.accepted ? (
 <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400" data-testid="text-dpa-accepted">
 <CheckCircle className="w-3.5 h-3.5" />Accepteret {dpa.acceptedAt ? `(${dk(dpa.acceptedAt)})` :""}
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" data-testid="text-dpa-pending">
 <AlertTriangle className="w-3.5 h-3.5" />Afventer
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <Button size="sm" variant="outline" data-testid="button-export-data"
 disabled={exportData.isPending} onClick={() => exportData.mutate()}>
 <Download className="w-4 h-4 mr-1.5" />Eksporter data
 </Button>
 {cancelled && (
 <Button size="sm" variant="destructive" data-testid="button-delete-data"
 disabled={deleteData.isPending}
 onClick={() => {
 if (window.confirm("Slet virksomhedens data permanent? Handlingen kan ikke fortrydes.")) {
 deleteData.mutate();
 }
 }}>
 <Trash2 className="w-4 h-4 mr-1.5" />Slet data
 </Button>
 )}
 </div>
 </div>
 </section>

 {/* Sektion 7: Revisionsspor */}
 <section className="card-premium overflow-hidden" data-testid="section-audit">
 <div className="px-4 py-3 border-b border-border flex items-center gap-2">
 <ScrollText className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revisionsspor</h2>
 </div>
 {auditLogs.length === 0 ? (
 <p className="p-4 text-sm text-muted-foreground" data-testid="empty-audit">Ingen hændelser registreret for denne virksomhed.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-premium min-w-[820px]">
 <thead>
 <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/30">
 <th className="px-4 py-2.5 font-medium">Tidspunkt</th>
 <th className="px-4 py-2.5 font-medium">Handling</th>
 <th className="px-4 py-2.5 font-medium">Mål</th>
 <th className="px-4 py-2.5 font-medium">Detalje</th>
 <th className="px-4 py-2.5 font-medium">Bruger</th>
 </tr>
 </thead>
 <tbody>
 {auditLogs.map((l) => (
 <tr key={l.id} className="border-b border-border/50 last:border-0" data-testid={`row-audit-${l.id}`}>
 <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{dk(l.createdAt)}</td>
 <td className="px-4 py-2.5 text-xs font-medium text-foreground">{l.action}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.target ??"—"}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[280px] truncate" title={l.detail ??""}>{l.detail ??"—"}</td>
 <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.userEmail ??"System"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>

 {/* Sektion 8: Handlinger */}
 <section className="card-premium p-4 md:p-3 space-y-3" data-testid="section-actions">
 <div className="flex items-center gap-2">
 <ShieldOff className="w-4 h-4 text-muted-foreground" />
 <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handlinger</h2>
 </div>
 <div className="flex flex-wrap gap-2">
 {canSuspend && (
 <Button size="sm" variant="outline" data-testid="button-suspend"
 disabled={suspend.isPending} onClick={() => setSuspendDialog(true)}>
 <ShieldOff className="w-4 h-4 mr-1.5 text-destructive" />Spær adgang
 </Button>
 )}
 {canReactivate && (
 <Button size="sm" variant="outline" data-testid="button-reactivate"
 disabled={reactivate.isPending} onClick={() => reactivate.mutate()}>
 <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />Genåbn adgang
 </Button>
 )}
 {!cancelled && (
 <Button size="sm" variant="outline" data-testid="button-cancel"
 disabled={cancel.isPending} onClick={() => setCancelDialog(true)}>
 <Ban className="w-4 h-4 mr-1.5 text-destructive" />Opsig virksomhed
 </Button>
 )}
 {cancelled && canReactivate === false && (
 <p className="text-xs text-muted-foreground" data-testid="text-no-actions">Ingen yderligere handlinger tilgængelige.</p>
 )}
 </div>
 </section>

 {/* Dialogs */}
 <Dialog open={editDialog} onOpenChange={(o) => !o && setEditDialog(false)}>
 <DialogContent className="max-w-md">
 <DialogHeader><DialogTitle>Rediger {company.name}</DialogTitle></DialogHeader>
 <EditCompanyForm company={company} pending={editCompany.isPending}
 onSubmit={(payload) => editCompany.mutate(payload)} />
 </DialogContent>
 </Dialog>

 <Dialog open={planDialog} onOpenChange={(o) => !o && setPlanDialog(false)}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Skift pakke for {company.name}</DialogTitle></DialogHeader>
 {plan && subscription && (
 <PlanForm plans={plans ?? []} currentPlanId={subscription.planId} currentCycle={subscription.billingCycle}
 employeeCount={data.employeeCount} pending={changePlan.isPending}
 onSubmit={(planId, billingCycle) => changePlan.mutate({ planId, billingCycle })} />
 )}
 </DialogContent>
 </Dialog>

 <Dialog open={suspendDialog} onOpenChange={(o) => !o && setSuspendDialog(false)}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Spær {company.name}</DialogTitle></DialogHeader>
 <SuspendForm pending={suspend.isPending} onSubmit={(reason) => suspend.mutate(reason)} />
 </DialogContent>
 </Dialog>

 <Dialog open={cancelDialog} onOpenChange={(o) => !o && setCancelDialog(false)}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Opsig {company.name}</DialogTitle></DialogHeader>
 <CancelForm pending={cancel.isPending} onSubmit={(reason) => cancel.mutate(reason)} />
 </DialogContent>
 </Dialog>
 </div>
 );
}

function InfoRow({ label, value, testId }: { label: string; value: string | null | undefined; testId: string }) {
 return (
 <div>
 <p className="text-xs text-muted-foreground">{label}</p>
 <p className="text-foreground break-words" data-testid={testId}>{value ||"—"}</p>
 </div>
 );
}

function MiniCard({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId: string }) {
 return (
 <div className="rounded-lg border border-border/50 p-3" data-testid={testId}>
 <div className="flex items-center gap-1.5 mb-1">
 {icon}
 <p className="text-xs text-muted-foreground">{label}</p>
 </div>
 <p className="text-foreground tabular-nums font-medium">{value}</p>
 </div>
 );
}

function EditCompanyForm({ company, pending, onSubmit }: {
 company: Company; pending: boolean; onSubmit: (payload: Record<string, unknown>) => void;
}) {
 const [name, setName] = useState(company.name ??"");
 const [cvr, setCvr] = useState(company.cvr ??"");
 const [address, setAddress] = useState(company.address ??"");
 const [phone, setPhone] = useState(company.phone ??"");
 const [email, setEmail] = useState(company.email ??"");
 const [notes, setNotes] = useState(company.notes ??"");
 const [vatRate, setVatRate] = useState(company.vatRate ??"25");
 const [vatMode, setVatMode] = useState(company.vatMode ??"dansk");
 const [currency, setCurrency] = useState(company.currency ??"DKK");

 return (
 <form onSubmit={(e) => {
 e.preventDefault();
 onSubmit({ name, cvr: cvr || null, address: address || null, phone: phone || null, email: email || null, notes: notes || null, vatRate, vatMode, currency });
 }} className="space-y-3">
 <div className="space-y-1.5">
 <Label htmlFor="edit-name">Navn</Label>
 <Input id="edit-name" required data-testid="input-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label htmlFor="edit-cvr">CVR</Label>
 <Input id="edit-cvr" data-testid="input-edit-cvr" value={cvr} onChange={(e) => setCvr(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="edit-phone">Telefon</Label>
 <Input id="edit-phone" data-testid="input-edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
 </div>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="edit-address">Adresse</Label>
 <Input id="edit-address" data-testid="input-edit-address" value={address} onChange={(e) => setAddress(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="edit-email">E-mail</Label>
 <Input id="edit-email" type="email" data-testid="input-edit-email" value={email} onChange={(e) => setEmail(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="edit-notes">Interne noter</Label>
 <Textarea id="edit-notes" rows={3} data-testid="input-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div className="space-y-1.5">
 <Label htmlFor="edit-vat-rate">Momsats (%)</Label>
 <Input id="edit-vat-rate" type="number" step="0.1" min="0" data-testid="input-edit-vat-rate" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <Label>Momstilstand</Label>
 <Select value={vatMode} onValueChange={setVatMode}>
 <SelectTrigger data-testid="select-edit-vat-mode"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="dansk">Dansk</SelectItem>
 <SelectItem value="eu_omvendt">EU omvendt</SelectItem>
 <SelectItem value="eksport_fritaget">Eksport fritaget</SelectItem>
 <SelectItem value="momsfri">Momsfri</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="edit-currency">Valuta</Label>
 <Input id="edit-currency" data-testid="input-edit-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
 </div>
 </div>
 <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-company">
 {pending ?"Gemmer..." :"Gem ændringer"}
 </Button>
 </form>
 );
}

function PlanForm({ plans, currentPlanId, currentCycle, employeeCount, pending, onSubmit }: {
 plans: Plan[]; currentPlanId: number; currentCycle: string; employeeCount: number;
 pending: boolean; onSubmit: (planId: number, billingCycle: string) => void;
}) {
 const [planId, setPlanId] = useState(String(currentPlanId ?? plans[0]?.id ??""));
 const [cycle, setCycle] = useState(currentCycle ??"maanedlig");
 const selected = plans.find((p) => p.id === Number(planId));
 const tooMany = !!selected && selected.maxEmployees >= 0 && employeeCount > selected.maxEmployees;

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
 Virksomheden har {employeeCount} ansatte, men {selected?.name} tillader kun {selected?.maxEmployees}.
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

function CancelForm({ pending, onSubmit }: { pending: boolean; onSubmit: (reason: string) => void }) {
 const [reason, setReason] = useState("");
 return (
 <form onSubmit={(e) => { e.preventDefault(); onSubmit(reason ||"Opsagt af platform"); }} className="space-y-3">
 <p className="text-sm text-muted-foreground">
 Opsigelse markerer virksomheden som opsagt og afslutter abonnementet. Virksomheden kan genåbnes, men abonnementet skal oprettes igen.
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
 queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
 queryClient.invalidateQueries({ queryKey: ["/api/platform/invoices"] });
 toast({ title:"Rykker sendt", description:"Fakturaen er markeret forfalden, og en påmindelse er sat i kø." });
 },
 onError: (e: Error) => toast({ title:"Kunne ikke sende rykker", description: e.message, variant:"destructive" }),
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

/** AI-panel der henter virksomhedsoversigt-analyse fra /api/ai/assist. */
function AiInsightPanel({ companyId }: { companyId: number }) {
 const { data, isLoading, isError, refetch, isFetching } = useQuery<AiInsightResponse>({
 queryKey: ["ai-virksomhedsoversigt", String(companyId)],
 queryFn: async () =>
 (await apiRequest("POST","/api/ai/assist", { contextType:"virksomhedsoversigt", entityId: companyId })).json(),
 });

 return (
 <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2" data-testid="panel-ai-insight">
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-primary" />
 <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI-analyse — Faktureringsrisiko</h3>
 </div>
 <Button size="sm" variant="ghost" data-testid="button-refresh-ai"
 disabled={isFetching} onClick={() => { refetch(); }}>
 <RefreshCw className={`w-3.5 h-3.5 ${isFetching ?"animate-spin" :""}`} />
 Opdater analyse
 </Button>
 </div>

 {isLoading || isFetching ? (
 <div className="space-y-2" data-testid="ai-loading">
 <Skeleton className="h-4 w-3/4" />
 <Skeleton className="h-4 w-1/2" />
 <Skeleton className="h-4 w-2/3" />
 </div>
 ) : isError || !data ? (
 <p className="text-xs text-muted-foreground" data-testid="ai-error">
 Analysen kunne ikke hentes.
 <Button size="sm" variant="ghost" data-testid="button-retry-ai" onClick={() => refetch()}>Prøv igen</Button>
 </p>
 ) : (
 <div className="space-y-2">
 <div className="flex items-center gap-2 text-xs">
 <span className="text-muted-foreground">Sundhedsscore:</span>
 <span className="font-semibold text-foreground tabular-nums" data-testid="text-ai-health">{data.healthScore}/100</span>
 </div>
 {data.insights.length > 0 && (
 <div className="space-y-1" data-testid="block-ai-insights">
 {data.insights.map((s, i) => (
 <p key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-insight-${i}`}>
 <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />{s}
 </p>
 ))}
 </div>
 )}
 {data.risks.length > 0 && (
 <div className="space-y-1" data-testid="block-ai-risks">
 {data.risks.map((r, i) => (
 <p key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-risk-${i}`}>
 <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />{r}
 </p>
 ))}
 </div>
 )}
 {data.summary && (
 <p className="text-xs text-muted-foreground pt-1 border-t border-border" data-testid="text-ai-summary">{data.summary}</p>
 )}
 </div>
 )}
 </div>
 );
}

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CreditCard, Plus, Trash2 } from "lucide-react";
import type { Payment, PaymentMethod, PlatformInvoice } from "@shared/schema";
import { PageHeader, SectionCard } from "@/components/premium";

type Status = {
  providers: { id: string; label: string; configured: boolean; missingEnv: string[] }[];
  methods: PaymentMethod[];
  autoRenew: boolean;
  dunningStage: number;
  lastPaymentAttempt: string | null;
  note: string | null;
};

const PROVIDER_LABEL: Record<string, string> = { stripe: "Stripe kort", mobilepay: "MobilePay", betalingsservice: "Betalingsservice" };
const PAYMENT_STATUS: Record<string, string> = { afventer: "Afventer", gennemfoert: "Gennemført", fejlet: "Fejlet", refunderet: "Refunderet", simuleret: "Simuleret" };
const INVOICE_STATUS: Record<string, string> = { udstedt: "Udstedt", forfalden: "Forfalden", betalt: "Betalt" };

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(new Date(value)) : "—";
}

export default function Betaling() {
  const { user, companyId } = useAuth();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const canManage = user?.role === "leder" || user?.role === "platform_admin";
  const { data: status, isLoading } = useQuery<Status>({
    queryKey: ["/api/payment/status", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/payment/status")).json(),
    enabled: canManage,
  });
  const { data: subscriptionData } = useQuery<{ invoices: PlatformInvoice[] }>({
    queryKey: ["/api/subscription", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/subscription?companyId=${companyId}`)).json(),
    enabled: canManage,
  });
  const { data: history = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payment/history", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/payment/history")).json(),
    enabled: canManage,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payment/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payment/history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
  };
  const makeDefault = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/payment/methods/${id}/default`)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Betalingsmiddel er valgt som standard" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke ændre standard", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/payment/methods/${id}`)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Betalingsmidlet er fjernet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke fjerne betalingsmidlet", description: e.message, variant: "destructive" }),
  });
  const renew = useMutation({
    mutationFn: async (autoRenew: boolean) => (await apiRequest("POST", "/api/payment/autorenew", { autoRenew })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Automatisk fornyelse er opdateret" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere automatisk fornyelse", description: e.message, variant: "destructive" }),
  });
  const pay = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/payment/pay/${id}`)).json(),
    onSuccess: (result: { pending?: boolean; message?: string }) => {
      invalidate();
      toast({ title: result.pending ? "Betalingen afventer" : "Betaling registreret", description: result.message });
    },
    onError: (e: Error) => toast({ title: "Betalingen kunne ikke gennemføres", description: e.message, variant: "destructive" }),
  });

  if (!canManage) return <AccessDenied />;
  if (isLoading) return <Loading />;
  const overdue = (subscriptionData?.invoices ?? []).filter((invoice) => invoice.status === "forfalden" || invoice.status === "udstedt");
  const dunning = status?.dunningStage ?? 0;
  const dunningText = dunning === 1 ? "Første rykker sendt" : dunning === 2 ? "Anden rykker sendt" : "Adgangen er spærret";
  const dunningNext = dunning === 1 ? "Hvis fakturaen fortsat ikke betales, sendes anden rykker, og virksomheden registreres i restance." : dunning === 2 ? "Hvis fakturaen fortsat ikke betales, spærres adgangen til ADD SmartDrift Clean." : "Betal den forfaldne faktura for at få adgang igen.";

  return (
    <div className="p-4 md:p-4 space-y-3 max-w-6xl mx-auto">
      <PageHeader eyebrow="Betaling" title="Betalinger" description="Betalingshistorik og metoder" />
      {status?.note && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3" data-testid="card-simulation"><h2 className="font-medium text-xs text-amber-900 dark:text-amber-200">Simuleringstilstand</h2><p className="text-xs text-amber-800 dark:text-amber-300 mt-1">{status.note} Rigtige betalinger kører først, når nøglerne til udbyderen er sat op på serveren.</p></div>}
      {dunning > 0 && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3" data-testid="card-dunning"><div className="flex gap-2"><AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" /><div><h2 className="font-medium text-xs text-destructive">{dunningText}</h2><p className="text-xs text-foreground mt-1">{dunningNext}</p></div></div></div>}
      <SectionCard data-testid="card-providers" title="Betalingsudbydere" icon={<CreditCard className="w-4 h-4" />} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">{(status?.providers ?? []).map((provider) => <div key={provider.id} className="rounded-md border border-border/50 p-3 min-w-0" data-testid={`card-provider-${provider.id}`}><div className="flex items-center justify-between gap-2"><span className="font-medium text-xs truncate">{PROVIDER_LABEL[provider.id] ?? provider.label}</span><span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${provider.configured ? "badge-soft badge-soft-green" : "bg-muted text-muted-foreground"}`}>{provider.configured ? "Klar" : "Mangler nøgler"}</span></div>{!provider.configured && provider.missingEnv.length > 0 && <p className="text-[11px] text-muted-foreground mt-2 break-all leading-relaxed">{provider.missingEnv.join(", ")}</p>}</div>)}</div>
      </SectionCard>
      <SectionCard data-testid="card-payment-methods" icon={<CreditCard className="w-4 h-4" />} action={<Button size="sm" data-testid="button-add-payment-method" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" />Tilføj</Button>} className="space-y-3">
        <div><h2 className="font-medium text-xs text-foreground">Betalingsmidler</h2><p className="text-[11px] text-muted-foreground mt-1">I demoen dannes et simuleret betalingsmiddel. Ved rigtig drift åbnes udbyderens sikre betalingsvindue — kortoplysninger gemmes aldrig i ADD SmartDrift Clean.</p></div>
        {(status?.methods ?? []).filter((method) => method.status === "aktiv").length === 0 ? <div className="rounded-md border border-dashed border-border p-4 text-center" data-testid="empty-payment-methods"><CreditCard className="w-7 h-7 text-muted-foreground mx-auto mb-2" /><p className="text-xs text-muted-foreground">Der er endnu ikke tilføjet et betalingsmiddel.</p></div> : <div className="space-y-2">{status?.methods.filter((method) => method.status === "aktiv").map((method) => <div key={method.id} className="rounded-md border border-border/50 p-3 flex items-center gap-3 flex-wrap" data-testid={`row-payment-method-${method.id}`}><CreditCard className="w-4 h-4 text-muted-foreground shrink-0" /><div className="min-w-0 flex-1"><div className="flex gap-2 items-center flex-wrap"><span className="font-medium text-xs">{PROVIDER_LABEL[method.provider] ?? method.provider}</span><span className="text-xs capitalize">{method.brand ?? "Betalingsmiddel"} {method.last4 ? `•••• ${method.last4}` : ""}</span>{method.isDefault === 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">Standard</span>}</div><p className="text-[11px] text-muted-foreground mt-1">{method.expMonth && method.expYear ? `Udløber ${String(method.expMonth).padStart(2, "0")}/${method.expYear}` : "Ingen udløbsdato"}</p></div><div className="flex gap-2 shrink-0">{method.isDefault !== 1 && <Button size="sm" variant="outline" data-testid={`button-default-payment-method-${method.id}`} disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(method.id)}>Gør til standard</Button>}<Button size="sm" variant="ghost" data-testid={`button-remove-payment-method-${method.id}`} disabled={remove.isPending} onClick={() => remove.mutate(method.id)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button></div></div>)}</div>}
      </SectionCard>
      <SectionCard data-testid="card-autorenew" className="flex gap-3 items-start justify-between flex-wrap"><div><h2 className="font-medium text-xs">Automatisk fornyelse</h2><p className="text-xs text-muted-foreground mt-1">Forny abonnementet automatisk ved periodens udløb med virksomhedens standardbetalingsmiddel.</p>{status?.lastPaymentAttempt && <p className="text-[11px] text-muted-foreground mt-2">Seneste betalingsforsøg: {date(status.lastPaymentAttempt)}</p>}</div><Switch checked={status?.autoRenew ?? false} disabled={renew.isPending} onCheckedChange={(checked) => renew.mutate(checked)} data-testid="switch-autorenew" aria-label="Automatisk fornyelse" /></SectionCard>
      <InvoiceList invoices={overdue} pending={pay.isPending} onPay={(id) => pay.mutate(id)} />
      <HistoryList history={history} />
      <AddMethodDialog open={adding} onOpenChange={setAdding} onSaved={invalidate} />
    </div>
  );
}

function AccessDenied() { return <div className="p-4 md:p-4 max-w-2xl mx-auto"><div className="rounded-md border border-border/50 bg-card p-4 text-center" data-testid="card-payment-access"><CreditCard className="w-8 h-8 mx-auto text-muted-foreground mb-3" /><p className="text-xs text-muted-foreground">Kun virksomhedens leder kan se betalingsoplysninger.</p></div></div>; }
function Loading() { return <div className="p-4 md:p-4 space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-32 rounded-md" /><Skeleton className="h-48 rounded-md" /></div>; }

function InvoiceList({ invoices, pending, onPay }: { invoices: PlatformInvoice[]; pending: boolean; onPay: (id: number) => void }) {
  return <SectionCard data-testid="card-overdue-invoices" title="Forfaldne abonnementsfakturaer" icon={<CreditCard className="w-4 h-4" />} className="space-y-2">{invoices.length === 0 ? <p className="text-xs text-muted-foreground py-2" data-testid="empty-overdue-invoices">Der er ingen åbne abonnementsfakturaer.</p> : <div className="space-y-2">{invoices.map((invoice) => <div className="rounded-md border border-border/50 p-3 flex items-center gap-3 flex-wrap" key={invoice.id} data-testid={`row-overdue-invoice-${invoice.id}`}><div className="min-w-0 flex-1"><p className="font-medium text-xs">{invoice.invoiceNumber}</p><p className="text-[11px] text-muted-foreground mt-1">Forfald {date(invoice.dueDate)} · {INVOICE_STATUS[invoice.status] ?? invoice.status}</p></div><span className="text-xs font-medium tabular-nums">{formatCurrency(invoice.totalAmount)}</span><Button size="sm" data-testid={`button-pay-invoice-${invoice.id}`} disabled={pending} onClick={() => onPay(invoice.id)}>Betal nu</Button></div>)}</div>}</SectionCard>;
}
function HistoryList({ history }: { history: Payment[] }) {
  return <SectionCard data-testid="card-payment-history" title="Betalingshistorik" icon={<CreditCard className="w-4 h-4" />} className="space-y-2">{history.length === 0 ? <p className="text-xs text-muted-foreground py-2" data-testid="empty-payment-history">Der er endnu ingen betalingshistorik.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[570px] text-xs"><thead><tr className="border-b border-border/50 text-left text-[11px] text-muted-foreground"><th className="py-2 font-medium">Dato</th><th className="py-2 font-medium text-right">Beløb</th><th className="py-2 font-medium">Udbyder</th><th className="py-2 font-medium">Status</th><th className="py-2 font-medium">Besked</th></tr></thead><tbody>{history.map((payment) => <tr key={payment.id} className="border-b border-border/50 last:border-0" data-testid={`row-payment-history-${payment.id}`}><td className="py-2 text-[11px]">{date(payment.createdAt)}</td><td className="py-2 text-right tabular-nums">{formatCurrency(payment.amount)}</td><td className="py-2">{PROVIDER_LABEL[payment.provider] ?? payment.provider}</td><td className="py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${payment.status === "fejlet" ? "badge-soft badge-soft-red" : payment.status === "gennemfoert" || payment.status === "simuleret" ? "badge-soft badge-soft-green" : "bg-muted text-muted-foreground"}`}>{PAYMENT_STATUS[payment.status] ?? payment.status}</span></td><td className="py-2 text-[11px] text-muted-foreground max-w-[260px] truncate" title={payment.failureReason ?? undefined}>{payment.failureReason ?? "—"}</td></tr>)}</tbody></table></div>}</SectionCard>;
}
function AddMethodDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const { toast } = useToast(); const [provider, setProvider] = useState("stripe"); const [brand, setBrand] = useState("visa"); const [last4, setLast4] = useState(""); const [expMonth, setExpMonth] = useState(""); const [expYear, setExpYear] = useState("");
  const create = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/payment/methods", { provider, brand: brand.trim() || undefined, last4: last4.trim() || undefined, expMonth: expMonth ? Number(expMonth) : undefined, expYear: expYear ? Number(expYear) : undefined })).json(), onSuccess: () => { onSaved(); onOpenChange(false); toast({ title: "Simuleret betalingsmiddel er tilføjet" }); }, onError: (e: Error) => toast({ title: "Kunne ikke tilføje betalingsmiddel", description: e.message, variant: "destructive" }) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Tilføj betalingsmiddel</DialogTitle></DialogHeader><div className="space-y-3"><div className="space-y-1.5"><Label>Udbyder</Label><Select value={provider} onValueChange={setProvider}><SelectTrigger data-testid="select-payment-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stripe">Stripe kort</SelectItem><SelectItem value="mobilepay">MobilePay</SelectItem><SelectItem value="betalingsservice">Betalingsservice</SelectItem></SelectContent></Select></div>{provider === "stripe" && <><div className="space-y-1.5"><Label htmlFor="payment-brand">Korttype</Label><Input id="payment-brand" value={brand} onChange={(e) => setBrand(e.target.value)} data-testid="input-payment-brand" placeholder="f.eks. Visa" /></div><div className="space-y-1.5"><Label htmlFor="payment-last4">Sidste fire cifre</Label><Input id="payment-last4" maxLength={4} inputMode="numeric" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} data-testid="input-payment-last4" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="payment-month">Udløbsmåned</Label><Input id="payment-month" type="number" min="1" max="12" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} data-testid="input-payment-month" /></div><div className="space-y-1.5"><Label htmlFor="payment-year">Udløbsår</Label><Input id="payment-year" type="number" min="2025" max="2100" value={expYear} onChange={(e) => setExpYear(e.target.value)} data-testid="input-payment-year" /></div></div></>}<Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()} data-testid="button-save-payment-method">{create.isPending ? "Tilføjer..." : "Tilføj betalingsmiddel"}</Button></div></DialogContent></Dialog>;
}

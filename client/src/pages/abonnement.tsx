import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, openAuthedFile } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, FileText, Users, Building2, AlertTriangle, CreditCard, Package, ExternalLink, Lock } from "lucide-react";
import type { Plan, Subscription, PlatformInvoice } from "@shared/schema";
import { PageHeader, SectionCard } from "@/components/premium";

const FEATURE_LABELS: Record<string, string> = {
  opgaver: "Opgavestyring",
  tidsregistrering: "Tidsregistrering",
  kunder: "Kundekartotek",
  fakturering: "Fakturering med moms",
  vagtplan: "Vagtplan",
  fravaer: "Fravær og ferie",
  fotodokumentation: "Fotodokumentation",
  loen_eksport: "Løneksport",
  regnskab_eksport: "Regnskabseksport",
  geofence: "GPS-kontrol af check-ind",
  api_integration: "Direkte API-integration",
  revisionsspor: "Revisionsspor",
};

const SUB_STATUS: Record<string, { label: string; style: string }> = {
  proeve: { label: "Prøveperiode", style: "badge-soft badge-soft-blue" },
  aktiv: { label: "Aktivt", style: "badge-soft badge-soft-green" },
  i_restance: { label: "I restance", style: "badge-soft badge-soft-amber" },
  opsagt: { label: "Opsagt", style: "badge-soft badge-soft-red" },
};
const INV_STATUS: Record<string, string> = { udstedt: "Udstedt", betalt: "Betalt", forfalden: "Forfalden" };

function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

type SubResponse = {
  subscription: Subscription | null;
  plan: Plan | null;
  usage: { employees: number; maxEmployees: number; customers: number; maxCustomers: number };
  nextCharge: {
    planName: string; billingCycle: string; employeeCount: number;
    netAmount: number; vatAmount: number; totalAmount: number;
    periodStart: string; periodEnd: string;
  } | null;
  invoices: PlatformInvoice[];
};

function parseFeatures(p?: Plan | null): string[] {
  if (!p?.features) return [];
  try {
    const v = JSON.parse(p.features);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export default function Abonnement() {
  const { companyId, user, refresh } = useAuth();
  const { toast } = useToast();
  const [switching, setSwitching] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const canChange = user?.role === "leder" || user?.role === "platform_admin";

  const { data, isLoading } = useQuery<SubResponse>({
    queryKey: ["/api/subscription", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/subscription?companyId=${companyId}`)).json(),
  });
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/plans")).json(),
  });

  const { data: billingStatus } = useQuery<any>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => (await apiRequest("GET", "/api/billing/status")).json(),
  });

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await apiRequest("POST", "/api/billing/create-checkout-session", {});
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Stripe ikke konfigureret", description: data.error ?? "Kunne ikke starte betaling", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message ?? "Kunne ikke starte betaling", variant: "destructive" });
    }
    setCheckoutLoading(false);
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await apiRequest("POST", "/api/billing/create-portal-session", {});
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Portal ikke tilgængelig", description: data.error ?? "Gennemfør først en betaling", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message ?? "Kunne ikke åbne portal", variant: "destructive" });
    }
    setPortalLoading(false);
  };

  const changePlan = useMutation({
    mutationFn: async (planId: number) =>
      (await apiRequest("POST", `/api/subscription/plan?companyId=${companyId}`, { planId })).json(),
    onSuccess: async (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      await refresh();
      toast({ title: `Pakken er ændret til ${d.plan.name}` });
    },
    onError: (e: any) => toast({ title: "Kunne ikke skifte pakke", description: e.message, variant: "destructive" }),
    onSettled: () => setSwitching(null),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-md" />)}
        </div>
      </div>
    );
  }

  const sub = data?.subscription;
  const plan = data?.plan;
  const usage = data?.usage;
  const next = data?.nextCharge;
  const status = sub ? SUB_STATUS[sub.status] ?? { label: sub.status, style: "bg-muted" } : null;
  const currentFeatures = parseFeatures(plan);

  const limitText = (used: number, max: number) => (max < 0 ? `${used} / ubegrænset` : `${used} / ${max}`);
  const limitPct = (used: number, max: number) => (max < 0 ? 0 : Math.min(100, (used / max) * 100));

  return (
    <div className="p-4 md:p-4 space-y-3 max-w-6xl mx-auto">
      <PageHeader eyebrow="Abonnement" title="Abonnement" description="Din pakke og abonnement" />

      {sub?.status === "i_restance" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex gap-2 items-start" data-testid="notice-arrears">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Der er en ubetalt abonnementsfaktura. Betal den for at undgå, at adgangen spærres.
          </p>
        </div>
      )}

      <SectionCard data-testid="card-current-plan" className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground" data-testid="text-current-plan">{plan?.name ?? "Ingen pakke"}</h2>
              {status && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${status.style}`} data-testid="status-subscription">
                  {status.label}
                </span>
              )}
            </div>
            {plan?.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
          </div>
          {next && (
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Næste opkrævning</p>
              <p className="text-lg font-bold text-foreground tabular-nums" data-testid="text-next-charge">
                {formatCurrency(next.totalAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground">inkl. moms · {dk(next.periodEnd)}</p>
            </div>
          )}
        </div>

        {sub?.status === "proeve" && sub.trialEndsAt && (
          <p className="text-xs text-blue-700 dark:text-blue-400" data-testid="text-trial-ends">
            Prøveperioden udløber {dk(sub.trialEndsAt)}. Der opkræves intet før da.
          </p>
        )}

        {usage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />Ansatte
                </span>
                <span className="font-medium text-foreground tabular-nums" data-testid="text-usage-employees">
                  {limitText(usage.employees, usage.maxEmployees)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${limitPct(usage.employees, usage.maxEmployees)}%` }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />Kunder
                </span>
                <span className="font-medium text-foreground tabular-nums" data-testid="text-usage-customers">
                  {limitText(usage.customers, usage.maxCustomers)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${limitPct(usage.customers, usage.maxCustomers)}%` }} />
              </div>
            </div>
          </div>
        )}

        {next && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-0.5">
            <p>
              Beregning: {plan?.name} grundpris + {next.employeeCount} ansatte × {formatCurrency(plan?.pricePerEmployee ?? 0)} pr. ansat
              {sub?.billingCycle === "aarlig" ? " · årlig betaling (12 måneder til 10 måneders pris)" : " · månedlig betaling"}
            </p>
            <p className="tabular-nums">
              {formatCurrency(next.netAmount)} ekskl. moms + {formatCurrency(next.vatAmount)} moms = {formatCurrency(next.totalAmount)}
            </p>
          </div>
        )}
      </SectionCard>

      {/* Betaling sektion */}
      {canChange && (
        <SectionCard data-testid="card-billing" className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Betaling</h2>
          </div>

          {/* Integration status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${billingStatus?.stripeConfigured ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`} data-testid="status-stripe">
              {billingStatus?.stripeConfigured ? "Stripe konfigureret" : "Stripe ikke konfigureret"}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${billingStatus?.emailConfigured ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`} data-testid="status-email">
              {billingStatus?.emailConfigured ? "Email konfigureret" : "Email ikke konfigureret"}
            </span>
            {billingStatus?.hasPaymentMethod && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid="status-payment-method">
                Betalingskort tilknyttet
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="button-checkout"
              onClick={startCheckout}
              disabled={checkoutLoading || !billingStatus?.stripeConfigured}
              className="gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {checkoutLoading ? "Starter..." : "Betal abonnement"}
            </Button>
            <Button
              data-testid="button-portal"
              variant="outline"
              onClick={openPortal}
              disabled={portalLoading || !billingStatus?.stripeConfigured || !billingStatus?.hasPaymentMethod}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? "Åbner..." : "Styr abonnement (Stripe portal)"}
            </Button>
          </div>

          {!billingStatus?.stripeConfigured && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex gap-2 items-start">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Betaling er i testtilstand. Sæt <code className="font-mono">STRIPE_SECRET_KEY</code> og <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> i miljøet for at aktivere reel betaling.
              </p>
            </div>
          )}
        </SectionCard>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pakker</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(plans ?? []).map((p) => {
            const isCurrent = p.id === plan?.id;
            const feats = parseFeatures(p);
            return (
              <div key={p.id} data-testid={`card-plan-${p.slug}`}
                className={`rounded-md border bg-card p-3 flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold text-foreground">{p.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                      Nuværende
                    </span>
                  )}
                </div>
                <p className="mt-2">
                  <span className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(p.monthlyPrice)}</span>
                  <span className="text-[11px] text-muted-foreground"> /md</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  + {formatCurrency(p.pricePerEmployee)} pr. ansat pr. måned, ekskl. moms
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {p.maxEmployees < 0 ? "Ubegrænset antal ansatte" : `Op til ${p.maxEmployees} ansatte`} ·{" "}
                  {p.maxCustomers < 0 ? "ubegrænset antal kunder" : `${p.maxCustomers} kunder`}
                </p>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {feats.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11px] text-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-px" />
                      {FEATURE_LABELS[f] ?? f}
                    </li>
                  ))}
                </ul>
                {canChange && !isCurrent && (
                  <Button className="w-full mt-4" size="sm" data-testid={`button-select-plan-${p.slug}`}
                    disabled={changePlan.isPending}
                    onClick={() => { setSwitching(p.id); changePlan.mutate(p.id); }}>
                    {switching === p.id && changePlan.isPending
                      ? "Skifter..."
                      : p.monthlyPrice > (plan?.monthlyPrice ?? 0) ? "Opgradér" : "Skift til denne"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {currentFeatures.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Funktioner uden for din pakke er spærret i appen — du får en tydelig besked i stedet for en fejl.
          </p>
        )}
      </div>

      <SectionCard data-testid="card-platform-invoices" title="Abonnementsfakturaer fra ADD SmartRegnskab" icon={<Package className="w-4 h-4" />} className="space-y-3">
        {(data?.invoices ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-2" data-testid="empty-platform-invoices">
            Der er endnu ikke udstedt nogen abonnementsfaktura.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3">
            <table className="table-premium min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground border-b border-border/50">
                  <th className="py-2 font-medium">Fakturanr.</th>
                  <th className="py-2 font-medium">Periode</th>
                  <th className="py-2 font-medium text-right">Beløb</th>
                  <th className="py-2 font-medium">Forfald</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.invoices ?? []).map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0" data-testid={`row-platform-invoice-${inv.id}`}>
                    <td className="py-2 font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="py-2 text-[11px] text-muted-foreground">{dk(inv.periodStart)} – {dk(inv.periodEnd)}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{formatCurrency(inv.totalAmount)}</td>
                    <td className="py-2 text-[11px] text-muted-foreground">{dk(inv.dueDate)}</td>
                    <td className="py-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        inv.status === "betalt" ? "badge-soft badge-soft-green"
                        : inv.status === "forfalden" ? "badge-soft badge-soft-red"
                        : "bg-muted text-muted-foreground"}`}>
                        {INV_STATUS[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" data-testid={`button-platform-invoice-pdf-${inv.id}`}
                        onClick={() => openAuthedFile(`/api/subscription/invoices/${inv.id}/pdf?companyId=${companyId}`)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard className="flex gap-2 items-start">
        <CreditCard className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Der er ikke koblet en betalingsudbyder på. Abonnementsfakturaer udstedes af ADD SmartRegnskab og markeres betalt manuelt.
          Til drift skal Stripe, MobilePay eller Betalingsservice sættes op, så kortbetaling og automatisk fornyelse virker.
        </p>
      </SectionCard>
    </div>
  );
}

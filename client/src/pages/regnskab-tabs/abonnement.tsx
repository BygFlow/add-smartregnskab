import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, FileText, Loader2, Package, ShieldCheck, Sparkles } from "lucide-react";
import { apiRequest, openAuthedFile } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SectionCard, StatusChip } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { POSTING_PRICE_TIERS, estimatedMonthlyDocuments } from "@shared/posting-pricing";

type Plan = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  monthlyPrice: number;
  maxUsers: number;
  maxEmployees: number;
  maxDocuments: number;
  maxEntries: number;
  maxCompanies: number;
  maxIntegrations: number;
  includedCompanies: number;
  additionalCompanyPrice: number;
  includedAiCredits: number;
  aiAddonPrice: number;
  aiAddonCredits: number;
  aiCreditsPerAdditionalCompany: number;
  features?: string | string[] | null;
};

type SubscriptionOverview = {
  subscription: {
    id: number;
    planId: number;
    status: string;
    billingCycle: string;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    autoRenew?: number;
    cancelledAt?: string | null;
  } | null;
  plan: Plan | null;
  usage: {
    documents: number; maxDocuments: number;
    entries: number; maxEntries: number;
    postingMonthlySurcharge?: number; postingContactRequired?: boolean;
    postingPeriodStart?: string; postingPeriodEnd?: string;
    companies: number; maxCompanies: number;
    integrations: number; maxIntegrations: number;
  };
  nextCharge?: { totalAmount?: number; netAmount?: number; additionalCompanyCount?: number; additionalCompanyCharge?: number; aiAddonEnabled?: boolean; aiAddonCharge?: number; aiCreditsIncluded?: number; postingMonthlySurcharge?: number; postingTierLimit?: number } | null;
  invoices: Array<{ id: number; invoiceNumber?: string; issueDate?: string; dueDate?: string; totalAmount?: number; status?: string }>;
};

type AiUsage = {
  includedCredits: number; usedCredits: number; remainingCredits: number;
  estimatedCostDkk: number; costCapDkk: number; percent: number;
  warningLevel: "normal" | "advarsel" | "kritisk" | "stoppet";
  allowed: boolean; aiAddonEnabled: boolean; aiAddonAvailable: boolean;
};

type BillingStatus = {
  quickpayConfigured: boolean;
  hasPaymentMethod: boolean;
  paymentMethods: Array<{ provider: string; brand?: string | null; last4?: string | null; status: string; isDefault: boolean }>;
};

const featureLabels: Record<string, string> = {
  regnskab: "Bogføring og kontoplan",
  bilag: "Bilag og udgifter",
  fakturering: "Fakturering og kreditnotaer",
  moms: "Moms og skat",
  rapporter: "Rapporter",
  bank: "Automatisk bankintegration",
  ai_bogforing: "AI-bogføringsforslag",
  automation: "Automatisering og regler",
  revision: "Revisionsspor og kontrol",
  backup: "Krypteret ekstern backup",
};

function money(value: unknown) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function features(raw: Plan["features"]): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function limit(value: number) {
  return value === -1 ? "Ubegrænset" : new Intl.NumberFormat("da-DK").format(value);
}

export default function Abonnement() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = user?.role === "leder";
  const overview = useQuery<SubscriptionOverview>({
    queryKey: ["/api/subscription"],
    queryFn: async () => (await apiRequest("GET", "/api/subscription")).json(),
  });
  const plans = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/plans")).json(),
  });
  const billing = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => (await apiRequest("GET", "/api/billing/status")).json(),
  });
  const aiUsage = useQuery<AiUsage>({
    queryKey: ["/api/ai-usage"],
    queryFn: async () => (await apiRequest("GET", "/api/ai-usage")).json(),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    if (params.get("quickpay") === "ok") {
      toast({ title: "QuickPay-godkendelse modtaget", description: "Betalingsaftalen aktiveres, når den signerede bekræftelse er modtaget." });
      billing.refetch();
    } else if (params.get("quickpay") === "cancelled") {
      toast({ title: "Betalingen blev afbrudt", description: "Der er ikke trukket penge.", variant: "destructive" });
    }
  }, []);

  const changePlan = useMutation({
    mutationFn: async (planId: number) => (await apiRequest("POST", "/api/subscription/plan", { planId })).json(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] }),
        refresh(),
      ]);
      toast({ title: "Pakken er ændret", description: "Den nye pris bruges ved næste fakturering." });
    },
    onError: (error: unknown) => toast({ title: "Pakken kunne ikke ændres", description: error instanceof Error ? error.message : "Prøv igen.", variant: "destructive" }),
  });

  const startQuickPay = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/billing/create-checkout-session", {})).json(),
    onSuccess: (result) => {
      if (!result?.url) throw new Error("QuickPay returnerede ikke et betalingslink.");
      window.location.assign(result.url);
    },
    onError: (error: unknown) => toast({ title: "QuickPay kunne ikke startes", description: error instanceof Error ? error.message : "Prøv igen.", variant: "destructive" }),
  });
  const toggleAiAddon = useMutation({
    mutationFn: async (enabled: boolean) => (await apiRequest("POST", "/api/subscription/ai-addon", { enabled })).json(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/ai-usage"] }),
      ]);
      toast({ title: "AI-tilkøbet er opdateret", description: "Ændringen vises på næste abonnementsfaktura." });
    },
    onError: (error: unknown) => toast({ title: "AI-tilkøbet kunne ikke ændres", description: error instanceof Error ? error.message : "Prøv igen.", variant: "destructive" }),
  });

  const currentPlan = overview.data?.plan;
  const subscription = overview.data?.subscription;
  const paymentMethod = billing.data?.paymentMethods?.find((method) => method.provider === "quickpay" && method.status === "aktiv");
  const toggleRenewal = useMutation({
    mutationFn: async (autoRenew: boolean) => (await apiRequest("POST", "/api/payment/autorenew", { autoRenew })).json(),
    onSuccess: async (_result, autoRenew) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] }),
      ]);
      toast({
        title: autoRenew ? "Abonnementet fortsætter" : "Opsigelsen er registreret",
        description: autoRenew
          ? "Automatisk fornyelse er slået til igen."
          : `Adgangen fortsætter til og med ${subscription?.currentPeriodEnd ?? "den betalte periodes udløb"}.`,
      });
    },
    onError: (error: unknown) => toast({ title: "Abonnementet kunne ikke opdateres", description: error instanceof Error ? error.message : "Prøv igen.", variant: "destructive" }),
  });

  return <div className="space-y-5">
    <PageHeader title="Abonnement og betaling" description="Vælg pakke, administrér betalingsaftalen og hent abonnementsfakturaer." />

    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title="Aktuel pakke" icon={<Package className="h-4 w-4" />}>
        {overview.isLoading ? <Skeleton className="h-24 w-full" /> : <div className="space-y-3">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xl font-semibold">{currentPlan?.name ?? "Ingen pakke"}</p><p className="text-sm text-muted-foreground">{currentPlan ? `${money(currentPlan.monthlyPrice)} pr. måned ekskl. moms` : "Kontakt support"}</p></div><StatusChip status={subscription?.status ?? "ukendt"} /></div>
          <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-muted p-3"><span className="block text-muted-foreground">Fakturering</span><strong>{subscription?.billingCycle === "aarlig" ? "Årlig" : "Månedlig"}</strong></div><div className="rounded-lg bg-muted p-3"><span className="block text-muted-foreground">{subscription?.autoRenew === 0 ? "Adgang til" : "Næste periode"}</span><strong>{subscription?.currentPeriodEnd ?? "—"}</strong></div></div>
          {canManage && subscription && <div className="rounded-lg border p-3 text-xs"><p className="mb-2 text-muted-foreground">{subscription.autoRenew === 0 ? "Abonnementet er opsagt til periodens udløb. Der trækkes ikke automatisk igen." : "Abonnementet fornyes automatisk med det aktive betalingsmiddel."}</p><Button size="sm" variant="outline" disabled={toggleRenewal.isPending} onClick={() => { const next = subscription.autoRenew === 0; if (next || window.confirm(`Opsig abonnementet ved periodens udløb ${subscription.currentPeriodEnd ?? ""}?`)) toggleRenewal.mutate(next); }}>{toggleRenewal.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}{subscription.autoRenew === 0 ? "Fortryd opsigelse" : "Opsig ved periodens udløb"}</Button></div>}
          {overview.data?.usage && <div className="grid grid-cols-2 gap-2 text-[11px]"><div>Bilag i regnskabsåret: <strong>{overview.data.usage.documents} · fri opbevaring</strong></div><div>Posteringer i regnskabsåret: <strong>{overview.data.usage.entries}/{limit(overview.data.usage.maxEntries)}</strong></div><div>Virksomheder: <strong>{overview.data.usage.companies}/{limit(overview.data.usage.maxCompanies)}</strong></div><div>Integrationer: <strong>{overview.data.usage.integrations} · ubegrænset</strong></div></div>}
          {overview.data?.usage && <div className={`rounded-lg border p-3 text-xs ${overview.data.usage.postingContactRequired ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-muted/40"}`}><strong>Posteringstillæg: {money(overview.data.usage.postingMonthlySurcharge ?? 0)}/md.</strong><span className="mt-1 block">Regnskabsår {overview.data.usage.postingPeriodStart ?? "—"} – {overview.data.usage.postingPeriodEnd ?? "—"}. {overview.data.usage.postingContactRequired ? "Kontakt os for en individuel aftale." : "Trinnet reguleres automatisk efter årsforbruget."}</span></div>}
        </div>}
      </SectionCard>

      <SectionCard title="Betalingsaftale" icon={<CreditCard className="h-4 w-4" />}>
        {billing.isLoading ? <Skeleton className="h-24 w-full" /> : <div className="space-y-3">
          <div className="flex items-center justify-between"><div><p className="font-medium">QuickPay</p><p className="text-xs text-muted-foreground">Sikker, tilbagevendende kortbetaling</p></div><StatusChip status={paymentMethod ? "aktiv" : billing.data?.quickpayConfigured ? "mangler" : "ikke konfigureret"} /></div>
          {paymentMethod?.last4 && <p className="text-sm">Kort, der slutter på <strong>{paymentMethod.last4}</strong></p>}
          {canManage ? <Button className="w-full" disabled={!billing.data?.quickpayConfigured || startQuickPay.isPending} onClick={() => startQuickPay.mutate()}>{startQuickPay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{paymentMethod ? "Skift betalingskort" : "Opret betalingsaftale"}</Button> : <p className="text-xs text-muted-foreground">Kun virksomhedens administrator kan ændre betalingsaftalen.</p>}
        </div>}
      </SectionCard>

      <SectionCard title="Sikker betaling" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="space-y-2 text-sm text-muted-foreground"><p>ADD SmartRegnskab gemmer ikke kortnummer eller kontrolcifre.</p><p>Betaling gennemføres hos QuickPay, og aftalen aktiveres først efter en signeret bekræftelse.</p></div>
      </SectionCard>
    </div>

    <SectionCard title="AI-forbrug og omkostningskontrol" icon={<Sparkles className="h-4 w-4" />}>
      {aiUsage.isLoading ? <Skeleton className="h-24 w-full" /> : <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold">{aiUsage.data?.usedCredits ?? 0} / {aiUsage.data?.includedCredits ?? 0} AI-handlinger</p><StatusChip status={aiUsage.data?.warningLevel ?? "normal"} /></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, aiUsage.data?.percent ?? 0)}%` }} /></div>
          <p className="text-xs text-muted-foreground">Estimeret leverandøromkostning: {money(aiUsage.data?.estimatedCostDkk)} af et internt loft på {money(aiUsage.data?.costCapDkk)}. Ved grænsen pauses kun betalte AI-kald; regnskabet fortsætter.</p>
        </div>
        {aiUsage.data?.aiAddonAvailable && canManage && <Button variant={aiUsage.data.aiAddonEnabled ? "outline" : "default"} disabled={toggleAiAddon.isPending} onClick={() => toggleAiAddon.mutate(!aiUsage.data?.aiAddonEnabled)}>{toggleAiAddon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{aiUsage.data.aiAddonEnabled ? "Fjern AI-tilkøb" : `Tilføj AI · ${money(currentPlan?.aiAddonPrice)}/md.`}</Button>}
      </div>}
    </SectionCard>

    <SectionCard title="Vælg pakkeløsning" icon={<Package className="h-4 w-4" />}>
      {plans.isLoading ? <Skeleton className="h-52 w-full" /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{(plans.data ?? []).map((plan) => {
        const selected = currentPlan?.id === plan.id;
        const included = features(plan.features);
        return <div key={plan.id} className={`flex flex-col rounded-xl border p-4 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background"}`}>
          <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{plan.name}</p><p className="mt-1 text-2xl font-bold">{money(plan.monthlyPrice)}<span className="text-xs font-normal text-muted-foreground"> / md.</span></p><p className="text-[11px] text-muted-foreground">{money(plan.monthlyPrice * 10)} / år · ekskl. moms</p></div>{selected && <StatusChip status="valgt" />}</div>
          <p className="mt-3 min-h-10 text-xs text-muted-foreground">{plan.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]"><div className="rounded-md bg-muted p-2">Bilag<strong className="block">Ubegrænset</strong></div><div className="rounded-md bg-muted p-2">Posteringer/år<strong className="block">1.000 inkl.</strong></div><div className="rounded-md bg-muted p-2">Virksomheder<strong className="block">{limit(plan.maxCompanies)}</strong></div><div className="rounded-md bg-muted p-2">Integrationer<strong className="block">Ubegrænset</strong></div></div>
          <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-[11px]">{plan.includedAiCredits > 0 ? <><strong>{new Intl.NumberFormat("da-DK").format(plan.includedAiCredits)} AI-handlinger inkluderet</strong>{plan.aiCreditsPerAdditionalCompany > 0 && <span className="block text-muted-foreground">+{new Intl.NumberFormat("da-DK").format(plan.aiCreditsPerAdditionalCompany)} pr. ekstra CVR</span>}</> : <><strong>AI som tilkøb</strong><span className="block text-muted-foreground">{new Intl.NumberFormat("da-DK").format(plan.aiAddonCredits)} handlinger for {money(plan.aiAddonPrice)}/md.</span></>}</div>
          {plan.additionalCompanyPrice > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{plan.includedCompanies} CVR inkluderet · +{money(plan.additionalCompanyPrice)} pr. ekstra CVR. SE-numre er inkluderet.</p>}
          <ul className="my-4 flex-1 space-y-1.5 text-xs">{included.slice(0, 6).map((feature) => <li key={feature} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>{featureLabels[feature] ?? feature.replaceAll("_", " ")}</span></li>)}</ul>
          <Button variant={selected ? "outline" : "default"} disabled={selected || !canManage || changePlan.isPending} onClick={() => { if (window.confirm(`Skift abonnement til ${plan.name} for ${money(plan.monthlyPrice)} pr. måned ekskl. moms?`)) changePlan.mutate(plan.id); }}>{changePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selected ? "Aktuel pakke" : "Vælg pakke"}</Button>
        </div>;
      })}</div>}
      {!canManage && <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">Kun virksomhedens administrator kan skifte pakke. Alle brugere kan se priser og indhold.</p>}
    </SectionCard>

    <SectionCard title="Posteringstrin" icon={<FileText className="h-4 w-4" />}>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">Prisen følger det samlede antal posteringer i kundeorganisationens regnskabsår. Bilag, brugere og integrationer begrænses ikke.</p>
      <div className="divide-y sm:hidden">{POSTING_PRICE_TIERS.map((tier) => <div className="grid grid-cols-[1fr_auto] gap-2 py-3 text-xs" key={tier.annualLimit}><div><strong>Op til {limit(tier.annualLimit)}</strong><span className="mt-1 block text-muted-foreground">ca. {limit(estimatedMonthlyDocuments(tier.annualLimit))} bilag/md.</span></div><strong>{tier.monthlySurcharge ? `+${money(tier.monthlySurcharge)}/md.` : "Inkluderet"}</strong></div>)}</div>
      <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-3 font-medium">Posteringer/år</th><th className="py-2 pr-3 font-medium">Ca. bilag/md.</th><th className="py-2 font-medium">Tillæg/md.</th></tr></thead><tbody className="divide-y">{POSTING_PRICE_TIERS.map((tier) => <tr key={tier.annualLimit}><td className="py-2 pr-3 font-medium">Op til {limit(tier.annualLimit)}</td><td className="py-2 pr-3">ca. {limit(estimatedMonthlyDocuments(tier.annualLimit))}</td><td className="py-2">{tier.monthlySurcharge ? `+${money(tier.monthlySurcharge)}` : "Inkluderet"}</td></tr>)}</tbody></table></div>
    </SectionCard>

    <SectionCard title="Abonnementsfakturaer" icon={<FileText className="h-4 w-4" />} noPadding>
      {overview.isLoading ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : !overview.data?.invoices?.length ? <p className="p-5 text-sm text-muted-foreground">Der er endnu ingen abonnementsfakturaer.</p> : <div className="divide-y">{overview.data.invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{invoice.invoiceNumber ?? `Faktura ${invoice.id}`}</p><p className="text-xs text-muted-foreground">{invoice.issueDate ?? "—"} · Forfalder {invoice.dueDate ?? "—"}</p></div><strong className="text-sm">{money(invoice.totalAmount)}</strong><StatusChip status={invoice.status ?? "ukendt"} /><Button size="sm" variant="outline" onClick={() => openAuthedFile(`/api/subscription/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber ?? "abonnementsfaktura"}.pdf`)}>Hent PDF</Button></div>)}</div>}
    </SectionCard>
  </div>;
}

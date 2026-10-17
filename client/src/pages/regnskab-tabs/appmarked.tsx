import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SMARTREGNSKAB_ADDONS, isSmartRegnskabAddonIncluded } from "@/lib/smartregnskab-addons";
import { LegalPreviewDialog } from "@/pages/marketing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard, StatusChip } from "@/components/premium";
import { ArrowRight, Building2, Check, CheckCircle2, Loader2, Package, Plug, ShieldCheck, Sparkles } from "lucide-react";

type Catalog = {
  version: string;
  products: Array<{ id: string; name: string; role: string }>;
  security: string[];
};

type IntegrationConfig = {
  id: number;
  provider?: string | null;
  type?: string | null;
  status?: string | null;
};

type ApiKey = {
  id: number;
  name?: string | null;
  status?: string | null;
};

type Plan = {
  id: number;
  name: string;
  description?: string | null;
  monthlyPrice: number;
  maxCompanies: number;
  includedCompanies: number;
  additionalCompanyPrice: number;
  includedAiCredits: number;
  aiAddonPrice: number;
  aiAddonCredits: number;
  aiCreditsPerAdditionalCompany: number;
  features?: string | string[] | null;
};

type SubscriptionOverview = {
  plan?: Plan | null;
  subscription?: { planId: number; status: string } | null;
};

type AiUsage = {
  aiAddonEnabled: boolean;
  aiAddonAvailable: boolean;
};

const externalApps = [
  { name: "AiiA / Mastercard Open Banking", category: "Bank", description: "Automatisk bankdata og afstemningsgrundlag via kundens samtykke.", route: "bank_integrationer" },
  { name: "Sproom", category: "E-fakturering", description: "NemHandel og Peppol til afsendelse og modtagelse af e-fakturaer.", route: "einvoice_queue" },
  { name: "QuickPay", category: "Betaling", description: "Abonnementer og tilbagevendende betalinger uden opbevaring af kortdata.", route: "abonnement" },
  { name: "Danløn", category: "Løn", description: "Overfør godkendte lønlinjer via en kundestyret API-aftale.", route: "integration_configs" },
  { name: "e-conomic", category: "Regnskab", description: "Valgfri udveksling med kundens eksisterende e-conomic-aftale.", route: "integration_configs" },
];

function openTab(tab: string) {
  window.location.hash = `/smartregnskab/app/${tab}`;
}

function money(value: unknown) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function planFeatures(raw: Plan["features"]): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

export default function Appmarked({ companyId }: { companyId: number }) {
  const { hasFeature, hasAI, user, refresh } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiTermsAccepted, setAiTermsAccepted] = useState(false);
  const [packageTermsAccepted, setPackageTermsAccepted] = useState(false);
  const [showSubscriptionTerms, setShowSubscriptionTerms] = useState(false);
  const catalog = useQuery<Catalog>({
    queryKey: ["/api/add-connect/catalog"],
    queryFn: async () => (await apiRequest("GET", "/api/add-connect/catalog")).json(),
  });
  const configs = useQuery<IntegrationConfig[]>({
    queryKey: ["/api/integration-configs", companyId],
    queryFn: async () => {
      const json = await (await apiRequest("GET", `/api/integration-configs?companyId=${companyId}`)).json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });
  const apiKeys = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys", companyId],
    queryFn: async () => {
      const json = await (await apiRequest("GET", `/api/api-keys?companyId=${companyId}`)).json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });
  const subscription = useQuery<SubscriptionOverview>({
    queryKey: ["/api/subscription"],
    queryFn: async () => (await apiRequest("GET", "/api/subscription")).json(),
  });
  const plans = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/plans")).json(),
  });
  const aiUsage = useQuery<AiUsage>({
    queryKey: ["/api/ai-usage"],
    queryFn: async () => (await apiRequest("GET", "/api/ai-usage")).json(),
  });
  const toggleAiAddon = useMutation({
    mutationFn: async (enabled: boolean) => (await apiRequest("POST", "/api/subscription/ai-addon", {
      enabled,
      termsAccepted: enabled ? aiTermsAccepted : undefined,
      termsVersion: enabled ? "2026-09-22" : undefined,
    })).json(),
    onSuccess: async (_result, enabled) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/ai-usage"] }),
      ]);
      setAiTermsAccepted(false);
      toast({
        title: enabled ? "AI-tilkøbet er aktiveret" : "AI-tilkøbet er fjernet",
        description: enabled ? "Prisen medtages på næste abonnementsfaktura." : "Adgangen er stoppet, og tilkøbet medtages ikke på næste faktura.",
      });
    },
    onError: (error: unknown) => toast({
      title: "AI-tilkøbet kunne ikke ændres",
      description: error instanceof Error ? error.message : "Prøv igen.",
      variant: "destructive",
    }),
  });
  const changePlan = useMutation({
    mutationFn: async (planId: number) => (await apiRequest("POST", "/api/subscription/plan", {
      planId,
      termsAccepted: packageTermsAccepted,
      termsVersion: "2026-09-22",
    })).json(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/ai-usage"] }),
        refresh(),
      ]);
      setPackageTermsAccepted(false);
      toast({ title: "Pakken er ændret", description: "Den nye månedlige pris bruges ved næste fakturering." });
    },
    onError: (error: unknown) => toast({
      title: "Pakken kunne ikke ændres",
      description: error instanceof Error ? error.message : "Prøv igen.",
      variant: "destructive",
    }),
  });

  const connected = (name: string) => (configs.data ?? []).some((item) =>
    item.status === "forbundet" && String(item.provider || item.type || "").toLowerCase().includes(name.toLowerCase()),
  );
  const addProductConnected = (productId: string) => {
    const needle = productId === "smartdrift_pro" ? "pro" : "clean";
    return (apiKeys.data ?? []).some((key) => key.status === "aktiv"
      && String(key.name || "").toLowerCase().includes(needle));
  };

  return <div className="space-y-6" data-testid="page-appmarked">
    <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 text-white shadow-sm sm:p-8">
      <div className="max-w-3xl">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200"><Sparkles className="h-4 w-4" /> ADD Appmarked</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Forbind driften med regnskabet</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">ADD Connect lader virksomheden vælge præcis hvilke data der må flyttes. SmartDrift Pro og Clean leverer fakturagrundlag; SmartRegnskab er regnskabssystemet og bevarer revisionssporet.</p>
      </div>
    </section>

    <section className="space-y-3" data-testid="addon-module-catalog">
      <div><h2 className="text-lg font-semibold">Tilkøb og tillægsmoduler</h2><p className="text-sm text-muted-foreground">Valgfrie moduler findes her, så de ikke blander sig med virksomhedens daglige arbejdsgange.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SMARTREGNSKAB_ADDONS.map((module) => {
          const included = isSmartRegnskabAddonIncluded(module, { hasFeature, hasAI });
          const isAi = module.feature === "ai_bogforing";
          const canToggleAi = isAi && user?.role === "leder" && aiUsage.data?.aiAddonAvailable;
          const aiAddonPrice = Number(subscription.data?.plan?.aiAddonPrice ?? 0);
          const aiAddonCredits = Number(subscription.data?.plan?.aiAddonCredits ?? 0);
          return <article key={module.name} className="flex min-h-44 flex-col rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><Badge variant={included ? "default" : "secondary"} className="mb-2">{included ? "Inkluderet" : module.category}</Badge><h3 className="font-semibold">{module.name}</h3></div><Sparkles className="h-5 w-5 text-primary" /></div>
          <p className="mt-2 flex-1 text-sm leading-5 text-muted-foreground">{module.description}</p>
          {isAi && aiUsage.data?.aiAddonAvailable && <p className="mt-2 text-xs font-medium">{aiAddonCredits.toLocaleString("da-DK")} handlinger · {aiAddonPrice.toLocaleString("da-DK")} kr./md. ekskl. moms</p>}
          {canToggleAi && !included && <label className="mt-3 flex items-start gap-2 text-xs leading-5">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={aiTermsAccepted} onChange={(event) => setAiTermsAccepted(event.target.checked)} />
            <span>Jeg accepterer <button type="button" className="font-semibold text-primary underline" onClick={(event) => { event.preventDefault(); setShowSubscriptionTerms(true); }}>abonnementsbetingelserne</button> for dette tilkøb.</span>
          </label>}
          {canToggleAi && aiUsage.data?.aiAddonEnabled ? <Button variant="outline" className="mt-4 w-full justify-between" disabled={toggleAiAddon.isPending} onClick={() => { if (window.confirm("Fjern AI-tilkøbet nu? AI-adgangen stopper med det samme.")) toggleAiAddon.mutate(false); }}>Fjern AI-tilkøb <ArrowRight className="h-4 w-4" /></Button>
            : canToggleAi && !included ? <Button className="mt-4 w-full justify-between" disabled={!aiTermsAccepted || toggleAiAddon.isPending} onClick={() => toggleAiAddon.mutate(true)}>Aktivér AI-tilkøb <ArrowRight className="h-4 w-4" /></Button>
              : <Button variant="outline" className="mt-4 w-full justify-between" onClick={() => {
                if (included) openTab(module.route);
                else document.getElementById("appmarked-pakker")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>{included ? "Åbn modul" : "Se pakker og pris her"} <ArrowRight className="h-4 w-4" /></Button>}
        </article>})}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Et modul aktiveres først, når pris, vilkår og eventuelle eksterne aftaler er godkendt. Det er ikke aktivt alene, fordi siden kan åbnes.</p>
    </section>

    <section id="appmarked-pakker" className="scroll-mt-20 space-y-4" data-testid="appmarked-package-selector">
      <div><h2 className="text-lg font-semibold">Pakkeløsninger og moduladgang</h2><p className="text-sm text-muted-foreground">Sammenlign og vælg pakken her i Appmarked. Pakker faktureres månedligt; moduler åbnes først efter en registreret accept.</p></div>
      {user?.role === "leder" && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={packageTermsAccepted} onChange={(event) => setPackageTermsAccepted(event.target.checked)} data-testid="package-terms-checkbox" />
          <span>Jeg accepterer <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={(event) => { event.preventDefault(); setShowSubscriptionTerms(true); }}>abonnementsbetingelserne</button>, den viste månedspris og automatisk fornyelse.</span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Afkrydsningen er obligatorisk og vælges aldrig på forhånd.</p>
      </div>}
      {plans.isLoading || subscription.isLoading ? <Skeleton className="h-64 w-full" /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{(plans.data ?? []).map((plan) => {
        const selected = subscription.data?.plan?.id === plan.id;
        const included = planFeatures(plan.features);
        return <SectionCard key={plan.id} title={plan.name} icon={<Package className="h-4 w-4" />}>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-2"><p className="text-2xl font-bold">{money(plan.monthlyPrice)}<span className="text-xs font-normal text-muted-foreground"> / md. ekskl. moms</span></p>{selected && <StatusChip status="valgt" />}</div>
            <p className="mt-2 min-h-10 text-xs text-muted-foreground">{plan.description}</p>
            <ul className="my-4 flex-1 space-y-1.5 text-xs">{included.slice(0, 7).map((feature) => <li key={feature} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>{featureLabels[feature] ?? feature.replaceAll("_", " ")}</span></li>)}</ul>
            <p className="mb-3 text-[11px] text-muted-foreground">{plan.includedCompanies} CVR inkluderet{plan.additionalCompanyPrice > 0 ? ` · ${money(plan.additionalCompanyPrice)} pr. ekstra CVR` : ""}. SE-numre er inkluderet.</p>
            <Button variant={selected ? "outline" : "default"} disabled={selected || user?.role !== "leder" || !packageTermsAccepted || changePlan.isPending} onClick={() => {
              if (window.confirm(`Skift abonnement til ${plan.name} for ${money(plan.monthlyPrice)} pr. måned ekskl. moms?`)) changePlan.mutate(plan.id);
            }}>{changePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selected ? "Aktuel pakke" : "Vælg pakke"}</Button>
          </div>
        </SectionCard>;
      })}</div>}
      {user?.role !== "leder" && <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">Kun virksomhedens administrator kan skifte pakke. Alle brugere kan se priser og indhold.</p>}
    </section>

    <section className="space-y-3">
      <div><h2 className="text-lg font-semibold">ADD-produkter</h2><p className="text-sm text-muted-foreground">Én sammenhængende produktfamilie med adskilte roller og adgangsgrænser.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {(catalog.data?.products ?? []).map((product) => {
          const isCurrent = product.id === "add_smartregnskab";
          const isConnected = isCurrent || addProductConnected(product.id);
          return <article key={product.id} className="flex min-h-52 flex-col rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-emerald-600/10 p-2 text-emerald-700"><Building2 className="h-5 w-5" /></div><Badge variant={isConnected ? "default" : "outline"}>{isCurrent ? "Aktiv" : isConnected ? "Forbundet" : "Kan forbindes"}</Badge></div>
            <h3 className="mt-4 font-semibold">{product.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-5 text-muted-foreground">{product.role}</p>
            {!isCurrent && <Button className="mt-4 w-full" variant={isConnected ? "outline" : "default"} onClick={() => openTab("api_keys_mgmt")}><Plug className="mr-2 h-4 w-4" />{isConnected ? "Administrer nøgle" : "Opret forbindelsesnøgle"}</Button>}
          </article>;
        })}
      </div>
    </section>

    <section className="space-y-3">
      <div><h2 className="text-lg font-semibold">Eksterne apps</h2><p className="text-sm text-muted-foreground">Aktiveres kun med kundens egen aftale, credentials og samtykke.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {externalApps.map((app) => <article key={app.name} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3"><div><Badge variant="secondary" className="mb-2">{app.category}</Badge><h3 className="font-semibold">{app.name}</h3></div><Plug className="h-5 w-5 text-muted-foreground" /></div>
          <p className="mt-2 min-h-12 text-sm text-muted-foreground">{app.description}</p>
          <Button variant="ghost" className="mt-3 w-full justify-between" onClick={() => openTab(app.route)}>Se opsætning <ArrowRight className="h-4 w-4" /></Button>
        </article>)}
      </div>
    </section>

    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" /><div><h2 className="font-semibold">Sikker forbindelse som standard</h2><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">{(catalog.data?.security ?? ["Tenant-isolation", "Eksplicit samtykke", "Revisionsspor", "Idempotente kald"]).map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</span>)}</div></div></div>
    </section>
    <LegalPreviewDialog kind={showSubscriptionTerms ? "subscriptionTerms" : null} onClose={() => setShowSubscriptionTerms(false)} />
  </div>;
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, CheckCircle2, Plug, ShieldCheck, Sparkles } from "lucide-react";

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

export default function Appmarked({ companyId }: { companyId: number }) {
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
  </div>;
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseBackup,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Check = {
  key: string;
  label: string;
  weight: number;
  ok: boolean;
  count: number;
};

type Action = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  count: number;
  route: string;
};

type ControlCenterData = {
  generatedAt: string;
  score: number;
  readiness: "klar" | "opmærksomhed" | "handling_påkrævet";
  checks: Check[];
  actions: Action[];
  totals: {
    overdueInvoices: number;
    pendingBankTransactions: number;
    uncodedVouchers: number;
    draftEntries: number;
    overdueDeadlines: number;
    upcomingDeadlines: number;
    failedIntegrations: number;
  };
  backup: { id: number; createdAt: string; ageHours: number } | null;
  legal: { registeredBookkeepingSystem: "not_verified"; message: string };
};

const severityStyle = {
  critical: "border-red-200 bg-red-50/70 text-red-950 dark:border-red-900 dark:bg-red-950/25 dark:text-red-100",
  warning: "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100",
  info: "border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100",
};

function goTo(route: string) {
  window.location.hash = `#${route}`;
}

export default function Kontrolcenter({ companyId }: { companyId: number }) {
  const query = useQuery<ControlCenterData>({
    queryKey: ["/api/accounting-control-center", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/accounting-control-center")).json(),
    refetchInterval: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4" data-testid="control-center-loading">
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 font-semibold"><CircleAlert className="h-5 w-5" />Kontrolcenteret kunne ikke indlæses</div>
        <p className="mt-1 text-sm text-muted-foreground">Prøv igen. Fejlen ændrer ikke dine regnskabsdata.</p>
        <Button className="mt-4" size="sm" variant="outline" onClick={() => query.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Prøv igen
        </Button>
      </div>
    );
  }

  const data = query.data;
  const readyLabel = data.readiness === "klar" ? "Klar til kontrol" : data.readiness === "opmærksomhed" ? "Kræver opmærksomhed" : "Handling påkrævet";
  const scoreColor = data.score >= 90 ? "text-emerald-600" : data.score >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-5" data-testid="accounting-control-center">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-semibold tracking-tight">Kontrolcenter</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Én prioriteret arbejdsliste på tværs af bank, bilag, fakturaer, frister, integrationer og backup.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Opdatér
        </Button>
      </div>

      <section className="grid gap-4 rounded-xl border bg-card p-5 lg:grid-cols-[190px_1fr]">
        <div className="flex items-center gap-4 lg:block lg:border-r lg:pr-5">
          <div className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{data.score}<span className="text-lg text-muted-foreground">/100</span></div>
          <div className="lg:mt-2">
            <p className="font-medium">{readyLabel}</p>
            <p className="text-xs text-muted-foreground">Live driftsklarhed</p>
          </div>
        </div>
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {data.checks.map((check) => (
            <div key={check.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                  {check.label}
                </span>
                <span className="text-muted-foreground">{check.ok ? "OK" : check.count}</span>
              </div>
              <Progress value={check.ok ? 100 : 0} className="h-1.5" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Næste bedste handling</h3>
            <p className="text-xs text-muted-foreground">Mest kritiske opgaver står øverst og linker direkte til løsningen.</p>
          </div>
          <div className="space-y-2 p-3">
            {data.actions.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <CheckCircle2 className="h-6 w-6" />
                <div><p className="font-medium">Ingen åbne kontrolpunkter</p><p className="text-xs opacity-80">Regnskabets registrerede driftssignaler ser sunde ud.</p></div>
              </div>
            ) : data.actions.map((action) => (
              <div key={action.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${severityStyle[action.severity]}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-xs opacity-75">{action.detail}</p>
                </div>
                <Button size="sm" variant="outline" className="bg-background/70" onClick={() => goTo(action.route)}>
                  Åbn <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-semibold">Hurtigt overblik</h3></div>
          <div className="grid grid-cols-2 gap-px bg-border">
            {[
              [ReceiptText, "Forfaldne fakturaer", data.totals.overdueInvoices],
              [Landmark, "Uafstemte bankposter", data.totals.pendingBankTransactions],
              [Clock3, "Frister næste 30 dage", data.totals.upcomingDeadlines],
              [DatabaseBackup, "Backupalder", data.backup ? `${data.backup.ageHours} t.` : "Mangler"],
            ].map(([Icon, label, value]) => {
              const IconComponent = Icon as typeof ReceiptText;
              return (
                <div key={String(label)} className="bg-card p-4">
                  <IconComponent className="mb-2 h-4 w-4 text-muted-foreground" />
                  <p className="text-xl font-semibold tabular-nums">{String(value)}</p>
                  <p className="text-[11px] text-muted-foreground">{String(label)}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t p-4">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{data.legal.message} Systemets registrering er ikke verificeret.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-4 dark:border-emerald-900 dark:from-emerald-950/25 dark:to-sky-950/25">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold">SmartRegnskabs særlige fordel</p>
            <p className="mt-1 text-xs text-muted-foreground">Regnskab, drift, medarbejdere, kvalitet og kundearbejde ligger i samme platform. Kontrolcenteret gør forbindelsen handlingsorienteret uden at skjule fejl eller kalde en beta-funktion færdig.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

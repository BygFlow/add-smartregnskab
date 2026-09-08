import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, DatabaseBackup, Landmark, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";

type Data = {
  score: number; readiness: string;
  checks: Array<{ key: string; label: string; ok: boolean; count: number }>;
  actions: Array<{ id: string; severity: "critical" | "warning" | "info"; title: string; detail: string; route: string }>;
  totals: { overdueInvoices: number; pendingBankTransactions: number; upcomingDeadlines: number; failedIntegrations: number };
  backup: { ageHours: number } | null;
  legal: { message: string };
};

const colors = {
  critical: "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/25",
  warning: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25",
  info: "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/25",
};

export default function Kontrolcenter({ companyId }: { companyId: number }) {
  const query = useQuery<Data>({
    queryKey: ["/api/accounting-control-center", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/accounting-control-center?companyId=${companyId}`)).json(),
    refetchInterval: 60_000,
  });
  if (query.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (!query.data) return <div className="rounded-lg border border-destructive/30 p-5"><CircleAlert className="mb-2 h-5 w-5" />Kontrolcenteret kunne ikke indlæses.</div>;
  const data = query.data;
  const label = data.score >= 90 ? "Klar til kontrol" : data.score >= 70 ? "Kræver opmærksomhed" : "Handling påkrævet";
  const scoreColor = data.score >= 90 ? "text-emerald-600" : data.score >= 70 ? "text-amber-600" : "text-red-600";
  const go = (route: string) => { window.location.hash = `#${route}`; };

  return <div className="space-y-5" data-testid="accounting-control-center">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-emerald-600" /><h2 className="text-xl font-semibold">Kontrolcenter</h2></div><p className="mt-1 text-sm text-muted-foreground">Én prioriteret arbejdsliste for hele regnskabet.</p></div>
      <Button size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Opdatér</Button>
    </div>
    <section className="grid gap-4 rounded-xl border bg-card p-5 lg:grid-cols-[190px_1fr]">
      <div className="lg:border-r lg:pr-5"><div className={`text-5xl font-bold ${scoreColor}`}>{data.score}<span className="text-lg text-muted-foreground">/100</span></div><p className="mt-2 font-medium">{label}</p><p className="text-xs text-muted-foreground">Live driftsklarhed</p></div>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{data.checks.map((check) => <div key={check.key}><div className="mb-1 flex justify-between text-xs"><span className="flex items-center gap-1.5">{check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}{check.label}</span><span>{check.ok ? "OK" : check.count}</span></div><Progress value={check.ok ? 100 : 0} className="h-1.5" /></div>)}</div>
    </section>
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <section className="rounded-xl border bg-card"><div className="border-b px-4 py-3"><h3 className="font-semibold">Næste bedste handling</h3><p className="text-xs text-muted-foreground">Mest kritiske opgaver står øverst.</p></div><div className="space-y-2 p-3">{data.actions.length === 0 ? <div className="flex gap-3 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30"><CheckCircle2 className="h-6 w-6 text-emerald-600" /><div><p className="font-medium">Ingen åbne kontrolpunkter</p><p className="text-xs text-muted-foreground">Registrerede driftssignaler ser sunde ud.</p></div></div> : data.actions.map((action) => <div key={action.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${colors[action.severity]}`}><div><p className="text-sm font-semibold">{action.title}</p><p className="text-xs text-muted-foreground">{action.detail}</p></div><Button size="sm" variant="outline" className="bg-background/70" onClick={() => go(action.route)}>Åbn <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></div>)}</div></section>
      <section className="rounded-xl border bg-card"><div className="border-b px-4 py-3"><h3 className="font-semibold">Hurtigt overblik</h3></div><div className="grid grid-cols-2 gap-px bg-border">{[
        [ReceiptText, "Forfaldne fakturaer", data.totals.overdueInvoices], [Landmark, "Uafstemte bankposter", data.totals.pendingBankTransactions], [AlertTriangle, "Frister næste 30 dage", data.totals.upcomingDeadlines], [DatabaseBackup, "Backupalder", data.backup ? `${data.backup.ageHours} t.` : "Mangler"],
      ].map(([Icon, text, value]) => { const I = Icon as typeof ReceiptText; return <div key={String(text)} className="bg-card p-4"><I className="mb-2 h-4 w-4 text-muted-foreground" /><p className="text-xl font-semibold">{String(value)}</p><p className="text-[11px] text-muted-foreground">{String(text)}</p></div>; })}</div><div className="border-t p-4 text-xs text-muted-foreground">{data.legal.message} Systemets registrering er ikke verificeret.</div></section>
    </div>
  </div>;
}

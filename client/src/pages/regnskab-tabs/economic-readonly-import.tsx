import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudDownload, KeyRound, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Integration = {
  id: number;
  provider: string;
  status: string;
  hasCredentials?: boolean;
  lastError?: string | null;
};

type Coverage = {
  key: string;
  label: string;
  count: number | null;
  status: "klar" | "tom" | "mangler_adgang" | "fejl";
  required: boolean;
  message?: string;
};

type EconomicRun = {
  id: number;
  accountingYear: string;
  runType: "preflight" | "snapshot";
  status: "afventer" | "koerer" | "faerdig" | "delvis" | "fejlet";
  sourceAgreementNumber?: string | null;
  sourceCompanyName?: string | null;
  recordCount: number;
  fileCount: number;
  warningCount: number;
  errorMessage?: string | null;
  approvedAt?: string | null;
  manifest?: {
    readOnly?: boolean;
    coverage?: Coverage[];
    warnings?: string[];
    period?: { fromDate?: string; toDate?: string; retainUntil?: string };
    files?: Record<string, number>;
  };
};

const YEARS = ["2024", "2025", "2026"];
const STATUS: Record<string, string> = {
  afventer: "Afventer", koerer: "Henter", faerdig: "Færdig", delvis: "Færdig med bemærkninger", fejlet: "Fejlet",
};

function message(error: unknown) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Der opstod en ukendt fejl.";
}

export default function EconomicReadonlyImport({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [year, setYear] = useState("2024");
  const [tokens, setTokens] = useState({ appSecret: "", agreementGrant: "" });

  const integrations = useQuery<Integration[]>({
    queryKey: ["/api/integrations", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/integrations?companyId=${companyId}`)).json(),
  });
  const runs = useQuery<EconomicRun[]>({
    queryKey: ["/api/economic-import/runs", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/economic-import/runs?companyId=${companyId}`)).json(),
    refetchInterval: (query) => (query.state.data || []).some((run) => ["afventer", "koerer"].includes(run.status)) ? 4_000 : false,
  });
  const integration = integrations.data?.find((item) => item.provider.toLowerCase() === "e-conomic");
  const latest = useMemo(() => {
    const yearRuns = (runs.data || []).filter((run) => run.accountingYear === year);
    return {
      preflight: yearRuns.find((run) => run.runType === "preflight"),
      snapshot: yearRuns.find((run) => run.runType === "snapshot"),
    };
  }, [runs.data, year]);
  const previousYear = String(Number(year) - 1);
  const previousApproved = year === "2024" || (runs.data || []).some((run) =>
    run.accountingYear === previousYear && run.runType === "snapshot" && Boolean(run.approvedAt));
  const connectionReady = integration?.status === "forbundet" && integration.hasCredentials;
  const preflightHasRequiredFailures = (latest.preflight?.manifest?.coverage || []).some((item) =>
    item.required && ["fejl", "mangler_adgang"].includes(item.status));
  const preflightReady = latest.preflight && ["faerdig", "delvis"].includes(latest.preflight.status)
    && !preflightHasRequiredFailures;
  const snapshotReady = latest.snapshot && ["faerdig", "delvis"].includes(latest.snapshot.status);
  const busy = [latest.preflight, latest.snapshot].some((run) => run && ["afventer", "koerer"].includes(run.status));

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/integrations", companyId] }),
      qc.invalidateQueries({ queryKey: ["/api/economic-import/runs", companyId] }),
      qc.invalidateQueries({ queryKey: ["/api/migration-jobs"] }),
    ]);
  };

  const connect = useMutation({
    mutationFn: async () => {
      if (!tokens.appSecret.trim() || !tokens.agreementGrant.trim()) {
        throw new Error("Udfyld både AppSecretToken og AgreementGrantToken.");
      }
      let id = integration?.id;
      if (id) {
        await apiRequest("PATCH", `/api/integrations/${id}`, {
          apiKey: tokens.appSecret.trim(), apiSecret: tokens.agreementGrant.trim(), syncMode: "api",
        });
      } else {
        const created = await apiRequest("POST", "/api/integrations", {
          category: "regnskab", provider: "e-conomic", status: "ikke_opsat", syncMode: "api",
          apiKey: tokens.appSecret.trim(), apiSecret: tokens.agreementGrant.trim(), autoSync: 0,
        });
        id = (await created.json()).id;
      }
      if (!id) throw new Error("Integrationen kunne ikke oprettes.");
      const tested = await apiRequest("POST", `/api/integrations/${id}/test`, {});
      const result = await tested.json();
      if (!result.ok) throw new Error(result.message || "e-conomic afviste forbindelsen.");
      return result;
    },
    onSuccess: async () => {
      setTokens({ appSecret: "", agreementGrant: "" });
      await refresh();
      toast({ title: "e-conomic er forbundet", description: "Forbindelsen er testet og nøglerne er krypteret." });
    },
    onError: (error) => toast({ title: "Forbindelsen fejlede", description: message(error), variant: "destructive" }),
  });

  const preflight = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/economic-import/preflight", {
      companyId, integrationId: integration?.id, accountingYear: year,
    })).json(),
    onSuccess: async () => { await refresh(); toast({ title: `${year} er kontrolleret`, description: "Du kan se dækningen nedenfor." }); },
    onError: (error) => toast({ title: "Kontrollen fejlede", description: message(error), variant: "destructive" }),
  });

  const snapshot = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/economic-import/snapshot", {
      companyId, integrationId: integration?.id, accountingYear: year,
    })).json(),
    onSuccess: async () => { await refresh(); toast({ title: `Sikker kopi af ${year} er startet`, description: "Bilag, fakturaer og regnskabsdata hentes til det låste femårsarkiv." }); },
    onError: (error) => toast({ title: "Kopien kunne ikke startes", description: message(error), variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/economic-import/runs/${latest.snapshot?.id}/approve`, {})).json(),
    onSuccess: async () => { await refresh(); toast({ title: `${year} er godkendt`, description: year === "2026" ? "Alle tre år er nu behandlet." : `Du kan nu fortsætte med ${Number(year) + 1}.` }); },
    onError: (error) => toast({ title: "Godkendelsen fejlede", description: message(error), variant: "destructive" }),
  });

  const shownRun = latest.snapshot || latest.preflight;
  const coverage = shownRun?.manifest?.coverage || [];
  return <section className="space-y-4 rounded-xl border bg-card p-4" data-testid="economic-readonly-import">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="font-semibold">Sikker overførsel fra e-conomic</h3></div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Hent 2024, 2025 og 2026 ét år ad gangen. Forbindelsen læser kun data; den skriver eller sletter aldrig noget i e-conomic.</p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" /> Låst femårsarkiv</span>
    </div>

    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4" /> 1. Forbind e-conomic</div>
      <p className="mt-1 text-xs text-muted-foreground">Oplysningerne gemmes krypteret. Indsæt dem kun her – aldrig i chat, mail eller supportbeskeder.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-1.5"><Label htmlFor="economic-app-secret">AppSecretToken</Label><Input id="economic-app-secret" type="password" autoComplete="new-password" value={tokens.appSecret} onChange={(event) => setTokens((value) => ({ ...value, appSecret: event.target.value }))} /></div>
        <div className="space-y-1.5"><Label htmlFor="economic-agreement-grant">AgreementGrantToken</Label><Input id="economic-agreement-grant" type="password" autoComplete="new-password" value={tokens.agreementGrant} onChange={(event) => setTokens((value) => ({ ...value, agreementGrant: event.target.value }))} /></div>
        <Button disabled={connect.isPending} onClick={() => connect.mutate()}>{connect.isPending ? "Tester…" : connectionReady ? "Udskift og test" : "Gem og test"}</Button>
      </div>
      <div className={`mt-2 text-xs ${connectionReady ? "text-emerald-600" : "text-amber-700 dark:text-amber-400"}`}>
        {connectionReady ? "Forbundet og klar til skrivebeskyttet hentning." : integration?.lastError || "Afventer to e-conomic-tokens."}
      </div>
    </div>

    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36 space-y-1.5"><Label>2. Regnskabsår</Label><Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="outline" disabled={!connectionReady || preflight.isPending || busy} onClick={() => preflight.mutate()}><RefreshCw className="mr-2 h-4 w-4" /> {preflight.isPending ? "Kontrollerer…" : "Kontrollér alle data"}</Button>
        <Button disabled={!connectionReady || !preflightReady || !previousApproved || snapshot.isPending || busy || Boolean(latest.snapshot)} onClick={() => snapshot.mutate()}><CloudDownload className="mr-2 h-4 w-4" /> {snapshot.isPending ? "Starter…" : `Hent sikker kopi af ${year}`}</Button>
        {snapshotReady && !latest.snapshot?.approvedAt && <Button variant="secondary" disabled={approve.isPending} onClick={() => approve.mutate()}><CheckCircle2 className="mr-2 h-4 w-4" /> Godkend {year}</Button>}
      </div>
      {!previousApproved && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Godkend først kopien af {previousYear}. Årene behandles 2024 → 2025 → 2026.</p>}
    </div>

    {shownRun && <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium">{shownRun.runType === "snapshot" ? "Sikker kopi" : "Forhåndskontrol"} {shownRun.accountingYear}</span>{shownRun.sourceCompanyName && <span className="ml-2 text-xs text-muted-foreground">{shownRun.sourceCompanyName}</span>}</div><span className="text-sm">{shownRun.approvedAt ? "Godkendt" : STATUS[shownRun.status] || shownRun.status}</span></div>
      <div className="grid gap-2 text-xs sm:grid-cols-3"><div className="rounded bg-muted p-2"><span className="block text-muted-foreground">Poster</span>{shownRun.recordCount}</div><div className="rounded bg-muted p-2"><span className="block text-muted-foreground">Arkivfiler</span>{shownRun.fileCount}</div><div className="rounded bg-muted p-2"><span className="block text-muted-foreground">Bemærkninger</span>{shownRun.warningCount}</div></div>
      {coverage.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{coverage.map((item) => <div key={item.key} className="flex items-start justify-between gap-2 rounded border p-2 text-xs"><div><div className="font-medium">{item.label}</div>{item.message && <div className="mt-1 text-destructive">{item.message}</div>}</div><span className={item.status === "klar" ? "text-emerald-600" : item.status === "tom" ? "text-muted-foreground" : "text-destructive"}>{item.count ?? item.status}</span></div>)}</div>}
      {(shownRun.errorMessage || (shownRun.manifest?.warnings || []).length > 0) && <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-300"><div className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Kontrolpunkter</div>{shownRun.errorMessage && <div>{shownRun.errorMessage}</div>}{(shownRun.manifest?.warnings || []).slice(0, 8).map((warning) => <div key={warning}>{warning}</div>)}</div>}
    </div>}
  </section>;
}

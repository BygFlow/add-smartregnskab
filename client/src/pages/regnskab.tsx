import { useState, useMemo } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { FunctionMenu } from "@/components/function-menu";
import type { FunctionMenuItem } from "@/components/function-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, BookOpen, FileText, Receipt, Calculator, Trash2, Info, BarChart3,
  Settings, CheckCircle2, Printer, Wallet, TrendingUp, TrendingDown,
  Landmark, Scale, Droplet, Plug, AlertTriangle, Link2, Link2Off, Building2,
} from "lucide-react";

/* ---------- helpers ---------- */

function money(value?: number | null) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(value ?? 0);
}
function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const ACCOUNT_TYPE_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  aktiv: "blue",
  passiv: "amber",
  indtaegt: "green",
  udgift: "red",
  mellemregning: "gray",
};
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  passiv: "Passiv",
  indtaegt: "Indtægt",
  udgift: "Udgift",
  mellemregning: "Mellemregning",
};
const ENTRY_STATUS_VARIANT: Record<string, "blue" | "green" | "amber" | "gray"> = {
  kladde: "amber",
  bogført: "green",
  afstemt: "blue",
};

function badgeClass(variant: "blue" | "amber" | "green" | "red" | "gray") {
  switch (variant) {
    case "blue": return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
    case "amber": return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    case "green": return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "red": return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400";
    default: return "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400";
  }
}

/* ---------- types ---------- */

type Overview = {
  revenue?: number; expenses?: number; profit?: number;
  assets?: number; liabilities?: number; equity?: number;
  accountCount?: number; entryCount?: number; vatPeriods?: number;
};
type Account = {
  id: number; accountNumber: string; name: string; type: string;
  vatCode?: string | null; balance?: number | null;
};
type JournalEntry = {
  id: number; entryNumber?: string; date?: string | null; description?: string | null;
  reference?: string | null; sourceType?: string | null; status?: string | null;
};
type JournalLine = {
  id: number; entryId?: number; accountId?: number | null;
  account?: Account; description?: string | null;
  debit?: number | null; credit?: number | null;
};
type VatPeriod = {
  id: number; period?: string | null; type?: string | null;
  outputVat?: number | null; inputVat?: number | null; netVat?: number | null;
  status?: string | null; reportedAt?: string | null;
};

/* ---------- tab config ---------- */

type TabKey = "oversigt" | "kontoplan" | "bogfoering" | "moms" | "integrationer";

/* ===================================================================== */
/*  Main module                                                          */
/* ===================================================================== */

export default function Regnskab() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("oversigt");

  /* ---- queries ---- */
  const { data: overview, isLoading: ovLoading } = useQuery<Overview>({
    queryKey: ["/api/accounting/overview", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/accounting/overview?companyId=${companyId}`)).json(),
  });
  const { data: accounts, isLoading: accLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/accounts?companyId=${companyId}`)).json(),
  });
  const { data: entries, isLoading: entLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/journal-entries?companyId=${companyId}`)).json(),
  });
  const { data: vatPeriods, isLoading: vatLoading } = useQuery<VatPeriod[]>({
    queryKey: ["/api/vat-periods", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/vat-periods?companyId=${companyId}`)).json(),
  });

  /* ---- mutations ---- */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/accounting/overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vat-periods"] });
    queryClient.invalidateQueries({ queryKey: ["/api/journal-lines"] });
  };

  const createAccount = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/accounts?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Konto oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette konto", description: e.message, variant: "destructive" }),
  });
  const deleteAccount = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/accounts/${id}?companyId=${companyId}`); },
    onSuccess: () => { invalidate(); toast({ title: "Konto slettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke slette konto", description: e.message, variant: "destructive" }),
  });
  const createEntry = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/journal-entries?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Postering oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette postering", description: e.message, variant: "destructive" }),
  });
  const patchEntry = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await apiRequest("PATCH", `/api/journal-entries/${id}?companyId=${companyId}`, { status })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Postering opdateret" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere postering", description: e.message, variant: "destructive" }),
  });
  const createVat = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/vat-periods?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Momsperiode oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette momsperiode", description: e.message, variant: "destructive" }),
  });
  const patchVat = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await apiRequest("PATCH", `/api/vat-periods/${id}?companyId=${companyId}`, { status })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Momsperiode markeret som indberettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere momsperiode", description: e.message, variant: "destructive" }),
  });

  const accList = accounts ?? [];
  const entList = entries ?? [];
  const vatList = vatPeriods ?? [];

  const tabItems: FunctionMenuItem[] = [
    { id: "oversigt", label: "Oversigt", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "kontoplan", label: "Kontoplan", icon: <BookOpen className="w-4 h-4" /> },
    { id: "bogfoering", label: "Bogføring", icon: <FileText className="w-4 h-4" /> },
    { id: "moms", label: "Moms", icon: <Receipt className="w-4 h-4" /> },
    { id: "integrationer", label: "Integrationer", icon: <Plug className="w-4 h-4" /> },
  ];

  if (ovLoading && tab === "oversigt") {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      {/* ---- standalone branding header ---- */}
      <StandaloneHeader />

      {/* ---- beta warning banner ---- */}
      <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex gap-2 items-start">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed" data-testid="beta-banner">
          <span className="font-semibold">Beta</span> — Regnskabsmodulet er i beta — kræver revisor/juridisk godkendelse før produktion.
        </p>
      </div>

      <PageHeader
        eyebrow="Økonomi"
        title="Regnskab"
        description="Selvstændigt regnskabssystem med kontoplan, bogføring, moms og årsregnskab"
      />

      {/* ---- tab navigation ---- */}
      <FunctionMenu items={tabItems} active={tab} onChange={(id) => setTab(id as TabKey)} label="Modul" />

      {tab === "oversigt" && (
        <OversigtTab
          overview={overview}
          accounts={accList}
          accCount={accList.length}
          entCount={entList.length}
        />
      )}

      {tab === "kontoplan" && (
        <KontoplanTab
          accounts={accList}
          loading={accLoading}
          onCreate={(b) => createAccount.mutate(b)}
          onDelete={(id) => deleteAccount.mutate(id)}
          pending={createAccount.isPending}
          deletePending={deleteAccount.isPending}
        />
      )}

      {tab === "bogfoering" && (
        <BogfoeringTab
          entries={entList}
          loading={entLoading}
          onCreate={(b) => createEntry.mutate(b)}
          onPatch={(id, status) => patchEntry.mutate({ id, status })}
          pending={createEntry.isPending}
          patchPending={patchEntry.isPending}
        />
      )}

      {tab === "moms" && (
        <MomsTab
          vatPeriods={vatList}
          loading={vatLoading}
          onCreate={(b) => createVat.mutate(b)}
          onReport={(id) => patchVat.mutate({ id, status: "indberettet" })}
          pending={createVat.isPending}
          reportPending={patchVat.isPending}
        />
      )}

      {tab === "integrationer" && <IntegrationerTab />}
    </div>
  );
}

/* ===================================================================== */
/*  Standalone branding header                                            */
/* ===================================================================== */

function StandaloneHeader() {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0" data-testid="regnskab-logo">
          <Landmark className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate" data-testid="regnskab-title">ADD Regnskab</h1>
          <p className="text-xs text-muted-foreground truncate">Selvstændigt regnskabssystem</p>
        </div>
      </div>
      <StatusChip
        status="Forbundet til ADD SmartRegnskab"
        variant="green"
        icon={<Link2 className="w-3 h-3" />}
        data-testid="badge-smartdrift-connection"
      />
    </div>
  );
}

/* ===================================================================== */
/*  1. Oversigt (dashboard + årsregnskab)                                 */
/* ===================================================================== */

function OversigtTab({
  overview, accounts, accCount, entCount,
}: {
  overview?: Overview; accounts: Account[]; accCount: number; entCount: number;
}) {
  /* derive financial KPIs from accounts (seed data) */
  const bank = accounts.find((a) => a.accountNumber === "1000" || /bank/i.test(a.name))?.balance ?? 0;
  const debitorer = accounts.filter((a) => a.type === "aktiv" && /debit|debitor/i.test(a.name))
    .reduce((s, a) => s + (a.balance ?? 0), 0);
  const indtaegter = accounts.filter((a) => a.type === "indtaegt");
  const udgifter = accounts.filter((a) => a.type === "udgift");
  const revenueTotal = indtaegter.reduce((s, a) => s + (a.balance ?? 0), 0);
  const expenseTotal = udgifter.reduce((s, a) => s + (a.balance ?? 0), 0);
  const aaretsResultat = overview?.profit ?? (revenueTotal - expenseTotal);

  /* monthly invoicing estimate (mock — ~1/12 of revenue) */
  const tilfakturering = Math.round((overview?.revenue ?? revenueTotal) / 12);

  return (
    <div className="space-y-3">
      {/* ---- financial KPIs ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Wallet className="w-5 h-5" />}
          value={money(bank)}
          label="Nuværende bankbalance"
          variant="blue"
          valueTestId="metric-bank-balance"
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5" />}
          value={money(tilfakturering)}
          label="Tilfakturering denne måned"
          variant="green"
          valueTestId="metric-monthly-invoicing"
        />
        <MetricCard
          icon={<TrendingDown className="w-5 h-5" />}
          value={money(debitorer)}
          label="Udestående tilgodehavender"
          variant="amber"
          valueTestId="metric-outstanding-receivables"
        />
        <MetricCard
          icon={<Calculator className="w-5 h-5" />}
          value={money(aaretsResultat)}
          label="Årets resultat"
          variant={aaretsResultat >= 0 ? "primary" : "red"}
          valueTestId="metric-year-result"
        />
      </div>

      {/* ---- årsregnskab section ---- */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 pt-1">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Årsregnskab</h2>
        </div>

        <Arsregnskab
          accounts={accounts}
          revenueTotal={revenueTotal}
          expenseTotal={expenseTotal}
          profit={aaretsResultat}
        />
      </div>

      {/* ---- legacy overview metrics ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<Calculator className="w-5 h-5" />} value={money(overview?.revenue ?? revenueTotal)} label="Omsætning" variant="green" valueTestId="metric-revenue" />
        <MetricCard icon={<Receipt className="w-5 h-5" />} value={money(overview?.expenses ?? expenseTotal)} label="Udgifter" variant="red" valueTestId="metric-expenses" />
        <MetricCard icon={<BookOpen className="w-5 h-5" />} value={money(overview?.equity)} label="Egenkapital" variant="blue" valueTestId="metric-equity" />
        <MetricCard icon={<BookOpen className="w-5 h-5" />} value={money(overview?.assets)} label="Aktiver" variant="blue" valueTestId="metric-assets" />
        <MetricCard icon={<BookOpen className="w-5 h-5" />} value={money(overview?.liabilities)} label="Passiver" variant="amber" valueTestId="metric-liabilities" />
        <MetricCard icon={<BookOpen className="w-5 h-5" />} value={String(overview?.accountCount ?? accCount)} label="Konti" variant="gray" valueTestId="metric-account-count" />
        <MetricCard icon={<FileText className="w-5 h-5" />} value={String(overview?.entryCount ?? entCount)} label="Posteringer" variant="gray" valueTestId="metric-entry-count" />
        <MetricCard icon={<Receipt className="w-5 h-5" />} value={String(overview?.vatPeriods ?? 0)} label="Momsperioder" variant="gray" valueTestId="metric-vat-count" />
      </div>

      <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-3 flex gap-2 items-start">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed" data-testid="beta-disclaimer">
          Regnskabssystem — beta, bygget med dansk momsstruktur, revisionsspor, backup og eksport. Kræver revisor/juridisk godkendelse før produktion.
        </p>
      </div>
    </div>
  );
}

/* ---- Årsregnskab: Driftsresultat, Balance, Likviditetsoversigt ---- */

function Arsregnskab({
  accounts, revenueTotal, expenseTotal, profit,
}: {
  accounts: Account[]; revenueTotal: number; expenseTotal: number; profit: number;
}) {
  const aktiver = accounts.filter((a) => a.type === "aktiv");
  const passiver = accounts.filter((a) => a.type === "passiv");
  const assetTotal = aktiver.reduce((s, a) => s + (a.balance ?? 0), 0);
  const liabilityTotal = passiver.reduce((s, a) => s + (a.balance ?? 0), 0);

  /* likviditetsoversigt: likvide aktiver (bank, kasse) minus kortfristet gæld (skyldig moms, løn, leverandører) */
  const likvideAktiver = accounts.filter((a) => a.type === "aktiv" && /bank|kasse|likvid/i.test(a.name));
  const likvidSum = likvideAktiver.reduce((s, a) => s + (a.balance ?? 0), 0);
  const kortfristetGæld = accounts.filter((a) => a.type === "passiv" && /skyldig|leverand|løn|banklån|moms/i.test(a.name));
  const gældSum = kortfristetGæld.reduce((s, a) => s + (a.balance ?? 0), 0);
  const netLikviditet = likvidSum - gældSum;

  return (
    <div className="space-y-3">
      {/* Driftsresultat */}
      <SectionCard title="Driftsresultat" icon={<TrendingUp className="w-4 h-4" />} noPadding>
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[560px] text-sm">
            <thead>
              <tr><th>Post</th><th className="text-right">Beløb</th></tr>
            </thead>
            <tbody>
              <tr data-testid="row-drift-revenue">
                <td className="p-3">Omsætning (indtægter i alt)</td>
                <td className="p-3 text-right tabular-nums">{money(revenueTotal)}</td>
              </tr>
              <tr data-testid="row-drift-expense">
                <td className="p-3">Driftsomkostninger (udgifter i alt)</td>
                <td className="p-3 text-right tabular-nums">{money(expenseTotal)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="p-3 font-semibold">Driftsresultat</td>
                <td className={`p-3 text-right tabular-nums font-semibold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="total-drift-result">
                  {money(profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {/* Balance overview */}
      <SectionCard title="Balance" icon={<Scale className="w-4 h-4" />} noPadding>
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[560px] text-sm">
            <thead>
              <tr><th>Konto</th><th>Navn</th><th className="text-right">Beløb</th></tr>
            </thead>
            <tbody>
              <tr><td className="p-3 font-semibold uppercase text-xs text-muted-foreground" colSpan={3}>Aktiver</td></tr>
              {aktiver.length === 0 ? (
                <tr><td className="p-3 text-muted-foreground" colSpan={3}>Ingen aktivkonti</td></tr>
              ) : aktiver.map((a) => (
                <tr key={a.id} data-testid={`row-balance-aktiv-${a.id}`}>
                  <td className="p-3 tabular-nums">{a.accountNumber}</td>
                  <td className="p-3">{a.name}</td>
                  <td className="p-3 text-right tabular-nums">{money(a.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="p-3 font-medium" colSpan={2}>I alt aktiver</td>
                <td className="p-3 text-right tabular-nums font-medium" data-testid="total-balance-asset">{money(assetTotal)}</td>
              </tr>

              <tr><td className="p-3 font-semibold uppercase text-xs text-muted-foreground" colSpan={3}>Passiver & egenkapital</td></tr>
              {passiver.length === 0 ? (
                <tr><td className="p-3 text-muted-foreground" colSpan={3}>Ingen passivkonti</td></tr>
              ) : passiver.map((a) => (
                <tr key={a.id} data-testid={`row-balance-passiv-${a.id}`}>
                  <td className="p-3 tabular-nums">{a.accountNumber}</td>
                  <td className="p-3">{a.name}</td>
                  <td className="p-3 text-right tabular-nums">{money(a.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="p-3 font-medium" colSpan={2}>I alt passiver</td>
                <td className="p-3 text-right tabular-nums font-medium" data-testid="total-balance-liability">{money(liabilityTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Likviditetsoversigt */}
      <SectionCard title="Likviditetsoversigt" icon={<Droplet className="w-4 h-4" />} noPadding>
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[560px] text-sm">
            <thead>
              <tr><th>Post</th><th className="text-right">Beløb</th></tr>
            </thead>
            <tbody>
              <tr><td className="p-3 font-semibold uppercase text-xs text-muted-foreground" colSpan={2}>Likvide midler</td></tr>
              {likvideAktiver.length === 0 ? (
                <tr><td className="p-3 text-muted-foreground" colSpan={2}>Ingen likvide konti</td></tr>
              ) : likvideAktiver.map((a) => (
                <tr key={a.id} data-testid={`row-likvid-asset-${a.id}`}>
                  <td className="p-3">{a.accountNumber} {a.name}</td>
                  <td className="p-3 text-right tabular-nums">{money(a.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="p-3 font-medium">I alt likvide midler</td>
                <td className="p-3 text-right tabular-nums font-medium" data-testid="total-likvid-assets">{money(likvidSum)}</td>
              </tr>

              <tr><td className="p-3 font-semibold uppercase text-xs text-muted-foreground" colSpan={2}>Kortfristet gæld</td></tr>
              {kortfristetGæld.length === 0 ? (
                <tr><td className="p-3 text-muted-foreground" colSpan={2}>Ingen gældskonti</td></tr>
              ) : kortfristetGæld.map((a) => (
                <tr key={a.id} data-testid={`row-likvid-debt-${a.id}`}>
                  <td className="p-3">{a.accountNumber} {a.name}</td>
                  <td className="p-3 text-right tabular-nums">{money(a.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="p-3 font-medium">I alt kortfristet gæld</td>
                <td className="p-3 text-right tabular-nums font-medium" data-testid="total-likvid-debt">{money(gældSum)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="p-3 font-semibold">Nettolikviditet</td>
                <td className={`p-3 text-right tabular-nums font-semibold ${netLikviditet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="total-likvid-net">
                  {money(netLikviditet)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ===================================================================== */
/*  2. Kontoplan                                                         */
/* ===================================================================== */

function KontoplanTab({
  accounts, loading, onCreate, onDelete, pending, deletePending,
}: {
  accounts: Account[]; loading: boolean;
  onCreate: (body: unknown) => void;
  onDelete: (id: number) => void;
  pending: boolean; deletePending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => (filter === "all" ? accounts : accounts.filter((a) => a.type === filter)),
    [accounts, filter],
  );

  return (
    <SectionCard
      title="Kontoplan"
      icon={<BookOpen className="w-4 h-4" />}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-account">
              <Plus className="w-4 h-4 mr-1.5" />Opret konto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Ny konto</DialogTitle></DialogHeader>
            <AccountForm pending={pending} onSubmit={(b) => { onCreate(b); setOpen(false); }} />
          </DialogContent>
        </Dialog>
      }
      noPadding
    >
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground">Filtrér efter type:</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-account-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="passiv">Passiv</SelectItem>
            <SelectItem value="indtaegt">Indtægt</SelectItem>
            <SelectItem value="udgift">Udgift</SelectItem>
            <SelectItem value="mellemregning">Mellemregning</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-40 rounded-md" /> : filtered.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-xs">Ingen konti endnu</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th>Kontonr</th><th>Navn</th><th>Type</th><th>Moms</th>
                <th className="text-right">Saldo</th><th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} data-testid={`row-account-${a.id}`}>
                  <td className="p-3 whitespace-nowrap font-medium tabular-nums">{a.accountNumber}</td>
                  <td className="p-3 max-w-48 truncate">{a.name}</td>
                  <td className="p-3">
                    <span className={`badge-soft inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${badgeClass(ACCOUNT_TYPE_VARIANT[a.type] ?? "gray")}`} data-testid={`badge-account-type-${a.id}`}>
                      {ACCOUNT_TYPE_LABEL[a.type] ?? a.type}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{a.vatCode || "—"}</td>
                  <td className="p-3 text-right tabular-nums">{money(a.balance)}</td>
                  <td className="p-3">
                    <button onClick={() => onDelete(a.id)} disabled={deletePending} title="Slet konto"
                      className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-delete-account-${a.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function AccountForm({ pending, onSubmit }: { pending: boolean; onSubmit: (body: unknown) => void }) {
  const [accountNumber, setAccountNumber] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("aktiv");
  const [vatCode, setVatCode] = useState("ingen");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      accountNumber,
      name,
      type,
      vatCode: vatCode === "ingen" ? null : vatCode,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="account-number">Kontonummer</Label>
        <Input id="account-number" data-testid="input-account-number" value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)} placeholder="f.eks. 1000" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-name">Navn</Label>
        <Input id="account-name" data-testid="input-account-name" value={name}
          onChange={(e) => setName(e.target.value)} placeholder="f.eks. Bank" required />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="select-account-type"><SelectValue placeholder="Vælg type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="passiv">Passiv</SelectItem>
            <SelectItem value="indtaegt">Indtægt</SelectItem>
            <SelectItem value="udgift">Udgift</SelectItem>
            <SelectItem value="mellemregning">Mellemregning</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Momskode</Label>
        <Select value={vatCode} onValueChange={setVatCode}>
          <SelectTrigger data-testid="select-account-vat"><SelectValue placeholder="Vælg momskode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ingen">ingen</SelectItem>
            <SelectItem value="I25">I25</SelectItem>
            <SelectItem value="S25">S25</SelectItem>
            <SelectItem value="FRI">FRI</SelectItem>
            <SelectItem value="EU">EU</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={pending || !accountNumber || !name}
        data-testid="button-save-account">
        {pending ? "Opretter..." : "Opret konto"}
      </Button>
    </form>
  );
}

/* ===================================================================== */
/*  3. Bogføring (kassekladde)                                            */
/* ===================================================================== */

function BogfoeringTab({
  entries, loading, onCreate, onPatch, pending, patchPending,
}: {
  entries: JournalEntry[]; loading: boolean;
  onCreate: (body: unknown) => void;
  onPatch: (id: number, status: string) => void;
  pending: boolean; patchPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <SectionCard
        title="Bogføringskladder"
        icon={<FileText className="w-4 h-4" />}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-new-entry">
                <Plus className="w-4 h-4 mr-1.5" />Opret postering
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Ny postering</DialogTitle></DialogHeader>
              <EntryForm pending={pending} onSubmit={(b) => { onCreate(b); setOpen(false); }} />
            </DialogContent>
          </Dialog>
        }
        noPadding
      >
        {loading ? <Skeleton className="h-40 rounded-md" /> : entries.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs">Ingen posteringer endnu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium w-full min-w-[820px] text-sm">
              <thead>
                <tr>
                  <th>Bilagsnr</th><th>Dato</th><th>Beskrivelse</th><th>Reference</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const status = e.status || "kladde";
                  const v = ENTRY_STATUS_VARIANT[status] ?? "gray";
                  return (
                    <tr
                      key={e.id}
                      data-testid={`row-entry-${e.id}`}
                      className={selectedId === e.id ? "bg-muted/40" : "cursor-pointer hover:bg-muted/30"}
                      onClick={() => setSelectedId((cur) => (cur === e.id ? null : e.id))}
                    >
                      <td className="p-3 whitespace-nowrap font-medium tabular-nums">{e.entryNumber ?? e.id}</td>
                      <td className="p-3 whitespace-nowrap">{dk(e.date)}</td>
                      <td className="p-3 max-w-56 truncate">{e.description || "—"}</td>
                      <td className="p-3 whitespace-nowrap">{e.reference || "—"}</td>
                      <td className="p-3">
                        <span className={`badge-soft inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${badgeClass(v as "blue")}`} data-testid={`badge-entry-status-${e.id}`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                        {status === "kladde" && (
                          <Button size="sm" variant="outline" disabled={patchPending}
                            onClick={() => onPatch(e.id, "bogført")} data-testid={`button-post-entry-${e.id}`}>
                            Bogfør
                          </Button>
                        )}
                        {status === "bogført" && (
                          <Button size="sm" variant="outline" disabled={patchPending}
                            onClick={() => onPatch(e.id, "afstemt")} data-testid={`button-reconcile-entry-${e.id}`}>
                            Afstem
                          </Button>
                        )}
                        {status === "afstemt" && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Afstemt
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selectedId !== null && (
        <JournalLinesPanel entryId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function JournalLinesPanel({ entryId, onClose }: { entryId: number; onClose: () => void }) {
  const { data: lines, isLoading } = useQuery<JournalLine[]>({
    queryKey: ["/api/journal-lines", entryId],
    queryFn: async () => (await apiRequest("GET", `/api/journal-lines?entryId=${entryId}`)).json(),
  });
  const lineList = lines ?? [];
  const debit = lineList.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credit = lineList.reduce((s, l) => s + (l.credit ?? 0), 0);

  return (
    <SectionCard
      title={`Postlinjer — postering #${entryId}`}
      icon={<FileText className="w-4 h-4" />}
      action={<Button size="sm" variant="ghost" onClick={onClose} data-testid="button-close-lines">Luk</Button>}
      noPadding
    >
      {isLoading ? <Skeleton className="h-32 rounded-md" /> : lineList.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <p className="text-xs">Ingen postlinjer på denne postering endnu</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th>Konto</th><th>Beskrivelse</th>
                <th className="text-right">Debet</th><th className="text-right">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {lineList.map((l) => (
                <tr key={l.id} data-testid={`row-line-${l.id}`}>
                  <td className="p-3 whitespace-nowrap tabular-nums">
                    {l.account ? `${l.account.accountNumber} ${l.account.name}` : `#${l.accountId ?? "—"}`}
                  </td>
                  <td className="p-3 max-w-48 truncate">{l.description || "—"}</td>
                  <td className="p-3 text-right tabular-nums">{l.debit ? money(l.debit) : "—"}</td>
                  <td className="p-3 text-right tabular-nums">{l.credit ? money(l.credit) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="p-3 font-medium" colSpan={2}>I alt</td>
                <td className="p-3 text-right tabular-nums font-medium">{money(debit)}</td>
                <td className="p-3 text-right tabular-nums font-medium">{money(credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function EntryForm({ pending, onSubmit }: { pending: boolean; onSubmit: (body: unknown) => void }) {
  const [entryNumber, setEntryNumber] = useState("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [sourceType, setSourceType] = useState("manual");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ entryNumber, date, description, reference, sourceType });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="entry-number">Bilagsnr</Label>
        <Input id="entry-number" data-testid="input-entry-number" value={entryNumber}
          onChange={(e) => setEntryNumber(e.target.value)} placeholder="f.eks. P-2025-001" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-date">Dato</Label>
        <Input id="entry-date" type="date" data-testid="input-entry-date" value={date}
          onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-description">Beskrivelse</Label>
        <Textarea id="entry-description" data-testid="input-entry-description" value={description}
          onChange={(e) => setDescription(e.target.value)} placeholder="f.eks. Salg af rengøring" required rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-reference">Reference</Label>
        <Input id="entry-reference" data-testid="input-entry-reference" value={reference}
          onChange={(e) => setReference(e.target.value)} placeholder="f.eks. Faktura #123" />
      </div>
      <div className="space-y-1.5">
        <Label>Kildetype</Label>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger data-testid="select-entry-source"><SelectValue placeholder="Vælg kildetype" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manuel</SelectItem>
            <SelectItem value="invoice">Faktura</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="expense">Udgift</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={pending || !entryNumber || !description}
        data-testid="button-save-entry">
        {pending ? "Opretter..." : "Opret postering"}
      </Button>
    </form>
  );
}

/* ===================================================================== */
/*  4. Moms                                                              */
/* ===================================================================== */

function MomsTab({
  vatPeriods, loading, onCreate, onReport, pending, reportPending,
}: {
  vatPeriods: VatPeriod[]; loading: boolean;
  onCreate: (body: unknown) => void;
  onReport: (id: number) => void;
  pending: boolean; reportPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [type, setType] = useState("kvartal");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCreate({ period, type });
    setOpen(false);
    setPeriod("");
  };

  return (
    <SectionCard
      title="Momsopgørelse"
      icon={<Receipt className="w-4 h-4" />}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-vat">
              <Plus className="w-4 h-4 mr-1.5" />Ny periode
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Ny momsperiode</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="vat-period">Periode</Label>
                <Input id="vat-period" data-testid="input-vat-period" value={period}
                  onChange={(e) => setPeriod(e.target.value)} placeholder="f.eks. 2025-Q3" required />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-vat-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kvartal">Kvartal</SelectItem>
                    <SelectItem value="halvår">Halvår</SelectItem>
                    <SelectItem value="måned">Måned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={pending || !period} data-testid="button-save-vat">
                {pending ? "Opretter..." : "Opret periode"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
      noPadding
    >
      {loading ? <Skeleton className="h-40 rounded-md" /> : vatPeriods.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-xs">Ingen momsperioder endnu</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[860px] text-sm">
            <thead>
              <tr>
                <th>Periode</th><th>Type</th>
                <th className="text-right">Salgsmoms</th>
                <th className="text-right">Købsmoms</th>
                <th className="text-right">Netto moms</th>
                <th>Status</th><th>Indberettet</th><th />
              </tr>
            </thead>
            <tbody>
              {vatPeriods.map((v) => {
                const status = v.status || "åben";
                const reported = status === "indberettet" || !!v.reportedAt;
                return (
                  <tr key={v.id} data-testid={`row-vat-${v.id}`}>
                    <td className="p-3 whitespace-nowrap font-medium">{v.period || "—"}</td>
                    <td className="p-3 whitespace-nowrap">{v.type || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{money(v.outputVat)}</td>
                    <td className="p-3 text-right tabular-nums">{money(v.inputVat)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{money(v.netVat)}</td>
                    <td className="p-3">
                      <span className={`badge-soft inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${reported ? badgeClass("blue") : badgeClass("amber")}`} data-testid={`badge-vat-status-${v.id}`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{v.reportedAt ? dk(v.reportedAt) : "—"}</td>
                    <td className="p-3">
                      {!reported && (
                        <Button size="sm" variant="outline" disabled={reportPending}
                          onClick={() => onReport(v.id)} data-testid={`button-report-vat-${v.id}`}>
                          Indberet
                        </Button>
                      )}
                      {reported && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Indberettet
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/* ===================================================================== */
/*  5. Integrationer                                                     */
/* ===================================================================== */

type IntegrationKey = "economic" | "dinero" | "billy" | "e-conomic";

const INTEGRATIONS: { key: IntegrationKey; name: string; description: string }[] = [
  { key: "economic", name: "Economic", description: "e-conomic A/S — online regnskab" },
  { key: "dinero", name: "Dinero", description: "Dinero — bogføring & fakturering" },
  { key: "billy", name: "Billy", description: "Billy — regnskab til små virksomheder" },
  { key: "e-conomic", name: "e-conomic", description: "e-conomic — cloud regnskab" },
];

function IntegrationerTab() {
  const { toast } = useToast();
  const [connected, setConnected] = useState<Record<IntegrationKey, boolean>>({
    economic: false,
    dinero: false,
    billy: false,
    "e-conomic": false,
  });

  const toggle = (key: IntegrationKey, name: string) => {
    setConnected((cur) => {
      const next = { ...cur, [key]: !cur[key] };
      if (next[key]) {
        toast({ title: `${name} forbundet`, description: "Mock-forbindelse oprettet" });
      } else {
        toast({ title: `${name} afbundet`, description: "Mock-forbindelse fjernet" });
      }
      return next;
    });
  };

  return (
    <SectionCard title="Regnskabsintegrationer" icon={<Plug className="w-4 h-4" />} noPadding>
      <div className="divide-y divide-border">
        {INTEGRATIONS.map((it) => {
          const isConnected = connected[it.key];
          return (
            <div key={it.key} className="flex items-center justify-between gap-3 px-3 py-3" data-testid={`row-integration-${it.key}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-md bg-muted text-muted-foreground shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{it.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{it.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusChip
                  status={isConnected ? "Forbundet" : "Ikke forbundet"}
                  variant={isConnected ? "green" : "gray"}
                  icon={isConnected ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                  data-testid={`badge-integration-${it.key}`}
                />
                <Button
                  size="sm"
                  variant={isConnected ? "outline" : "default"}
                  onClick={() => toggle(it.key, it.name)}
                  data-testid={`button-toggle-integration-${it.key}`}
                >
                  {isConnected ? (
                    <><Link2Off className="w-3.5 h-3.5 mr-1.5" />Afbind</>
                  ) : (
                    <><Link2 className="w-3.5 h-3.5 mr-1.5" />Forbind</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Integrationerne er mock — Forbind/Afbind skifter kun status lokalt. Reelle OAuth-forbindelser konfigureres via ADD SmartRegnskab-platformen.
        </p>
      </div>
    </SectionCard>
  );
}

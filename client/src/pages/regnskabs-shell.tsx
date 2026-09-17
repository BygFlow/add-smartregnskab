import { Suspense, useState } from "react";
import { Switch, Route, Link, Redirect, useLocation, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useAuth } from "@/lib/auth";
import Regnskabssystem from "@/pages/regnskabssystem";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertCircle, Archive, BookOpen, Bot, BrainCircuit, Briefcase,
  Building2, Calculator, Calendar, CalendarClock, ChevronDown, ClipboardCheck,
  Code, CreditCard, Download, FileBarChart, FileCheck, FileText, GitBranch,
  Inbox, KeyRound, Landmark, Layers, Link2, Lock, LogOut, Menu, Package,
  Receipt, RefreshCw, Send, Settings, ShieldCheck, Sparkles, Tags, Truck,
  Upload, Users, Wallet, Workflow, X, Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { SMARTREGNSKAB_BRAND } from "@/components/smartregnskab-brand";

type NavItem = { path: string; label: string; icon: typeof Building2 };
type NavGroup = { label: string; items: NavItem[] };

const item = (tab: string, label: string, icon: typeof Building2): NavItem => ({
  path: tab === "dashboard" ? "/smartregnskab/app" : `/smartregnskab/app/${tab}`,
  label,
  icon,
});

const PLATFORM_GROUPS: NavGroup[] = [
  { label: "Platform", items: [
    item("dashboard", "Platformoverblik", Activity),
    item("virksomheder", "Virksomheder", Building2),
  ] },
  { label: "Abonnement og betaling", items: [
    item("pakker", "Pakkeløsninger", Package),
    item("betalinger", "Fakturaer & QuickPay", CreditCard),
  ] },
  { label: "Drift", items: [
    item("backup_platform", "Backup-system", Archive),
    item("platform_drift", "Systemdrift", Activity),
  ] },
  { label: "Adgang og hjælp", items: [
    item("fagbrugere", "Bogholder & Revisor", Briefcase),
    item("platform_support", "Support", AlertCircle),
    item("adgangspolitik", "Adgang og databeskyttelse", Lock),
  ] },
];

const COMPANY_GROUPS: NavGroup[] = [
  { label: "Overblik", items: [item("dashboard", "Dashboard", Activity)] },
  { label: "Dagligt arbejde", items: [
    item("bilagsindbakke", "Bilagsindbakke", Inbox),
    item("bilag", "Bilag & udgifter", Receipt),
    item("kontoplan", "Bogføring", FileText),
    item("bank", "Bankafstemning", Landmark),
  ] },
  { label: "Salg og køb", items: [
    item("fakturering", "Fakturering", FileText),
    item("kundekartotek", "Kunder", Users),
    item("leverandoerkartotek", "Leverandører", Truck),
    item("produktkartotek", "Produkter & ydelser", Package),
    item("debitor", "Debitor & kreditor", Wallet),
  ] },
  { label: "Afslutning", items: [
    item("moms", "Moms & skat", Calculator),
    item("lon", "Lønbogføring", Users),
    item("periode", "Periodeafslutning", CalendarClock),
    item("rapporter", "Rapporter", FileBarChart),
    item("revision", "Revisionsspor", ShieldCheck),
  ] },
  { label: "Automatisering", items: [
    item("ai_styring", "AI-styring", BrainCircuit),
    item("automatisering", "Automatisering", Zap),
    item("integrationer", "Integrationer", Link2),
  ] },
  { label: "Konto", items: [
    item("abonnement", "Abonnement & betaling", CreditCard),
  ] },
];

const ADVANCED_ITEMS: NavItem[] = [
  item("faste_fakturaer", "Faste fakturaer", RefreshCw),
  item("debitorstyring", "Rykkerflow", AlertCircle),
  item("periodisering", "Periodisering", Calendar),
  item("budget", "Budget & prognoser", FileBarChart),
  item("cashflow", "Likviditet & cashflow", Wallet),
  item("omkostning", "Omkostningssteder", Briefcase),
  item("anlaeg", "Anlægsregister", Building2),
  item("betaling", "Betalingskørsler", CreditCard),
  item("aarafslutning", "Årsafslutning", Calendar),
  item("arsrapport", "Årsrapport", FileCheck),
  item("momsafstemning", "Momsafstemning", Calculator),
  item("skattekonto", "Skattekonto", Landmark),
  item("afstemningscenter", "Afstemningscenter", ShieldCheck),
  item("revisorportal", "Revisorportal", FileCheck),
  item("revisionspakke", "Revisionspakke", Archive),
  item("roller_kontrol", "Roller & kontrol", KeyRound),
  item("saft", "SAF-T 2.1", Download),
  item("regler", "Regnskabsregler", Settings),
  item("bank_integrationer", "Bank, SKAT & NemHandel", Landmark),
  item("integration_configs", "Integrationsopsætning", Link2),
  item("arkivering", "Lovpligtig arkivering", Archive),
  item("bank_payments", "Bankbetalinger", CreditCard),
  item("einvoice_queue", "OIOUBL & NemHandel", Inbox),
  item("lonindberetning", "Lønindberetning", Users),
  item("lonmotor_regnskab", "Lønmotor", Users),
  item("importguide", "Importguide", Upload),
  item("migration_wizard", "Datamigrering", Upload),
  item("api_webhooks", "API & webhooks", Code),
  item("api_keys_mgmt", "API-nøgler", KeyRound),
  item("workflow_builder", "Workflow Builder", Workflow),
  item("integration_runs", "Integrationslog", Activity),
  item("retry_queue", "Retry-kø", RefreshCw),
  item("filhaandtering", "Filhåndtering", FileText),
  item("filversioner", "Filversioner", GitBranch),
  item("compliance_dokumenter", "Compliance-dokumenter", ShieldCheck),
  item("kontroltests", "Kontroltests", ClipboardCheck),
  item("rbac_rettigheder", "Rettigheder", KeyRound),
  item("kunde_portal_indstillinger", "Kundeportal", Settings),
  item("portal_dokumenter", "Portaldokumenter", FileText),
  item("backup_regnskab", "Backup", Archive),
  item("ai_chef", "AI-regnskabschef", Bot),
  item("ai", "AI-regnskab", Sparkles),
  item("branche_profil", "Brancheprofil", Building2),
  item("kontoplan_skabeloner", "Kontoplanskabeloner", FileText),
  item("dimensioner", "Dimensioner", Layers),
  item("regnskabskategorier", "Regnskabskategorier", Tags),
  item("konsolidering", "Koncern", Building2),
  item("avanceret_moms", "Avanceret moms", Calculator),
  item("lagerregnskab", "Lagerregnskab", Archive),
  item("valuta_moms", "Valuta & udenlandsk moms", Wallet),
  item("budget_scenarier", "Budgetscenarier", FileBarChart),
];

export function RegnskabsPlatformShell({ user, role, companyName }: {
  user: any; companyId: number; role: string; companyName: string;
}) {
  const [currentLocation] = useLocation();
  const { logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isPlatformAdmin = role === "platform_admin";
  const groups = isPlatformAdmin ? PLATFORM_GROUPS : COMPANY_GROUPS;

  const isActive = (path: string) => path === "/smartregnskab/app"
    ? currentLocation === path
    : currentLocation === path || currentLocation.startsWith(path + "/");
  const initials = (user?.name || user?.email || "??").split(" ").map((part: string) => part[0]).slice(0, 2).join("").toUpperCase();
  const allItems = [...groups.flatMap((group) => group.items), ...ADVANCED_ITEMS];
  const currentTabLabel = allItems.find((navItem) => isActive(navItem.path))?.label || "Regnskab";

  const renderItem = (navItem: NavItem, closeMobile = false) => {
    const active = isActive(navItem.path);
    const Icon = navItem.icon;
    return <Link key={navItem.path} href={navItem.path} onClick={() => closeMobile && setMobileNavOpen(false)}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${active ? "nav-item-active" : "text-sidebar-foreground/72 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
      data-testid={`nav-regnskab-${navItem.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
      <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{navItem.label}</span>
    </Link>;
  };

  const navigation = (mobile = false) => <nav className="flex-1 overflow-y-auto px-3 py-4"><div className="space-y-5">
    {groups.map((group) => <section key={group.label}>
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">{group.label}</p>
      <div className="space-y-0.5">{group.items.map((navItem) => renderItem(navItem, mobile))}</div>
    </section>)}
    {!isPlatformAdmin && <section className="border-t border-sidebar-border pt-3">
      <button type="button" onClick={() => setAdvancedOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/72 hover:bg-sidebar-accent/60"
        aria-expanded={advancedOpen} data-testid="button-advanced-navigation">
        <span className="flex items-center gap-2.5"><Settings className="h-4 w-4" />Flere funktioner</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
      </button>
      {advancedOpen && <div className="mt-1 space-y-0.5">{ADVANCED_ITEMS.map((navItem) => renderItem(navItem, mobile))}</div>}
    </section>}
  </div></nav>;

  const userFooter = <div className="border-t border-sidebar-border p-3">
    <div className="mb-2 flex items-center gap-2 rounded-lg bg-sidebar-accent/35 px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-500">{initials}</div>
      <div className="min-w-0"><p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name}</p><p className="truncate text-[10px] text-sidebar-foreground/50">{isPlatformAdmin ? "Platformadministrator" : companyName}</p></div>
    </div>
    <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-sidebar-foreground/60 hover:text-destructive" data-testid="button-regnskab-logout"><LogOut className="mr-2 h-4 w-4" />Log ud</Button>
  </div>;

  return <div className="flex min-h-screen bg-muted/20" data-testid="regnskabs-platform-shell">
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex" data-testid="regnskabs-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5"><Logo className="h-9 w-9 shrink-0 text-sidebar-primary" /><div className="min-w-0">
        <span className="block text-[15px] font-bold text-sidebar-foreground">ADD SmartRegnskab</span>
        <span className="block truncate text-[11px] text-sidebar-foreground/55">{isPlatformAdmin ? "Platformadministration" : companyName}</span>
        <span className="mt-0.5 block truncate text-[9px] text-sidebar-foreground/35">{SMARTREGNSKAB_BRAND.familySignature}</span>
      </div></div>
      {navigation()}{userFooter}
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 shadow-sm backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-3"><button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMobileNavOpen(true)} data-testid="button-mobile-regnskab-menu" aria-label="Åbn menu"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0"><p className="truncate text-sm font-semibold" data-testid="text-regnskab-current-tab">{currentTabLabel}</p><p className="hidden truncate text-[11px] text-muted-foreground sm:block">{isPlatformAdmin ? "ADD SmartRegnskab platform" : companyName}</p></div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-xs font-bold text-emerald-700 dark:text-emerald-400">{initials}</div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] p-3 pb-24 sm:p-5 md:p-7 md:pb-8">
        <Router hook={useHashLocation}><Suspense fallback={<div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Indlæser modul…</div>}><Switch>
          <Route path="/smartregnskab/app" component={Regnskabssystem} /><Route path="/smartregnskab/app/:tab" component={Regnskabssystem} /><Route><Redirect to="/smartregnskab/app" /></Route>
        </Switch></Suspense></Router>
      </main>
    </div>

    {mobileNavOpen && <div className="fixed inset-0 z-50 bg-black/55 md:hidden" onClick={() => setMobileNavOpen(false)}><aside className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col bg-sidebar shadow-2xl" onClick={(event) => event.stopPropagation()} data-testid="mobile-regnskab-nav">
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4"><div className="flex items-center gap-2.5"><Logo className="h-8 w-8 text-sidebar-primary" /><div><p className="text-sm font-bold text-sidebar-foreground">ADD SmartRegnskab</p><p className="text-[10px] text-sidebar-foreground/45">{isPlatformAdmin ? "Platformadministration" : companyName}</p></div></div><button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/60" aria-label="Luk menu"><X className="h-5 w-5" /></button></div>
      {navigation(true)}{userFooter}
    </aside></div>}
  </div>;
}

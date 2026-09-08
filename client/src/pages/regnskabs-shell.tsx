import { Suspense, useState } from "react";
import { Switch, Route, Link, Redirect, useLocation, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useAuth } from "@/lib/auth";
import Regnskabssystem from "@/pages/regnskabssystem";
import { Button } from "@/components/ui/button";
import { Calculator, LayoutDashboard, Building2, FileText, Receipt, Landmark, CalendarClock, FileBarChart, Sparkles, Settings, LogOut, Menu, X, Zap, Users, ClipboardCheck, Link2, Inbox, Building, TrendingUp, Briefcase, CreditCard, Calendar, ShieldCheck, Wallet, BrainCircuit, Archive, Globe, FileCheck, KeyRound, Upload, Download, Code, AlertCircle, DollarSign, Layers, Tags, RefreshCw, Workflow, Activity, RotateCw, GitBranch, Lock, Send, Truck, Package } from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Overblik",
    items: [
      { path: "/smartregnskab/app", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
      { path: "/smartregnskab/app/kontrolcenter", label: "Kontrolcenter", icon: ShieldCheck, tab: "kontrolcenter" },
      { path: "/smartregnskab/app/virksomheder", label: "Virksomheder", icon: Building2, tab: null },
    ],
  },
  {
    label: "Bogføring",
    items: [
      { path: "/smartregnskab/app/kontoplan", label: "Kontoplan & Bogføring", icon: FileText, tab: "kontoplan" },
      { path: "/smartregnskab/app/bilag", label: "Bilag & Udgifter", icon: Receipt, tab: "bilag" },
      { path: "/smartregnskab/app/bilagsindbakke", label: "Bilagsindbakke", icon: Inbox, tab: "bilagsindbakke" },
      { path: "/smartregnskab/app/bank", label: "Bankafstemning", icon: Landmark, tab: "bank" },
      { path: "/smartregnskab/app/lon", label: "Lønbogføring", icon: Users, tab: "lon" },
      { path: "/smartregnskab/app/branche_profil", label: "Brancheprofil", icon: Building, tab: "branche_profil" },
      { path: "/smartregnskab/app/kontoplan_skabeloner", label: "Kontoplan-skabeloner", icon: FileText, tab: "kontoplan_skabeloner" },
      { path: "/smartregnskab/app/dimensioner", label: "Dimensioner", icon: Layers, tab: "dimensioner" },
      { path: "/smartregnskab/app/regnskabskategorier", label: "Regnskabskategorier", icon: Tags, tab: "regnskabskategorier" },
    ],
  },
  {
    label: "Moms & Skat",
    items: [
      { path: "/smartregnskab/app/moms", label: "Moms & Skat", icon: CalendarClock, tab: "moms" },
      { path: "/smartregnskab/app/momsafstemning", label: "Moms-afstemning", icon: Calculator, tab: "momsafstemning" },
      { path: "/smartregnskab/app/skattekonto", label: "Skattekonto", icon: Landmark, tab: "skattekonto" },
    ],
  },
  {
    label: "Økonomi",
    items: [
      { path: "/smartregnskab/app/kundekartotek", label: "Kundekartotek", icon: Users, tab: "kundekartotek" },
      { path: "/smartregnskab/app/leverandoerkartotek", label: "Leverandørkartotek", icon: Truck, tab: "leverandoerkartotek" },
      { path: "/smartregnskab/app/produktkartotek", label: "Produkt-/Ydelseskartotek", icon: Package, tab: "produktkartotek" },
      { path: "/smartregnskab/app/fakturering", label: "Fakturering", icon: FileText, tab: "fakturering" },
      { path: "/smartregnskab/app/faste_fakturaer", label: "Faste Fakturaer", icon: RefreshCw, tab: "faste_fakturaer" },
      { path: "/smartregnskab/app/debitor", label: "Debitor/Kreditor", icon: Users, tab: "debitor" },
      { path: "/smartregnskab/app/debitorstyring", label: "Rykkerflow", icon: AlertCircle, tab: "debitorstyring" },
      { path: "/smartregnskab/app/periodisering", label: "Periodisering", icon: Calendar, tab: "periodisering" },
      { path: "/smartregnskab/app/periode", label: "Periodeafslutning", icon: ClipboardCheck, tab: "periode" },
      { path: "/smartregnskab/app/budget", label: "Budget & Prognoser", icon: TrendingUp, tab: "budget" },
      { path: "/smartregnskab/app/cashflow", label: "Likviditet & Cashflow", icon: Wallet, tab: "cashflow" },
      { path: "/smartregnskab/app/omkostning", label: "Omkostningssteder", icon: Briefcase, tab: "omkostning" },
      { path: "/smartregnskab/app/anlaeg", label: "Anlægsregister", icon: Building, tab: "anlaeg" },
      { path: "/smartregnskab/app/konsolidering", label: "Koncern (beta)", icon: Building, tab: "konsolidering" },
      { path: "/smartregnskab/app/avanceret_moms", label: "Avanceret Moms", icon: Calculator, tab: "avanceret_moms" },
      { path: "/smartregnskab/app/lagerregnskab", label: "Lagerregnskab", icon: Archive, tab: "lagerregnskab" },
      { path: "/smartregnskab/app/valuta_moms", label: "Valuta & Udenlandsk Moms", icon: DollarSign, tab: "valuta_moms" },
      { path: "/smartregnskab/app/betaling", label: "Betalingskørsler", icon: CreditCard, tab: "betaling" },
      { path: "/smartregnskab/app/aarafslutning", label: "Årsafslutning", icon: Calendar, tab: "aarafslutning" },
      { path: "/smartregnskab/app/arsrapport", label: "Årsrapport (beta)", icon: FileCheck, tab: "arsrapport" },
    ],
  },
  {
    label: "Rapportering",
    items: [
      { path: "/smartregnskab/app/rapporter", label: "Rapporter", icon: FileBarChart, tab: "rapporter" },
      { path: "/smartregnskab/app/revision", label: "Revisionsspor", icon: ShieldCheck, tab: "revision" },
      { path: "/smartregnskab/app/revisorportal", label: "Revisorportal (beta)", icon: FileCheck, tab: "revisorportal" },
      { path: "/smartregnskab/app/roller_kontrol", label: "Roller & Kontrol (beta)", icon: KeyRound, tab: "roller_kontrol" },
      { path: "/smartregnskab/app/revisionspakke", label: "Revisionspakke (beta)", icon: FileCheck, tab: "revisionspakke" },
      { path: "/smartregnskab/app/saft", label: "SAF-T 2.1", icon: Download, tab: "saft" },
      { path: "/smartregnskab/app/budget_scenarier", label: "Budget & Scenarier", icon: TrendingUp, tab: "budget_scenarier" },
      { path: "/smartregnskab/app/afstemningscenter", label: "Afstemningscenter", icon: ShieldCheck, tab: "afstemningscenter" },
    ],
  },
  {
    label: "Automatisering",
    items: [
      { path: "/smartregnskab/app/ai_styring", label: "AI-styring 99%", icon: BrainCircuit, tab: "ai_styring" },
      { path: "/smartregnskab/app/automatisering", label: "Automatisering & AI", icon: Zap, tab: "automatisering" },
      { path: "/smartregnskab/app/regler", label: "Regnskabsregler", icon: Settings, tab: "regler" },
      { path: "/smartregnskab/app/bank_integrationer", label: "Bank/SKAT/NemHandel (beta)", icon: Landmark, tab: "bank_integrationer" },
      { path: "/smartregnskab/app/integration_configs", label: "Integration Configs (beta)", icon: Link2, tab: "integration_configs" },
      { path: "/smartregnskab/app/arkivering", label: "Bogføringslov Arkivering (beta)", icon: Archive, tab: "arkivering" },
      { path: "/smartregnskab/app/compliance_checks", label: "Compliance (beta)", icon: ShieldCheck, tab: "compliance_checks" },
      { path: "/smartregnskab/app/bank_payments", label: "Bankbetalinger (beta)", icon: CreditCard, tab: "bank_payments" },
      { path: "/smartregnskab/app/einvoice_queue", label: "OIOUBL/NemHandel (beta)", icon: Inbox, tab: "einvoice_queue" },
      { path: "/smartregnskab/app/lonindberetning", label: "Lønindberetning (beta)", icon: Users, tab: "lonindberetning" },
      { path: "/smartregnskab/app/lonmotor_regnskab", label: "Lønmotor (beta)", icon: Users, tab: "lonmotor_regnskab" },
      { path: "/smartregnskab/app/integrationer", label: "Integrationer", icon: Link2, tab: "integrationer" },
      { path: "/smartregnskab/app/importguide", label: "Importguide", icon: Upload, tab: "importguide" },
      { path: "/smartregnskab/app/migration_wizard", label: "Datamigrering", icon: Upload, tab: "migration_wizard" },
      { path: "/smartregnskab/app/api_webhooks", label: "API & Webhooks (beta)", icon: Code, tab: "api_webhooks" },
      { path: "/smartregnskab/app/api_keys_mgmt", label: "API-nøgler (beta)", icon: KeyRound, tab: "api_keys_mgmt" },
      { path: "/smartregnskab/app/workflow_builder", label: "Workflow Builder", icon: Workflow, tab: "workflow_builder" },
      { path: "/smartregnskab/app/integration_runs", label: "Integration Log", icon: Activity, tab: "integration_runs" },
      { path: "/smartregnskab/app/retry_queue", label: "Retry Kø", icon: RotateCw, tab: "retry_queue" },
      { path: "/smartregnskab/app/filhaandtering", label: "Filhåndtering", icon: FileText, tab: "filhaandtering" },
      { path: "/smartregnskab/app/filversioner", label: "Filversioner", icon: GitBranch, tab: "filversioner" },
      { path: "/smartregnskab/app/compliance_dokumenter", label: "Compliance Dok.", icon: ShieldCheck, tab: "compliance_dokumenter" },
      { path: "/smartregnskab/app/kontroltests", label: "Kontroltests", icon: ClipboardCheck, tab: "kontroltests" },
      { path: "/smartregnskab/app/sikkerhedsaudit", label: "Sikkerhedsaudit", icon: Lock, tab: "sikkerhedsaudit" },
      { path: "/smartregnskab/app/systemovervaagning", label: "Systemovervågning", icon: Activity, tab: "systemovervaagning" },
      { path: "/smartregnskab/app/leveringslog", label: "Leveringslog", icon: Send, tab: "leveringslog" },
      { path: "/smartregnskab/app/rbac_rettigheder", label: "RBAC Rettigheder", icon: KeyRound, tab: "rbac_rettigheder" },
      { path: "/smartregnskab/app/kunde_portal_indstillinger", label: "Kundeportal Indb.", icon: Settings, tab: "kunde_portal_indstillinger" },
      { path: "/smartregnskab/app/portal_dokumenter", label: "Portaldokumenter", icon: FileText, tab: "portal_dokumenter" },
      { path: "/smartregnskab/app/backup_regnskab", label: "Backup", icon: Archive, tab: "backup_regnskab" },
      { path: "/smartregnskab/app/ai_chef", label: "AI Regnskabschef (beta)", icon: BrainCircuit, tab: "ai_chef" },
      { path: "/smartregnskab/app/ai", label: "AI Regnskab (beta)", icon: Sparkles, tab: "ai" },
    ],
  },
];

export function RegnskabsPlatformShell({
  user,
  companyId,
  role,
  companyName,
}: {
  user: any;
  companyId: number;
  role: string;
  companyName: string;
}) {
  const [currentLocation] = useLocation();
  const { logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/smartregnskab/app") return currentLocation === "/smartregnskab/app";
    return currentLocation === path || currentLocation.startsWith(path + "/");
  };

  const initials = (user?.name || user?.email || "??")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const currentTabLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(i.path))?.label || "Regnskab";

  const sidebarContent = (
    <>
      {/* Logo + branding — fully independent */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="bg-emerald-600 rounded-md p-1.5 shrink-0">
          <Calculator className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <span className="font-bold text-[15px] text-sidebar-foreground block">ADD SmartRegnskab</span>
          <span className="text-[11px] text-sidebar-foreground/60 truncate block">
            {role === "platform_admin" ? "Platform administrator" : companyName}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? "nav-item-active"
                        : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/60"
                    }`}
                    data-testid={`nav-regnskab-${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: user info + logout — NO link to SmartRegnskab */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-1 text-xs text-sidebar-foreground/60 truncate">{user?.name} ({role})</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          data-testid="button-regnskab-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log ud
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background" data-testid="regnskabs-platform-shell">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0"
        data-testid="regnskabs-sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex min-w-0">
        <main className="flex-1 min-w-0 pb-32 md:pb-6">
          {/* Top bar — fully independent */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-11 bg-sidebar border-b border-sidebar-border text-sidebar-foreground">
            <div className="flex items-center gap-2 flex-1">
              <button
                className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent/60"
                onClick={() => setMobileNavOpen(true)}
                data-testid="button-mobile-regnskab-menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <div className="bg-emerald-600 rounded p-0.5 md:hidden">
                  <Calculator className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hidden sm:block">ADD SmartRegnskab</span>
              </div>
            </div>
            <h1 className="text-sm font-semibold text-sidebar-foreground truncate uppercase tracking-wider text-center px-2" data-testid="text-regnskab-current-tab">
              {currentTabLabel}
            </h1>
            <div className="flex items-center justify-end flex-1">
              <div className="w-7 h-7 rounded-md bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold ml-1" data-testid="text-regnskab-user-initials">
                {initials}
              </div>
            </div>
          </header>

          {/* Route content */}
          <div className="p-4 md:p-6">
            <Router hook={useHashLocation}>
              <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Indlæser modul…</div>}>
                <Switch>
                  <Route path="/smartregnskab/app" component={Regnskabssystem} />
                  <Route path="/smartregnskab/app/:tab" component={Regnskabssystem} />
                  <Route><Redirect to="/smartregnskab/app" /></Route>
                </Switch>
              </Suspense>
            </Router>
          </div>
        </main>
      </div>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileNavOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-testid="mobile-regnskab-nav"
          >
            <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-600 rounded p-1">
                  <Calculator className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm text-sidebar-foreground">ADD SmartRegnskab</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded hover:bg-sidebar-accent/60">
                <X className="w-4 h-4 text-sidebar-foreground/60" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{group.label}</p>
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileNavOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active ? "nav-item-active" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="p-3 border-t border-sidebar-border">
              <div className="px-3 py-1 text-xs text-sidebar-foreground/60 truncate">{user?.name} ({role})</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="w-full justify-start text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log ud
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

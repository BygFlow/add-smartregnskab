import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Search, HelpCircle, Settings, Bell, Sparkles, X } from "lucide-react";
import { useNotifications } from "@/App";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ROUTE_TITLES: Record<string, { title: string; breadcrumb: string }> = {
  "/": { title: "Dashboard", breadcrumb: "Oversigt" },
  "/opgaver": { title: "Opgaver", breadcrumb: "Drift" },
  "/tidregistrering": { title: "Tidsregistrering", breadcrumb: "Drift" },
  "/ansatte": { title: "Ansatte", breadcrumb: "Drift" },
  "/kunder": { title: "Kunder", breadcrumb: "Drift" },
  "/vagtplan": { title: "Vagtplan", breadcrumb: "Drift" },
  "/fravaer": { title: "Fravær", breadcrumb: "Drift" },
  "/fakturaer": { title: "Fakturaer", breadcrumb: "Økonomi" },
  "/tilbud": { title: "Tilbud", breadcrumb: "Økonomi" },
  "/regnskab": { title: "Regnskab", breadcrumb: "Økonomi" },
  "/rapporter": { title: "Rapporter", breadcrumb: "Økonomi" },
  "/materialer": { title: "Materialer", breadcrumb: "Virksomhed" },
  "/noegler": { title: "Nøgler", breadcrumb: "Virksomhed" },
  "/kvalitet": { title: "Kvalitetskontrol", breadcrumb: "Virksomhed" },
  "/notifikationer": { title: "Notifikationer", breadcrumb: "Overblik" },
  "/virksomhed": { title: "Virksomhed", breadcrumb: "Indstillinger" },
  "/integrationer": { title: "Integrationer", breadcrumb: "System" },
  "/abonnement": { title: "Abonnement", breadcrumb: "Indstillinger" },
  "/betaling": { title: "Betaling", breadcrumb: "Indstillinger" },
  "/gdpr": { title: "GDPR", breadcrumb: "System" },
  "/sikkerhed": { title: "Sikkerhed", breadcrumb: "System" },
  "/platform": { title: "Virksomheder", breadcrumb: "Platform" },
  "/platform/virksomhed": { title: "Virksomhed", breadcrumb: "Platform" },
  "/skabeloner": { title: "Skabeloner", breadcrumb: "Rengøring" },
  "/rengoringsservice": { title: "Ydelser", breadcrumb: "Rengøring" },
  "/rengoringsaftaler": { title: "Aftaler", breadcrumb: "Rengøring" },
  "/rengoringsplaner": { title: "Planer", breadcrumb: "Rengøring" },
  "/leads": { title: "AI Leads", breadcrumb: "Data" },
  "/backup": { title: "Backup", breadcrumb: "Data" },
  "/ai-tilæg": { title: "AI-tilæg", breadcrumb: "Tillægsmoduler" },
};

const SEARCH_ROUTES = [
  { path: "/", label: "Dashboard", category: "Overblik" },
  { path: "/opgaver", label: "Opgaver", category: "Drift" },
  { path: "/vagtplan", label: "Vagtplan", category: "Drift" },
  { path: "/tidregistrering", label: "Tidsregistrering", category: "Drift" },
  { path: "/ansatte", label: "Ansatte", category: "Drift" },
  { path: "/kunder", label: "Kunder", category: "Drift" },
  { path: "/fravaer", label: "Fravær", category: "Drift" },
  { path: "/tilbud", label: "Tilbud", category: "Økonomi" },
  { path: "/fakturaer", label: "Fakturaer", category: "Økonomi" },
  { path: "/regnskab", label: "Regnskab", category: "Økonomi" },
  { path: "/rapporter", label: "Rapporter", category: "Økonomi" },
  { path: "/skabeloner", label: "Skabeloner", category: "Rengøring" },
  { path: "/rengoringsservice", label: "Ydelser", category: "Rengøring" },
  { path: "/rengoringsaftaler", label: "Aftaler", category: "Rengøring" },
  { path: "/rengoringsplaner", label: "Planer", category: "Rengøring" },
  { path: "/materialer", label: "Materialer", category: "Virksomhed" },
  { path: "/noegler", label: "Nøgler", category: "Virksomhed" },
  { path: "/kvalitet", label: "Kvalitetskontrol", category: "Virksomhed" },
  { path: "/virksomhed", label: "Virksomhedsindstillinger", category: "System" },
  { path: "/integrationer", label: "Integrationer", category: "System" },
  { path: "/gdpr", label: "GDPR", category: "System" },
  { path: "/sikkerhed", label: "Sikkerhed", category: "System" },
  { path: "/leads", label: "AI Leads", category: "Data" },
  { path: "/backup", label: "Backup", category: "Data" },
  { path: "/notifikationer", label: "Notifikationer", category: "Overblik" },
];

const HELP_TOPICS = [
  { title: "Kom godt i gang", desc: "Lær at oprette din virksomhed, ansatte og kunder." },
  { title: "Opgaver & vagtplan", desc: "Sådan opretter du opgaver og planlægger vagter." },
  { title: "Tidsregistrering", desc: "Medarbejdere stempler ind/ud med GPS-tracking." },
  { title: "Kunder", desc: "Opret private og erhvervskunder med CVR-opslag." },
  { title: "Tilbud & fakturaer", desc: "Send tilbud, konverter til aftaler og fakturer." },
  { title: "Rengøringsydelser", desc: "Opsæt priser, varenumre og tillæg." },
  { title: "Skabeloner", desc: "Design tilbud og fakturaer med logo og farver." },
  { title: "AI & leads", desc: "AI henter leads og genererer tilbud — kræver godkendelse." },
  { title: "Integrationer", desc: "Tilslut e-mail, SMS, løn- og regnskabssystemer." },
  { title: "Backup", desc: "Automatisk daglig backup af alle data til skyen." },
  { title: "GDPR & sikkerhed", desc: "Håndtering af persondata og sikkerhedsindstillinger." },
  { title: "Pakker & abonnement", desc: "Vælg den pakke der passer til din virksomhed." },
];

export function TopBar({ companyId, role }: { companyId: number; role: string }) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { data: notifs } = useNotifications(companyId);
  const { toast } = useToast();
  const unreadCount = notifs?.filter(n => !n.read).length || 0;
  const routeInfo = ROUTE_TITLES[location] || { title: "Dashboard", breadcrumb: "Oversigt" };
  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return SEARCH_ROUTES;
    const q = searchQuery.toLowerCase();
    return SEARCH_ROUTES.filter(r => r.label.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [searchQuery]);

  const settingsPath = role === "platform_admin" ? "/platform" : "/virksomhed";

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-11 bg-sidebar border-b border-sidebar-border text-sidebar-foreground relative">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hidden sm:block">{routeInfo.breadcrumb}</span>
        </div>
        <h1 className="text-sm font-semibold text-sidebar-foreground truncate uppercase tracking-wider text-center px-2" data-testid="text-topbar-title">{routeInfo.title}</h1>
        <div className="flex items-center gap-1 justify-end flex-1">
          <button
            className="p-1.5 rounded-md hover:bg-sidebar-accent/60 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            data-testid="button-search"
            title="Søg"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="w-4 h-4" />
          </button>
          <Link
            href="/notifikationer"
            className="relative p-1.5 rounded-md hover:bg-sidebar-accent/60 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            data-testid="button-notifications"
            title="Notifikationer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}
          </Link>
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent/60 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title="AI-assistent"
            data-testid="button-mobile-ai"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-sidebar-accent/60 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors hidden sm:block"
            title="Hjælp"
            data-testid="button-help"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <Link
            href={settingsPath}
            className="p-1.5 rounded-md hover:bg-sidebar-accent/60 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors hidden sm:block"
            title="Indstillinger"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <div className="w-7 h-7 rounded-md bg-primary/20 text-primary flex items-center justify-center text-xs font-bold ml-1" data-testid="text-user-initials">
            {initials}
          </div>
        </div>
      </header>

      {/* Søgedialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="dialog-search">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                autoFocus
                placeholder="Søg efter sider, funktioner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-0"
                data-testid="input-search"
              />
              <button onClick={() => setSearchOpen(false)} className="p-1 rounded hover:bg-muted" data-testid="button-close-search">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredRoutes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Ingen resultater fundet</p>
            ) : (
              filteredRoutes.map((route) => (
                <button
                  key={route.path}
                  onClick={() => { navigate(route.path); setSearchOpen(false); setSearchQuery(""); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
                  data-testid={`button-search-result-${route.path.replace(/\//g, "")}`}
                >
                  <span className="text-sm font-medium">{route.label}</span>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{route.category}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hjælpedialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-help">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Hjælp & vejledning</h2>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {HELP_TOPICS.map((topic) => (
              <div key={topic.title} className="rounded-md border border-border/50 p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => { toast({ title: topic.title, description: topic.desc }); }}>
                <p className="text-sm font-medium">{topic.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{topic.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Brug også support-knappen i bunden for at oprette en support-sag.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

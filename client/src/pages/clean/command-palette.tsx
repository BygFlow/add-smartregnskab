import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  Bell,
  MessageSquare,
  ClipboardList,
  CalendarClock,
  Clock,
  Users,
  UserRound,
  Route as RouteIcon,
  Zap,
  Smartphone,
  FileCheck2,
  Receipt,
  FileBadge,
  Banknote,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Sparkles,
  Package,
  Wrench,
  Building2,
  KeyRound,
  ShieldCheck,
  MapPin,
  History,
  HeartPulse,
  FolderOpen,
  PenLine,
  MessageCircleQuestion,
  CreditCard,
  WifiOff,
  Star,
  Puzzle,
  Shield,
  Lock,
  Database,
  Upload,
  Rocket,
  Command as CommandIcon,
  Clock3,
} from "lucide-react";

/* ---------- sidedefinition ---------- */

interface PaletteEntry {
  path: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PAGES: PaletteEntry[] = [
  // Overblik
  { path: "/", label: "Dashboard", group: "Overblik", icon: Home },
  { path: "/notifikationer", label: "Notifikationer", group: "Overblik", icon: Bell },
  { path: "/kommunikation", label: "Kommunikation", group: "Overblik", icon: MessageSquare },

  // Drift
  { path: "/opgaver", label: "Opgaver", group: "Drift", icon: ClipboardList },
  { path: "/vagtplan", label: "Vagtplan", group: "Drift", icon: CalendarClock },
  { path: "/tidregistrering", label: "Tidsregistrering", group: "Drift", icon: Clock },
  { path: "/ansatte", label: "Ansatte", group: "Drift", icon: Users },
  { path: "/kunder", label: "Kunder", group: "Drift", icon: UserRound },
  { path: "/fravaer", label: "Fravær", group: "Drift", icon: Clock3 },
  { path: "/ruteplanlaegning", label: "Ruteplanlægning", group: "Drift", icon: RouteIcon },
  { path: "/live-driftstavle", label: "Live Driftstavle", group: "Drift", icon: Zap },
  { path: "/mobil-sync", label: "Mobil Sync", group: "Drift", icon: Smartphone },

  // Økonomi
  { path: "/tilbud", label: "Tilbud", group: "Økonomi", icon: FileCheck2 },
  { path: "/crm-pipeline", label: "CRM Pipeline", group: "Økonomi", icon: TrendingUp },
  { path: "/fakturaer", label: "Fakturaer", group: "Økonomi", icon: Receipt },
  { path: "/sla-kontrakter", label: "SLA & Kontrakter", group: "Økonomi", icon: FileBadge },
  { path: "/lonmotor", label: "Lønmotor", group: "Økonomi", icon: Banknote },
  { path: "/indkob", label: "Indkøb", group: "Økonomi", icon: ShoppingCart },
  { path: "/profitabilitet", label: "Profitabilitet", group: "Økonomi", icon: BarChart3 },
  { path: "/rapporter", label: "Rapporter", group: "Økonomi", icon: BarChart3 },

  // Rengøring
  { path: "/rengoringsservice", label: "Ydelser", group: "Rengøring", icon: Package },
  { path: "/rengoringsaftaler", label: "Aftaler", group: "Rengøring", icon: FileBadge },
  { path: "/rengoringsplaner", label: "Planer", group: "Rengøring", icon: ShieldCheck },
  { path: "/skabeloner", label: "Skabeloner", group: "Rengøring", icon: PenLine },

  // Virksomhed
  { path: "/virksomhed", label: "Indstillinger", group: "Virksomhed", icon: Building2 },
  { path: "/materialer", label: "Materialer", group: "Virksomhed", icon: Package },
  { path: "/noegler", label: "Nøgler", group: "Virksomhed", icon: KeyRound },
  { path: "/kvalitet", label: "Kvalitet", group: "Virksomhed", icon: ShieldCheck },
  { path: "/kvalitetskontrol-v2", label: "Kvalitetskontrol 2.0", group: "Virksomhed", icon: ShieldCheck },
  { path: "/kundeportal-admin", label: "Kundeportal", group: "Virksomhed", icon: Building2 },
  { path: "/hr-dokumenter", label: "HR Dokumenter", group: "Virksomhed", icon: FolderOpen },
  { path: "/lager", label: "Lager", group: "Virksomhed", icon: Package },
  { path: "/udstyr-service", label: "Udstyr & Service", group: "Virksomhed", icon: Wrench },
  { path: "/kunde-lokationer", label: "Kunde Lokationer", group: "Virksomhed", icon: MapPin },
  { path: "/servicehistorik", label: "Servicehistorik", group: "Virksomhed", icon: History },
  { path: "/arbejdsmiljo", label: "Arbejdsmiljø", group: "Virksomhed", icon: HeartPulse },
  { path: "/dokumentcenter", label: "Dokumentcenter", group: "Virksomhed", icon: FolderOpen },
  { path: "/esignatur", label: "E-signatur (beta)", group: "Virksomhed", icon: PenLine },
  { path: "/kunde-selvbetjening", label: "Kunde Selvbetjening", group: "Virksomhed", icon: MessageCircleQuestion },
  { path: "/platform-admin-tools", label: "Abonnementer", group: "Virksomhed", icon: CreditCard },
  { path: "/offline-konflikter", label: "Offline Konflikter", group: "Virksomhed", icon: WifiOff },
  { path: "/favoritter", label: "Favoritter", group: "Virksomhed", icon: Star },

  // System
  { path: "/integrationer", label: "Integrationer", group: "System", icon: Puzzle },
  { path: "/gdpr", label: "GDPR", group: "System", icon: Shield },
  { path: "/sikkerhed", label: "Sikkerhed", group: "System", icon: Lock },

  // Data
  { path: "/leads", label: "AI Leads", group: "Data", icon: Sparkles },
  { path: "/backup", label: "Backup", group: "Data", icon: Database },
  { path: "/import-eksport", label: "Import/eksport", group: "Data", icon: Upload },

  // Tillægsmoduler
  { path: "/ai-moduler", label: "AI-tilæg", group: "Tillægsmoduler", icon: Rocket },
  { path: "/ai-driftschef", label: "AI Driftschef (beta)", group: "Tillægsmoduler", icon: Sparkles },
  { path: "/ai-driftschef-opgaver", label: "AI Opgaver", group: "Tillægsmoduler", icon: Sparkles },
];

const PAGE_BY_PATH: Record<string, PaletteEntry> = PAGES.reduce(
  (acc, p) => ({ ...acc, [p.path]: p }),
  {} as Record<string, PaletteEntry>
);

const MAX_RECENT = 5;

/* ---------- typer ---------- */

interface NavigationFavorite {
  id: number;
  userId: string;
  companyId?: number | null;
  path: string;
  label: string;
  platform: string;
}

/* ---------- komponent ---------- */

export default function CommandPalette({}: { companyId?: number }) {
  const [, navigate] = useLocation();
  const { user, companyId } = useAuth();
  const userId = user ? String(user.id) : `company-${companyId}`;

  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const { data: favorites } = useQuery<NavigationFavorite[]>({
    queryKey: ["/api/navigation-favorites", companyId, userId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/navigation-favorites?companyId=${companyId}&userId=${encodeURIComponent(userId)}`
        )
      ).json(),
    enabled: open,
  });

  // Global tastaturgenvej: Cmd+K (Mac) eller Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const goTo = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
      setRecent((prev) => {
        const next = [path, ...prev.filter((p) => p !== path)];
        return next.slice(0, MAX_RECENT);
      });
    },
    [navigate]
  );

  const favoriteEntries = useMemo(() => {
    return (favorites ?? [])
      .filter((f) => f.platform === "smartdrift_clean")
      .map((f) => ({
        path: f.path,
        label: f.label,
        group: "Favoritter",
        icon: PAGE_BY_PATH[f.path]?.icon ?? Star,
      }));
  }, [favorites]);

  const recentEntries = useMemo(() => {
    return recent
      .map((path) => PAGE_BY_PATH[path])
      .filter((entry): entry is PaletteEntry => !!entry);
  }, [recent]);

  const groups = useMemo(() => {
    const map = new Map<string, PaletteEntry[]>();
    for (const page of PAGES) {
      const list = map.get(page.group) ?? [];
      list.push(page);
      map.set(page.group, list);
    }
    return Array.from(map.entries());
  }, []);

  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  }, []);

  return (
    <>
      <button
        type="button"
        data-testid="button-open-command-palette"
        onClick={() => setOpen(true)}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        <CommandIcon className="w-4 h-4" />
        Kommandopalette
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Søg efter en side..."
          data-testid="input-command-search"
        />
        <CommandList data-testid="list-command-results">
          <CommandEmpty data-testid="empty-command-results">Ingen sider fundet</CommandEmpty>

          {favoriteEntries.length > 0 && (
            <>
              <CommandGroup heading="Favoritter">
                {favoriteEntries.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <CommandItem
                      key={`fav-${entry.path}`}
                      value={`${entry.label} ${entry.path}`}
                      data-testid={`command-item-favorite-${entry.path.replace(/\//g, "-") || "root"}`}
                      onSelect={() => goTo(entry.path)}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{entry.label}</span>
                      <CommandShortcut>Favorit</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {recentEntries.length > 0 && (
            <>
              <CommandGroup heading="Senest besøgt">
                {recentEntries.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <CommandItem
                      key={`recent-${entry.path}`}
                      value={`${entry.label} ${entry.path} senest`}
                      data-testid={`command-item-recent-${entry.path.replace(/\//g, "-") || "root"}`}
                      onSelect={() => goTo(entry.path)}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{entry.label}</span>
                      <CommandShortcut>{entry.group}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {groups.map(([groupLabel, entries]) => (
            <CommandGroup key={groupLabel} heading={groupLabel}>
              {entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <CommandItem
                    key={entry.path}
                    value={`${entry.label} ${entry.path} ${entry.group}`}
                    data-testid={`command-item-${entry.path.replace(/\//g, "-") || "root"}`}
                    onSelect={() => goTo(entry.path)}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{entry.label}</span>
                    <CommandShortcut>{entry.group}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>Naviger med piletaster, vælg med Enter</span>
          <span className="font-mono">{isMac ? "⌘K" : "Ctrl+K"}</span>
        </div>
      </CommandDialog>
    </>
  );
}

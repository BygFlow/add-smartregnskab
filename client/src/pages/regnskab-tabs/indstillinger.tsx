import { Link } from "wouter";
import {
  Archive,
  Building2,
  Calculator,
  ChevronRight,
  FileText,
  Link2,
  Settings,
} from "lucide-react";

const SETTINGS = [
  {
    href: "/smartregnskab/app/virksomhedsindstillinger",
    title: "Virksomhedsoplysninger",
    description: "Navn, CVR, kontaktoplysninger, adresse, moms, valuta og bankoplysninger.",
    icon: Building2,
  },
  {
    href: "/smartregnskab/app/branche_profil",
    title: "Regnskabsopsætning",
    description: "Regnskabsår, selskabsform, branche, momsopsætning og regnskabsstandard.",
    icon: Calculator,
  },
  {
    href: "/smartregnskab/app/faktura_indstillinger",
    title: "Fakturaindstillinger",
    description: "Nummerserier, betalingsfrist og standardtekster på fakturaer og tilbud.",
    icon: FileText,
  },
  {
    href: "/smartregnskab/app/integration_configs",
    title: "Integrationsopsætning",
    description: "Bank, NemHandel, eksterne regnskabssystemer, API-forbindelser og leveringsstatus.",
    icon: Link2,
  },
  {
    href: "/smartregnskab/app/backup_regnskab",
    title: "Backup og dataopbevaring",
    description: "Se beskyttelse, sikkerhedskopier og lovpligtig opbevaring af regnskabsmateriale.",
    icon: Archive,
  },
] as const;

export default function Indstillinger() {
  return (
    <div className="space-y-6" data-testid="settings-overview">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Settings className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em]">Indstillinger</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Opsæt virksomheden ét sted</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Vælg det område, du vil ændre. Daglige funktioner ligger fortsat i hovedmenuen, mens
          tekniske specialmoduler er samlet under Avancerede moduler.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-40 flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
            data-testid={`settings-card-${href.split("/").pop()}`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

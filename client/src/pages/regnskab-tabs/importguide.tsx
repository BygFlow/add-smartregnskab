import { Building2 } from "lucide-react";
import MigrationWizard from "./migration-wizard";

export default function Importguide({ companyId }: { companyId: number }) {
  return (
    <div className="space-y-5">
      <div
        className="rounded-md border border-blue-300/60 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/20 dark:text-blue-200"
        data-testid="legal-entity-import-notice"
      >
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Importen tilhører det aktive juridiske selskab</div>
            <p className="mt-1 text-xs leading-5">
              Afdelinger og SE-enheder under selskabet indgår i det samme regnskab og
              åbnes derfor ikke som selvstændige regnskaber.
              Vælg det juridiske selskab, før du starter importen.
            </p>
          </div>
        </div>
      </div>

      <MigrationWizard companyId={companyId} />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive, CheckCircle2, Clock, Database, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";

interface BackupProtectionStatus {
  configured: boolean;
  encrypted: boolean;
  provider: string;
  schedule: string;
  lastBackupAt: string | null;
  lastStatus: string | null;
  lastVerified: boolean;
}

function dk(value: string | null) {
  if (!value) return "Ingen registreret endnu";
  return new Date(value).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short" });
}

export default function BackupRegnskab({ companyId: _companyId }: { companyId: number }) {
  const status = useQuery<BackupProtectionStatus>({
    queryKey: ["/api/backup-protection/status"],
    queryFn: async () => (await apiRequest("GET", "/api/backup-protection/status")).json(),
    refetchInterval: 60_000,
  });

  if (status.isLoading) {
    return <div className="space-y-3 p-4"><Skeleton className="h-8 w-64"/><Skeleton className="h-56 w-full"/></div>;
  }

  const data = status.data;
  const healthy = Boolean(data?.configured && data.lastStatus === "fuldfort" && data.lastVerified);
  return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-24" data-testid="page-backup-regnskab">
    <header>
      <h1 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5"/>Backup og databeskyttelse</h1>
      <p className="mt-1 text-sm text-muted-foreground">Status for den automatiske, krypterede platformsbackup. Ingen regnskabsdata vises her.</p>
    </header>

    <div className={`flex items-start gap-3 rounded-xl border p-4 ${healthy ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
      {healthy ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700"/> : <XCircle className="mt-0.5 h-5 w-5 text-amber-700"/>}
      <div><p className="font-semibold">{healthy ? "Backup er aktiv og senest verificeret" : "Backup kræver administratorens kontrol"}</p><p className="mt-1 text-sm text-muted-foreground">Kontakt support, hvis status ikke bliver grøn efter næste planlagte kørsel.</p></div>
    </div>

    <section className="grid gap-4 sm:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4"/>Ekstern backup</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Lager:</strong> {data?.provider || "Ikke konfigureret"}</p><p><strong>Plan:</strong> {data?.schedule || "—"}</p><p><strong>Seneste kørsel:</strong> {dk(data?.lastBackupAt || null)}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4"/>Integritetskontrol</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Status:</strong> {data?.lastVerified ? "SHA-256 og SQLite-kontrol bestået" : "Afventer verificering"}</p><p><strong>Kryptering:</strong> {data?.encrypted ? "AES-256-GCM" : "Ikke bekræftet"}</p><p><strong>Backupstatus:</strong> {data?.lastStatus || "Ingen kørsel"}</p></CardContent></Card>
    </section>

    <Card><CardContent className="flex gap-3 p-4 text-sm"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><div><p className="font-semibold">Adskilt platformadgang</p><p className="mt-1 text-muted-foreground">Platformadministratoren kan kontrollere backupdrift, men kan ikke åbne virksomhedens bilag, posteringer eller bankdata. En reel gendannelse udføres som en kontrolleret supportproces med virksomhedens godkendelse og fuldt revisionsspor.</p></div></CardContent></Card>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5"/>Status opdateres automatisk hvert minut.</p>
  </main>;
}

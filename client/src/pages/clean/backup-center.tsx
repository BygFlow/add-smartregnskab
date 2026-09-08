import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, openAuthedFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  Database,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
  Timer,
  AlertTriangle,
  Info,
} from "lucide-react";

interface BackupJob {
  id: number;
  companyId: number | null;
  scope: string;
  status: string;
  size?: string | null;
  destination?: string | null;
  autoSync?: number | boolean | null;
  summary?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  planlagt: {
    label: "Planlagt",
    className: "badge-soft badge-soft-amber",
    icon: <Clock className="w-3 h-3" />,
  },
  igang: {
    label: "I gang",
    className: "badge-soft badge-soft-blue",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  fuldfort: {
    label: "Fuldført",
    className: "badge-soft badge-soft-green",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  fejlet: {
    label: "Fejlet",
    className: "badge-soft badge-soft-red",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const SCOPE_CONFIG: Record<string, { label: string; style: React.CSSProperties }> = {
  platform: {
    label: "Platform",
    style: { backgroundColor: "rgb(243 232 255)", color: "rgb(126 34 206)" },
  },
  company: {
    label: "Virksomhed",
    style: { backgroundColor: "rgb(219 234 254)", color: "rgb(29 78 216)" },
  },
  employees: {
    label: "Medarbejdere",
    style: { backgroundColor: "rgb(209 250 229)", color: "rgb(4 120 87)" },
  },
  customers: {
    label: "Kunder",
    style: { backgroundColor: "rgb(255 237 213)", color: "rgb(194 65 12)" },
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    className: "badge-soft badge-soft-gray",
    icon: null,
  };
  return (
    <span className={cfg.className} data-testid={`badge-status-${status}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const cfg = SCOPE_CONFIG[scope] ?? {
    label: scope,
    style: { backgroundColor: "rgb(243 244 246)", color: "rgb(75 85 99)" },
  };
  return (
    <span className="badge-soft" style={cfg.style} data-testid={`badge-scope-${scope}`}>
      {cfg.label}
    </span>
  );
}

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BackupCenter({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isPlatformAdmin } = useAuth();

  const [retentionOpen, setRetentionOpen] = useState<BackupJob | null>(null);
  const [retentionDays, setRetentionDays] = useState("90");
  const [dryRunOpen, setDryRunOpen] = useState<{ backup: BackupJob; result: any } | null>(null);
  const [verifyOpen, setVerifyOpen] = useState<{ backup: BackupJob; result: any } | null>(null);

  const { data: companyBackups, isLoading: loadingCompany } = useQuery<BackupJob[]>({
    queryKey: ["/api/backups", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/backups")).json(),
  });

  const { data: platformBackups, isLoading: loadingPlatform } = useQuery<BackupJob[]>({
    queryKey: ["/api/platform/backups"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/backups")).json(),
    enabled: isPlatformAdmin,
  });

  const isLoading = loadingCompany || (isPlatformAdmin && loadingPlatform);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/backups"] });
    qc.invalidateQueries({ queryKey: ["/api/platform/backups"] });
  };

  const createBackup = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/backups", { scope: "company" })).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Backup oprettet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke oprette backup", description: e.message, variant: "destructive" }),
  });

  const downloadBackup = useMutation({
    mutationFn: async (id: number) => {
      await openAuthedFile(`/api/backups/${id}/download`, `backup-${id}.zip`);
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke downloade backup", description: e.message, variant: "destructive" }),
  });

  const verifyBackup = useMutation({
    mutationFn: async (backup: BackupJob) =>
      ({ backup, result: await (await apiRequest("POST", `/api/backups/${backup.id}/verify`)).json() }),
    onSuccess: (data) => {
      setVerifyOpen(data);
      toast({ title: "Backup verificeret" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke verificere backup", description: e.message, variant: "destructive" }),
  });

  const dryRunRestore = useMutation({
    mutationFn: async (backup: BackupJob) =>
      ({ backup, result: await (await apiRequest("POST", `/api/backups/${backup.id}/restore-dry-run`)).json() }),
    onSuccess: (data) => setDryRunOpen(data),
    onError: (e: any) =>
      toast({ title: "Kunne ikke køre prøve-gendannelse", description: e.message, variant: "destructive" }),
  });

  const setRetention = useMutation({
    mutationFn: async ({ id, days }: { id: number; days: number }) =>
      (await apiRequest("POST", `/api/backups/${id}/retention`, { retentionDays: days })).json(),
    onSuccess: () => {
      invalidate();
      setRetentionOpen(null);
      toast({ title: "Retention opdateret" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke opdatere retention", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-backup-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const company = companyBackups ?? [];
  const platform = isPlatformAdmin ? (platformBackups ?? []) : [];
  const all = [...company, ...platform];

  const totalCount = all.length;
  const completedCount = all.filter((b) => b.status === "fuldfort").length;
  const failedCount = all.filter((b) => b.status === "fejlet").length;
  const lastBackup = [...all].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24" data-testid="page-backup-center">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />Backup-center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overblik over backup-jobs, verificering og gendannelse
          </p>
        </div>
        <Button
          data-testid="button-opret-backup"
          onClick={() => createBackup.mutate()}
          disabled={createBackup.isPending}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {createBackup.isPending ? "Opretter..." : "Opret backup"}
        </Button>
      </div>

      <div className="rounded-md border border-border/70 bg-card p-3 flex items-start gap-2 text-sm" data-testid="banner-backup-info">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          Backup system sikrer at dine data aldrig mistes. Gendannelse kræver bekræftelse.
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-total-backups">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Antal backups</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-backups">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fuldført</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-500">{completedCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-failed-backups">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fejlet</CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-red-600 dark:text-red-500">{failedCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-last-backup">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Seneste backup</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{lastBackup ? dk(lastBackup.createdAt) : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {all.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-backups">
          <Database className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Der er ingen backups endnu</p>
        </div>
      ) : (
        <Card data-testid="card-backup-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1400px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Omfang</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Størrelse</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Auto-sync</TableHead>
                    <TableHead>Oprettet</TableHead>
                    <TableHead>Oprettet af</TableHead>
                    <TableHead className="text-right">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((b) => (
                    <TableRow key={`${b.scope}-${b.id}`} data-testid={`row-backup-${b.id}`}>
                      <TableCell>
                        <ScopeBadge scope={b.scope} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-sm">{b.size || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.destination || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {b.autoSync ? (
                          <span className="badge-soft badge-soft-green">Aktiv</span>
                        ) : (
                          <span className="badge-soft badge-soft-gray">Slået fra</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dk(b.createdAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.createdBy || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-download-${b.id}`}
                            disabled={downloadBackup.isPending}
                            onClick={() => downloadBackup.mutate(b.id)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-verificer-${b.id}`}
                            disabled={verifyBackup.isPending}
                            onClick={() => verifyBackup.mutate(b)}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                            Verificer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-gendan-${b.id}`}
                            disabled={dryRunRestore.isPending}
                            onClick={() => dryRunRestore.mutate(b)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Gendan (prøvekørsel)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-retention-${b.id}`}
                            onClick={() => {
                              setRetentionOpen(b);
                              setRetentionDays("90");
                            }}
                          >
                            <Timer className="w-3.5 h-3.5 mr-1" />
                            Retention
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verificer-dialog */}
      <Dialog open={!!verifyOpen} onOpenChange={(open) => !open && setVerifyOpen(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-verify-result">
          <DialogHeader>
            <DialogTitle>Verificeringsresultat</DialogTitle>
            <DialogDescription>
              Backup #{verifyOpen?.backup.id} ({verifyOpen?.backup.scope})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {verifyOpen?.result?.valid !== false ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span>{verifyOpen?.result?.valid !== false ? "Checksum bekræftet — backup er intakt" : "Checksum mismatch — backup kan være beskadiget"}</span>
            </div>
            {verifyOpen?.result?.checksum && (
              <div className="rounded-md bg-muted p-2 font-mono text-xs break-all" data-testid="text-checksum">
                {verifyOpen.result.checksum}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button data-testid="button-close-verify" onClick={() => setVerifyOpen(null)}>Luk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gendan prøvekørsel-dialog */}
      <Dialog open={!!dryRunOpen} onOpenChange={(open) => !open && setDryRunOpen(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-restore-dry-run">
          <DialogHeader>
            <DialogTitle>Prøvekørsel af gendannelse</DialogTitle>
            <DialogDescription>
              Backup #{dryRunOpen?.backup.id} ({dryRunOpen?.backup.scope})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300 text-xs">
                Dette er kun en prøvekørsel — ingen data ændres. En reel gendannelse kræver separat bekræftelse.
              </span>
            </div>
            <div>
              <p className="font-medium mb-1">Berørte tabeller:</p>
              {Array.isArray(dryRunOpen?.result?.affectedTables) && dryRunOpen!.result.affectedTables.length > 0 ? (
                <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5" data-testid="list-affected-tables">
                  {dryRunOpen!.result.affectedTables.map((t: string, i: number) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">Ingen tabeller angivet</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="button-close-dry-run" onClick={() => setDryRunOpen(null)}>Luk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retention-dialog */}
      <Dialog open={!!retentionOpen} onOpenChange={(open) => !open && setRetentionOpen(null)}>
        <DialogContent className="max-w-sm" data-testid="dialog-retention">
          <DialogHeader>
            <DialogTitle>Sæt retention-periode</DialogTitle>
            <DialogDescription>
              Backup #{retentionOpen?.id} ({retentionOpen?.scope})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="retention-days">Antal dage backup skal beholdes</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              data-testid="input-retention-days"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              data-testid="button-save-retention"
              disabled={setRetention.isPending}
              onClick={() => {
                if (!retentionOpen) return;
                const days = parseInt(retentionDays, 10);
                if (!Number.isFinite(days) || days < 1) {
                  toast({ title: "Angiv et gyldigt antal dage", variant: "destructive" });
                  return;
                }
                setRetention.mutate({ id: retentionOpen.id, days });
              }}
            >
              {setRetention.isPending ? "Gemmer..." : "Gem retention"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

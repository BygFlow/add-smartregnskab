import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, openAuthedFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  AlertTriangle,
  Info,
  FlaskConical,
} from "lucide-react";

interface BackupJob {
  id: number;
  companyId: number | null;
  scope: string;
  status: string;
  size?: string | null;
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

export default function BackupRegnskab({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [restoreTarget, setRestoreTarget] = useState<BackupJob | null>(null);
  const [dryRunOpen, setDryRunOpen] = useState<{ backup: BackupJob; result: any } | null>(null);
  const [verifyOpen, setVerifyOpen] = useState<{ backup: BackupJob; result: any } | null>(null);

  const { data: backups, isLoading } = useQuery<BackupJob[]>({
    queryKey: ["/api/backups", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/backups")).json(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/backups"] });

  const createBackup = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/backups", { scope: "company" })).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Backup af regnskabsdata oprettet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke oprette backup", description: e.message, variant: "destructive" }),
  });

  const downloadBackup = useMutation({
    mutationFn: async (id: number) => {
      await openAuthedFile(`/api/backups/${id}/download`, `regnskab-backup-${id}.zip`);
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
    onSuccess: (data) => {
      setDryRunOpen(data);
      setRestoreTarget(null);
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke køre prøve-gendannelse", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-backup-regnskab">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = backups ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24" data-testid="page-backup-regnskab">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />Backup — Regnskab
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sikkerhedskopiering af regnskabsdata for virksomheden
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
          Backup af regnskabsdata. Gendannelse overskriver eksisterende data.
        </span>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 flex items-start gap-2 text-sm" data-testid="banner-beta">
        <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <span className="text-blue-800 dark:text-blue-300">
          <strong>BETA:</strong> Automatisk daglig backup kræver opsætning.
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-backups">
          <Database className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Der er ingen backups af regnskabsdata endnu</p>
        </div>
      ) : (
        <Card data-testid="card-backup-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Omfang</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Størrelse</TableHead>
                    <TableHead>Oprettet</TableHead>
                    <TableHead>Oprettet af</TableHead>
                    <TableHead className="text-right">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((b) => (
                    <TableRow key={b.id} data-testid={`row-backup-${b.id}`}>
                      <TableCell className="text-sm">{b.scope}</TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-sm">{b.size || "—"}</TableCell>
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
                            onClick={() => setRestoreTarget(b)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Gendan (prøvekørsel)
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

      {/* Bekræftelsesdialog inden prøvekørsel af gendannelse */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent data-testid="dialog-confirm-restore">
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft prøvekørsel af gendannelse</AlertDialogTitle>
            <AlertDialogDescription>
              Du er ved at køre en prøvekørsel af gendannelse for backup #{restoreTarget?.id}. Dette ændrer
              ikke nogen data, men viser hvilke tabeller der ville blive påvirket ved en reel gendannelse.
              En reel gendannelse overskriver eksisterende regnskabsdata og kræver separat bekræftelse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-restore">Annuller</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-restore"
              disabled={dryRunRestore.isPending}
              onClick={() => {
                if (restoreTarget) dryRunRestore.mutate(restoreTarget);
              }}
            >
              {dryRunRestore.isPending ? "Kører..." : "Kør prøvekørsel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verificer-resultat */}
      <Dialog open={!!verifyOpen} onOpenChange={(open) => !open && setVerifyOpen(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-verify-result">
          <DialogHeader>
            <DialogTitle>Verificeringsresultat</DialogTitle>
            <DialogDescription>Backup #{verifyOpen?.backup.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {verifyOpen?.result?.valid !== false ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span>
                {verifyOpen?.result?.valid !== false
                  ? "Checksum bekræftet — backup er intakt"
                  : "Checksum mismatch — backup kan være beskadiget"}
              </span>
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

      {/* Prøvekørsel-resultat */}
      <Dialog open={!!dryRunOpen} onOpenChange={(open) => !open && setDryRunOpen(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-restore-dry-run">
          <DialogHeader>
            <DialogTitle>Resultat af prøvekørsel</DialogTitle>
            <DialogDescription>Backup #{dryRunOpen?.backup.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300 text-xs">
                Dette var kun en prøvekørsel — ingen regnskabsdata er ændret.
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
    </div>
  );
}

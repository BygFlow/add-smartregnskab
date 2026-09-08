import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
  RefreshCw,
  Smartphone,
  Plus,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

type SyncStatus = "afventer" | "synkroniseret" | "konflikt" | "fejl";
type SyncType = "tjekliste" | "foto" | "qr" | "nfc" | "tidsreg";

interface MobileSyncItem {
  id: number;
  companyId: number;
  employeeName: string;
  deviceInfo?: string | null;
  syncType: SyncType | string;
  status: SyncStatus | string;
  syncedAt?: string | null;
  errorMessage?: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  afventer: {
    label: "Afventer",
    className: "badge-soft badge-soft-blue",
    icon: <Clock className="w-3 h-3" />,
  },
  synkroniseret: {
    label: "Synkroniseret",
    className: "badge-soft badge-soft-green",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  konflikt: {
    label: "Konflikt",
    className: "badge-soft badge-soft-amber",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  fejl: {
    label: "Fejl",
    className: "badge-soft badge-soft-red",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const SYNC_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  tjekliste: {
    label: "Tjekliste",
    className: "badge-soft badge-soft-blue",
  },
  foto: {
    label: "Foto",
    className: "badge-soft badge-soft-gray",
  },
  qr: {
    label: "QR",
    className: "badge-soft badge-soft-green",
  },
  nfc: {
    label: "NFC",
    className: "badge-soft badge-soft-amber",
  },
  tidsreg: {
    label: "Tidsreg",
    className: "badge-soft badge-soft-red",
  },
};

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

export default function MobilSync({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: items, isLoading } = useQuery<MobileSyncItem[]>({
    queryKey: ["/api/mobile-sync", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/mobile-sync?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/mobile-sync"] });

  const createItem = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/mobile-sync?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Sync-post oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette sync-post",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/mobile-sync/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Post synkroniseret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke synkronisere post",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-mobil-sync">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = items ?? [];
  const pendingCount = list.filter((i) => i.status === "afventer").length;

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5" />Mobil sync
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mobil sync-kø — håndterer offline data fra medarbejder-app
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-sync" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Tilføj post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ny sync-post</DialogTitle>
            </DialogHeader>
            <SyncForm
              pending={createItem.isPending}
              onSubmit={async (data) => {
                await createItem.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border/70 bg-card p-3 flex items-center gap-2 text-sm">
        <CloudOff className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {pendingCount} post(er) afventer synkronisering
        </span>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-mobil-sync"
        >
          <CloudOff className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen sync-poster i køen</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-mobil-sync">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medarbejder</TableHead>
                <TableHead>Enhed</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Synkroniseret</TableHead>
                <TableHead>Fejlbesked</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => {
                const status = STATUS_CONFIG[item.status as string] ?? {
                  label: item.status,
                  className: "badge-soft badge-soft-gray",
                  icon: null,
                };
                const type = SYNC_TYPE_CONFIG[item.syncType as string] ?? {
                  label: item.syncType,
                  className: "badge-soft badge-soft-gray",
                };
                return (
                  <TableRow key={item.id} data-testid={`row-sync-${item.id}`}>
                    <TableCell className="font-medium">{item.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.deviceInfo || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={type.className} data-testid={`badge-sync-type-${item.id}`}>
                        {type.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={status.className}
                        data-testid={`badge-sync-status-${item.id}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dk(item.syncedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                      {item.errorMessage || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.status === "afventer" && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-sync-${item.id}`}
                          disabled={updateItem.isPending}
                          onClick={() =>
                            updateItem.mutate({
                              id: item.id,
                              data: {
                                status: "synkroniseret",
                                syncedAt: new Date().toISOString(),
                              },
                            })
                          }
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Synkroniser
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SyncForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [deviceInfo, setDeviceInfo] = useState("");
  const [syncType, setSyncType] = useState<SyncType>("tjekliste");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      employeeName,
      deviceInfo: deviceInfo || null,
      syncType,
      status: "afventer",
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sync-employee">Medarbejder *</Label>
        <Input
          id="sync-employee"
          data-testid="input-sync-employee"
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sync-device">Enhedsinfo</Label>
        <Input
          id="sync-device"
          data-testid="input-sync-device"
          value={deviceInfo}
          onChange={(e) => setDeviceInfo(e.target.value)}
          placeholder="f.eks. iPhone 14 Pro"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sync-type">Sync-type</Label>
        <select
          id="sync-type"
          data-testid="input-sync-type"
          value={syncType}
          onChange={(e) => setSyncType(e.target.value as SyncType)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(SYNC_TYPE_CONFIG).map(([id, c]) => (
            <option key={id} value={id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-sync"
        >
          {submitting || pending ? "Gemmer..." : "Gem post"}
        </Button>
      </DialogFooter>
    </form>
  );
}

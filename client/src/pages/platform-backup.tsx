import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient, openAuthedFile } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@///hooks/use-toast";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Database, Plus, Info, Download, Shield, Cloud, Clock, CalendarClock, History, CloudUpload, Settings, Link2, Unlink, Trash2, CheckCircle2, Server } from "lucide-react";

type PlatformBackup = {
  id: number;
  companyId: number | null;
  scope: string;
  status: string;
  size: string | null;
  destination: string | null;
  autoSync: number | null;
  summary: string | null;
  createdBy: string | null;
  createdAt: string;
};

type CloudProvider = {
  id: number;
  provider: string;
  displayName: string;
  credentials: string | null;
  bucket: string | null;
  region: string | null;
  status: string;
  lastSync: string | null;
  createdAt: string;
};

type SystemInfo = {
  version: string;
  installedAt: string | null;
  lastUpdate: string | null;
  companyCount: number;
  userCount: number;
  releaseCount: number;
  status: string;
};

const STATUS: Record<string, { label: string; variant: "blue" | "green" | "amber" | "red" | "gray" }> = {
  planlagt: { label: "Planlagt", variant: "amber" },
  igang: { label: "Igangværende", variant: "blue" },
  fuldfort: { label: "Fuldført", variant: "green" },
  fuldfoert: { label: "Fuldført", variant: "green" },
  fejlet: { label: "Fejlet", variant: "red" },
  afbrudt: { label: "Afbrudt", variant: "amber" },
};

const PROVIDER_LABELS: Record<string, string> = {
  aws_s3: "AWS S3",
  google_drive: "Google Drive",
  onedrive: "Microsoft OneDrive",
  dropbox: "Dropbox",
  local: "Lokal server",
};

const PROVIDER_ICONS: Record<string, string> = {
  aws_s3: "☁️",
  google_drive: "📁",
  onedrive: "💾",
  dropbox: "📦",
  local: "🖥️",
};

function date(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dateOnly(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

function nextScheduled(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(2, 0, 0, 0);
  return next.toLocaleString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PlatformBackup() {
  const { toast } = useToast();
  const [addCloudOpen, setAddCloudOpen] = useState(false);
  const [cloudForm, setCloudForm] = useState({ provider: "aws_s3", displayName: "", bucket: "", region: "eu-west-1", accessKey: "", secretKey: "" });

  const backups = useQuery<PlatformBackup[]>({
    queryKey: ["/api/platform/backups"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/backups")).json(),
  });

  const cloudProviders = useQuery<CloudProvider[]>({
    queryKey: ["/api/cloud-providers"],
    queryFn: async () => (await apiRequest("GET", "/api/cloud-providers")).json(),
  });

  const systemInfo = useQuery<SystemInfo>({
    queryKey: ["/api/system/info"],
    queryFn: async () => (await apiRequest("GET", "/api/system/info")).json(),
  });

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/platform/backups")).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/backups"] });
      toast({ title: "Backup oprettet", description: "Platform backup er oprettet og gemt i cloud." });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette backup", description: e.message, variant: "destructive" }),
  });

  const toggleAutoSync = useMutation({
    mutationFn: async (enabled: boolean) => (await apiRequest("PATCH", "/api/platform/backups/auto-sync", { enabled })).json(),
    onSuccess: (_d, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/backups"] });
      toast({ title: enabled ? "Auto-sync aktiveret" : "Auto-sync deaktiveret", description: enabled ? "Daglig backup kl. 02:00 er slået til." : "Daglig backup er slået fra." });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke ændre auto-sync", description: e.message, variant: "destructive" }),
  });

  const addCloudProvider = useMutation({
    mutationFn: async () => {
      const body = {
        provider: cloudForm.provider,
        displayName: cloudForm.displayName || PROVIDER_LABELS[cloudForm.provider] || cloudForm.provider,
        bucket: cloudForm.bucket,
        region: cloudForm.region,
        credentials: JSON.stringify({ accessKey: cloudForm.accessKey, secretKey: cloudForm.secretKey }),
        status: "afbrudt",
      };
      return (await apiRequest("POST", "/api/cloud-providers", body)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-providers"] });
      toast({ title: "Cloud-udbyder tilføjet", description: "Klik 'Tilslut' for at aktivere forbindelsen." });
      setAddCloudOpen(false);
      setCloudForm({ provider: "aws_s3", displayName: "", bucket: "", region: "eu-west-1", accessKey: "", secretKey: "" });
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const connectProvider = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/cloud-providers/${id}/connect`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-providers"] });
      toast({ title: "Forbundet", description: "Cloud-udbyder er nu forbundet og klar til backup." });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke forbinde", description: e.message, variant: "destructive" }),
  });

  const disconnectProvider = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/cloud-providers/${id}/disconnect`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-providers"] });
      toast({ title: "Afbrudt", description: "Cloud-forbindelse er afbrudt." });
    },
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/cloud-providers/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-providers"] });
      toast({ title: "Slettet", description: "Cloud-udbyder er slettet." });
    },
  });

  const rows = backups.data ?? [];
  const lastBackup = rows[0];
  const autoSyncOn = (lastBackup?.autoSync ?? 1) === 1;
  const lastStatus = lastBackup ? (STATUS[lastBackup.status]?.label ?? lastBackup.status) : "—";
  const providers = cloudProviders.data ?? [];
  const sysInfo = systemInfo.data;

  return (
    <div className="p-4 md:p-6 space-y-3" data-testid="page-platform-backup">
      <PageHeader
        title="Platform Backup"
        description="Cloud-tilslutning, backup, installation og systeminformation"
        action={
          <Button size="sm" data-testid="button-create-platform-backup" disabled={create.isPending} onClick={() => create.mutate()}>
            <Plus className="w-4 h-4" /> Opret backup nu
          </Button>
        }
      />

      {/* Statuskort */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <MetricCard data-testid="metric-backup-status" icon={<Shield className="w-4 h-4" />} value={lastStatus} label="Backup-status" variant={lastBackup?.status === "fuldfort" || lastBackup?.status === "fuldfoert" ? "green" : "amber"} />
        <MetricCard data-testid="metric-backup-last" icon={<Clock className="w-4 h-4" />} value={lastBackup ? dateOnly(lastBackup.createdAt) : "—"} label="Seneste backup" variant="blue" />
        <MetricCard data-testid="metric-backup-next" icon={<CalendarClock className="w-4 h-4" />} value={autoSyncOn ? nextScheduled() : "Deaktiveret"} label="Næste planlagte" variant={autoSyncOn ? "blue" : "gray"} />
        <MetricCard data-testid="metric-backup-count" icon={<History className="w-4 h-4" />} value={rows.length} label="Backups i alt" variant="primary" />
      </div>

      {/* Cloud-udbydere */}
      <SectionCard
        title="Cloud-tilslutning"
        icon={<Cloud className="w-4 h-4" />}
        action={
          <Button variant="outline" size="sm" onClick={() => setAddCloudOpen(true)} data-testid="button-add-cloud-provider">
            <Plus className="w-4 h-4" /> Tilføj udbyder
          </Button>
        }
      >
        {cloudProviders.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : providers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CloudUpload className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ingen cloud-udbydere tilsluttet.</p>
            <p className="text-xs mt-1">Tilføj en udbyder for at aktivere cloud-backup og synkronisering.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-md border border-border/60" data-testid={`card-cloud-provider-${p.id}`}>
                <div className="text-2xl shrink-0">{PROVIDER_ICONS[p.provider] || "☁️"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{p.displayName}</span>
                    <StatusChip
                      status={p.status === "forbundet" ? "Forbundet" : p.status === "afbrudt" ? "Afbrudt" : "Fejl"}
                      variant={p.status === "forbundet" ? "green" : p.status === "afbrudt" ? "gray" : "red"}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {PROVIDER_LABELS[p.provider] || p.provider}
                    {p.bucket && ` · ${p.bucket}`}
                    {p.region && ` · ${p.region}`}
                    {p.lastSync && ` · Sidst synk: ${date(p.lastSync)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status === "forbundet" ? (
                    <Button variant="ghost" size="sm" onClick={() => disconnectProvider.mutate(p.id)} data-testid={`button-disconnect-${p.id}`}>
                      <Unlink className="w-3.5 h-3.5" /> Afbryd
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => connectProvider.mutate(p.id)} data-testid={`button-connect-${p.id}`}>
                      <Link2 className="w-3.5 h-3.5" /> Tilslut
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteProvider.mutate(p.id)} data-testid={`button-delete-cloud-${p.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Auto-sync toggle */}
      <SectionCard title="Automatisk synkronisering" icon={<Cloud className="w-4 h-4" />}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Daglig auto-sync</p>
            <p className="text-xs text-muted-foreground">
              Når aktiveret oprettes automatisk en platform backup hver dag kl. 02:00 til cloud-destinationen.
            </p>
          </div>
          <Switch
            checked={autoSyncOn}
            disabled={toggleAutoSync.isPending}
            onCheckedChange={(v) => toggleAutoSync.mutate(v)}
            data-testid="switch-auto-sync"
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2" data-testid="auto-sync-indicator">
          {autoSyncOn ? "Auto-sync: aktiv (daglig kl. 02:00)" : "Auto-sync: inaktiv"}
        </p>
      </SectionCard>

      {/* Systeminstallation */}
      <SectionCard title="Systeminstallation" icon={<Server className="w-4 h-4" />}>
        {systemInfo.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : sysInfo ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Version</Label>
              <p className="text-sm font-medium text-foreground" data-testid="text-system-version">{sysInfo.version}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-sm font-medium text-foreground capitalize">{sysInfo.status}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Installeret</Label>
              <p className="text-sm text-foreground">{date(sysInfo.installedAt)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Seneste opdatering</Label>
              <p className="text-sm text-foreground">{date(sysInfo.lastUpdate)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Virksomheder</Label>
              <p className="text-sm text-foreground">{sysInfo.companyCount}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Brugere</Label>
              <p className="text-sm text-foreground">{sysInfo.userCount}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Kunne ikke hente systeminformation.</p>
        )}
      </SectionCard>

      {/* Historik */}
      <SectionCard title="Backup-historik" icon={<Database className="w-4 h-4" />} noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th>Dato</th>
                <th>Scope</th>
                <th>Størrelse</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Oprettet af</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {backups.isLoading ? (
                <tr><td colSpan={7} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
              ) : rows.length === 0 ? (
                <tr data-testid="empty-platform-backups"><td colSpan={7} className="p-4 text-center text-muted-foreground text-xs">Ingen platform backups endnu.</td></tr>
              ) : rows.map((b) => {
                const s = STATUS[b.status] ?? { label: b.status, variant: "gray" as const };
                return (
                  <tr key={b.id} data-testid={`row-platform-backup-${b.id}`}>
                    <td className="p-3 whitespace-nowrap">{date(b.createdAt)}</td>
                    <td className="p-3 capitalize">{b.scope}</td>
                    <td className="p-3 tabular-nums" data-testid={`platform-backup-size-${b.id}`}>{b.size ?? "—"}</td>
                    <td className="p-3 capitalize">{b.destination ?? "cloud"}</td>
                    <td className="p-3"><StatusChip status={s.label} variant={s.variant} data-testid={`platform-backup-status-${b.id}`} /></td>
                    <td className="p-3 text-xs text-muted-foreground">{b.createdBy ?? "system"}</td>
                    <td className="p-3 text-right">
                      {b.status === "fuldfort" || b.status === "fuldfoert" ? (
                        <button type="button" onClick={() => openAuthedFile(`/api/backups/${b.id}/download`, `platform-backup-${b.id}.asrb`)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`button-download-platform-backup-${b.id}`}>
                          <Download className="w-3.5 h-3.5" /> Hent
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Om platform backup" icon={<Info className="w-4 h-4" />}>
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Denne backup dækker <span className="font-medium text-foreground">al platformdata</span> — alle
            virksomheder, brugere, abonnementer, fakturaer og indstillinger. Backups gemmes som selvstændige
            entiteter i cloud-destinationen og kan hentes individuelt.
          </p>
        </div>
      </SectionCard>

      {/* Tilføj cloud-udbyder dialog */}
      <Dialog open={addCloudOpen} onOpenChange={setAddCloudOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tilføj cloud-udbyder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Udbyder</Label>
              <Select value={cloudForm.provider} onValueChange={(v) => setCloudForm({ ...cloudForm, provider: v })}>
                <SelectTrigger data-testid="select-cloud-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aws_s3">AWS S3</SelectItem>
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                  <SelectItem value="onedrive">Microsoft OneDrive</SelectItem>
                  <SelectItem value="dropbox">Dropbox</SelectItem>
                  <SelectItem value="local">Lokal server</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Visningsnavn</Label>
              <Input
                value={cloudForm.displayName}
                onChange={(e) => setCloudForm({ ...cloudForm, displayName: e.target.value })}
                placeholder={PROVIDER_LABELS[cloudForm.provider] || "Navn"}
                data-testid="input-cloud-display-name"
              />
            </div>
            {cloudForm.provider === "aws_s3" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">S3 Bucket</Label>
                  <Input
                    value={cloudForm.bucket}
                    onChange={(e) => setCloudForm({ ...cloudForm, bucket: e.target.value })}
                    placeholder="mit-backup-bucket"
                    data-testid="input-cloud-bucket"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Region</Label>
                  <Input
                    value={cloudForm.region}
                    onChange={(e) => setCloudForm({ ...cloudForm, region: e.target.value })}
                    placeholder="eu-west-1"
                    data-testid="input-cloud-region"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Access Key</Label>
                  <Input
                    value={cloudForm.accessKey}
                    onChange={(e) => setCloudForm({ ...cloudForm, accessKey: e.target.value })}
                    placeholder="AKIA..."
                    data-testid="input-cloud-access-key"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Secret Key</Label>
                  <Input
                    type="password"
                    value={cloudForm.secretKey}
                    onChange={(e) => setCloudForm({ ...cloudForm, secretKey: e.target.value })}
                    placeholder="••••••••"
                    data-testid="input-cloud-secret-key"
                  />
                </div>
              </>
            )}
            {cloudForm.provider === "google_drive" && (
              <div className="space-y-1">
                <Label className="text-xs">Mappe-ID (valgfrit)</Label>
                <Input
                  value={cloudForm.bucket}
                  onChange={(e) => setCloudForm({ ...cloudForm, bucket: e.target.value })}
                  placeholder="Drive mappe-ID"
                  data-testid="input-cloud-folder"
                />
                <p className="text-[11px] text-muted-foreground">Google Drive forbindelseskræver OAuth — konfigureres under opsætning.</p>
              </div>
            )}
            {cloudForm.provider === "onedrive" && (
              <p className="text-[11px] text-muted-foreground">OneDrive forbindelse kræver Microsoft OAuth — konfigureres under opsætning.</p>
            )}
            {cloudForm.provider === "dropbox" && (
              <p className="text-[11px] text-muted-foreground">Dropbox forbindelse kræver OAuth — konfigureres under opsætning.</p>
            )}
            {cloudForm.provider === "local" && (
              <p className="text-[11px] text-muted-foreground">Lokal backup gemmes på serveren. Ingen ekstra konfiguration nødvendig.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCloudOpen(false)} data-testid="button-cancel-cloud">Annuller</Button>
            <Button onClick={() => addCloudProvider.mutate()} disabled={addCloudProvider.isPending} data-testid="button-save-cloud">
              {addCloudProvider.isPending ? "Gemmer..." : "Tilføj udbyder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

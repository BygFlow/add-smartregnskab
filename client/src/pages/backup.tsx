import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, openAuthedFile } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SectionCard, StatusChip } from "@/components/premium";
import {
  Database,
  Plus,
  Info,
  Download,
  Cloud,
  CloudUpload,
  HardDrive,
  RefreshCw,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
} from "lucide-react";

type Backup = {
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

const STATUS: Record<string, { label: string; variant: "blue" | "green" | "amber" | "red" | "gray" }> = {
  planlagt: { label: "Planlagt", variant: "amber" },
  igang: { label: "Igangværende", variant: "blue" },
  fuldfort: { label: "Fuldført", variant: "green" },
  fuldfoert: { label: "Fuldført", variant: "green" },
  fejlet: { label: "Fejlet", variant: "red" },
  afbrudt: { label: "Afbrudt", variant: "amber" },
};

/* ------------------------------------------------------------------ */
/*  Cloud provider definition                                         */
/* ------------------------------------------------------------------ */

type ProviderType = "google_drive" | "dropbox" | "onedrive" | "aws_s3" | "local";

type ConfigField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password";
  required?: boolean;
};

type ProviderDef = {
  value: ProviderType;
  label: string;
  icon: React.ReactNode;
  fields: ConfigField[];
};

const PROVIDERS: ProviderDef[] = [
  {
    value: "google_drive",
    label: "Google Drive",
    icon: <Cloud className="w-4 h-4" />,
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxx.apps.googleusercontent.com", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", required: true },
      { key: "folderId", label: "Mappe-ID", placeholder: "Valgfrit — rodmappe hvis tomt" },
    ],
  },
  {
    value: "dropbox",
    label: "Dropbox",
    icon: <Cloud className="w-4 h-4" />,
    fields: [
      { key: "accessToken", label: "Access Token", type: "password", required: true },
      { key: "folderPath", label: "Mappesti", placeholder: "/backups" },
    ],
  },
  {
    value: "onedrive",
    label: "OneDrive",
    icon: <Cloud className="w-4 h-4" />,
    fields: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", required: true },
      { key: "tenantId", label: "Tenant ID", required: true },
    ],
  },
  {
    value: "aws_s3",
    label: "AWS S3",
    icon: <CloudUpload className="w-4 h-4" />,
    fields: [
      { key: "accessKey", label: "Access Key", required: true },
      { key: "secretKey", label: "Secret Key", type: "password", required: true },
      { key: "bucket", label: "Bucket", required: true },
      { key: "region", label: "Region", placeholder: "eu-west-1", required: true },
    ],
  },
  {
    value: "local",
    label: "Lokal disk",
    icon: <HardDrive className="w-4 h-4" />,
    fields: [],
  },
];

const PROVIDER_LABEL: Record<ProviderType, string> = {
  google_drive: "Google Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  aws_s3: "AWS S3",
  local: "Lokal disk",
};

const PROVIDER_ICON: Record<ProviderType, React.ReactNode> = {
  google_drive: <Cloud className="w-4 h-4" />,
  dropbox: <Cloud className="w-4 h-4" />,
  onedrive: <Cloud className="w-4 h-4" />,
  aws_s3: <CloudUpload className="w-4 h-4" />,
  local: <HardDrive className="w-4 h-4" />,
};

const SYNC_INTERVALS = [
  { value: "daily", label: "Dagligt" },
  { value: "weekly", label: "Ugentligt" },
  { value: "monthly", label: "Månedligt" },
];

const WEEKDAYS = [
  { value: "1", label: "Mandag" },
  { value: "2", label: "Tirsdag" },
  { value: "3", label: "Onsdag" },
  { value: "4", label: "Torsdag" },
  { value: "5", label: "Fredag" },
  { value: "6", label: "Lørdag" },
  { value: "0", label: "Søndag" },
];

type BackupSetting = {
  id: number;
  provider: ProviderType;
  displayName: string;
  config: Record<string, string>;
  autoSync: boolean | number | null;
  syncInterval: string | null;
  syncDay: string | null;
  syncTime: string | null;
  retentionDays: number | null;
  status?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
};

function providerDef(value: ProviderType): ProviderDef {
  return PROVIDERS.find((p) => p.value === value) ?? PROVIDERS[0];
}

function date(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Provider setup dialog                                             */
/* ------------------------------------------------------------------ */

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: BackupSetting | null;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  submitting: boolean;
}

type ProviderFormData = {
  provider: ProviderType;
  displayName: string;
  config: Record<string, string>;
  autoSync: boolean;
  syncInterval: string;
  syncDay: string;
  syncTime: string;
  retentionDays: number;
};

function ProviderDialog({ open, onOpenChange, editing, onSubmit, submitting }: ProviderDialogProps) {
  const isEdit = !!editing;
  const [provider, setProvider] = useState<ProviderType>(editing?.provider ?? "google_drive");
  const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
  const [config, setConfig] = useState<Record<string, string>>(editing?.config ?? {});
  const [autoSync, setAutoSync] = useState<boolean>(!!editing?.autoSync);
  const [syncInterval, setSyncInterval] = useState<string>(editing?.syncInterval ?? "daily");
  const [syncDay, setSyncDay] = useState<string>(editing?.syncDay ?? "1");
  const [syncTime, setSyncTime] = useState<string>(editing?.syncTime ?? "03:00");
  const [retentionDays, setRetentionDays] = useState<string>(String(editing?.retentionDays ?? 30));

  // Reset when dialog opens with new editing target
  const [lastEditingId, setLastEditingId] = useState<number | null>(null);
  if (open && editing && editing.id !== lastEditingId) {
    setLastEditingId(editing.id);
    setProvider(editing.provider);
    setDisplayName(editing.displayName);
    setConfig(editing.config ?? {});
    setAutoSync(!!editing.autoSync);
    setSyncInterval(editing.syncInterval ?? "daily");
    setSyncDay(editing.syncDay ?? "1");
    setSyncTime(editing.syncTime ?? "03:00");
    setRetentionDays(String(editing.retentionDays ?? 30));
  }
  if (open && !editing && lastEditingId !== null) {
    setLastEditingId(null);
    setProvider("google_drive");
    setDisplayName("");
    setConfig({});
    setAutoSync(false);
    setSyncInterval("daily");
    setSyncDay("1");
    setSyncTime("03:00");
    setRetentionDays("30");
  }

  const def = providerDef(provider);
  const showDaySelect = syncInterval === "weekly" || syncInterval === "monthly";

  const setField = (key: string, value: string) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ProviderFormData = {
      provider,
      displayName: displayName.trim() || PROVIDER_LABEL[provider],
      config,
      autoSync,
      syncInterval,
      syncDay,
      syncTime,
      retentionDays: parseInt(retentionDays, 10) || 30,
    };
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger cloud-udbyder" : "Tilføj cloud-udbyder"}</DialogTitle>
          <DialogDescription>
            Konfigurer en cloud-lagringsudbyder til automatisk sikkerhedskopiering.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="provider-type">Udbyder</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as ProviderType);
                setConfig({});
              }}
              disabled={isEdit}
            >
              <SelectTrigger data-testid="select-provider-type">
                <SelectValue placeholder="Vælg udbyder" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="inline-flex items-center gap-2">
                      {p.icon}
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-displayname">Visningsnavn</Label>
            <Input
              id="provider-displayname"
              data-testid="input-provider-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={PROVIDER_LABEL[provider]}
            />
          </div>

          {def.fields.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Konfiguration
              </p>
              {def.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`cfg-${field.key}`} className="text-xs">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    id={`cfg-${field.key}`}
                    data-testid={`input-config-${field.key}`}
                    type={field.type ?? "text"}
                    value={config[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-border p-3 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-sync" className="text-xs">Automatisk synkronisering</Label>
                <p className="text-[11px] text-muted-foreground">Kør backup på et fastlagt tidspunkt.</p>
              </div>
              <Switch
                id="auto-sync"
                checked={autoSync}
                onCheckedChange={setAutoSync}
                data-testid="switch-auto-sync"
              />
            </div>

            {autoSync && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Interval</Label>
                  <Select value={syncInterval} onValueChange={setSyncInterval}>
                    <SelectTrigger data-testid="select-sync-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_INTERVALS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showDaySelect ? (
                  <div className="space-y-1">
                    <Label className="text-xs">{syncInterval === "monthly" ? "Dag i måneden" : "Ugedag"}</Label>
                    {syncInterval === "monthly" ? (
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={syncDay}
                        onChange={(e) => setSyncDay(e.target.value)}
                        data-testid="input-sync-day"
                      />
                    ) : (
                      <Select value={syncDay} onValueChange={setSyncDay}>
                        <SelectTrigger data-testid="select-sync-day">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : null}
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="sync-time" className="text-xs">Tidspunkt</Label>
                  <Input
                    id="sync-time"
                    type="time"
                    value={syncTime}
                    onChange={(e) => setSyncTime(e.target.value)}
                    data-testid="input-sync-time"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retention-days">Opbevaringsperiode (dage)</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              data-testid="input-retention-days"
            />
            <p className="text-[11px] text-muted-foreground">
              Ældre backups slettes automatisk efter dette antal dage.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-provider"
            >
              Annuller
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              data-testid="button-save-provider"
            >
              {submitting ? "Gemmer…" : isEdit ? "Gem ændringer" : "Tilføj udbyder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider card                                                     */
/* ------------------------------------------------------------------ */

interface ProviderCardProps {
  setting: BackupSetting;
  testingId: number | null;
  syncingId: number | null;
  onTest: (id: number) => void;
  onSync: (id: number) => void;
  onEdit: (setting: BackupSetting) => void;
  onDelete: (setting: BackupSetting) => void;
}

function ProviderCard({ setting, testingId, syncingId, onTest, onSync, onEdit, onDelete }: ProviderCardProps) {
  const testing = testingId === setting.id;
  const syncing = syncingId === setting.id;

  const isError = setting.lastSyncStatus === "error" || setting.lastSyncStatus === "failed";
  const neverSynced = !setting.lastSyncAt;
  const statusLabel = neverSynced ? "Ikke synk." : isError ? "Fejl" : "Aktiv";
  const statusVariant: "blue" | "green" | "amber" | "red" | "gray" = neverSynced
    ? "gray"
    : isError
    ? "red"
    : "green";
  const statusIcon = neverSynced
    ? <Settings className="w-3 h-3" />
    : isError
    ? <XCircle className="w-3 h-3" />
    : <CheckCircle className="w-3 h-3" />;

  return (
    <div
      data-testid={`provider-card-${setting.id}`}
      className="rounded-md border border-border bg-card p-3 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground shrink-0">
            {PROVIDER_ICON[setting.provider] ?? <Cloud className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{setting.displayName}</p>
            <p className="text-[11px] text-muted-foreground">{PROVIDER_LABEL[setting.provider] ?? setting.provider}</p>
          </div>
        </div>
        <StatusChip
          status={statusLabel}
          variant={statusVariant}
          icon={statusIcon}
          data-testid={`provider-status-${setting.id}`}
        />
      </div>

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <p>
          <span className="text-muted-foreground/70">Seneste synk:</span>{" "}
          <span data-testid={`provider-last-sync-${setting.id}`}>{date(setting.lastSyncAt)}</span>
        </p>
        <p>
          <span className="text-muted-foreground/70">Auto-sync:</span>{" "}
          {setting.autoSync ? `${SYNC_INTERVALS.find((i) => i.value === setting.syncInterval)?.label ?? "—"} · ${setting.syncTime ?? "—"}` : "Fra"}
        </p>
        {setting.retentionDays != null && (
          <p>
            <span className="text-muted-foreground/70">Opbevaring:</span> {setting.retentionDays} dage
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button
          size="sm"
          variant="outline"
          disabled={testing}
          onClick={() => onTest(setting.id)}
          data-testid={`button-test-${setting.id}`}
        >
          {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          {testing ? "Tester…" : "Test forbindelse"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={syncing}
          onClick={() => onSync(setting.id)}
          data-testid={`button-sync-${setting.id}`}
        >
          {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {syncing ? "Synkroniserer…" : "Synkroniser nu"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(setting)}
          data-testid={`button-edit-${setting.id}`}
        >
          <Settings className="w-3.5 h-3.5" /> Rediger
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(setting)}
          data-testid={`button-delete-${setting.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" /> Slet
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

const SETTINGS_KEY = ["/api/backup-settings"];
const BACKUPS_KEY = ["/api/backups"];

export default function Backup() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BackupSetting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupSetting | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  /* ---- queries ---- */
  const settings = useQuery<BackupSetting[]>({
    queryKey: SETTINGS_KEY,
    queryFn: async () => (await apiRequest("GET", "/api/backup-settings")).json(),
  });

  const backups = useQuery<Backup[]>({
    queryKey: BACKUPS_KEY,
    queryFn: async () => (await apiRequest("GET", "/api/backups")).json(),
  });

  /* ---- create / update provider ---- */
  const saveSetting = useMutation({
    mutationFn: async (data: { id?: number; payload: any }) => {
      if (data.id != null) {
        return (await apiRequest("PATCH", `/api/backup-settings/${data.id}`, data.payload)).json();
      }
      return (await apiRequest("POST", "/api/backup-settings", data.payload)).json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast({
        title: vars.id != null ? "Udbyder opdateret" : "Udbyder tilføjet",
        description: "Cloud-indstillingerne er gemt.",
      });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) =>
      toast({ title: "Kunne ikke gemme udbyder", description: e.message, variant: "destructive" }),
  });

  /* ---- delete provider ---- */
  const deleteSetting = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/backup-settings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast({ title: "Udbyder slettet", description: "Cloud-udbyderen er fjernet." });
      setDeleteTarget(null);
    },
    onError: (e: Error) =>
      toast({ title: "Kunne ikke slette udbyder", description: e.message, variant: "destructive" }),
  });

  /* ---- test connection ---- */
  const testConnection = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", `/api/backup-settings/${id}/test`)).json(),
    onMutate: (id) => setTestingId(id),
    onSuccess: (data: { ok?: boolean; message?: string }, id) => {
      if (data.ok) {
        toast({ title: "Forbindelse OK", description: data.message ?? "Testen lykkedes." });
      } else {
        toast({
          title: "Forbindelse fejlede",
          description: data.message ?? "Kunne ikke forbinde til udbyderen.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      setTestingId(null);
      void id;
    },
    onError: (e: Error) => {
      toast({ title: "Forbindelse fejlede", description: e.message, variant: "destructive" });
      setTestingId(null);
    },
  });

  /* ---- manual sync ---- */
  const syncNow = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", `/api/backup-settings/${id}/sync`)).json(),
    onMutate: (id) => setSyncingId(id),
    onSuccess: (data: { ok?: boolean; message?: string; size?: string; job?: any }) => {
      if (data.ok) {
        toast({
          title: "Synkronisering startet",
          description: data.size ? `${data.message ?? "Synkroniserer…"} (${data.size})` : data.message ?? "Synkroniserer…",
        });
      } else {
        toast({
          title: "Synkronisering fejlede",
          description: data.message ?? "Kunne ikke synkronisere.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
      setSyncingId(null);
    },
    onError: (e: Error) => {
      toast({ title: "Synkronisering fejlede", description: e.message, variant: "destructive" });
      setSyncingId(null);
    },
  });

  /* ---- create manual backup ---- */
  const createBackup = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/backups")).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
      toast({ title: "Backup oprettet", description: "Din virksomhedsdata sikkerhedskopieres." });
    },
    onError: (e: Error) =>
      toast({ title: "Kunne ikke oprette backup", description: e.message, variant: "destructive" }),
  });

  const settingsList = settings.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: BackupSetting) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ProviderFormData) => {
    const payload = {
      provider: data.provider,
      displayName: data.displayName,
      config: data.config,
      autoSync: data.autoSync,
      syncInterval: data.syncInterval,
      syncDay: data.syncDay,
      syncTime: data.syncTime,
      retentionDays: data.retentionDays,
    };
    saveSetting.mutate({ id: editing?.id, payload });
  };

  const confirmDelete = () => {
    if (deleteTarget) deleteSetting.mutate(deleteTarget.id);
  };

  const cloudSummary = useMemo(() => {
    const total = settingsList.length;
    const active = settingsList.filter(
      (s) => s.status === "active" || s.lastSyncStatus === "ok" || s.lastSyncStatus === "success",
    ).length;
    return { total, active };
  }, [settingsList]);

  return (
    <div className="p-4 md:p-6 space-y-3" data-testid="page-backup">
      <PageHeader
        title="Backup"
        description="Sikkerhedskopier af din virksomheds data"
        action={
          <Button
            size="sm"
            data-testid="button-create-backup"
            disabled={createBackup.isPending}
            onClick={() => createBackup.mutate()}
          >
            <Plus className="w-4 h-4" /> Opret backup
          </Button>
        }
      />

      {/* ---- Cloud-indstillinger ---- */}
      <SectionCard
        title="Cloud-indstillinger"
        icon={<Cloud className="w-4 h-4" />}
        action={
          <Button size="sm" variant="outline" onClick={openAdd} data-testid="button-add-provider">
            <Plus className="w-3.5 h-3.5" /> Tilføj cloud-udbyder
          </Button>
        }
        noPadding
        className="overflow-hidden"
      >
        <div className="p-3 space-y-3" data-testid="provider-list">
          {settings.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
            </div>
          ) : settingsList.length === 0 ? (
            <div
              data-testid="empty-providers"
              className="flex flex-col items-center justify-center gap-2 py-10 text-center"
            >
              <Cloud className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">Ingen cloud-udbydere tilknyttet</p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Tilføj en udbyder som Google Drive, Dropbox, OneDrive eller AWS S3 for at synkronisere
                dine backups til skyen.
              </p>
              <Button size="sm" onClick={openAdd} data-testid="button-add-provider-empty" className="mt-1">
                <Plus className="w-3.5 h-3.5" /> Tilføj cloud-udbyder
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span data-testid="provider-count">{cloudSummary.total} udbydere</span>
                <span>·</span>
                <span data-testid="provider-active-count">{cloudSummary.active} aktive</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {settingsList.map((s) => (
                  <ProviderCard
                    key={s.id}
                    setting={s}
                    testingId={testingId}
                    syncingId={syncingId}
                    onTest={(id) => testConnection.mutate(id)}
                    onSync={(id) => syncNow.mutate(id)}
                    onEdit={openEdit}
                    onDelete={(target) => setDeleteTarget(target)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* ---- Backup history ---- */}
      <SectionCard
        title="Backup-historik"
        icon={<Database className="w-4 h-4" />}
        noPadding
        className="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="table-premium w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th>Dato</th>
                <th>Scope</th>
                <th>Størrelse</th>
                <th>Destination</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {backups.isLoading ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ) : (backups.data ?? []).length === 0 ? (
                <tr data-testid="empty-backups">
                  <td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">
                    Ingen backups endnu.
                  </td>
                </tr>
              ) : (
                (backups.data ?? []).map((b) => {
                  const s = STATUS[b.status] ?? { label: b.status, variant: "gray" as const };
                  return (
                    <tr key={b.id} data-testid={`row-backup-${b.id}`}>
                      <td className="p-3 whitespace-nowrap">{date(b.createdAt)}</td>
                      <td className="p-3 capitalize">{b.scope}</td>
                      <td className="p-3 tabular-nums" data-testid={`backup-size-${b.id}`}>
                        {b.size ?? "—"}
                      </td>
                      <td className="p-3 capitalize">{b.destination ?? "cloud"}</td>
                      <td className="p-3">
                        <StatusChip
                          status={s.label}
                          variant={s.variant}
                          data-testid={`backup-status-${b.id}`}
                        />
                      </td>
                      <td className="p-3 text-right">
                        {(b.status === "fuldfort" || b.status === "fuldfoert") && (
                          <button
                            type="button"
                            onClick={() => void openAuthedFile(`/api/backups/${b.id}/download`, `backup-${b.id}.zip`)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid={`button-download-backup-${b.id}`}
                          >
                            <Download className="w-3.5 h-3.5" /> Hent
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ---- About backup ---- */}
      <SectionCard title="Om backup" icon={<Info className="w-4 h-4" />}>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Backuppen dækker udelukkende <span className="font-medium text-foreground">din virksomheds data</span> —
          kunder, opgaver, fakturaer, ansatte og indstillinger. Platformens øvrige virksomheder er ikke
          inkluderet. Vi anbefaler at oprette en backup mindst en gang om ugen.
        </p>
      </SectionCard>

      {/* ---- Provider dialog ---- */}
      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSubmit={handleSubmit}
        submitting={saveSetting.isPending}
      />

      {/* ---- Delete confirmation ---- */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Slet cloud-udbyder</DialogTitle>
            <DialogDescription>
              Vil du slette <span className="font-medium text-foreground">{deleteTarget?.displayName}</span>?
              Eksisterende backups i skyen bevares, men fremtidig auto-sync stoppes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              data-testid="button-cancel-delete"
            >
              Annuller
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteSetting.isPending}
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
            >
              {deleteSetting.isPending ? "Sletter…" : "Slet udbyder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

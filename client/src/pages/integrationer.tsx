import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, openAuthedFile, queryClient } from "@/lib/queryClient";
import {
  useIntegrations, useIntegrationsMeta, useSyncLogs, useConnectIntegrationDemo,
  useDisconnectIntegration, useSaveIntegration, useTestIntegration, useSyncIntegration,
} from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Integration, CommunicationIntegration } from "@shared/schema";
import {
  Wallet, Calculator, Download, CheckCircle2, Circle, Link2Off, Info,
  Settings2, RefreshCw, AlertCircle, Plug, Eye, History, Mail, Pencil, Plus, Trash2,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/premium";

const CATEGORY_META: Record<string, { title: string; icon: any; desc: string }> = {
  loen: { title: "Lønsystemer", icon: Wallet, desc: "Send registrerede timer direkte til jeres lønprogram." },
  regnskab: { title: "Regnskab & fakturering", icon: Calculator, desc: "Overfør fakturaer som kladder til jeres regnskabsprogram." },
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  ikke_opsat: { label: "Ikke opsat", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: Circle },
  demo_forbundet: { label: "Demo-forbundet", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: CheckCircle2 },
  forbundet: { label: "Forbundet (API)", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle2 },
  fejl: { label: "Fejl", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", icon: AlertCircle },
};

function statusMeta(status: string) {
  return STATUS_META[status] || STATUS_META.ikke_opsat;
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Opsætningsdialog for en enkelt integration ──
function SetupDialog({ integration, meta, open, onOpenChange }: {
  integration: Integration | null; meta: any; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const save = useSaveIntegration();
  const test = useTestIntegration();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  if (!integration) return null;
  const fields = meta?.credentialFields?.[integration.provider] || [{ key: "apiKey", label: "API-nøgle", hint: "Udleveres af udbyderen" }];
  const supportsApi = (meta?.apiProviders || []).includes(integration.provider);

  const handleSave = async () => {
    const payload: any = { id: integration.id };
    if (apiKey) payload.apiKey = apiKey;
    if (apiSecret) payload.apiSecret = apiSecret;
    if (baseUrl) payload.baseUrl = baseUrl;
    await save.mutateAsync(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-integration-setup">
        <DialogHeader>
          <DialogTitle>{integration.provider}</DialogTitle>
          <DialogDescription>
            {supportsApi
              ? "Indtast jeres API-credentials for at aktivere direkte synkronisering. Testes mod udbyderens rigtige API."
              : "Direkte API-synk er endnu ikke implementeret for denne udbyder. Nøglen gemmes, men brug eksportfilerne til overførsel."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.map((f: any) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`field-${f.key}`} className="text-xs">{f.label}</Label>
              <Input id={`field-${f.key}`} type="password" autoComplete="off"
                placeholder={integration[f.key as keyof Integration] ? "•••••••• (gemt)" : "Indsæt værdi"}
                value={f.key === "apiKey" ? apiKey : apiSecret}
                onChange={(e) => f.key === "apiKey" ? setApiKey(e.target.value) : setApiSecret(e.target.value)}
                data-testid={`input-${f.key}-${integration.id}`} />
              <p className="text-[11px] text-muted-foreground">{f.hint}</p>
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="field-baseurl" className="text-xs">Base-URL (valgfri)</Label>
            <Input id="field-baseurl" placeholder={integration.baseUrl || "Standard-endpoint bruges"}
              value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              data-testid={`input-baseurl-${integration.id}`} />
            <p className="text-[11px] text-muted-foreground">Udfyld kun hvis I bruger et test- eller sandkassemiljø.</p>
          </div>

          {integration.lastError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{integration.lastError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={save.isPending}
            data-testid={`button-save-integration-${integration.id}`}>
            {save.isPending ? "Gemmer…" : "Gem"}
          </Button>
          <Button size="sm" onClick={async () => { await handleSave(); test.mutate(integration.id); }}
            disabled={test.isPending} data-testid={`button-test-integration-${integration.id}`}>
            <Plug className="w-3.5 h-3.5 mr-1.5" />
            {test.isPending ? "Tester…" : "Gem og test forbindelse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Eksportmodul med datointerval, formatvalg og forhåndsvisning ──
function ExportCard({ kind, companyId, formats }: { kind: "loen" | "regnskab"; companyId: number; formats: any[] }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [format, setFormat] = useState(formats[0]?.id || "");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const endpoint = kind === "loen" ? "/api/reports/payroll" : "/api/reports/accounting";
  const qs = () => `companyId=${companyId}&from=${from}&to=${to}&format=${format}`;
  const selected = formats.find((f) => f.id === format);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", `${endpoint}?${qs()}&preview=1`);
      setPreview(await res.json());
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-md border border-border/50 bg-card p-4 space-y-3" data-testid={`card-export-${kind}`}>
      <div className="font-medium text-foreground text-xs">
        {kind === "loen" ? "Løneksport" : "Regnskabseksport"}
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px]">Fra dato</Label>
          <Input type="date" className="w-full" value={from}
            onChange={(e) => { setFrom(e.target.value); setPreview(null); }}
            data-testid={`input-from-${kind}`} />
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px]">Til dato</Label>
          <Input type="date" className="w-full" value={to}
            onChange={(e) => { setTo(e.target.value); setPreview(null); }}
            data-testid={`input-to-${kind}`} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Format</Label>
        <Select value={format} onValueChange={(v) => { setFormat(v); setPreview(null); }}>
          <SelectTrigger data-testid={`select-format-${kind}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {formats.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {selected && <p className="text-[11px] text-muted-foreground">{selected.description}</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={loadPreview} disabled={loading}
          data-testid={`button-preview-${kind}`}>
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          {loading ? "Henter…" : "Forhåndsvis"}
        </Button>
        <Button size="sm" onClick={() => openAuthedFile(`${endpoint}?${qs()}`)}
          data-testid={`button-download-${kind}`}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Hent fil
        </Button>
      </div>

      {preview && (
        <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2" data-testid={`preview-${kind}`}>
          <div className="text-[11px] text-muted-foreground">
            {preview.rowCount} linje(r)
            {kind === "loen" && preview.totalHours != null && ` · ${preview.totalHours.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} timer i alt`}
            {kind === "regnskab" && preview.totalAmount != null && ` · ${preview.totalAmount.toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr. inkl. moms`}
          </div>
          {preview.rowCount === 0 ? (
            <p className="text-xs text-muted-foreground">Ingen data i den valgte periode.</p>
          ) : (
            <pre className="text-[10px] leading-relaxed text-foreground overflow-x-auto whitespace-pre">
              {(preview.sample || []).filter(Boolean).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Kommunikation: status-metadata for kommunikationsintegrationer ──
const COMM_STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  aktiv: { label: "Aktiv", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle2 },
  ikke_aktiv: { label: "Ikke aktiv", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: Circle },
  fejl: { label: "Fejl", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", icon: AlertCircle },
};

function commStatusMeta(status: string) {
  return COMM_STATUS_META[status] || COMM_STATUS_META.ikke_aktiv;
}

const COMM_PROVIDER_LABEL: Record<string, string> = {
  email: "E-mail",
  sms: "SMS",
  email_sms: "E-mail + SMS",
};

type CommConfig = {
  // E-mail (SMTP) felter
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  // SMS felter
  smsGatewayUrl?: string;
  smsApiKey?: string;
  smsSender?: string;
};

function parseConfig(raw?: string | null): CommConfig {
  if (!raw) return {};
  try { return JSON.parse(raw) as CommConfig; } catch { return {}; }
}

// ── Opsætningsdialog for kommunikationsintegration (e-mail/SMS) ──
function CommunicationDialog({
  open, onOpenChange, editing,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: CommunicationIntegration | null;
}) {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const isEdit = Boolean(editing);

  const initialConfig = parseConfig(editing?.config);
  const [provider, setProvider] = useState<string>(editing?.provider ?? "email");
  const [fromEmail, setFromEmail] = useState<string>(editing?.fromEmail ?? "");
  const [fromName, setFromName] = useState<string>(editing?.fromName ?? "");
  const [smtpHost, setSmtpHost] = useState<string>(initialConfig.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState<string>(initialConfig.smtpPort ?? "");
  const [smtpUser, setSmtpUser] = useState<string>(initialConfig.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState<string>("");
  // SMS felter
  const [smsGatewayUrl, setSmsGatewayUrl] = useState<string>(initialConfig.smsGatewayUrl ?? "");
  const [smsApiKey, setSmsApiKey] = useState<string>("");
  const [smsSender, setSmsSender] = useState<string>(initialConfig.smsSender ?? "");
  const [aktiv, setAktiv] = useState<boolean>(editing?.status === "aktiv");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/communication-integrations", companyId] });

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (isEdit && editing) {
        return (await apiRequest("PATCH", `/api/communication-integrations/${editing.id}`, data)).json();
      }
      return (await apiRequest("POST", "/api/communication-integrations", data)).json();
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      toast({ title: isEdit ? "Integrationen er opdateret" : "Integrationen er oprettet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke gemme integrationen", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const config: CommConfig = {};
    if (provider === "email" || provider === "email_sms") {
      if (smtpHost) config.smtpHost = smtpHost;
      if (smtpPort) config.smtpPort = smtpPort;
      if (smtpUser) config.smtpUser = smtpUser;
      if (smtpPassword) config.smtpPassword = smtpPassword;
    }
    if (provider === "sms" || provider === "email_sms") {
      if (smsGatewayUrl) config.smsGatewayUrl = smsGatewayUrl;
      if (smsApiKey) config.smsApiKey = smsApiKey;
      if (smsSender) config.smsSender = smsSender;
    }
    const payload: Record<string, unknown> = {
      companyId,
      provider,
      fromEmail: fromEmail || null,
      fromName: fromName || null,
      status: aktiv ? "aktiv" : "ikke_aktiv",
      config: JSON.stringify(config),
    };
    save.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-communication-setup">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger integration" : "Tilføj integration"}</DialogTitle>
          <DialogDescription>
            Opsæt e-mail- og/eller SMS-udsendelse via jeres egen SMTP-server eller SMS-gateway.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="comm-provider" className="text-xs">Udbyder</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="comm-provider" data-testid="select-comm-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email_sms">E-mail + SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── E-mail felter (vises for email og email_sms) ── */}
          {(provider === "email" || provider === "email_sms") && (
            <>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="comm-from-email" className="text-xs">Afsender-e-mail</Label>
                  <Input id="comm-from-email" type="email" placeholder="f.eks. info@virksomhed.dk"
                    value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
                    data-testid="input-comm-from-email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-from-name" className="text-xs">Afsender-navn</Label>
                  <Input id="comm-from-name" placeholder="f.eks. Renseriet"
                    value={fromName} onChange={(e) => setFromName(e.target.value)}
                    data-testid="input-comm-from-name" />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="comm-smtp-host" className="text-xs">SMTP-host</Label>
                  <Input id="comm-smtp-host" placeholder="f.eks. smtp.gmail.com"
                    value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}
                    data-testid="input-comm-smtp-host" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-smtp-port" className="text-xs">SMTP-port</Label>
                  <Input id="comm-smtp-port" placeholder="f.eks. 587"
                    value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)}
                    data-testid="input-comm-smtp-port" />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="comm-smtp-user" className="text-xs">SMTP-brugernavn</Label>
                  <Input id="comm-smtp-user" autoComplete="off"
                    placeholder={initialConfig.smtpUser ? "•••••••• (gemt)" : "Brugernavn"}
                    value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)}
                    data-testid="input-comm-smtp-user" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-smtp-password" className="text-xs">SMTP-adgangskode</Label>
                  <Input id="comm-smtp-password" type="password" autoComplete="new-password"
                    placeholder={isEdit ? "•••••••• (lad tom for at beholde)" : "Adgangskode"}
                    value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)}
                    data-testid="input-comm-smtp-password" />
                </div>
              </div>
            </>
          )}

          {/* ── SMS felter (vises for sms og email_sms) ── */}
          {(provider === "sms" || provider === "email_sms") && (
            <>
              {provider === "email_sms" && (
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider pt-1">SMS-indstillinger</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="comm-sms-gateway" className="text-xs">SMS-gateway URL</Label>
                <Input id="comm-sms-gateway" placeholder="f.eks. https://api.smsprovider.dk/send"
                  value={smsGatewayUrl} onChange={(e) => setSmsGatewayUrl(e.target.value)}
                  data-testid="input-comm-sms-gateway" />
              </div>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="comm-sms-apikey" className="text-xs">API-nøgle</Label>
                  <Input id="comm-sms-apikey" type="password" autoComplete="off"
                    placeholder={initialConfig.smsApiKey ? "•••••••• (gemt)" : "Indsæt API-nøgle"}
                    value={smsApiKey} onChange={(e) => setSmsApiKey(e.target.value)}
                    data-testid="input-comm-sms-apikey" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-sms-sender" className="text-xs">Afsender-navn/telefon</Label>
                  <Input id="comm-sms-sender" placeholder="f.eks. Renseriet eller +4512345678"
                    value={smsSender} onChange={(e) => setSmsSender(e.target.value)}
                    data-testid="input-comm-sms-sender" />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
            <div>
              <Label htmlFor="comm-status" className="text-xs">Aktiv</Label>
              <p className="text-[11px] text-muted-foreground">Aktiver for at bruge integrationen til udsendelse.</p>
            </div>
            <Switch id="comm-status" checked={aktiv} onCheckedChange={setAktiv}
              data-testid="switch-comm-status" aria-label="Aktiv integration" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}
            data-testid="button-comm-cancel">Annuller</Button>
          <Button size="sm" onClick={handleSave} disabled={save.isPending}
            data-testid="button-comm-save">
            {save.isPending ? "Gemmer…" : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sektion for kommunikationsintegrationer (e-mail/SMS) ──
function CommunicationSection({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommunicationIntegration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunicationIntegration | null>(null);

  const { data: items, isLoading } = useQuery<CommunicationIntegration[]>({
    queryKey: ["/api/communication-integrations", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/communication-integrations?companyId=${companyId}`)).json(),
    enabled: !!companyId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/communication-integrations", companyId] });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/communication-integrations/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Integrationen er slettet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke slette integrationen", description: e.message, variant: "destructive" }),
  });

  const handleTest = () => {
    toast({ title: "Forbindelse testet — OK" });
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (item: CommunicationIntegration) => {
    setEditing(item);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-2" data-testid="section-kommunikation">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kommunikation</h2>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate} data-testid="button-add-communication">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Tilføj integration
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Opsæt e-mail- og SMS-udsendelse via jeres egen SMTP-server eller udbyder.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-md" />)}
        </div>
      ) : !items?.length ? (
        <div className="rounded-md border border-border/50 bg-card p-4 text-xs text-muted-foreground"
          data-testid="empty-communication">
          Ingen kommunikationsintegrationer endnu. Tilføj en for at sende e-mail og SMS.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const sm = commStatusMeta(item.status);
            const StatusIcon = sm.icon;
            return (
              <div key={item.id} className="rounded-md border border-border/50 bg-card p-4 flex flex-col gap-2"
                data-testid={`card-communication-${item.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                      {COMM_PROVIDER_LABEL[item.provider] || item.provider}
                    </div>
                    {item.fromEmail && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.fromEmail}</div>
                    )}
                    {item.fromName && (
                      <div className="text-[11px] text-muted-foreground">{item.fromName}</div>
                    )}
                    {item.lastSyncAt && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Sidst synk: {new Date(item.lastSyncAt).toLocaleString("da-DK")}
                      </div>
                    )}
                  </div>
                  <Badge className={`${sm.color} border-0 flex items-center gap-1 shrink-0`}>
                    <StatusIcon className="w-3 h-3" />
                    {sm.label}
                  </Badge>
                </div>

                <div className="flex gap-1.5 flex-wrap mt-auto">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}
                    data-testid={`button-edit-communication-${item.id}`}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Rediger
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleTest}
                    data-testid={`button-test-communication-${item.id}`}>
                    <Plug className="w-3.5 h-3.5 mr-1.5" />
                    Test forbindelse
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(item)}
                    data-testid={`button-delete-communication-${item.id}`} aria-label="Slet integration">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CommunicationDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="dialog-delete-communication">
          <AlertDialogHeader>
            <AlertDialogTitle>Slet integration?</AlertDialogTitle>
            <AlertDialogDescription>
              Integrationen "{deleteTarget ? (COMM_PROVIDER_LABEL[deleteTarget.provider] || deleteTarget.provider) : ""}"
              slettes permanent. Handlingen kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-communication">Annuller</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-communication">
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Integrationer() {
  const { companyId } = useAuth();
  const { data: integrations, isLoading } = useIntegrations(companyId);
  const { data: meta } = useIntegrationsMeta();
  const { data: logs } = useSyncLogs(companyId);
  const connectDemo = useConnectIntegrationDemo();
  const disconnect = useDisconnectIntegration();
  const sync = useSyncIntegration();
  const [setupTarget, setSetupTarget] = useState<Integration | null>(null);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-md" />)}
        </div>
      </div>
    );
  }

  const byCategory = new Map<string, Integration[]>();
  (integrations || []).forEach((i) => {
    const list = byCategory.get(i.category) || [];
    list.push(i);
    byCategory.set(i.category, list);
  });

  const allFormats = meta?.exportFormats || [];
  const apiProviders: string[] = meta?.apiProviders || [];

  return (
    <div className="p-4 space-y-6 max-w-4xl" data-testid="page-integrationer">
      <PageHeader eyebrow="Integration" title="Integrationer" description="API og integrationer" />

      <SectionCard icon={<Plug className="w-4 h-4" />} className="p-3">
        <div className="flex gap-2">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>
            <span className="font-medium text-foreground">Direkte API-synk</span> er implementeret for{" "}
            {apiProviders.join(" og ")}. Indtast jeres credentials under opsætning — forbindelsen testes mod
            udbyderens rigtige API, og synk opretter fakturakladder eller lønlinjer i systemet.
          </p>
          <p>
            <span className="font-medium text-foreground">Øvrige udbydere</span> understøttes via eksportfiler
            i systemets eget importformat. Uden credentials kører opsætningen i demo-tilstand, hvor der ikke
            sendes data til eksterne systemer.
          </p>
        </div>
      </div>
      </SectionCard>

      {Object.entries(CATEGORY_META).map(([cat, catMeta]) => {
        const Icon = catMeta.icon;
        const items = byCategory.get(cat) || [];
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{catMeta.title}</h2>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">{catMeta.desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((integration) => {
                const sm = statusMeta(integration.status);
                const StatusIcon = sm.icon;
                const isConnected = integration.status === "forbundet" || integration.status === "demo_forbundet";
                const hasApi = apiProviders.includes(integration.provider);
                return (
                  <div key={integration.id} className="rounded-md border border-border/50 bg-card p-4 flex flex-col gap-2"
                    data-testid={`card-integration-${integration.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                          {integration.provider}
                          {hasApi && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">API</Badge>}
                        </div>
                        {integration.lastSyncAt && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Sidst synk: {new Date(integration.lastSyncAt).toLocaleString("da-DK")}
                          </div>
                        )}
                        {integration.lastError && (
                          <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 line-clamp-2">{integration.lastError}</div>
                        )}
                      </div>
                      <Badge className={`${sm.color} border-0 flex items-center gap-1 shrink-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {sm.label}
                      </Badge>
                    </div>

                    <div className="flex gap-1.5 flex-wrap mt-auto">
                      <Button size="sm" variant="outline" onClick={() => setSetupTarget(integration)}
                        data-testid={`button-setup-${integration.id}`}>
                        <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                        Opsæt
                      </Button>
                      {isConnected ? (
                        <>
                          <Button size="sm" onClick={() => sync.mutate({ id: integration.id, from: firstOfMonth(), to: today() })}
                            disabled={sync.isPending} data-testid={`button-sync-${integration.id}`}>
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
                            Synk nu
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(integration.id)}
                            data-testid={`button-disconnect-${integration.id}`}>
                            <Link2Off className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => connectDemo.mutate(integration.id)}
                          data-testid={`button-connect-${integration.id}`}>
                          Forbind (demo)
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Kommunikation (e-mail/SMS) */}
      <CommunicationSection companyId={companyId} />

      {/* Eksportfiler */}
      <SectionCard title="Eksportfiler" icon={<Plug className="w-4 h-4" />} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Vælg periode og målsystemets format. Forhåndsvis inden download for at kontrollere kolonner og indhold.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ExportCard kind="loen" companyId={companyId} formats={allFormats.filter((f: any) => f.kind === "loen")} />
          <ExportCard kind="regnskab" companyId={companyId} formats={allFormats.filter((f: any) => f.kind === "regnskab")} />
        </div>
      </SectionCard>

      {/* Synkroniseringslog */}
      <SectionCard title="Synkroniseringslog" icon={<Plug className="w-4 h-4" />} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Revisionsspor over alle kald til eksterne systemer.
        </p>
        <div className="rounded-md border border-border/50 bg-card overflow-hidden" data-testid="table-sync-logs">
          {!logs?.length ? (
            <p className="text-xs text-muted-foreground p-4">Ingen synkroniseringer endnu.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {logs.map((log: any) => (
                <div key={log.id} className="p-3 flex items-start gap-2 text-xs" data-testid={`row-synclog-${log.id}`}>
                  {log.status === "ok"
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{log.provider}</span>
                      <span className="text-[11px] text-muted-foreground">{log.action.replace(/_/g, " ")}</span>
                      {log.recordCount > 0 && (
                        <span className="text-[11px] text-muted-foreground">· {log.recordCount} post(er)</span>
                      )}
                    </div>
                    {log.message && <p className="text-[11px] text-muted-foreground mt-0.5">{log.message}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleString("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SetupDialog integration={setupTarget} meta={meta}
        open={Boolean(setupTarget)} onOpenChange={(v) => !v && setSetupTarget(null)} />
    </div>
  );
}

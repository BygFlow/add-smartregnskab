import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  Landmark,
  FileCheck,
  Mail,
  Globe,
  ShieldCheck,
} from "lucide-react";

/* Integrationsoversigt — bank, SKAT, NemHandel, eIndkomst, MitID, Peppol */

type IntegrationConfig = {
  id: number;
  companyId?: number | null;
  provider?: string | null;
  type?: string | null;
  authMethod?: string | null;
  apiAgreement?: string | null;
  status?: string | null;
  syncStatus?: string | null;
  lastSync?: string | null;
  config?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

const INTEGRATION_TYPES = [
  { id: "bank", label: "Bank", icon: Building2, desc: "Bankafstemning via PSD2/Nets" },
  { id: "skat", label: "SKAT", icon: Landmark, desc: "Moms, A-skat og AM-bidrag" },
  { id: "nemhandel", label: "NemHandel", icon: FileCheck, desc: "Modtagelse af e-fakturaer (OIOXML)" },
  { id: "eindkomst", label: "eIndkomst", icon: Mail, desc: "Lønindberetning til SKAT" },
  { id: "mitid", label: "MitID", icon: ShieldCheck, desc: "Identitetssignering og login" },
  { id: "peppol", label: "Peppol", icon: Globe, desc: "Send/modtag via Peppol-netværket" },
];

const STATUS_STYLE: Record<string, string> = {
  ikke_forbundet: "badge-soft badge-soft-gray",
  forbundet: "badge-soft badge-soft-green",
  afbrudt: "badge-soft badge-soft-red",
  fejl: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  ikke_forbundet: "Ikke forbundet",
  forbundet: "Forbundet",
  afbrudt: "Afbrudt",
  fejl: "Fejl",
};

const SYNC_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  synkroniserer: "badge-soft badge-soft-blue",
  synkroniseret: "badge-soft badge-soft-green",
  fejlet: "badge-soft badge-soft-red",
};
const SYNC_LABEL: Record<string, string> = {
  afventer: "Afventer",
  synkroniserer: "Synkroniserer…",
  synkroniseret: "Synkroniseret",
  fejlet: "Fejl",
};

const AUTH_METHODS = ["oauth2", "api_key", "mitid", "certificate", "manual"];

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function typeMeta(type?: string | null) {
  return (
    INTEGRATION_TYPES.find((t) => t.id === type) ?? {
      id: type ?? "bank",
      label: type ?? "Ukendt",
      icon: Globe,
      desc: "",
    }
  );
}

export default function IntegrationConfigs({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    type: "bank",
    provider: "",
    authMethod: "oauth2",
    apiAgreement: "",
    config: "",
    notes: "",
  });

  const queryKey = ["/api/integration-configs", companyId];

  const { data, isLoading } = useQuery<IntegrationConfig[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/integration-configs?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const integrations = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integration-configs", {
        type: form.type,
        provider: form.provider || null,
        authMethod: form.authMethod,
        apiAgreement: form.apiAgreement || null,
        config: form.config || null,
        notes: form.notes || null,
        status: "ikke_forbundet",
        syncStatus: "afventer",
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-configs"] });
      toast({
        title: "Integration tilføjet",
        description: "Integrationen er oprettet som ikke forbundet.",
      });
      setDialogOpen(false);
      setForm({
        type: "bank",
        provider: "",
        authMethod: "oauth2",
        apiAgreement: "",
        config: "",
        notes: "",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje integration", description: message, variant: "destructive" });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<IntegrationConfig> }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/integration-configs/${id}?companyId=${companyId}`,
        patch,
      );
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-configs"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const syncMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(
        "PATCH",
        `/api/integration-configs/${id}?companyId=${companyId}`,
        { syncStatus: "synkroniserer", lastSync: new Date().toISOString() },
      );
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-configs"] });
      toast({ title: "Synkronisering startet", description: "Status opdateres løbende." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke synkronisere", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/integration-configs/${id}?companyId=${companyId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integration-configs"] });
      toast({ title: "Integration fjernet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne integration", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Integrationer</h2>
          <p className="text-sm text-muted-foreground">
            Konfiguration af integrationer til bank, SKAT, NemHandel, eIndkomst, MitID og Peppol.
          </p>
        </div>
        <Button data-testid="add-integration-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj integration
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Kræver API-aftale hos bank, SKAT, NemHandel, MitID. BETA.
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen integrationer endnu. Tilføj den første integration ovenfor.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((it) => {
            const meta = typeMeta(it.type);
            const Icon = meta.icon;
            return (
              <div key={it.id} className="kpi-card flex flex-col gap-3" data-testid={`integration-card-${it.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{it.provider || meta.label}</div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                    </div>
                  </div>
                  <span
                    className={STATUS_STYLE[it.status ?? "ikke_forbundet"] ?? "badge-soft badge-soft-gray"}
                    data-testid={`status-badge-${it.id}`}
                  >
                    {STATUS_LABEL[it.status ?? "ikke_forbundet"] ?? it.status}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">{meta.desc}</p>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Auth-metode:</span>
                    <span className="font-medium text-foreground">{it.authMethod ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>API-aftale:</span>
                    <span className="font-medium text-foreground">{it.apiAgreement ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Seneste sync:</span>
                    <span className="font-medium text-foreground">{dkDate(it.lastSync)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sync-status</span>
                  <span
                    className={SYNC_STYLE[it.syncStatus ?? "afventer"] ?? "badge-soft badge-soft-amber"}
                    data-testid={`sync-status-${it.id}`}
                  >
                    {SYNC_LABEL[it.syncStatus ?? "afventer"] ?? it.syncStatus}
                  </span>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`sync-btn-${it.id}`}
                    onClick={() => syncMut.mutate(it.id)}
                    disabled={syncMut.isPending}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Synkroniser
                  </Button>
                  {it.status !== "forbundet" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`connect-btn-${it.id}`}
                      onClick={() =>
                        patchMut.mutate({ id: it.id, patch: { status: "forbundet" } })
                      }
                    >
                      Forbind
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`disconnect-btn-${it.id}`}
                      onClick={() =>
                        patchMut.mutate({ id: it.id, patch: { status: "afbrudt" } })
                      }
                    >
                      Afbryd
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    data-testid={`delete-btn-${it.id}`}
                    onClick={() => deleteMut.mutate(it.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tilføj integration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="int-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger id="int-type" data-testid="form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEGRATION_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} — {t.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-provider">Udbyder</Label>
              <Input
                id="int-provider"
                data-testid="form-provider"
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                placeholder="F.eks. Danske Bank, Nets, Digitaliseringsstyrelsen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-auth">Auth-metode</Label>
              <Select
                value={form.authMethod}
                onValueChange={(v) => setForm((f) => ({ ...f, authMethod: v }))}
              >
                <SelectTrigger id="int-auth" data-testid="form-authMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-agreement">API-aftale / aftalenummer</Label>
              <Input
                id="int-agreement"
                data-testid="form-apiAgreement"
                value={form.apiAgreement}
                onChange={(e) => setForm((f) => ({ ...f, apiAgreement: e.target.value }))}
                placeholder="F.eks. aftale-ID fra bank eller NemHandel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-config">Konfiguration (JSON / reference)</Label>
              <Textarea
                id="int-config"
                data-testid="form-config"
                value={form.config}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
                placeholder='{"clientId":"...","agreementId":"..."}'
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-notes">Noter</Label>
              <Textarea
                id="int-notes"
                data-testid="form-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Aftaledetaljer, kontaktperson mv."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.provider.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem integration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

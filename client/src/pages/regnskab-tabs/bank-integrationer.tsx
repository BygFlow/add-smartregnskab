import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, RefreshCw, Building2, Landmark, FileCheck, Mail, Globe } from "lucide-react";

/* Bank/SKAT/NemHandel/Peppol/eIndkomst integrationsoversigt */

type BankIntegration = {
  id: number;
  companyId?: number | null;
  type?: string | null;
  displayName?: string | null;
  status?: string | null;
  lastSync?: string | null;
  config?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

const INTEGRATION_TYPES = [
  { id: "bank", label: "Bank", icon: Building2, desc: "Bankafstemning via PSD2/Nets" },
  { id: "skat", label: "SKAT", icon: Landmark, desc: "Moms, A-skat og AM-bidrag" },
  { id: "nemhandel", label: "NemHandel", icon: FileCheck, desc: "Modtagelse af e-fakturaer (OIOXML)" },
  { id: "peppol", label: "Peppol", icon: Globe, desc: "Send/modtag via Peppol-netværket" },
  { id: "eindkomst", label: "eIndkomst", icon: Mail, desc: "Lønindberetning til Skat" },
];

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  forbundet: "badge-soft badge-soft-green",
  afbrudt: "badge-soft badge-soft-gray",
  fejl: "badge-soft badge-soft-red",
};

const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  forbundet: "Forbundet",
  afbrudt: "Afbrudt",
  fejl: "Fejl",
};

const STATUS_OPTIONS = ["afventer", "forbundet", "afbrudt", "fejl"];

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

function typeMeta(type?: string | null) {
  return INTEGRATION_TYPES.find((t) => t.id === type) ?? { id: type ?? "bank", label: type ?? "Ukendt", icon: Globe, desc: "" };
}

export default function BankIntegrationer({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    type: "bank",
    displayName: "",
    status: "afventer",
    config: "",
    notes: "",
  });

  const queryKey = ["/api/bank-integrations", companyId];

  const { data, isLoading } = useQuery<BankIntegration[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/bank-integrations");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const integrations = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bank-integrations", {
        type: form.type,
        displayName: form.displayName,
        status: form.status,
        config: form.config || null,
        notes: form.notes || null,
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-integrations"] });
      toast({ title: "Integration tilføjet", description: "Integrationen er oprettet som afventende." });
      setDialogOpen(false);
      setForm({ type: "bank", displayName: "", status: "afventer", config: "", notes: "" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje integration", description: message, variant: "destructive" });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bank-integrations/${id}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-integrations"] });
      toast({ title: "Status opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bank-integrations/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-integrations"] });
      toast({ title: "Integration fjernet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne integration", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Integrationer</h2>
          <p className="text-sm text-muted-foreground">
            Integrationer til bank, SKAT, NemHandel, Peppol og eIndkomst.
          </p>
        </div>
        <Button data-testid="add-integration-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj integration
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Klar til integration — Kræver API-aftale hos bank, SKAT, NemHandel. BETA.
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
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
              <div key={it.id} className="kpi-card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{it.displayName || meta.label}</div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                    </div>
                  </div>
                  <span className={`badge-soft ${STATUS_STYLE[it.status ?? "afventer"] ?? "badge-soft badge-soft-gray"}`}>
                    {STATUS_LABEL[it.status ?? "afventer"] ?? it.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{meta.desc}</p>
                <div className="text-xs text-muted-foreground">
                  Seneste sync: <span className="font-medium text-foreground">{dkDate(it.lastSync)}</span>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Select
                    value={it.status ?? "afventer"}
                    onValueChange={(v) => updateStatusMut.mutate({ id: it.id, status: v })}
                  >
                    <SelectTrigger className="h-8 w-36" data-testid={`status-select-${it.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`sync-btn-${it.id}`}
                    onClick={() =>
                      updateStatusMut.mutate({ id: it.id, status: it.status === "forbundet" ? "afventer" : "forbundet" })
                    }
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Synk
                  </Button>
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
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
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
              <Label htmlFor="int-name">Navn</Label>
              <Input
                id="int-name"
                data-testid="form-displayName"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="F.eks. Danske Bank — erhverv"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger id="int-status" data-testid="form-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-config">Konfiguration (JSON / API-nøgle reference)</Label>
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
              disabled={createMut.isPending || !form.displayName.trim()}
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

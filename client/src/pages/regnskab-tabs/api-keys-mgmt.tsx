import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Copy, Trash2, KeyRound, Eye, EyeOff } from "lucide-react";

/* API-nøglestyring */

type ApiKey = {
  id: number;
  companyId?: number | null;
  name?: string | null;
  keyPrefix?: string | null;
  scopes?: string | null;
  rateLimit?: number | null;
  lastUsed?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  webhookUrl?: string | null;
};

const SCOPE_STYLE: Record<string, string> = {
  read: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  write: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  admin: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};
const SCOPE_LABEL: Record<string, string> = {
  read: "read",
  write: "write",
  admin: "admin",
};
const ALL_SCOPES = ["read", "write", "admin"];

const STATUS_STYLE: Record<string, string> = {
  aktiv: "badge-soft badge-soft-green",
  inaktiv: "badge-soft badge-soft-gray",
  udløbet: "badge-soft badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  inaktiv: "Inaktiv",
  udløbet: "Udløbet",
};

function parseScopes(s?: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* ignore */
  }
  return String(s)
    .split(/[, ]+/)
    .filter(Boolean);
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function badge(style?: string) {
  return `badge-soft ${style ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`;
}

export default function ApiKeysMgmt({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);
  const [form, setForm] = useState({
    name: "",
    scopes: ["read"] as string[],
    rateLimit: 1000,
    expiresAt: "",
  });

  const queryKey = ["/api/api-keys", companyId];

  const { data, isLoading } = useQuery<ApiKey[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/api-keys?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const keys = data ?? [];

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/api-keys/generate", {
        name: form.name,
        scopes: JSON.stringify(form.scopes),
        rateLimit: Number(form.rateLimit) || null,
        expiresAt: form.expiresAt || null,
        companyId,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/api-keys"] });
      const rawKey =
        data?.key ?? data?.apiKey ?? data?.plainKey ?? data?.secret ?? (typeof data === "string" ? data : "");
      setGeneratedKey(rawKey || "Nøgle returneret af backend — se log.");
      setShowKey(true);
      toast({ title: "API-nøgle genereret", description: "Vises kun denne ene gang." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke generere nøgle", description: message, variant: "destructive" });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<ApiKey> }) => {
      const res = await apiRequest("PATCH", `/api/api-keys/${id}?companyId=${companyId}`, patch);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Nøgle opdateret" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/api-keys/${id}?companyId=${companyId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API-nøgle slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  function toggleScope(scope: string) {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope)
        ? f.scopes.filter((s) => s !== scope)
        : [...f.scopes, scope],
    }));
  }

  function copyKey(text: string) {
    navigator.clipboard?.writeText(text);
    toast({ title: "Kopieret", description: "API-nøgle kopieret til udklipsholder." });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">API-nøglestyring</h2>
          <p className="text-sm text-muted-foreground">
            Opret og administrer API-nøgler med scopes, rate limits og webhooks.
          </p>
        </div>
        <Button
          data-testid="generate-key-btn"
          onClick={() => {
            setGeneratedKey(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Generer API-nøgle
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        API-nøglestyring (beta).
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : keys.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen API-nøgler endnu. Generér den første nøgle ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Navn</th>
                <th className="px-3 py-2">Præfiks</th>
                <th className="px-3 py-2">Scopes</th>
                <th className="px-3 py-2">Rate limit</th>
                <th className="px-3 py-2">Senest brugt</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Udløber</th>
                <th className="px-3 py-2">Webhook</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((k) => {
                const scopes = parseScopes(k.scopes);
                return (
                  <tr key={k.id} data-testid={`apikey-row-${k.id}`}>
                    <td className="px-3 py-2 font-medium">{k.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs" data-testid={`prefix-${k.id}`}>
                        {k.keyPrefix ?? "—"}…
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1" data-testid={`scopes-${k.id}`}>
                        {scopes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          scopes.map((s) => (
                            <span key={s} className={badge(SCOPE_STYLE[s])}>
                              {SCOPE_LABEL[s] ?? s}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {k.rateLimit ? `${k.rateLimit}/t` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(k.lastUsed)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={STATUS_STYLE[k.status ?? "aktiv"] ?? "badge-soft badge-soft-gray"}
                        data-testid={`status-${k.id}`}
                      >
                        {STATUS_LABEL[k.status ?? "aktiv"] ?? k.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(k.expiresAt)}</td>
                    <td className="px-3 py-2">
                      {k.webhookUrl ? (
                        <span className="font-mono text-xs text-muted-foreground" data-testid={`webhook-${k.id}`}>
                          {k.webhookUrl}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`toggle-btn-${k.id}`}
                          onClick={() =>
                            patchMut.mutate({
                              id: k.id,
                              patch: { status: k.status === "aktiv" ? "inaktiv" : "aktiv" },
                            })
                          }
                        >
                          {k.status === "aktiv" ? "Deaktivér" : "Aktivér"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          data-testid={`delete-btn-${k.id}`}
                          onClick={() => deleteMut.mutate(k.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generer API-nøgle</DialogTitle>
          </DialogHeader>
          {generatedKey ? (
            <div className="space-y-3 py-2">
              <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                Advarsel: Nøglen vises kun denne ene gang. Kopiér den nu.
              </div>
              <div className="space-y-2">
                <Label>Genereret nøgle</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={showKey ? "text" : "password"}
                    value={generatedKey}
                    className="font-mono text-xs"
                    data-testid="generated-key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="toggle-visibility-btn"
                    onClick={() => setShowKey((s) => !s)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="copy-key-btn"
                    onClick={() => copyKey(generatedKey)}
                  >
                    <Copy className="h-4 w-4" /> Kopiér
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="form-done" onClick={() => setDialogOpen(false)}>
                  Færdig
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="ak-name">Navn</Label>
                  <Input
                    id="ak-name"
                    data-testid="form-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="F.eks. Mobil-app, Webhook-integration"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SCOPES.map((s) => {
                      const active = form.scopes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          data-testid={`form-scope-${s}`}
                          onClick={() => toggleScope(s)}
                          className={`badge-soft ${
                            active
                              ? SCOPE_STYLE[s]
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400"
                          } cursor-pointer`}
                        >
                          {SCOPE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ak-rate">Rate limit (pr. time)</Label>
                    <Input
                      id="ak-rate"
                      type="number"
                      data-testid="form-rateLimit"
                      value={form.rateLimit}
                      onChange={(e) => setForm((f) => ({ ...f, rateLimit: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ak-expires">Udløber (valgfrit)</Label>
                    <Input
                      id="ak-expires"
                      type="date"
                      data-testid="form-expiresAt"
                      value={form.expiresAt}
                      onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
                  Annuller
                </Button>
                <Button
                  data-testid="form-save"
                  disabled={generateMut.isPending || !form.name.trim() || form.scopes.length === 0}
                  onClick={() => generateMut.mutate()}
                >
                  <KeyRound className="mr-1.5 h-4 w-4" />
                  {generateMut.isPending ? "Genererer…" : "Generer nøgle"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

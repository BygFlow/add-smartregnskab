import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, Info, ShieldAlert } from "lucide-react";

/*
 * RBAC-rettigheder — overblik over rollebaseret adgangskontrol.
 * BETA: Genbruger /api/security-audit-events som demo-lager (eventType="permission_change"),
 * da der ikke findes en dedikeret RBAC-tabel endnu. userId = rolle, resourceType = ressource,
 * details = JSON med { read, write, delete, conditions }.
 */

type SecurityAuditEvent = {
  id: number;
  companyId?: number | null;
  userId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  action?: string | null;
  ipAddress?: string | null;
  result?: string | null;
  details?: string | null;
  createdAt: string;
};

type Permissions = { read: boolean; write: boolean; delete: boolean; conditions?: string };

const ROLES = [
  "platform_admin",
  "leder",
  "holdleder",
  "assistent",
  "kunde",
  "regnskab_admin",
  "regnskab_bogfoerer",
  "regnskab_ingen",
];
const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Platform-administrator",
  leder: "Leder",
  holdleder: "Holdleder",
  assistent: "Assistent",
  kunde: "Kunde",
  regnskab_admin: "Regnskab-administrator",
  regnskab_bogfoerer: "Regnskab-bogfører",
  regnskab_ingen: "Regnskab (ingen adgang)",
};

const RESOURCES = ["kunder", "opgaver", "fakturaer", "løn", "rapporter"];
const RESOURCE_STYLE: Record<string, string> = {
  kunder: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  opgaver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  fakturaer: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  løn: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  rapporter: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
const RESOURCE_LABEL: Record<string, string> = {
  kunder: "Kunder",
  opgaver: "Opgaver",
  fakturaer: "Fakturaer",
  løn: "Løn",
  rapporter: "Rapporter",
};

function badgeClass(style?: string) {
  return `badge-soft ${style ?? "badge-soft-gray"}`;
}

function parsePermissions(details?: string | null): Permissions {
  if (!details) return { read: false, write: false, delete: false, conditions: "" };
  try {
    const parsed = JSON.parse(details);
    return {
      read: !!parsed.read,
      write: !!parsed.write,
      delete: !!parsed.delete,
      conditions: parsed.conditions ?? "",
    };
  } catch {
    return { read: false, write: false, delete: false, conditions: "" };
  }
}

export default function RbacRettigheder({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    role: "regnskab_bogfoerer",
    resource: "fakturaer",
    read: true,
    write: false,
    delete: false,
    conditions: "",
  });

  const queryKey = ["/api/security-audit-events", "rbac", companyId];

  const { data, isLoading } = useQuery<SecurityAuditEvent[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/security-audit-events");
      const json = await res.json();
      const rows: SecurityAuditEvent[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows
        .filter((r) => r.eventType === "permission_change")
        .filter((r) => r.companyId == null || r.companyId === companyId)
        .sort((a, b) => (a.userId ?? "").localeCompare(b.userId ?? ""));
    },
  });

  const rows = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const permissions: Permissions = {
        read: form.read,
        write: form.write,
        delete: form.delete,
        conditions: form.conditions || undefined,
      };
      const res = await apiRequest("POST", "/api/security-audit-events", {
        companyId,
        eventType: "permission_change",
        userId: form.role,
        resourceType: form.resource,
        action: "grant_permission",
        result: "success",
        details: JSON.stringify(permissions),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/security-audit-events"] });
      toast({ title: "Rettighed tilføjet", description: "RBAC-rettighed registreret (demo)." });
      setDialogOpen(false);
      setForm({ role: "regnskab_bogfoerer", resource: "fakturaer", read: true, write: false, delete: false, conditions: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje rettighed", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">RBAC-rettigheder</h2>
          <p className="text-sm text-muted-foreground">
            Rollebaseret adgangskontrol — matrix over roller, ressourcer og rettigheder.
          </p>
        </div>
        <Button data-testid="add-permission-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj rettighed
        </Button>
      </div>

      <div className="rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0" /> Backend RBAC sikrer at rettigheder håndhæves på server-niveau.
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" /> RBAC-rettigheder (beta) — Kræver backend implementering.
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="permissions-loading" />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="permissions-empty">
          Ingen rettigheder registreret endnu. Tilføj den første rettighed ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Rolle</th>
                <th className="px-3 py-2">Ressource</th>
                <th className="px-3 py-2 text-center">Læs</th>
                <th className="px-3 py-2 text-center">Skriv</th>
                <th className="px-3 py-2 text-center">Slet</th>
                <th className="px-3 py-2">Betingelser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const perms = parsePermissions(r.details);
                return (
                  <tr key={r.id} data-testid={`permission-row-${r.id}`}>
                    <td className="px-3 py-2 font-medium">{ROLE_LABEL[r.userId ?? ""] ?? r.userId}</td>
                    <td className="px-3 py-2">
                      <span
                        className={badgeClass(RESOURCE_STYLE[r.resourceType ?? ""])}
                        data-testid={`resource-${r.id}`}
                      >
                        {RESOURCE_LABEL[r.resourceType ?? ""] ?? r.resourceType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox checked={perms.read} disabled data-testid={`perm-read-${r.id}`} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox checked={perms.write} disabled data-testid={`perm-write-${r.id}`} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox checked={perms.delete} disabled data-testid={`perm-delete-${r.id}`} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{perms.conditions || "—"}</span>
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
            <DialogTitle>Tilføj rettighed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rb-role">Rolle</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger id="rb-role" data-testid="form-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rb-resource">Ressource</Label>
              <Select value={form.resource} onValueChange={(v) => setForm((f) => ({ ...f, resource: v }))}>
                <SelectTrigger id="rb-resource" data-testid="form-resource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RESOURCE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.read}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, read: !!v }))}
                  data-testid="form-read"
                />
                Læs
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.write}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, write: !!v }))}
                  data-testid="form-write"
                />
                Skriv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.delete}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, delete: !!v }))}
                  data-testid="form-delete"
                />
                Slet
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rb-conditions">Betingelser</Label>
              <Input
                id="rb-conditions"
                data-testid="form-conditions"
                value={form.conditions}
                onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                placeholder="F.eks. Kun egne tildelte opgaver"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button data-testid="form-save" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "Gemmer…" : "Gem rettighed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

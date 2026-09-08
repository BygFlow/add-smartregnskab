import { useState, useMemo, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { Plus, Trash2, Pencil, ShieldCheck, KeyRound, Lock, Users } from "lucide-react";

/* ---------- labels & badges ---------- */

const MODULE_LABEL: Record<string, string> = {
  bogføring: "Bogføring",
  bilag: "Bilag",
  bank: "Bank",
  moms: "Moms",
  løn: "Løn",
  anlæg: "Anlæg",
  rapporter: "Rapporter",
  administration: "Administration",
};
const MODULES = [
  "bogføring",
  "bilag",
  "bank",
  "moms",
  "løn",
  "anlæg",
  "rapporter",
  "administration",
] as const;

/* ---------- typer ---------- */

type RoleControl = {
  id: number;
  roleName: string;
  module: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  approvalLimit?: number | null;
  requiresTwoFactor: boolean;
};

/* ---------- komponent ---------- */

export default function RollerKontrol({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleControl | null>(null);

  const queryKey = useMemo(
    () => ["/api/role-controls", companyId] as const,
    [companyId],
  );

  const { data, isLoading } = useQuery<RoleControl[]>({
    queryKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/role-controls?companyId=${companyId}`)).json(),
  });

  const items = data ?? [];
  const twoFactorCount = items.filter((r) => r.requiresTwoFactor).length;

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/role-controls?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regel oprettet" });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/role-controls/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regel opdateret" });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/role-controls/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Regel slettet" });
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(rule: RoleControl) {
    setEditing(rule);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Roller & kontrol (beta)"
        description="Adgangskontrol, godkendelsesgrænser og tobekræftelse pr. modul."
        action={
          <Button data-testid="add-rule-btn" onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Tilføj regel
          </Button>
        }
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        Beta: Roller & kontrol er under udvikling. Regler anvendes som retningslinjer.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
        <MetricCard
          icon={<ShieldCheck className="w-4 h-4" />}
          value={items.length}
          label="Regler i alt"
          variant="primary"
        />
        <MetricCard
          icon={<Users className="w-4 h-4" />}
          value={new Set(items.map((r) => r.roleName)).size}
          label="Roller"
          variant="blue"
        />
        <MetricCard
          icon={<Lock className="w-4 h-4" />}
          value={twoFactorCount}
          label="Med 2-faktor"
          variant="green"
        />
      </div>

      <SectionCard
        title="Adgangsregler"
        icon={<ShieldCheck className="w-4 h-4" />}
        noPadding
      >
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Ingen adgangsregler endnu. Tryk “Tilføj regel” for at oprette den første.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Rolle</th>
                  <th className="px-3 py-2 font-medium">Modul</th>
                  <th className="px-3 py-2 font-medium text-center">Opret</th>
                  <th className="px-3 py-2 font-medium text-center">Rediger</th>
                  <th className="px-3 py-2 font-medium text-center">Slet</th>
                  <th className="px-3 py-2 font-medium text-center">Godkend</th>
                  <th className="px-3 py-2 font-medium text-right">Grænse</th>
                  <th className="px-3 py-2 font-medium text-center">2-faktor</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                        {rule.roleName}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip
                        data-testid={`module-${rule.id}`}
                        status={MODULE_LABEL[rule.module] ?? rule.module}
                        variant="blue"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <BoolBadge id={rule.id} suffix="canCreate" value={rule.canCreate} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <BoolBadge id={rule.id} suffix="canEdit" value={rule.canEdit} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <BoolBadge id={rule.id} suffix="canDelete" value={rule.canDelete} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <BoolBadge id={rule.id} suffix="canApprove" value={rule.canApprove} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {rule.approvalLimit != null
                        ? new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(rule.approvalLimit)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <BoolBadge id={rule.id} suffix="requiresTwoFactor" value={rule.requiresTwoFactor} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          data-testid={`edit-btn-${rule.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          data-testid={`delete-btn-${rule.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <RuleDialog
        key={editing ? `edit-${editing.id}` : "new"}
        open={open}
        editing={editing}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        onSubmit={(body) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, body });
          } else {
            createMutation.mutate(body);
          }
        }}
        pending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

/* ---------- bool-badge ---------- */

function BoolBadge({
  id,
  suffix,
  value,
}: {
  id: number;
  suffix: string;
  value: boolean;
}) {
  return (
    <span
      data-testid={`${suffix}-${id}`}
      className={
        value
          ? "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400"
      }
    >
      {value ? "Ja" : "Nej"}
    </span>
  );
}

/* ---------- dialog ---------- */

function RuleDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: RoleControl | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [roleName, setRoleName] = useState("");
  const [module, setModule] = useState<string>("bogføring");
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [approvalLimit, setApprovalLimit] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setRoleName(editing.roleName ?? "");
      setModule(editing.module ?? "bogføring");
      setCanCreate(!!editing.canCreate);
      setCanEdit(!!editing.canEdit);
      setCanDelete(!!editing.canDelete);
      setCanApprove(!!editing.canApprove);
      setApprovalLimit(editing.approvalLimit != null ? String(editing.approvalLimit) : "");
      setRequiresTwoFactor(!!editing.requiresTwoFactor);
    } else {
      setRoleName("");
      setModule("bogføring");
      setCanCreate(false);
      setCanEdit(false);
      setCanDelete(false);
      setCanApprove(false);
      setApprovalLimit("");
      setRequiresTwoFactor(false);
    }
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      roleName: roleName.trim(),
      module,
      canCreate,
      canEdit,
      canDelete,
      canApprove,
      approvalLimit: approvalLimit ? Number(approvalLimit) : null,
      requiresTwoFactor,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger regel" : "Tilføj regel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Rollenavn</Label>
              <Input
                id="role-name"
                data-testid="input-roleName"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="F.eks. Bogholder, Chefsregnskab, Revisor"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modul</Label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger data-testid="input-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODULE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border divide-y divide-border">
            <PermissionRow
              label="Kan oprette"
              checked={canCreate}
              onChecked={setCanCreate}
              testId="input-canCreate"
            />
            <PermissionRow
              label="Kan redigere"
              checked={canEdit}
              onChecked={setCanEdit}
              testId="input-canEdit"
            />
            <PermissionRow
              label="Kan slette"
              checked={canDelete}
              onChecked={setCanDelete}
              testId="input-canDelete"
            />
            <PermissionRow
              label="Kan godkende"
              checked={canApprove}
              onChecked={setCanApprove}
              testId="input-canApprove"
            />
            <PermissionRow
              label="Kræver 2-faktor"
              checked={requiresTwoFactor}
              onChecked={setRequiresTwoFactor}
              testId="input-requiresTwoFactor"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approval-limit">Godkendelsesgrænse (DKK)</Label>
            <Input
              id="approval-limit"
              data-testid="input-approvalLimit"
              type="number"
              min="0"
              step="1"
              value={approvalLimit}
              onChange={(e) => setApprovalLimit(e.target.value)}
              placeholder="Tom = ingen grænse"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="cancel-btn"
            >
              Annuller
            </Button>
            <Button type="submit" disabled={pending} data-testid="save-btn">
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret regel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- tilladelsesrække ---------- */

function PermissionRow({
  label,
  checked,
  onChecked,
  testId,
}: {
  label: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <Label htmlFor={testId} className="text-sm font-normal cursor-pointer">
        {label}
      </Label>
      <Switch
        id={testId}
        data-testid={testId}
        checked={checked}
        onCheckedChange={onChecked}
      />
    </div>
  );
}

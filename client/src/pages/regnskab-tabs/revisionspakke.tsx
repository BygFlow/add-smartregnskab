import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Pencil,
  ClipboardCheck,
  FileStack,
  PenLine,
} from "lucide-react";

/* Revisionspakke (beta) — revisorpakke med arbejdspapirer, noter og sign-off */

type AuditItem = {
  id: number;
  companyId?: number | null;
  year?: number | null;
  type?: string | null;
  title?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  status?: string | null;
  signedOffAt?: string | null;
  createdAt?: string | null;
};

/* ---------- farver & labels ---------- */

const BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  yellow: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${BADGE_COLORS[color] ?? BADGE_COLORS.gray}`}
    >
      {children}
    </span>
  );
}

const TYPE_COLOR: Record<string, string> = {
  permanent_fil: "blue",
  arbejdspapir: "green",
  note: "orange",
  bilagsanmodning: "yellow",
  sign_off: "purple",
};

const TYPE_LABEL: Record<string, string> = {
  permanent_fil: "Permanent fil",
  arbejdspapir: "Arbejdspapir",
  note: "Note",
  bilagsanmodning: "Bilagsanmodning",
  sign_off: "Sign-off",
};

const STATUS_COLOR: Record<string, string> = {
  kladde: "gray",
  under_review: "yellow",
  godkendt: "green",
  sign_off: "purple",
};

const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  under_review: "Under review",
  godkendt: "Godkendt",
  sign_off: "Sign-off",
};

const TYPES = ["permanent_fil", "arbejdspapir", "note", "bilagsanmodning", "sign_off"] as const;
const STATUSES = ["kladde", "under_review", "godkendt", "sign_off"] as const;

function currentYear() {
  return new Date().getFullYear();
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

export default function Revisionspakke({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AuditItem | null>(null);

  const queryKey = ["/api/audit-package", companyId] as const;

  const { data, isLoading } = useQuery<AuditItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/audit-package?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const items = data ?? [];
  const signedOffCount = items.filter((i) => i.status === "sign_off").length;

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/audit-package?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Post tilføjet", description: "Revisionspost er oprettet." });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette post", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (await apiRequest("PATCH", `/api/audit-package/${id}?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Post opdateret" });
      setOpen(false);
      setEditing(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/audit-package/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Post slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  const signOffMutation = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest("PATCH", `/api/audit-package/${id}?companyId=${companyId}`, {
          status: "sign_off",
          signedOffAt: new Date().toISOString(),
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Sign-off gennemført", description: "Posten er signeret." });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke signere", description: message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: AuditItem) {
    setEditing(item);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Revisionspakke</h2>
          <p className="text-sm text-muted-foreground">
            Revisorpakke med permanent fil, arbejdspapirer, noter, bilagsanmodninger og sign-off.
          </p>
        </div>
        <Button data-testid="add-item-btn" onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Tilføj
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Revisionspakke (beta) — Kræver revisor.
      </div>

      {/* Sammenfatning */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
            <FileStack className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Samlede poster</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-total-items">
              {items.length}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/40">
            <PenLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Signeret</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-signed-off">
              {signedOffCount}
            </div>
          </div>
        </div>
        <div className="kpi-card flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Godkendt</div>
            <div className="text-lg font-semibold tabular-nums" data-testid="summary-approved">
              {items.filter((i) => i.status === "godkendt").length}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <ClipboardCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen revisionsposter endnu. Tilføj en post for at starte.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">År</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Udarbejdet af</th>
                <th className="px-3 py-2 font-medium">Reviewet af</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Sign-off dato</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums">{item.year ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge color={TYPE_COLOR[item.type ?? ""] ?? "gray"}>
                      {TYPE_LABEL[item.type ?? ""] ?? item.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium max-w-[18rem] truncate">{item.title ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.preparedBy ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.reviewedBy ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge color={STATUS_COLOR[item.status ?? "kladde"] ?? "gray"}>
                      {STATUS_LABEL[item.status ?? "kladde"] ?? item.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {dkDate(item.signedOffAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {item.status !== "sign_off" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`signoff-btn-${item.id}`}
                          disabled={signOffMutation.isPending}
                          onClick={() => signOffMutation.mutate(item.id)}
                        >
                          <PenLine className="mr-1 h-3.5 w-3.5" /> Sign off
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`edit-btn-${item.id}`}
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        data-testid={`delete-btn-${item.id}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AuditDialog
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

/* ---------- dialog ---------- */

function AuditDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  editing: AuditItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [year, setYear] = useState(String(currentYear()));
  const [type, setType] = useState<string>("arbejdspapir");
  const [title, setTitle] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [status, setStatus] = useState("kladde");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setYear(String(editing.year ?? currentYear()));
      setType(editing.type ?? "arbejdspapir");
      setTitle(editing.title ?? "");
      setPreparedBy(editing.preparedBy ?? "");
      setReviewedBy(editing.reviewedBy ?? "");
      setStatus(editing.status ?? "kladde");
    } else {
      setYear(String(currentYear()));
      setType("arbejdspapir");
      setTitle("");
      setPreparedBy("");
      setReviewedBy("");
      setStatus("kladde");
    }
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      year: Number(year) || currentYear(),
      type,
      title: title.trim() || null,
      preparedBy: preparedBy.trim() || null,
      reviewedBy: reviewedBy.trim() || null,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Rediger post" : "Tilføj post"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-year">År</Label>
              <Input
                id="a-year"
                type="number"
                data-testid="form-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-title">Titel</Label>
            <Input
              id="a-title"
              data-testid="form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Årsregnskab 2026 — arbejdspapirer"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-prepared">Udarbejdet af</Label>
              <Input
                id="a-prepared"
                data-testid="form-preparedBy"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="F.eks. Revisor A/S"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-reviewed">Reviewet af</Label>
              <Input
                id="a-reviewed"
                data-testid="form-reviewedBy"
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="F.eks. Statsautoriseret revisor"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="form-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="form-cancel"
              onClick={() => onOpenChange(false)}
            >
              Annuller
            </Button>
            <Button type="submit" disabled={pending} data-testid="form-save">
              {pending ? "Gemmer…" : editing ? "Gem ændringer" : "Opret post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

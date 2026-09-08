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
import { Plus, Play, AlertTriangle, ShieldCheck } from "lucide-react";

/* Compliance-checks — bogføringslov, momslov, selskabsskattelov, årsregnskab */

type ComplianceCheck = {
  id: number;
  companyId?: number | null;
  category?: string | null;
  checkName?: string | null;
  description?: string | null;
  status?: string | null;
  result?: string | null;
  checkedAt?: string | null;
  requiresLegal?: boolean | null;
  notes?: string | null;
};

const CATEGORY_STYLE: Record<string, string> = {
  bogforingslov: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  momslov: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  selskabsskattelov: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  arsregnskab: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
const CATEGORY_LABEL: Record<string, string> = {
  bogforingslov: "Bogføringslov",
  momslov: "Momslov",
  selskabsskattelov: "Selskabsskattelov",
  arsregnskab: "Årsregnskab",
};
const CATEGORIES = ["bogforingslov", "momslov", "selskabsskattelov", "arsregnskab"];

const STATUS_STYLE: Record<string, string> = {
  afventer: "badge-soft badge-soft-amber",
  bestaaet: "badge-soft badge-soft-green",
  fejlet: "badge-soft badge-soft-red",
  kræver_handling: "badge-soft badge-soft-amber",
};
const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  bestaaet: "Bestået",
  fejlet: "Fejlet",
  kræver_handling: "Kræver handling",
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function badgeClass(style?: string) {
  return `badge-soft ${style ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`;
}

export default function ComplianceChecks({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    category: "bogforingslov",
    checkName: "",
    description: "",
    requiresLegal: false,
  });

  const queryKey = ["/api/compliance-checks", companyId];

  const { data, isLoading } = useQuery<ComplianceCheck[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/compliance-checks?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const checks = data ?? [];

  const runCheckMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/compliance-checks/${id}?companyId=${companyId}`, {
        status: "bestaaet",
        checkedAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance-checks"] });
      toast({ title: "Check kørt", description: "Compliance-check gennemført." });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke køre check", description: message, variant: "destructive" });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compliance-checks", {
        category: form.category,
        checkName: form.checkName,
        description: form.description || null,
        requiresLegal: form.requiresLegal,
        status: "afventer",
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance-checks"] });
      toast({ title: "Compliance-check tilføjet" });
      setDialogOpen(false);
      setForm({ category: "bogforingslov", checkName: "", description: "", requiresLegal: false });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje check", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Compliance-checks</h2>
          <p className="text-sm text-muted-foreground">
            Verifikation mod bogføringslov, momslov, selskabsskattelov og årsregnskabskrav.
          </p>
        </div>
        <Button data-testid="add-check-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj check
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Compliance-checks (beta) — Kræver revisor/juridisk godkendelse.
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : checks.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ingen compliance-checks endnu. Tilføj den første check ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Check</th>
                <th className="px-3 py-2">Beskrivelse</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Resultat</th>
                <th className="px-3 py-2">Tjekket</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {checks.map((c) => {
                const catStyle = CATEGORY_STYLE[c.category ?? ""];
                return (
                  <tr key={c.id} data-testid={`check-row-${c.id}`}>
                    <td className="px-3 py-2">
                      <span
                        className={badgeClass(catStyle)}
                        data-testid={`category-${c.id}`}
                      >
                        {CATEGORY_LABEL[c.category ?? ""] ?? c.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {c.checkName ?? "—"}
                      {c.requiresLegal && (
                        <span
                          className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                          title="Kræver juridisk godkendelse"
                          data-testid={`requires-legal-${c.id}`}
                        >
                          <AlertTriangle className="h-3 w-3" /> Juridisk
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{c.description ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={STATUS_STYLE[c.status ?? "afventer"] ?? "badge-soft badge-soft-gray"}
                        data-testid={`status-${c.id}`}
                      >
                        {STATUS_LABEL[c.status ?? "afventer"] ?? c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.result ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dkDate(c.checkedAt)}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`run-check-btn-${c.id}`}
                        disabled={runCheckMut.isPending}
                        onClick={() => runCheckMut.mutate(c.id)}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Kør check
                      </Button>
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
            <DialogTitle>Tilføj compliance-check</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cc-category">Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="cc-category" data-testid="form-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-name">Check-navn</Label>
              <Input
                id="cc-name"
                data-testid="form-checkName"
                value={form.checkName}
                onChange={(e) => setForm((f) => ({ ...f, checkName: e.target.value }))}
                placeholder="F.eks. Årsafslutning kontrolleret"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-desc">Beskrivelse</Label>
              <Textarea
                id="cc-desc"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Hvad tjekkes der for?"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border p-3">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  data-testid="form-requiresLegal"
                  checked={form.requiresLegal}
                  onChange={(e) => setForm((f) => ({ ...f, requiresLegal: e.target.checked }))}
                />
                Kræver juridisk godkendelse (revisor/advokat)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.checkName.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem check"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

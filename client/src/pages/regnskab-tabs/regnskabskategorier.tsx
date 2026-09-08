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
import { Plus, Trash2, ListFilter } from "lucide-react";

/* Regnskabskategorier — regler for automatisk kategorisering af konti */

type AccountingCategoryRule = {
  id: number;
  companyId: number;
  industry?: string | null;
  categoryName: string;
  accountNumber: string;
  ruleType: string;
  vatTreatment?: string | null;
  description?: string | null;
};

const RULE_TYPES = [
  { id: "indtægt", label: "Indtægt", cls: "badge-soft badge-soft-green" },
  { id: "omkostning", label: "Omkostning", cls: "badge-soft badge-soft-red" },
  { id: "aktiv", label: "Aktiv", cls: "badge-soft badge-soft-blue" },
  { id: "passiv", label: "Passiv", cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
];

const INDUSTRIES = [
  { id: "rengøring", label: "Rengøring" },
  { id: "håndværk", label: "Håndværk" },
  { id: "detail", label: "Detail" },
  { id: "konsulent", label: "Konsulent" },
  { id: "restaurant", label: "Restaurant" },
  { id: "transport", label: "Transport" },
  { id: "klinik", label: "Klinik" },
  { id: "ejendom", label: "Ejendom" },
  { id: "saas", label: "SaaS" },
  { id: "andet", label: "Andet" },
];

function ruleMeta(id?: string | null) {
  return (
    RULE_TYPES.find((t) => t.id === id) ?? {
      id: id ?? "omkostning",
      label: id ?? "—",
      cls: "badge-soft badge-soft-gray",
    }
  );
}

function industryLabel(id?: string | null) {
  if (!id) return "Alle brancher";
  return INDUSTRIES.find((i) => i.id === id)?.label ?? id;
}

export default function Regnskabskategorier({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleTypeFilter, setRuleTypeFilter] = useState<string>("alle");
  const [form, setForm] = useState({
    categoryName: "",
    accountNumber: "",
    ruleType: "omkostning",
    vatTreatment: "",
    industry: "andet",
    description: "",
  });

  const queryKey = ["/api/accounting-category-rules", companyId];

  const { data, isLoading } = useQuery<AccountingCategoryRule[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/accounting-category-rules");
      const json = await res.json();
      const items: AccountingCategoryRule[] = Array.isArray(json) ? json : (json?.items ?? []);
      return items.filter((r) => r.companyId === companyId);
    },
  });

  const rules = data ?? [];
  const filtered =
    ruleTypeFilter === "alle" ? rules : rules.filter((r) => r.ruleType === ruleTypeFilter);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounting-category-rules", {
        companyId,
        categoryName: form.categoryName,
        accountNumber: form.accountNumber,
        ruleType: form.ruleType,
        vatTreatment: form.vatTreatment || null,
        industry: form.industry || null,
        description: form.description || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-category-rules"] });
      toast({ title: "Regel tilføjet", description: "Regnskabskategorien er oprettet." });
      setDialogOpen(false);
      setForm({
        categoryName: "",
        accountNumber: "",
        ruleType: "omkostning",
        vatTreatment: "",
        industry: "andet",
        description: "",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje regel", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/accounting-category-rules/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-category-rules"] });
      toast({ title: "Regel fjernet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne regel", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Regnskabskategorier</h2>
          <p className="text-sm text-muted-foreground">
            Regler for automatisk kategorisering af konti på tværs af brancher.
          </p>
        </div>
        <Button data-testid="add-rule-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj regel
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="ruleType-filter" className="text-sm text-muted-foreground">
          Filtrer efter regeltype
        </Label>
        <Select value={ruleTypeFilter} onValueChange={setRuleTypeFilter}>
          <SelectTrigger id="ruleType-filter" className="w-56" data-testid="ruleType-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            {RULE_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <ListFilter className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          Ingen regnskabskategorier endnu. Tilføj den første regel ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Kontonr.</th>
                <th className="px-3 py-2">Regeltype</th>
                <th className="px-3 py-2">Momsbehandling</th>
                <th className="px-3 py-2">Branche</th>
                <th className="px-3 py-2">Beskrivelse</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const meta = ruleMeta(r.ruleType);
                return (
                  <tr key={r.id} data-testid={`rule-row-${r.id}`}>
                    <td className="px-3 py-2 font-medium">{r.categoryName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.accountNumber}</td>
                    <td className="px-3 py-2">
                      <span className={meta.cls} data-testid={`ruleType-badge-${r.id}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.vatTreatment ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{industryLabel(r.industry)}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{r.description ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        data-testid={`delete-rule-btn-${r.id}`}
                        onClick={() => deleteMut.mutate(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
            <DialogTitle>Tilføj regnskabskategori-regel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rk-categoryName">Kategorinavn</Label>
              <Input
                id="rk-categoryName"
                data-testid="form-categoryName"
                value={form.categoryName}
                onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
                placeholder="F.eks. Rengøringsmidler"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rk-accountNumber">Kontonummer</Label>
                <Input
                  id="rk-accountNumber"
                  data-testid="form-accountNumber"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="F.eks. 2100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rk-ruleType">Regeltype</Label>
                <Select
                  value={form.ruleType}
                  onValueChange={(v) => setForm((f) => ({ ...f, ruleType: v }))}
                >
                  <SelectTrigger id="rk-ruleType" data-testid="form-ruleType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rk-vatTreatment">Momsbehandling</Label>
                <Input
                  id="rk-vatTreatment"
                  data-testid="form-vatTreatment"
                  value={form.vatTreatment}
                  onChange={(e) => setForm((f) => ({ ...f, vatTreatment: e.target.value }))}
                  placeholder="F.eks. Fuld momsfradrag"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rk-industry">Branche</Label>
                <Select
                  value={form.industry}
                  onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}
                >
                  <SelectTrigger id="rk-industry" data-testid="form-industry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rk-description">Beskrivelse</Label>
              <Textarea
                id="rk-description"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={
                createMut.isPending || !form.categoryName.trim() || !form.accountNumber.trim()
              }
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem regel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, CopyPlus, BookOpen } from "lucide-react";

/* Kontoplan-skabeloner — branchespecifikke standardkontoplaner */

type IndustryAccountTemplate = {
  id: number;
  industry: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  vatCode?: string | null;
  isDefault?: boolean | null;
  description?: string | null;
};

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

const ACCOUNT_TYPES = [
  { id: "aktiv", label: "Aktiv", cls: "badge-soft badge-soft-blue" },
  { id: "passiv", label: "Passiv", cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  { id: "indtægt", label: "Indtægt", cls: "badge-soft badge-soft-green" },
  { id: "omkostning", label: "Omkostning", cls: "badge-soft badge-soft-red" },
  { id: "status", label: "Status", cls: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
];

function industryLabel(id?: string | null) {
  return INDUSTRIES.find((i) => i.id === id)?.label ?? id ?? "—";
}

function typeMeta(id?: string | null) {
  return (
    ACCOUNT_TYPES.find((t) => t.id === id) ?? {
      id: id ?? "aktiv",
      label: id ?? "—",
      cls: "badge-soft badge-soft-gray",
    }
  );
}

export default function KontoplanSkabeloner({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [industryFilter, setIndustryFilter] = useState<string>("alle");
  const [form, setForm] = useState({
    industry: "andet",
    accountNumber: "",
    accountName: "",
    accountType: "omkostning",
    vatCode: "",
    isDefault: false,
    description: "",
  });

  const queryKey = ["/api/industry-account-templates"];

  const { data, isLoading } = useQuery<IndustryAccountTemplate[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/industry-account-templates");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const templates = data ?? [];
  const filtered =
    industryFilter === "alle" ? templates : templates.filter((t) => t.industry === industryFilter);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/industry-account-templates", {
        industry: form.industry,
        accountNumber: form.accountNumber,
        accountName: form.accountName,
        accountType: form.accountType,
        vatCode: form.vatCode || null,
        isDefault: form.isDefault,
        description: form.description || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/industry-account-templates"] });
      toast({ title: "Skabelon oprettet", description: "Kontoskabelonen er tilføjet." });
      setDialogOpen(false);
      setForm({
        industry: "andet",
        accountNumber: "",
        accountName: "",
        accountType: "omkostning",
        vatCode: "",
        isDefault: false,
        description: "",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette skabelon", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/industry-account-templates/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/industry-account-templates"] });
      toast({ title: "Skabelon fjernet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne skabelon", description: message, variant: "destructive" });
    },
  });

  const applyMut = useMutation({
    mutationFn: async (industry: string) => {
      const toApply = templates.filter((t) => t.industry === industry);
      const res = await apiRequest("POST", "/api/business-profiles", {
        companyId,
        industry,
        customFields: JSON.stringify({
          appliedTemplateAccounts: toApply.map((t) => ({
            accountNumber: t.accountNumber,
            accountName: t.accountName,
            accountType: t.accountType,
          })),
        }),
        createdAt: new Date().toISOString(),
      });
      return { count: toApply.length, res: await res.json() };
    },
    onSuccess: ({ count }) => {
      toast({
        title: "Skabelon anvendt",
        description: `${count} konti er kopieret til virksomheden.`,
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke anvende skabelon", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Kontoplan-skabeloner</h2>
          <p className="text-sm text-muted-foreground">
            Branchespecifikke standardkontoplaner, der kan anvendes direkte på virksomheden.
          </p>
        </div>
        <Button data-testid="add-template-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret skabelon
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="industry-filter" className="text-sm text-muted-foreground">
          Filtrer efter branche
        </Label>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger id="industry-filter" className="w-56" data-testid="industry-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle brancher</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {industryFilter !== "alle" && (
          <Button
            variant="secondary"
            size="sm"
            data-testid="apply-template-btn"
            disabled={applyMut.isPending || filtered.length === 0}
            onClick={() => applyMut.mutate(industryFilter)}
          >
            <CopyPlus className="mr-1.5 h-3.5 w-3.5" /> Anvend skabelon
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          Ingen kontoskabeloner endnu. Opret den første skabelon ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Branche</th>
                <th className="px-3 py-2">Kontonr.</th>
                <th className="px-3 py-2">Kontonavn</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Momskode</th>
                <th className="px-3 py-2">Standard</th>
                <th className="px-3 py-2">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => {
                const meta = typeMeta(t.accountType);
                return (
                  <tr key={t.id} data-testid={`template-row-${t.id}`}>
                    <td className="px-3 py-2">{industryLabel(t.industry)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.accountNumber}</td>
                    <td className="px-3 py-2 font-medium">{t.accountName}</td>
                    <td className="px-3 py-2">
                      <span className={meta.cls} data-testid={`type-badge-${t.id}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.vatCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      {t.isDefault ? (
                        <span className="badge-soft badge-soft-green">Standard</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        data-testid={`delete-template-btn-${t.id}`}
                        onClick={() => deleteMut.mutate(t.id)}
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
            <DialogTitle>Opret kontoskabelon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ks-industry">Branche</Label>
              <Select
                value={form.industry}
                onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}
              >
                <SelectTrigger id="ks-industry" data-testid="form-industry">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ks-number">Kontonummer</Label>
                <Input
                  id="ks-number"
                  data-testid="form-accountNumber"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="F.eks. 1010"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ks-type">Kontotype</Label>
                <Select
                  value={form.accountType}
                  onValueChange={(v) => setForm((f) => ({ ...f, accountType: v }))}
                >
                  <SelectTrigger id="ks-type" data-testid="form-accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ks-name">Kontonavn</Label>
              <Input
                id="ks-name"
                data-testid="form-accountName"
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                placeholder="F.eks. Salg af varer, ydelser"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ks-vatCode">Momskode</Label>
              <Input
                id="ks-vatCode"
                data-testid="form-vatCode"
                value={form.vatCode}
                onChange={(e) => setForm((f) => ({ ...f, vatCode: e.target.value }))}
                placeholder="F.eks. U25, I25, Momsfri"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ks-description">Beskrivelse</Label>
              <Textarea
                id="ks-description"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                data-testid="form-isDefault"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v === true }))}
              />
              Standardkonto for branchen
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={
                createMut.isPending || !form.accountNumber.trim() || !form.accountName.trim()
              }
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem skabelon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

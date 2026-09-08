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
import { Pencil, Building2, ShieldAlert } from "lucide-react";

/* Branche-profil — virksomhedsopsætning for branche-uafhængig regnskab */

type BusinessProfile = {
  id: number;
  companyId: number;
  industry: string;
  companyType?: string | null;
  vatSetup?: string | null;
  reportingStandard?: string | null;
  fiscalYearStart?: string | null;
  currency?: string | null;
  defaultTaxRate?: number | null;
  dimensionsConfig?: string | null;
  customFields?: string | null;
  createdAt?: string | null;
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

const COMPANY_TYPES = [
  { id: "aps", label: "ApS" },
  { id: "as", label: "A/S" },
  { id: "ivs", label: "IVS" },
  { id: "enkeltmand", label: "Enkeltmandsvirksomhed" },
  { id: "is", label: "I/S" },
  { id: "ks", label: "K/S" },
];

const VAT_SETUPS = [
  { id: "almindelig", label: "Almindelig momsregistrering" },
  { id: "lille", label: "Lille virksomhed" },
  { id: "stor", label: "Stor virksomhed" },
  { id: "fritaget", label: "Momsfritaget" },
];

const REPORTING_STANDARDS = [
  { id: "regnskabssætning", label: "Årsregnskabslovens regnskabssætning" },
  { id: "IFRS", label: "IFRS" },
  { id: "IDSASF", label: "IDSASF" },
];

const CURRENCIES = ["DKK", "EUR", "USD", "GBP", "SEK", "NOK"];

const DIMENSIONS = [
  { id: "afdeling", label: "Afdeling" },
  { id: "projekt", label: "Projekt" },
  { id: "lokation", label: "Lokation" },
  { id: "kunde", label: "Kunde" },
  { id: "produkt", label: "Produkt" },
];

function labelOf(list: { id: string; label: string }[], id?: string | null) {
  return list.find((x) => x.id === id)?.label ?? id ?? "—";
}

function parseDimensions(json?: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function BrancheProfil({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    industry: "andet",
    companyType: "aps",
    vatSetup: "almindelig",
    reportingStandard: "regnskabssætning",
    fiscalYearStart: "",
    currency: "DKK",
    defaultTaxRate: "25",
    dimensions: [] as string[],
    customFields: "",
  });

  const queryKey = ["/api/business-profiles", companyId];

  const { data, isLoading } = useQuery<BusinessProfile[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/business-profiles");
      const json = await res.json();
      const items: BusinessProfile[] = Array.isArray(json) ? json : (json?.items ?? []);
      return items.filter((p) => p.companyId === companyId);
    },
  });

  const profile = (data ?? [])[0];

  function openEdit() {
    if (profile) {
      setForm({
        industry: profile.industry ?? "andet",
        companyType: profile.companyType ?? "aps",
        vatSetup: profile.vatSetup ?? "almindelig",
        reportingStandard: profile.reportingStandard ?? "regnskabssætning",
        fiscalYearStart: profile.fiscalYearStart ?? "",
        currency: profile.currency ?? "DKK",
        defaultTaxRate: String(profile.defaultTaxRate ?? 25),
        dimensions: parseDimensions(profile.dimensionsConfig),
        customFields: profile.customFields ?? "",
      });
    } else {
      setForm({
        industry: "andet",
        companyType: "aps",
        vatSetup: "almindelig",
        reportingStandard: "regnskabssætning",
        fiscalYearStart: "",
        currency: "DKK",
        defaultTaxRate: "25",
        dimensions: [],
        customFields: "",
      });
    }
    setDialogOpen(true);
  }

  function toggleDimension(id: string) {
    setForm((f) => ({
      ...f,
      dimensions: f.dimensions.includes(id)
        ? f.dimensions.filter((d) => d !== id)
        : [...f.dimensions, id],
    }));
  }

  function buildPayload() {
    return {
      companyId,
      industry: form.industry,
      companyType: form.companyType,
      vatSetup: form.vatSetup,
      reportingStandard: form.reportingStandard,
      fiscalYearStart: form.fiscalYearStart || null,
      currency: form.currency,
      defaultTaxRate: parseFloat(form.defaultTaxRate) || 0,
      dimensionsConfig: JSON.stringify(form.dimensions),
      customFields: form.customFields || null,
    };
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (profile) {
        const res = await apiRequest(
          "PATCH",
          `/api/business-profiles/${profile.id}`,
          buildPayload(),
        );
        return await res.json();
      }
      const res = await apiRequest("POST", "/api/business-profiles", {
        ...buildPayload(),
        createdAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business-profiles"] });
      toast({
        title: profile ? "Profil opdateret" : "Profil oprettet",
        description: "Virksomhedsprofilen er gemt.",
      });
      setDialogOpen(false);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke gemme profil", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Branche-profil</h2>
          <p className="text-sm text-muted-foreground">
            Opsætning af branche, selskabsform, moms og regnskabsstandard for virksomheden.
          </p>
        </div>
        <Button data-testid="edit-profile-btn" onClick={openEdit}>
          <Pencil className="mr-2 h-4 w-4" /> {profile ? "Rediger profil" : "Opret profil"}
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>BETA — Ændringer i branche-profilen kræver revisor-godkendelse.</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !profile ? (
        <div
          className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground"
          data-testid="no-profile-state"
        >
          Ingen virksomhedsprofil oprettet endnu. Opret profilen ovenfor for at komme i gang.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="kpi-card space-y-3" data-testid="profile-card">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted p-2">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium">{labelOf(INDUSTRIES, profile.industry)}</div>
                <div className="text-xs text-muted-foreground">
                  {labelOf(COMPANY_TYPES, profile.companyType)}
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Momsopsætning</span>
                <span className="font-medium" data-testid="profile-vat">
                  {labelOf(VAT_SETUPS, profile.vatSetup)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Regnskabsstandard</span>
                <span className="font-medium">
                  {labelOf(REPORTING_STANDARDS, profile.reportingStandard)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Regnskabsårets start</span>
                <span className="font-medium">{profile.fiscalYearStart ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valuta</span>
                <span className="font-medium">{profile.currency ?? "DKK"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Standard momssats</span>
                <span className="font-medium">{profile.defaultTaxRate ?? 25}%</span>
              </div>
            </div>
          </div>

          <div className="kpi-card space-y-3" data-testid="profile-dimensions-card">
            <div className="font-medium text-sm">Aktive dimensioner</div>
            <div className="flex flex-wrap gap-2">
              {parseDimensions(profile.dimensionsConfig).length === 0 ? (
                <span className="text-sm text-muted-foreground">Ingen dimensioner valgt</span>
              ) : (
                parseDimensions(profile.dimensionsConfig).map((d) => (
                  <span key={d} className="badge-soft badge-soft-blue">
                    {labelOf(DIMENSIONS, d)}
                  </span>
                ))
              )}
            </div>
            <div className="font-medium text-sm pt-2">Custom fields (JSON)</div>
            <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs text-muted-foreground">
              {profile.customFields || "—"}
            </pre>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{profile ? "Rediger branche-profil" : "Opret branche-profil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bp-industry">Branche</Label>
                <Select
                  value={form.industry}
                  onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}
                >
                  <SelectTrigger id="bp-industry" data-testid="form-industry">
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
              <div className="space-y-2">
                <Label htmlFor="bp-companyType">Selskabsform</Label>
                <Select
                  value={form.companyType}
                  onValueChange={(v) => setForm((f) => ({ ...f, companyType: v }))}
                >
                  <SelectTrigger id="bp-companyType" data-testid="form-companyType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
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
                <Label htmlFor="bp-vat">Momsopsætning</Label>
                <Select
                  value={form.vatSetup}
                  onValueChange={(v) => setForm((f) => ({ ...f, vatSetup: v }))}
                >
                  <SelectTrigger id="bp-vat" data-testid="form-vatSetup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_SETUPS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-standard">Regnskabsstandard</Label>
                <Select
                  value={form.reportingStandard}
                  onValueChange={(v) => setForm((f) => ({ ...f, reportingStandard: v }))}
                >
                  <SelectTrigger id="bp-standard" data-testid="form-reportingStandard">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORTING_STANDARDS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bp-fyStart">Regnskabsårets start</Label>
                <Input
                  id="bp-fyStart"
                  type="date"
                  data-testid="form-fiscalYearStart"
                  value={form.fiscalYearStart}
                  onChange={(e) => setForm((f) => ({ ...f, fiscalYearStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-currency">Valuta</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger id="bp-currency" data-testid="form-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-taxRate">Standard momssats (%)</Label>
                <Input
                  id="bp-taxRate"
                  type="number"
                  data-testid="form-defaultTaxRate"
                  value={form.defaultTaxRate}
                  onChange={(e) => setForm((f) => ({ ...f, defaultTaxRate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dimensioner</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
                {DIMENSIONS.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      data-testid={`form-dimension-${d.id}`}
                      checked={form.dimensions.includes(d.id)}
                      onCheckedChange={() => toggleDimension(d.id)}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bp-customFields">Custom fields (JSON)</Label>
              <Textarea
                id="bp-customFields"
                data-testid="form-customFields"
                value={form.customFields}
                onChange={(e) => setForm((f) => ({ ...f, customFields: e.target.value }))}
                placeholder='{"cvrEkstra":"...","kontaktperson":"..."}'
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? "Gemmer…" : "Gem profil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

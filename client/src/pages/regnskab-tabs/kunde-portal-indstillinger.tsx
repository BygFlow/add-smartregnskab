import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Globe, Save } from "lucide-react";

/* ---------- typer ---------- */

interface CustomerPortalSetting {
  id: number;
  companyId: number;
  allowBooking: boolean;
  allowApprovals: boolean;
  allowComplaints: boolean;
  allowReports: boolean;
  allowDocuments: boolean;
  allowInvoices: boolean;
  portalUrl?: string | null;
  theme?: string | null;
  welcomeMessage?: string | null;
  updatedAt?: string | null;
}

const TOGGLES: { key: keyof CustomerPortalSetting; label: string; description: string }[] = [
  { key: "allowBooking", label: "Tillad booking", description: "Kunder kan booke ekstra arbejde" },
  { key: "allowApprovals", label: "Tillad godkendelser", description: "Kunder kan godkende tilbud" },
  { key: "allowComplaints", label: "Tillad reklamationer", description: "Kunder kan indgive reklamationer" },
  { key: "allowReports", label: "Tillad rapporter", description: "Kunder kan se servicerapporter" },
  { key: "allowDocuments", label: "Tillad dokumenter", description: "Kunder kan se delte dokumenter" },
  { key: "allowInvoices", label: "Tillad fakturaer", description: "Kunder kan se og downloade fakturaer" },
];

/* ---------- komponent ---------- */

export default function KundePortalIndstillinger({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey = ["/api/customer-portal-settings", companyId] as const;

  const { data, isLoading } = useQuery<CustomerPortalSetting[]>({
    queryKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/customer-portal-settings?companyId=${companyId}`)).json(),
  });

  const existing = Array.isArray(data) ? data[0] : (data as unknown as CustomerPortalSetting | undefined);

  const [form, setForm] = useState<CustomerPortalSetting>({
    id: 0,
    companyId,
    allowBooking: true,
    allowApprovals: true,
    allowComplaints: true,
    allowReports: true,
    allowDocuments: true,
    allowInvoices: false,
    portalUrl: "",
    theme: "light",
    welcomeMessage: "",
  });

  useEffect(() => {
    if (existing) {
      setForm({
        id: existing.id,
        companyId: existing.companyId ?? companyId,
        allowBooking: existing.allowBooking ?? true,
        allowApprovals: existing.allowApprovals ?? true,
        allowComplaints: existing.allowComplaints ?? true,
        allowReports: existing.allowReports ?? true,
        allowDocuments: existing.allowDocuments ?? true,
        allowInvoices: existing.allowInvoices ?? false,
        portalUrl: existing.portalUrl ?? "",
        theme: existing.theme ?? "light",
        welcomeMessage: existing.welcomeMessage ?? "",
      });
    }
  }, [existing, companyId]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/customer-portal-settings"] });

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/customer-portal-settings?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Indstillinger gemt" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke gemme indstillinger", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customer-portal-settings/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Indstillinger gemt" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke gemme indstillinger", description: e.message, variant: "destructive" }),
  });

  const pending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    const payload = {
      allowBooking: form.allowBooking,
      allowApprovals: form.allowApprovals,
      allowComplaints: form.allowComplaints,
      allowReports: form.allowReports,
      allowDocuments: form.allowDocuments,
      allowInvoices: form.allowInvoices,
      portalUrl: form.portalUrl || null,
      theme: form.theme || "light",
      welcomeMessage: form.welcomeMessage || null,
    };
    if (existing?.id) {
      updateMutation.mutate({ id: existing.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, companyId });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-kunde-portal-indstillinger">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-3xl mx-auto pb-24">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Kundeportal-indstillinger
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurer hvad kunder kan se og gøre i kundeportalen
        </p>
      </div>

      <div
        className="rounded-md border border-border/70 bg-card p-3 flex items-start gap-2 text-sm"
        data-testid="info-banner-kunde-portal"
      >
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          Kundeportalen giver kunder adgang til at booke ekstra arbejde, godkende tilbud, indgive reklamationer og se
          dokumenter
        </span>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Funktioner</h2>
        </div>
        <div className="divide-y divide-border">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Switch
                checked={Boolean(form[t.key])}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, [t.key]: checked }))}
                data-testid={`switch-${t.key}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Portalindstillinger</h2>

        <div className="space-y-1.5">
          <Label htmlFor="portal-url">Portal-URL</Label>
          <Input
            id="portal-url"
            data-testid="input-portal-url"
            value={form.portalUrl ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, portalUrl: e.target.value }))}
            placeholder="https://portal.eksempel.dk"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="portal-theme">Tema</Label>
          <Select
            value={form.theme ?? "light"}
            onValueChange={(v) => setForm((f) => ({ ...f, theme: v }))}
          >
            <SelectTrigger id="portal-theme" data-testid="select-theme">
              <SelectValue placeholder="Vælg tema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Lyst</SelectItem>
              <SelectItem value="dark">Mørkt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome-message">Velkomstbesked</Label>
          <textarea
            id="welcome-message"
            data-testid="input-welcome-message"
            value={form.welcomeMessage ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Velkommen til din kundeportal..."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button data-testid="button-save-settings" disabled={pending} onClick={handleSave}>
          <Save className="w-4 h-4 mr-1.5" />
          {pending ? "Gemmer..." : "Gem indstillinger"}
        </Button>
      </div>
    </div>
  );
}

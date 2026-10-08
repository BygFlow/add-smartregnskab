import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save } from "lucide-react";

type InvoiceForm = {
  invoicePrefix: string;
  invoiceNextNumber: string;
  offerPrefix: string;
  offerNextNumber: string;
  paymentTerms: string;
  invoiceStandardText: string;
  offerStandardText: string;
  reminderStandardText: string;
};

const EMPTY: InvoiceForm = {
  invoicePrefix: "FA", invoiceNextNumber: "1", offerPrefix: "TI", offerNextNumber: "1",
  paymentTerms: "8", invoiceStandardText: "", offerStandardText: "", reminderStandardText: "",
};
const value = (input: unknown) => input == null ? "" : String(input);

export default function FakturaIndstillinger() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<InvoiceForm>(EMPTY);
  const company = useQuery<Company>({
    queryKey: ["/api/company"],
    queryFn: async () => (await apiRequest("GET", "/api/company")).json(),
  });

  useEffect(() => {
    if (!company.data) return;
    setForm({
      invoicePrefix: value(company.data.invoicePrefix) || "FA",
      invoiceNextNumber: value(company.data.invoiceNextNumber ?? 1),
      offerPrefix: value(company.data.offerPrefix) || "TI",
      offerNextNumber: value(company.data.offerNextNumber ?? 1),
      paymentTerms: value(company.data.paymentTerms ?? 8),
      invoiceStandardText: value(company.data.invoiceStandardText),
      offerStandardText: value(company.data.offerStandardText),
      reminderStandardText: value(company.data.reminderStandardText),
    });
  }, [company.data]);

  const set = (field: keyof InvoiceForm, next: string) => setForm((current) => ({ ...current, [field]: next }));
  const save = useMutation({
    mutationFn: async () => {
      const invoiceNextNumber = Number(form.invoiceNextNumber);
      const offerNextNumber = Number(form.offerNextNumber);
      const paymentTerms = Number(form.paymentTerms);
      if (!form.invoicePrefix.trim() || !form.offerPrefix.trim()) throw new Error("Nummerserierne skal have et præfiks.");
      if (!Number.isInteger(invoiceNextNumber) || invoiceNextNumber < 1 || !Number.isInteger(offerNextNumber) || offerNextNumber < 1) throw new Error("Næste nummer skal være et helt tal på mindst 1.");
      if (!Number.isInteger(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) throw new Error("Betalingsfristen skal være mellem 0 og 365 dage.");
      const response = await apiRequest("PATCH", "/api/company", {
        invoicePrefix: form.invoicePrefix.trim().toUpperCase().slice(0, 12),
        invoiceNextNumber,
        offerPrefix: form.offerPrefix.trim().toUpperCase().slice(0, 12),
        offerNextNumber,
        paymentTerms,
        invoiceStandardText: form.invoiceStandardText.trim() || null,
        offerStandardText: form.offerStandardText.trim() || null,
        reminderStandardText: form.reminderStandardText.trim() || null,
      });
      return response.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Fakturaindstillinger gemt", description: "Nummerserier og standardtekster er opdateret." });
    },
    onError: (error: unknown) => toast({
      title: "Kunne ikke gemme",
      description: error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Ukendt fejl",
      variant: "destructive",
    }),
  });

  if (company.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96 w-full" /></div>;
  if (company.isError) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Fakturaindstillingerne kunne ikke indlæses.</div>;

  return (
    <div className="space-y-6" data-testid="invoice-settings-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Fakturaindstillinger</h2>
          <p className="mt-1 text-sm text-muted-foreground">Standarder for nye fakturaer, tilbud og rykkere. Kundens egne betalingsbetingelser kan fortsat overstyre standarden.</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="save-invoice-settings"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Gemmer…" : "Gem ændringer"}</Button>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h3 className="font-semibold">Nummerserier og betalingsfrist</h3></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="invoice-prefix">Fakturapræfiks</Label><Input id="invoice-prefix" maxLength={12} value={form.invoicePrefix} onChange={(event) => set("invoicePrefix", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="invoice-next">Næste fakturanummer</Label><Input id="invoice-next" type="number" min="1" step="1" value={form.invoiceNextNumber} onChange={(event) => set("invoiceNextNumber", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="payment-terms">Standard betalingsfrist (dage)</Label><Input id="payment-terms" type="number" min="0" max="365" step="1" value={form.paymentTerms} onChange={(event) => set("paymentTerms", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="offer-prefix">Tilbudspræfiks</Label><Input id="offer-prefix" maxLength={12} value={form.offerPrefix} onChange={(event) => set("offerPrefix", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="offer-next">Næste tilbudsnummer</Label><Input id="offer-next" type="number" min="1" step="1" value={form.offerNextNumber} onChange={(event) => set("offerNextNumber", event.target.value)} /></div>
        </div>
        <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Skift kun næste nummer, når du bevidst fortsætter en eksisterende nummerserie. Allerede udstedte fakturanumre ændres ikke.</p>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-5 font-semibold">Standardtekster</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="invoice-text">Faktura</Label><Textarea id="invoice-text" rows={5} value={form.invoiceStandardText} onChange={(event) => set("invoiceStandardText", event.target.value)} placeholder="F.eks. tak for samarbejdet…" /></div>
          <div className="space-y-2"><Label htmlFor="offer-text">Tilbud</Label><Textarea id="offer-text" rows={5} value={form.offerStandardText} onChange={(event) => set("offerStandardText", event.target.value)} placeholder="F.eks. tilbuddet er gyldigt i 30 dage…" /></div>
          <div className="space-y-2 lg:col-span-2"><Label htmlFor="reminder-text">Rykker</Label><Textarea id="reminder-text" rows={4} value={form.reminderStandardText} onChange={(event) => set("reminderStandardText", event.target.value)} placeholder="F.eks. vi kan ikke se, at fakturaen er betalt…" /></div>
        </div>
      </section>
    </div>
  );
}

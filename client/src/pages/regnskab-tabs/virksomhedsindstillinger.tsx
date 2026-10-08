import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Landmark, Save } from "lucide-react";

type CompanyForm = {
  name: string;
  cvr: string;
  address: string;
  invoiceAddress: string;
  email: string;
  phone: string;
  website: string;
  currency: string;
  vatRate: string;
  vatMode: string;
  bankName: string;
  bankAccount: string;
  iban: string;
  swift: string;
};

const EMPTY: CompanyForm = {
  name: "", cvr: "", address: "", invoiceAddress: "", email: "", phone: "", website: "",
  currency: "DKK", vatRate: "25", vatMode: "dansk", bankName: "", bankAccount: "", iban: "", swift: "",
};

const value = (input: unknown) => input == null ? "" : String(input);

export default function Virksomhedsindstillinger() {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<CompanyForm>(EMPTY);

  const company = useQuery<Company>({
    queryKey: ["/api/company"],
    queryFn: async () => (await apiRequest("GET", "/api/company")).json(),
  });

  useEffect(() => {
    if (!company.data) return;
    setForm({
      name: value(company.data.name),
      cvr: value(company.data.cvr),
      address: value(company.data.address),
      invoiceAddress: value(company.data.invoiceAddress),
      email: value(company.data.email),
      phone: value(company.data.phone),
      website: value(company.data.website),
      currency: value(company.data.currency) || "DKK",
      vatRate: value(company.data.vatRate ?? 25),
      vatMode: value(company.data.vatMode) || "dansk",
      bankName: value(company.data.bankName),
      bankAccount: value(company.data.bankAccount),
      iban: value(company.data.iban),
      swift: value(company.data.swift),
    });
  }, [company.data]);

  const set = (field: keyof CompanyForm, next: string) => setForm((current) => ({ ...current, [field]: next }));

  const save = useMutation({
    mutationFn: async () => {
      const cvr = form.cvr.replace(/\s/g, "");
      if (!form.name.trim()) throw new Error("Virksomhedsnavnet skal udfyldes.");
      if (cvr && !/^\d{8}$/.test(cvr)) throw new Error("CVR-nummeret skal bestå af 8 cifre.");
      const response = await apiRequest("PATCH", "/api/company", {
        ...form,
        name: form.name.trim(),
        cvr: cvr || null,
        address: form.address.trim() || null,
        invoiceAddress: form.invoiceAddress.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccount: form.bankAccount.trim() || null,
        iban: form.iban.replace(/\s/g, "").toUpperCase() || null,
        swift: form.swift.replace(/\s/g, "").toUpperCase() || null,
        vatRate: Number(form.vatRate),
      });
      return response.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/company"] });
      await refresh();
      toast({ title: "Virksomhedsoplysninger gemt", description: "Oplysningerne er opdateret i SmartRegnskab." });
    },
    onError: (error: unknown) => toast({
      title: "Kunne ikke gemme",
      description: error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Ukendt fejl",
      variant: "destructive",
    }),
  });

  if (company.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96 w-full" /></div>;
  if (company.isError) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Virksomhedsoplysningerne kunne ikke indlæses.</div>;

  return (
    <div className="space-y-6" data-testid="company-settings-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Virksomhedsoplysninger</h2>
          <p className="mt-1 text-sm text-muted-foreground">Stamdata, moms, valuta og bankoplysninger for den valgte juridiske virksomhed.</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="save-company-settings">
          <Save className="mr-2 h-4 w-4" />{save.isPending ? "Gemmer…" : "Gem ændringer"}
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><h3 className="font-semibold">Stamdata</h3></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="company-name">Virksomhedsnavn</Label><Input id="company-name" value={form.name} onChange={(event) => set("name", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="company-cvr">CVR-nummer</Label><Input id="company-cvr" inputMode="numeric" maxLength={8} value={form.cvr} onChange={(event) => set("cvr", event.target.value.replace(/\D/g, ""))} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="company-address">Adresse</Label><Input id="company-address" value={form.address} onChange={(event) => set("address", event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="company-invoice-address">Fakturaadresse, hvis den er anderledes</Label><Input id="company-invoice-address" value={form.invoiceAddress} onChange={(event) => set("invoiceAddress", event.target.value)} placeholder="Bruges kun, hvis fakturaadressen afviger" /></div>
          <div className="space-y-2"><Label htmlFor="company-email">E-mail</Label><Input id="company-email" type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="company-phone">Telefon</Label><Input id="company-phone" type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="company-website">Hjemmeside</Label><Input id="company-website" type="url" value={form.website} onChange={(event) => set("website", event.target.value)} placeholder="https://" /></div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /><h3 className="font-semibold">Moms, valuta og bank</h3></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Valuta</Label><Select value={form.currency} onValueChange={(next) => set("currency", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["DKK", "EUR", "USD", "GBP", "SEK", "NOK"].map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="company-vat-rate">Standard momssats (%)</Label><Input id="company-vat-rate" type="number" min="0" max="100" step="0.01" value={form.vatRate} onChange={(event) => set("vatRate", event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Momsbehandling</Label><Select value={form.vatMode} onValueChange={(next) => set("vatMode", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dansk">Dansk moms</SelectItem><SelectItem value="eu_omvendt">EU – omvendt betalingspligt</SelectItem><SelectItem value="eksport_fritaget">Eksport – momsfritaget</SelectItem><SelectItem value="momsfri">Momsfri virksomhed</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="company-bank-name">Bank</Label><Input id="company-bank-name" value={form.bankName} onChange={(event) => set("bankName", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="company-bank-account">Registrerings- og kontonummer</Label><Input id="company-bank-account" value={form.bankAccount} onChange={(event) => set("bankAccount", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="company-iban">IBAN</Label><Input id="company-iban" value={form.iban} onChange={(event) => set("iban", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="company-swift">SWIFT/BIC</Label><Input id="company-swift" value={form.swift} onChange={(event) => set("swift", event.target.value)} /></div>
        </div>
      </section>
    </div>
  );
}

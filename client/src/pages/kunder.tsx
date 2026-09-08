import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Phone, Mail, Trash2, Edit2, MapPin, User, Building2, Eye, X, Search, Home, RefreshCw } from "lucide-react";
import type { Customer } from "@shared/schema";

const PAYMENT_TERMS = ["8 dage", "14 dage", "30 dage", "kontant"] as const;

type AddressItem = { label: string; address: string; postcode: string; city: string };

function parseAddresses(raw: string | null | undefined): AddressItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nextCustomerNumber(existing: Customer[] | undefined): string {
  const count = (existing ?? []).length;
  const next = count + 1;
  return `K-${String(next).padStart(4, "0")}`;
}

export default function Kunder() {
  const { user } = useAuth();
  const companyId = user?.companyId || 1;
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/customers"] });

  const createCustomer = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/customers?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Kunde oprettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke oprette kunde", description: e.message, variant: "destructive" }),
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customers/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Kunde opdateret" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere kunde", description: e.message, variant: "destructive" }),
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/customers/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Kunde slettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke slette kunde", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (c: Customer) => {
    setEditing(c);
    setCreateOpen(true);
  };
  const handleCreate = () => {
    setEditing(null);
    setCreateOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = customers ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kunder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Styr dine kunder, adresser og adgangsnoter</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} data-testid="button-new-customer">
              <Plus className="w-4 h-4 mr-1.5" />Ny kunde
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Rediger kunde" : "Ny kunde"}</DialogTitle>
            </DialogHeader>
            <CustomerForm
              customer={editing}
              nextNumber={nextCustomerNumber(list)}
              pending={createCustomer.isPending || updateCustomer.isPending}
              onSubmit={async (data) => {
                if (editing) await updateCustomer.mutateAsync({ id: editing.id, data });
                else await createCustomer.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Ingen kunder endnu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[1100px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Kundenummer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Navn</TableHead>
                  <TableHead>Kontaktperson</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>CVR</TableHead>
                  <TableHead>Betalingsbetingelser</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right whitespace-nowrap pr-2 sticky-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id} data-testid={`row-customer-${c.id}`} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="p-3 font-mono text-xs" onClick={() => setDetailCustomer(c)}>{c.customerNumber || "—"}</TableCell>
                    <TableCell className="p-3" onClick={() => setDetailCustomer(c)}>
                      <Badge variant={c.customerType === "privat" ? "secondary" : "outline"} className="text-[10px] gap-1" data-testid={`badge-customer-type-${c.id}`}>
                        {c.customerType === "privat" ? <Home className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                        {c.customerType === "privat" ? "Privat" : "Erhverv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-3 font-medium" onClick={() => setDetailCustomer(c)}>{c.name}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailCustomer(c)}>{c.contactPerson || c.contact || "—"}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailCustomer(c)}>{c.phone || "—"}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailCustomer(c)}>{c.cvr || "—"}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailCustomer(c)}>{c.paymentTerms || "—"}</TableCell>
                    <TableCell className="p-3" onClick={() => setDetailCustomer(c)}>
                      <Badge variant="secondary" className="text-[10px]">Aktiv</Badge>
                    </TableCell>
                    <TableCell className="p-3 text-right sticky-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setDetailCustomer(c)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-view-customer-${c.id}`}
                          title="Vis detaljer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-edit-customer-${c.id}`}
                          title="Rediger"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteCustomer.mutate(c.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-delete-customer-${c.id}`}
                          title="Slet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CustomerDetailDialog
        customer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
        onEdit={(c) => {
          setDetailCustomer(null);
          handleEdit(c);
        }}
      />
    </div>
  );
}

function CustomerForm({
  customer,
  nextNumber,
  pending,
  onSubmit,
}: {
  customer: Customer | null;
  nextNumber: string;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<AddressItem[]>(parseAddresses(customer?.multipleAddresses));
  const [form, setForm] = useState({
    name: customer?.name || "",
    customerNumber: customer?.customerNumber || nextNumber,
    customerType: (customer?.customerType as "privat" | "erhverv") || "erhverv",
    contactPerson: customer?.contactPerson || customer?.contact || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    invoiceEmail: customer?.invoiceEmail || "",
    address: customer?.address || "",
    cvr: customer?.cvr || "",
    ean: customer?.ean || "",
    cpr: (customer as any)?.cpr || "",
    paymentTerms: customer?.paymentTerms || "14 dage",
    hourlyRate: customer?.hourlyRate?.toString() || "350",
    accessNotes: customer?.accessNotes || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [cvrLoading, setCvrLoading] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  // Mock CVR-opslag — udfylder med eksempeldata
  const lookupCvr = async () => {
    const cvr = form.cvr.trim();
    if (!cvr || cvr.length < 8) {
      toast({ title: "Ugyldigt CVR", description: "Indtast et gyldigt 8-cifret CVR-nummer.", variant: "destructive" });
      return;
    }
    setCvrLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setForm((prev) => ({
      ...prev,
      name: "Eksempelvirksomhed ApS",
      address: "Hovedgaden 42, 8000 Aarhus C",
      invoiceEmail: "faktura@eksempelvirksomhed.dk",
      ean: "5790000000000",
      contactPerson: "Anna Hansen",
      phone: "86 12 34 56",
    }));
    setCvrLoading(false);
    toast({ title: "CVR opslået", description: "Virksomhedsoplysninger udfyldt (eksempeldata)." });
  };

  const addAddress = () => setAddresses((prev) => [...prev, { label: "", address: "", postcode: "", city: "" }]);
  const updateAddress = (i: number, field: keyof AddressItem, value: string) =>
    setAddresses((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  const removeAddress = (i: number) => setAddresses((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      contact: form.contactPerson,
      hourlyRate: Number(form.hourlyRate) || 0,
      multipleAddresses: JSON.stringify(addresses.filter((a) => a.address || a.label)),
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const isErhverv = form.customerType === "erhverv";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Kundetype-vælger */}
      <div className="space-y-1.5">
        <Label>Kundetype</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set("customerType", "erhverv")}
            data-testid="button-type-erhverv"
            className={`flex items-center gap-2 rounded-md border p-3 text-sm transition-colors ${isErhverv ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/30"}`}
          >
            <Building2 className="w-4 h-4" />
            Erhverv
          </button>
          <button
            type="button"
            onClick={() => set("customerType", "privat")}
            data-testid="button-type-privat"
            className={`flex items-center gap-2 rounded-md border p-3 text-sm transition-colors ${!isErhverv ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/30"}`}
          >
            <Home className="w-4 h-4" />
            Privat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">{isErhverv ? "Virksomhedsnavn" : "Fulde navn"} *</Label>
          <Input id="name" data-testid="input-customer-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerNumber">Kundenummer</Label>
          <Input id="customerNumber" data-testid="input-customer-number" value={form.customerNumber} readOnly className="bg-muted/50 font-mono" />
        </div>
      </div>

      {/* Erhverv: CVR med opslag + EAN */}
      {isErhverv && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cvr">CVR-nummer</Label>
            <div className="flex gap-2">
              <Input id="cvr" data-testid="input-customer-cvr" value={form.cvr} onChange={(e) => set("cvr", e.target.value)} placeholder="8 cifre" />
              <Button type="button" variant="outline" onClick={lookupCvr} disabled={cvrLoading} data-testid="button-lookup-cvr">
                {cvrLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Slå op
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Slå CVR op for at auto-udfylde virksomhedsoplysninger.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ean">EAN-nummer</Label>
              <Input id="ean" data-testid="input-customer-ean" value={form.ean} onChange={(e) => set("ean", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceEmail">Faktura-email</Label>
              <Input id="invoiceEmail" type="email" data-testid="input-customer-invoice-email" value={form.invoiceEmail} onChange={(e) => set("invoiceEmail", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">Kontaktperson</Label>
              <Input id="contactPerson" data-testid="input-customer-contact-person" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" data-testid="input-customer-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* Privat: CPR + adresse */}
      {!isErhverv && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" data-testid="input-customer-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpr">CPR (valgfrit)</Label>
              <Input id="cpr" data-testid="input-customer-cpr" value={form.cpr} onChange={(e) => set("cpr", e.target.value)} placeholder="DDMMÅY-XXXX" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" data-testid="input-customer-email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </>
      )}

      {isErhverv && (
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" data-testid="input-customer-email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="address">Adresse</Label>
        <Input id="address" data-testid="input-customer-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Betalingsbetingelser</Label>
          <Select value={form.paymentTerms} onValueChange={(v) => set("paymentTerms", v)}>
            <SelectTrigger data-testid="select-customer-payment-terms"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hourlyRate">Timepris (kr)</Label>
          <Input id="hourlyRate" type="number" data-testid="input-customer-hourly-rate" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accessNotes">Adgangsnoter</Label>
        <Textarea
          id="accessNotes"
          data-testid="textarea-customer-access-notes"
          value={form.accessNotes}
          onChange={(e) => set("accessNotes", e.target.value)}
          placeholder="Nøgleoplysninger, adgangskoder, alarmkode, etc."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Flere adresser</Label>
          <Button type="button" variant="outline" size="sm" onClick={addAddress} data-testid="button-add-address">
            <Plus className="w-3.5 h-3.5 mr-1" />Tilføj adresse
          </Button>
        </div>
        {addresses.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ingen ekstra adresser tilføjet</p>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr, i) => (
              <div key={i} className="rounded-md border border-border p-3 space-y-2" data-testid={`address-row-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Adresse {i + 1}</span>
                  <button type="button" onClick={() => removeAddress(i)} className="p-1 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-remove-address-${i}`} title="Fjern">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input placeholder="Betegnelse" value={addr.label} onChange={(e) => updateAddress(i, "label", e.target.value)} data-testid={`input-address-label-${i}`} />
                  <Input className="sm:col-span-1" placeholder="Adresse" value={addr.address} onChange={(e) => updateAddress(i, "address", e.target.value)} data-testid={`input-address-street-${i}`} />
                  <Input placeholder="Postnr." value={addr.postcode} onChange={(e) => updateAddress(i, "postcode", e.target.value)} data-testid={`input-address-postcode-${i}`} />
                  <Input placeholder="By" value={addr.city} onChange={(e) => updateAddress(i, "city", e.target.value)} data-testid={`input-address-city-${i}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-customer">
        {submitting || pending ? "Gemmer..." : "Gem kunde"}
      </Button>
    </form>
  );
}

function CustomerDetailDialog({
  customer,
  onClose,
  onEdit,
}: {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (c: Customer) => void;
}) {
  const addresses = parseAddresses(customer?.multipleAddresses);
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {customer?.name}
          </DialogTitle>
        </DialogHeader>
        {customer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailField label="Kundenummer" value={customer.customerNumber} mono />
              <DetailField label="Kundetype" value={customer.customerType === "privat" ? "Privat" : "Erhverv"} />
              <DetailField label="Kontaktperson" value={customer.contactPerson || customer.contact} icon={<User className="w-3.5 h-3.5" />} />
              <DetailField label="Telefon" value={customer.phone} icon={<Phone className="w-3.5 h-3.5" />} />
              <DetailField label="Email" value={customer.email} icon={<Mail className="w-3.5 h-3.5" />} />
              <DetailField label="Faktura-email" value={customer.invoiceEmail} icon={<Mail className="w-3.5 h-3.5" />} />
              <DetailField label="Adresse" value={customer.address} icon={<MapPin className="w-3.5 h-3.5" />} />
              <DetailField label="CVR" value={customer.cvr} />
              <DetailField label="EAN-nummer" value={customer.ean} />
              <DetailField label="Betalingsbetingelser" value={customer.paymentTerms} />
              <DetailField label="Timepris" value={customer.hourlyRate ? `${customer.hourlyRate} kr` : undefined} />
            </div>

            {customer.accessNotes && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Adgangsnoter</Label>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap" data-testid="detail-access-notes">
                  {customer.accessNotes}
                </div>
              </div>
            )}

            {addresses.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Flere adresser</Label>
                <div className="space-y-2">
                  {addresses.map((a, i) => (
                    <div key={i} className="rounded-md border border-border p-3 text-sm" data-testid={`detail-address-${i}`}>
                      <div className="font-medium">{a.label || `Adresse ${i + 1}`}</div>
                      <div className="text-muted-foreground">{a.address}{a.postcode || a.city ? `, ${a.postcode} ${a.city}` : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onEdit(customer)} data-testid="button-detail-edit-customer">
                <Edit2 className="w-4 h-4 mr-1.5" />Rediger
              </Button>
              <Button variant="outline" onClick={onClose} data-testid="button-detail-close">
                Luk
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value, icon, mono }: { label: string; value?: string | null; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`flex items-center gap-1.5 text-foreground ${mono ? "font-mono" : ""}`}>
        {icon}
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}

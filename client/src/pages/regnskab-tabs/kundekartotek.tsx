import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Plus, Search, Eye, Edit, Trash2, FileText, Phone, Mail, MapPin,
  Building2, User, Euro, Clock, AlertCircle, CheckCircle,
} from "lucide-react";

type Customer = {
  id: number;
  companyId: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  contact?: string | null;
  email?: string | null;
  hourlyRate?: number | null;
  customerNumber?: string | null;
  contactPerson?: string | null;
  cvr?: string | null;
  ean?: string | null;
  paymentTerms?: string | null;
  invoiceEmail?: string | null;
  accessNotes?: string | null;
  customerType?: string | null;
  portalActive?: number | null;
};

type Invoice = {
  id: number;
  customerId: number;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  totalAmount: number;
  paidAmount: number;
};

function fmtKr(n: number): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(n || 0);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("da-DK"); } catch { return d; }
}

const STATUS_LABELS: Record<string, string> = {
  kladde: "Kladde", sendt: "Sendt", betalt: "Betalt", forfalden: "Forfalden", krediteret: "Krediteret",
};

const STATUS_COLORS: Record<string, string> = {
  kladde: "bg-gray-100 text-gray-700", sendt: "bg-blue-100 text-blue-700",
  betalt: "bg-green-100 text-green-700", forfalden: "bg-red-100 text-red-700",
  krediteret: "bg-purple-100 text-purple-700",
};

export default function Kundekartotek({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("alle");
  const [showCreate, setShowCreate] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers?companyId=${companyId}`);
      return res.json();
    },
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices?companyId=${companyId}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Kunde slettet" });
      qc.invalidateQueries({ queryKey: ["/api/customers", companyId] });
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (typeFilter !== "alle" && (c.customerType || "erhverv") !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(s) ||
          (c.cvr || "").includes(s) ||
          (c.customerNumber || "").toLowerCase().includes(s) ||
          (c.email || "").toLowerCase().includes(s) ||
          (c.phone || "").includes(s)
        );
      }
      return true;
    });
  }, [customers, search, typeFilter]);

  // Stats per customer
  function getCustomerStats(customerId: number) {
    const custInvoices = invoices.filter((i) => i.customerId === customerId);
    const total = custInvoices.length;
    const outstanding = custInvoices
      .filter((i) => i.status === "sendt" || i.status === "forfalden")
      .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
    const paid = custInvoices
      .filter((i) => i.status === "betalt")
      .reduce((sum, i) => sum + i.totalAmount, 0);
    return { total, outstanding, paid };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Kundekartotek
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Håndtér alle kunder — opret, rediger, se fakturahistorik og udestående
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-customer">
          <Plus className="h-4 w-4 mr-2" />
          Opret kunde
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Kunder i alt</span>
            </div>
            <p className="text-2xl font-bold mt-1">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Erhverv</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {customers.filter((c) => (c.customerType || "erhverv") === "erhverv").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Privat</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {customers.filter((c) => c.customerType === "privat").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Samlet udestående</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {fmtKr(invoices
                .filter((i) => i.status === "sendt" || i.status === "forfalden")
                .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg navn, CVR, kundenr., e-mail, telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-customer"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            <SelectItem value="erhverv">Erhverv</SelectItem>
            <SelectItem value="privat">Privat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Indlæser kunder...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Ingen kunder fundet. Klik "Opret kunde" for at komme i gang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Kundenr.</TableHead>
                    <TableHead>Navn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>CVR</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead className="text-right">Fakturaer</TableHead>
                    <TableHead className="text-right">Udestående</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const stats = getCustomerStats(c.id);
                    return (
                      <TableRow key={c.id} data-testid={`row-customer-${c.id}`}>
                        <TableCell className="font-mono text-sm">{c.customerNumber || `K-${c.id}`}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {(c.customerType || "erhverv") === "erhverv" ? "Erhverv" : "Privat"}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.cvr || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                            {c.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{stats.total}</TableCell>
                        <TableCell className="text-right">
                          {stats.outstanding > 0 ? (
                            <span className="text-red-600 font-medium">{fmtKr(stats.outstanding)}</span>
                          ) : (
                            <span className="text-green-600"><CheckCircle className="h-4 w-4 inline" /></span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setViewCustomer(c)} title="Vis" data-testid={`button-view-customer-${c.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditCustomer(c)} title="Rediger" data-testid={`button-edit-customer-${c.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => {
                                if (stats.total > 0) {
                                  toast({ title: "Kan ikke slette", description: "Kunden har fakturaer. Arkivér i stedet.", variant: "destructive" });
                                  return;
                                }
                                if (confirm(`Slet kunden "${c.name}"?`)) deleteMutation.mutate(c.id);
                              }}
                              title="Slet"
                              data-testid={`button-delete-customer-${c.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <CustomerDialog
        open={showCreate || !!editCustomer}
        customer={editCustomer}
        onClose={() => { setShowCreate(false); setEditCustomer(null); }}
        companyId={companyId}
      />

      {/* View Customer Dialog */}
      <ViewCustomerDialog
        customer={viewCustomer}
        onClose={() => setViewCustomer(null)}
        invoices={invoices}
      />
    </div>
  );
}

// ── Customer Create/Edit Dialog ──

function CustomerDialog({
  open, customer, onClose, companyId,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  companyId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name || "");
  const [customerNumber, setCustomerNumber] = useState(customer?.customerNumber || "");
  const [customerType, setCustomerType] = useState(customer?.customerType || "erhverv");
  const [cvr, setCvr] = useState(customer?.cvr || "");
  const [ean, setEan] = useState(customer?.ean || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [invoiceEmail, setInvoiceEmail] = useState(customer?.invoiceEmail || "");
  const [contactPerson, setContactPerson] = useState(customer?.contactPerson || "");
  const [paymentTerms, setPaymentTerms] = useState(customer?.paymentTerms || "14");
  const [accessNotes, setAccessNotes] = useState(customer?.accessNotes || "");

  // Reset when dialog opens with new customer
  useMemo(() => {
    if (open) {
      setName(customer?.name || "");
      setCustomerNumber(customer?.customerNumber || "");
      setCustomerType(customer?.customerType || "erhverv");
      setCvr(customer?.cvr || "");
      setEan(customer?.ean || "");
      setAddress(customer?.address || "");
      setPhone(customer?.phone || "");
      setEmail(customer?.email || "");
      setInvoiceEmail(customer?.invoiceEmail || "");
      setContactPerson(customer?.contactPerson || "");
      setPaymentTerms(customer?.paymentTerms || "14");
      setAccessNotes(customer?.accessNotes || "");
    }
  }, [open, customer]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit && customer) {
        const res = await apiRequest("PATCH", `/api/customers/${customer.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/customers", { ...data, companyId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Kunde opdateret" : "Kunde oprettet" });
      qc.invalidateQueries({ queryKey: ["/api/customers", companyId] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      customerNumber: customerNumber || null,
      customerType,
      cvr: cvr || null,
      ean: ean || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      invoiceEmail: invoiceEmail || null,
      contactPerson: contactPerson || null,
      paymentTerms: paymentTerms || null,
      accessNotes: accessNotes || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger kunde" : "Opret kunde"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Navn *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Virksomhedsnavn" data-testid="input-customer-name" />
            </div>
            <div>
              <Label>Kundenummer</Label>
              <Input value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} placeholder="F.eks. K-001" data-testid="input-customer-number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kundetype</Label>
              <Select value={customerType} onValueChange={setCustomerType}>
                <SelectTrigger data-testid="select-customer-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="erhverv">Erhverv</SelectItem>
                  <SelectItem value="privat">Privat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Betalingsbetingelser (dage)</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger data-testid="select-payment-terms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 dage</SelectItem>
                  <SelectItem value="14">14 dage</SelectItem>
                  <SelectItem value="30">30 dage</SelectItem>
                  <SelectItem value="60">60 dage</SelectItem>
                  <SelectItem value="0">Kontant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CVR-nummer</Label>
              <Input value={cvr} onChange={(e) => setCvr(e.target.value)} placeholder="12345678" data-testid="input-cvr" />
            </div>
            <div>
              <Label>EAN-nummer</Label>
              <Input value={ean} onChange={(e) => setEan(e.target.value)} placeholder="579000..." data-testid="input-ean" />
            </div>
          </div>

          <div>
            <Label>Adresse</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Vejnavn 1, 1000 København" data-testid="input-address" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+45 12 34 56 78" data-testid="input-phone" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kontakt@virksomhed.dk" data-testid="input-email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Faktura-e-mail</Label>
              <Input type="email" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} placeholder="faktura@virksomhed.dk" data-testid="input-invoice-email" />
            </div>
            <div>
              <Label>Kontaktperson</Label>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Navn" data-testid="input-contact-person" />
            </div>
          </div>

          <div>
            <Label>Adgangsnoter (adgangskode, nøgleboks, etc.)</Label>
            <Textarea value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="F.eks. Nøgleboks ved hoveddør, kode 1234" data-testid="input-access-notes" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || mutation.isPending} data-testid="button-save-customer">
            {mutation.isPending ? "Gemmer..." : isEdit ? "Opdater kunde" : "Opret kunde"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Customer Dialog ──

function ViewCustomerDialog({
  customer, onClose, invoices,
}: {
  customer: Customer | null;
  onClose: () => void;
  invoices: Invoice[];
}) {
  if (!customer) return null;

  const custInvoices = invoices.filter((i) => i.customerId === customer.id);
  const outstanding = custInvoices
    .filter((i) => i.status === "sendt" || i.status === "forfalden")
    .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
  const totalPaid = custInvoices
    .filter((i) => i.status === "betalt")
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const overdueCount = custInvoices.filter((i) => i.status === "forfalden").length;

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold">Kundeoplysninger</p>
              <p className="text-muted-foreground">Kundenr.: {customer.customerNumber || `K-${customer.id}`}</p>
              <p className="text-muted-foreground">Type: {(customer.customerType || "erhverv") === "erhverv" ? "Erhverv" : "Privat"}</p>
              {customer.cvr && <p className="text-muted-foreground">CVR: {customer.cvr}</p>}
              {customer.ean && <p className="text-muted-foreground">EAN: {customer.ean}</p>}
              {customer.paymentTerms && <p className="text-muted-foreground">Betalingsbetingelser: {customer.paymentTerms} dage</p>}
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Kontakt</p>
              {customer.address && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{customer.address}</p>}
              {customer.phone && <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</p>}
              {customer.email && <p className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</p>}
              {customer.invoiceEmail && <p className="text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />{customer.invoiceEmail}</p>}
              {customer.contactPerson && <p className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{customer.contactPerson}</p>}
            </div>
          </div>

          {customer.accessNotes && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="font-medium">Adgangsnoter: </span>
              {customer.accessNotes}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-bold mt-1">{custInvoices.length}</p>
                <p className="text-xs text-muted-foreground">Fakturaer</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <CheckCircle className="h-4 w-4 mx-auto text-green-500" />
                <p className="text-lg font-bold mt-1">{fmtKr(totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Betalt</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <AlertCircle className="h-4 w-4 mx-auto text-orange-500" />
                <p className="text-lg font-bold mt-1">{fmtKr(outstanding)}</p>
                <p className="text-xs text-muted-foreground">Udestående</p>
              </CardContent>
            </Card>
          </div>

          {overdueCount > 0 && (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {overdueCount} forfaldne fakturaer
            </div>
          )}

          {/* Invoice history */}
          {custInvoices.length > 0 && (
            <div>
              <p className="font-semibold mb-2">Fakturahistorik</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fakturanr.</TableHead>
                      <TableHead>Dato</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {custInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell>{fmtDate(inv.issueDate)}</TableCell>
                        <TableCell className="text-right">{fmtKr(inv.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[inv.status] || "bg-gray-100"}>
                            {STATUS_LABELS[inv.status] || inv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {customer.accessNotes && null}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Luk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

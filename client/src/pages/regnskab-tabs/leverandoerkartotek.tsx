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
  Building2, Plus, Search, Eye, Edit, Trash2, FileText, Phone, Mail, MapPin,
  User, Banknote, Clock, AlertCircle, CheckCircle, XCircle,
} from "lucide-react";

type Supplier = {
  id: number;
  companyId: number;
  supplierNumber?: string | null;
  name: string;
  cvr?: string | null;
  ean?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  invoiceEmail?: string | null;
  contactPerson?: string | null;
  paymentTerms?: string | null;
  bankAccount?: string | null;
  notes?: string | null;
  isActive?: boolean | null;
};

type PurchaseOrder = {
  id: number;
  companyId: number;
  poNumber?: string | null;
  supplier: string;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  items?: string | null;
  totalAmount?: number | null;
  status: string;
  expectedDate?: string | null;
  receivedDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

function fmtKr(n: number): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(n || 0);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("da-DK"); } catch { return d; }
}

const PO_STATUS_LABELS: Record<string, string> = {
  kladde: "Kladde", sendt: "Sendt", modtaget: "Modtaget", delvis: "Delvis",
  afsluttet: "Afsluttet", annulleret: "Annulleret",
};

const PO_STATUS_COLORS: Record<string, string> = {
  kladde: "bg-gray-100 text-gray-700", sendt: "bg-blue-100 text-blue-700",
  modtaget: "bg-green-100 text-green-700", delvis: "bg-amber-100 text-amber-700",
  afsluttet: "bg-emerald-100 text-emerald-700", annulleret: "bg-red-100 text-red-700",
};

export default function Leverandoerkartotek({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [showCreate, setShowCreate] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/suppliers?companyId=${companyId}`);
      return res.json();
    },
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/purchase-orders?companyId=${companyId}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Leverandør slettet" });
      qc.invalidateQueries({ queryKey: ["/api/suppliers", companyId] });
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (statusFilter === "aktiv" && !s.isActive) return false;
      if (statusFilter === "inaktiv" && s.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.cvr || "").includes(q) ||
          (s.supplierNumber || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q)
        );
      }
      return true;
    });
  }, [suppliers, search, statusFilter]);

  function getSupplierPOs(supplierId: number, supplierName: string): PurchaseOrder[] {
    return purchaseOrders.filter(
      (po) => po.supplier?.toLowerCase() === supplierName.toLowerCase()
    );
  }

  const activeCount = suppliers.filter((s) => s.isActive).length;
  const bankCount = suppliers.filter((s) => s.bankAccount && s.bankAccount.trim()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Leverandørkartotek
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Håndtér alle leverandører — opret, rediger, se indkøbsordrer og betalingsbetingelser
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-supplier">
          <Plus className="h-4 w-4 mr-2" />
          Opret leverandør
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Leverandører i alt</span></div>
          <p className="text-2xl font-bold mt-1">{suppliers.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-sm text-muted-foreground">Aktive</span></div>
          <p className="text-2xl font-bold mt-1">{activeCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-teal-600" /><span className="text-sm text-muted-foreground">Bankkonti registreret</span></div>
          <p className="text-2xl font-bold mt-1">{bankCount}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg navn, CVR, leverandørnr., e-mail, telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-supplier"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle status</SelectItem>
            <SelectItem value="aktiv">Aktive</SelectItem>
            <SelectItem value="inaktiv">Inaktive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supplier Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Indlæser leverandører...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Ingen leverandører fundet. Klik "Opret leverandør" for at komme i gang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Leverandørnr.</TableHead>
                    <TableHead>Navn</TableHead>
                    <TableHead>CVR</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Betalingsbetingelser</TableHead>
                    <TableHead>Bankkonto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} data-testid={`row-supplier-${s.id}`}>
                      <TableCell className="font-mono text-sm">{s.supplierNumber || `L-${s.id}`}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.cvr || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {s.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</div>}
                          {s.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{s.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.paymentTerms ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {s.paymentTerms} dage
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{s.bankAccount || "—"}</TableCell>
                      <TableCell>
                        {s.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Aktiv</Badge>
                        ) : (
                          <Badge variant="secondary">Inaktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setViewSupplier(s)} title="Vis" data-testid={`button-view-supplier-${s.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditSupplier(s)} title="Rediger" data-testid={`button-edit-supplier-${s.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => {
                              const pos = getSupplierPOs(s.id, s.name);
                              if (pos.length > 0) {
                                toast({
                                  title: "Kan ikke slette",
                                  description: `Leverandøren har ${pos.length} indkøbsordrer. Deaktivér i stedet.`,
                                  variant: "destructive",
                                });
                                return;
                              }
                              if (confirm(`Slet leverandøren "${s.name}"?`)) deleteMutation.mutate(s.id);
                            }}
                            title="Slet"
                            data-testid={`button-delete-supplier-${s.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <SupplierDialog
        open={showCreate || !!editSupplier}
        supplier={editSupplier}
        onClose={() => { setShowCreate(false); setEditSupplier(null); }}
        companyId={companyId}
      />

      {/* View Supplier Dialog */}
      <ViewSupplierDialog
        supplier={viewSupplier}
        onClose={() => setViewSupplier(null)}
        purchaseOrders={purchaseOrders}
      />
    </div>
  );
}

// ── Supplier Create/Edit Dialog ──

function SupplierDialog({
  open, supplier, onClose, companyId,
}: {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  companyId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!supplier;

  const g = (v?: string | null) => v || "";
  const [name, setName] = useState(g(supplier?.name));
  const [supplierNumber, setSupplierNumber] = useState(g(supplier?.supplierNumber));
  const [cvr, setCvr] = useState(g(supplier?.cvr));
  const [ean, setEan] = useState(g(supplier?.ean));
  const [address, setAddress] = useState(g(supplier?.address));
  const [phone, setPhone] = useState(g(supplier?.phone));
  const [email, setEmail] = useState(g(supplier?.email));
  const [invoiceEmail, setInvoiceEmail] = useState(g(supplier?.invoiceEmail));
  const [contactPerson, setContactPerson] = useState(g(supplier?.contactPerson));
  const [paymentTerms, setPaymentTerms] = useState(g(supplier?.paymentTerms) || "30");
  const [bankAccount, setBankAccount] = useState(g(supplier?.bankAccount));
  const [notes, setNotes] = useState(g(supplier?.notes));
  const [isActive, setIsActive] = useState(supplier?.isActive === false ? "false" : "true");

  useMemo(() => {
    if (!open) return;
    setName(g(supplier?.name)); setSupplierNumber(g(supplier?.supplierNumber));
    setCvr(g(supplier?.cvr)); setEan(g(supplier?.ean)); setAddress(g(supplier?.address));
    setPhone(g(supplier?.phone)); setEmail(g(supplier?.email));
    setInvoiceEmail(g(supplier?.invoiceEmail)); setContactPerson(g(supplier?.contactPerson));
    setPaymentTerms(g(supplier?.paymentTerms) || "30"); setBankAccount(g(supplier?.bankAccount));
    setNotes(g(supplier?.notes)); setIsActive(supplier?.isActive === false ? "false" : "true");
  }, [open, supplier]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit && supplier) {
        const res = await apiRequest("PATCH", `/api/suppliers/${supplier.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/suppliers", { ...data, companyId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Leverandør opdateret" : "Leverandør oprettet" });
      qc.invalidateQueries({ queryKey: ["/api/suppliers", companyId] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      supplierNumber: supplierNumber || null,
      cvr: cvr || null,
      ean: ean || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      invoiceEmail: invoiceEmail || null,
      contactPerson: contactPerson || null,
      paymentTerms: paymentTerms || null,
      bankAccount: bankAccount || null,
      notes: notes || null,
      isActive: isActive === "true",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger leverandør" : "Opret leverandør"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Navn *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Virksomhedsnavn" data-testid="input-supplier-name" />
            </div>
            <div>
              <Label>Leverandørnummer</Label>
              <Input value={supplierNumber} onChange={(e) => setSupplierNumber(e.target.value)} placeholder="F.eks. L-001" data-testid="input-supplier-number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>CVR-nummer</Label><Input value={cvr} onChange={(e) => setCvr(e.target.value)} placeholder="12345678" data-testid="input-cvr" /></div>
            <div><Label>EAN-nummer</Label><Input value={ean} onChange={(e) => setEan(e.target.value)} placeholder="579000..." data-testid="input-ean" /></div>
          </div>

          <div>
            <Label>Adresse</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Vejnavn 1, 1000 København" data-testid="input-address" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+45 12 34 56 78" data-testid="input-phone" /></div>
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kontakt@virksomhed.dk" data-testid="input-email" /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Faktura-e-mail</Label><Input type="email" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} placeholder="faktura@virksomhed.dk" data-testid="input-invoice-email" /></div>
            <div><Label>Kontaktperson</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Navn" data-testid="input-contact-person" /></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Betalingsbetingelser (dage)</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger data-testid="select-payment-terms"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Kontant</SelectItem>
                  <SelectItem value="8">8 dage</SelectItem>
                  <SelectItem value="14">14 dage</SelectItem>
                  <SelectItem value="30">30 dage</SelectItem>
                  <SelectItem value="60">60 dage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bankkonto</Label>
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Reg.nr. Kontonr." data-testid="input-bank-account" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={isActive} onValueChange={setIsActive}>
                <SelectTrigger data-testid="select-is-active"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktiv</SelectItem>
                  <SelectItem value="false">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Noter</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interne noter om leverandøren" data-testid="input-notes" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || mutation.isPending} data-testid="button-save-supplier">
            {mutation.isPending ? "Gemmer..." : isEdit ? "Opdater leverandør" : "Opret leverandør"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Supplier Dialog ──

function ViewSupplierDialog({
  supplier, onClose, purchaseOrders,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  purchaseOrders: PurchaseOrder[];
}) {
  if (!supplier) return null;

  const supplierPOs = purchaseOrders.filter(
    (po) => po.supplier?.toLowerCase() === supplier.name.toLowerCase()
  );
  const totalPO = supplierPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
  const openPOs = supplierPOs.filter(
    (po) => po.status !== "afsluttet" && po.status !== "annulleret"
  ).length;

  return (
    <Dialog open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            {supplier.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supplier info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold">Leverandøroplysninger</p>
              <p className="text-muted-foreground">Leverandørnr.: {supplier.supplierNumber || `L-${supplier.id}`}</p>
              {supplier.cvr && <p className="text-muted-foreground">CVR: {supplier.cvr}</p>}
              {supplier.ean && <p className="text-muted-foreground">EAN: {supplier.ean}</p>}
              {supplier.paymentTerms && <p className="text-muted-foreground">Betalingsbetingelser: {supplier.paymentTerms} dage</p>}
              {supplier.bankAccount && <p className="text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3" />{supplier.bankAccount}</p>}
              <p className="text-muted-foreground">Status: {supplier.isActive ? "Aktiv" : "Inaktiv"}</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Kontakt</p>
              {supplier.address && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.address}</p>}
              {supplier.phone && <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</p>}
              {supplier.email && <p className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</p>}
              {supplier.invoiceEmail && <p className="text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />{supplier.invoiceEmail}</p>}
              {supplier.contactPerson && <p className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{supplier.contactPerson}</p>}
            </div>
          </div>

          {supplier.notes && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="font-medium">Noter: </span>
              {supplier.notes}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3 text-center">
              <FileText className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-lg font-bold mt-1">{supplierPOs.length}</p>
              <p className="text-xs text-muted-foreground">Indkøbsordrer</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-blue-500" />
              <p className="text-lg font-bold mt-1">{openPOs}</p>
              <p className="text-xs text-muted-foreground">Åbne</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Banknote className="h-4 w-4 mx-auto text-emerald-500" />
              <p className="text-lg font-bold mt-1">{fmtKr(totalPO)}</p>
              <p className="text-xs text-muted-foreground">Samlet værdi</p>
            </CardContent></Card>
          </div>

          {/* Purchase order history */}
          {supplierPOs.length > 0 ? (
            <div>
              <p className="font-semibold mb-2">Indkøbsordrer</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordrenr.</TableHead>
                      <TableHead>Dato</TableHead>
                      <TableHead className="text-right">Beløb</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierPOs.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-sm">{po.poNumber || `PO-${po.id}`}</TableCell>
                        <TableCell>{fmtDate(po.createdAt)}</TableCell>
                        <TableCell className="text-right">{fmtKr(po.totalAmount || 0)}</TableCell>
                        <TableCell><Badge className={PO_STATUS_COLORS[po.status] || "bg-gray-100"}>{PO_STATUS_LABELS[po.status] || po.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Ingen indkøbsordrer tilknyttet denne leverandør.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Luk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Plus, Send, Eye, Download, Trash2, RotateCcw, Copy,
  CheckCircle, Clock, AlertCircle, Euro, Search,
} from "lucide-react";

type Invoice = {
  id: number;
  companyId: number;
  customerId: number;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  paymentTerms: number;
  sentAt?: string | null;
  paidAt?: string | null;
  reminderCount: number;
  reminderFee: number;
  creditedAmount: number;
  paidAmount: number;
  notes?: string | null;
};

type InvoiceItem = {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number;
};

type CreditNote = {
  id: number;
  companyId: number;
  customerId?: number | null;
  invoiceId?: number | null;
  creditNumber: string;
  amount: number;
  reason?: string | null;
  status: string;
  createdAt: string;
};

type Customer = {
  id: number;
  name: string;
  email?: string | null;
  cvr?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  kladde: "Kladde",
  sendt: "Sendt",
  betalt: "Betalt",
  forfalden: "Forfalden",
  krediteret: "Krediteret",
};

const STATUS_COLORS: Record<string, string> = {
  kladde: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sendt: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  betalt: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  forfalden: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  krediteret: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

function fmtKr(n: number): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(n || 0);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("da-DK"); } catch { return d; }
}

export default function Fakturering({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");

  // ── Data ──
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices?companyId=${companyId}`);
      return res.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers?companyId=${companyId}`);
      return res.json();
    },
  });

  const { data: creditNotes = [] } = useQuery<CreditNote[]>({
    queryKey: ["/api/credit-notes", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/credit-notes?companyId=${companyId}`);
      return res.json();
    },
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/invoices", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Faktura oprettet", description: "Fakturaen er oprettet som kladde." });
      qc.invalidateQueries({ queryKey: ["/api/invoices", companyId] });
      setShowCreate(false);
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/send`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Faktura sendt", description: "Fakturaen er markeret som sendt." });
      qc.invalidateQueries({ queryKey: ["/api/invoices", companyId] });
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Faktura slettet" });
      qc.invalidateQueries({ queryKey: ["/api/invoices", companyId] });
    },
  });

  const creditMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/credit-notes", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Kreditnota oprettet", description: "Kreditnota er oprettet som kladde." });
      qc.invalidateQueries({ queryKey: ["/api/credit-notes", companyId] });
      qc.invalidateQueries({ queryKey: ["/api/invoices", companyId] });
      setShowCredit(false);
    },
    onError: (e: any) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  // ── Filtered invoices ──
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "alle" && inv.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const cust = customers.find((c) => c.id === inv.customerId);
        return (
          inv.invoiceNumber.toLowerCase().includes(s) ||
          (cust?.name || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, search, customers]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = invoices.length;
    const sendte = invoices.filter((i) => i.status === "sendt").length;
    const betalte = invoices.filter((i) => i.status === "betalt").length;
    const forfaldne = invoices.filter((i) => i.status === "forfalden").length;
    const outstanding = invoices
      .filter((i) => i.status === "sendt" || i.status === "forfalden")
      .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
    const paidTotal = invoices
      .filter((i) => i.status === "betalt")
      .reduce((sum, i) => sum + i.totalAmount, 0);
    return { total, sendte, betalte, forfaldne, outstanding, paidTotal };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Fakturering
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Opret, send og håndtér fakturaer og kreditnotaer
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCredit(true)} data-testid="button-credit-note">
            <RotateCcw className="h-4 w-4 mr-2" />
            Kreditnota
          </Button>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-invoice">
            <Plus className="h-4 w-4 mr-2" />
            Opret faktura
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Samlet</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Sendt</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.sendte}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Betalt</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.betalte}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Udestående</span>
            </div>
            <p className="text-2xl font-bold mt-1">{fmtKr(stats.outstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg fakturanr. eller kunde..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-invoice"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle status</SelectItem>
            <SelectItem value="kladde">Kladde</SelectItem>
            <SelectItem value="sendt">Sendt</SelectItem>
            <SelectItem value="betalt">Betalt</SelectItem>
            <SelectItem value="forfalden">Forfalden</SelectItem>
            <SelectItem value="krediteret">Krediteret</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Invoice Table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Indlæser fakturaer...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Ingen fakturaer fundet. Klik "Opret faktura" for at komme i gang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fakturanr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Dato</TableHead>
                    <TableHead>Forfald</TableHead>
                    <TableHead>Beløb (ekscl.)</TableHead>
                    <TableHead>Moms</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const cust = customers.find((c) => c.id === inv.customerId);
                    return (
                      <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell>{cust?.name || `Kunde #${inv.customerId}`}</TableCell>
                        <TableCell>{fmtDate(inv.issueDate)}</TableCell>
                        <TableCell>{fmtDate(inv.dueDate)}</TableCell>
                        <TableCell>{fmtKr(inv.netAmount)}</TableCell>
                        <TableCell>{fmtKr(inv.vatAmount)}</TableCell>
                        <TableCell className="font-semibold">{fmtKr(inv.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[inv.status] || "bg-gray-100"}>
                            {STATUS_LABELS[inv.status] || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setViewInvoice(inv)}
                              data-testid={`button-view-${inv.id}`}
                              title="Vis"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.status === "kladde" && (
                              <Button
                                size="icon" variant="ghost"
                                onClick={() => sendMutation.mutate(inv.id)}
                                data-testid={`button-send-${inv.id}`}
                                title="Send"
                              >
                                <Send className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {inv.status === "sendt" && (
                              <Button
                                size="icon" variant="ghost"
                                onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, "_blank")}
                                data-testid={`button-pdf-${inv.id}`}
                                title="PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {inv.status === "kladde" && (
                              <Button
                                size="icon" variant="ghost"
                                onClick={() => {
                                  if (confirm("Slet denne kladd?")) deleteMutation.mutate(inv.id);
                                }}
                                data-testid={`button-delete-${inv.id}`}
                                title="Slet"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
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

      {/* ── Credit Notes ── */}
      {creditNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-600" />
              Kreditnotaer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Kreditnr.</TableHead>
                    <TableHead>Beløb</TableHead>
                    <TableHead>Årsag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.map((cn) => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-mono text-sm">{cn.creditNumber}</TableCell>
                      <TableCell className="font-semibold text-red-600">-{fmtKr(cn.amount)}</TableCell>
                      <TableCell>{cn.reason || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cn.status}</Badge>
                      </TableCell>
                      <TableCell>{fmtDate(cn.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Create Invoice Dialog ── */}
      <CreateInvoiceDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        customers={customers}
        companyId={companyId}
        onCreate={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {/* ── Credit Note Dialog ── */}
      <CreditNoteDialog
        open={showCredit}
        onClose={() => setShowCredit(false)}
        invoices={invoices}
        customers={customers}
        companyId={companyId}
        onCreate={(data) => creditMutation.mutate(data)}
        isPending={creditMutation.isPending}
      />

      {/* ── View Invoice Dialog ── */}
      <ViewInvoiceDialog
        invoice={viewInvoice}
        onClose={() => setViewInvoice(null)}
        customers={customers}
        companyId={companyId}
      />
    </div>
  );
}

// ── Create Invoice Dialog ──

function CreateInvoiceDialog({
  open, onClose, customers, companyId, onCreate, isPending,
}: {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  companyId: number;
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [customerId, setCustomerId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState(14);
  const [vatRate, setVatRate] = useState(25);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ description: string; quantity: number; unitPrice: number }[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const netAmount = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const vatAmount = (netAmount * vatRate) / 100;
  const totalAmount = netAmount + vatAmount;
  const dueDate = new Date(new Date(issueDate).getTime() + paymentTerms * 86400000).toISOString().slice(0, 10);

  function addLine() {
    setLines([...lines, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: string, value: any) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function handleSubmit() {
    if (!customerId) return;
    onCreate({
      companyId,
      customerId: Number(customerId),
      issueDate,
      dueDate,
      paymentTerms,
      vatRate,
      netAmount,
      vatAmount,
      totalAmount,
      notes,
      items: lines.filter((l) => l.description).map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.quantity * l.unitPrice,
        vatRate,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opret faktura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kunde */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kunde</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="select-customer">
                  <SelectValue placeholder="Vælg kunde..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fakturadato</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} data-testid="input-issue-date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Betalingsfrist (dage)</Label>
              <Input
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(Number(e.target.value))}
                data-testid="input-payment-terms"
              />
            </div>
            <div>
              <Label>Momssats (%)</Label>
              <Select value={String(vatRate)} onValueChange={(v) => setVatRate(Number(v))}>
                <SelectTrigger data-testid="select-vat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25% (standard)</SelectItem>
                  <SelectItem value="0">0% (fritaget)</SelectItem>
                  <SelectItem value="12">12% (letmad)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fakturalinjer */}
          <div>
            <Label>Fakturalinjer</Label>
            <div className="space-y-2 mt-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-5"
                    placeholder="Beskrivelse"
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    data-testid={`input-line-desc-${idx}`}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    placeholder="Antal"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))}
                    data-testid={`input-line-qty-${idx}`}
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    placeholder="Enhedspris (kr.)"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, "unitPrice", Number(e.target.value))}
                    data-testid={`input-line-price-${idx}`}
                  />
                  <div className="col-span-1 text-right text-sm font-medium">
                    {fmtKr(line.quantity * line.unitPrice)}
                  </div>
                  <Button
                    size="icon" variant="ghost"
                    className="col-span-1"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={addLine} data-testid="button-add-line">
              <Plus className="h-4 w-4 mr-1" /> Tilføj linje
            </Button>
          </div>

          {/* Noter */}
          <div>
            <Label>Noter (valgfrit)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="F.eks. reference, ordrenummer..."
              data-testid="input-notes"
            />
          </div>

          {/* Totaler */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Netto (ekscl. moms):</span>
              <span className="font-medium">{fmtKr(netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Moms ({vatRate}%):</span>
              <span className="font-medium">{fmtKr(vatAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-1">
              <span>Total (inkl. moms):</span>
              <span>{fmtKr(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Forfaldsdato:</span>
              <span>{fmtDate(dueDate)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button onClick={handleSubmit} disabled={isPending || !customerId} data-testid="button-save-invoice">
            {isPending ? "Opretter..." : "Opret faktura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Credit Note Dialog ──

function CreditNoteDialog({
  open, onClose, invoices, customers, companyId, onCreate, isPending,
}: {
  open: boolean;
  onClose: () => void;
  invoices: Invoice[];
  customers: Customer[];
  companyId: number;
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  const selectedInvoice = invoices.find((i) => i.id === Number(invoiceId));

  function handleSubmit() {
    if (!invoiceId || amount <= 0) return;
    const inv = invoices.find((i) => i.id === Number(invoiceId));
    onCreate({
      companyId,
      invoiceId: Number(invoiceId),
      customerId: inv?.customerId,
      amount,
      reason,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opret kreditnota</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Faktura</Label>
            <Select value={invoiceId} onValueChange={(v) => {
              setInvoiceId(v);
              const inv = invoices.find((i) => i.id === Number(v));
              if (inv) setAmount(inv.totalAmount);
            }}>
              <SelectTrigger data-testid="select-credit-invoice">
                <SelectValue placeholder="Vælg faktura..." />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => {
                  const cust = customers.find((c) => c.id === inv.customerId);
                  return (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.invoiceNumber} — {cust?.name || "Ukendt"} — {fmtKr(inv.totalAmount)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {selectedInvoice && (
            <div className="text-sm text-muted-foreground">
              Faktura total: {fmtKr(selectedInvoice.totalAmount)} · Betalt: {fmtKr(selectedInvoice.paidAmount)}
            </div>
          )}
          <div>
            <Label>Kreditbeløb (kr.)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              data-testid="input-credit-amount"
            />
          </div>
          <div>
            <Label>Årsag</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. forkert fakturering, delvis returnering..."
              data-testid="input-credit-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button onClick={handleSubmit} disabled={isPending || !invoiceId || amount <= 0} data-testid="button-save-credit">
            {isPending ? "Opretter..." : "Opret kreditnota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Invoice Dialog ──

function ViewInvoiceDialog({
  invoice, onClose, customers, companyId,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  customers: Customer[];
  companyId: number;
}) {
  const { data: items = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoices", invoice?.id, "items"],
    queryFn: async () => {
      if (!invoice) return [];
      const res = await apiRequest("GET", `/api/invoices/${invoice.id}?includeItems=true`);
      const data = await res.json();
      return data.items || [];
    },
    enabled: !!invoice,
  });

  if (!invoice) return null;

  const cust = customers.find((c) => c.id === invoice.customerId);

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Faktura {invoice.invoiceNumber}</span>
            <Badge className={STATUS_COLORS[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kunde info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold">{cust?.name || "Ukendt kunde"}</p>
              {cust?.email && <p className="text-muted-foreground">{cust.email}</p>}
              {cust?.address && <p className="text-muted-foreground">{cust.address}</p>}
              {(cust?.zipCode || cust?.city) && (
                <p className="text-muted-foreground">{cust.zipCode} {cust.city}</p>
              )}
              {cust?.cvr && <p className="text-muted-foreground">CVR: {cust.cvr}</p>}
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Fakturadato: {fmtDate(invoice.issueDate)}</p>
              <p className="text-muted-foreground">Forfaldsdato: {fmtDate(invoice.dueDate)}</p>
              <p className="text-muted-foreground">Betalingsfrist: {invoice.paymentTerms} dage</p>
              {invoice.sentAt && <p className="text-muted-foreground">Sendt: {fmtDate(invoice.sentAt)}</p>}
              {invoice.paidAt && <p className="text-muted-foreground">Betalt: {fmtDate(invoice.paidAt)}</p>}
            </div>
          </div>

          {/* Linjer */}
          {items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead className="text-right">Antal</TableHead>
                  <TableHead className="text-right">Enhedspris</TableHead>
                  <TableHead className="text-right">Beløb</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{fmtKr(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{fmtKr(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Totaler */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Netto (ekscl. moms):</span>
              <span className="font-medium">{fmtKr(invoice.netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Moms ({invoice.vatRate}%):</span>
              <span className="font-medium">{fmtKr(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-1">
              <span>Total (inkl. moms):</span>
              <span>{fmtKr(invoice.totalAmount)}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Betalt:</span>
                  <span>{fmtKr(invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Udestående:</span>
                  <span>{fmtKr(invoice.totalAmount - invoice.paidAmount)}</span>
                </div>
              </>
            )}
          </div>

          {invoice.notes && (
            <div>
              <Label>Noter</Label>
              <p className="text-sm text-muted-foreground mt-1">{invoice.notes}</p>
            </div>
          )}

          {invoice.reminderCount > 0 && (
            <div className="text-sm text-orange-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {invoice.reminderCount} rykker(e) sendt · Rykkergebyr: {fmtKr(invoice.reminderFee)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, "_blank")}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
          <Button onClick={onClose}>Luk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

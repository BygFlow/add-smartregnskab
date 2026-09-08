import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw, Plus, Search, Edit, Trash2, CalendarClock, Wallet,
  Send, CheckCircle2, Trash,
} from "lucide-react";

/* Faste fakturaer — tilbagevendende fakturering for SmartRegnskab */

type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

type RecurringInvoice = {
  id: number;
  companyId: number;
  customerId: number;
  name: string;
  frequency: Frequency;
  nextDate: string | null;
  netAmount: number | string | null;
  vatRate: number | string | null;
  totalAmount: number | string | null;
  items: string | null;
  paymentTerms: string | null;
  autoSend: boolean | number | null;
  isActive: boolean | number | null;
  lastInvoiceId?: number | null;
  lastRunDate?: string | null;
  createdAt?: string | null;
};

type Customer = { id: number; name: string; customerNumber?: string | null };
type LineItem = { description: string; quantity: number; unitPrice: number };

const FREQ_LABEL: Record<Frequency, string> = {
  weekly: "Ugentlig", monthly: "Månedlig", quarterly: "Kvartal", yearly: "Årlig",
};
const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Ugentlig" },
  { value: "monthly", label: "Månedlig" },
  { value: "quarterly", label: "Kvartal" },
  { value: "yearly", label: "Årlig" },
];

function parseItems(items: string | null): LineItem[] {
  if (!items) return [];
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function fmtKr(n: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency", currency: "DKK",
  }).format(n || 0);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("da-DK"); } catch { return d; }
}

function toBool(v: boolean | number | null | undefined): boolean {
  return v === true || v === 1;
}

export default function FasteFakturaer({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [freqFilter, setFreqFilter] = useState("alle");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<RecurringInvoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery<RecurringInvoice[]>({
    queryKey: ["/api/recurring-invoices", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recurring-invoices?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers?companyId=${companyId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const customerName = (id: number) =>
    customers.find((c) => c.id === id)?.name ?? `Kunde #${id}`;

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recurring-invoices/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Faktura slettet" });
      qc.invalidateQueries({ queryKey: ["/api/recurring-invoices", companyId] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Ukendt fejl";
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (freqFilter !== "alle" && inv.frequency !== freqFilter) return false;
      if (statusFilter === "aktiv" && !toBool(inv.isActive)) return false;
      if (statusFilter === "inaktiv" && toBool(inv.isActive)) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = inv.name?.toLowerCase() ?? "";
        const cust = customerName(inv.customerId).toLowerCase();
        if (!name.includes(s) && !cust.includes(s)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, search, freqFilter, statusFilter, customers]);

  // Stats
  const activeCount = invoices.filter((i) => toBool(i.isActive)).length;
  const monthlyRevenue = invoices
    .filter((i) => toBool(i.isActive) && i.frequency === "monthly")
    .reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  const nextDueCount = invoices.filter((i) => {
    if (!toBool(i.isActive) || !i.nextDate) return false;
    const d = new Date(i.nextDate);
    return d >= today && d <= weekFromNow;
  }).length;
  const autoSendCount = invoices.filter((i) => toBool(i.autoSend)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-600" />
            Faste fakturaer
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Håndtér tilbagevendende fakturering — opret, rediger og overvåg abonnementer.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-recurring">
          <Plus className="h-4 w-4 mr-2" />
          Opret fast faktura
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-muted-foreground">Aktive</span>
            </div>
            <p className="text-2xl font-bold mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-muted-foreground">Månedlig omsætning</span>
            </div>
            <p className="text-2xl font-bold mt-1">{fmtKr(monthlyRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Næste 7 dage</span>
            </div>
            <p className="text-2xl font-bold mt-1">{nextDueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Auto-send</span>
            </div>
            <p className="text-2xl font-bold mt-1">{autoSendCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg navn eller kunde..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-recurring"
          />
        </div>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-40" data-testid="select-freq-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle frekvenser</SelectItem>
            {FREQ_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle status</SelectItem>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="inaktiv">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Indlæser faste fakturaer...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Ingen faste fakturaer fundet. Klik "Opret fast faktura" for at komme i gang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Frekvens</TableHead>
                    <TableHead>Næste dato</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Moms</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Auto-send</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const net = Number(inv.netAmount ?? 0);
                    const vat = Number(inv.vatRate ?? 0);
                    const vatAmount = net * (vat / 100);
                    const total = Number(inv.totalAmount ?? net + vatAmount);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.name}</TableCell>
                        <TableCell>{customerName(inv.customerId)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {FREQ_LABEL[inv.frequency] ?? inv.frequency}
                          </Badge>
                        </TableCell>
                        <TableCell>{fmtDate(inv.nextDate)}</TableCell>
                        <TableCell className="text-right">{fmtKr(net)}</TableCell>
                        <TableCell className="text-right">{fmtKr(vatAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtKr(total)}</TableCell>
                        <TableCell>
                          {toBool(inv.autoSend) ? (
                            <Badge className="bg-blue-100 text-blue-700">Ja</Badge>
                          ) : (
                            <span className="text-muted-foreground">Nej</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {toBool(inv.isActive) ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Aktiv</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700">Inaktiv</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditInvoice(inv)}
                              data-testid={`button-edit-${inv.id}`}
                            >
                              <Edit className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(inv.id)}
                              data-testid={`button-delete-${inv.id}`}
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
      <RecurringDialog
        open={showCreate || !!editInvoice}
        invoice={editInvoice}
        onClose={() => { setShowCreate(false); setEditInvoice(null); }}
        companyId={companyId}
        customers={customers}
      />
    </div>
  );
}

// ── Create/Edit Dialog ──

function RecurringDialog({
  open, invoice, onClose, companyId, customers,
}: {
  open: boolean;
  invoice: RecurringInvoice | null;
  onClose: () => void;
  companyId: number;
  customers: Customer[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!invoice;

  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [nextDate, setNextDate] = useState("");
  const [items, setItems] = useState<LineItem[]>(
    [{ description: "", quantity: 1, unitPrice: 0 }],
  );
  const [vatRate, setVatRate] = useState("25");
  const [paymentTerms, setPaymentTerms] = useState("14");
  const [autoSend, setAutoSend] = useState(false);

  // Reset when dialog opens
  useMemo(() => {
    if (open) {
      setCustomerId(invoice?.customerId ? String(invoice.customerId) : "");
      setName(invoice?.name ?? "");
      setFrequency(invoice?.frequency ?? "monthly");
      setNextDate(invoice?.nextDate ? invoice.nextDate.slice(0, 10) : "");
      const parsed = parseItems(invoice?.items ?? null);
      setItems(parsed.length > 0 ? parsed : [{ description: "", quantity: 1, unitPrice: 0 }]);
      setVatRate(String(invoice?.vatRate ?? 25));
      setPaymentTerms(invoice?.paymentTerms ?? "14");
      setAutoSend(toBool(invoice?.autoSend));
    }
  }, [open, invoice]);

  const netAmount = useMemo(
    () => items.reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0,
    ),
    [items],
  );
  const vatAmount = netAmount * (Number(vatRate) / 100 || 0);
  const totalAmount = netAmount + vatAmount;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId: Number(customerId) || null,
        name: name.trim(),
        frequency,
        nextDate: nextDate || null,
        netAmount,
        vatRate: Number(vatRate) || 0,
        totalAmount,
        items: JSON.stringify(items),
        paymentTerms,
        autoSend,
        isActive: true,
      };
      if (isEdit && invoice) {
        const res = await apiRequest("PATCH", `/api/recurring-invoices/${invoice.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/recurring-invoices", { ...payload, companyId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Faktura opdateret" : "Faktura oprettet" });
      qc.invalidateQueries({ queryKey: ["/api/recurring-invoices", companyId] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Ukendt fejl";
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  function addItem() { setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]); }
  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems(items.map((it, i) => {
      if (i !== idx) return it;
      if (field === "description") return { ...it, description: value };
      return { ...it, [field]: Number(value) || 0 };
    }));
  }

  function handleSubmit() {
    if (!name.trim()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger fast faktura" : "Opret fast faktura"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kunde *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="select-customer">
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beskrivelse / navn *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Månedlig abonnement"
                data-testid="input-name"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Frekvens</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger data-testid="select-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQ_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Næste dato</Label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                data-testid="input-next-date"
              />
            </div>
            <div>
              <Label>Betalingsbetingelser</Label>
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

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Fakturalinjer</Label>
              <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-1" />
                Tilføj linje
              </Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
                <div className="col-span-6">Beskrivelse</div>
                <div className="col-span-2 text-right">Antal</div>
                <div className="col-span-2 text-right">Stk. pris</div>
                <div className="col-span-1 text-right">Beløb</div>
                <div className="col-span-1"></div>
              </div>
              {items.map((it, idx) => {
                const lineTotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-6"
                      value={it.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      placeholder="Beskrivelse"
                      data-testid={`input-item-desc-${idx}`}
                    />
                    <Input
                      className="col-span-2 text-right"
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      data-testid={`input-item-qty-${idx}`}
                    />
                    <Input
                      className="col-span-2 text-right"
                      type="number"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                      data-testid={`input-item-price-${idx}`}
                    />
                    <div className="col-span-1 text-right text-sm font-medium">
                      {fmtKr(lineTotal)}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        data-testid={`button-remove-item-${idx}`}
                      >
                        <Trash className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <Label>Moms (%)</Label>
              <Input
                type="number"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                data-testid="input-vat-rate"
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-medium">{fmtKr(netAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moms</span>
                <span className="font-medium">{fmtKr(vatAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-emerald-700">{fmtKr(totalAmount)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="cursor-pointer">Auto-send</Label>
                <p className="text-xs text-muted-foreground">Send faktura automatisk</p>
              </div>
              <Switch
                checked={autoSend}
                onCheckedChange={setAutoSend}
                data-testid="switch-auto-send"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || mutation.isPending}
            data-testid="button-save-recurring"
          >
            {mutation.isPending ? "Gemmer..." : isEdit ? "Opdater faktura" : "Opret faktura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

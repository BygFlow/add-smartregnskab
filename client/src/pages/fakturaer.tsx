import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AiGate } from "@/components/ai-lock";
import {
  useInvoices, useCustomers, useTimeEntries, useTasks, useCreateInvoice, useDeleteInvoice,
  statusLabel, formatCurrency, formatDuration,
} from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, openAuthedFile } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, FileText, Trash2, Eye, Send, BellRing, Check, Info, Sparkles, AlertTriangle,
  CheckCircle, AlertCircle, Clock, RefreshCw, LayoutGrid, FileMinus, Gavel, History, Receipt, Wallet,
} from "lucide-react";
import type { Invoice, InvoiceItem } from "@shared/schema";
import { FunctionMenu } from "@/components/function-menu";
import type { FunctionMenuItem } from "@/components/function-menu";

function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

const invoiceStatusVariant: Record<string, "blue" | "green" | "gray" | "red" | "amber"> = {
  sendt: "blue",
  betalt: "green",
  kladde: "gray",
  forfalden: "red",
  rykket: "amber",
  overdraget: "red",
  krediteret: "gray",
};

// ── PDF preview (opens inline in a new tab instead of downloading) ──
async function previewPdf(url: string) {
  const res = await apiRequest("GET", url);
  const blob = await (res as Response).blob();
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    // Pop-up blokeret — fald tilbage til download
    openAuthedFile(url);
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
}

export default function Fakturaer() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const { data: invoices, isLoading } = useInvoices(companyId);
  const { data: customers } = useCustomers(companyId);
  const { data: timeEntries } = useTimeEntries(companyId);
  const { data: tasks } = useTasks(companyId);
  const createInvoice = useCreateInvoice(companyId);
  const deleteInvoice = useDeleteInvoice();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [creditInvoiceId, setCreditInvoiceId] = useState<number | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<number | null>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState<number | null>(null);
  const [filter, setFilter] = useState("alle");

  const canManage = user?.role === "leder" || user?.role === "platform_admin";
  const custName = (id: number) => customers?.find((c) => c.id === id)?.name || "Ukendt";
  const custMap = new Map((customers || []).map((c) => [c.id, c]));
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
  };

  const action = (path: (id: number) => string, ok: (d: any) => { title: string; description?: string }) =>
    useMutation({
      mutationFn: async (id: number) => (await apiRequest("POST", path(id), {})).json(),
      onSuccess: (d: any) => { invalidate(); toast(ok(d)); },
      onError: (e: any) => toast({ title: "Handlingen mislykkedes", description: e.message, variant: "destructive" }),
    });

  const send = action(
    (id) => `/api/invoices/${id}/send?companyId=${companyId}`,
    (d) => ({ title: "Faktura sendt", description: d.note }),
  );
  const reminder = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/invoices/${id}/reminder?companyId=${companyId}`, {})).json(),
    onSuccess: (d: any) => {
      invalidate();
      toast({ title: `Rykker sendt — gebyr på ${d.reminderFee ?? 0} kr tillagt`, description: `Rykker nr. ${d.reminderNumber}. Samlet rykkergebyr: ${d.totalReminderFee ?? 0} kr.` });
    },
    onError: (e: any) => toast({ title: "Rykker kunne ikke sendes", description: e.message, variant: "destructive" }),
  });
  const registerPayment = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) =>
      (await apiRequest("POST", `/api/invoices/${id}/payment?companyId=${companyId}`, { amount })).json(),
    onSuccess: (d: any) => {
      invalidate();
      setPaymentInvoiceId(null);
      toast({
        title: d.fullyPaid ? "Betaling registreret — faktura fuldt betalt" : "Delvis betaling registreret",
        description: `Betalt: ${formatCurrency(d.paidAmount)} · Restbeløb: ${formatCurrency(Math.max(0, d.outstanding))}`,
      });
    },
    onError: (e: any) => toast({ title: "Betaling kunne ikke registreres", description: e.message, variant: "destructive" }),
  });
  const markPaid = action(
    (id) => `/api/invoices/${id}/paid?companyId=${companyId}`,
    () => ({ title: "Betaling registreret" }),
  );
  const handover = action(
    (id) => `/api/invoices/${id}/handover?companyId=${companyId}`,
    () => ({ title: "Faktura overdraget til inkasso" }),
  );

  // ── Kreditnotaer ──
  const { data: creditNotes } = useQuery<any[]>({
    queryKey: ["/api/credit-notes", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/credit-notes?companyId=${companyId}`)).json(),
  });

  const createCreditNote = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/credit-notes?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreditInvoiceId(null);
      toast({ title: "Kreditnota oprettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke oprette kreditnota", description: e.message, variant: "destructive" }),
  });

  // ── Fakturadetaljer (med linjer) ──
  const { data: invoiceDetail, isLoading: detailLoading } = useQuery<{ id: number; items: InvoiceItem[] } & Invoice>({
    queryKey: ["/api/invoices", viewInvoiceId, companyId],
    queryFn: async () => (await apiRequest("GET", `/api/invoices/${viewInvoiceId}?companyId=${companyId}`)).json(),
    enabled: viewInvoiceId !== null,
  });

  // ── Kundens betalingshistorik ──
  const { data: customerHistory, isLoading: historyLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices/customer", historyCustomerId, companyId],
    queryFn: async () => (await apiRequest("GET", `/api/invoices/customer/${historyCustomerId}?companyId=${companyId}`)).json(),
    enabled: historyCustomerId !== null,
  });

  const list = invoices || [];
  const filterItems: FunctionMenuItem[] = [
    { id: "alle", label: "Alle", icon: <LayoutGrid className="w-4 h-4" /> },
    { id: "kladde", label: "Kladder", icon: <FileText className="w-4 h-4" /> },
    { id: "sendt", label: "Sendt", icon: <Send className="w-4 h-4" /> },
    { id: "forfalden", label: "Forfalden", icon: <AlertCircle className="w-4 h-4" /> },
    { id: "betalt", label: "Betalt", icon: <CheckCircle className="w-4 h-4" /> },
    { id: "overdraget", label: "Overdraget", icon: <Gavel className="w-4 h-4" /> },
  ];
  const filteredList = filter === "alle" ? list : list.filter((i) => i.status === filter);
  const totalUnpaid = list.filter((i) => !["betalt", "kladde", "krediteret"].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = list.filter((i) => i.status === "betalt").reduce((s, i) => s + i.totalAmount, 0);
  const totalVat = list.filter((i) => i.status !== "kladde").reduce((s, i) => s + i.vatAmount, 0);
  const totalCredited = (creditNotes ?? []).reduce((s: number, c: any) => s + (c.amount ?? 0), 0);

  const creditInvoice = useMemo(() => list.find((i) => i.id === creditInvoiceId) ?? null, [list, creditInvoiceId]);
  const paymentInvoice = useMemo(() => list.find((i) => i.id === paymentInvoiceId) ?? null, [list, paymentInvoiceId]);
  // Kreditnotaer knyttet til den faktura der vises i detalje-dialogen
  const detailCreditNotes = useMemo(
    () => viewInvoiceId !== null ? (creditNotes ?? []).filter((c: any) => c.invoiceId === viewInvoiceId) : [],
    [creditNotes, viewInvoiceId],
  );
  const busy = send.isPending || reminder.isPending || markPaid.isPending || handover.isPending || createCreditNote.isPending || registerPayment.isPending;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-4 space-y-3 max-w-5xl mx-auto pb-24">
      <PageHeader
        eyebrow="Økonomi"
        title="Fakturaer"
        description="Fakturering, rykkere og kreditnotaer"
        action={canManage ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-invoice"><Plus className="w-4 h-4 mr-1.5" />Ny faktura</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Ny faktura</DialogTitle></DialogHeader>
              <InvoiceForm
                customers={customers || []}
                timeEntries={timeEntries || []}
                tasks={tasks || []}
                onSubmit={async (data) => { await createInvoice.mutateAsync(data); setDialogOpen(false); }}
              />
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div data-testid="text-total-unpaid">
          <MetricCard icon={<AlertCircle className="w-5 h-5" />} value={formatCurrency(totalUnpaid)} label="Ubetalt" variant="red" />
        </div>
        <MetricCard icon={<CheckCircle className="w-5 h-5" />} value={formatCurrency(totalPaid)} label="Betalt" variant="green" />
        <div data-testid="text-total-vat">
          <MetricCard icon={<FileText className="w-5 h-5" />} value={formatCurrency(totalVat)} label="Salgsmoms" variant="primary" />
        </div>
        <MetricCard icon={<Clock className="w-5 h-5" />} value={formatCurrency(totalUnpaid + totalPaid)} label="I alt faktureret" variant="amber" />
      </div>

      {totalCredited > 0 && (
        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2" data-testid="card-credited-total">
          <FileMinus className="w-3.5 h-3.5" />
          Krediteret i alt: <span className="font-medium text-foreground tabular-nums">{formatCurrency(totalCredited)}</span>
        </div>
      )}

      <FunctionMenu items={filterItems} active={filter} onChange={setFilter} label="Status" />

      <SectionCard title="Fakturaer" icon={<FileText className="w-4 h-4" />} noPadding>
        <div className="divide-y divide-border/50">
        {filteredList.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs">{list.length === 0 ? "Ingen fakturaer endnu" : "Ingen fakturaer matcher det valgte filter"}</p>
          </div>
        ) : (
          filteredList.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 p-3 flex-wrap" data-testid={`row-invoice-${inv.id}`}>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-foreground">{inv.invoiceNumber}</span>
                  <StatusChip status={statusLabel(inv.status)} variant={invoiceStatusVariant[inv.status] ?? "gray"} />
                  {(inv.reminderCount ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] badge-soft badge-soft-red" data-testid={`badge-reminders-${inv.id}`}>
                      {inv.reminderCount} rykker
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {custName(inv.customerId)} · udstedt {dk(inv.issueDate)} · forfald {dk(inv.dueDate)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-foreground tabular-nums">{formatCurrency(inv.totalAmount)}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {formatCurrency(inv.netAmount)} + {formatCurrency(inv.vatAmount)} moms
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setViewInvoiceId(inv.id)} title="Vis detaljer"
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-view-invoice-${inv.id}`}>
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => previewPdf(`/api/invoices/${inv.id}/pdf?companyId=${companyId}`)} title="Se PDF"
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-preview-pdf-invoice-${inv.id}`}>
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openAuthedFile(`/api/invoices/${inv.id}/pdf?companyId=${companyId}`)} title="Hent PDF"
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-pdf-invoice-${inv.id}`}>
                  <FileText className="w-3.5 h-3.5" />
                </button>
                {canManage && inv.status !== "betalt" && inv.status !== "krediteret" && (
                  <>
                    <button onClick={() => send.mutate(inv.id)} disabled={busy} title="Send til kunden"
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-send-invoice-${inv.id}`}>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => reminder.mutate(inv.id)} disabled={busy} title="Send rykker"
                      className="p-1.5 rounded-md hover:bg-muted text-amber-600" data-testid={`button-reminder-invoice-${inv.id}`}>
                      <BellRing className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => markPaid.mutate(inv.id)} disabled={busy} title="Markér betalt"
                      className="p-1.5 rounded-md hover:bg-muted text-emerald-600" data-testid={`button-pay-invoice-${inv.id}`}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPaymentInvoiceId(inv.id)} disabled={busy} title="Registrer betaling"
                      className="p-1.5 rounded-md hover:bg-muted text-emerald-600" data-testid={`button-register-payment-${inv.id}`}>
                      <Wallet className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setCreditInvoiceId(inv.id)} disabled={busy} title="Opret kreditnota"
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-credit-invoice-${inv.id}`}>
                      <FileMinus className="w-3.5 h-3.5" />
                    </button>
                    {inv.status !== "overdraget" && (
                      <button onClick={() => handover.mutate(inv.id)} disabled={busy} title="Overdrag til inkasso"
                        className="p-1.5 rounded-md hover:bg-muted text-destructive" data-testid={`button-handover-invoice-${inv.id}`}>
                        <Gavel className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setHistoryCustomerId(inv.customerId)} title="Kundens betalingshistorik"
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-history-invoice-${inv.id}`}>
                  <History className="w-3.5 h-3.5" />
                </button>
                {canManage && inv.status === "kladde" && (
                  <button onClick={() => deleteInvoice.mutate(inv.id)} title="Slet"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive" data-testid={`button-delete-invoice-${inv.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        </div>
      </SectionCard>

      {/* Kreditnota-oversigt */}
      {(creditNotes ?? []).length > 0 && (
        <SectionCard title="Kreditnotaer" icon={<FileMinus className="w-4 h-4" />} noPadding>
          <div className="overflow-x-auto">
            <table className="table-premium w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th>Nummer</th><th>Kunde</th><th>Faktura</th>
                  <th className="text-right">Beløb</th><th>Årsag</th><th>Status</th><th>Oprettet</th>
                </tr>
              </thead>
              <tbody>
                {(creditNotes ?? []).map((cn: any) => (
                  <tr key={cn.id} className="border-b border-border/50 last:border-0" data-testid={`row-credit-note-${cn.id}`}>
                    <td className="p-3 font-medium whitespace-nowrap">{cn.creditNumber}</td>
                    <td className="p-3 max-w-40 truncate">{cn.customerName ?? custName(cn.customerId)}</td>
                    <td className="p-3">{cn.invoiceNumber ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatCurrency(cn.amount)}</td>
                    <td className="p-3 max-w-48 truncate text-muted-foreground">{cn.reason ?? "—"}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{cn.status}</span></td>
                    <td className="p-3 whitespace-nowrap">{dk(cn.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-3 flex gap-2 items-start">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Betalingsflow: <span className="font-medium">kladde → sendt → betalt</span>. Forfaldne fakturaer kan rykkes
          (status <span className="font-medium">forfalden</span>) og ved manglende betaling overdrages til inkasso
          (status <span className="font-medium">overdraget</span>). Rykkere kan først sendes efter forfaldsdatoen —
          serveren afviser tidligere forsøg. Både fakturaer og rykkere lægges i beskedkøen med status "simuleret",
          indtil en mailudbyder er sat op under Integrationer.
        </p>
      </div>

      {/* Fakturadetaljer med linjer */}
      <Dialog open={viewInvoiceId !== null} onOpenChange={(open) => !open && setViewInvoiceId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-invoice-detail">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" />Faktura {invoiceDetail?.invoiceNumber ?? ""}</DialogTitle></DialogHeader>
          {detailLoading ? <Skeleton className="h-72 rounded-md" /> : invoiceDetail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Kunde</div>
                  <div className="font-medium">{custName(invoiceDetail.customerId)}</div>
                  {custMap.get(invoiceDetail.customerId)?.address && (
                    <div className="text-xs text-muted-foreground">{custMap.get(invoiceDetail.customerId)?.address}</div>
                  )}
                  {custMap.get(invoiceDetail.customerId)?.cvr && (
                    <div className="text-xs text-muted-foreground">CVR {custMap.get(invoiceDetail.customerId)?.cvr}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusChip status={statusLabel(invoiceDetail.status)} variant={invoiceStatusVariant[invoiceDetail.status] ?? "gray"} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Udstedt</div>
                  <div className="font-medium">{dk(invoiceDetail.issueDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Forfald</div>
                  <div className="font-medium">{dk(invoiceDetail.dueDate)}</div>
                </div>
                {invoiceDetail.sentAt && (
                  <div>
                    <div className="text-xs text-muted-foreground">Sendt</div>
                    <div className="font-medium">{dk(invoiceDetail.sentAt)}</div>
                  </div>
                )}
                {(invoiceDetail.reminderCount ?? 0) > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Rykkere</div>
                    <div className="font-medium">{invoiceDetail.reminderCount} · senest {dk(invoiceDetail.lastReminderAt)}</div>
                  </div>
                )}
                {invoiceDetail.paidAt && (
                  <div>
                    <div className="text-xs text-muted-foreground">Betalt</div>
                    <div className="font-medium text-emerald-600">{dk(invoiceDetail.paidAt)}</div>
                  </div>
                )}
              </div>

              {/* Linjer */}
              <div className="border-t border-border pt-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Linjer</div>
                {(invoiceDetail.items ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ingen linjer.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border/50">
                    <table className="table-premium w-full text-xs">
                      <thead>
                        <tr>
                          <th>Beskrivelse</th>
                          <th className="text-right">Antal</th>
                          <th className="text-right">Enhedspris</th>
                          <th className="text-right">Beløb</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoiceDetail.items ?? []).map((it: InvoiceItem) => (
                          <tr key={it.id} className="border-b border-border/50 last:border-0" data-testid={`row-invoice-item-${it.id}`}>
                            <td className="p-2">{it.description}</td>
                            <td className="p-2 text-right tabular-nums">{it.quantity}</td>
                            <td className="p-2 text-right tabular-nums">{formatCurrency(it.unitPrice)}</td>
                            <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ekskl. moms</span>
                  <span className="tabular-nums">{formatCurrency(invoiceDetail.netAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moms ({Math.round((invoiceDetail.vatRate ?? 0.25) * 100)} %)</span>
                  <span className="tabular-nums">{formatCurrency(invoiceDetail.vatAmount)}</span>
                </div>
              </div>

              {/* Betalingsoversigt */}
              {(() => {
                const total = invoiceDetail.totalAmount ?? 0;
                const paid = invoiceDetail.paidAmount ?? 0;
                const credited = invoiceDetail.creditedAmount ?? 0;
                const fee = invoiceDetail.reminderFee ?? 0;
                const rest = Math.max(0, total + fee - paid - credited);
                return (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-1.5 text-sm" data-testid="block-payment-summary">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Betalingsoversigt</div>
                    <div className="flex justify-between" data-testid="text-summary-original">
                      <span className="text-muted-foreground">Oprindeligt beløb</span>
                      <span className="tabular-nums font-medium">{formatCurrency(total)}</span>
                    </div>
                    <div className="flex justify-between" data-testid="text-summary-paid">
                      <span className="text-muted-foreground">Allerede betalt</span>
                      <span className="tabular-nums text-emerald-600">− {formatCurrency(paid)}</span>
                    </div>
                    <div className="flex justify-between" data-testid="text-summary-credited">
                      <span className="text-muted-foreground">Krediteret</span>
                      <span className="tabular-nums text-amber-600">− {formatCurrency(credited)}</span>
                    </div>
                    <div className="flex justify-between" data-testid="text-summary-fee">
                      <span className="text-muted-foreground">Rykkergebyr</span>
                      <span className="tabular-nums text-destructive">+ {formatCurrency(fee)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-border font-bold" data-testid="text-summary-outstanding">
                      <span>Restbeløb</span>
                      <span className="tabular-nums">{formatCurrency(rest)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1" data-testid="text-summary-status">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <StatusChip status={statusLabel(invoiceDetail.status)} variant={invoiceStatusVariant[invoiceDetail.status] ?? "gray"} />
                    </div>
                  </div>
                );
              })()}

              {/* Rykkerhistorik */}
              {(invoiceDetail.reminderCount ?? 0) > 0 && (
                <div className="border-t border-border pt-3" data-testid="block-reminder-history">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5" />Rykkerhistorik
                  </div>
                  <div className="rounded-md border border-border/50 divide-y divide-border/40 text-xs">
                    <div className="flex justify-between p-2">
                      <span className="text-muted-foreground">Antal rykkere</span>
                      <span className="font-medium tabular-nums" data-testid="text-reminder-count">{invoiceDetail.reminderCount}</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span className="text-muted-foreground">Seneste rykker</span>
                      <span className="font-medium" data-testid="text-reminder-last">{dk(invoiceDetail.lastReminderAt)}</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span className="text-muted-foreground">Samlet rykkergebyr</span>
                      <span className="font-medium tabular-nums text-destructive" data-testid="text-reminder-fee-total">{formatCurrency(invoiceDetail.reminderFee ?? 0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Kreditnotaer */}
              {detailCreditNotes.length > 0 && (
                <div className="border-t border-border pt-3" data-testid="block-detail-credit-notes">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileMinus className="w-3.5 h-3.5" />Kreditnotaer
                  </div>
                  <div className="rounded-md border border-border/50 overflow-x-auto">
                    <table className="table-premium w-full text-xs">
                      <thead>
                        <tr>
                          <th>Nummer</th><th className="text-right">Beløb</th><th>Årsag</th><th>Status</th><th>Dato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailCreditNotes.map((cn: any) => (
                          <tr key={cn.id} className="border-b border-border/50 last:border-0" data-testid={`row-detail-credit-note-${cn.id}`}>
                            <td className="p-2 font-medium whitespace-nowrap">{cn.creditNumber}</td>
                            <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(cn.amount)}</td>
                            <td className="p-2 max-w-40 truncate text-muted-foreground">{cn.reason ?? "—"}</td>
                            <td className="p-2"><span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{cn.status}</span></td>
                            <td className="p-2 whitespace-nowrap">{dk(cn.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invoiceDetail.notes && (
                <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground" data-testid="text-invoice-notes">
                  <span className="font-medium">Noter:</span> {invoiceDetail.notes}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" data-testid="button-detail-preview-pdf"
                  onClick={() => previewPdf(`/api/invoices/${invoiceDetail.id}/pdf?companyId=${companyId}`)}>
                  <Eye className="w-3.5 h-3.5 mr-1" />Se PDF
                </Button>
                <Button variant="outline" size="sm" data-testid="button-open-pdf"
                  onClick={() => openAuthedFile(`/api/invoices/${invoiceDetail.id}/pdf?companyId=${companyId}`)}>
                  <FileText className="w-3.5 h-3.5 mr-1" />Hent PDF
                </Button>
                {canManage && invoiceDetail.status !== "betalt" && invoiceDetail.status !== "krediteret" && (
                  <>
                    <Button size="sm" data-testid="button-detail-send" disabled={busy} onClick={() => send.mutate(invoiceDetail.id)}>
                      <Send className="w-3.5 h-3.5 mr-1" />Send faktura
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-detail-reminder" disabled={busy} onClick={() => reminder.mutate(invoiceDetail.id)}>
                      <BellRing className="w-3.5 h-3.5 mr-1" />Send rykker
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-detail-credit" disabled={busy} onClick={() => setCreditInvoiceId(invoiceDetail.id)}>
                      <FileMinus className="w-3.5 h-3.5 mr-1" />Opret kreditnota
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-detail-pay" disabled={busy} onClick={() => markPaid.mutate(invoiceDetail.id)} className="text-emerald-600 border-emerald-600/30">
                      <Check className="w-3.5 h-3.5 mr-1" />Markér betalt
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-detail-register-payment" disabled={busy} onClick={() => setPaymentInvoiceId(invoiceDetail.id)} className="text-emerald-600 border-emerald-600/30">
                      <Wallet className="w-3.5 h-3.5 mr-1" />Registrer betaling
                    </Button>
                    {invoiceDetail.status !== "overdraget" && (
                      <Button size="sm" variant="outline" data-testid="button-detail-handover" disabled={busy} onClick={() => handover.mutate(invoiceDetail.id)} className="text-destructive border-destructive/30">
                        <Gavel className="w-3.5 h-3.5 mr-1" />Overdrag til inkasso
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kreditnota-dialog */}
      <CreditNoteDialog
        invoice={creditInvoice}
        open={creditInvoiceId !== null}
        onClose={() => setCreditInvoiceId(null)}
        pending={createCreditNote.isPending}
        onSubmit={(body) => createCreditNote.mutate(body)}
      />

      {/* Registrer betaling-dialog */}
      <PaymentDialog
        invoice={paymentInvoice}
        open={paymentInvoiceId !== null}
        onClose={() => setPaymentInvoiceId(null)}
        pending={registerPayment.isPending}
        onSubmit={(amount) => registerPayment.mutate({ id: paymentInvoiceId!, amount })}
      />

      {/* Kundens betalingshistorik */}
      <Dialog open={historyCustomerId !== null} onOpenChange={(open) => !open && setHistoryCustomerId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-customer-history">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" />Betalingshistorik — {historyCustomerId !== null ? custName(historyCustomerId) : ""}</DialogTitle></DialogHeader>
          {historyLoading ? <Skeleton className="h-64 rounded-md" /> : (customerHistory ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="empty-customer-history">Ingen fakturaer for denne kunde.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/50">
              <table className="table-premium w-full text-xs">
                <thead>
                  <tr>
                    <th>Nummer</th><th>Udstedt</th><th>Forfald</th>
                    <th className="text-right">Beløb</th><th>Status</th><th>Rykkere</th>
                  </tr>
                </thead>
                <tbody>
                  {(customerHistory ?? []).map((inv) => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0" data-testid={`row-history-${inv.id}`}>
                      <td className="p-2 font-medium">{inv.invoiceNumber}</td>
                      <td className="p-2 whitespace-nowrap">{dk(inv.issueDate)}</td>
                      <td className="p-2 whitespace-nowrap">{dk(inv.dueDate)}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(inv.totalAmount)}</td>
                      <td className="p-2"><StatusChip status={statusLabel(inv.status)} variant={invoiceStatusVariant[inv.status] ?? "gray"} /></td>
                      <td className="p-2 text-center">{(inv.reminderCount ?? 0) > 0 ? inv.reminderCount : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {historyCustomerId !== null && (() => {
            const hist = customerHistory ?? [];
            const total = hist.reduce((s, i) => s + i.totalAmount, 0);
            const paid = hist.filter((i) => i.status === "betalt").reduce((s, i) => s + i.totalAmount, 0);
            const outstanding = hist.filter((i) => !["betalt", "kladde", "krediteret"].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);
            return (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="kpi-card"><div className="text-[11px] text-muted-foreground">Faktureret</div><div className="font-bold tabular-nums" data-testid="text-history-total">{formatCurrency(total)}</div></div>
                <div className="kpi-card"><div className="text-[11px] text-muted-foreground">Betalt</div><div className="font-bold text-emerald-600 tabular-nums" data-testid="text-history-paid">{formatCurrency(paid)}</div></div>
                <div className="kpi-card"><div className="text-[11px] text-muted-foreground">Udestående</div><div className="font-bold text-destructive tabular-nums" data-testid="text-history-outstanding">{formatCurrency(outstanding)}</div></div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AiGate label="AI-analyse">
        <AiFaktureringPanel companyId={companyId} />
      </AiGate>
    </div>
  );
}

// ── Registrer betaling-dialog ─────────────────────────────────
function PaymentDialog({ invoice, open, onClose, pending, onSubmit }: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  useEffect(() => { setAmount(""); }, [invoice?.id, open]);

  const restbeløb = invoice
    ? Math.max(0, (invoice.totalAmount ?? 0) + (invoice.reminderFee ?? 0)
      - (invoice.paidAmount ?? 0) - (invoice.creditedAmount ?? 0))
    : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    const parsed = Number(amount.replace(",", ".")) || 0;
    if (parsed <= 0) return;
    onSubmit(parsed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-payment">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />Registrer betaling</DialogTitle></DialogHeader>
        {invoice && (
          <form onSubmit={submit} className="space-y-3">
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Faktura</span><span className="font-medium">{invoice.invoiceNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Oprindeligt beløb</span><span className="font-medium tabular-nums">{formatCurrency(invoice.totalAmount)}</span></div>
              {(invoice.paidAmount ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Allerede betalt</span><span className="font-medium tabular-nums text-emerald-600">{formatCurrency(invoice.paidAmount ?? 0)}</span></div>
              )}
              {(invoice.reminderFee ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Rykkergebyr</span><span className="font-medium tabular-nums text-destructive">{formatCurrency(invoice.reminderFee ?? 0)}</span></div>
              )}
              {(invoice.creditedAmount ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Krediteret</span><span className="font-medium tabular-nums text-amber-600">{formatCurrency(invoice.creditedAmount ?? 0)}</span></div>
              )}
              <div className="flex justify-between pt-1 border-t border-border"><span className="font-medium">Restbeløb</span><span className="font-bold tabular-nums">{formatCurrency(restbeløb)}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Betalingsbeløb (DKK)</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={String(restbeløb)} data-testid="input-payment-amount" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" data-testid="button-payment-full"
                onClick={() => setAmount(String(restbeløb))}>
                Hele beløbet
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Beløbet lægges til fakturaens betalte beløb. Hvis restbeløbet er dækket, markeres fakturaen som betalt.
            </p>
            <Button type="submit" className="w-full" disabled={pending || Number(amount.replace(",", ".")) <= 0} data-testid="button-save-payment">
              {pending ? "Registrerer..." : "Registrer betaling"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Kreditnota-dialog ──────────────────────────────────────────
function CreditNoteDialog({ invoice, open, onClose, pending, onSubmit }: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  // Nulstil felter når en ny faktura vælges
  const outstanding = invoice
    ? Math.max(0, (invoice.totalAmount ?? 0) + (invoice.reminderFee ?? 0)
      - (invoice.paidAmount ?? 0) - (invoice.creditedAmount ?? 0))
    : 0;
  useEffect(() => {
    setAmount(invoice ? String(outstanding > 0 ? outstanding : invoice.totalAmount) : "");
    setReason("");
  }, [invoice?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    onSubmit({
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      amount: Number(amount.replace(",", ".")) || invoice.totalAmount,
      reason: reason.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-credit-note">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileMinus className="w-5 h-5" />Opret kreditnota</DialogTitle></DialogHeader>
        {invoice && (
          <form onSubmit={submit} className="space-y-3">
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Faktura</span><span className="font-medium">{invoice.invoiceNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Oprindeligt beløb</span><span className="font-medium tabular-nums">{formatCurrency(invoice.totalAmount)}</span></div>
              {(invoice.paidAmount ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Allerede betalt</span><span className="font-medium tabular-nums text-emerald-600">{formatCurrency(invoice.paidAmount ?? 0)}</span></div>
              )}
              {(invoice.creditedAmount ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Allerede krediteret</span><span className="font-medium tabular-nums text-amber-600">{formatCurrency(invoice.creditedAmount ?? 0)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{statusLabel(invoice.status)}</span></div>
              <div className="flex justify-between pt-1 border-t border-border"><span className="font-medium">Udestående</span><span className="font-bold tabular-nums">{formatCurrency(outstanding)}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-amount">Kreditbeløb (DKK)</Label>
              <Input id="cn-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={String(outstanding > 0 ? outstanding : invoice.totalAmount)} data-testid="input-credit-amount" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-reason">Årsag</Label>
              <Textarea id="cn-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="f.eks. Fejl i faktura, delvis levering, klage fra kunde" data-testid="input-credit-reason" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kreditnotaen oprettes som bogført, og beløbet tillægges fakturaens krediterede beløb. Hvis hele det udestående krediteres, markeres fakturaen som krediteret.
            </p>
            <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-credit-note">
              {pending ? "Opretter..." : "Opret kreditnota"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceForm({ customers, timeEntries, tasks, onSubmit }: {
  customers: any[]; timeEntries: any[]; tasks: any[];
  onSubmit: (data: any) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
  const custMap = new Map(customers.map((c: any) => [c.id, c]));

  const customerEntries = customerId
    ? timeEntries.filter((t) => taskMap.get(t.taskId)?.customerId === Number(customerId) && t.durationMinutes)
    : [];

  const totalMins = customerEntries.reduce((s, t) => s + (t.durationMinutes || 0), 0);
  const rate = custMap.get(Number(customerId))?.hourlyRate || 350;
  const net = (totalMins / 60) * rate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    setSubmitting(true);
    const hours = totalMins / 60;
    try {
      await onSubmit({
        customerId: Number(customerId),
        items: [{
          description: `Rengøring (${formatDuration(totalMins)} = ${hours.toFixed(1)} timer)`,
          quantity: Number(hours.toFixed(2)),
          unitPrice: rate,
        }],
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Kunde</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger data-testid="select-invoice-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {customerId && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Registrerede timer</span><span className="font-medium">{formatDuration(totalMins)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Timepris</span><span className="font-medium tabular-nums">{formatCurrency(rate)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Ekskl. moms</span><span className="font-medium tabular-nums">{formatCurrency(net)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Moms 25 %</span><span className="font-medium tabular-nums">{formatCurrency(net * 0.25)}</span></div>
          <div className="flex justify-between pt-1 border-t border-border">
            <span className="font-medium">I alt</span>
            <span className="font-bold text-primary tabular-nums">{formatCurrency(net * 1.25)}</span>
          </div>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={submitting || !customerId || totalMins === 0} data-testid="button-save-invoice">
        {submitting ? "Opretter..." : "Opret faktura"}
      </Button>
    </form>
  );
}

/** AI-panel der analyserer faktureringsrisiko via /api/ai/assist (auto ved sideindlæsning). */
function AiFaktureringPanel({ companyId }: { companyId: number }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    riskLevel: "lav" | "medium" | "høj";
    totalOutstanding: number;
    totalOverdue: number;
    unpaidCount: number;
    overdueCount: number;
    insights: string[];
  }>({
    queryKey: ["/api/ai/assist", "fakturering-risk", String(companyId)],
    queryFn: async () =>
      (await apiRequest("POST", "/api/ai/assist", { contextType: "fakturering", intent: "risk", companyId })).json(),
  });

  const riskBadge: Record<string, { label: string; style: string }> = {
    lav: { label: "Lav", style: "badge-soft badge-soft-green" },
    medium: { label: "Medium", style: "badge-soft badge-soft-amber" },
    høj: { label: "Høj", style: "badge-soft badge-soft-red" },
  };
  const risk = data ? (riskBadge[data.riskLevel] ?? riskBadge.lav) : null;

  // Heuristik: en insight er positiv hvis den nævner "Ingen betalingsrisiko" eller "Alle fakturaer".
  const isPositive = (s: string) => /ingen betalingsrisiko|alle fakturaer/i.test(s);

  return (
    <div data-testid="panel-ai-fakturering">
      <SectionCard
        title="AI-analyse — Faktureringsrisiko"
        icon={<Sparkles className="w-4 h-4" />}
        action={
          <Button size="sm" variant="ghost" data-testid="button-ai-refresh" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Opdater
          </Button>
        }
      >
        <div className="space-y-3">
        {isLoading || isFetching ? (
        <div className="space-y-2" data-testid="ai-fakturering-loading">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : isError || !data ? (
        <p className="text-xs text-muted-foreground" data-testid="text-ai-fakturering-error">
          Analysen kunne ikke hentes.
          <Button size="sm" variant="ghost" data-testid="button-ai-fakturering-retry" onClick={() => refetch()}>Prøv igen</Button>
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Risikoniveau:</span>
            <Badge variant="secondary" className={`text-[11px] ${risk!.style}`} data-testid="badge-ai-risk-level">{risk!.label}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="kpi-card">
              <div className="text-[11px] text-muted-foreground">Udestående</div>
              <div className="text-xs font-bold text-foreground tabular-nums" data-testid="text-ai-outstanding">{formatCurrency(data.totalOutstanding)}</div>
            </div>
            <div className="kpi-card">
              <div className="text-[11px] text-muted-foreground">Forfaldne beløb</div>
              <div className="text-xs font-bold text-destructive tabular-nums" data-testid="text-ai-overdue">{formatCurrency(data.totalOverdue)}</div>
            </div>
            <div className="kpi-card">
              <div className="text-[11px] text-muted-foreground">Ubetalte</div>
              <div className="text-xs font-bold text-foreground tabular-nums" data-testid="text-ai-unpaid-count">{data.unpaidCount}</div>
            </div>
            <div className="kpi-card">
              <div className="text-[11px] text-muted-foreground">Forfaldne</div>
              <div className="text-xs font-bold text-destructive tabular-nums" data-testid="text-ai-overdue-count">{data.overdueCount}</div>
            </div>
          </div>

          {data.insights.length > 0 && (
            <div className="space-y-1.5" data-testid="block-ai-insights">
              {data.insights.map((s, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-foreground" data-testid={`text-ai-insight-${i}`}>
                  {isPositive(s)
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />}
                  <span>{s}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
        </div>
      </SectionCard>
    </div>
  );
}

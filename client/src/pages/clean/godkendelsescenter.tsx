import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, Wallet, Car, Star, MessageSquare } from "lucide-react";

type ItemType = "expense" | "mileage" | "feedback";

interface ExpenseReport {
  id: number; companyId: number; employeeId: number | null;
  amount: number | string | null; category: string;
  description?: string | null; date?: string | null;
  status: string; createdAt?: string | null;
}
interface MileageReport {
  id: number; companyId: number; employeeId: number | null;
  date: string | null; startAddress: string | null; endAddress: string | null;
  kilometers: number | string | null; purpose: string | null;
  rate: number | string | null; compensation: number | string | null;
  status: string; createdAt?: string | null;
}
interface FeedbackItem {
  id: number; companyId: number; employeeId: number | null;
  rating: number | null; comment?: string | null;
  status?: string | null; createdAt?: string | null;
}
interface PendingResponse {
  expenses: ExpenseReport[]; mileage: MileageReport[];
  feedback: FeedbackItem[]; totalPending: number;
}
interface Named { id: number; name?: string | null; fullName?: string | null; }
interface UnifiedItem {
  type: ItemType; id: number; title: string; employeeId: number | null;
  primary: string; secondary: string; date: string | null;
  raw: ExpenseReport | MileageReport | FeedbackItem;
}

const fmtCurrency = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(Number(n ?? 0));
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("da-DK") : "—");
const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
};
const nameOf = (x?: Named | null) => x?.name ?? x?.fullName ?? null;

const TYPE_META: Record<ItemType, { label: string; icon: React.ElementType; badge: string }> = {
  expense: { label: "Udgift", icon: Wallet, badge: "bg-blue-100 text-blue-800 border-blue-300" },
  mileage: { label: "Kørsel", icon: Car, badge: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  feedback: { label: "Feedback", icon: Star, badge: "bg-amber-100 text-amber-800 border-amber-300" },
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-base font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeBadge({ type }: { type: ItemType }) {
  const meta = TYPE_META[type];
  return <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>;
}

/** Samler alle afventende elementer til én sorteret liste. */
function toUnified(data: PendingResponse | undefined): UnifiedItem[] {
  if (!data) return [];
  const expenses: UnifiedItem[] = (data.expenses ?? []).map((e) => ({
    type: "expense" as const, id: e.id,
    title: e.description || e.category || "Udgift", employeeId: e.employeeId,
    primary: fmtCurrency(e.amount), secondary: e.category ?? "Udgift",
    date: e.date ?? e.createdAt ?? null, raw: e,
  }));
  const mileage: UnifiedItem[] = (data.mileage ?? []).map((m) => ({
    type: "mileage" as const, id: m.id,
    title: m.startAddress ? `${m.startAddress} → ${m.endAddress ?? "?"}` : "Kørselsregistrering",
    employeeId: m.employeeId, primary: `${num(m.kilometers).toLocaleString("da-DK")} km`,
    secondary: fmtCurrency(m.compensation), date: m.date ?? m.createdAt ?? null, raw: m,
  }));
  const feedback: UnifiedItem[] = (data.feedback ?? []).map((f) => ({
    type: "feedback" as const, id: f.id,
    title: f.comment || "Kundetilfredshed", employeeId: f.employeeId,
    primary: `${f.rating ?? "—"} ★`, secondary: "Feedback",
    date: f.createdAt ?? null, raw: f,
  }));
  return [...expenses, ...mileage, ...feedback].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}

function EmployeeName({ employeeId, employees }: { employeeId: number | null; employees: Named[] }) {
  const emp = employees.find((e) => e.id === employeeId);
  const label = emp ? nameOf(emp) : employeeId ? `Medarbejder #${employeeId}` : "—";
  return <span className="text-muted-foreground">{label}</span>;
}

interface RowHandlers {
  onApprove: (item: UnifiedItem) => void;
  onReject: (item: UnifiedItem) => void;
  onRespond: (item: UnifiedItem) => void;
}

function ItemRow({
  item, employees, onApprove, onReject, onRespond, pendingId,
}: RowHandlers & { item: UnifiedItem; employees: Named[]; pendingId: string | null }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const rowKey = `${item.type}-${item.id}`;
  const isBusy = pendingId === rowKey;
  return (
    <TableRow data-testid={`approval-row-${rowKey}`}>
      <TableCell className="w-10"><Icon className="h-4 w-4 text-muted-foreground" /></TableCell>
      <TableCell><TypeBadge type={item.type} /></TableCell>
      <TableCell className="max-w-[18rem]">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.secondary}</p>
      </TableCell>
      <TableCell><EmployeeName employeeId={item.employeeId} employees={employees} /></TableCell>
      <TableCell className="font-medium">{item.primary}</TableCell>
      <TableCell>{fmtDate(item.date)}</TableCell>
      <TableCell className="text-right">
        {item.type === "feedback" ? (
          <Button size="sm" variant="outline" onClick={() => onRespond(item)} data-testid={`respond-btn-${rowKey}`}>
            <MessageSquare className="mr-1 h-4 w-4" />Besvar
          </Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => onApprove(item)} disabled={isBusy} data-testid={`approve-btn-${rowKey}`}>
              <CheckCircle2 className="mr-1 h-4 w-4" />Godkend
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(item)} disabled={isBusy} data-testid={`reject-btn-${rowKey}`}>
              <XCircle className="mr-1 h-4 w-4" />Afvis
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function ItemTable({
  items, employees, onApprove, onReject, onRespond, pendingId,
}: RowHandlers & { items: UnifiedItem[]; employees: Named[]; pendingId: string | null }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" data-testid="empty-state">
        <CheckCircle2 className="h-12 w-12 text-blue-500" />
        <p className="text-base font-medium">Ingen afventende godkendelser</p>
        <p className="text-sm text-muted-foreground">Alt er behandlet — godt gået!</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="w-24">Type</TableHead>
            <TableHead>Beskrivelse</TableHead>
            <TableHead>Medarbejder</TableHead>
            <TableHead>Værdi</TableHead>
            <TableHead>Dato</TableHead>
            <TableHead className="text-right">Handling</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <ItemRow key={`${item.type}-${item.id}`} item={item} employees={employees}
              onApprove={onApprove} onReject={onReject} onRespond={onRespond} pendingId={pendingId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function GodkendelsesCenter({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("alle");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<UnifiedItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [respondItem, setRespondItem] = useState<UnifiedItem | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseStatus, setResponseStatus] = useState("under_behandling");

  const pendingQuery = useQuery<PendingResponse>({
    queryKey: ["/api/approvals/pending"],
    queryFn: async () => (await apiRequest("GET", "/api/approvals/pending")).json(),
  });
  const employeesQuery = useQuery<Named[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });

  const data = pendingQuery.data;
  const employees = employeesQuery.data ?? [];
  const expenses = data?.expenses ?? [];
  const mileage = data?.mileage ?? [];
  const feedback = data?.feedback ?? [];
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + num(e.amount), 0);
  const totalMileageKm = mileage.reduce((sum, m) => sum + num(m.kilometers), 0);
  const unified = useMemo(() => toUnified(data), [data]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/approvals/pending"] });
    qc.invalidateQueries({ queryKey: ["/api/employees"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (item: UnifiedItem) => {
      const path = item.type === "expense"
        ? `/api/approvals/expense/${item.id}/approve`
        : `/api/approvals/mileage/${item.id}/approve`;
      return (await apiRequest("POST", path)).json();
    },
    onMutate: (item) => setPendingId(`${item.type}-${item.id}`),
    onSuccess: (_res, item) => {
      const label = item.type === "expense" ? "Udgift" : "Kørsel";
      toast({ title: "Godkendt", description: `${label} godkendt.` });
      setPendingId(null);
      invalidateAll();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Kunne ikke godkende.";
      toast({ title: "Fejl", description: message, variant: "destructive" });
      setPendingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ item, reason }: { item: UnifiedItem; reason: string }) => {
      const path = item.type === "expense"
        ? `/api/approvals/expense/${item.id}/reject`
        : `/api/approvals/mileage/${item.id}/reject`;
      return (await apiRequest("POST", path, { reason })).json();
    },
    onMutate: ({ item }) => setPendingId(`${item.type}-${item.id}`),
    onSuccess: (_res, { item }) => {
      const label = item.type === "expense" ? "Udgift" : "Kørsel";
      toast({ title: "Afvist", description: `${label} afvist.` });
      setRejectItem(null);
      setRejectReason("");
      setPendingId(null);
      invalidateAll();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Kunne ikke afvise.";
      toast({ title: "Fejl", description: message, variant: "destructive" });
      setPendingId(null);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ item, response, status }: { item: UnifiedItem; response: string; status: string }) => {
      return (await apiRequest("POST", `/api/approvals/feedback/${item.id}/respond`, { response, status })).json();
    },
    onMutate: ({ item }) => setPendingId(`${item.type}-${item.id}`),
    onSuccess: () => {
      toast({ title: "Besvaret", description: "Feedback besvaret." });
      setRespondItem(null);
      setResponseText("");
      setResponseStatus("under_behandling");
      setPendingId(null);
      invalidateAll();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Kunne ikke besvare feedback.";
      toast({ title: "Fejl", description: message, variant: "destructive" });
      setPendingId(null);
    },
  });

  const handleApprove = (item: UnifiedItem) => {
    if (item.type === "feedback") return;
    approveMutation.mutate(item);
  };
  const handleRejectOpen = (item: UnifiedItem) => {
    setRejectItem(item);
    setRejectReason("");
  };
  const handleRejectSubmit = () => {
    if (!rejectItem) return;
    if (!rejectReason.trim()) {
      toast({ title: "Begrundelse mangler", description: "Indtast en begrundelse for afvisning.", variant: "destructive" });
      return;
    }
    rejectMutation.mutate({ item: rejectItem, reason: rejectReason.trim() });
  };
  const handleRespondOpen = (item: UnifiedItem) => {
    setRespondItem(item);
    setResponseText("");
    setResponseStatus("under_behandling");
  };
  const handleRespondSubmit = () => {
    if (!respondItem) return;
    if (!responseText.trim()) {
      toast({ title: "Svar mangler", description: "Indtast et svar.", variant: "destructive" });
      return;
    }
    respondMutation.mutate({ item: respondItem, response: responseText.trim(), status: responseStatus });
  };

  const isLoading = pendingQuery.isLoading;
  const filterByType = (t: ItemType) => unified.filter((i) => i.type === t);
  const tableProps = {
    employees, onApprove: handleApprove, onReject: handleRejectOpen,
    onRespond: handleRespondOpen, pendingId,
  };

  return (
    <div className="space-y-6" data-testid="godkendelsescenter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Godkendelsescenter</h1>
          <p className="text-sm text-muted-foreground">Afventende godkendelser og feedback</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Afventende i alt" value={`${data?.totalPending ?? 0}`} icon={Clock} />
        <StatCard label="Udgifter" value={fmtCurrency(totalExpenseAmount)} icon={Wallet} />
        <StatCard label="Kørsel" value={`${totalMileageKm.toLocaleString("da-DK")} km`} icon={Car} />
        <StatCard label="Feedback" value={`${feedback.length}`} icon={Star} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="alle" data-testid="tab-alle">Alle ({unified.length})</TabsTrigger>
          <TabsTrigger value="udgifter" data-testid="tab-udgifter">Udgifter ({expenses.length})</TabsTrigger>
          <TabsTrigger value="koersel" data-testid="tab-koersel">Kørsel ({mileage.length})</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback ({feedback.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="alle" className="mt-4">
          {isLoading ? <Skeleton className="h-40 w-full" /> : <ItemTable items={unified} {...tableProps} />}
        </TabsContent>
        <TabsContent value="udgifter" className="mt-4">
          {isLoading ? <Skeleton className="h-40 w-full" /> : <ItemTable items={filterByType("expense")} {...tableProps} />}
        </TabsContent>
        <TabsContent value="koersel" className="mt-4">
          {isLoading ? <Skeleton className="h-40 w-full" /> : <ItemTable items={filterByType("mileage")} {...tableProps} />}
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          {isLoading ? <Skeleton className="h-40 w-full" /> : <ItemTable items={filterByType("feedback")} {...tableProps} />}
        </TabsContent>
      </Tabs>

      {/* Afvis-dialog */}
      <Dialog open={!!rejectItem} onOpenChange={(open) => { if (!open) { setRejectItem(null); setRejectReason(""); } }}>
        <DialogContent data-testid="reject-dialog">
          <DialogHeader><DialogTitle>Afvis anmodning</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Begrundelse</Label>
            <Textarea id="reject-reason" placeholder="Angiv begrundelse for afvisning..."
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              data-testid="reject-reason" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectItem(null); setRejectReason(""); }} data-testid="reject-cancel">Annuller</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={rejectMutation.isPending} data-testid="reject-confirm">
              <XCircle className="mr-1 h-4 w-4" />Afvis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Besvar-feedback-dialog */}
      <Dialog open={!!respondItem} onOpenChange={(open) => { if (!open) { setRespondItem(null); setResponseText(""); setResponseStatus("under_behandling"); } }}>
        <DialogContent data-testid="respond-dialog">
          <DialogHeader><DialogTitle>Besvar feedback</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="response-text">Svar</Label>
              <Textarea id="response-text" placeholder="Skriv dit svar..."
                value={responseText} onChange={(e) => setResponseText(e.target.value)}
                data-testid="response-text" rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={responseStatus} onValueChange={setResponseStatus}>
                <SelectTrigger data-testid="response-status"><SelectValue placeholder="Vælg status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_behandling">Under behandling</SelectItem>
                  <SelectItem value="loest">Løst</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRespondItem(null); setResponseText(""); setResponseStatus("under_behandling"); }} data-testid="respond-cancel">Annuller</Button>
            <Button onClick={handleRespondSubmit} disabled={respondMutation.isPending} data-testid="respond-confirm">
              <MessageSquare className="mr-1 h-4 w-4" />Send svar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

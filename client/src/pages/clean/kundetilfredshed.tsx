import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Search, Eye, Trash2, MessageSquareReply, TrendingUp, Clock, CheckCircle2, Inbox } from "lucide-react";

type Category = "ros" | "klage" | "forslag" | "andet";
type FeedbackStatus = "ny" | "under_behandling" | "loest" | "afvist";

interface CustomerFeedback {
  id: number;
  companyId: number;
  customerId: number;
  taskId?: number | null;
  rating: number;
  comment?: string | null;
  category: Category | string;
  status: FeedbackStatus | string;
  response?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  createdAt: string;
}

interface Customer {
  id: number;
  companyId: number;
  name?: string | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  ros: { label: "Ros", className: "badge-soft badge-soft-green" },
  klage: { label: "Klage", className: "badge-soft badge-soft-red" },
  forslag: { label: "Forslag", className: "badge-soft badge-soft-blue" },
  andet: { label: "Andet", className: "badge-soft badge-soft-gray" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ny: { label: "Ny", className: "badge-soft badge-soft-amber" },
  under_behandling: { label: "Under behandling", className: "badge-soft badge-soft-blue" },
  loest: { label: "Løst", className: "badge-soft badge-soft-green" },
  afvist: { label: "Afvist", className: "badge-soft badge-soft-gray" },
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("da-DK");
}

function Stars({ value, testId }: { value: number; testId?: string }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <div className="flex items-center gap-0.5" data-testid={testId}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: React.ReactNode; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Kundetilfredshed({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [categoryFilter, setCategoryFilter] = useState("alle");
  const [viewTarget, setViewTarget] = useState<CustomerFeedback | null>(null);
  const [responseText, setResponseText] = useState("");
  const [statusDraft, setStatusDraft] = useState("");

  const { data: feedback, isLoading } = useQuery<CustomerFeedback[]>({
    queryKey: ["/api/customer-feedback", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customer-feedback?companyId=${companyId}`)).json(),
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const customerName = (id: number): string => {
    const c = customers?.find((x) => x.id === id);
    return c?.name || `Kunde #${id}`;
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/customer-feedback"] });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customer-feedback/${id}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tilbagemelding opdateret" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere", description: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/customer-feedback/${id}`)).json(),
    onSuccess: () => {
      invalidate();
      setViewTarget(null);
      toast({ title: "Tilbagemelding slettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });

  const list = feedback ?? [];

  const stats = useMemo(() => {
    const total = list.length;
    const sum = list.reduce((s, f) => s + (Number(f.rating) || 0), 0);
    const avg = total ? sum / total : 0;
    const pending = list.filter((f) => f.status === "ny").length;
    const resolved = list.filter((f) => f.status === "loest").length;
    const dist = [1, 2, 3, 4, 5].map((r) => list.filter((f) => Number(f.rating) === r).length);
    return { total, avg, pending, resolved, dist };
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((f) => {
      if (statusFilter !== "alle" && f.status !== statusFilter) return false;
      if (categoryFilter !== "alle" && f.category !== categoryFilter) return false;
      if (q) {
        const name = customerName(f.customerId).toLowerCase();
        const comment = (f.comment || "").toLowerCase();
        if (!name.includes(q) && !comment.includes(q)) return false;
      }
      return true;
    });
  }, [list, search, statusFilter, categoryFilter, customers]);

  const openView = (f: CustomerFeedback) => {
    setViewTarget(f);
    setResponseText(f.response || "");
    setStatusDraft(f.status as string);
  };

  const saveResponse = () => {
    if (!viewTarget) return;
    updateItem.mutate({
      id: viewTarget.id,
      data: { response: responseText, status: statusDraft, respondedAt: new Date().toISOString() },
    });
  };

  const catBadge = (cat: string) => (
    <Badge className={CATEGORY_CONFIG[cat]?.className || "badge-soft badge-soft-gray"}>
      {CATEGORY_CONFIG[cat]?.label || cat}
    </Badge>
  );
  const statusBadge = (st: string) => (
    <Badge className={STATUS_CONFIG[st]?.className || "badge-soft badge-soft-gray"}>
      {STATUS_CONFIG[st]?.label || st}
    </Badge>
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-kundetilfredshed">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />Kundetilfredshed
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tilbagemeldinger, vurderinger og svar fra kunder</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard testId="stat-avg-rating" icon={<TrendingUp className="w-5 h-5" />} label="Gennemsnitlig vurdering"
          value={<span className="flex items-center gap-1.5">{stats.total ? stats.avg.toFixed(1) : "—"}<Stars value={Math.round(stats.avg)} /></span>} />
        <StatCard testId="stat-total" icon={<Inbox className="w-5 h-5" />} label="Tilbagemeldinger i alt" value={stats.total} />
        <StatCard testId="stat-pending" icon={<Clock className="w-5 h-5" />} label="Afventer (nye)" value={stats.pending} />
        <StatCard testId="stat-resolved" icon={<CheckCircle2 className="w-5 h-5" />} label="Løst" value={stats.resolved} />
      </div>

      {/* Rating distribution */}
      <Card data-testid="rating-distribution">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-2">Vurderingsfordeling</p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => {
              const count = stats.dist[r - 1];
              const pct = stats.total ? (count / stats.total) * 100 : 0;
              return (
                <div key={r} className="flex items-center gap-2" data-testid={`dist-${r}-star`}>
                  <span className="text-xs w-10 flex items-center gap-0.5">{r}<Star className="w-3 h-3 fill-amber-400 text-amber-400" /></span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs w-8 text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="rounded-md border border-border/70 bg-card p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-end" data-testid="filter-bar">
        <div className="space-y-1.5 flex-1 w-full">
          <Label htmlFor="search-feedback" className="text-xs">Søg</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input id="search-feedback" data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg på kundenavn eller kommentar" className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5 w-full sm:w-48">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="ny">Ny</SelectItem>
              <SelectItem value="under_behandling">Under behandling</SelectItem>
              <SelectItem value="loest">Løst</SelectItem>
              <SelectItem value="afvist">Afvist</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-full sm:w-48">
          <Label className="text-xs">Kategori</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger data-testid="select-category-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="ros">Ros</SelectItem>
              <SelectItem value="klage">Klage</SelectItem>
              <SelectItem value="forslag">Forslag</SelectItem>
              <SelectItem value="andet">Andet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(search || statusFilter !== "alle" || categoryFilter !== "alle") && (
          <Button variant="ghost" data-testid="button-clear-filters"
            onClick={() => { setSearch(""); setStatusFilter("alle"); setCategoryFilter("alle"); }}>Ryd</Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dato</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Vurdering</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Kommentar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Ingen tilbagemeldinger fundet</TableCell></TableRow>
            ) : (
              filtered.map((f) => (
                <TableRow key={f.id} data-testid={`row-feedback-${f.id}`}>
                  <TableCell className="text-sm whitespace-nowrap">{dkDate(f.createdAt)}</TableCell>
                  <TableCell className="text-sm">{customerName(f.customerId)}</TableCell>
                  <TableCell><Stars value={Number(f.rating)} testId={`stars-${f.id}`} /></TableCell>
                  <TableCell>{catBadge(f.category as string)}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate" title={f.comment || ""}>{f.comment || "—"}</TableCell>
                  <TableCell>{statusBadge(f.status as string)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${f.id}`} onClick={() => openView(f)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-${f.id}`} onClick={() => deleteItem.mutate(f.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View / respond dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tilbagemelding detaljer</DialogTitle></DialogHeader>
          {viewTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Kunde</p>
                  <p className="font-medium">{customerName(viewTarget.customerId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dato</p>
                  <p className="font-medium">{dkDate(viewTarget.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vurdering</p>
                  <Stars value={Number(viewTarget.rating)} testId="stars-detail" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kategori</p>
                  {catBadge(viewTarget.category as string)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kommentar</p>
                <div className="rounded-md border border-border/70 p-2.5 text-sm bg-muted/30">{viewTarget.comment || "Ingen kommentar"}</div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="response-text" className="text-xs">Svar til kunden</Label>
                <Textarea id="response-text" data-testid="textarea-response" value={responseText}
                  onChange={(e) => setResponseText(e.target.value)} placeholder="Skriv et svar på denne tilbagemelding…" rows={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status-select" className="text-xs">Status</Label>
                <Select value={statusDraft} onValueChange={setStatusDraft}>
                  <SelectTrigger data-testid="select-status-detail" id="status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ny">Ny</SelectItem>
                    <SelectItem value="under_behandling">Under behandling</SelectItem>
                    <SelectItem value="loest">Løst</SelectItem>
                    <SelectItem value="afvist">Afvist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {viewTarget.respondedAt && (
                <p className="text-xs text-muted-foreground">
                  Senest besvaret {dkDate(viewTarget.respondedAt)}{viewTarget.respondedBy ? ` af ${viewTarget.respondedBy}` : ""}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" data-testid="button-close-view" onClick={() => setViewTarget(null)}>Luk</Button>
            <Button data-testid="button-save-response" disabled={updateItem.isPending} onClick={saveResponse}>
              <MessageSquareReply className="w-4 h-4 mr-1.5" />Gem svar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

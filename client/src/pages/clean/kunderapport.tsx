import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Download, Calendar, Star, CheckCircle2, Camera, Clock, AlertTriangle, Eye, Trash2,
} from "lucide-react";

type ReportStatus = "genereret" | "sendt" | "arkiveret";

interface CustomerReport {
  id: number;
  companyId: number;
  customerId: number;
  month: number;
  year: number;
  tasksCompleted: number;
  totalHours: number;
  deviationsCount: number;
  feedbackAvg: number | null;
  checklistCompletionRate: number;
  photosCount: number;
  reportData: string | null;
  generatedAt: string | null;
  status: ReportStatus | string;
  createdAt: string;
}

interface Customer {
  id: number;
  companyId: number;
  name?: string | null;
}

const MONTHS_DA = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December",
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  genereret: { label: "Genereret", className: "badge-soft badge-soft-blue" },
  sendt: { label: "Sendt", className: "badge-soft badge-soft-green" },
  arkiveret: { label: "Arkiveret", className: "badge-soft badge-soft-gray" },
};

function monthLabel(m: number): string {
  return MONTHS_DA[(m - 1 + 12) % 12] || String(m);
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("da-DK");
}

function hoursLabel(h: number): string {
  return `${(Number(h) || 0).toFixed(1)}t`;
}

function pctLabel(v: number): string {
  return `${Math.round(Number(v) || 0)}%`;
}

function StatCard({
  icon, label, value, testId,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; testId: string }) {
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

function statusBadge(st: string) {
  return (
    <Badge className={STATUS_CONFIG[st]?.className || "badge-soft badge-soft-gray"}>
      {STATUS_CONFIG[st]?.label || st}
    </Badge>
  );
}

export default function Kunderapport({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [genOpen, setGenOpen] = useState(false);
  const [genCustomer, setGenCustomer] = useState("");
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [viewTarget, setViewTarget] = useState<CustomerReport | null>(null);

  const { data: reports, isLoading } = useQuery<CustomerReport[]>({
    queryKey: ["/api/customer-reports", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/customer-reports?companyId=${companyId}`)).json(),
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const customerName = (id: number): string => {
    const c = customers?.find((x) => x.id === id);
    return c?.name || `Kunde #${id}`;
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/customer-reports"] });

  const generate = useMutation({
    mutationFn: async (body: { customerId: number; month: number; year: number }) =>
      (await apiRequest("POST", "/api/customer-reports/generate", body)).json(),
    onSuccess: () => {
      invalidate();
      setGenOpen(false);
      toast({ title: "Rapport genereret" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke generere rapport", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ReportStatus }) =>
      (await apiRequest("PATCH", `/api/customer-reports/${id}`, { status })).json(),
    onSuccess: (updated: CustomerReport) => {
      invalidate();
      setViewTarget(updated);
      toast({ title: "Status opdateret" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere status", description: e.message, variant: "destructive" }),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/customer-reports/${id}`)).json(),
    onSuccess: () => {
      invalidate();
      setViewTarget(null);
      toast({ title: "Rapport slettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke slette", description: e.message, variant: "destructive" }),
  });

  const list = reports ?? [];

  const stats = useMemo(() => {
    const total = list.length;
    const now = new Date();
    const thisMonth = list.filter(
      (r) => r.month === now.getMonth() + 1 && r.year === now.getFullYear(),
    ).length;
    const withFeedback = list.filter((r) => r.feedbackAvg != null);
    const avgFeedback = withFeedback.length
      ? withFeedback.reduce((s, r) => s + (Number(r.feedbackAvg) || 0), 0) / withFeedback.length
      : 0;
    const totalHours = list.reduce((s, r) => s + (Number(r.totalHours) || 0), 0);
    return { total, thisMonth, avgFeedback, totalHours };
  }, [list]);

  const parsedData = useMemo(() => {
    if (!viewTarget?.reportData) return null;
    try {
      return JSON.parse(viewTarget.reportData);
    } catch {
      return null;
    }
  }, [viewTarget]);

  const submitGenerate = () => {
    const customerId = Number(genCustomer);
    if (!customerId) {
      toast({ title: "Vælg en kunde", variant: "destructive" });
      return;
    }
    generate.mutate({ customerId, month: Number(genMonth), year: Number(genYear) });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-kunderapport">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />Kunderapport
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kunderapporter og månedlige rapportpakker</p>
        </div>
        <Button data-testid="btn-generate" onClick={() => setGenOpen(true)}>
          <Download className="w-4 h-4 mr-1.5" />Generer rapport
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard testId="stat-total" icon={<FileText className="w-5 h-5" />} label="Rapporter i alt" value={stats.total} />
        <StatCard testId="stat-this-month" icon={<Calendar className="w-5 h-5" />} label="Denne måned" value={stats.thisMonth} />
        <StatCard
          testId="stat-avg-feedback"
          icon={<Star className="w-5 h-5" />}
          label="Gennemsnitlig feedback"
          value={
            <span className="flex items-center gap-1.5">
              {stats.avgFeedback ? stats.avgFeedback.toFixed(1) : "—"}
              {stats.avgFeedback ? <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> : null}
            </span>
          }
        />
        <StatCard testId="stat-total-hours" icon={<Clock className="w-5 h-5" />} label="Timer rapporteret" value={hoursLabel(stats.totalHours)} />
      </div>

      {/* Reports table */}
      <Card data-testid="reports-table">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Måned</TableHead>
                <TableHead>År</TableHead>
                <TableHead className="text-right">Opgaver</TableHead>
                <TableHead className="text-right">Timer</TableHead>
                <TableHead className="text-right">Afvigelser</TableHead>
                <TableHead className="text-right">Feedback</TableHead>
                <TableHead className="text-right">Tjekliste</TableHead>
                <TableHead className="text-right">Fotos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    Ingen rapporter endnu
                  </TableCell>
                </TableRow>
              ) : (
                list.map((r) => (
                  <TableRow key={r.id} data-testid={`report-row-${r.id}`}>
                    <TableCell className="font-medium">{customerName(r.customerId)}</TableCell>
                    <TableCell>{monthLabel(r.month)}</TableCell>
                    <TableCell>{r.year}</TableCell>
                    <TableCell className="text-right">{r.tasksCompleted}</TableCell>
                    <TableCell className="text-right">{hoursLabel(r.totalHours)}</TableCell>
                    <TableCell className="text-right">
                      {r.deviationsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" />{r.deviationsCount}
                        </span>
                      ) : (
                        r.deviationsCount
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.feedbackAvg != null ? (
                        <span className="inline-flex items-center gap-1">
                          {Number(r.feedbackAvg).toFixed(1)}
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{pctLabel(r.checklistCompletionRate)}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-muted-foreground" />{r.photosCount}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          data-testid={`view-report-${r.id}`}
                          onClick={() => setViewTarget(r)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          data-testid={`delete-report-${r.id}`}
                          onClick={() => deleteReport.mutate(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent data-testid="generate-dialog">
          <DialogHeader>
            <DialogTitle>Generer kunderapport</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-customer">Kunde</Label>
              <Select value={genCustomer} onValueChange={setGenCustomer}>
                <SelectTrigger id="gen-customer" data-testid="gen-customer">
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name || `Kunde #${c.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gen-month">Måned</Label>
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger id="gen-month" data-testid="gen-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_DA.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gen-year">År</Label>
                <Input
                  id="gen-year" type="number" value={genYear}
                  data-testid="gen-year"
                  onChange={(e) => setGenYear(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Annuller</Button>
            <Button
              data-testid="btn-submit-generate"
              disabled={generate.isPending}
              onClick={submitGenerate}
            >
              {generate.isPending ? "Genererer..." : "Generer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="max-w-2xl" data-testid="view-dialog">
          {viewTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2 pr-8">
                  <span>{customerName(viewTarget.customerId)}</span>
                  {statusBadge(viewTarget.status)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard testId="view-tasks" icon={<CheckCircle2 className="w-5 h-5" />} label="Opgaver" value={viewTarget.tasksCompleted} />
                  <StatCard testId="view-hours" icon={<Clock className="w-5 h-5" />} label="Timer" value={hoursLabel(viewTarget.totalHours)} />
                  <StatCard testId="view-deviations" icon={<AlertTriangle className="w-5 h-5" />} label="Afvigelser" value={viewTarget.deviationsCount} />
                  <StatCard testId="view-photos" icon={<Camera className="w-5 h-5" />} label="Fotos" value={viewTarget.photosCount} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard
                    testId="view-feedback"
                    icon={<Star className="w-5 h-5" />}
                    label="Feedback"
                    value={
                      viewTarget.feedbackAvg != null ? (
                        <span className="flex items-center gap-1.5">
                          {Number(viewTarget.feedbackAvg).toFixed(1)}
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </span>
                      ) : "—"
                    }
                  />
                  <StatCard testId="view-checklist" icon={<CheckCircle2 className="w-5 h-5" />} label="Tjekliste" value={pctLabel(viewTarget.checklistCompletionRate)} />
                  <StatCard testId="view-date" icon={<Calendar className="w-5 h-5" />} label="Periode" value={`${monthLabel(viewTarget.month)} ${viewTarget.year}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Genereret: {viewTarget.generatedAt ? dkDate(viewTarget.generatedAt) : "—"} · Oprettet: {dkDate(viewTarget.createdAt)}
                </p>

                {/* Parsed report data */}
                {parsedData ? (
                  <div className="space-y-2" data-testid="report-data">
                    {Array.isArray(parsedData.tasks) && parsedData.tasks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Opgaveliste</p>
                        <ul className="text-sm space-y-0.5">
                          {parsedData.tasks.map((t: any, i: number) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <span>{typeof t === "string" ? t : t?.name || JSON.stringify(t)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(parsedData.deviations) && parsedData.deviations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Afvigelser</p>
                        <ul className="text-sm space-y-0.5">
                          {parsedData.deviations.map((d: any, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{typeof d === "string" ? d : d?.description || d?.title || JSON.stringify(d)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsedData.feedback && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Feedback detaljer</p>
                        <p className="text-sm">
                          {typeof parsedData.feedback === "string"
                            ? parsedData.feedback
                            : parsedData.feedback?.comment || parsedData.feedback?.text || JSON.stringify(parsedData.feedback)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {viewTarget.status !== "sendt" && (
                  <Button
                    data-testid="btn-mark-sent"
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: viewTarget.id, status: "sendt" })}
                  >
                    <Download className="w-4 h-4 mr-1.5" />Marker som sendt
                  </Button>
                )}
                {viewTarget.status !== "arkiveret" && (
                  <Button
                    data-testid="btn-archive"
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: viewTarget.id, status: "arkiveret" })}
                  >
                    <FileText className="w-4 h-4 mr-1.5" />Arkiver
                  </Button>
                )}
                <Button
                  data-testid="btn-delete-report"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteReport.isPending}
                  onClick={() => deleteReport.mutate(viewTarget.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />Slet rapport
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

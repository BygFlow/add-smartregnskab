import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, Shield, Clock, CheckCircle2, Bell, Zap,
} from "lucide-react";

type AlertType = "task_not_started" | "missing_checkin" | "incomplete_checklist" | "sla_risk";
type Severity = "lav" | "mellem" | "hoej" | "kritisk";
type AlertStatus = "aktiv" | "loest" | "ignoreret";

interface SlaAlert {
  id: number;
  companyId: number;
  alertType: AlertType;
  taskId?: number | null;
  customerId?: number | null;
  employeeId?: number | null;
  severity: Severity;
  message: string;
  status: AlertStatus;
  resolvedAt?: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<AlertType, string> = {
  task_not_started: "Opgave ikke startet",
  missing_checkin: "Manglende check-in",
  incomplete_checklist: "Tjekliste ikke fuldført",
  sla_risk: "SLA risiko",
};
const TYPE_CLASS: Record<AlertType, string> = {
  task_not_started: "bg-amber-100 text-amber-800 border-amber-300",
  missing_checkin: "bg-orange-100 text-orange-800 border-orange-300",
  incomplete_checklist: "bg-red-100 text-red-800 border-red-300",
  sla_risk: "bg-red-100 text-red-800 border-red-300",
};
const TYPE_ICON: Record<AlertType, typeof AlertTriangle> = {
  task_not_started: Clock, missing_checkin: Bell,
  incomplete_checklist: AlertTriangle, sla_risk: Shield,
};
const SEV_LABELS: Record<Severity, string> = { lav: "Lav", mellem: "Mellem", hoej: "Høj", kritisk: "Kritisk" };
const SEV_CLASS: Record<Severity, string> = {
  lav: "bg-green-100 text-green-800 border-green-300",
  mellem: "bg-amber-100 text-amber-800 border-amber-300",
  hoej: "bg-orange-100 text-orange-800 border-orange-300",
  kritisk: "bg-red-100 text-red-800 border-red-300",
};
const SEV_BAR: Record<Severity, string> = { lav: "bg-green-500", mellem: "bg-amber-500", hoej: "bg-orange-500", kritisk: "bg-red-500" };
const ST_LABELS: Record<AlertStatus, string> = { aktiv: "Aktiv", loest: "Løst", ignoreret: "Ignoreret" };
const ST_CLASS: Record<AlertStatus, string> = {
  aktiv: "bg-red-100 text-red-800 border-red-300",
  loest: "bg-green-100 text-green-800 border-green-300",
  ignoreret: "bg-gray-100 text-gray-700 border-gray-300",
};

const fmtDate = (d: string) => new Date(d).toLocaleString("da-DK");
const isToday = (d: string) => {
  const x = new Date(d), n = new Date();
  return x.getDate() === n.getDate() && x.getMonth() === n.getMonth() && x.getFullYear() === n.getFullYear();
};

export default function SlaOvervaagning({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "alle">("alle");
  const [sevFilter, setSevFilter] = useState<Severity | "alle">("alle");
  const [noteOpen, setNoteOpen] = useState<SlaAlert | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data, isLoading } = useQuery<SlaAlert[]>({
    queryKey: ["/api/sla-alerts", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/sla-alerts?companyId=${companyId}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/sla-alerts"] });

  const generateAlerts = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/sla-alerts/generate", { companyId })).json(),
    onSuccess: (res: { count?: number } | SlaAlert[] | unknown) => {
      invalidate();
      const count = Array.isArray(res) ? res.length : (res as { count?: number })?.count ?? 0;
      toast({ title: "SLA tjek genereret", description: `${count} alert${count === 1 ? "" : "s"} fundet` });
    },
    onError: (e: Error) => toast({ title: "Kunne ikke generere SLA tjek", description: e.message, variant: "destructive" }),
  });

  const resolveAlert = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: AlertStatus; note?: string }) =>
      (await apiRequest("PATCH", `/api/sla-alerts/${id}`, {
        status, note: note ?? null, resolvedAt: new Date().toISOString(),
      })).json(),
    onSuccess: () => { invalidate(); setNoteOpen(null); setNoteText(""); },
    onError: (e: Error) => toast({ title: "Kunne ikke opdatere alert", description: e.message, variant: "destructive" }),
  });

  const alerts = data ?? [];

  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status === "aktiv");
    return {
      totalActive: active.length,
      kritisk: active.filter((a) => a.severity === "kritisk").length,
      hoej: active.filter((a) => a.severity === "hoej").length,
      resolvedToday: alerts.filter((a) => a.status === "loest" && a.resolvedAt && isToday(a.resolvedAt)).length,
    };
  }, [alerts]);

  const breakdown = useMemo(() => {
    const active = alerts.filter((a) => a.status === "aktiv");
    const order: Severity[] = ["kritisk", "hoej", "mellem", "lav"];
    const counts = order.map((s) => ({ severity: s, count: active.filter((a) => a.severity === s).length }));
    return { counts, total: counts.reduce((s, c) => s + c.count, 0) || 1 };
  }, [alerts]);

  const filtered = useMemo(
    () => alerts.filter((a) => {
      if (statusFilter !== "alle" && a.status !== statusFilter) return false;
      if (sevFilter !== "alle" && a.severity !== sevFilter) return false;
      return true;
    }),
    [alerts, statusFilter, sevFilter],
  );

  const statCards = [
    { label: "Aktive alerts", value: stats.totalActive, icon: Bell, color: "text-blue-600" },
    { label: "Kritisk", value: stats.kritisk, icon: AlertTriangle, color: "text-red-600" },
    { label: "Høj", value: stats.hoej, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Løst i dag", value: stats.resolvedToday, icon: CheckCircle2, color: "text-green-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold tracking-tight">SLA Overvågning</h1>
        </div>
        <Button data-testid="generate-sla-btn" onClick={() => generateAlerts.mutate()} disabled={generateAlerts.isPending} className="bg-blue-600 hover:bg-blue-700">
          <Zap className="mr-2 h-4 w-4" />
          {generateAlerts.isPending ? "Genererer..." : "Generer SLA tjek"}
        </Button>
      </div>

      {/* Risiko i dag */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Risiko i dag</span>
            </div>
            <span className="text-sm text-muted-foreground">{stats.totalActive} aktive alerts</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {breakdown.counts.map((c) => c.count > 0 ? (
              <div key={c.severity} className={SEV_BAR[c.severity]} style={{ width: `${(c.count / breakdown.total) * 100}%` }} title={`${SEV_LABELS[c.severity]}: ${c.count}`} />
            ) : null)}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {breakdown.counts.map((c) => (
              <div key={c.severity} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${SEV_BAR[c.severity]}`} />
                <span className="text-xs text-muted-foreground">{SEV_LABELS[c.severity]}: {c.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AlertStatus | "alle")}>
          <SelectTrigger data-testid="filter-status" className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statusser</SelectItem>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="loest">Løst</SelectItem>
            <SelectItem value="ignoreret">Ignoreret</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={(v) => setSevFilter(v as Severity | "alle")}>
          <SelectTrigger data-testid="filter-severity" className="w-[160px]">
            <SelectValue placeholder="Alvorsgrad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle alvorsgrader</SelectItem>
            <SelectItem value="lav">Lav</SelectItem>
            <SelectItem value="mellem">Mellem</SelectItem>
            <SelectItem value="hoej">Høj</SelectItem>
            <SelectItem value="kritisk">Kritisk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Indlæser SLA alerts...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">Ingen aktive SLA alerts</p>
              <p className="text-xs text-muted-foreground">Alt ser ud til at køre efter planen</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Besked</TableHead>
                  <TableHead>Alvorsgrad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((alert) => {
                  const Icon = TYPE_ICON[alert.alertType];
                  return (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${TYPE_CLASS[alert.alertType]}`}>
                          <Icon className="h-3 w-3" />
                          {TYPE_LABELS[alert.alertType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs"><span className="text-sm">{alert.message}</span></TableCell>
                      <TableCell><Badge variant="outline" className={SEV_CLASS[alert.severity]}>{SEV_LABELS[alert.severity]}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={ST_CLASS[alert.status]}>{ST_LABELS[alert.status]}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(alert.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {alert.status === "aktiv" ? (
                          <div className="flex justify-end gap-2">
                            <Button data-testid={`resolve-btn-${alert.id}`} size="sm" variant="outline"
                              onClick={() => { setNoteOpen(alert); setNoteText(""); }}
                              disabled={resolveAlert.isPending}
                              className="border-green-300 text-green-700 hover:bg-green-50">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Løs
                            </Button>
                            <Button data-testid={`ignore-btn-${alert.id}`} size="sm" variant="outline"
                              onClick={() => resolveAlert.mutate({ id: alert.id, status: "ignoreret" })}
                              disabled={resolveAlert.isPending} className="text-gray-600">
                              Ignorer
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolve dialog */}
      <Dialog open={!!noteOpen} onOpenChange={(o) => !o && setNoteOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Løs SLA alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {noteOpen && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <Badge variant="outline" className={`mb-2 ${TYPE_CLASS[noteOpen.alertType]}`}>{TYPE_LABELS[noteOpen.alertType]}</Badge>
                <p>{noteOpen.message}</p>
              </div>
            )}
            <Textarea data-testid="resolve-note" placeholder="Tilføj note (valgfrit)..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(null)}>Annuller</Button>
            <Button data-testid="confirm-resolve-btn"
              onClick={() => noteOpen && resolveAlert.mutate({ id: noteOpen.id, status: "loest", note: noteText.trim() || undefined })}
              disabled={resolveAlert.isPending} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="mr-2 h-4 w-4" />Bekræft løsning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">Logget ind som {user?.name ?? "ukendt bruger"}</p>
    </div>
  );
}

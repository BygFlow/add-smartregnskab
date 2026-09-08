import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  ShieldAlert,
  Pencil,
  Filter,
  AlertOctagon,
  AlertTriangle,
  Bandage,
  FlaskConical,
  FileText,
} from "lucide-react";

type IncidentType =
  | "ulykke"
  | "naerved_hændelse"
  | "skade"
  | "kemikalie"
  | "sds";
type IncidentSeverity = "info" | "warning" | "critical";
type IncidentStatus = "åben" | "under_behandling" | "lukket";

interface WorkplaceIncident {
  id: number;
  companyId: number;
  type: IncidentType | string;
  title: string;
  date: string;
  location?: string | null;
  involvedEmployee?: string | null;
  severity: IncidentSeverity | string;
  status: IncidentStatus | string;
  description?: string | null;
  chemicalName?: string | null;
  sdsReference?: string | null;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  ulykke: {
    label: "Ulykke",
    className: "badge-soft badge-soft-red",
    icon: <AlertOctagon className="w-3 h-3" />,
  },
  naerved_hændelse: {
    label: "Nærved hændelse",
    className: "badge-soft badge-soft-amber",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  skade: {
    label: "Skade",
    className: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 badge-soft",
    icon: <Bandage className="w-3 h-3" />,
  },
  kemikalie: {
    label: "Kemikalie",
    className: "badge-soft badge-soft-blue",
    icon: <FlaskConical className="w-3 h-3" />,
  },
  sds: {
    label: "SDS",
    className: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 badge-soft",
    icon: <FileText className="w-3 h-3" />,
  },
};

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  info: { label: "Info", className: "badge-soft badge-soft-blue" },
  warning: { label: "Advarsel", className: "badge-soft badge-soft-amber" },
  critical: { label: "Kritisk", className: "badge-soft badge-soft-red" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  åben: { label: "Åben", className: "badge-soft badge-soft-red" },
  under_behandling: { label: "Under behandling", className: "badge-soft badge-soft-amber" },
  lukket: { label: "Lukket", className: "badge-soft badge-soft-green" },
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

export default function Arbejdsmiljo({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkplaceIncident | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: incidents, isLoading } = useQuery<WorkplaceIncident[]>({
    queryKey: ["/api/workplace-incidents", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/workplace-incidents?companyId=${companyId}`)).json(),
  });

  const filtered = useMemo(() => {
    const list = incidents ?? [];
    return list.filter((it) => {
      if (filterType && it.type !== filterType) return false;
      if (filterStatus && it.status !== filterStatus) return false;
      return true;
    });
  }, [incidents, filterType, filterStatus]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/workplace-incidents"] });

  const createIncident = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/workplace-incidents?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Hændelse rapporteret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke rapportere hændelse",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateIncident = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/workplace-incidents/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      toast({ title: "Hændelse opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere hændelse",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteIncident = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/workplace-incidents/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Hændelse slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette hændelse",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-incidents">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const openCount = (incidents ?? []).filter((i) => i.status !== "lukket").length;

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />Arbejdsmiljø
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Håndtering af arbejdsmiljøhændelser, ulykker, kemikalier og sikkerhedsdatablade (SDS)
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-incident" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Rapportér hændelse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rapportér hændelse</DialogTitle>
            </DialogHeader>
            <IncidentForm
              pending={createIncident.isPending}
              onSubmit={async (data) => {
                await createIncident.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border/70 bg-card p-3 flex items-center gap-2 text-sm">
        <ShieldAlert className="w-4 h-4 text-amber-500" />
        <span className="text-muted-foreground">
          {openCount} åbne hændelse(r) kræver opfølgning
        </span>
      </div>

      <div
        className="rounded-md border border-border/70 bg-card p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-end"
        data-testid="filter-bar"
      >
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />Filtre
        </div>
        <div className="space-y-1.5 flex-1 w-full">
          <Label htmlFor="filter-type" className="text-xs">Type</Label>
          <select
            id="filter-type"
            data-testid="filter-incident-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Alle typer</option>
            {Object.entries(TYPE_CONFIG).map(([id, c]) => (
              <option key={id} value={id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label htmlFor="filter-status" className="text-xs">Status</Label>
          <select
            id="filter-status"
            data-testid="filter-incident-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Alle statuser</option>
            {Object.entries(STATUS_CONFIG).map(([id, c]) => (
              <option key={id} value={id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {(filterType || filterStatus) && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-clear-filter"
            onClick={() => {
              setFilterType("");
              setFilterStatus("");
            }}
          >
            Ryd
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-incidents"
        >
          <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen hændelser fundet</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-incidents">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Dato</TableHead>
                <TableHead>Lokation</TableHead>
                <TableHead>Involveret</TableHead>
                <TableHead>Alvor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const type = TYPE_CONFIG[item.type as string] ?? {
                  label: item.type,
                  className: "badge-soft badge-soft-gray",
                  icon: <AlertTriangle className="w-3 h-3" />,
                };
                const sev = SEVERITY_CONFIG[item.severity as string] ?? {
                  label: item.severity,
                  className: "badge-soft badge-soft-gray",
                };
                const status = STATUS_CONFIG[item.status as string] ?? {
                  label: item.status,
                  className: "badge-soft badge-soft-gray",
                };
                return (
                  <TableRow key={item.id} data-testid={`row-incident-${item.id}`}>
                    <TableCell>
                      <span
                        className={type.className}
                        data-testid={`badge-incident-type-${item.id}`}
                      >
                        {type.icon}
                        {type.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.title}
                      {(item.type === "kemikalie" || item.type === "sds") &&
                        (item.chemicalName || item.sdsReference) && (
                          <div
                            className="text-xs text-muted-foreground mt-0.5"
                            data-testid={`chemical-info-${item.id}`}
                          >
                            {item.chemicalName && (
                              <span className="mr-2">
                                Kemikalie: {item.chemicalName}
                              </span>
                            )}
                            {item.sdsReference && (
                              <span>SDS-ref: {item.sdsReference}</span>
                            )}
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dk(item.date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.location || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.involvedEmployee || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={sev.className}
                        data-testid={`badge-incident-severity-${item.id}`}
                      >
                        {sev.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={status.className}
                        data-testid={`badge-incident-status-${item.id}`}
                      >
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditTarget(item)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-edit-incident-${item.id}`}
                          title="Rediger"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteIncident.mutate(item.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-delete-incident-${item.id}`}
                          title="Slet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rediger hændelse</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <IncidentForm
              initial={editTarget}
              pending={updateIncident.isPending}
              onSubmit={async (data) => {
                await updateIncident.mutateAsync({ id: editTarget.id, data });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IncidentForm({
  initial,
  pending,
  onSubmit,
}: {
  initial?: WorkplaceIncident | null;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [type, setType] = useState<IncidentType>(
    (initial?.type as IncidentType) ?? "ulykke"
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [involvedEmployee, setInvolvedEmployee] = useState(initial?.involvedEmployee ?? "");
  const [severity, setSeverity] = useState<IncidentSeverity>(
    (initial?.severity as IncidentSeverity) ?? "warning"
  );
  const [status, setStatus] = useState<IncidentStatus>(
    (initial?.status as IncidentStatus) ?? "åben"
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [chemicalName, setChemicalName] = useState(initial?.chemicalName ?? "");
  const [sdsReference, setSdsReference] = useState(initial?.sdsReference ?? "");
  const [submitting, setSubmitting] = useState(false);

  const showChemicalFields = type === "kemikalie" || type === "sds";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      type,
      title,
      date,
      location: location || null,
      involvedEmployee: involvedEmployee || null,
      severity,
      status,
      description: description || null,
      chemicalName: showChemicalFields ? chemicalName || null : null,
      sdsReference: showChemicalFields ? sdsReference || null : null,
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-type">Type</Label>
          <select
            id="inc-type"
            data-testid="input-incident-type"
            value={type}
            onChange={(e) => setType(e.target.value as IncidentType)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(TYPE_CONFIG).map(([id, c]) => (
              <option key={id} value={id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-severity">Alvor</Label>
          <select
            id="inc-severity"
            data-testid="input-incident-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="info">Info</option>
            <option value="warning">Advarsel</option>
            <option value="critical">Kritisk</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-title">Titel *</Label>
        <Input
          id="inc-title"
          data-testid="input-incident-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-date">Dato</Label>
          <Input
            id="inc-date"
            type="date"
            data-testid="input-incident-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-location">Lokation</Label>
          <Input
            id="inc-location"
            data-testid="input-incident-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-employee">Involveret medarbejder</Label>
          <Input
            id="inc-employee"
            data-testid="input-incident-employee"
            value={involvedEmployee}
            onChange={(e) => setInvolvedEmployee(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-status">Status</Label>
          <select
            id="inc-status"
            data-testid="input-incident-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as IncidentStatus)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="åben">Åben</option>
            <option value="under_behandling">Under behandling</option>
            <option value="lukket">Lukket</option>
          </select>
        </div>
      </div>

      {showChemicalFields && (
        <div
          className="rounded-md border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 p-3 space-y-3"
          data-testid="chemical-fields"
        >
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />Kemikalie/SDS information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-chemical">Kemikalienavn</Label>
              <Input
                id="inc-chemical"
                data-testid="input-incident-chemical"
                value={chemicalName}
                onChange={(e) => setChemicalName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-sds">SDS-reference</Label>
              <Input
                id="inc-sds"
                data-testid="input-incident-sds"
                value={sdsReference}
                onChange={(e) => setSdsReference(e.target.value)}
                placeholder="f.eks. SDS-2024-001"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="inc-description">Beskrivelse</Label>
        <Textarea
          id="inc-description"
          data-testid="input-incident-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-incident"
        >
          {submitting || pending ? "Gemmer..." : "Gem hændelse"}
        </Button>
      </DialogFooter>
    </form>
  );
}

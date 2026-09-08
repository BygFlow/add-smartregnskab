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
  History,
  Star,
  Pencil,
  Filter,
  Camera,
  ImageIcon,
} from "lucide-react";

type ServiceStatus = "afventer" | "gennemført" | "afvigelse";

interface ServiceHistory {
  id: number;
  companyId: number;
  customerName: string;
  locationName?: string | null;
  taskType?: string | null;
  date: string;
  employeeName?: string | null;
  rating?: number | string | null;
  status: ServiceStatus | string;
  beforePhotos?: string | null;
  afterPhotos?: string | null;
  notes?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  afventer: { label: "Afventer", className: "badge-soft badge-soft-amber" },
  gennemført: { label: "Gennemført", className: "badge-soft badge-soft-green" },
  afvigelse: { label: "Afvigelse", className: "badge-soft badge-soft-red" },
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" data-testid={`stars-rating`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < value
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

function parsePhotos(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  }
}

export default function Servicehistorik({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceHistory | null>(null);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const { data: items, isLoading } = useQuery<ServiceHistory[]>({
    queryKey: ["/api/service-history", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/service-history?companyId=${companyId}`)).json(),
  });

  const filtered = useMemo(() => {
    const list = items ?? [];
    return list.filter((it) => {
      if (
        filterCustomer &&
        !it.customerName?.toLowerCase().includes(filterCustomer.toLowerCase())
      )
        return false;
      if (filterDate && it.date && !it.date.startsWith(filterDate)) return false;
      return true;
    });
  }, [items, filterCustomer, filterDate]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/service-history"] });

  const createItem = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/service-history?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Post oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette post",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/service-history/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      toast({ title: "Post opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere post",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/service-history/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Post slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette post",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-service-history">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="w-5 h-5" />Servicehistorik
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Servicehistorik og fotoarkiv for alle opgaver
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-service" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Tilføj post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ny servicepost</DialogTitle>
            </DialogHeader>
            <ServiceForm
              pending={createItem.isPending}
              onSubmit={async (data) => {
                await createItem.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div
        className="rounded-md border border-border/70 bg-card p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-end"
        data-testid="filter-bar"
      >
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />Filtre
        </div>
        <div className="space-y-1.5 flex-1 w-full">
          <Label htmlFor="filter-customer" className="text-xs">Kunde</Label>
          <Input
            id="filter-customer"
            data-testid="filter-service-customer"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            placeholder="Søg på kundenavn"
          />
        </div>
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label htmlFor="filter-date" className="text-xs">Dato</Label>
          <Input
            id="filter-date"
            type="date"
            data-testid="filter-service-date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        {(filterCustomer || filterDate) && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-clear-filter"
            onClick={() => {
              setFilterCustomer("");
              setFilterDate("");
            }}
          >
            Ryd
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-service-history"
        >
          <History className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen serviceposter fundet</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-service-history">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Lokation</TableHead>
                <TableHead>Opgavetype</TableHead>
                <TableHead>Dato</TableHead>
                <TableHead>Medarbejder</TableHead>
                <TableHead>Bedømmelse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const status = STATUS_CONFIG[item.status as string] ?? {
                  label: item.status,
                  className: "badge-soft badge-soft-gray",
                };
                const before = parsePhotos(item.beforePhotos);
                const after = parsePhotos(item.afterPhotos);
                const rating = Number(item.rating) || 0;
                return (
                  <TableRow key={item.id} data-testid={`row-service-${item.id}`}>
                    <TableCell className="font-medium">{item.customerName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.locationName || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.taskType || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dk(item.date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.employeeName || "—"}
                    </TableCell>
                    <TableCell>
                      {rating > 0 ? (
                        <Stars value={rating} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={status.className}
                        data-testid={`badge-service-status-${item.id}`}
                      >
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(before.length > 0 || after.length > 0) && (
                          <span
                            className="badge-soft badge-soft-blue"
                            title={`${before.length} før / ${after.length} efter billeder`}
                            data-testid={`badge-photos-${item.id}`}
                          >
                            <ImageIcon className="w-3 h-3" />
                            {before.length + after.length}
                          </span>
                        )}
                        <button
                          onClick={() => setEditTarget(item)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-edit-service-${item.id}`}
                          title="Rediger"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteItem.mutate(item.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-delete-service-${item.id}`}
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
            <DialogTitle>Rediger servicepost</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <ServiceForm
              initial={editTarget}
              pending={updateItem.isPending}
              onSubmit={async (data) => {
                await updateItem.mutateAsync({ id: editTarget.id, data });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({
  initial,
  pending,
  onSubmit,
}: {
  initial?: ServiceHistory | null;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [locationName, setLocationName] = useState(initial?.locationName ?? "");
  const [taskType, setTaskType] = useState(initial?.taskType ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [employeeName, setEmployeeName] = useState(initial?.employeeName ?? "");
  const [rating, setRating] = useState(Number(initial?.rating) || 0);
  const [status, setStatus] = useState<ServiceStatus>(
    (initial?.status as ServiceStatus) ?? "gennemført"
  );
  const [beforePhotos, setBeforePhotos] = useState(() =>
    parsePhotos(initial?.beforePhotos).join("\n")
  );
  const [afterPhotos, setAfterPhotos] = useState(() =>
    parsePhotos(initial?.afterPhotos).join("\n")
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const toJsonArray = (text: string) =>
    text.trim()
      ? JSON.stringify(
          text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      customerName,
      locationName: locationName || null,
      taskType: taskType || null,
      date,
      employeeName: employeeName || null,
      rating,
      status,
      beforePhotos: toJsonArray(beforePhotos),
      afterPhotos: toJsonArray(afterPhotos),
      notes: notes || null,
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
          <Label htmlFor="service-customer">Kunde *</Label>
          <Input
            id="service-customer"
            data-testid="input-service-customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-location">Lokation</Label>
          <Input
            id="service-location"
            data-testid="input-service-location"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="service-task">Opgavetype</Label>
          <Input
            id="service-task"
            data-testid="input-service-task"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            placeholder="f.eks. Daglig rengøring"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-date">Dato</Label>
          <Input
            id="service-date"
            type="date"
            data-testid="input-service-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="service-employee">Medarbejder</Label>
          <Input
            id="service-employee"
            data-testid="input-service-employee"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-status">Status</Label>
          <select
            id="service-status"
            data-testid="input-service-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ServiceStatus)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="afventer">Afventer</option>
            <option value="gennemført">Gennemført</option>
            <option value="afvigelse">Afvigelse</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-rating">Bedømmelse (1-5)</Label>
        <div className="flex items-center gap-2">
          <input
            id="service-rating"
            type="range"
            min={0}
            max={5}
            step={1}
            data-testid="input-service-rating"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="flex-1"
          />
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                data-testid={`button-star-${i}`}
                onClick={() => setRating(i + 1)}
                className="p-0.5"
              >
                <Star
                  className={`w-5 h-5 ${
                    i < rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="text-sm font-medium w-6 text-right">{rating}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="service-before" className="flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" />Før-billeder (JSON)
          </Label>
          <Textarea
            id="service-before"
            data-testid="input-service-before"
            value={beforePhotos}
            onChange={(e) => setBeforePhotos(e.target.value)}
            rows={3}
            placeholder='["https://...", "https://..."]'
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-after" className="flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" />Efter-billeder (JSON)
          </Label>
          <Textarea
            id="service-after"
            data-testid="input-service-after"
            value={afterPhotos}
            onChange={(e) => setAfterPhotos(e.target.value)}
            rows={3}
            placeholder='["https://...", "https://..."]'
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-notes">Noter</Label>
        <Textarea
          id="service-notes"
          data-testid="input-service-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-service"
        >
          {submitting || pending ? "Gemmer..." : "Gem post"}
        </Button>
      </DialogFooter>
    </form>
  );
}

import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Plus, Trash2, Play, Check, MapPin, Clock, Route as RouteIcon } from "lucide-react";

type RouteStatus = "planlagt" | "igang" | "afsluttet";

interface StopItem {
  address?: string;
  name?: string;
}

interface Route {
  id: number;
  companyId: number;
  date: string;
  driverName: string;
  zone: string;
  stops: string | StopItem[] | null;
  totalDistance?: number | string | null;
  totalTime?: number | string | null;
  status: RouteStatus | string;
}

const STATUS_STYLE: Record<string, string> = {
  planlagt: "badge-soft badge-soft-gray",
  igang: "badge-soft badge-soft-blue",
  afsluttet: "badge-soft badge-soft-green",
};
const STATUS_LABEL: Record<string, string> = {
  planlagt: "Planlagt",
  igang: "I gang",
  afsluttet: "Afsluttet",
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

function parseStops(raw: string | StopItem[] | null | undefined): StopItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatStops(stops: StopItem[]): string {
  if (stops.length === 0) return "—";
  return stops
    .map((s, i) => `${i + 1}. ${s.address || s.name || "Uden navn"}`)
    .join(", ");
}

export default function Ruteplanlaegning({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: routes, isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/routes?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/routes"] });

  const createRoute = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/routes?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Rute oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette rute",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateRoute = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/routes/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Rute opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere rute",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/routes/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Rute slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette rute",
        description: e.message,
        variant: "destructive",
      }),
  });

  const handleStart = (route: Route) =>
    updateRoute.mutate({ id: route.id, data: { status: "igang" } });

  const handleFinish = (route: Route) =>
    updateRoute.mutate({ id: route.id, data: { status: "afsluttet" } });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-routes">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = routes ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Ruteplanlægning</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planlæg og styr ruter for dine chauffører
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-route" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Tilføj rute
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ny rute</DialogTitle>
            </DialogHeader>
            <RouteForm
              pending={createRoute.isPending}
              onSubmit={async (data) => {
                await createRoute.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground" data-testid="empty-routes">
            <RouteIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Ingen ruter endnu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[1000px] text-sm" data-testid="table-routes">
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Chauffør</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead className="text-right">Afstand</TableHead>
                  <TableHead className="text-right">Tid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-2">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((route) => {
                  const stops = parseStops(route.stops);
                  return (
                    <TableRow key={route.id} data-testid={`row-route-${route.id}`}>
                      <TableCell className="p-3">{dk(route.date)}</TableCell>
                      <TableCell className="p-3 font-medium">{route.driverName}</TableCell>
                      <TableCell className="p-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          {route.zone}
                        </span>
                      </TableCell>
                      <TableCell className="p-3 text-muted-foreground max-w-xs truncate" title={formatStops(stops)}>
                        {formatStops(stops)}
                      </TableCell>
                      <TableCell className="p-3 text-right tabular-nums text-muted-foreground">
                        {route.totalDistance ? `${route.totalDistance} km` : "—"}
                      </TableCell>
                      <TableCell className="p-3 text-right tabular-nums text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {route.totalTime ? `${route.totalTime} min` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="p-3">
                        <span
                          className={STATUS_STYLE[route.status as string] ?? "badge-soft badge-soft-gray"}
                          data-testid={`badge-route-status-${route.id}`}
                        >
                          {STATUS_LABEL[route.status as string] ?? route.status}
                        </span>
                      </TableCell>
                      <TableCell className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {route.status === "planlagt" && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-start-route-${route.id}`}
                              disabled={updateRoute.isPending}
                              onClick={() => handleStart(route)}
                            >
                              <Play className="w-3.5 h-3.5 mr-1" />Start rute
                            </Button>
                          )}
                          {route.status === "igang" && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-finish-route-${route.id}`}
                              disabled={updateRoute.isPending}
                              onClick={() => handleFinish(route)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />Afslut rute
                            </Button>
                          )}
                          <button
                            onClick={() => deleteRoute.mutate(route.id)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            data-testid={`button-delete-route-${route.id}`}
                            title="Slet rute"
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
      </div>
    </div>
  );
}

function RouteForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    driverName: "",
    zone: "",
    stopsText: "",
    totalDistance: "",
    totalTime: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const stops = form.stopsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ address: s }));
    const payload = {
      date: form.date,
      driverName: form.driverName,
      zone: form.zone,
      stops: JSON.stringify(stops),
      totalDistance: form.totalDistance ? Number(form.totalDistance) : null,
      totalTime: form.totalTime ? Number(form.totalTime) : null,
      status: "planlagt",
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
          <Label htmlFor="route-date">Dato *</Label>
          <Input
            id="route-date"
            type="date"
            data-testid="input-route-date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="route-driver">Chauffør *</Label>
          <Input
            id="route-driver"
            data-testid="input-route-driver"
            value={form.driverName}
            onChange={(e) => set("driverName", e.target.value)}
            placeholder="Fx Anders Hansen"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="route-zone">Zone *</Label>
        <Input
          id="route-zone"
          data-testid="input-route-zone"
          value={form.zone}
          onChange={(e) => set("zone", e.target.value)}
          placeholder="Fx Centrum Syd"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="route-stops">Stop (ét pr. linje)</Label>
        <Textarea
          id="route-stops"
          data-testid="textarea-route-stops"
          value={form.stopsText}
          onChange={(e) => set("stopsText", e.target.value)}
          placeholder={"Hovedgaden 1, 8000 Aarhus C\nKirkepladsen 4, 8000 Aarhus C"}
          rows={4}
        />
        <p className="text-[11px] text-muted-foreground">
          Hver linje bliver til et stop på ruten.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="route-distance">Total afstand (km)</Label>
          <Input
            id="route-distance"
            type="number"
            data-testid="input-route-distance"
            value={form.totalDistance}
            onChange={(e) => set("totalDistance", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="route-time">Total tid (min)</Label>
          <Input
            id="route-time"
            type="number"
            data-testid="input-route-time"
            value={form.totalTime}
            onChange={(e) => set("totalTime", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-route"
        >
          {submitting || pending ? "Gemmer..." : "Gem rute"}
        </Button>
      </DialogFooter>
    </form>
  );
}

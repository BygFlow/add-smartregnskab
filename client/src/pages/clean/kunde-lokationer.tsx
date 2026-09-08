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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  MapPin,
  Phone,
  User,
  Key,
  ShieldAlert,
  SprayCan,
  Pencil,
  Network,
} from "lucide-react";

type LocationStatus = "aktiv" | "inaktiv";

interface CustomerLocation {
  id: number;
  companyId: number;
  name: string;
  address?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  keyNumber?: string | null;
  alarmCode?: string | null;
  cleaningAreas?: string | null;
  accessInstructions?: string | null;
  status: LocationStatus | string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  aktiv: { label: "Aktiv", className: "badge-soft badge-soft-green" },
  inaktiv: { label: "Inaktiv", className: "badge-soft badge-soft-gray" },
};

function parseAreas(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  }
}

export default function KundeLokationer({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerLocation | null>(null);

  const { data: locations, isLoading } = useQuery<CustomerLocation[]>({
    queryKey: ["/api/customer-locations", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/customer-locations?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/customer-locations"] });

  const createLocation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/customer-locations?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Lokation oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette lokation",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customer-locations/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      toast({ title: "Lokation opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere lokation",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/customer-locations/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Lokation slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette lokation",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-locations">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const list = locations ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Network className="w-5 h-5" />Kunde-lokationer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kundehierarki — kunde → lokation → kontaktpersoner → adgangsinstrukser
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-location" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Tilføj lokation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ny lokation</DialogTitle>
            </DialogHeader>
            <LocationForm
              pending={createLocation.isPending}
              onSubmit={async (data) => {
                await createLocation.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-locations"
        >
          <MapPin className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen lokationer endnu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((loc) => {
            const status = STATUS_CONFIG[loc.status as string] ?? {
              label: loc.status,
              className: "badge-soft badge-soft-gray",
            };
            const areas = parseAreas(loc.cleaningAreas);
            return (
              <Card key={loc.id} data-testid={`card-location-${loc.id}`} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-1.5 truncate">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="truncate">{loc.name}</span>
                    </CardTitle>
                    <span
                      className={status.className}
                      data-testid={`badge-location-status-${loc.id}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {loc.address && (
                    <p className="text-xs text-muted-foreground mt-1">{loc.address}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {loc.contactPerson && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span>{loc.contactPerson}</span>
                    </div>
                  )}
                  {loc.contactPhone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{loc.contactPhone}</span>
                    </div>
                  )}
                  {loc.keyNumber && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Key className="w-3.5 h-3.5 shrink-0" />
                      <span>Nøgle: {loc.keyNumber}</span>
                    </div>
                  )}
                  {loc.alarmCode && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>Alarmkode: {loc.alarmCode}</span>
                    </div>
                  )}
                  {areas.length > 0 && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <SprayCan className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {areas.map((a, i) => (
                          <span
                            key={i}
                            className="badge-soft badge-soft-blue"
                            data-testid={`badge-area-${loc.id}-${i}`}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {loc.accessInstructions && (
                    <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-0.5">Adgangsinstrukser</p>
                      {loc.accessInstructions}
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-edit-location-${loc.id}`}
                      onClick={() => setEditTarget(loc)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />Rediger
                    </Button>
                    <button
                      onClick={() => deleteLocation.mutate(loc.id)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground ml-auto"
                      data-testid={`button-delete-location-${loc.id}`}
                      title="Slet lokation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rediger lokation</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <LocationForm
              initial={editTarget}
              pending={updateLocation.isPending}
              onSubmit={async (data) => {
                await updateLocation.mutateAsync({ id: editTarget.id, data });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LocationForm({
  initial,
  pending,
  onSubmit,
}: {
  initial?: CustomerLocation | null;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [keyNumber, setKeyNumber] = useState(initial?.keyNumber ?? "");
  const [alarmCode, setAlarmCode] = useState(initial?.alarmCode ?? "");
  const [cleaningAreas, setCleaningAreas] = useState(() => {
    const areas = parseAreas(initial?.cleaningAreas);
    return areas.join(", ");
  });
  const [accessInstructions, setAccessInstructions] = useState(
    initial?.accessInstructions ?? ""
  );
  const [status, setStatus] = useState<LocationStatus>(
    (initial?.status as LocationStatus) ?? "aktiv"
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name,
      address: address || null,
      contactPerson: contactPerson || null,
      contactPhone: contactPhone || null,
      keyNumber: keyNumber || null,
      alarmCode: alarmCode || null,
      cleaningAreas: cleaningAreas
        ? JSON.stringify(
            cleaningAreas.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
          )
        : null,
      accessInstructions: accessInstructions || null,
      status,
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="loc-name">Navn *</Label>
        <Input
          id="loc-name"
          data-testid="input-location-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loc-address">Adresse</Label>
        <Input
          id="loc-address"
          data-testid="input-location-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="loc-contact">Kontaktperson</Label>
          <Input
            id="loc-contact"
            data-testid="input-location-contact"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-phone">Telefon</Label>
          <Input
            id="loc-phone"
            data-testid="input-location-phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="loc-key">Nøglenummer</Label>
          <Input
            id="loc-key"
            data-testid="input-location-key"
            value={keyNumber}
            onChange={(e) => setKeyNumber(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-alarm">Alarmkode</Label>
          <Input
            id="loc-alarm"
            data-testid="input-location-alarm"
            value={alarmCode}
            onChange={(e) => setAlarmCode(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loc-areas">Rengøringsområder (kommasepareret)</Label>
        <Input
          id="loc-areas"
          data-testid="input-location-areas"
          value={cleaningAreas}
          onChange={(e) => setCleaningAreas(e.target.value)}
          placeholder="f.eks. Kontorer, Toiletter, Entré"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loc-access">Adgangsinstrukser</Label>
        <Textarea
          id="loc-access"
          data-testid="input-location-access"
          value={accessInstructions}
          onChange={(e) => setAccessInstructions(e.target.value)}
          rows={3}
          placeholder="f.eks. Nøgle hos portneren, ring 1 time inden ankomst"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loc-status">Status</Label>
        <select
          id="loc-status"
          data-testid="input-location-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as LocationStatus)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="aktiv">Aktiv</option>
          <option value="inaktiv">Inaktiv</option>
        </select>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-location"
        >
          {submitting || pending ? "Gemmer..." : "Gem lokation"}
        </Button>
      </DialogFooter>
    </form>
  );
}

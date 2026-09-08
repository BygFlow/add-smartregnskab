import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Wrench,
  Car,
  Package,
  Cog,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type EquipmentType = "maskine" | "bil" | "udstyr" | "værktøj";
type EquipmentStatus = "aktiv" | "service" | "reparation" | "ude_af_brug";

interface Equipment {
  id: number;
  companyId: number;
  name: string;
  type: EquipmentType;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  assignedTo?: string | null;
  serviceInterval?: number | string | null;
  nextServiceDate?: string | null;
  status: EquipmentStatus;
}

const TYPE_LABELS: Record<EquipmentType, string> = {
  maskine: "Maskine",
  bil: "Bil",
  udstyr: "Udstyr",
  værktøj: "Værktøj",
};

const TYPE_ICONS: Record<EquipmentType, typeof Wrench> = {
  maskine: Cog,
  bil: Car,
  udstyr: Package,
  værktøj: Wrench,
};

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  aktiv: "Aktiv",
  service: "Til service",
  reparation: "Reparation",
  ude_af_brug: "Ude af brug",
};

const STATUS_VARIANTS: Record<
  EquipmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  aktiv: "default",
  service: "secondary",
  reparation: "destructive",
  ude_af_brug: "outline",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

function date(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}.${month}.${year}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function EquipmentForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EquipmentType>("udstyr");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [serviceInterval, setServiceInterval] = useState("90");
  const [status, setStatus] = useState<EquipmentStatus>("aktiv");

  const submit = () => {
    if (!name.trim()) return;
    const interval = num(serviceInterval);
    const pDate = purchaseDate || null;
    let nextService: string | null = null;
    if (pDate && interval > 0) {
      const d = new Date(pDate);
      d.setDate(d.getDate() + interval);
      nextService = d.toISOString().slice(0, 10);
    }
    onSubmit({
      name: name.trim(),
      type,
      serialNumber: serialNumber.trim() || null,
      purchaseDate: pDate,
      assignedTo: assignedTo.trim() || null,
      serviceInterval: interval,
      nextServiceDate: nextService,
      status,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="eq-name">Navn *</Label>
        <Input
          id="eq-name"
          data-testid="input-equipment-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="F.eks. Gulvvaskemaskine TASKI"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as EquipmentType)}>
            <SelectTrigger data-testid="select-equipment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as EquipmentType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eq-serial">Serienummer</Label>
          <Input
            id="eq-serial"
            data-testid="input-serial-number"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eq-purchase">Købsdato</Label>
          <Input
            id="eq-purchase"
            data-testid="input-purchase-date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eq-interval">Serviceinterval (dage)</Label>
          <Input
            id="eq-interval"
            data-testid="input-service-interval"
            type="number"
            value={serviceInterval}
            onChange={(e) => setServiceInterval(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eq-assigned">Tildelt til</Label>
          <Input
            id="eq-assigned"
            data-testid="input-assigned-to"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="F.eks. Medarbejder eller afdeling"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as EquipmentStatus)}>
            <SelectTrigger data-testid="select-equipment-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as EquipmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-equipment"
          disabled={pending || !name.trim()}
          onClick={submit}
        >
          Gem udstyr
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function UdstyrService({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const todayStr = today();

  const { data, isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/equipment?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });

  const createEquipment = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/equipment?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Udstyr oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette udstyr",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: EquipmentStatus;
    }) =>
      (
        await apiRequest("PATCH", `/api/equipment/${id}?companyId=${companyId}`, {
          status,
        })
      ).json(),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere status",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/equipment/${id}?companyId=${companyId}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Udstyr slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette udstyr",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];
  const serviceNeededIds = useMemo(
    () =>
      items
        .filter(
          (i) =>
            !!i.nextServiceDate &&
            i.nextServiceDate.slice(0, 10) <= todayStr &&
            i.status !== "ude_af_brug",
        )
        .map((i) => i.id),
    [items, todayStr],
  );
  const serviceNeededSet = new Set(serviceNeededIds);

  const summary = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === "aktiv").length;
    const needsService = serviceNeededIds.length;
    return { total, active, needsService };
  }, [items, serviceNeededIds]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-7xl mx-auto pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Udstyr & Service</h1>
          <p className="text-sm text-muted-foreground">
            Udstyrsstyring og serviceplanlægning
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-equipment" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tilføj udstyr
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tilføj udstyr</DialogTitle>
            </DialogHeader>
            <EquipmentForm
              pending={createEquipment.isPending}
              onSubmit={(body) => createEquipment.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-equipment">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Samlet udstyr
              </p>
              <p className="text-xl font-semibold">{summary.total}</p>
            </div>
            <Wrench className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card data-testid="card-active-equipment">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Aktive enheder
              </p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-500">
                {summary.active}
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </CardContent>
        </Card>
        <Card data-testid="card-service-needed">
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Mangler service
              </p>
              <p className="text-xl font-semibold text-amber-600 dark:text-amber-500">
                {summary.needsService}
              </p>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-equipment"
        >
          <Wrench className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ikke registreret noget udstyr endnu.
        </div>
      ) : (
        <Card data-testid="card-equipment-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Serienummer</TableHead>
                    <TableHead>Købsdato</TableHead>
                    <TableHead>Tildelt til</TableHead>
                    <TableHead>Næste service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const TypeIcon = TYPE_ICONS[item.type] ?? Package;
                    const needsService = serviceNeededSet.has(item.id);
                    return (
                      <TableRow
                        key={item.id}
                        data-testid={`row-equipment-${item.id}`}
                        className={needsService ? "bg-amber-500/5" : ""}
                      >
                        <TableCell className="font-medium max-w-48 truncate">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <TypeIcon className="w-3 h-3" />
                            {TYPE_LABELS[item.type] ?? item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.serialNumber ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {date(item.purchaseDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.assignedTo ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className={needsService ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                            {date(item.nextServiceDate)}
                          </span>
                          {needsService && (
                            <Badge variant="destructive" className="ml-2" data-testid={`badge-service-due-${item.id}`}>
                              Service påkrævet
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[item.status]}>
                            {STATUS_LABELS[item.status] ?? item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Select
                              value={item.status}
                              onValueChange={(v) =>
                                updateStatus.mutate({
                                  id: item.id,
                                  status: v as EquipmentStatus,
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-8 w-32 text-xs"
                                data-testid={`select-status-${item.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(STATUS_LABELS) as EquipmentStatus[]).map(
                                  (s) => (
                                    <SelectItem key={s} value={s}>
                                      {STATUS_LABELS[s]}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <button
                              className="p-1.5 rounded-md hover:bg-muted text-destructive"
                              data-testid={`button-delete-equipment-${item.id}`}
                              onClick={() => deleteEquipment.mutate(item.id)}
                              aria-label="Slet udstyr"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

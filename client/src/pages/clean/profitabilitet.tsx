import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Brain, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";

type EntityType = "kunde" | "lokation" | "opgave" | "kontrakt";

interface ProfitabilityEntry {
  id: number;
  companyId: number;
  entityName: string;
  entityType: EntityType;
  period?: string | null;
  revenue?: number | string | null;
  totalCost?: number | string | null;
  profit?: number | string | null;
  margin?: number | string | null;
  hoursWorked?: number | string | null;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  kunde: "Kunde",
  lokation: "Lokation",
  opgave: "Opgave",
  kontrakt: "Kontrakt",
};

const ENTITY_CLASSES: Record<EntityType, string> = {
  kunde: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  lokation: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  opgave: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  kontrakt: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

function money(value?: number | null): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function pct(value?: number | null): string {
  return `${num(value).toFixed(1)}%`;
}

function marginClass(margin: number): string {
  if (margin > 20) return "text-green-600 dark:text-green-400";
  if (margin >= 10) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function marginBgClass(margin: number): string {
  if (margin > 20) return "bg-green-500/5";
  if (margin >= 10) return "bg-yellow-500/5";
  return "bg-red-500/5";
}

function ProfitForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("kunde");
  const [period, setPeriod] = useState("");
  const [revenue, setRevenue] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");

  const rev = num(revenue);
  const cost = num(totalCost);
  const profit = rev - cost;
  const margin = rev > 0 ? (profit / rev) * 100 : 0;

  const submit = () => {
    if (!entityName.trim()) return;
    onSubmit({
      entityName: entityName.trim(),
      entityType,
      period: period.trim() || null,
      revenue: rev,
      totalCost: cost,
      profit,
      margin,
      hoursWorked: num(hoursWorked),
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="prof-name">Entitetsnavn *</Label>
          <Input
            id="prof-name"
            data-testid="input-prof-name"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder="F.eks. Kunden A/S"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Entitetstype</Label>
          <Select
            value={entityType}
            onValueChange={(v) => setEntityType(v as EntityType)}
          >
            <SelectTrigger data-testid="select-entity-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prof-period">Periode</Label>
          <Input
            id="prof-period"
            data-testid="input-prof-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="F.eks. 2026-08"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prof-revenue">Omsætning (kr)</Label>
          <Input
            id="prof-revenue"
            data-testid="input-prof-revenue"
            type="number"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prof-cost">Samlede omkostninger (kr)</Label>
          <Input
            id="prof-cost"
            data-testid="input-prof-cost"
            type="number"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prof-hours">Timer arbejdet</Label>
        <Input
          id="prof-hours"
          data-testid="input-prof-hours"
          type="number"
          value={hoursWorked}
          onChange={(e) => setHoursWorked(e.target.value)}
        />
      </div>
      <div className="rounded-md border bg-muted/30 p-3 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Beregnet overskud</span>
          <span
            className="font-semibold tabular-nums"
            data-testid="computed-profit"
          >
            {money(profit)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Beregnet margin</span>
          <span
            className={`font-semibold tabular-nums ${marginClass(margin)}`}
            data-testid="computed-margin"
          >
            {pct(margin)}
          </span>
        </div>
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-prof"
          disabled={pending || !entityName.trim()}
          onClick={submit}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Tilføj post
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Profitabilitet({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoPeriod, setAutoPeriod] = useState("");

  const { data, isLoading } = useQuery<ProfitabilityEntry[]>({
    queryKey: ["/api/profitability", companyId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/profitability?companyId=${companyId}`,
        )
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/profitability"] });

  const createEntry = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/profitability?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Post tilføjet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke tilføje post",
        description: e.message,
        variant: "destructive",
      }),
  });

  const autoGenerate = useMutation({
    mutationFn: async (period: string) =>
      (
        await apiRequest(
          "POST",
          `/api/profitability/auto-generate?companyId=${companyId}`,
          { period },
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setAutoOpen(false);
      toast({ title: "Auto-generering fuldført" });
    },
    onError: (e: Error) =>
      toast({
        title: "Auto-generering fejlede",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        "DELETE",
        `/api/profitability/${id}?companyId=${companyId}`,
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Post slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette post",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];

  const summary = useMemo(() => {
    const totalRevenue = items.reduce((s, i) => s + num(i.revenue), 0);
    const totalCost = items.reduce((s, i) => s + num(i.totalCost), 0);
    const totalProfit = items.reduce((s, i) => s + num(i.profit), 0);
    const avgMargin =
      items.length > 0
        ? items.reduce((s, i) => s + num(i.margin), 0) / items.length
        : 0;
    return { totalRevenue, totalCost, totalProfit, avgMargin };
  }, [items]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
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
          <h1 className="text-xl font-semibold tracking-tight">
            Profitabilitet
          </h1>
          <p className="text-sm text-muted-foreground">
            Overskudsanalyse pr. kunde, lokation, opgave og kontrakt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            data-testid="button-auto-generate"
            onClick={() => setAutoOpen(true)}
          >
            <Brain className="w-4 h-4 mr-1.5" />
            Auto-generer
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button data-testid="button-add-prof" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Tilføj post
            </Button>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tilføj profitabilitetspost</DialogTitle>
              </DialogHeader>
              <ProfitForm
                pending={createEntry.isPending}
                onSubmit={(body) => createEntry.mutate(body)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Auto-generer profitabilitet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto-period">Periode</Label>
              <Input
                id="auto-period"
                data-testid="input-auto-period"
                value={autoPeriod}
                onChange={(e) => setAutoPeriod(e.target.value)}
                placeholder="F.eks. 2026-08"
              />
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              AI-genererede data kræver godkendelse. Du kan gennemgå og
              godkende/afvise poster efter generering.
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-run-auto"
              disabled={autoGenerate.isPending || !autoPeriod.trim()}
              onClick={() => autoGenerate.mutate(autoPeriod.trim())}
            >
              <Brain className="w-4 h-4 mr-1.5" />
              Generer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet omsætning
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-cost">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlede omkostninger
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalCost)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-profit">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet overskud
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.totalProfit)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-margin">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gennemsnitlig margin
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-semibold tabular-nums ${marginClass(
                summary.avgMargin,
              )}`}
            >
              {pct(summary.avgMargin)}
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-prof"
        >
          <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen profitabilitetsdata endnu.
        </div>
      ) : (
        <Card data-testid="card-prof-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Entitet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Omsætning</TableHead>
                    <TableHead className="text-right">Omkostninger</TableHead>
                    <TableHead className="text-right">Overskud</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Timer</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const margin = num(item.margin);
                    return (
                      <TableRow
                        key={item.id}
                        data-testid={`row-prof-${item.id}`}
                        className={marginBgClass(margin)}
                      >
                        <TableCell className="font-medium max-w-40 truncate">
                          {item.entityName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={ENTITY_CLASSES[item.entityType]}
                            data-testid={`badge-entity-type-${item.id}`}
                          >
                            {ENTITY_LABELS[item.entityType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.period ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(num(item.revenue))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(num(item.totalCost))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {money(num(item.profit))}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${marginClass(
                            margin,
                          )}`}
                          data-testid={`cell-margin-${item.id}`}
                        >
                          {pct(margin)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {num(item.hoursWorked)}
                        </TableCell>
                        <TableCell>
                          <button
                            className="p-1.5 rounded-md hover:bg-muted text-destructive"
                            data-testid={`button-delete-prof-${item.id}`}
                            disabled={deleteEntry.isPending}
                            onClick={() => deleteEntry.mutate(item.id)}
                            aria-label="Slet post"
                          >
                            <TrendingDown className="w-4 h-4" />
                          </button>
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

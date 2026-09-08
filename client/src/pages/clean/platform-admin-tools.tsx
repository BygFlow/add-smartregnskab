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
import { Switch } from "@/components/ui/switch";
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
  Building2,
  CheckCircle2,
  Cpu,
  Plus,
  Wallet,
} from "lucide-react";

type Plan = "basis" | "pro" | "enterprise";
type BillingCycle = "månedlig" | "kvartal" | "årlig";
type SubStatus = "aktiv" | "prøveperiode" | "pauset" | "opsiget";

interface PlatformSubscription {
  id: number;
  companyId: number;
  companyName: string;
  plan: Plan;
  price?: number | string | null;
  billingCycle: BillingCycle;
  maxUsers?: number | string | null;
  aiEnabled?: boolean | null;
  status: SubStatus;
  nextBillingDate?: string | null;
}

const PLAN_LABELS: Record<Plan, string> = {
  basis: "Basis",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_CLASSES: Record<Plan, string> = {
  basis: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  pro: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  enterprise: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const BILLING_LABELS: Record<BillingCycle, string> = {
  månedlig: "Månedlig",
  kvartal: "Kvartal",
  årlig: "Årlig",
};

const STATUS_LABELS: Record<SubStatus, string> = {
  aktiv: "Aktiv",
  prøveperiode: "Prøveperiode",
  pauset: "Pauset",
  opsiget: "Opsiget",
};

const STATUS_CLASSES: Record<SubStatus, string> = {
  aktiv: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  prøveperiode: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  pauset: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  opsiget: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
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

function date(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function SubForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [plan, setPlan] = useState<Plan>("basis");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("månedlig");
  const [maxUsers, setMaxUsers] = useState("5");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState("");

  const submit = () => {
    if (!companyName.trim()) return;
    onSubmit({
      companyName: companyName.trim(),
      plan,
      price: price ? num(price) : 0,
      billingCycle,
      maxUsers: num(maxUsers),
      aiEnabled,
      status: "aktiv",
      nextBillingDate: nextBillingDate || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sub-company">Virksomhedsnavn *</Label>
        <Input
          id="sub-company"
          data-testid="input-sub-company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="F.eks. Renservice A/S"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
            <SelectTrigger data-testid="select-sub-plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PLAN_LABELS) as Plan[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Faktureringscyklus</Label>
          <Select
            value={billingCycle}
            onValueChange={(v) => setBillingCycle(v as BillingCycle)}
          >
            <SelectTrigger data-testid="select-billing-cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BILLING_LABELS) as BillingCycle[]).map((b) => (
                <SelectItem key={b} value={b}>
                  {BILLING_LABELS[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sub-price">Pris (kr)</Label>
          <Input
            id="sub-price"
            data-testid="input-sub-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-max-users">Maks. brugere</Label>
          <Input
            id="sub-max-users"
            data-testid="input-sub-max-users"
            type="number"
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-next-billing">Næste faktureringsdato</Label>
        <Input
          id="sub-next-billing"
          data-testid="input-sub-next-billing"
          type="date"
          value={nextBillingDate}
          onChange={(e) => setNextBillingDate(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="sub-ai">AI aktiveret</Label>
          <p className="text-xs text-muted-foreground">
            Aktiver AI-funktioner for denne virksomhed
          </p>
        </div>
        <Switch
          id="sub-ai"
          data-testid="switch-sub-ai"
          checked={aiEnabled}
          onCheckedChange={setAiEnabled}
        />
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-sub"
          disabled={pending || !companyName.trim()}
          onClick={submit}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Tilføj abonnement
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function PlatformAdminTools({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<PlatformSubscription[]>({
    queryKey: ["/api/platform-subscriptions", companyId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/platform-subscriptions?companyId=${companyId}`,
        )
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/platform-subscriptions"],
    });

  const createSub = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/platform-subscriptions?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Abonnement tilføjet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke tilføje abonnement",
        description: e.message,
        variant: "destructive",
      }),
  });

  const toggleAi = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: boolean }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/platform-subscriptions/${id}?companyId=${companyId}`,
          { aiEnabled: value },
        )
      ).json(),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere abonnement",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: SubStatus }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/platform-subscriptions/${id}?companyId=${companyId}`,
          { status },
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Status opdateret" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke opdatere status",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];

  const summary = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === "aktiv").length;
    const mrr = items
      .filter((i) => i.status === "aktiv")
      .reduce((s, i) => {
        const price = num(i.price);
        if (i.billingCycle === "årlig") return s + price / 12;
        if (i.billingCycle === "kvartal") return s + price / 3;
        return s + price;
      }, 0);
    return { total, active, mrr };
  }, [items]);

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
          <h1 className="text-xl font-semibold tracking-tight">
            Platform admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Abonnementer og platformskonfiguration
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-sub" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tilføj abonnement
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tilføj abonnement</DialogTitle>
            </DialogHeader>
            <SubForm
              pending={createSub.isPending}
              onSubmit={(body) => createSub.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-companies">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlede virksomheder
            </CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-subs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktive abonnementer
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-green-600 dark:text-green-500">
              {summary.active}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-mrr">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlet MRR
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {money(summary.mrr)}
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-subs"
        >
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen abonnementer endnu.
        </div>
      ) : (
        <Card data-testid="card-sub-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Virksomhed</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Pris</TableHead>
                    <TableHead>Cyklus</TableHead>
                    <TableHead className="text-right">Maks. brugere</TableHead>
                    <TableHead className="text-center">AI</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Næste fakturering</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-sub-${item.id}`}>
                      <TableCell className="font-medium max-w-48 truncate">
                        {item.companyName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PLAN_CLASSES[item.plan]}
                          data-testid={`badge-plan-${item.id}`}
                        >
                          {PLAN_LABELS[item.plan]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(num(item.price))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {BILLING_LABELS[item.billingCycle]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(item.maxUsers)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Switch
                            data-testid={`switch-ai-${item.id}`}
                            checked={!!item.aiEnabled}
                            disabled={toggleAi.isPending}
                            onCheckedChange={(v) =>
                              toggleAi.mutate({ id: item.id, value: v })
                            }
                          />
                          {item.aiEnabled && (
                            <Cpu className="w-3.5 h-3.5 text-purple-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(v) =>
                            updateStatus.mutate({
                              id: item.id,
                              status: v as SubStatus,
                            })
                          }
                        >
                          <SelectTrigger
                            data-testid={`select-status-${item.id}`}
                            className="w-36 h-8"
                          >
                            <Badge
                              variant="outline"
                              className={STATUS_CLASSES[item.status]}
                            >
                              {STATUS_LABELS[item.status]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_LABELS) as SubStatus[]).map(
                              (s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {date(item.nextBillingDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

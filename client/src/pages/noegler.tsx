import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCustomers, useEmployees } from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Key,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { Customer, Employee, KeyHandover, KeyItem } from "@shared/schema";
import { PageHeader, MetricCard, SectionCard } from "@/components/premium";

type KeyRow = KeyItem & { hasSecret: boolean; secretMask?: string | null };
type SecretResponse = {
  secret?: string | null;
  accessNote?: string | null;
  advarsel?: string | null;
};

const KEY_TYPES = [
  { value: "noegle", label: "Nøgle" },
  { value: "brik", label: "Brik" },
  { value: "kode", label: "Kodelås" },
  { value: "alarmkode", label: "Alarmkode" },
];
const STATUS = [
  { value: "paa_lager", label: "På lager" },
  { value: "udlaant", label: "Udlånt" },
  { value: "bortkommet", label: "Bortkommet" },
];
const TYPE_LABEL = Object.fromEntries(
  KEY_TYPES.map((item) => [item.value, item.label]),
);
const STATUS_LABEL = Object.fromEntries(
  STATUS.map((item) => [item.value, item.label]),
);
const STATUS_STYLE: Record<string, string> = {
  paa_lager: "badge-soft badge-soft-green",
  udlaant: "badge-soft badge-soft-amber",
  bortkommet: "badge-soft badge-soft-red",
};
const HANDOVER_LABEL: Record<string, string> = {
  udlaan: "Udleveret",
  retur: "Taget retur",
  bortkommet: "Meldt bortkommet",
};

function dk(date?: string | null) {
  if (!date) return "—";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

export default function Noegler() {
  const { companyId, user, hasFeature, plan } = useAuth();
  const { toast } = useToast();
  const allowed = hasFeature("noegler");
  const canManage = ["leder", "holdleder", "platform_admin"].includes(
    user?.role ?? "",
  );
  const canDelete = ["leder", "platform_admin"].includes(user?.role ?? "");
  const { data: employees } = useEmployees(companyId);
  const { data: customers } = useCustomers(companyId);
  const [editorKey, setEditorKey] = useState<KeyRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [handoverKey, setHandoverKey] = useState<KeyRow | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [secretKey, setSecretKey] = useState<KeyRow | null>(null);
  const [secretInfo, setSecretInfo] = useState<SecretResponse | null>(null);

  const { data: keys, isLoading } = useQuery<KeyRow[]>({
    queryKey: ["/api/keys", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/keys")).json(),
    enabled: allowed,
  });
  const { data: handovers, isLoading: handoversLoading } = useQuery<
    KeyHandover[]
  >({
    queryKey: ["/api/keys/handovers", companyId, expandedId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/keys/${expandedId}/handovers`)).json(),
    enabled: allowed && expandedId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/keys", companyId] });
    queryClient.invalidateQueries({
      queryKey: ["/api/keys/handovers", companyId],
    });
  };
  const create = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      (await apiRequest("POST", "/api/keys", data)).json(),
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      setEditorKey(null);
      toast({ title: "Nøglen er oprettet" });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke gemme nøglen",
        description: error.message,
        variant: "destructive",
      }),
  });
  const update = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Record<string, unknown>;
    }) => (await apiRequest("PATCH", `/api/keys/${id}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      setEditorKey(null);
      toast({ title: "Nøglen er opdateret" });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke opdatere nøglen",
        description: error.message,
        variant: "destructive",
      }),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/keys/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Nøglen er slettet" });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke slette nøglen",
        description: error.message,
        variant: "destructive",
      }),
  });
  const handover = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Record<string, unknown>;
    }) => (await apiRequest("POST", `/api/keys/${id}/handover`, data)).json(),
    onSuccess: (_result, variables) => {
      invalidate();
      setHandoverKey(null);
      toast({
        title:
          variables.data.action === "bortkommet"
            ? "Nøglen er meldt bortkommet"
            : "Overdragelsen er registreret",
        description:
          variables.data.action === "bortkommet"
            ? "Låsen bør omlægges, og alarmkoden bør skiftes."
            : undefined,
        variant:
          variables.data.action === "bortkommet" ? "destructive" : undefined,
      });
    },
    onError: (error: any) =>
      toast({
        title: "Kunne ikke registrere overdragelsen",
        description: error.message,
        variant: "destructive",
      }),
  });
  const showSecret = useMutation({
    mutationFn: async (key: KeyRow) => ({
      key,
      result: (await (
        await apiRequest("GET", `/api/keys/${key.id}/secret`)
      ).json()) as SecretResponse,
    }),
    onSuccess: ({ key, result }) => {
      setSecretKey(key);
      setSecretInfo(result);
    },
    onError: (error: any) =>
      toast({
        title: "Koden kan ikke vises",
        description: error.message,
        variant: "destructive",
      }),
  });

  const employeeName = (id?: number | null) =>
    id
      ? (employees?.find((employee) => employee.id === id)?.name ??
        `Ansat #${id}`)
      : "—";
  const customerName = (id: number) =>
    customers?.find((customer) => customer.id === id)?.name ?? `Kunde #${id}`;
  const total = keys?.length ?? 0;
  const lent = (keys ?? []).filter((key) => key.status === "udlaant").length;
  const lost = (keys ?? []).filter((key) => key.status === "bortkommet").length;

  const closeSecret = (open: boolean) => {
    if (!open) {
      setSecretInfo(null);
      setSecretKey(null);
    }
  };

  if (!allowed) {
    return (
      <div className="p-3 md:p-4 max-w-2xl mx-auto">
        <div
          className="rounded-md border border-border/50 bg-card p-4 text-center space-y-2"
          data-testid="notice-feature-locked"
        >
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">
            Nøgler er ikke med i din pakke
          </h1>
          <p className="text-sm text-muted-foreground">
            Pakken {plan?.name ?? "din nuværende"} indeholder ikke nøgle- og
            alarmkodestyring. Opgradér på abonnementssiden for at få adgang.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto"
        data-testid="loading-keys"
      >
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-md" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <PageHeader
        eyebrow="Sikkerhed"
        title="Nøgler"
        description="Nøgleadministration"
        action={
          canManage ? (
            <Button
              data-testid="button-new-key"
              onClick={() => {
                setEditorKey(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ny nøgle
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          data-testid="card-text-keys-total"
          valueTestId="text-keys-total"
          icon={<Key className="w-5 h-5" />}
          value={total}
          label="Nøgler i alt"
          variant="primary"
        />
        <MetricCard
          data-testid="card-text-keys-lent"
          valueTestId="text-keys-lent"
          icon={<KeyRound className="w-5 h-5" />}
          value={lent}
          label="Udlånte"
          variant="amber"
        />
        <MetricCard
          data-testid="card-text-keys-lost"
          valueTestId="text-keys-lost"
          icon={<ShieldAlert className="w-5 h-5" />}
          value={lost}
          label="Bortkomne"
          variant="red"
        />
      </div>

      <SectionCard title="Nøgler og alarmkoder" icon={<Key className="w-4 h-4" />} noPadding>
      {(keys ?? []).length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border m-3 p-10 text-center"
          data-testid="empty-keys"
        >
          <KeyRound className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Der er endnu ingen nøgler eller koder registreret.
          </p>
          {canManage && (
            <Button
              size="sm"
              className="mt-3"
              data-testid="button-empty-new-key"
              onClick={() => {
                setEditorKey(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Opret den første
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {(keys ?? []).map((key) => {
            const expanded = expandedId === key.id;
            return (
              <div
                key={key.id}
                className="rounded-md border border-border/50 bg-card overflow-hidden"
                data-testid={`card-key-${key.id}`}
              >
                <div className="p-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-medium text-xs text-foreground truncate"
                        data-testid={`text-key-label-${key.id}`}
                      >
                        {key.label}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {TYPE_LABEL[key.keyType] ?? key.keyType}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[key.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS_LABEL[key.status] ?? key.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {customerName(key.customerId)} ·{" "}
                      {key.holderEmployeeId
                        ? `Hos ${employeeName(key.holderEmployeeId)}`
                        : "På lager"}
                      {key.accessNote ? ` · ${key.accessNote}` : ""}
                    </p>
                    {key.hasSecret && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Kode: {key.secretMask || "••••"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap">
                    {key.hasSecret && (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-view-key-secret-${key.id}`}
                        disabled={showSecret.isPending}
                        onClick={() => showSecret.mutate(key)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Vis kode
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-key-handover-${key.id}`}
                        onClick={() => setHandoverKey(key)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Udlever / Retur
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Redigér nøgle"
                        data-testid={`button-edit-key-${key.id}`}
                        onClick={() => {
                          setEditorKey(key);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Slet nøgle"
                        data-testid={`button-delete-key-${key.id}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(key.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={expanded ? "Skjul historik" : "Vis historik"}
                      data-testid={`button-toggle-key-history-${key.id}`}
                      onClick={() => setExpandedId(expanded ? null : key.id)}
                    >
                      {expanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <KeyHistory
                    handovers={handovers ?? []}
                    loading={handoversLoading}
                    employeeName={employeeName}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      </SectionCard>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditorKey(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editorKey ? "Redigér nøgle" : "Opret nøgle"}
            </DialogTitle>
          </DialogHeader>
          <KeyForm
            key={editorKey?.id ?? "new"}
            item={editorKey}
            customers={customers ?? []}
            pending={create.isPending || update.isPending}
            onSubmit={(data) =>
              editorKey
                ? update.mutate({ id: editorKey.id, data })
                : create.mutate(data)
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!handoverKey}
        onOpenChange={(open) => !open && setHandoverKey(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Udlever / retur · {handoverKey?.label}</DialogTitle>
          </DialogHeader>
          {handoverKey && (
            <HandoverForm
              key={handoverKey.id}
              employees={employees ?? []}
              pending={handover.isPending}
              onSubmit={(data) => handover.mutate({ id: handoverKey.id, data })}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!secretKey} onOpenChange={closeSecret}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kode til {secretKey?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3" data-testid="dialog-key-secret">
            {secretInfo?.advarsel && (
              <div
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-300"
                data-testid="notice-key-secret-warning"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {secretInfo.advarsel}
              </div>
            )}
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">Kode</p>
              <p
                className="text-lg font-bold tracking-widest text-foreground break-all"
                data-testid="text-key-secret"
              >
                {secretInfo?.secret || "Ingen kode gemt"}
              </p>
            </div>
            {secretInfo?.accessNote && (
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-xs font-medium text-foreground">
                  Adgangsnote
                </p>
                <p
                  className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap"
                  data-testid="text-key-secret-access-note"
                >
                  {secretInfo.accessNote}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 flex gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Dette opslag er blevet logget i revisionssporet.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  testId,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  testId: string;
  tone?: string;
}) {
  return (
    <div
      className="kpi-card"
      data-testid={`card-${testId}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${tone}`}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

function KeyHistory({
  handovers,
  loading,
  employeeName,
}: {
  handovers: KeyHandover[];
  loading: boolean;
  employeeName: (id?: number | null) => string;
}) {
  return (
          <div
      className="border-t border-border bg-muted/20 p-3"
      data-testid="section-key-history"
    >
      <h2 className="text-xs font-medium text-foreground mb-2">Historik</h2>
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : handovers.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Der er endnu ingen overdragelser registreret.
        </p>
      ) : (
        <div className="space-y-2">
          {handovers.map((row) => (
            <div
              key={row.id}
              className="text-[11px] text-muted-foreground rounded-md bg-card border border-border/60 p-2.5"
              data-testid={`row-key-handover-${row.id}`}
            >
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {HANDOVER_LABEL[row.action] ?? row.action}
                </span>
                <span>{dk(row.date)}</span>
              </div>
              <p className="mt-1">
                Fra: {employeeName(row.fromEmployeeId)} · Til:{" "}
                {employeeName(row.toEmployeeId)}
                {row.signedBy ? ` · Underskrevet af: ${row.signedBy}` : ""}
              </p>
              {row.note && <p className="mt-1 italic">{row.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyForm({
  item,
  customers,
  pending,
  onSubmit,
}: {
  item: KeyRow | null;
  customers: Customer[];
  pending: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [customerId, setCustomerId] = useState(
    String(item?.customerId ?? customers[0]?.id ?? ""),
  );
  const [label, setLabel] = useState(item?.label ?? "");
  const [keyType, setKeyType] = useState(item?.keyType ?? "noegle");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [accessNote, setAccessNote] = useState(item?.accessNote ?? "");
  const [status, setStatus] = useState(item?.status ?? "paa_lager");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerId) return setError("Vælg en kunde.");
    if (!label.trim()) return setError("Skriv et mærkat til nøglen.");
    setError(null);
    const data: Record<string, unknown> = {
      customerId: Number(customerId),
      label: label.trim(),
      keyType,
      accessNote: accessNote.trim() || null,
      status,
    };
    if (secret) data.secret = secret;
    onSubmit(data);
  };
  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label>Kunde</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger data-testid="select-key-customer">
            <SelectValue placeholder="Vælg kunde" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={String(customer.id)}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="key-label">Mærkat</Label>
        <Input
          id="key-label"
          data-testid="input-key-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Fx hovedindgang"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={keyType} onValueChange={setKeyType}>
          <SelectTrigger data-testid="select-key-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KEY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="key-secret">Kode</Label>
        <div className="flex gap-2">
          <Input
            id="key-secret"
            type={showSecret ? "text" : "password"}
            data-testid="input-key-secret"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={
              item?.hasSecret ? "Lad stå tom for at beholde koden" : "Valgfrit"
            }
          />
          <Button
            type="button"
            variant="outline"
            data-testid="button-toggle-key-secret"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? "Skjul" : "Vis"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Alarmkoder gemmes krypteret og kan kun ses af leder, holdleder og den,
          der har nøglen.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="key-note">Adgangsnote</Label>
        <Textarea
          id="key-note"
          data-testid="input-key-access-note"
          value={accessNote}
          onChange={(event) => setAccessNote(event.target.value)}
          rows={2}
          placeholder="Fx alarmen skal slås fra inden for 30 sekunder"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-key-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p
          className="text-xs text-destructive"
          data-testid="text-key-form-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        data-testid="button-save-key"
        disabled={pending}
      >
        {pending ? "Gemmer..." : item ? "Gem ændringer" : "Opret nøgle"}
      </Button>
    </form>
  );
}

function HandoverForm({
  employees,
  pending,
  onSubmit,
}: {
  employees: Employee[];
  pending: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [action, setAction] = useState("udlaan");
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.id ?? ""));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [signedBy, setSignedBy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (action === "udlaan" && !employeeId) return setError("Vælg en ansat.");
    setError(null);
    onSubmit({
      action,
      toEmployeeId: action === "udlaan" ? Number(employeeId) : null,
      date,
      signedBy: signedBy.trim() || null,
      note: note.trim() || null,
    });
  };
  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label>Handling</Label>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger data-testid="select-key-handover-action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="udlaan">Udlever til ansat</SelectItem>
            <SelectItem value="retur">Taget retur</SelectItem>
            <SelectItem value="bortkommet">Meld bortkommet</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {action === "udlaan" && (
        <div className="space-y-1.5">
          <Label>Ansat</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger data-testid="select-key-handover-employee">
              <SelectValue placeholder="Vælg ansat" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={String(employee.id)}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {action === "bortkommet" && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
          data-testid="notice-key-lost"
        >
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Låsen bør omlægges, og alarmkoden bør skiftes.
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="handover-date">Dato</Label>
        <Input
          id="handover-date"
          type="date"
          data-testid="input-key-handover-date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="handover-signed">Underskrevet af</Label>
        <Input
          id="handover-signed"
          data-testid="input-key-handover-signed-by"
          value={signedBy}
          onChange={(event) => setSignedBy(event.target.value)}
          placeholder="Navn på den, der kvitterer"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="handover-note">Note</Label>
        <Textarea
          id="handover-note"
          data-testid="input-key-handover-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Valgfrit"
        />
      </div>
      {error && (
        <p
          className="text-xs text-destructive"
          data-testid="text-key-handover-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        data-testid="button-save-key-handover"
        disabled={pending}
      >
        {pending ? "Gemmer..." : "Registrér handling"}
      </Button>
    </form>
  );
}

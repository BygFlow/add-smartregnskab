import { useState, useMemo, useEffect } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, MetricCard, SectionCard, StatusChip } from "@/components/premium";
import { Plus, Trash2, ShieldCheck, MessageSquare, FileText, CheckCircle2, Calendar } from "lucide-react";

/* ---------- hjælpere ---------- */

function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- labels & badges ---------- */

const TYPE_LABEL: Record<string, string> = {
  bilagsanmodning: "Bilagsanmodning",
  kommentar: "Kommentar",
  godkendelse: "Godkendelse",
  arbejdsprogram: "Arbejdsprogram",
};
const TYPE_ICON: Record<string, typeof FileText> = {
  bilagsanmodning: FileText,
  kommentar: MessageSquare,
  godkendelse: CheckCircle2,
  arbejdsprogram: ShieldCheck,
};
const STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  afventer: "amber",
  besvaret: "blue",
  lukket: "green",
};
const STATUS_LABEL: Record<string, string> = {
  afventer: "Afventer",
  besvaret: "Besvaret",
  lukket: "Lukket",
};

const REQUEST_TYPES = ["bilagsanmodning", "kommentar", "godkendelse", "arbejdsprogram"] as const;

/* ---------- typer ---------- */

type AuditorRequest = {
  id: number;
  auditorName: string;
  requestType: string;
  description?: string | null;
  status: string;
  response?: string | null;
  dueDate?: string | null;
};

/* ---------- komponent ---------- */

export default function Revisorportal({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [respondItem, setRespondItem] = useState<AuditorRequest | null>(null);

  const queryKey = useMemo(
    () => ["/api/auditor-portal", companyId] as const,
    [companyId],
  );

  const { data, isLoading } = useQuery<AuditorRequest[]>({
    queryKey,
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/auditor-portal?companyId=${companyId}`)
      ).json(),
  });

  const items = data ?? [];
  const open = items.filter((i) => i.status === "afventer").length;
  const overdue = items.filter(
    (i) => i.status === "afventer" && i.dueDate && i.dueDate.slice(0, 10) < today(),
  ).length;

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest("POST", `/api/auditor-portal?companyId=${companyId}`, body)
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Anmodning oprettet", description: "Revisor er notifieret." });
      setCreateOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) =>
      (
        await apiRequest("PATCH", `/api/auditor-portal/${id}?companyId=${companyId}`, body)
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Opdateret" });
    },
    onError: (e: Error) =>
      toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/auditor-portal/${id}?companyId=${companyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Anmodning slettet" });
    },
    onError: (e: Error) =>
      toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Revisorportal (beta)"
        description="Sikker kommunikation og dokumentudveksling med revisor."
        action={
          <Button data-testid="create-request-btn" onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Opret anmodning
          </Button>
        }
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        Beta: Revisorportalet er under aktiv udvikling. Funktioner kan ændres.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
        <MetricCard
          icon={<ShieldCheck className="w-4 h-4" />}
          value={items.length}
          label="Anmodninger i alt"
          variant="primary"
        />
        <MetricCard
          icon={<MessageSquare className="w-4 h-4" />}
          value={open}
          label="Afventer svar"
          variant="amber"
        />
        <MetricCard
          icon={<Calendar className="w-4 h-4" />}
          value={overdue}
          label="Over forfald"
          variant="red"
        />
      </div>

      <SectionCard
        title="Anmodninger"
        icon={<ShieldCheck className="w-4 h-4" />}
        noPadding
      >
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Ingen anmodninger endnu. Tryk “Opret anmodning” for at starte dialogen med revisor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Revisor</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Beskrivelse</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Svar</th>
                  <th className="px-3 py-2 font-medium">Forfald</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((req) => {
                  const Icon = TYPE_ICON[req.requestType] ?? FileText;
                  return (
                    <tr key={req.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{req.auditorName}</td>
                      <td className="px-3 py-2">
                        <span
                          data-testid={`type-${req.id}`}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted text-foreground"
                        >
                          <Icon className="w-3 h-3" />
                          {TYPE_LABEL[req.requestType] ?? req.requestType}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[18rem] truncate text-muted-foreground">
                        {req.description || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusChip
                          data-testid={`status-${req.id}`}
                          status={STATUS_LABEL[req.status] ?? req.status}
                          variant={STATUS_VARIANT[req.status] ?? "gray"}
                        />
                      </td>
                      <td className="px-3 py-2 max-w-[16rem] truncate text-muted-foreground">
                        {req.response || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {dk(req.dueDate)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            data-testid={`respond-btn-${req.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => setRespondItem(req)}
                            disabled={req.status === "lukket"}
                          >
                            Besvar
                          </Button>
                          <Button
                            data-testid={`close-btn-${req.id}`}
                            variant="ghost"
                            size="sm"
                            disabled={req.status === "lukket"}
                            onClick={() =>
                              updateMutation.mutate({
                                id: req.id,
                                body: { status: "lukket" },
                              })
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            data-testid={`delete-btn-${req.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(req.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <CreateDialog
        key="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(body) => createMutation.mutate(body)}
        pending={createMutation.isPending}
      />

      <RespondDialog
        key={respondItem ? `respond-${respondItem.id}` : "respond-none"}
        item={respondItem}
        onOpenChange={(o) => !o && setRespondItem(null)}
        onSubmit={(response) =>
          respondItem &&
          updateMutation.mutate({
            id: respondItem.id,
            body: { response, status: "besvaret" },
          })
        }
        pending={updateMutation.isPending}
      />
    </div>
  );
}

/* ---------- opret-dialog ---------- */

function CreateDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: unknown) => void;
  pending: boolean;
}) {
  const [auditorName, setAuditorName] = useState("");
  const [requestType, setRequestType] = useState<string>("bilagsanmodning");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setAuditorName("");
    setRequestType("bilagsanmodning");
    setDescription("");
    setDueDate("");
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      auditorName: auditorName.trim(),
      requestType,
      description: description.trim() || null,
      status: "afventer",
      response: null,
      dueDate: dueDate || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret anmodning</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aud-name">Revisor / revisionsfirma</Label>
            <Input
              id="aud-name"
              data-testid="input-auditorName"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              placeholder="F.eks. Statsautoriseret Revisionsfirma A/S"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger data-testid="input-requestType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aud-due">Forfaldsdato</Label>
              <Input
                id="aud-due"
                data-testid="input-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-desc">Beskrivelse</Label>
            <Textarea
              id="aud-desc"
              data-testid="input-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beskriv hvad revisor skal bruge…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="cancel-btn"
            >
              Annuller
            </Button>
            <Button type="submit" disabled={pending} data-testid="save-btn">
              {pending ? "Opretter…" : "Opret anmodning"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- besvar-dialog ---------- */

function RespondDialog({
  item,
  onOpenChange,
  onSubmit,
  pending,
}: {
  item: AuditorRequest | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (response: string) => void;
  pending: boolean;
}) {
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (item) setResponse(item.response ?? "");
  }, [item]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(response.trim());
  }

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Besvar anmodning</DialogTitle>
        </DialogHeader>
        {item && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p><span className="font-medium text-foreground">{item.auditorName}</span> — {TYPE_LABEL[item.requestType] ?? item.requestType}</p>
              {item.description && <p>{item.description}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resp-text">Svar / bilagshenvisning</Label>
              <Textarea
                id="resp-text"
                data-testid="input-response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                data-testid="cancel-respond-btn"
              >
                Annuller
              </Button>
              <Button type="submit" disabled={pending} data-testid="submit-respond-btn">
                {pending ? "Gemmer…" : "Send svar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

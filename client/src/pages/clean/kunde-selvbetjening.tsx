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
  MessageSquare,
  PlusCircle,
  FileCheck,
  AlertCircle,
  FileText,
  FileBadge,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type RequestType =
  | "ekstra_arbejde"
  | "tilbud_godkendelse"
  | "reklamation"
  | "rapport"
  | "dokument";
type RequestStatus = "modtaget" | "under_behandling" | "besvaret" | "lukket";

interface SelfServiceRequest {
  id: number;
  companyId: number;
  customerName: string;
  requestType: RequestType | string;
  title: string;
  description?: string | null;
  preferredDate?: string | null;
  status: RequestStatus | string;
  response?: string | null;
  createdAt?: string | null;
}

const REQUEST_TYPE_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  ekstra_arbejde: {
    label: "Ekstra arbejde",
    className: "badge-soft badge-soft-blue",
    icon: <PlusCircle className="w-3 h-3" />,
  },
  tilbud_godkendelse: {
    label: "Tilbudsgodkendelse",
    className: "badge-soft badge-soft-green",
    icon: <FileCheck className="w-3 h-3" />,
  },
  reklamation: {
    label: "Reklamation",
    className: "badge-soft badge-soft-red",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  rapport: {
    label: "Rapport",
    className: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 badge-soft",
    icon: <FileText className="w-3 h-3" />,
  },
  dokument: {
    label: "Dokument",
    className: "badge-soft badge-soft-gray",
    icon: <FileBadge className="w-3 h-3" />,
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  modtaget: {
    label: "Modtaget",
    className: "badge-soft badge-soft-blue",
    icon: <Clock className="w-3 h-3" />,
  },
  under_behandling: {
    label: "Under behandling",
    className: "badge-soft badge-soft-amber",
    icon: <Clock className="w-3 h-3" />,
  },
  besvaret: {
    label: "Besvaret",
    className: "badge-soft badge-soft-green",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  lukket: {
    label: "Lukket",
    className: "badge-soft badge-soft-gray",
    icon: <XCircle className="w-3 h-3" />,
  },
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

export default function KundeSelvbetjening({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [respondTarget, setRespondTarget] = useState<SelfServiceRequest | null>(null);

  const { data: requests, isLoading } = useQuery<SelfServiceRequest[]>({
    queryKey: ["/api/customer-self-service", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/customer-self-service?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/customer-self-service"] });

  const updateRequest = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customer-self-service/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setRespondTarget(null);
      toast({ title: "Anmodning besvaret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke besvare anmodning",
        description: e.message,
        variant: "destructive",
      }),
  });

  const createRequest = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/customer-self-service?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Anmodning oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette anmodning",
        description: e.message,
        variant: "destructive",
      }),
  });

  const pendingCount = useMemo(
    () =>
      (requests ?? []).filter(
        (r) => r.status === "modtaget" || r.status === "under_behandling"
      ).length,
    [requests]
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-self-service">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = requests ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />Kunde-selvbetjening
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Håndtering af anmodninger indsendt af kunder via selvbetjeningsportalen
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground">Ventende anmodninger</p>
          <p className="text-2xl font-bold mt-1" data-testid="pending-count">
            {pendingCount}
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground">Samlede anmodninger</p>
          <p className="text-2xl font-bold mt-1" data-testid="total-count">
            {list.length}
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground">Besvaret / lukket</p>
          <p className="text-2xl font-bold mt-1" data-testid="answered-count">
            {list.filter((r) => r.status === "besvaret" || r.status === "lukket").length}
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-border p-10 text-center"
          data-testid="empty-self-service"
        >
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen anmodninger endnu</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-self-service">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Anmodningstype</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Ønsket dato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Oprettet</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((req) => {
                const type = REQUEST_TYPE_CONFIG[req.requestType as string] ?? {
                  label: req.requestType,
                  className: "badge-soft badge-soft-gray",
                  icon: <FileText className="w-3 h-3" />,
                };
                const status = STATUS_CONFIG[req.status as string] ?? {
                  label: req.status,
                  className: "badge-soft badge-soft-gray",
                  icon: <Clock className="w-3 h-3" />,
                };
                return (
                  <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                    <TableCell className="font-medium">{req.customerName}</TableCell>
                    <TableCell>
                      <span
                        className={type.className}
                        data-testid={`badge-request-type-${req.id}`}
                      >
                        {type.icon}
                        {type.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.title}
                      {req.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {req.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dk(req.preferredDate)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={status.className}
                        data-testid={`badge-request-status-${req.id}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dk(req.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-respond-${req.id}`}
                        disabled={
                          req.status === "besvaret" || req.status === "lukket"
                        }
                        onClick={() => setRespondTarget(req)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {req.response ? "Opdatér svar" : "Besvar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!respondTarget} onOpenChange={(o) => !o && setRespondTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Besvar anmodning</DialogTitle>
          </DialogHeader>
          {respondTarget && (
            <ResponseForm
              key={respondTarget.id}
              request={respondTarget}
              pending={updateRequest.isPending}
              onSubmit={async (data) => {
                await updateRequest.mutateAsync({ id: respondTarget.id, data });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResponseForm({
  request,
  pending,
  onSubmit,
}: {
  request: SelfServiceRequest;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [response, setResponse] = useState(request.response ?? "");
  const [status, setStatus] = useState<RequestStatus>(
    request.response ? ((request.status as RequestStatus) ?? "besvaret") : "besvaret"
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      response: response || null,
      status,
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const type = REQUEST_TYPE_CONFIG[request.requestType as string] ?? {
    label: request.requestType,
    className: "badge-soft badge-soft-gray",
    icon: <FileText className="w-3 h-3" />,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={type.className}>
            {type.icon}
            {type.label}
          </span>
          <span className="text-sm font-medium">{request.title}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Kunde: {request.customerName}
          {request.preferredDate && ` · Ønsket dato: ${dk(request.preferredDate)}`}
        </p>
        {request.description && (
          <p className="text-xs text-foreground mt-1">{request.description}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resp-status">Sæt status</Label>
        <select
          id="resp-status"
          data-testid="input-response-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as RequestStatus)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="under_behandling">Under behandling</option>
          <option value="besvaret">Besvaret</option>
          <option value="lukket">Lukket</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resp-text">Svar til kunde *</Label>
        <Textarea
          id="resp-text"
          data-testid="input-response-text"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={5}
          placeholder="Skriv dit svar til kunden..."
          required
        />
      </div>

      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-send-response"
        >
          {submitting || pending ? "Sender..." : "Send svar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

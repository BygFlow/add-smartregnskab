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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Reply,
  Mail,
  AlertCircle,
  FileText,
  Edit3,
  Wrench,
} from "lucide-react";

type RequestPriority = "normal" | "hoj" | "kritisk";
type RequestType = "forespørgsel" | "klage" | "ændring" | "ekstra_arbejde";

interface CustomerRequest {
  id: number;
  companyId: number;
  customerName: string;
  type: RequestType | string;
  subject: string;
  priority: RequestPriority | string;
  status: string;
  response?: string | null;
  createdAt?: string | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  normal: "badge-soft badge-soft-blue",
  hoj: "badge-soft badge-soft-amber",
  kritisk: "badge-soft badge-soft-red",
};
const PRIORITY_LABEL: Record<string, string> = {
  normal: "Normal",
  hoj: "Høj",
  kritisk: "Kritisk",
};

const TYPE_STYLE: Record<string, string> = {
  forespørgsel: "badge-soft badge-soft-blue",
  klage: "badge-soft badge-soft-red",
  ændring: "badge-soft badge-soft-amber",
  ekstra_arbejde: "badge-soft badge-soft-green",
};
const TYPE_LABEL: Record<string, string> = {
  forespørgsel: "Forespørgsel",
  klage: "Klage",
  ændring: "Ændring",
  ekstra_arbejde: "Ekstra arbejde",
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  forespørgsel: <Mail className="w-3 h-3" />,
  klage: <AlertCircle className="w-3 h-3" />,
  ændring: <Edit3 className="w-3 h-3" />,
  ekstra_arbejde: <Wrench className="w-3 h-3" />,
};

const STATUS_STYLE: Record<string, string> = {
  aaben: "badge-soft badge-soft-amber",
  besvaret: "badge-soft badge-soft-green",
  lukket: "badge-soft badge-soft-gray",
};
const STATUS_LABEL: Record<string, string> = {
  aaben: "Åben",
  besvaret: "Besvaret",
  lukket: "Lukket",
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function KundeportalAdmin({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState<CustomerRequest | null>(null);

  const { data: requests, isLoading } = useQuery<CustomerRequest[]>({
    queryKey: ["/api/customer-requests", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/customer-requests?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/customer-requests"] });

  const createRequest = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/customer-requests?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Forespørgsel oprettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette forespørgsel",
        description: e.message,
        variant: "destructive",
      }),
  });

  const respondRequest = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customer-requests/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setRespondingTo(null);
      toast({ title: "Svar sendt" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke besvare forespørgsel",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-customer-requests">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = requests ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kundeportal (admin)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Håndtér kundernes forespørgsler, klager og ændringer
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-request" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Ny forespørgsel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ny kundeforespørgsel</DialogTitle>
            </DialogHeader>
            <RequestForm
              pending={createRequest.isPending}
              onSubmit={async (data) => {
                await createRequest.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground" data-testid="empty-customer-requests">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Ingen forespørgsler endnu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[1000px] text-sm" data-testid="table-customer-requests">
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Emne</TableHead>
                  <TableHead>Prioritet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="text-right pr-2">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((req) => (
                  <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                    <TableCell className="p-3 font-medium">{req.customerName}</TableCell>
                    <TableCell className="p-3">
                      <span
                        className={TYPE_STYLE[req.type as string] ?? "badge-soft badge-soft-gray"}
                        data-testid={`badge-request-type-${req.id}`}
                      >
                        {TYPE_ICON[req.type as string]}
                        {TYPE_LABEL[req.type as string] ?? req.type}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 text-muted-foreground max-w-xs truncate" title={req.subject}>
                      {req.subject}
                    </TableCell>
                    <TableCell className="p-3">
                      <span
                        className={PRIORITY_STYLE[req.priority as string] ?? "badge-soft badge-soft-gray"}
                        data-testid={`badge-request-priority-${req.id}`}
                      >
                        {PRIORITY_LABEL[req.priority as string] ?? req.priority}
                      </span>
                    </TableCell>
                    <TableCell className="p-3">
                      <span
                        className={STATUS_STYLE[req.status as string] ?? "badge-soft badge-soft-gray"}
                        data-testid={`badge-request-status-${req.id}`}
                      >
                        {STATUS_LABEL[req.status as string] ?? req.status}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 text-muted-foreground tabular-nums">{dk(req.createdAt)}</TableCell>
                    <TableCell className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-respond-request-${req.id}`}
                        onClick={() => setRespondingTo(req)}
                      >
                        <Reply className="w-3.5 h-3.5 mr-1" />Besvar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RespondDialog
        request={respondingTo}
        pending={respondRequest.isPending}
        onClose={() => setRespondingTo(null)}
        onSubmit={async (response) => {
          if (!respondingTo) return;
          await respondRequest.mutateAsync({
            id: respondingTo.id,
            data: { response, status: "besvaret" },
          });
        }}
      />
    </div>
  );
}

function RespondDialog({
  request,
  pending,
  onClose,
  onSubmit,
}: {
  request: CustomerRequest | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (response: string) => Promise<void>;
}) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    setSubmitting(true);
    try {
      await onSubmit(response);
      setResponse("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!request}
      onOpenChange={(o) => {
        if (!o) {
          setResponse("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Besvar forespørgsel</DialogTitle>
        </DialogHeader>
        {request && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{request.subject}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fra: {request.customerName} · {TYPE_LABEL[request.type as string] ?? request.type}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-response">Svar *</Label>
              <Textarea
                id="request-response"
                data-testid="input-request-response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Skriv dit svar til kunden..."
                rows={5}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-response"
              >
                Annullér
              </Button>
              <Button
                type="submit"
                disabled={submitting || pending}
                data-testid="button-send-response"
              >
                {submitting || pending ? "Sender..." : "Send svar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState({
    customerName: "",
    type: "forespørgsel" as RequestType,
    subject: "",
    priority: "normal" as RequestPriority,
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      status: "aaben",
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
        <Label htmlFor="request-customer">Kundenavn *</Label>
        <Input
          id="request-customer"
          data-testid="input-request-customer"
          value={form.customerName}
          onChange={(e) => set("customerName", e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger data-testid="select-request-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forespørgsel">Forespørgsel</SelectItem>
              <SelectItem value="klage">Klage</SelectItem>
              <SelectItem value="ændring">Ændring</SelectItem>
              <SelectItem value="ekstra_arbejde">Ekstra arbejde</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioritet</Label>
          <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger data-testid="select-request-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="hoj">Høj</SelectItem>
              <SelectItem value="kritisk">Kritisk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="request-subject">Emne *</Label>
        <Input
          id="request-subject"
          data-testid="input-request-subject"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-request"
        >
          {submitting || pending ? "Gemmer..." : "Gem forespørgsel"}
        </Button>
      </DialogFooter>
    </form>
  );
}

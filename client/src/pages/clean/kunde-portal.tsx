import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Home,
  ClipboardList,
  CalendarClock,
  FileCheck2,
  Receipt,
  FolderOpen,
  Wrench,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Download,
  MapPin,
} from "lucide-react";

/* ---------- typer ---------- */

interface PortalTask {
  id: number;
  companyId: number;
  title: string;
  customerId?: number | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  priority?: string;
  description?: string | null;
}

interface Vagt {
  id: number;
  companyId: number;
  customerId?: number | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  title?: string | null;
  location?: string | null;
  status?: string | null;
}

interface Tilbud {
  id: number;
  companyId: number;
  customerId?: number | null;
  title?: string | null;
  amount?: number | null;
  status: string;
  createdAt?: string | null;
}

interface Invoice {
  id: number;
  companyId: number;
  customerId?: number | null;
  invoiceNumber?: string | null;
  amount?: number | null;
  totalAmount?: number | null;
  status?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
}

interface PortalDocument {
  id: number;
  companyId: number;
  customerId?: number | null;
  title?: string | null;
  name?: string | null;
  fileUrl?: string | null;
  createdAt?: string | null;
}

interface SelfServiceRequest {
  id: number;
  companyId: number;
  customerName: string;
  requestType: string;
  title: string;
  description?: string | null;
  preferredDate?: string | null;
  status: string;
  response?: string | null;
  createdAt?: string | null;
}

const TASK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planlagt: { label: "Planlagt", className: "badge-soft badge-soft-blue" },
  igang: { label: "I gang", className: "badge-soft badge-soft-amber" },
  "færdig": { label: "Færdig", className: "badge-soft badge-soft-green" },
  aflyst: { label: "Aflyst", className: "badge-soft badge-soft-gray" },
};

const TILBUD_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  afventer: { label: "Afventer godkendelse", className: "badge-soft badge-soft-amber" },
  sendt: { label: "Afventer godkendelse", className: "badge-soft badge-soft-amber" },
  godkendt: { label: "Godkendt", className: "badge-soft badge-soft-green" },
  afvist: { label: "Afvist", className: "badge-soft badge-soft-red" },
};

const INVOICE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  betalt: { label: "Betalt", className: "badge-soft badge-soft-green" },
  afventer: { label: "Afventer betaling", className: "badge-soft badge-soft-amber" },
  forfalden: { label: "Forfalden", className: "badge-soft badge-soft-red" },
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const s = date.slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

function kr(amount?: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(
    amount
  );
}

function isPendingOffer(status: string): boolean {
  return status === "afventer" || status === "sendt" || status === "modtaget" || status === "under_behandling";
}

/* ---------- komponent ---------- */

export default function KundePortal({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const customerId = user?.customerId ?? undefined;
  const customerName = user?.name || "Kunde";

  const [extraOpen, setExtraOpen] = useState(false);
  const [reklamationOpen, setReklamationOpen] = useState(false);

  const { data: tasks, isLoading: tasksLoading } = useQuery<PortalTask[]>({
    queryKey: ["/api/tasks", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/tasks?companyId=${companyId}`)).json(),
  });

  const { data: vagtplan, isLoading: vagtplanLoading } = useQuery<Vagt[]>({
    queryKey: ["/api/vagtplan", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/vagtplan?companyId=${companyId}`)).json(),
  });

  const { data: tilbud, isLoading: tilbudLoading } = useQuery<Tilbud[]>({
    queryKey: ["/api/tilbud", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/tilbud?companyId=${companyId}`)).json(),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/invoices?companyId=${companyId}`)).json(),
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<PortalDocument[]>({
    queryKey: ["/api/portal-documents", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/portal-documents?companyId=${companyId}`)).json(),
  });

  const { data: selfServiceRequests } = useQuery<SelfServiceRequest[]>({
    queryKey: ["/api/customer-self-service", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customer-self-service?companyId=${companyId}`)).json(),
  });

  const invalidateSelfService = () =>
    qc.invalidateQueries({ queryKey: ["/api/customer-self-service"] });

  const createSelfServiceRequest = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/customer-self-service?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidateSelfService();
      setExtraOpen(false);
      setReklamationOpen(false);
      toast({ title: "Anmodning sendt" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke sende anmodning", description: e.message, variant: "destructive" }),
  });

  const respondOffer = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/customer-self-service/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidateSelfService();
      qc.invalidateQueries({ queryKey: ["/api/tilbud"] });
      toast({ title: "Tilbud besvaret" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke besvare tilbud", description: e.message, variant: "destructive" }),
  });

  const myTasks = useMemo(() => {
    const list = tasks ?? [];
    if (customerId == null) return list;
    return list.filter((t) => t.customerId === customerId);
  }, [tasks, customerId]);

  const upcomingVisits = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const list = (vagtplan ?? []).filter((v) => (customerId == null ? true : v.customerId === customerId));
    return list
      .filter((v) => v.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [vagtplan, customerId]);

  const myTilbud = useMemo(() => {
    const list = tilbud ?? [];
    return customerId == null ? list : list.filter((t) => t.customerId === customerId);
  }, [tilbud, customerId]);

  const pendingTilbud = useMemo(
    () => myTilbud.filter((t) => isPendingOffer(t.status)),
    [myTilbud]
  );

  const myInvoices = useMemo(() => {
    const list = invoices ?? [];
    return customerId == null ? list : list.filter((i) => i.customerId === customerId);
  }, [invoices, customerId]);

  const myDocuments = useMemo(() => {
    const list = documents ?? [];
    return customerId == null ? list : list.filter((d) => d.customerId === customerId);
  }, [documents, customerId]);

  const pendingSelfServiceOffers = useMemo(
    () =>
      (selfServiceRequests ?? []).filter(
        (r) => r.requestType === "tilbud_godkendelse" && (r.status === "modtaget" || r.status === "under_behandling")
      ),
    [selfServiceRequests]
  );

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-6xl mx-auto pb-24" data-testid="page-kunde-portal">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-welcome-heading">
          <Home className="w-5 h-5" />
          Velkommen, {customerName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-welcome-subtitle">
          Din personlige kundeportal
        </p>
      </div>

      <div
        className="rounded-md border border-border/70 bg-card p-3 flex items-start gap-2 text-sm"
        data-testid="info-banner-kunde-portal"
      >
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          Velkommen til kundeportalen. Her kan du se dine opgaver, godkende tilbud og anmode om ekstra arbejde.
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-open-ekstra-arbejde" onClick={() => setExtraOpen(true)}>
              <Wrench className="w-4 h-4 mr-1.5" />
              Anmod om ekstra arbejde
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Anmod om ekstra arbejde</DialogTitle>
            </DialogHeader>
            <SelfServiceForm
              requestType="ekstra_arbejde"
              customerName={customerName}
              pending={createSelfServiceRequest.isPending}
              onSubmit={async (data) => {
                await createSelfServiceRequest.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={reklamationOpen} onOpenChange={setReklamationOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              data-testid="button-open-reklamation"
              onClick={() => setReklamationOpen(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Reklamation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Indsend reklamation</DialogTitle>
            </DialogHeader>
            <SelfServiceForm
              requestType="reklamation"
              customerName={customerName}
              pending={createSelfServiceRequest.isPending}
              onSubmit={async (data) => {
                await createSelfServiceRequest.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Godkend tilbud */}
      <Card data-testid="card-godkend-tilbud">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" />
            Godkend tilbud
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tilbudLoading ? (
            <Skeleton className="h-16 rounded-md" />
          ) : pendingTilbud.length === 0 && pendingSelfServiceOffers.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-godkend-tilbud">
              Ingen tilbud afventer din godkendelse
            </p>
          ) : (
            <div className="space-y-2">
              {pendingTilbud.map((t) => (
                <div
                  key={`tilbud-${t.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3 flex-wrap"
                  data-testid={`row-pending-tilbud-${t.id}`}
                >
                  <div>
                    <p className="text-sm font-medium">{t.title || `Tilbud #${t.id}`}</p>
                    <p className="text-xs text-muted-foreground">{kr(t.amount)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      data-testid={`button-approve-tilbud-${t.id}`}
                      onClick={() =>
                        respondOffer.mutate({
                          id: t.id,
                          data: { status: "besvaret", response: "godkendt" },
                        })
                      }
                      disabled={respondOffer.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Godkend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-reject-tilbud-${t.id}`}
                      onClick={() =>
                        respondOffer.mutate({
                          id: t.id,
                          data: { status: "besvaret", response: "afvist" },
                        })
                      }
                      disabled={respondOffer.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Afvis
                    </Button>
                  </div>
                </div>
              ))}
              {pendingSelfServiceOffers.map((r) => (
                <div
                  key={`self-${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3 flex-wrap"
                  data-testid={`row-pending-offer-${r.id}`}
                >
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground max-w-xs truncate">{r.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      data-testid={`button-approve-offer-${r.id}`}
                      onClick={() =>
                        respondOffer.mutate({ id: r.id, data: { status: "besvaret", response: "godkendt" } })
                      }
                      disabled={respondOffer.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Godkend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-reject-offer-${r.id}`}
                      onClick={() =>
                        respondOffer.mutate({ id: r.id, data: { status: "besvaret", response: "afvist" } })
                      }
                      disabled={respondOffer.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Afvis
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mine opgaver */}
        <Card data-testid="card-mine-opgaver">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Mine opgaver
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <Skeleton className="h-24 rounded-md" />
            ) : myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="empty-mine-opgaver">
                Ingen opgaver registreret
              </p>
            ) : (
              <ul className="space-y-2" data-testid="list-mine-opgaver">
                {myTasks.slice(0, 8).map((t) => {
                  const status = TASK_STATUS_CONFIG[t.status] ?? {
                    label: t.status,
                    className: "badge-soft badge-soft-gray",
                  };
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 text-sm"
                      data-testid={`row-opgave-${t.id}`}
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{dk(t.date)}</span>
                        <span className={status.className}>{status.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Kommende besøg */}
        <Card data-testid="card-kommende-besog">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Kommende besøg
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vagtplanLoading ? (
              <Skeleton className="h-24 rounded-md" />
            ) : upcomingVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="empty-kommende-besog">
                Ingen planlagte besøg
              </p>
            ) : (
              <ul className="space-y-2" data-testid="list-kommende-besog">
                {upcomingVisits.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`row-besog-${v.id}`}>
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {v.title || v.location || "Rengøringsbesøg"}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {dk(v.date)}
                      {v.startTime ? ` · ${v.startTime}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Mine tilbud */}
        <Card data-testid="card-mine-tilbud">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" />
              Mine tilbud
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tilbudLoading ? (
              <Skeleton className="h-24 rounded-md" />
            ) : myTilbud.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="empty-mine-tilbud">
                Ingen tilbud endnu
              </p>
            ) : (
              <ul className="space-y-2" data-testid="list-mine-tilbud">
                {myTilbud.slice(0, 8).map((t) => {
                  const status = TILBUD_STATUS_CONFIG[t.status] ?? {
                    label: t.status,
                    className: "badge-soft badge-soft-gray",
                  };
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 text-sm"
                      data-testid={`row-tilbud-${t.id}`}
                    >
                      <span className="truncate">{t.title || `Tilbud #${t.id}`}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{kr(t.amount)}</span>
                        <span className={status.className}>{status.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Fakturaer */}
        <Card data-testid="card-fakturaer">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Fakturaer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <Skeleton className="h-24 rounded-md" />
            ) : myInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="empty-fakturaer">
                Ingen fakturaer endnu
              </p>
            ) : (
              <ul className="space-y-2" data-testid="list-fakturaer">
                {myInvoices.slice(0, 8).map((inv) => {
                  const status = INVOICE_STATUS_CONFIG[inv.status ?? ""] ?? {
                    label: inv.status || "Ukendt",
                    className: "badge-soft badge-soft-gray",
                  };
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-2 text-sm"
                      data-testid={`row-faktura-${inv.id}`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {inv.invoiceNumber || `Faktura #${inv.id}`}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {kr(inv.totalAmount ?? inv.amount)}
                        </span>
                        <span className={status.className}>{status.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dokumenter */}
      <Card data-testid="card-dokumenter">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Dokumenter
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentsLoading ? (
            <Skeleton className="h-20 rounded-md" />
          ) : myDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-dokumenter">
              Ingen dokumenter delt med dig endnu
            </p>
          ) : (
            <ul className="space-y-2" data-testid="list-dokumenter">
              {myDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-2 text-sm"
                  data-testid={`row-dokument-${doc.id}`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {doc.title || doc.name || `Dokument #${doc.id}`}
                  </span>
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary flex items-center gap-1 shrink-0"
                      data-testid={`link-download-dokument-${doc.id}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">{dk(doc.createdAt)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- selvbetjenings-formular ---------- */

function SelfServiceForm({
  requestType,
  customerName,
  pending,
  onSubmit,
}: {
  requestType: "ekstra_arbejde" | "reklamation";
  customerName: string;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      customerName,
      requestType,
      title,
      description: description || null,
      preferredDate: preferredDate || null,
      status: "modtaget",
    };
    try {
      await onSubmit(payload);
      setTitle("");
      setDescription("");
      setPreferredDate("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="self-service-title">Titel *</Label>
        <Input
          id="self-service-title"
          data-testid="input-self-service-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={requestType === "ekstra_arbejde" ? "F.eks. Ekstra vinduespudsning" : "F.eks. Mangelfuld rengøring"}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="self-service-description">Beskrivelse</Label>
        <Textarea
          id="self-service-description"
          data-testid="input-self-service-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Beskriv din anmodning..."
        />
      </div>
      {requestType === "ekstra_arbejde" && (
        <div className="space-y-1.5">
          <Label htmlFor="self-service-date">Ønsket dato</Label>
          <Input
            id="self-service-date"
            data-testid="input-self-service-date"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
          />
        </div>
      )}
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-submit-self-service">
          {submitting || pending ? "Sender..." : "Send anmodning"}
        </Button>
      </DialogFooter>
    </form>
  );
}

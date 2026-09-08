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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, FileSignature, PenTool, Send } from "lucide-react";

type DocumentType =
  | "tilbud"
  | "kontrakt"
  | "apv"
  | "medarbejderkontrakt"
  | "kundegodkendelse";

type EsignStatus = "afventer" | "underskrevet" | "afvist" | "udløbet";

interface Esignature {
  id: number;
  companyId: number;
  documentType: DocumentType;
  documentTitle: string;
  signerName?: string | null;
  signerEmail?: string | null;
  status: EsignStatus;
  signedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  tilbud: "Tilbud",
  kontrakt: "Kontrakt",
  apv: "APV",
  medarbejderkontrakt: "Medarbejderkontrakt",
  kundegodkendelse: "Kundegodkendelse",
};

const DOC_TYPE_CLASSES: Record<DocumentType, string> = {
  tilbud: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  kontrakt: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  apv: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  medarbejderkontrakt: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  kundegodkendelse: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
};

const STATUS_LABELS: Record<EsignStatus, string> = {
  afventer: "Afventer",
  underskrevet: "Underskrevet",
  afvist: "Afvist",
  udløbet: "Udløbet",
};

const STATUS_CLASSES: Record<EsignStatus, string> = {
  afventer: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  underskrevet: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  afvist: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  udløbet: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

function date(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function EsignForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [documentType, setDocumentType] = useState<DocumentType>("tilbud");
  const [documentTitle, setDocumentTitle] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!documentTitle.trim()) return;
    onSubmit({
      documentType,
      documentTitle: documentTitle.trim(),
      signerName: signerName.trim() || null,
      signerEmail: signerEmail.trim() || null,
      status: "afventer",
      expiresAt: expiresAt || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="esign-title">Dokumenttitel *</Label>
        <Input
          id="esign-title"
          data-testid="input-esign-title"
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          placeholder="F.eks. Servicekontrakt Q3 2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Dokumenttype</Label>
          <Select
            value={documentType}
            onValueChange={(v) => setDocumentType(v as DocumentType)}
          >
            <SelectTrigger data-testid="select-doc-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {DOC_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="esign-expires">Udløbsdato</Label>
          <Input
            id="esign-expires"
            data-testid="input-esign-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="esign-signer-name">Underskrivers navn</Label>
          <Input
            id="esign-signer-name"
            data-testid="input-esign-signer-name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="F.eks. Mette Nielsen"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="esign-signer-email">Underskrivers e-mail</Label>
          <Input
            id="esign-signer-email"
            data-testid="input-esign-signer-email"
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            placeholder="mette@eksempel.dk"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="esign-notes">Noter</Label>
        <Textarea
          id="esign-notes"
          data-testid="input-esign-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Valgfri noter til dokumentet"
          rows={3}
        />
      </div>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
        BETA — E-signatur (beta). Kræver MitID integration.
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-esign"
          disabled={pending || !documentTitle.trim()}
          onClick={submit}
        >
          <Send className="w-4 h-4 mr-1.5" />
          Send til signering
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Esignatur({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<Esignature[]>({
    queryKey: ["/api/esignatures", companyId],
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/esignatures?companyId=${companyId}`)
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/esignatures"] });

  const createEsign = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/esignatures?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Dokument sendt til signering" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke sende dokument",
        description: e.message,
        variant: "destructive",
      }),
  });

  const remind = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest(
          "PATCH",
          `/api/esignatures/${id}?companyId=${companyId}`,
          { remind: true },
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Påmindelse sendt" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke sende påmindelse",
        description: e.message,
        variant: "destructive",
      }),
  });

  const items = data ?? [];

  const summary = useMemo(() => {
    const pending = items.filter((i) => i.status === "afventer").length;
    const signed = items.filter((i) => i.status === "underskrevet").length;
    const expired = items.filter(
      (i) => i.status === "udløbet" || i.status === "afvist",
    ).length;
    return { total: items.length, pending, signed, expired };
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
            E-signatur
          </h1>
          <p className="text-sm text-muted-foreground">
            Håndtering af elektroniske underskrifter
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-esign" onClick={() => setOpen(true)}>
            <PenTool className="w-4 h-4 mr-1.5" />
            Send til signering
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send til signering</DialogTitle>
            </DialogHeader>
            <EsignForm
              pending={createEsign.isPending}
              onSubmit={(body) => createEsign.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
        E-signatur (beta) — Kræver MitID integration
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-esign">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlede dokumenter
            </CardTitle>
            <FileSignature className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Afventer underskrift
            </CardTitle>
            <Bell className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-yellow-600 dark:text-yellow-500">
              {summary.pending}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-signed">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Underskrevet
            </CardTitle>
            <FileSignature className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-green-600 dark:text-green-500">
              {summary.signed}
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-esign"
        >
          <FileSignature className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen dokumenter til signering endnu.
        </div>
      ) : (
        <Card data-testid="card-esign-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dokumenttype</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Underskriver</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Underskrevet</TableHead>
                    <TableHead>Udløber</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-esign-${item.id}`}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={DOC_TYPE_CLASSES[item.documentType]}
                          data-testid={`badge-doc-type-${item.id}`}
                        >
                          {DOC_TYPE_LABELS[item.documentType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-48 truncate">
                        {item.documentTitle}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.signerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.signerEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_CLASSES[item.status]}
                          data-testid={`badge-esign-status-${item.id}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {date(item.signedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {date(item.expiresAt)}
                      </TableCell>
                      <TableCell>
                        {item.status === "afventer" && (
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-remind-${item.id}`}
                            disabled={remind.isPending}
                            onClick={() => remind.mutate(item.id)}
                          >
                            <Bell className="w-3.5 h-3.5 mr-1.5" />
                            Påmind
                          </Button>
                        )}
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

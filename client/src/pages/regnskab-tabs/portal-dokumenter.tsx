import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Upload, FileText, Trash2, FolderOpen } from "lucide-react";

/* ---------- typer ---------- */

interface PortalDocument {
  id: number;
  companyId: number;
  customerId?: number | null;
  title: string;
  documentType: string;
  fileName?: string | null;
  fileType?: string | null;
  visibleToCustomer: boolean;
  uploadedBy?: string | null;
  description?: string | null;
  createdAt: string;
}

const DOC_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  kontrakt: { label: "Kontrakt", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  tilbud: { label: "Tilbud", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  rapport: { label: "Rapport", className: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  faktura: { label: "Faktura", className: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  certificat: { label: "Certifikat", className: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400" },
};

function docBadge(type: string) {
  return DOC_TYPE_CONFIG[type] ?? { label: type, className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400" };
}

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ---------- komponent ---------- */

export default function PortalDokumenter({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("alle");

  const { data, isLoading } = useQuery<PortalDocument[]>({
    queryKey: ["/api/portal-documents", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/portal-documents?companyId=${companyId}`)).json(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/portal-documents"] });

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/portal-documents?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Dokument uploadet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke uploade dokument", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/portal-documents/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Dokument opdateret" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke opdatere dokument", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/portal-documents/${id}?companyId=${companyId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Dokument slettet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke slette dokument", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-portal-dokumenter">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = data ?? [];
  const filtered = filterType === "alle" ? list : list.filter((d) => d.documentType === filterType);

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Portal-dokumenter
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dokumenter delt med kunder via kundeportalen
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-document" onClick={() => setCreateOpen(true)}>
              <Upload className="w-4 h-4 mr-1.5" />
              Upload dokument
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload dokument</DialogTitle>
            </DialogHeader>
            <DocumentForm
              pending={createMutation.isPending}
              onSubmit={async (data) => {
                await createMutation.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="filter-doc-type" className="text-xs text-muted-foreground shrink-0">
          Filtrer type
        </Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger id="filter-doc-type" className="w-48" data-testid="select-filter-type">
            <SelectValue placeholder="Alle typer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            {Object.entries(DOC_TYPE_CONFIG).map(([id, c]) => (
              <SelectItem key={id} value={id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-portal-dokumenter">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen dokumenter fundet</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-portal-dokumenter">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Kunde-ID</TableHead>
                <TableHead>Filnavn</TableHead>
                <TableHead>Filtype</TableHead>
                <TableHead>Synlig</TableHead>
                <TableHead>Uploadet af</TableHead>
                <TableHead>Beskrivelse</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => {
                const badge = docBadge(doc.documentType);
                return (
                  <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                        data-testid={`badge-doc-type-${doc.id}`}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.customerId ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.fileName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.fileType || "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={doc.visibleToCustomer}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: doc.id, data: { visibleToCustomer: checked } })
                        }
                        data-testid={`switch-visible-${doc.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.uploadedBy || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {doc.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-delete-document-${doc.id}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(doc.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ---------- upload-formular ---------- */

function DocumentForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("kontrakt");
  const [customerId, setCustomerId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [description, setDescription] = useState("");
  const [visibleToCustomer, setVisibleToCustomer] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      title,
      documentType,
      customerId: customerId ? Number(customerId) : null,
      fileName: fileName || null,
      fileType: fileType || null,
      uploadedBy: uploadedBy || null,
      description: description || null,
      visibleToCustomer,
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
        <Label htmlFor="doc-title">Titel *</Label>
        <Input
          id="doc-title"
          data-testid="input-doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-type">Dokumenttype</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger id="doc-type" data-testid="select-doc-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DOC_TYPE_CONFIG).map(([id, c]) => (
              <SelectItem key={id} value={id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-customer">Kunde-ID</Label>
          <Input
            id="doc-customer"
            data-testid="input-doc-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="f.eks. 12"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-uploaded-by">Uploadet af</Label>
          <Input
            id="doc-uploaded-by"
            data-testid="input-doc-uploaded-by"
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-filename">Filnavn</Label>
          <Input
            id="doc-filename"
            data-testid="input-doc-filename"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="f.eks. kontrakt.pdf"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-filetype">Filtype</Label>
          <Input
            id="doc-filetype"
            data-testid="input-doc-filetype"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            placeholder="f.eks. pdf"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-description">Beskrivelse</Label>
        <textarea
          id="doc-description"
          data-testid="input-doc-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2">
        <Label htmlFor="doc-visible" className="text-sm">
          Synlig for kunde
        </Label>
        <Switch
          id="doc-visible"
          data-testid="switch-doc-visible"
          checked={visibleToCustomer}
          onCheckedChange={setVisibleToCustomer}
        />
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-document">
          {submitting || pending ? "Uploader..." : "Upload dokument"}
        </Button>
      </DialogFooter>
    </form>
  );
}

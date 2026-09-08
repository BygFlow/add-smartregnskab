import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  ShieldCheck,
  ShieldAlert,
  MoreVertical,
  Trash2,
  Archive,
  FileText,
} from "lucide-react";

/* Filhåndtering — filobjekter (bilag, kontrakter, fotos, dokumenter, rapporter) */

type FileObject = {
  id: number;
  companyId?: number | null;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  mimeType?: string | null;
  category?: string | null;
  uploadedBy?: string | null;
  storagePath?: string | null;
  checksum?: string | null;
  isVirusScanned?: boolean | null;
  status?: string | null;
  createdAt: string;
};

const CATEGORY_STYLE: Record<string, string> = {
  bilag: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  kontrakt: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  foto: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  dokument: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  rapport: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
};
const CATEGORY_LABEL: Record<string, string> = {
  bilag: "Bilag",
  kontrakt: "Kontrakt",
  foto: "Foto",
  dokument: "Dokument",
  rapport: "Rapport",
};
const CATEGORIES = ["bilag", "kontrakt", "foto", "dokument", "rapport"];

const STATUS_STYLE: Record<string, string> = {
  aktiv: "badge-soft-green",
  arkiveret: "badge-soft-gray",
  slettet: "badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  arkiveret: "Arkiveret",
  slettet: "Slettet",
};

function badgeClass(style?: string) {
  return `badge-soft ${style ?? "badge-soft-gray"}`;
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Filhåndtering({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    fileName: "",
    fileType: "pdf",
    category: "bilag",
    fileSize: "",
  });

  const queryKey = ["/api/file-objects", companyId];

  const { data, isLoading } = useQuery<FileObject[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/file-objects");
      const json = await res.json();
      const rows: FileObject[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows.filter((r) => r.companyId == null || r.companyId === companyId);
    },
  });

  const files = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/file-objects", {
        companyId,
        fileName: form.fileName,
        fileType: form.fileType,
        category: form.category,
        fileSize: form.fileSize ? parseInt(form.fileSize, 10) : null,
        mimeType: null,
        uploadedBy: "Nuværende bruger",
        isVirusScanned: false,
        status: "aktiv",
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/file-objects"] });
      toast({ title: "Fil uploadet", description: "Filen er registreret." });
      setDialogOpen(false);
      setForm({ fileName: "", fileType: "pdf", category: "bilag", fileSize: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke uploade fil", description: message, variant: "destructive" });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/file-objects/${id}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/file-objects"] });
      toast({ title: "Status opdateret" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere status", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/file-objects/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/file-objects"] });
      toast({ title: "Fil slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette fil", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Filhåndtering</h2>
          <p className="text-sm text-muted-foreground">
            Overblik over uploadede filer, bilag, kontrakter og dokumenter.
          </p>
        </div>
        <Button data-testid="upload-file-btn" onClick={() => setDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Upload fil
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="files-loading" />
      ) : files.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="files-empty">
          Ingen filer endnu. Upload den første fil ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Filnavn</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Størrelse</th>
                <th className="px-3 py-2">MIME-type</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Uploadet af</th>
                <th className="px-3 py-2">Virusscan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {files.map((f) => (
                <tr key={f.id} data-testid={`file-row-${f.id}`}>
                  <td className="px-3 py-2 font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {f.fileName}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground uppercase">{f.fileType}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatSize(f.fileSize)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.mimeType ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={badgeClass(CATEGORY_STYLE[f.category ?? ""])}
                      data-testid={`category-${f.id}`}
                    >
                      {CATEGORY_LABEL[f.category ?? ""] ?? f.category ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{f.uploadedBy ?? "—"}</td>
                  <td className="px-3 py-2">
                    {f.isVirusScanned ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"
                        data-testid={`virus-scanned-${f.id}`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Scannet
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                        data-testid={`virus-unscanned-${f.id}`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" /> Ikke scannet
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={badgeClass(STATUS_STYLE[f.status ?? "aktiv"])}
                      data-testid={`status-${f.id}`}
                    >
                      {STATUS_LABEL[f.status ?? "aktiv"] ?? f.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`file-actions-${f.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          data-testid={`archive-file-${f.id}`}
                          onClick={() => updateStatusMut.mutate({ id: f.id, status: "arkiveret" })}
                        >
                          <Archive className="mr-2 h-3.5 w-3.5" /> Arkiver
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          data-testid={`delete-file-${f.id}`}
                          className="text-red-600"
                          onClick={() => deleteMut.mutate(f.id)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Slet
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload fil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fo-name">Filnavn</Label>
              <Input
                id="fo-name"
                data-testid="form-fileName"
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                placeholder="F.eks. faktura_2026_08.pdf"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fo-type">Filtype</Label>
              <Input
                id="fo-type"
                data-testid="form-fileType"
                value={form.fileType}
                onChange={(e) => setForm((f) => ({ ...f, fileType: e.target.value }))}
                placeholder="pdf, jpg, docx…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fo-category">Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="fo-category" data-testid="form-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fo-size">Filstørrelse (bytes)</Label>
              <Input
                id="fo-size"
                type="number"
                data-testid="form-fileSize"
                value={form.fileSize}
                onChange={(e) => setForm((f) => ({ ...f, fileSize: e.target.value }))}
                placeholder="F.eks. 204800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.fileName.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Uploader…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FolderOpen,
  Plus,
  Archive,
  Trash2,
  History,
  ShieldCheck,
  ShieldAlert,
  FileText,
  HardDrive,
  CheckCircle2,
} from "lucide-react";

interface FileObject {
  id: number;
  companyId: number | null;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  mimeType?: string | null;
  category?: string | null;
  uploadedBy?: string | null;
  storagePath?: string | null;
  checksum?: string | null;
  isVirusScanned?: boolean | number | null;
  status?: string | null;
  createdAt: string;
}

interface FileVersion {
  id: number;
  fileId: number;
  versionNumber: number;
  fileName: string;
  storagePath: string;
  checksum?: string | null;
  uploadedBy?: string | null;
  changeNote?: string | null;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; style: React.CSSProperties }> = {
  bilag: { label: "Bilag", style: { backgroundColor: "rgb(219 234 254)", color: "rgb(29 78 216)" } },
  kontrakt: { label: "Kontrakt", style: { backgroundColor: "rgb(209 250 229)", color: "rgb(4 120 87)" } },
  foto: { label: "Foto", style: { backgroundColor: "rgb(255 237 213)", color: "rgb(194 65 12)" } },
  dokument: { label: "Dokument", style: { backgroundColor: "rgb(243 232 255)", color: "rgb(126 34 206)" } },
  rapport: { label: "Rapport", style: { backgroundColor: "rgb(204 251 241)", color: "rgb(15 118 110)" } },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  aktiv: { label: "Aktiv", className: "badge-soft badge-soft-green" },
  arkiveret: { label: "Arkiveret", className: "badge-soft badge-soft-gray" },
  slettet: { label: "Slettet", className: "badge-soft badge-soft-red" },
};

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return <span className="text-muted-foreground text-xs">—</span>;
  const cfg = CATEGORY_CONFIG[category] ?? {
    label: category,
    style: { backgroundColor: "rgb(243 244 246)", color: "rgb(75 85 99)" },
  };
  return (
    <span className="badge-soft" style={cfg.style} data-testid={`badge-category-${category}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const key = status || "aktiv";
  const cfg = STATUS_CONFIG[key] ?? { label: key, className: "badge-soft badge-soft-gray" };
  return (
    <span className={cfg.className} data-testid={`badge-status-${key}`}>
      {cfg.label}
    </span>
  );
}

function bytes(size?: number | null): string {
  if (!size || size <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = size;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function dk(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CATEGORY_OPTIONS = ["bilag", "kontrakt", "foto", "dokument", "rapport"];

export default function FilStorage({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [versionsOpen, setVersionsOpen] = useState<FileObject | null>(null);

  const { data: files, isLoading } = useQuery<FileObject[]>({
    queryKey: ["/api/file-objects", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/file-objects")).json(),
  });

  const { data: versions, isLoading: loadingVersions } = useQuery<FileVersion[]>({
    queryKey: ["/api/file-versions", versionsOpen?.id],
    queryFn: async () =>
      (await apiRequest("GET", `/api/file-versions?fileId=${versionsOpen?.id}`)).json(),
    enabled: !!versionsOpen,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/file-objects"] });

  const uploadFile = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", "/api/file-objects", body)).json(),
    onSuccess: () => {
      invalidate();
      setUploadOpen(false);
      toast({ title: "Fil uploadet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke uploade fil", description: e.message, variant: "destructive" }),
  });

  const archiveFile = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/file-objects/${id}`, { status: "arkiveret" })).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Fil arkiveret" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke arkivere fil", description: e.message, variant: "destructive" }),
  });

  const deleteFile = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/file-objects/${id}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Fil slettet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke slette fil", description: e.message, variant: "destructive" }),
  });

  const list = files ?? [];
  const filtered = useMemo(
    () => (categoryFilter === "alle" ? list : list.filter((f) => f.category === categoryFilter)),
    [list, categoryFilter],
  );

  const summary = useMemo(() => {
    const totalFiles = list.length;
    const active = list.filter((f) => (f.status || "aktiv") === "aktiv").length;
    const archived = list.filter((f) => f.status === "arkiveret").length;
    const totalSize = list.reduce((sum, f) => sum + (f.fileSize || 0), 0);
    return { totalFiles, active, archived, totalSize };
  }, [list]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-fil-storage">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24" data-testid="page-fil-storage">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />Fil-storage
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Håndtering af uploadede filer, versioner og arkivering
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-upload">
            <DialogHeader>
              <DialogTitle>Upload fil</DialogTitle>
            </DialogHeader>
            <UploadForm
              pending={uploadFile.isPending}
              onSubmit={async (body) => {
                await uploadFile.mutateAsync(body);
              }}
            />
          </DialogContent>
        </Dialog>
        <Button data-testid="button-upload-fil" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />Upload fil
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-total-files">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Antal filer</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.totalFiles}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-files">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-500">{summary.active}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-archived-files">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Arkiveret</CardTitle>
            <Archive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.archived}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-size">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Samlet størrelse</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{bytes(summary.totalSize)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="category-filter" className="text-sm text-muted-foreground whitespace-nowrap">
          Filtrer kategori
        </Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger id="category-filter" className="w-48" data-testid="select-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle kategorier</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_CONFIG[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-files">
          <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Der er ingen filer i denne kategori</p>
        </div>
      ) : (
        <Card data-testid="card-file-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Filnavn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Størrelse</TableHead>
                    <TableHead>Mime-type</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Uploadet af</TableHead>
                    <TableHead>Virusscan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Oprettet</TableHead>
                    <TableHead className="text-right">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id} data-testid={`row-file-${f.id}`}>
                      <TableCell className="font-medium">{f.fileName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.fileType}</TableCell>
                      <TableCell className="text-sm">{bytes(f.fileSize)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.mimeType || "—"}</TableCell>
                      <TableCell>
                        <CategoryBadge category={f.category} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.uploadedBy || "—"}</TableCell>
                      <TableCell>
                        {f.isVirusScanned ? (
                          <span
                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500 text-xs"
                            data-testid={`icon-virus-scanned-${f.id}`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />Scannet
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500 text-xs"
                            data-testid={`icon-virus-unscanned-${f.id}`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />Ikke scannet
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dk(f.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-versioner-${f.id}`}
                            onClick={() => setVersionsOpen(f)}
                          >
                            <History className="w-3.5 h-3.5 mr-1" />
                            Se versioner
                          </Button>
                          {f.status !== "arkiveret" && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-arkiver-${f.id}`}
                              disabled={archiveFile.isPending}
                              onClick={() => archiveFile.mutate(f.id)}
                            >
                              <Archive className="w-3.5 h-3.5 mr-1" />
                              Arkiver
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-slet-${f.id}`}
                            disabled={deleteFile.isPending}
                            onClick={() => {
                              if (window.confirm(`Slet filen "${f.fileName}"? Dette kan ikke fortrydes.`)) {
                                deleteFile.mutate(f.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Slet
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!versionsOpen} onOpenChange={(open) => !open && setVersionsOpen(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-versions">
          <DialogHeader>
            <DialogTitle>Versioner — {versionsOpen?.fileName}</DialogTitle>
          </DialogHeader>
          {loadingVersions ? (
            <Skeleton className="h-32 rounded-md" />
          ) : (versions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center" data-testid="empty-versions">
              Der er ingen tidligere versioner af denne fil
            </p>
          ) : (
            <div className="space-y-2" data-testid="list-versions">
              {(versions ?? []).map((v) => (
                <div
                  key={v.id}
                  className="rounded-md border border-border/70 p-2.5 text-sm flex items-center justify-between gap-2"
                  data-testid={`row-version-${v.id}`}
                >
                  <div>
                    <p className="font-medium">
                      v{v.versionNumber} — {v.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.uploadedBy || "—"} · {dk(v.createdAt)}
                    </p>
                    {v.changeNote && (
                      <p className="text-xs text-muted-foreground mt-0.5">{v.changeNote}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button data-testid="button-close-versions" onClick={() => setVersionsOpen(null)}>Luk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [fileSize, setFileSize] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim() || !fileType.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        fileName,
        fileType,
        category,
        fileSize: fileSize ? parseInt(fileSize, 10) : null,
        mimeType: mimeType || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="file-name">Filnavn *</Label>
        <Input
          id="file-name"
          data-testid="input-file-name"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="f.eks. faktura-2026-08.pdf"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file-type">Filtype *</Label>
        <Input
          id="file-type"
          data-testid="input-file-type"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          placeholder="f.eks. pdf, jpg, docx"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file-category">Kategori</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="file-category" data-testid="select-file-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_CONFIG[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="file-size">Størrelse (bytes)</Label>
          <Input
            id="file-size"
            type="number"
            min={0}
            data-testid="input-file-size"
            value={fileSize}
            onChange={(e) => setFileSize(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mime-type">Mime-type</Label>
          <Input
            id="mime-type"
            data-testid="input-mime-type"
            value={mimeType}
            onChange={(e) => setMimeType(e.target.value)}
            placeholder="f.eks. application/pdf"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-upload">
          {submitting || pending ? "Uploader..." : "Upload fil"}
        </Button>
      </DialogFooter>
    </form>
  );
}

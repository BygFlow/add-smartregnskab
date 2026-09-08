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
  Download,
  FileText,
  Files,
  FolderOpen,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

type DocCategory =
  | "kunde"
  | "medarbejder"
  | "opgave"
  | "kontrakt"
  | "udstyr";

interface DocumentItem {
  id: number;
  companyId: number;
  title: string;
  category: DocCategory;
  linkedId?: number | string | null;
  fileName?: string | null;
  fileType?: string | null;
  version?: number | string | null;
  uploadedBy?: string | null;
  tags?: string | null;
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  kunde: "Kunde",
  medarbejder: "Medarbejder",
  opgave: "Opgave",
  kontrakt: "Kontrakt",
  udstyr: "Udstyr",
};

const CATEGORY_CLASSES: Record<DocCategory, string> = {
  kunde: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  medarbejder: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  opgave: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  kontrakt: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  udstyr: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

function DocForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocCategory>("kunde");
  const [linkedId, setLinkedId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("pdf");
  const [uploadedBy, setUploadedBy] = useState("");
  const [tags, setTags] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      category,
      linkedId: linkedId ? num(linkedId) : null,
      fileName: fileName.trim() || null,
      fileType: fileType.trim() || null,
      version: 1,
      uploadedBy: uploadedBy.trim() || null,
      tags: tags.trim() || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="doc-title">Titel *</Label>
        <Input
          id="doc-title"
          data-testid="input-doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="F.eks. Servicekontrakt 2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as DocCategory)}
          >
            <SelectTrigger data-testid="select-doc-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-linked">Linket ID</Label>
          <Input
            id="doc-linked"
            data-testid="input-doc-linked"
            type="number"
            value={linkedId}
            onChange={(e) => setLinkedId(e.target.value)}
            placeholder="Valgfrit"
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
            placeholder="dokument.pdf"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-filetype">Filtype</Label>
          <Input
            id="doc-filetype"
            data-testid="input-doc-filetype"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            placeholder="pdf"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-uploaded">Uploadet af</Label>
          <Input
            id="doc-uploaded"
            data-testid="input-doc-uploaded"
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
            placeholder="F.eks. Administratoren"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-tags">Tags (komma-separeret)</Label>
          <Input
            id="doc-tags"
            data-testid="input-doc-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vigtigt, kontrakt, 2026"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          data-testid="button-save-doc"
          disabled={pending || !title.trim()}
          onClick={submit}
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload dokument
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Dokumentcenter({
  companyId,
}: {
  companyId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("alle");
  const [filterTag, setFilterTag] = useState("");

  const { data, isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["/api/document-center", companyId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/document-center?companyId=${companyId}`,
        )
      ).json(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/document-center"] });

  const createDoc = useMutation({
    mutationFn: async (body: unknown) =>
      (
        await apiRequest(
          "POST",
          `/api/document-center?companyId=${companyId}`,
          body,
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Dokument uploadet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke uploade dokument",
        description: e.message,
        variant: "destructive",
      }),
  });

  const newVersion = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest(
          "PATCH",
          `/api/document-center/${id}?companyId=${companyId}`,
          { version: "increment" },
        )
      ).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ny version oprettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke oprette ny version",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        "DELETE",
        `/api/document-center/${id}?companyId=${companyId}`,
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Dokument slettet" });
    },
    onError: (e: Error) =>
      toast({
        title: "Kunne ikke slette dokument",
        description: e.message,
        variant: "destructive",
      }),
  });

  const allItems = data ?? [];

  const allTags = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      (i.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [allItems]);

  const items = useMemo(() => {
    return allItems.filter((i) => {
      if (filterCategory !== "alle" && i.category !== filterCategory)
        return false;
      if (filterTag && !(i.tags ?? "").toLowerCase().includes(filterTag.toLowerCase()))
        return false;
      return true;
    });
  }, [allItems, filterCategory, filterTag]);

  const summary = useMemo(() => {
    const total = allItems.length;
    const byCat = Object.keys(CATEGORY_LABELS) as DocCategory[];
    const counts = byCat.map(
      (c) => allItems.filter((i) => i.category === c).length,
    );
    return { total, counts };
  }, [allItems]);

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
            Dokumentcenter
          </h1>
          <p className="text-sm text-muted-foreground">
            Dokumenter med versionsstyring
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button data-testid="button-add-doc" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Upload dokument
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload dokument</DialogTitle>
            </DialogHeader>
            <DocForm
              pending={createDoc.isPending}
              onSubmit={(body) => createDoc.mutate(body)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card data-testid="card-total-docs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samlede dokumenter
            </CardTitle>
            <Files className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-categories">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kategorier
            </CardTitle>
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {(Object.keys(CATEGORY_LABELS) as DocCategory[]).length}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-tags">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unikke tags
            </CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{allTags.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Kategori</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger data-testid="select-filter-category" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tags</Label>
          <Input
            data-testid="input-filter-tag"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Søg efter tag..."
            className="w-56"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-docs"
        >
          <Files className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Der er ingen dokumenter endnu.
        </div>
      ) : (
        <Card data-testid="card-doc-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Linket ID</TableHead>
                    <TableHead>Filnavn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Version</TableHead>
                    <TableHead>Uploadet af</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-doc-${item.id}`}>
                      <TableCell className="font-medium max-w-48 truncate">
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={CATEGORY_CLASSES[item.category]}
                          data-testid={`badge-doc-category-${item.id}`}
                        >
                          {CATEGORY_LABELS[item.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.linkedId ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.fileName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground uppercase">
                        {item.fileType ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          data-testid={`badge-version-${item.id}`}
                        >
                          v{num(item.version)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.uploadedBy ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-40 truncate">
                        {item.tags ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            data-testid={`button-download-${item.id}`}
                            onClick={() =>
                              toast({
                                title: "Download startet",
                                description: item.fileName ?? item.title,
                              })
                            }
                            aria-label="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-muted text-blue-600"
                            data-testid={`button-new-version-${item.id}`}
                            disabled={newVersion.isPending}
                            onClick={() => newVersion.mutate(item.id)}
                            aria-label="Ny version"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-muted text-destructive"
                            data-testid={`button-delete-doc-${item.id}`}
                            disabled={deleteDoc.isPending}
                            onClick={() => deleteDoc.mutate(item.id)}
                            aria-label="Slet dokument"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
}

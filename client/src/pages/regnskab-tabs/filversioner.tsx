import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Download, History } from "lucide-react";

/* Filversioner — versionshistorik for uploadede filer */

type FileVersion = {
  id: number;
  fileId: number;
  versionNumber: number;
  fileName: string;
  storagePath: string;
  checksum?: string | null;
  uploadedBy?: string | null;
  changeNote?: string | null;
  createdAt: string;
};

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export default function Filversioner({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    fileId: "",
    changeNote: "",
  });

  const queryKey = ["/api/file-versions", companyId];

  const { data, isLoading } = useQuery<FileVersion[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/file-versions");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const versions = (data ?? []).slice().sort((a, b) => {
    if (a.fileId !== b.fileId) return a.fileId - b.fileId;
    return b.versionNumber - a.versionNumber;
  });
  const { data: fileObjects = [] } = useQuery<Array<{ id: number; fileName: string; storagePath?: string | null }>>({
    queryKey: ["/api/file-objects", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/file-objects")).json(),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Vælg en fil først.");
      if (selectedFile.size > 8 * 1024 * 1024) throw new Error("Filen må højst være 8 MB.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Filen kunne ikke læses."));
        reader.readAsDataURL(selectedFile);
      });
      const res = await apiRequest("POST", "/api/file-versions", {
        fileId: parseInt(form.fileId, 10),
        fileName: selectedFile.name,
        dataUrl,
        changeNote: form.changeNote || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/file-versions"] });
      toast({ title: "Version uploadet", description: "Originalfilen er gemt med checksum." });
      setDialogOpen(false);
      setSelectedFile(null);
      setForm({ fileId: "", changeNote: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje version", description: message, variant: "destructive" });
    },
  });

  async function downloadVersion(version: FileVersion) {
    try {
      const response = await apiRequest("GET", `/api/file-versions/${version.id}/fil`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = version.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Versionen kunne ikke hentes", description: message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Filversioner</h2>
          <p className="text-sm text-muted-foreground">
            Hver version er en separat originalfil. Ældre registreringer uden fil kan ikke hentes.
          </p>
        </div>
        <Button data-testid="add-version-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ny version
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="versions-loading" />
      ) : versions.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="versions-empty">
          Ingen ekstra filversioner endnu. Den oprindelige fil er version 1.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Fil-ID</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Filnavn</th>
                <th className="px-3 py-2">Uploadet af</th>
                <th className="px-3 py-2">Ændringsnote</th>
                <th className="px-3 py-2">Oprettet</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {versions.map((v) => (
                <tr key={v.id} data-testid={`version-row-${v.id}`}>
                  <td className="px-3 py-2 text-muted-foreground">#{v.fileId}</td>
                  <td className="px-3 py-2">
                    <span
                      className="badge-soft badge-soft-blue inline-flex items-center gap-1"
                      data-testid={`version-number-${v.id}`}
                    >
                      <History className="h-3 w-3" /> v{v.versionNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{v.fileName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.uploadedBy ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs">
                    <span className="line-clamp-2">{v.changeNote ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(v.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`download-version-${v.id}`}
                      onClick={() => downloadVersion(v)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
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
            <DialogTitle>Ny filversion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fv-fileid">Oprindelig fil</Label>
              <Select value={form.fileId} onValueChange={(fileId) => setForm((f) => ({ ...f, fileId }))}>
                <SelectTrigger id="fv-fileid" data-testid="form-fileId"><SelectValue placeholder="Vælg en fil" /></SelectTrigger>
                <SelectContent>
                  {fileObjects.filter((file) => file.storagePath?.startsWith("s3:") || file.storagePath?.startsWith("disk:"))
                    .map((file) => <SelectItem key={file.id} value={String(file.id)}>{file.fileName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fv-name">Ny fil (PDF eller billede, maks. 8 MB)</Label>
              <Input
                id="fv-name"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
                data-testid="form-file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fv-note">Ændringsnote</Label>
              <Textarea
                id="fv-note"
                data-testid="form-changeNote"
                value={form.changeNote}
                onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))}
                placeholder="Hvad blev ændret i denne version?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.fileId.trim() || !selectedFile}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Uploader…" : "Upload version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

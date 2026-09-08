import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, History } from "lucide-react";

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
  const [form, setForm] = useState({
    fileId: "",
    versionNumber: "1",
    fileName: "",
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

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/file-versions", {
        fileId: parseInt(form.fileId, 10),
        versionNumber: parseInt(form.versionNumber, 10) || 1,
        fileName: form.fileName,
        storagePath: `/storage/${form.fileName}`,
        uploadedBy: "Nuværende bruger",
        changeNote: form.changeNote || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/file-versions"] });
      toast({ title: "Version tilføjet", description: "Ny filversion registreret." });
      setDialogOpen(false);
      setForm({ fileId: "", versionNumber: "1", fileName: "", changeNote: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje version", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/file-versions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/file-versions"] });
      toast({ title: "Version slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette version", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Filversioner</h2>
          <p className="text-sm text-muted-foreground">
            Versionshistorik for uploadede filer — spor ændringer over tid.
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
          Ingen filversioner endnu. Opret den første version ovenfor.
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
                      data-testid={`delete-version-${v.id}`}
                      onClick={() => deleteMut.mutate(v.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
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
              <Label htmlFor="fv-fileid">Fil-ID</Label>
              <Input
                id="fv-fileid"
                type="number"
                data-testid="form-fileId"
                value={form.fileId}
                onChange={(e) => setForm((f) => ({ ...f, fileId: e.target.value }))}
                placeholder="F.eks. 12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fv-version">Versionsnummer</Label>
              <Input
                id="fv-version"
                type="number"
                data-testid="form-versionNumber"
                value={form.versionNumber}
                onChange={(e) => setForm((f) => ({ ...f, versionNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fv-name">Filnavn</Label>
              <Input
                id="fv-name"
                data-testid="form-fileName"
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                placeholder="F.eks. faktura_2026_08_v2.pdf"
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
              disabled={createMut.isPending || !form.fileId.trim() || !form.fileName.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

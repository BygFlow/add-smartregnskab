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
import { Plus, Trash2, AlertTriangle, FileCheck2 } from "lucide-react";

/* Compliance-dokumenter — databehandleraftaler, privacy policies, GDPR-vurderinger m.m. (BETA) */

type ComplianceDocument = {
  id: number;
  companyId?: number | null;
  documentType: string;
  title: string;
  status: string;
  version?: string | null;
  requiresLegalReview?: boolean | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  validUntil?: string | null;
  content?: string | null;
  createdAt: string;
};

const DOC_TYPE_STYLE: Record<string, string> = {
  databehandleraftale: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  privacy_policy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  gdpr_assessment: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  control_description: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  audit_report: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
};
const DOC_TYPE_LABEL: Record<string, string> = {
  databehandleraftale: "Databehandleraftale",
  privacy_policy: "Privatlivspolitik",
  gdpr_assessment: "GDPR-vurdering",
  control_description: "Kontrolbeskrivelse",
  audit_report: "Revisionsrapport",
};
const DOC_TYPES = [
  "databehandleraftale",
  "privacy_policy",
  "gdpr_assessment",
  "control_description",
  "audit_report",
];

const STATUS_STYLE: Record<string, string> = {
  kladde: "badge-soft-gray",
  til_gennemgang: "badge-soft-amber",
  godkendt: "badge-soft-green",
  udløbet: "badge-soft-red",
};
const STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  til_gennemgang: "Til gennemgang",
  godkendt: "Godkendt",
  udløbet: "Udløbet",
};
const STATUSES = ["kladde", "til_gennemgang", "godkendt", "udløbet"];

function badgeClass(style?: string) {
  return `badge-soft ${style ?? "badge-soft-gray"}`;
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK", { dateStyle: "short" });
}

export default function ComplianceDokumenter({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    documentType: "databehandleraftale",
    title: "",
    status: "kladde",
    version: "1.0",
    requiresLegalReview: true,
    validUntil: "",
  });

  const queryKey = ["/api/compliance-documents", companyId];

  const { data, isLoading } = useQuery<ComplianceDocument[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/compliance-documents");
      const json = await res.json();
      const rows: ComplianceDocument[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows.filter((r) => r.companyId == null || r.companyId === companyId);
    },
  });

  const docs = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compliance-documents", {
        companyId,
        documentType: form.documentType,
        title: form.title,
        status: form.status,
        version: form.version || "1.0",
        requiresLegalReview: form.requiresLegalReview,
        validUntil: form.validUntil || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      toast({ title: "Dokument oprettet", description: "Compliance-dokument tilføjet." });
      setDialogOpen(false);
      setForm({
        documentType: "databehandleraftale",
        title: "",
        status: "kladde",
        version: "1.0",
        requiresLegalReview: true,
        validUntil: "",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette dokument", description: message, variant: "destructive" });
    },
  });

  const approveMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/compliance-documents/${id}`, {
        status: "godkendt",
        reviewedBy: "Nuværende bruger",
        reviewedAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      toast({ title: "Dokument godkendt" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke godkende dokument", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/compliance-documents/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      toast({ title: "Dokument slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette dokument", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Compliance-dokumenter</h2>
          <p className="text-sm text-muted-foreground">
            Databehandleraftaler, privatlivspolitikker, GDPR-vurderinger og revisionsrapporter.
          </p>
        </div>
        <Button data-testid="add-document-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret dokument
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Compliance-dokumenter (beta) — Kræver juridisk godkendelse.
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="documents-loading" />
      ) : docs.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="documents-empty">
          Ingen compliance-dokumenter endnu. Opret det første dokument ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Gennemgået af</th>
                <th className="px-3 py-2">Gennemgået</th>
                <th className="px-3 py-2">Gyldig til</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((d) => (
                <tr key={d.id} data-testid={`document-row-${d.id}`}>
                  <td className="px-3 py-2">
                    <span
                      className={badgeClass(DOC_TYPE_STYLE[d.documentType])}
                      data-testid={`document-type-${d.id}`}
                    >
                      {DOC_TYPE_LABEL[d.documentType] ?? d.documentType}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {d.title}
                    {d.requiresLegalReview && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                        title="Kræver juridisk godkendelse"
                        data-testid={`requires-legal-${d.id}`}
                      >
                        <AlertTriangle className="h-3 w-3" /> Juridisk
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={badgeClass(STATUS_STYLE[d.status])}
                      data-testid={`status-${d.id}`}
                    >
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.version ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.reviewedBy ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(d.reviewedAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(d.validUntil)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {d.status !== "godkendt" && (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`approve-document-${d.id}`}
                          disabled={approveMut.isPending}
                          onClick={() => approveMut.mutate(d.id)}
                        >
                          <FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> Godkend
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`delete-document-${d.id}`}
                        onClick={() => deleteMut.mutate(d.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
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
            <DialogTitle>Opret compliance-dokument</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cd-type">Dokumenttype</Label>
              <Select
                value={form.documentType}
                onValueChange={(v) => setForm((f) => ({ ...f, documentType: v }))}
              >
                <SelectTrigger id="cd-type" data-testid="form-documentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOC_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-title">Titel</Label>
              <Input
                id="cd-title"
                data-testid="form-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="F.eks. Databehandleraftale — Kunde A/S"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger id="cd-status" data-testid="form-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-version">Version</Label>
              <Input
                id="cd-version"
                data-testid="form-version"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-validuntil">Gyldig til</Label>
              <Input
                id="cd-validuntil"
                type="date"
                data-testid="form-validUntil"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  data-testid="form-requiresLegalReview"
                  checked={form.requiresLegalReview}
                  onChange={(e) => setForm((f) => ({ ...f, requiresLegalReview: e.target.checked }))}
                />
                Kræver juridisk godkendelse
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.title.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem dokument"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

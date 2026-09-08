import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Trash2,
  FileText,
  AlertTriangle,
  FileSignature,
  Award,
  ShieldCheck,
  UserPlus,
  GraduationCap,
  Package,
} from "lucide-react";

type DocType = "kontrakt" | "certifikat" | "apv" | "onboarding" | "kursus" | "udstyr";

interface EmployeeDocument {
  id: number;
  companyId: number;
  employeeName: string;
  type: DocType | string;
  title: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  status: string;
}

const TYPES: { id: DocType; label: string; icon: React.ReactNode }[] = [
  { id: "kontrakt", label: "Kontrakt", icon: <FileSignature className="w-3 h-3" /> },
  { id: "certifikat", label: "Certifikat", icon: <Award className="w-3 h-3" /> },
  { id: "apv", label: "APV", icon: <ShieldCheck className="w-3 h-3" /> },
  { id: "onboarding", label: "Onboarding", icon: <UserPlus className="w-3 h-3" /> },
  { id: "kursus", label: "Kursus", icon: <GraduationCap className="w-3 h-3" /> },
  { id: "udstyr", label: "Udstyr", icon: <Package className="w-3 h-3" /> },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.id, t.label])
);
const TYPE_ICON: Record<string, React.ReactNode> = Object.fromEntries(
  TYPES.map((t) => [t.id, t.icon])
);

const STATUS_STYLE: Record<string, string> = {
  aktiv: "badge-soft badge-soft-green",
  udløber: "badge-soft badge-soft-amber",
  udløbet: "badge-soft badge-soft-red",
  kladde: "badge-soft badge-soft-gray",
};
const STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  udløber: "Udløber",
  udløbet: "Udløbet",
  kladde: "Kladde",
};

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntilExpiry(date?: string | null): number | null {
  if (!date) return null;
  const target = new Date(date.slice(0, 10));
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((target.getTime() - now.getTime()) / MS_PER_DAY);
}

export default function HrDokumenter({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("alle");
  const [typeFilter, setTypeFilter] = useState("alle");

  const { data: documents, isLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ["/api/employee-documents", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/employee-documents?companyId=${companyId}`)).json(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/employee-documents"] });

  const createDoc = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/employee-documents?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Dokument tilføjet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke tilføje dokument",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateDoc = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/employee-documents/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Dokument opdateret" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere dokument",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/employee-documents/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Dokument slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette dokument",
        description: e.message,
        variant: "destructive",
      }),
  });

  const all = documents ?? [];
  const employees = useMemo(
    () =>
      Array.from(new Set(all.map((d) => d.employeeName).filter(Boolean))).sort(),
    [all]
  );

  const filtered = useMemo(
    () =>
      all.filter((d) => {
        if (employeeFilter !== "alle" && d.employeeName !== employeeFilter) return false;
        if (typeFilter !== "alle" && d.type !== typeFilter) return false;
        return true;
      }),
    [all, employeeFilter, typeFilter]
  );

  const expiringCount = useMemo(
    () =>
      all.filter((d) => {
        const days = daysUntilExpiry(d.expiryDate);
        return days !== null && days >= 0 && days <= 30;
      }).length,
    [all]
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-documents">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">HR-dokumenter</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kontrakter, certifikater og udstyr for ansatte
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-document" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Tilføj dokument
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nyt dokument</DialogTitle>
            </DialogHeader>
            <DocumentForm
              pending={createDoc.isPending}
              onSubmit={async (data) => {
                await createDoc.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {expiringCount > 0 && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"
          data-testid="notice-expiring-documents"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {expiringCount} {expiringCount === 1 ? "dokument udløber" : "dokumenter udløber"} inden for 30 dage.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 min-w-[200px]">
          <Label className="text-xs">Filtrér på ansat</Label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger data-testid="select-filter-employee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle ansatte</SelectItem>
              {employees.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-[200px]">
          <Label className="text-xs">Filtrér på type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger data-testid="select-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle typer</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground" data-testid="empty-documents">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Ingen dokumenter fundet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[1000px] text-sm" data-testid="table-documents">
              <TableHeader>
                <TableRow>
                  <TableHead>Ansat</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Udstedt</TableHead>
                  <TableHead>Udløber</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-2">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => {
                  const days = daysUntilExpiry(doc.expiryDate);
                  const expiringSoon = days !== null && days >= 0 && days <= 30;
                  const expired = days !== null && days < 0;
                  return (
                    <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                      <TableCell className="p-3 font-medium">{doc.employeeName}</TableCell>
                      <TableCell className="p-3">
                        <span
                          className="badge-soft badge-soft-blue"
                          data-testid={`badge-document-type-${doc.id}`}
                        >
                          {TYPE_ICON[doc.type as string] ?? <FileText className="w-3 h-3" />}
                          {TYPE_LABEL[doc.type as string] ?? doc.type}
                        </span>
                      </TableCell>
                      <TableCell className="p-3 text-muted-foreground">{doc.title}</TableCell>
                      <TableCell className="p-3 text-muted-foreground tabular-nums">{dk(doc.issueDate)}</TableCell>
                      <TableCell className="p-3 tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className={expiringSoon || expired ? "font-medium" : "text-muted-foreground"}>
                            {dk(doc.expiryDate)}
                          </span>
                          {expiringSoon && (
                            <span
                              className="badge-soft badge-soft-amber"
                              data-testid={`badge-document-expiring-${doc.id}`}
                            >
                              <AlertTriangle className="w-3 h-3" />{days} dage
                            </span>
                          )}
                          {expired && (
                            <span
                              className="badge-soft badge-soft-red"
                              data-testid={`badge-document-expired-${doc.id}`}
                            >
                              <AlertTriangle className="w-3 h-3" />Udløbet
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3">
                        <span
                          className={STATUS_STYLE[doc.status as string] ?? "badge-soft badge-soft-gray"}
                          data-testid={`badge-document-status-${doc.id}`}
                        >
                          {STATUS_LABEL[doc.status as string] ?? doc.status}
                        </span>
                      </TableCell>
                      <TableCell className="p-3 text-right">
                        <button
                          onClick={() => deleteDoc.mutate(doc.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-delete-document-${doc.id}`}
                          title="Slet dokument"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState({
    employeeName: "",
    type: "kontrakt" as DocType,
    title: "",
    issueDate: "",
    expiryDate: "",
    status: "aktiv",
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      issueDate: form.issueDate || null,
      expiryDate: form.expiryDate || null,
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
        <Label htmlFor="doc-employee">Ansat *</Label>
        <Input
          id="doc-employee"
          data-testid="input-document-employee"
          value={form.employeeName}
          onChange={(e) => set("employeeName", e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger data-testid="select-document-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger data-testid="select-document-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aktiv">Aktiv</SelectItem>
              <SelectItem value="kladde">Kladde</SelectItem>
              <SelectItem value="udløbet">Udløbet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-title">Titel *</Label>
        <Input
          id="doc-title"
          data-testid="input-document-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Fx Ansættelseskontrakt"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-issue">Udstedelsesdato</Label>
          <Input
            id="doc-issue"
            type="date"
            data-testid="input-document-issue-date"
            value={form.issueDate}
            onChange={(e) => set("issueDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-expiry">Udløbsdato</Label>
          <Input
            id="doc-expiry"
            type="date"
            data-testid="input-document-expiry-date"
            value={form.expiryDate}
            onChange={(e) => set("expiryDate", e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || pending}
          data-testid="button-save-document"
        >
          {submitting || pending ? "Gemmer..." : "Gem dokument"}
        </Button>
      </DialogFooter>
    </form>
  );
}

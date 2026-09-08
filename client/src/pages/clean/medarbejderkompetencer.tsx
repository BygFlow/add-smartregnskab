import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, AlertTriangle, Clock, Plus, Trash2, Pencil, Filter, Search } from "lucide-react";

type Category = "sikkerhed" | "kemi" | "maskiner" | "kundespecifik" | "andet";
type Status = "aktiv" | "udloebet" | "udestaaende";

interface EmployeeCertification {
  id: number;
  companyId: number;
  employeeId: number;
  name: string;
  category: Category | string;
  issuedDate?: string | null;
  expiryDate?: string | null;
  issuer?: string | null;
  certificateNumber?: string | null;
  documentAttachment?: string | null;
  status: Status | string;
  notes?: string | null;
  createdAt?: string | null;
}

interface Employee {
  id: number;
  name?: string | null;
  fullName?: string | null;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "sikkerhed", label: "Sikkerhed" },
  { value: "kemi", label: "Kemi" },
  { value: "maskiner", label: "Maskiner" },
  { value: "kundespecifik", label: "Kundespecifik" },
  { value: "andet", label: "Andet" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  aktiv: { label: "Aktiv", className: "badge-soft badge-soft-green" },
  udloebet: { label: "Udløbet", className: "badge-soft badge-soft-red" },
  udestaaende: { label: "Udestående", className: "badge-soft badge-soft-amber" },
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function dk(date?: string | null): string {
  if (!date) return "—";
  const [y, m, day] = date.slice(0, 10).split("-");
  if (!y || !m || !day) return date;
  return `${day}.${m}.${y}`;
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const target = new Date(date.slice(0, 10));
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((target.getTime() - now.getTime()) / MS_PER_DAY);
}

function computeStatus(expiryDate?: string | null): Status {
  if (!expiryDate) return "udestaaende";
  const days = daysUntil(expiryDate);
  if (days === null) return "udestaaende";
  if (days < 0) return "udloebet";
  if (days <= 90) return "udestaaende";
  return "aktiv";
}

function employeeName(emp?: Employee | null): string {
  return emp?.name || emp?.fullName || `Medarbejder #${emp?.id ?? "?"}`;
}

export default function Medarbejderkompetencer({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeCertification | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const { data: certifications, isLoading } = useQuery<EmployeeCertification[]>({
    queryKey: ["/api/employee-certifications", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employee-certifications?companyId=${companyId}`)).json(),
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });

  const employeeMap = useMemo(() => {
    const m = new Map<number, Employee>();
    (employees ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const withComputed = useMemo(
    () => (certifications ?? []).map((c) => ({ ...c, status: computeStatus(c.expiryDate) })),
    [certifications]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withComputed.filter((c) => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterCategory && c.category !== filterCategory) return false;
      if (q) {
        const empName = (employeeName(employeeMap.get(c.employeeId)) || "").toLowerCase();
        const certName = (c.name || "").toLowerCase();
        if (!empName.includes(q) && !certName.includes(q)) return false;
      }
      return true;
    });
  }, [withComputed, filterStatus, filterCategory, search, employeeMap]);

  const stats = useMemo(() => ({
    total: withComputed.length,
    aktiv: withComputed.filter((c) => c.status === "aktiv").length,
    udestaaende: withComputed.filter((c) => c.status === "udestaaende").length,
    udloebet: withComputed.filter((c) => c.status === "udloebet").length,
  }), [withComputed]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/employee-certifications"] });

  const createCert = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/employee-certifications?companyId=${companyId}`, body)).json(),
    onSuccess: () => { invalidate(); setCreateOpen(false); toast({ title: "Kompetence registreret" }); },
    onError: (e: any) => toast({ title: "Kunne ikke registrere kompetence", description: e.message, variant: "destructive" }),
  });

  const updateCert = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/employee-certifications/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => { invalidate(); setEditTarget(null); toast({ title: "Kompetence opdateret" }); },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere kompetence", description: e.message, variant: "destructive" }),
  });

  const deleteCert = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/employee-certifications/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Kompetence slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette kompetence", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-certifications">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const statCards = [
    { label: "Samlede kompetencer", value: stats.total, icon: <Award className="w-4 h-4 text-blue-600" />, testId: "card-total" },
    { label: "Aktive", value: stats.aktiv, icon: <Award className="w-4 h-4 text-green-600" />, testId: "card-active" },
    { label: "Udløber snart", value: stats.udestaaende, icon: <Clock className="w-4 h-4 text-amber-600" />, testId: "card-expiring" },
    { label: "Udløbet", value: stats.udloebet, icon: <AlertTriangle className="w-4 h-4 text-red-600" />, testId: "card-expired" },
  ];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />Medarbejderkompetencer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registrering og styring af medarbejdercertifikater og kompetencer
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-certification" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Tilføj kompetence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Tilføj kompetence</DialogTitle></DialogHeader>
            <CertificationForm
              employees={employees ?? []}
              pending={createCert.isPending}
              onSubmit={async (data) => { await createCert.mutateAsync({ ...data, companyId }); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.testId} data-testid={s.testId}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-2">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-md border border-border/70 bg-card p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-end" data-testid="filter-bar">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />Filtre
        </div>
        <div className="space-y-1.5 flex-1 w-full">
          <Label htmlFor="search-cert" className="text-xs">Søg</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input id="search-cert" data-testid="input-search" value={search}
              onChange={(e) => setSearch(e.target.value)} placeholder="Medarbejder eller certifikat" className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5 w-full sm:w-48">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus || "alle"} onValueChange={(v) => setFilterStatus(v === "alle" ? "" : v)}>
            <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle statuser</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([id, c]) => (
                <SelectItem key={id} value={id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-full sm:w-48">
          <Label className="text-xs">Kategori</Label>
          <Select value={filterCategory || "alle"} onValueChange={(v) => setFilterCategory(v === "alle" ? "" : v)}>
            <SelectTrigger data-testid="select-filter-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle kategorier</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterStatus || filterCategory || search) && (
          <Button variant="ghost" size="sm" data-testid="button-clear-filter"
            onClick={() => { setFilterStatus(""); setFilterCategory(""); setSearch(""); }}>
            Ryd
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-certifications">
          <Award className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Ingen kompetencer fundet</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-certifications">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medarbejder</TableHead>
                <TableHead>Certifikat</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Udstedt</TableHead>
                <TableHead>Udløber</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const emp = employeeMap.get(item.employeeId);
                const days = daysUntil(item.expiryDate);
                const status = STATUS_CONFIG[item.status as string] ?? { label: item.status, className: "badge-soft badge-soft-gray" };
                return (
                  <TableRow key={item.id} data-testid={`row-certification-${item.id}`}>
                    <TableCell className="font-medium">{employeeName(emp)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {item.issuer && <div className="text-xs text-muted-foreground mt-0.5">{item.issuer}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="badge-soft badge-soft-blue">
                        {CATEGORY_LABEL[item.category as string] ?? item.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dk(item.issuedDate)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">{dk(item.expiryDate)}</span>
                        {item.expiryDate && days !== null && days < 0 && (
                          <Badge variant="destructive" data-testid={`badge-expired-${item.id}`}>
                            <AlertTriangle className="w-3 h-3 mr-1" />Udløbet
                          </Badge>
                        )}
                        {item.expiryDate && days !== null && days >= 0 && days <= 90 && (
                          <Badge className="badge-soft badge-soft-amber" data-testid={`badge-expiring-${item.id}`}>
                            <Clock className="w-3 h-3 mr-1" />Udløber snart
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className} data-testid={`badge-status-${item.id}`}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditTarget(item)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-edit-${item.id}`} title="Rediger">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteCert.mutate(item.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-delete-${item.id}`} title="Slet">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Rediger kompetence</DialogTitle></DialogHeader>
          {editTarget && (
            <CertificationForm
              initial={editTarget}
              employees={employees ?? []}
              pending={updateCert.isPending}
              onSubmit={async (data) => { await updateCert.mutateAsync({ id: editTarget.id, data }); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormPayload {
  employeeId: number;
  name: string;
  category: Category;
  issuedDate: string | null;
  expiryDate: string | null;
  issuer: string | null;
  certificateNumber: string | null;
  notes: string | null;
}

function CertificationForm({
  initial, employees, pending, onSubmit,
}: {
  initial?: EmployeeCertification | null;
  employees: Employee[];
  pending: boolean;
  onSubmit: (data: FormPayload) => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState<string>(initial?.employeeId ? String(initial.employeeId) : "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Category>((initial?.category as Category) ?? "sikkerhed");
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate ?? new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [certificateNumber, setCertificateNumber] = useState(initial?.certificateNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    setSubmitting(true);
    const payload: FormPayload = {
      employeeId: Number(employeeId), name, category,
      issuedDate: issuedDate || null, expiryDate: expiryDate || null,
      issuer: issuer || null, certificateNumber: certificateNumber || null,
      notes: notes || null,
    };
    try { await onSubmit(payload); } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cert-employee">Medarbejder *</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Vælg medarbejder" /></SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>{employeeName(e)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cert-name">Certifikatnavn *</Label>
        <Input id="cert-name" data-testid="input-name" value={name} onChange={(e) => setName(e.target.value)}
          required placeholder="f.eks. Truckførerbevis" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cert-category">Kategori</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
          <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cert-issued">Udstedelsesdato</Label>
          <Input id="cert-issued" type="date" data-testid="input-issued-date" value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cert-expiry">Udløbsdato</Label>
          <Input id="cert-expiry" type="date" data-testid="input-expiry-date" value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cert-issuer">Udsteder</Label>
          <Input id="cert-issuer" data-testid="input-issuer" value={issuer}
            onChange={(e) => setIssuer(e.target.value)} placeholder="f.eks. Sikkerhedsrådet" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cert-number">Certifikatnummer</Label>
          <Input id="cert-number" data-testid="input-certificate-number" value={certificateNumber}
            onChange={(e) => setCertificateNumber(e.target.value)} placeholder="f.eks. CERT-2024-001" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cert-notes">Noter</Label>
        <Textarea id="cert-notes" data-testid="input-notes" value={notes}
          onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-certification">
          {submitting || pending ? "Gemmer..." : "Gem kompetence"}
        </Button>
      </DialogFooter>
    </form>
  );
}

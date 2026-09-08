import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Phone, Mail, Trash2, Edit2, Eye, X, User, Briefcase, FileText, Calendar, Upload, FileCheck, ShieldCheck } from "lucide-react";
import type { Employee } from "@shared/schema";

const ROLES = ["Rengøringsassistent", "Holdleder", "Driftsleder", "Afdelingsleder", "Tekniker", "Andet"] as const;
const EMPLOYMENT_STATUS = [
  { value: "aktiv", label: "Aktiv" },
  { value: "pauseret", label: "Pauseret" },
  { value: "opsagt", label: "Opsagt" },
  { value: "tidligere", label: "Tidligere" },
] as const;
const CONTRACT_TYPES = [
  { value: "fast", label: "Fast" },
  { value: "tidsbegraenset", label: "Tidsbegrænset" },
  { value: "timeloennet", label: "Timelønnet" },
  { value: "vikar", label: "Vikar" },
] as const;

function statusBadge(status: string | null | undefined) {
  switch (status) {
    case "aktiv":
      return <Badge className="text-[10px] bg-green-100 text-green-800 hover:bg-green-100">Aktiv</Badge>;
    case "pauseret":
      return <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">Pauseret</Badge>;
    case "opsagt":
      return <Badge className="text-[10px] bg-orange-100 text-orange-800 hover:bg-orange-100">Opsagt</Badge>;
    case "tidligere":
      return <Badge variant="secondary" className="text-[10px]">Tidligere</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">—</Badge>;
  }
}

function parseSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MODULES: { path: string; label: string }[] = [
  { path: "/opgaver", label: "Opgaver" },
  { path: "/vagtplan", label: "Vagtplan" },
  { path: "/tidregistrering", label: "Tidsregistrering" },
  { path: "/kunder", label: "Kunder" },
  { path: "/fakturaer", label: "Fakturaer" },
  { path: "/tilbud", label: "Tilbud" },
  { path: "/ydelser", label: "Ydelser" },
  { path: "/aftaler", label: "Aftaler" },
  { path: "/planer", label: "Planer" },
];

const ASSISTENT_DEFAULT_PERMISSIONS = ["/opgaver", "/vagtplan", "/tidregistrering"];

function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nextEmployeeNumber(existing: Employee[] | undefined): string {
  const count = (existing ?? []).length;
  const next = count + 1;
  return `M-${String(next).padStart(4, "0")}`;
}

export default function Ansatte() {
  const { user } = useAuth();
  const companyId = user?.companyId || 1;
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [accessEmployee, setAccessEmployee] = useState<Employee | null>(null);

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/employees"] });

  const createEmployee = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", `/api/employees?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Ansat oprettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke oprette ansat", description: e.message, variant: "destructive" }),
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/employees/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ansat opdateret" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere ansat", description: e.message, variant: "destructive" }),
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/employees/${id}?companyId=${companyId}`)).json(),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ansat slettet" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke slette ansat", description: e.message, variant: "destructive" }),
  });

  const updateAccess = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { gpsRequired: number; appAccessEnabled: number; permissions: string } }) =>
      (await apiRequest("PATCH", `/api/employees/${id}/access?companyId=${companyId}`, data)).json(),
    onSuccess: () => {
      invalidate();
      setAccessEmployee(null);
      toast({ title: "Adgang opdateret" });
    },
    onError: (e: any) => toast({ title: "Kunne ikke opdatere adgang", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (emp: Employee) => {
    setEditing(emp);
    setCreateOpen(true);
  };
  const handleCreate = () => {
    setEditing(null);
    setCreateOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const list = employees ?? [];

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Ansatte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Styr dit team, kontrakter og kompetencer</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} data-testid="button-new-employee">
              <Plus className="w-4 h-4 mr-1.5" />Ny ansat
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Rediger ansat" : "Ny ansat"}</DialogTitle>
            </DialogHeader>
            <EmployeeForm
              employee={editing}
              allEmployees={list}
              nextNumber={nextEmployeeNumber(list)}
              pending={createEmployee.isPending || updateEmployee.isPending}
              onSubmit={async (data) => {
                if (editing) await updateEmployee.mutateAsync({ id: editing.id, data });
                else await createEmployee.mutateAsync(data);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Ingen ansatte endnu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[1100px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbejdernummer</TableHead>
                  <TableHead>Navn</TableHead>
                  <TableHead>Stilling</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Ansættelsesstatus</TableHead>
                  <TableHead>Startdato</TableHead>
                  <TableHead>Timepris</TableHead>
                  <TableHead className="text-right whitespace-nowrap pr-2 sticky-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((emp) => (
                  <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="p-3 font-mono text-xs" onClick={() => setDetailEmployee(emp)}>{emp.employeeNumber || "—"}</TableCell>
                    <TableCell className="p-3 font-medium" onClick={() => setDetailEmployee(emp)}>{emp.name}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailEmployee(emp)}>{emp.position || emp.role || "—"}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailEmployee(emp)}>{emp.phone || "—"}</TableCell>
                    <TableCell className="p-3" onClick={() => setDetailEmployee(emp)}>{statusBadge(emp.employmentStatus)}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailEmployee(emp)}>{emp.startDate || "—"}</TableCell>
                    <TableCell className="p-3 text-muted-foreground" onClick={() => setDetailEmployee(emp)}>{emp.hourlyRate ? `${emp.hourlyRate} kr` : "—"}</TableCell>
                    <TableCell className="p-3 text-right sticky-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setDetailEmployee(emp)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-view-employee-${emp.id}`}
                          title="Vis detaljer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAccessEmployee(emp)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-access-employee-${emp.id}`}
                          title="Adgang & GPS"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(emp)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-edit-employee-${emp.id}`}
                          title="Rediger"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteEmployee.mutate(emp.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                          data-testid={`button-delete-employee-${emp.id}`}
                          title="Slet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EmployeeDetailDialog
        employee={detailEmployee}
        allEmployees={list}
        onClose={() => setDetailEmployee(null)}
        onEdit={(emp) => {
          setDetailEmployee(null);
          handleEdit(emp);
        }}
      />

      <AccessGpsDialog
        employee={accessEmployee}
        pending={updateAccess.isPending}
        onClose={() => setAccessEmployee(null)}
        onSubmit={async (data) => {
          if (accessEmployee) await updateAccess.mutateAsync({ id: accessEmployee.id, data });
        }}
      />
    </div>
  );
}

function EmployeeForm({
  employee,
  allEmployees,
  nextNumber,
  pending,
  onSubmit,
}: {
  employee: Employee | null;
  allEmployees: Employee[];
  nextNumber: string;
  pending: boolean;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [skills, setSkills] = useState<string[]>(parseSkills(employee?.skills));
  const [skillInput, setSkillInput] = useState("");
  const [form, setForm] = useState({
    name: employee?.name || "",
    employeeNumber: employee?.employeeNumber || nextNumber,
    phone: employee?.phone || "",
    email: employee?.email || "",
    position: employee?.position || "",
    role: employee?.role || "Rengøringsassistent",
    employmentStatus: employee?.employmentStatus || "aktiv",
    contractType: employee?.contractType || "fast",
    startDate: employee?.startDate || "",
    endDate: employee?.endDate || "",
    weeklyHours: employee?.weeklyHours?.toString() || "37",
    hourlyRate: employee?.hourlyRate?.toString() || "0",
    monthlySalary: employee?.monthlySalary?.toString() || "0",
    managerId: employee?.managerId?.toString() || "",
    contractDraft: employee?.contractDraft || "",
    contractFileName: employee?.contractFileName || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setSkillInput("");
    }
  };
  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      set("contractFileName", file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      weeklyHours: Number(form.weeklyHours) || 0,
      hourlyRate: Number(form.hourlyRate) || 0,
      monthlySalary: Number(form.monthlySalary) || 0,
      managerId: form.managerId && form.managerId !== "none" ? Number(form.managerId) : null,
      skills: JSON.stringify(skills),
      contractUploadedAt: form.contractFileName && form.contractFileName !== employee?.contractFileName
        ? new Date().toISOString().split("T")[0]
        : employee?.contractUploadedAt || null,
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Navn *</Label>
          <Input id="name" data-testid="input-emp-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employeeNumber">Medarbejdernummer</Label>
          <Input id="employeeNumber" data-testid="input-emp-number" value={form.employeeNumber} readOnly className="bg-muted/50 font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" data-testid="input-emp-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" data-testid="input-emp-email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="position">Stilling</Label>
          <Input id="position" data-testid="input-emp-position" value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="F.eks. Senior rengøringsassistent" />
        </div>
        <div className="space-y-1.5">
          <Label>Rolle</Label>
          <Select value={form.role} onValueChange={(v) => set("role", v)}>
            <SelectTrigger data-testid="select-emp-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Ansættelsesstatus</Label>
          <Select value={form.employmentStatus} onValueChange={(v) => set("employmentStatus", v)}>
            <SelectTrigger data-testid="select-emp-employment-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_STATUS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ansættelsesform</Label>
          <Select value={form.contractType} onValueChange={(v) => set("contractType", v)}>
            <SelectTrigger data-testid="select-emp-contract-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Startdato</Label>
          <Input id="startDate" type="date" data-testid="input-emp-start-date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Slutdato</Label>
          <Input id="endDate" type="date" data-testid="input-emp-end-date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="weeklyHours">Ugentlige timer</Label>
          <Input id="weeklyHours" type="number" data-testid="input-emp-weekly-hours" value={form.weeklyHours} onChange={(e) => set("weeklyHours", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hourlyRate">Timepris (kr)</Label>
          <Input id="hourlyRate" type="number" data-testid="input-emp-hourly-rate" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monthlySalary">Månedsløn (kr)</Label>
          <Input id="monthlySalary" type="number" data-testid="input-emp-monthly-salary" value={form.monthlySalary} onChange={(e) => set("monthlySalary", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Nærmeste leder</Label>
        <Select value={form.managerId} onValueChange={(v) => set("managerId", v)}>
          <SelectTrigger data-testid="select-emp-manager"><SelectValue placeholder="Vælg leder" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen leder</SelectItem>
            {allEmployees
              .filter((e) => e.id !== employee?.id)
              .map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}{e.position ? ` — ${e.position}` : ""}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Kompetencer</Label>
        <div className="flex gap-2">
          <Input
            data-testid="input-emp-skill"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Tilføj kompetence og tryk Enter"
          />
          <Button type="button" variant="outline" size="sm" onClick={addSkill} data-testid="button-add-skill">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px] gap-1 pr-1" data-testid={`badge-skill-${s}`}>
                {s}
                <button type="button" onClick={() => removeSkill(s)} className="hover:text-destructive" data-testid={`button-remove-skill-${s}`}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contractDraft">Kontraktudkast</Label>
        <Textarea
          id="contractDraft"
          data-testid="textarea-emp-contract-draft"
          value={form.contractDraft}
          onChange={(e) => set("contractDraft", e.target.value)}
          placeholder="Udkast til ansættelseskontrakt — vilkår, timer, løn, opsigelsesvarsel, etc."
          rows={4}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contractFile">Kontrakt upload</Label>
        <div className="flex items-center gap-2">
          <Input
            id="contractFile"
            type="file"
            data-testid="input-emp-contract-file"
            onChange={handleFileUpload}
            className="text-xs"
          />
          {form.contractFileName && (
            <Badge variant="outline" className="text-[10px] gap-1 whitespace-nowrap" data-testid="badge-contract-file">
              <FileCheck className="w-3 h-3" />
              {form.contractFileName}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Kun filnavnet gemmes — selve filen gemmes ikke i systemet.</p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-employee">
        {submitting || pending ? "Gemmer..." : "Gem ansat"}
      </Button>
    </form>
  );
}

function EmployeeDetailDialog({
  employee,
  allEmployees,
  onClose,
  onEdit,
}: {
  employee: Employee | null;
  allEmployees: Employee[];
  onClose: () => void;
  onEdit: (emp: Employee) => void;
}) {
  const skills = parseSkills(employee?.skills);
  const manager = allEmployees.find((e) => e.id === employee?.managerId);

  return (
    <Dialog open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {employee?.name}
          </DialogTitle>
        </DialogHeader>
        {employee && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailField label="Medarbejdernummer" value={employee.employeeNumber} mono />
              <DetailField label="Stilling" value={employee.position || employee.role} icon={<Briefcase className="w-3.5 h-3.5" />} />
              <DetailField label="Telefon" value={employee.phone} icon={<Phone className="w-3.5 h-3.5" />} />
              <DetailField label="Email" value={employee.email} icon={<Mail className="w-3.5 h-3.5" />} />
              <DetailField label="Startdato" value={employee.startDate} icon={<Calendar className="w-3.5 h-3.5" />} />
              <DetailField label="Slutdato" value={employee.endDate} icon={<Calendar className="w-3.5 h-3.5" />} />
              <DetailField label="Ugentlige timer" value={employee.weeklyHours ? `${employee.weeklyHours} timer` : undefined} />
              <DetailField label="Timepris" value={employee.hourlyRate ? `${employee.hourlyRate} kr` : undefined} />
              <DetailField label="Månedsløn" value={employee.monthlySalary ? `${employee.monthlySalary} kr` : undefined} />
              <DetailField label="Nærmeste leder" value={manager?.name} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <div className="text-xs text-muted-foreground">Ansættelsesstatus</div>
                <div>{statusBadge(employee.employmentStatus)}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-muted-foreground">Ansættelsesform</div>
                <div className="text-foreground">
                  {CONTRACT_TYPES.find((c) => c.value === employee.contractType)?.label || "—"}
                </div>
              </div>
            </div>

            {skills.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Kompetencer</Label>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]" data-testid={`detail-skill-${s}`}>{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {employee.contractDraft && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />Kontraktudkast
                </Label>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto" data-testid="detail-contract-draft">
                  {employee.contractDraft}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />Kontraktfil
              </Label>
              {employee.contractFileName ? (
                <div className="rounded-md border border-border p-3 text-sm flex items-center gap-2" data-testid="detail-contract-file">
                  <FileCheck className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="font-medium">{employee.contractFileName}</div>
                    {employee.contractUploadedAt && (
                      <div className="text-xs text-muted-foreground">Uploadet: {employee.contractUploadedAt}</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Ingen kontraktfil uploadet</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onEdit(employee)} data-testid="button-detail-edit-employee">
                <Edit2 className="w-4 h-4 mr-1.5" />Rediger
              </Button>
              <Button variant="outline" onClick={onClose} data-testid="button-detail-close">
                Luk
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value, icon, mono }: { label: string; value?: string | null; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`flex items-center gap-1.5 text-foreground ${mono ? "font-mono" : ""}`}>
        {icon}
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Adgang & GPS — virksomheden styrer adgang pr. medarbejder
// ═══════════════════════════════════════════════════════════════
function AccessGpsDialog({
  employee,
  pending,
  onClose,
  onSubmit,
}: {
  employee: Employee | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: { gpsRequired: number; appAccessEnabled: number; permissions: string }) => Promise<void>;
}) {
  const [appAccessEnabled, setAppAccessEnabled] = useState<boolean>(true);
  const [gpsRequired, setGpsRequired] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!employee) return;
    const isAssistent = (employee.role ?? "").toLowerCase().includes("assistent");
    const existing = parsePermissions(employee.permissions);
    setPermissions(existing.length > 0 || !isAssistent ? existing : [...ASSISTENT_DEFAULT_PERMISSIONS]);
    setGpsRequired(employee.gpsRequired !== 0);
    setAppAccessEnabled(employee.appAccessEnabled !== 0);
  }, [employee]);

  const togglePermission = (path: string) => {
    setPermissions((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        gpsRequired: gpsRequired ? 1 : 0,
        appAccessEnabled: appAccessEnabled ? 1 : 0,
        permissions: JSON.stringify(permissions),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-5 h-5" />
            Adgang & GPS
          </DialogTitle>
        </DialogHeader>
        {employee && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{employee.name}</p>
              <p className="text-xs text-muted-foreground">Rolle/adgangsniveau</p>
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">{employee.role || "Rengøringsassistent"}</span>
              </div>
            </div>

            <div className="flex justify-between gap-3 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">App-adgang</p>
                <p className="text-[11px] text-muted-foreground mt-1">Når den er slået fra, kan medarbejderen ikke logge ind i appen.</p>
              </div>
              <Switch
                checked={appAccessEnabled}
                onCheckedChange={setAppAccessEnabled}
                aria-label="App-adgang"
                data-testid="switch-app-access"
              />
            </div>

            <div className="flex justify-between gap-3 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">GPS-krav</p>
                <p className="text-[11px] text-muted-foreground mt-1">Når den er slået til, skal GPS være aktiv ved tidsregistrering.</p>
              </div>
              <Switch
                checked={gpsRequired}
                onCheckedChange={setGpsRequired}
                aria-label="GPS-krav"
                data-testid="switch-gps-required"
              />
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <Label className="text-sm font-medium">Modul-adgang</Label>
              <p className="text-[11px] text-muted-foreground">Vælg hvilke moduler medarbejderen kan se i appen.</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {MODULES.map((mod) => {
                  const checked = permissions.includes(mod.path);
                  return (
                    <label
                      key={mod.path}
                      className="flex items-center gap-2 rounded-md border border-border/50 p-2 cursor-pointer hover:bg-muted/40"
                      data-testid={`label-module-${mod.path}`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePermission(mod.path)}
                        data-testid={`checkbox-module-${mod.path}`}
                      />
                      <span className="text-sm">{mod.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-access">
              {submitting || pending ? "Gemmer..." : "Gem adgang"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

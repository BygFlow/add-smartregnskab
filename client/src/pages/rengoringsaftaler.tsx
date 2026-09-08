import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SectionCard } from "@/components/premium";
import {
  Plus,
  Trash2,
  Edit2,
  FileSignature,
  Send,
  Check,
  PenLine,
  Ban,
  Eye,
  X,
  MessageSquareReply,
} from "lucide-react";

// ── Typer ──
type AgreementStatus =
  | "kladde"
  | "sendt"
  | "afventer_kunde"
  | "godkendt"
  | "underskrevet"
  | "aktiv"
  | "opsagt"
  | "udløbet";

type Frequency =
  | "dagligt"
  | "hver_2_dag"
  | "hver_3_dag"
  | "hver_4_dag"
  | "hver_5_dag"
  | "ugentligt"
  | "hver_14_dag"
  | "hver_3_uge"
  | "maanedligt"
  | "manuelt";

type PaymentTerms = "8_dage" | "14_dage" | "30_dage" | "kontant";

interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
}

interface CleaningService {
  id: number;
  name: string;
  unitType: string;
  price: number;
  hourlyRate?: number | null;
  estimatedTime?: number | null;
}

interface AgreementLine {
  serviceId: number | null;
  serviceName: string;
  quantity: string;
  unit: string;
  price: string;
  total: string;
}

interface CleaningAgreement {
  id: number;
  companyId: number;
  customerId: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  frequency: string | null;
  monthlyPrice: string | number | null;
  serviceIds: string | null;
  notes: string | null;
  agreementNumber: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  agreementLines: string | null;
  totalSetup: string | number | null;
  bindingPeriod: number | null;
  noticePeriod: number | null;
  paymentTerms: string | null;
  terms: string | null;
  sentAt: string | null;
  customerApprovedAt: string | null;
  customerSignature: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

// ── Konstanter ──
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "dagligt", label: "Dagligt" },
  { value: "hver_2_dag", label: "Hver 2. dag" },
  { value: "hver_3_dag", label: "Hver 3. dag" },
  { value: "hver_4_dag", label: "Hver 4. dag" },
  { value: "hver_5_dag", label: "Hver 5. dag" },
  { value: "ugentligt", label: "Ugentligt" },
  { value: "hver_14_dag", label: "Hver 14. dag" },
  { value: "hver_3_uge", label: "Hver 3. uge" },
  { value: "maanedligt", label: "Månedligt" },
  { value: "manuelt", label: "Manuelt" },
];

const FREQ_LABELS: Record<string, string> = Object.fromEntries(
  FREQUENCIES.map((f) => [f.value, f.label]),
);

const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: "8_dage", label: "8 dage" },
  { value: "14_dage", label: "14 dage" },
  { value: "30_dage", label: "30 dage" },
  { value: "kontant", label: "Kontant" },
];

const PAYMENT_TERMS_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_TERMS.map((p) => [p.value, p.label]),
);

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "gray" | "blue" | "amber" | "cyan" | "green" | "red" }
> = {
  kladde: { label: "Kladde", variant: "gray" },
  sendt: { label: "Sendt", variant: "blue" },
  afventer_kunde: { label: "Afventer kunde", variant: "amber" },
  godkendt: { label: "Godkendt", variant: "cyan" },
  underskrevet: { label: "Underskrevet", variant: "green" },
  aktiv: { label: "Aktiv", variant: "green" },
  opsagt: { label: "Opsagt", variant: "red" },
  udløbet: { label: "Udløbet", variant: "gray" },
};

const BADGE_CLASSES: Record<string, string> = {
  gray: "badge-soft badge-soft-gray",
  blue: "badge-soft badge-soft-blue",
  amber: "badge-soft badge-soft-amber",
  cyan: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
  green: "badge-soft badge-soft-green",
  red: "badge-soft badge-soft-red",
};

const STATUS_TIMELINE: AgreementStatus[] = [
  "kladde",
  "sendt",
  "afventer_kunde",
  "godkendt",
  "underskrevet",
  "aktiv",
];

const UNITS = ["timer", "md", "stk", "m2", "gang", "lokation"];

// ── Hjælpefunktioner ──
function money(value?: string | number | null) {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n);
}

function num(value?: string | number | null) {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return isNaN(n) ? 0 : n;
}

function dk(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): AgreementLine {
  return {
    serviceId: null,
    serviceName: "",
    quantity: "1",
    unit: "md",
    price: "0",
    total: "0",
  };
}

interface FormState {
  customerId: string;
  name: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  frequency: Frequency;
  startDate: string;
  endDate: string;
  agreementLines: AgreementLine[];
  totalSetup: string;
  bindingPeriod: string;
  noticePeriod: string;
  paymentTerms: PaymentTerms;
  terms: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  customerId: "",
  name: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  frequency: "maanedligt",
  startDate: today(),
  endDate: "",
  agreementLines: [emptyLine()],
  totalSetup: "0",
  bindingPeriod: "0",
  noticePeriod: "1",
  paymentTerms: "8_dage",
  terms: "",
  notes: "",
};

export default function RengoringsAftaler() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CleaningAgreement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState<number | null>(null);
  const [signOpen, setSignOpen] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState<number | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [replyAccepted, setReplyAccepted] = useState(true);

  // ── Data ──
  const { data: agreements, isLoading } = useQuery<CleaningAgreement[]>({
    queryKey: ["/api/cleaning-agreements", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/cleaning-agreements?companyId=${companyId}`)).json(),
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const { data: services } = useQuery<CleaningService[]>({
    queryKey: ["/api/cleaning-services", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/cleaning-services?companyId=${companyId}`)).json(),
  });

  const customerName = (id: number) =>
    customers?.find((c) => c.id === id)?.name ?? `Kunde #${id}`;

  const customerById = (id: number) => customers?.find((c) => c.id === id);

  const detailAgreement = useMemo(
    () => agreements?.find((a) => a.id === detailId) ?? null,
    [agreements, detailId],
  );

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const seq = (agreements?.length ?? 0) + 1;
      const agreementNumber = `A-${String(seq).padStart(4, "0")}`;
      const linesTotal = data.agreementLines.reduce(
        (s, l) => s + num(l.total),
        0,
      );
      const res = await apiRequest("POST", "/api/cleaning-agreements", {
        companyId,
        customerId: data.customerId ? parseInt(data.customerId) : 0,
        name: data.name || "Rengøringsaftale",
        status: "kladde",
        startDate: data.startDate || today(),
        endDate: data.endDate || null,
        frequency: data.frequency,
        monthlyPrice: linesTotal,
        serviceIds: "[]",
        notes: data.notes || null,
        agreementNumber,
        contactPerson: data.contactPerson || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        agreementLines: JSON.stringify(data.agreementLines),
        totalSetup: num(data.totalSetup),
        bindingPeriod: parseInt(data.bindingPeriod) || 0,
        noticePeriod: parseInt(data.noticePeriod) || 1,
        paymentTerms: data.paymentTerms,
        terms: data.terms || null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-agreements"] });
      toast({ title: "Aftalen er oprettet" });
      closeDialog();
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette aftale",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState }) => {
      const linesTotal = data.agreementLines.reduce(
        (s, l) => s + num(l.total),
        0,
      );
      const res = await apiRequest("PATCH", `/api/cleaning-agreements/${id}`, {
        customerId: data.customerId ? parseInt(data.customerId) : 0,
        name: data.name || "Rengøringsaftale",
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        frequency: data.frequency,
        monthlyPrice: linesTotal,
        notes: data.notes || null,
        contactPerson: data.contactPerson || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        agreementLines: JSON.stringify(data.agreementLines),
        totalSetup: num(data.totalSetup),
        bindingPeriod: parseInt(data.bindingPeriod) || 0,
        noticePeriod: parseInt(data.noticePeriod) || 1,
        paymentTerms: data.paymentTerms,
        terms: data.terms || null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-agreements"] });
      toast({ title: "Aftalen er opdateret" });
      closeDialog();
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere aftale",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cleaning-agreements/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-agreements"] });
      toast({ title: "Aftalen er slettet" });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke slette aftale",
        description: e.message,
        variant: "destructive",
      }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      extra,
    }: {
      id: number;
      status: string;
      extra?: Record<string, unknown>;
    }) => {
      const res = await apiRequest("PATCH", `/api/cleaning-agreements/${id}`, {
        status,
        ...extra,
      });
      return res.json();
    },
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cleaning-agreements"] });
      const labels: Record<string, string> = {
        sendt: "Aftalen er sendt til kunden",
        afventer_kunde: "Aftalen afventer kundes svar",
        godkendt: "Aftalen er godkendt",
        underskrevet: "Aftalen er underskrevet og aktiveret",
        aktiv: "Aftalen er nu aktiv",
        opsagt: "Aftalen er opsagt",
      };
      toast({ title: labels[vars.status] ?? "Status opdateret" });
      setReplyOpen(null);
      setSignOpen(null);
      setCancelOpen(null);
      setSignatureName("");
      setCancellationReason("");
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke opdatere status",
        description: e.message,
        variant: "destructive",
      }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (a: CleaningAgreement) => {
      const cust = customerById(a.customerId);
      const res = await apiRequest("POST", "/api/outbound-messages", {
        companyId,
        customerId: a.customerId,
        relatedType: "aftale",
        relatedId: a.id,
        channel: "email",
        recipientName: a.contactPerson || cust?.contactPerson || cust?.name || "",
        recipientEmail: a.contactEmail || cust?.email || "",
        recipientPhone: a.contactPhone || cust?.phone || "",
        subject: `Rengøringsaftale ${a.agreementNumber ?? ""} — ${a.name}`,
        body: `Kære ${a.contactPerson || cust?.name || ""},\n\nVi sender hermed vores forslag til rengøringsaftale (${a.agreementNumber ?? ""}).\n\nVenlig hilsen`,
        status: "kladde",
        aiGenerated: 0,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/outbound-messages"] });
    },
    onError: (e: any) =>
      toast({
        title: "Kunne ikke oprette besked",
        description: e.message,
        variant: "destructive",
      }),
  });

  const sendToCustomer = (a: CleaningAgreement) => {
    sendMessageMutation.mutate(a);
    statusMutation.mutate({
      id: a.id,
      status: "sendt",
      extra: { sentAt: new Date().toISOString() },
    });
  };

  // ── Form-håndtering ──
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(a: CleaningAgreement) {
    setEditing(a);
    let parsedLines: AgreementLine[] = [emptyLine()];
    try {
      const raw = a.agreementLines ? JSON.parse(a.agreementLines) : [];
      if (Array.isArray(raw) && raw.length > 0) parsedLines = raw;
    } catch {
      // ignorer
    }
    setForm({
      customerId: a.customerId ? String(a.customerId) : "",
      name: a.name ?? "",
      contactPerson: a.contactPerson ?? "",
      contactEmail: a.contactEmail ?? "",
      contactPhone: a.contactPhone ?? "",
      frequency: (a.frequency as Frequency) ?? "maanedligt",
      startDate: a.startDate?.slice(0, 10) ?? today(),
      endDate: a.endDate?.slice(0, 10) ?? "",
      agreementLines: parsedLines,
      totalSetup: String(num(a.totalSetup)),
      bindingPeriod: String(a.bindingPeriod ?? 0),
      noticePeriod: String(a.noticePeriod ?? 1),
      paymentTerms: (a.paymentTerms as PaymentTerms) ?? "8_dage",
      terms: a.terms ?? "",
      notes: a.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  // ── Prislinjer ──
  function updateLine(idx: number, patch: Partial<AgreementLine>) {
    setForm((prev) => {
      const lines = [...prev.agreementLines];
      lines[idx] = { ...lines[idx], ...patch };
      // Auto-udregn total
      const qty = num(lines[idx].quantity);
      const price = num(lines[idx].price);
      lines[idx].total = String(Math.round(qty * price * 100) / 100);
      return { ...prev, agreementLines: lines };
    });
  }

  function addLine() {
    setForm((prev) => ({
      ...prev,
      agreementLines: [...prev.agreementLines, emptyLine()],
    }));
  }

  function removeLine(idx: number) {
    setForm((prev) => ({
      ...prev,
      agreementLines:
        prev.agreementLines.length > 1
          ? prev.agreementLines.filter((_, i) => i !== idx)
          : prev.agreementLines,
    }));
  }

  function selectService(idx: number, serviceId: string) {
    const svc = services?.find((s) => s.id === Number(serviceId));
    if (svc) {
      updateLine(idx, {
        serviceId: svc.id,
        serviceName: svc.name,
        price: String(svc.price),
        unit: svc.unitType === "time" ? "timer" : svc.unitType === "kvm" ? "m2" : "md",
      });
    } else {
      updateLine(idx, { serviceId: null, serviceName: "" });
    }
  }

  function onCustomerChange(v: string) {
    const cust = customers?.find((c) => c.id === Number(v));
    setForm((prev) => ({
      ...prev,
      customerId: v,
      contactPerson: prev.contactPerson || cust?.contactPerson || cust?.name || "",
      contactEmail: prev.contactEmail || cust?.email || "",
      contactPhone: prev.contactPhone || cust?.phone || "",
    }));
  }

  const monthlyTotal = form.agreementLines.reduce((s, l) => s + num(l.total), 0);
  const pending = createMutation.isPending || updateMutation.isPending;
  const busy = statusMutation.isPending || sendMessageMutation.isPending;

  // ── Hjælpere til status ──
  function statusBadge(status: string) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "gray" as const };
    return (
      <span className={BADGE_CLASSES[cfg.variant]} data-testid={`status-agreement-${status}`}>
        {cfg.label}
      </span>
    );
  }

  function parseLines(a: CleaningAgreement | null): AgreementLine[] {
    if (!a) return [];
    try {
      const raw = a.agreementLines ? JSON.parse(a.agreementLines) : [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  // ── Render ──
  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <PageHeader
        title="Rengøringsaftaler"
        description="Løbende rengøringsaftaler med kunder — fra kladde til underskrift"
      />

      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-agreement">
              <Plus className="w-4 h-4 mr-1.5" />
              Opret aftale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Rediger aftale" : "Ny rengøringsaftale"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Grundlæggende oplysninger */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Grundlæggende oplysninger
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="agr-number">Aftalenummer</Label>
                    <Input
                      id="agr-number"
                      value={
                        editing?.agreementNumber ??
                        `A-${String((agreements?.length ?? 0) + 1).padStart(4, "0")}`
                      }
                      disabled
                      data-testid="input-agreement-number"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-customer">Kunde</Label>
                    <Select
                      value={form.customerId}
                      onValueChange={onCustomerChange}
                    >
                      <SelectTrigger id="agr-customer" data-testid="select-agreement-customer">
                        <SelectValue placeholder="Vælg kunde" />
                      </SelectTrigger>
                      <SelectContent>
                        {(customers ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="agr-name">Aftalens titel</Label>
                  <Input
                    id="agr-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="f.eks. Månedlig kontorrengøring"
                    data-testid="input-agreement-name"
                  />
                </div>
              </div>

              <Separator />

              {/* Kontaktperson */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Kontaktperson
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="agr-contact">Navn</Label>
                    <Input
                      id="agr-contact"
                      value={form.contactPerson}
                      onChange={(e) =>
                        setForm({ ...form, contactPerson: e.target.value })
                      }
                      placeholder="Kontaktperson"
                      data-testid="input-agreement-contact-person"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-contact-email">E-mail</Label>
                    <Input
                      id="agr-contact-email"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) =>
                        setForm({ ...form, contactEmail: e.target.value })
                      }
                      placeholder="email@eksempel.dk"
                      data-testid="input-agreement-contact-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-contact-phone">Telefon</Label>
                    <Input
                      id="agr-contact-phone"
                      value={form.contactPhone}
                      onChange={(e) =>
                        setForm({ ...form, contactPhone: e.target.value })
                      }
                      placeholder="Telefonnummer"
                      data-testid="input-agreement-contact-phone"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Planlægning */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Planlægning
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="agr-freq">Frekvens</Label>
                    <Select
                      value={form.frequency}
                      onValueChange={(v: Frequency) =>
                        setForm({ ...form, frequency: v })
                      }
                    >
                      <SelectTrigger id="agr-freq" data-testid="select-agreement-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-start">Startdato</Label>
                    <Input
                      id="agr-start"
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm({ ...form, startDate: e.target.value })
                      }
                      data-testid="input-agreement-startdate"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-end">Slutdato</Label>
                    <Input
                      id="agr-end"
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                      data-testid="input-agreement-enddate"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Prislinjer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Prislinjer
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    data-testid="button-add-line"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tilføj linje
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.agreementLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end p-2 rounded-md border border-border bg-muted/30"
                      data-testid={`agreement-line-${idx}`}
                    >
                      <div className="col-span-4 space-y-1">
                        <Label className="text-[11px]">Ydelse</Label>
                        <Select
                          value={line.serviceId ? String(line.serviceId) : ""}
                          onValueChange={(v) => selectService(idx, v)}
                        >
                          <SelectTrigger
                            className="h-8"
                            data-testid={`select-line-service-${idx}`}
                          >
                            <SelectValue placeholder="Vælg ydelse" />
                          </SelectTrigger>
                          <SelectContent>
                            {(services ?? []).map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[11px]">Antal</Label>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(idx, { quantity: e.target.value })
                          }
                          data-testid={`input-line-quantity-${idx}`}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[11px]">Enhed</Label>
                        <Select
                          value={line.unit}
                          onValueChange={(v) => updateLine(idx, { unit: v })}
                        >
                          <SelectTrigger
                            className="h-8"
                            data-testid={`select-line-unit-${idx}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[11px]">Pris (DKK)</Label>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.price}
                          onChange={(e) =>
                            updateLine(idx, { price: e.target.value })
                          }
                          data-testid={`input-line-price-${idx}`}
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-[11px]">Total</Label>
                        <p className="text-sm font-medium tabular-nums h-8 flex items-center">
                          {money(line.total)}
                        </p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-1.5 rounded-md hover:bg-muted text-destructive"
                          data-testid={`button-remove-line-${idx}`}
                          aria-label="Fjern linje"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Månedlig total
                  </span>
                  <span
                    className="text-base font-bold tabular-nums"
                    data-testid="monthly-total"
                  >
                    {money(monthlyTotal)}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Vilkår og betingelser */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Vilkår og betingelser
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="agr-setup">Engangsbeløb (DKK)</Label>
                    <Input
                      id="agr-setup"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.totalSetup}
                      onChange={(e) =>
                        setForm({ ...form, totalSetup: e.target.value })
                      }
                      data-testid="input-agreement-setup"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-payment">Betalingsbetingelser</Label>
                    <Select
                      value={form.paymentTerms}
                      onValueChange={(v: PaymentTerms) =>
                        setForm({ ...form, paymentTerms: v })
                      }
                    >
                      <SelectTrigger id="agr-payment" data-testid="select-agreement-payment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-binding">Bindingsperiode (måneder)</Label>
                    <Input
                      id="agr-binding"
                      type="number"
                      min="0"
                      value={form.bindingPeriod}
                      onChange={(e) =>
                        setForm({ ...form, bindingPeriod: e.target.value })
                      }
                      data-testid="input-agreement-binding"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agr-notice">Opsigelsesvarsel (måneder)</Label>
                    <Input
                      id="agr-notice"
                      type="number"
                      min="0"
                      value={form.noticePeriod}
                      onChange={(e) =>
                        setForm({ ...form, noticePeriod: e.target.value })
                      }
                      data-testid="input-agreement-notice"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="agr-terms">Aftalevilkår</Label>
                  <Textarea
                    id="agr-terms"
                    value={form.terms}
                    onChange={(e) =>
                      setForm({ ...form, terms: e.target.value })
                    }
                    rows={4}
                    placeholder="Skriv aftalens vilkår og betingelser..."
                    data-testid="input-agreement-terms"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="agr-notes">Noter</Label>
                  <Textarea
                    id="agr-notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    rows={2}
                    data-testid="input-agreement-notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background py-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeDialog}
                  data-testid="button-cancel-agreement"
                >
                  Annuller
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  data-testid="button-save-agreement"
                >
                  {pending
                    ? "Gemmer..."
                    : editing
                      ? "Gem ændringer"
                      : "Opret aftale"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      ) : (
        <SectionCard
          data-testid="card-agreements"
          title="Aftaler"
          icon={<FileSignature className="w-4 h-4" />}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="table-premium w-full min-w-[860px] text-sm">
              <thead>
                <tr>
                  <th>Aftalenummer</th>
                  <th>Kunde</th>
                  <th>Status</th>
                  <th>Frekvens</th>
                  <th className="text-right">Månedlig pris</th>
                  <th>Startdato</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(agreements ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-4 text-center text-muted-foreground"
                      data-testid="empty-agreements"
                    >
                      Ingen aftaler oprettet endnu.
                    </td>
                  </tr>
                ) : (
                  (agreements ?? []).map((a) => (
                    <tr key={a.id} data-testid={`row-agreement-${a.id}`}>
                      <td className="p-3 font-medium text-foreground tabular-nums">
                        {a.agreementNumber ?? `A-${String(a.id).padStart(4, "0")}`}
                      </td>
                      <td className="p-3 font-medium">
                        {customerName(a.customerId)}
                      </td>
                      <td className="p-3">{statusBadge(a.status)}</td>
                      <td className="p-3 text-muted-foreground">
                        {a.frequency ? FREQ_LABELS[a.frequency] ?? a.frequency : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {money(a.monthlyPrice)}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {dk(a.startDate)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setDetailId(a.id)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            data-testid={`button-view-agreement-${a.id}`}
                            aria-label="Vis aftale"
                            title="Vis aftale"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(a)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            data-testid={`button-edit-agreement-${a.id}`}
                            aria-label="Rediger aftale"
                            title="Rediger aftale"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(a.id)}
                            className="p-1.5 rounded-md hover:bg-muted text-destructive"
                            data-testid={`button-delete-agreement-${a.id}`}
                            aria-label="Slet aftale"
                            title="Slet aftale"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Detaljevisning ── */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detailAgreement && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">
                    {detailAgreement.agreementNumber ?? `A-${String(detailAgreement.id).padStart(4, "0")}`}
                  </span>
                  {statusBadge(detailAgreement.status)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Status-tidslinje */}
                <div className="flex items-center gap-1 flex-wrap p-3 rounded-md bg-muted/40">
                  {STATUS_TIMELINE.map((st, idx) => {
                    const currentIdx = STATUS_TIMELINE.indexOf(
                      detailAgreement.status as AgreementStatus,
                    );
                    const reached = idx <= currentIdx;
                    return (
                      <div key={st} className="flex items-center">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                            reached
                              ? BADGE_CLASSES[STATUS_CONFIG[st].variant]
                              : "text-muted-foreground"
                          }`}
                        >
                          {STATUS_CONFIG[st].label}
                        </div>
                        {idx < STATUS_TIMELINE.length - 1 && (
                          <div
                            className={`w-4 h-px ${reached ? "bg-foreground/40" : "bg-border"}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grundlæggende */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Kunde</p>
                    <p className="font-medium">{customerName(detailAgreement.customerId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Titel</p>
                    <p className="font-medium">{detailAgreement.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Frekvens</p>
                    <p className="font-medium">
                      {detailAgreement.frequency ? FREQ_LABELS[detailAgreement.frequency] ?? detailAgreement.frequency : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Betalingsbetingelser</p>
                    <p className="font-medium">
                      {detailAgreement.paymentTerms ? PAYMENT_TERMS_LABELS[detailAgreement.paymentTerms] ?? detailAgreement.paymentTerms : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Periode</p>
                    <p className="font-medium">
                      {dk(detailAgreement.startDate)} – {dk(detailAgreement.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Kontaktperson</p>
                    <p className="font-medium">
                      {detailAgreement.contactPerson || "—"}
                      {detailAgreement.contactEmail && ` · ${detailAgreement.contactEmail}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Bindingsperiode</p>
                    <p className="font-medium">{detailAgreement.bindingPeriod ?? 0} måneder</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Opsigelsesvarsel</p>
                    <p className="font-medium">{detailAgreement.noticePeriod ?? 1} måneder</p>
                  </div>
                </div>

                {/* Prislinjer */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Prislinjer
                  </h4>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="table-premium w-full text-sm">
                      <thead>
                        <tr>
                          <th className="p-2">Ydelse</th>
                          <th className="p-2 text-right">Antal</th>
                          <th className="p-2">Enhed</th>
                          <th className="p-2 text-right">Pris</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseLines(detailAgreement).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-3 text-center text-muted-foreground">
                              Ingen prislinjer.
                            </td>
                          </tr>
                        ) : (
                          parseLines(detailAgreement).map((l, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-2">{l.serviceName || "—"}</td>
                              <td className="p-2 text-right tabular-nums">{l.quantity}</td>
                              <td className="p-2">{l.unit}</td>
                              <td className="p-2 text-right tabular-nums">{money(l.price)}</td>
                              <td className="p-2 text-right tabular-nums font-medium">
                                {money(l.total)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Engangsbeløb: {money(detailAgreement.totalSetup)}
                    </span>
                    <span className="text-base font-bold tabular-nums">
                      Månedlig: {money(detailAgreement.monthlyPrice)}
                    </span>
                  </div>
                </div>

                {/* Aftalevilkår */}
                {detailAgreement.terms && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Aftalevilkår
                    </h4>
                    <p className="text-sm whitespace-pre-wrap p-3 rounded-md bg-muted/40">
                      {detailAgreement.terms}
                    </p>
                  </div>
                )}

                {detailAgreement.notes && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Noter
                    </h4>
                    <p className="text-sm whitespace-pre-wrap p-3 rounded-md bg-muted/40">
                      {detailAgreement.notes}
                    </p>
                  </div>
                )}

                {/* Status-historik */}
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Statushistorik
                  </h4>
                  <div className="space-y-1 text-sm">
                    {detailAgreement.sentAt && (
                      <p>Sendt til kunde: {dk(detailAgreement.sentAt)}</p>
                    )}
                    {detailAgreement.customerApprovedAt && (
                      <p>Godkendt af kunde: {dk(detailAgreement.customerApprovedAt)}</p>
                    )}
                    {detailAgreement.customerSignature && (
                      <p>Underskrevet af: {detailAgreement.customerSignature}</p>
                    )}
                    {detailAgreement.cancelledAt && (
                      <p className="text-destructive">
        Opsagt: {dk(detailAgreement.cancelledAt)}
                        {detailAgreement.cancellationReason && ` — ${detailAgreement.cancellationReason}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Workflow-knapper */}
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {detailAgreement.status === "kladde" && (
                    <Button
                      onClick={() => sendToCustomer(detailAgreement)}
                      disabled={busy}
                      data-testid="button-send-to-customer"
                    >
                      <Send className="w-4 h-4 mr-1.5" />
                      Send til kunde
                    </Button>
                  )}
                  {(detailAgreement.status === "sendt" ||
                    detailAgreement.status === "afventer_kunde") && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setReplyOpen(detailAgreement.id);
                          setReplyAccepted(true);
                        }}
                        disabled={busy}
                        data-testid="button-register-reply"
                      >
                        <MessageSquareReply className="w-4 h-4 mr-1.5" />
                        Registrer svar
                      </Button>
                      <Button
                        onClick={() =>
                          statusMutation.mutate({
                            id: detailAgreement.id,
                            status: "godkendt",
                            extra: {
                              customerApprovedAt: new Date().toISOString(),
                            },
                          })
                        }
                        disabled={busy}
                        data-testid="button-approve-agreement"
                      >
                        <Check className="w-4 h-4 mr-1.5" />
                        Godkend
                      </Button>
                    </>
                  )}
                  {detailAgreement.status === "godkendt" && (
                    <Button
                      onClick={() => setSignOpen(detailAgreement.id)}
                      disabled={busy}
                      data-testid="button-sign-agreement"
                    >
                      <PenLine className="w-4 h-4 mr-1.5" />
                      Underskriv
                    </Button>
                  )}
                  {detailAgreement.status === "underskrevet" && (
                    <Button
                      onClick={() =>
                        statusMutation.mutate({
                          id: detailAgreement.id,
                          status: "aktiv",
                        })
                      }
                      disabled={busy}
                      data-testid="button-activate-agreement"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Aktivér
                    </Button>
                  )}
                  {detailAgreement.status === "aktiv" && (
                    <Button
                      variant="destructive"
                      onClick={() => setCancelOpen(detailAgreement.id)}
                      disabled={busy}
                      data-testid="button-cancel-agreement"
                    >
                      <Ban className="w-4 h-4 mr-1.5" />
                      Opsig
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setDetailId(null)}
                    data-testid="button-close-detail"
                  >
                    Luk
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Registrer svar ── */}
      <Dialog
        open={replyOpen !== null}
        onOpenChange={(o) => !o && setReplyOpen(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrer kundes svar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registrer om kunden har accepteret eller afvist aftalen.
            </p>
            <div className="flex gap-2">
              <Button
                variant={replyAccepted ? "default" : "outline"}
                onClick={() => setReplyAccepted(true)}
                data-testid="button-reply-accepted"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Accepteret
              </Button>
              <Button
                variant={!replyAccepted ? "destructive" : "outline"}
                onClick={() => setReplyAccepted(false)}
                data-testid="button-reply-declined"
              >
                <X className="w-4 h-4 mr-1.5" />
                Afvist
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setReplyOpen(null)}
                data-testid="button-cancel-reply"
              >
                Annuller
              </Button>
              <Button
                onClick={() => {
                  if (replyOpen === null) return;
                  if (replyAccepted) {
                    statusMutation.mutate({
                      id: replyOpen,
                      status: "afventer_kunde",
                    });
                  } else {
                    statusMutation.mutate({
                      id: replyOpen,
                      status: "udløbet",
                    });
                  }
                }}
                disabled={busy}
                data-testid="button-confirm-reply"
              >
                Bekræft svar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Underskriv ── */}
      <Dialog
        open={signOpen !== null}
        onOpenChange={(o) => !o && setSignOpen(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Underskriv aftale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Indtast kundens navn som elektronisk underskrift. Aftalen vil blive
              underskrevet og aktiveret.
            </p>
            <div className="space-y-1">
              <Label htmlFor="signature-name">Kundens navn (underskrift)</Label>
              <Input
                id="signature-name"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Indtast fulde navn"
                data-testid="input-signature-name"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setSignOpen(null)}
                data-testid="button-cancel-sign"
              >
                Annuller
              </Button>
              <Button
                onClick={() => {
                  if (signOpen === null) return;
                  if (!signatureName.trim()) {
                    toast({
                      title: "Indtast navn",
                      description: "Kundens navn skal angives som underskrift.",
                      variant: "destructive",
                    });
                    return;
                  }
                  statusMutation.mutate({
                    id: signOpen,
                    status: "aktiv",
                    extra: {
                      customerSignature: signatureName,
                      customerApprovedAt: new Date().toISOString(),
                    },
                  });
                }}
                disabled={busy}
                data-testid="button-confirm-sign"
              >
                <PenLine className="w-4 h-4 mr-1.5" />
                Underskriv og aktivér
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Opsig ── */}
      <Dialog
        open={cancelOpen !== null}
        onOpenChange={(o) => !o && setCancelOpen(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opsig aftale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Angiv venligst årsagen til opsigelse. Aftalen vil blive markeret som
              opsagt med dags dato.
            </p>
            <div className="space-y-1">
              <Label htmlFor="cancel-reason">Opsigelsesårsag</Label>
              <Textarea
                id="cancel-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                placeholder="f.eks. Kundens ønske, flytning, etc."
                data-testid="input-cancel-reason"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setCancelOpen(null)}
                data-testid="button-cancel-cancel"
              >
                Annuller
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (cancelOpen === null) return;
                  statusMutation.mutate({
                    id: cancelOpen,
                    status: "opsagt",
                    extra: {
                      cancelledAt: new Date().toISOString(),
                      cancellationReason: cancellationReason || null,
                    },
                  });
                }}
                disabled={busy}
                data-testid="button-confirm-cancel"
              >
                <Ban className="w-4 h-4 mr-1.5" />
                Bekræft opsigelse
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionCard } from "@/components/premium";
import { FunctionMenu, type FunctionMenuItem } from "@/components/function-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Receipt, CreditCard, FileText, Clock, Timer, AlignLeft, Users, Package, Database, AlertTriangle, Save, UserPlus, CalendarClock, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Company, User, Employee, Plan, Subscription, CustomPaymentTerm } from "@shared/schema";

// ── Etiketter ──
const VAT_MODE_LABELS: Record<string, string> = {
  dansk: "Dansk moms",
  eu_omvendt: "EU-omvendt moms",
  eksport_fritaget: "Eksport / fritaget",
  momsfri: "Momsfri",
};

const CURRENCIES = ["DKK", "EUR", "USD", "SEK", "NOK"] as const;

const COMPANY_STATUS: Record<string, { label: string; style: string }> = {
  proeve: { label: "Prøveperiode", style: "badge-soft badge-soft-blue" },
  aktiv: { label: "Aktiv", style: "badge-soft badge-soft-green" },
  i_restance: { label: "I restance", style: "badge-soft badge-soft-amber" },
  spaerret: { label: "Spærret", style: "badge-soft badge-soft-red" },
  opsagt: { label: "Opsagt", style: "badge-soft badge-soft-red" },
};

const SUB_STATUS: Record<string, { label: string; style: string }> = {
  proeve: { label: "Prøveperiode", style: "badge-soft badge-soft-blue" },
  aktiv: { label: "Aktivt", style: "badge-soft badge-soft-green" },
  i_restance: { label: "I restance", style: "badge-soft badge-soft-amber" },
  opsagt: { label: "Opsagt", style: "badge-soft badge-soft-red" },
};

const ROLE_LABELS: Record<string, string> = {
  leder: "Leder",
  holdleder: "Holdleder",
  assistent: "Assistent",
  kunde: "Kunde",
  platform_admin: "Platformadministrator",
};

const BILLING_LABELS: Record<string, string> = {
  maanedlig: "Månedlig",
  aarlig: "Årlig",
};

// ── Standard betalingsbetingelser (skrivebeskyttede) ──
const STANDARD_PAYMENT_TERMS: Array<{ name: string; days: number }> = [
  { name: "8 dage", days: 8 },
  { name: "14 dage", days: 14 },
  { name: "30 dage", days: 30 },
  { name: "60 dage", days: 60 },
  { name: "Kontant", days: 0 },
];

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

export default function Virksomhed() {
  const { user, company: authCompany, plan: authPlan, subscription: authSub } = useAuth();
  const { toast } = useToast();
  const role = user?.role || "assistent";
  const canEdit = role === "leder" || role === "platform_admin";

  const [activeFn, setActiveFn] = useState("generelt");
  const functionItems: FunctionMenuItem[] = [
    { id: "generelt", label: "Generelt", icon: <Building className="w-4 h-4" /> },
    { id: "okonomi", label: "Økonomi", icon: <Receipt className="w-4 h-4" /> },
    { id: "betalingsbetingelser", label: "Betalingsbetingelser", icon: <CalendarClock className="w-4 h-4" /> },
    { id: "drift", label: "Drift", icon: <Clock className="w-4 h-4" /> },
    { id: "system", label: "System", icon: <Database className="w-4 h-4" /> },
  ];

  // ── Form-tilstand ──
  const [name, setName] = useState("");
  const [cvr, setCvr] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const [vatRate, setVatRate] = useState("25");
  const [vatMode, setVatMode] = useState("dansk");
  const [currency, setCurrency] = useState("DKK");

  // ── Betalingsinformation ──
  const [paymentTerms, setPaymentTerms] = useState("8");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");

  // ── Faktura-indstillinger ──
  const [invoicePrefix, setInvoicePrefix] = useState("FA");
  const [invoiceNextNumber, setInvoiceNextNumber] = useState("1");
  const [offerPrefix, setOfferPrefix] = useState("TI");
  const [offerNextNumber, setOfferNextNumber] = useState("1");
  const [autoApproveInvoices, setAutoApproveInvoices] = useState(false);
  const [autoAddTimeToInvoice, setAutoAddTimeToInvoice] = useState(false);
  const [autoAddMaterialsToInvoice, setAutoAddMaterialsToInvoice] = useState(false);

  const [retentionTimeEntries, setRetentionTimeEntries] = useState("60");
  const [retentionGps, setRetentionGps] = useState("6");
  const [retentionAbsences, setRetentionAbsences] = useState("60");
  const [retentionPhotos, setRetentionPhotos] = useState("24");

  // ── Åbningstider ──
  const [openingHours, setOpeningHours] = useState<
    Array<{ day: string; open: string; close: string }>
  >([
    { day: "mandag", open: "08:00", close: "16:00" },
    { day: "tirsdag", open: "08:00", close: "16:00" },
    { day: "onsdag", open: "08:00", close: "16:00" },
    { day: "torsdag", open: "08:00", close: "16:00" },
    { day: "fredag", open: "08:00", close: "16:00" },
    { day: "lørdag", open: "", close: "" },
    { day: "søndag", open: "", close: "" },
  ]);

  // ── Timeregistrering ──
  const [workingHoursType, setWorkingHoursType] = useState("interval");
  const [autoBreakMinutes, setAutoBreakMinutes] = useState("30");
  const [timeReportFrequency, setTimeReportFrequency] = useState("monthly");
  const [autoTimeReport, setAutoTimeReport] = useState(true);

  // ── Faste tekster ──
  const [invoiceStandardText, setInvoiceStandardText] = useState("");
  const [offerStandardText, setOfferStandardText] = useState("");
  const [reminderStandardText, setReminderStandardText] = useState("");

  // ── Generelt: yderligere felter ──
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [ean, setEan] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");

  // ── Økonomi: yderligere felter ──
  const [paymentTermsSelect, setPaymentTermsSelect] = useState("8");
  const [vatPeriod, setVatPeriod] = useState("kvartal");
  const [fiscalYearStart, setFiscalYearStart] = useState("");

  // ── Drift: yderligere felter ──
  const [serviceAreas, setServiceAreas] = useState("");
  const [standardHourlyRate, setStandardHourlyRate] = useState("");
  const [mileageSurcharge, setMileageSurcharge] = useState("");
  const [materialSurcharge, setMaterialSurcharge] = useState("");
  const [cleaningFrequency, setCleaningFrequency] = useState("ugentligt");

  // ── System: yderligere felter ──
  const [backupPolicy, setBackupPolicy] = useState("ugentlig");
  const [dpaStatus, setDpaStatus] = useState("aktiv");
  const [dataRetention, setDataRetention] = useState("5");
  const [auditTrail, setAuditTrail] = useState("aktiv");

  // ── Indlæs virksomhedsdata ──
  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["/api/company"],
  });

  // Brugere — kræver leder-rolle, så holdleder får en fejl der håndteres graceful.
  const { data: users, isLoading: usersLoading, isError: usersError } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // ── Custom betalingsbetingelser ──
  const { data: customTerms, isLoading: customTermsLoading } = useQuery<CustomPaymentTerm[]>({
    queryKey: ["/api/custom-payment-terms"],
  });

  // Synkroniser formfelter når data ankommer.
  useEffect(() => {
    if (!company) return;
    setName(company.name ?? "");
    setCvr(company.cvr ?? "");
    setAddress(company.address ?? "");
    setPhone(company.phone ?? "");
    setEmail(company.email ?? "");
    setWebsite(company.website ?? "");
    setNotes(company.notes ?? "");
    setVatRate(String(company.vatRate ?? 25));
    setVatMode(company.vatMode ?? "dansk");
    setCurrency(company.currency ?? "DKK");
    setPaymentTerms(String(company.paymentTerms ?? 8));
    setBankName(company.bankName ?? "");
    setBankAccount(company.bankAccount ?? "");
    setIban(company.iban ?? "");
    setSwift(company.swift ?? "");
    setInvoiceAddress(company.invoiceAddress ?? "");
    setInvoicePrefix(company.invoicePrefix ?? "FA");
    setInvoiceNextNumber(String(company.invoiceNextNumber ?? 1));
    setOfferPrefix(company.offerPrefix ?? "TI");
    setOfferNextNumber(String(company.offerNextNumber ?? 1));
    setAutoApproveInvoices(Number(company.autoApproveInvoices ?? 0) === 1);
    setAutoAddTimeToInvoice(Number(company.autoAddTimeToInvoice ?? 0) === 1);
    setAutoAddMaterialsToInvoice(Number(company.autoAddMaterialsToInvoice ?? 0) === 1);
    setRetentionTimeEntries(String(company.retentionTimeEntries ?? 60));
    setRetentionGps(String(company.retentionGps ?? 6));
    setRetentionAbsences(String(company.retentionAbsences ?? 60));
    setRetentionPhotos(String(company.retentionPhotos ?? 24));

    // ── Åbningstider ──
    try {
      const parsed = (company as any).openingHours ? JSON.parse((company as any).openingHours) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const days = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
        const normalized = days.map((day) => {
          const found = parsed.find((d: any) => d.day === day);
          return { day, open: found?.open ?? "", close: found?.close ?? "" };
        });
        setOpeningHours(normalized);
      }
    } catch {
      // behold default
    }

    // ── Timeregistrering ──
    setWorkingHoursType((company as any).workingHoursType ?? "interval");
    setAutoBreakMinutes(String((company as any).autoBreakMinutes ?? 30));
    setTimeReportFrequency((company as any).timeReportFrequency ?? "monthly");
    setAutoTimeReport(((company as any).timeReportFrequency ?? "monthly") !== "none");

    // ── Faste tekster ──
    setInvoiceStandardText((company as any).invoiceStandardText ?? "");
    setOfferStandardText((company as any).offerStandardText ?? "");
    setReminderStandardText((company as any).reminderStandardText ?? "");

    // ── Generelt: yderligere felter ──
    setPostcode((company as any).postcode ?? (company as any).postalCode ?? "");
    setCity((company as any).city ?? "");
    setEan((company as any).ean ?? "");
    setInvoiceEmail((company as any).invoiceEmail ?? "");

    // ── Økonomi: yderligere felter ──
    setPaymentTermsSelect((company as any).paymentTermsSelect ?? "8");
    setVatPeriod((company as any).vatPeriod ?? "kvartal");
    setFiscalYearStart((company as any).fiscalYearStart ?? "");

    // ── Drift: yderligere felter ──
    setServiceAreas((company as any).serviceAreas ?? "");
    setStandardHourlyRate(String((company as any).standardHourlyRate ?? ""));
    setMileageSurcharge(String((company as any).mileageSurcharge ?? ""));
    setMaterialSurcharge(String((company as any).materialSurcharge ?? ""));
    setCleaningFrequency((company as any).cleaningFrequency ?? "ugentligt");

    // ── System: yderligere felter ──
    setBackupPolicy((company as any).backupPolicy ?? "ugentlig");
    setDpaStatus((company as any).dpaStatus ?? "aktiv");
    setDataRetention((company as any).dataRetention ?? "5");
    setAuditTrail((company as any).auditTrail ?? "aktiv");
  }, [company]);

  // ── Mutationer ──
  const updateCompany = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const res = await apiRequest("PATCH", "/api/company", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke gemme", description: e.message, variant: "destructive" }),
  });

  const handleSaveCompany = () => {
    updateCompany.mutate(
      { name, cvr, address, postcode, city, phone, email, website, ean, invoiceEmail, notes } as any,
      {
        onSuccess: () =>
          toast({ title: "Virksomhedsoplysninger gemt" }),
      },
    );
  };

  const handleSavePayment = () => {
    updateCompany.mutate(
      {
        paymentTerms: Number(paymentTerms),
        bankName,
        bankAccount,
        iban,
        swift,
        invoiceAddress,
      },
      {
        onSuccess: () =>
          toast({ title: "Betalingsinformation gemt" }),
      },
    );
  };

  const handleSaveInvoiceSettings = () => {
    updateCompany.mutate(
      {
        invoicePrefix,
        invoiceNextNumber: Number(invoiceNextNumber),
        offerPrefix,
        offerNextNumber: Number(offerNextNumber),
        autoApproveInvoices: Number(autoApproveInvoices),
        autoAddTimeToInvoice: Number(autoAddTimeToInvoice),
        autoAddMaterialsToInvoice: Number(autoAddMaterialsToInvoice),
      },
      {
        onSuccess: () =>
          toast({ title: "Faktura-indstillinger gemt" }),
      },
    );
  };

  const handleSaveVat = () => {
    updateCompany.mutate(
      {
        vatRate: Number(vatRate),
        vatMode,
        currency,
        paymentTermsSelect,
        vatPeriod,
        fiscalYearStart,
      } as any,
      {
        onSuccess: () =>
          toast({ title: "Momsindstillinger gemt" }),
      },
    );
  };

  const handleSaveRetention = () => {
    updateCompany.mutate(
      {
        retentionTimeEntries: Number(retentionTimeEntries),
        retentionGps: Number(retentionGps),
        retentionAbsences: Number(retentionAbsences),
        retentionPhotos: Number(retentionPhotos),
      },
      {
        onSuccess: () =>
          toast({ title: "Opbevaringspolitik gemt" }),
      },
    );
  };

  const handleSaveOpeningHours = () => {
    updateCompany.mutate(
      { openingHours: JSON.stringify(openingHours) } as any,
      {
        onSuccess: () =>
          toast({ title: "Åbningstider gemt" }),
      },
    );
  };

  const handleSaveTimeSettings = () => {
    updateCompany.mutate(
      {
        workingHoursType,
        autoBreakMinutes: Number(autoBreakMinutes),
        timeReportFrequency: autoTimeReport ? timeReportFrequency : "none",
      } as any,
      {
        onSuccess: () =>
          toast({ title: "Timeregistrering gemt" }),
      },
    );
  };

  const handleSaveStandardTexts = () => {
    updateCompany.mutate(
      {
        invoiceStandardText,
        offerStandardText,
        reminderStandardText,
      } as any,
      {
        onSuccess: () =>
          toast({ title: "Faste tekster gemt" }),
      },
    );
  };

  // ── Drift: priser & service ──
  const handleSaveOperationSettings = () => {
    updateCompany.mutate(
      {
        serviceAreas,
        standardHourlyRate: standardHourlyRate === "" ? null : Number(standardHourlyRate),
        mileageSurcharge: mileageSurcharge === "" ? null : Number(mileageSurcharge),
        materialSurcharge: materialSurcharge === "" ? null : Number(materialSurcharge),
        cleaningFrequency,
      } as any,
      {
        onSuccess: () =>
          toast({ title: "Driftsindstillinger gemt" }),
      },
    );
  };

  // ── System: politikker ──
  const handleSaveSystemPolicies = () => {
    updateCompany.mutate(
      {
        backupPolicy,
        dpaStatus,
        dataRetention,
        auditTrail,
      } as any,
      {
        onSuccess: () =>
          toast({ title: "Systemindstillinger gemt" }),
      },
    );
  };

  // ── Tilføj bruger dialog ──
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("assistent");
  const [newUserPassword, setNewUserPassword] = useState("");

  const createUser = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string; password: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Bruger oprettet", description: `${newUserName} er tilføjet som ${ROLE_LABELS[newUserRole] ?? newUserRole}.` });
      setAddUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("assistent");
      setNewUserPassword("");
    },
    onError: (e: any) => {
      let msg = "Kunne ikke oprette bruger.";
      try { msg = JSON.parse(e.message).error || msg; } catch {}
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  const handleAddUser = () => setAddUserOpen(true);

  // ── Custom betalingsbetingelser: form & mutationer ──
  const [newTermName, setNewTermName] = useState("");
  const [newTermDays, setNewTermDays] = useState("30");
  const [editTermOpen, setEditTermOpen] = useState(false);
  const [editTermId, setEditTermId] = useState<number | null>(null);
  const [editTermName, setEditTermName] = useState("");
  const [editTermDays, setEditTermDays] = useState("30");

  const invalidateTerms = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/custom-payment-terms"] });

  const createTerm = useMutation({
    mutationFn: async (data: { name: string; days: number }) => {
      const res = await apiRequest("POST", "/api/custom-payment-terms", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateTerms();
      toast({ title: "Betalingsbetingelse oprettet" });
      setNewTermName("");
      setNewTermDays("30");
    },
    onError: (e: any) => {
      let msg = "Kunne ikke oprette betalingsbetingelse.";
      try { msg = JSON.parse(e.message).error || msg; } catch {}
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  const updateTerm = useMutation({
    mutationFn: async (args: { id: number; data: Partial<{ name: string; days: number; active: number }> }) => {
      const res = await apiRequest("PATCH", `/api/custom-payment-terms/${args.id}`, args.data);
      return res.json();
    },
    onSuccess: () => {
      invalidateTerms();
    },
    onError: (e: any) => {
      let msg = "Kunne ikke opdatere betalingsbetingelse.";
      try { msg = JSON.parse(e.message).error || msg; } catch {}
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/custom-payment-terms/${id}`);
    },
    onSuccess: () => {
      invalidateTerms();
      toast({ title: "Betalingsbetingelse slettet" });
    },
    onError: (e: any) => {
      let msg = "Kunne ikke slette betalingsbetingelse.";
      try { msg = JSON.parse(e.message).error || msg; } catch {}
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  const handleAddTerm = () => {
    const trimmed = newTermName.trim();
    if (!trimmed) {
      toast({ title: "Angiv et navn", variant: "destructive" });
      return;
    }
    const days = Number(newTermDays);
    if (!Number.isFinite(days) || days < 0) {
      toast({ title: "Ugyldigt antal dage", variant: "destructive" });
      return;
    }
    createTerm.mutate({ name: trimmed, days });
  };

  const openEditTerm = (term: CustomPaymentTerm) => {
    setEditTermId(term.id);
    setEditTermName(term.name);
    setEditTermDays(String(term.days));
    setEditTermOpen(true);
  };

  const handleSaveEditTerm = () => {
    if (editTermId == null) return;
    const trimmed = editTermName.trim();
    if (!trimmed) {
      toast({ title: "Angiv et navn", variant: "destructive" });
      return;
    }
    const days = Number(editTermDays);
    if (!Number.isFinite(days) || days < 0) {
      toast({ title: "Ugyldigt antal dage", variant: "destructive" });
      return;
    }
    updateTerm.mutate(
      { id: editTermId, data: { name: trimmed, days } },
      {
        onSuccess: () => {
          toast({ title: "Betalingsbetingelse opdateret" });
          setEditTermOpen(false);
          setEditTermId(null);
        },
      },
    );
  };

  const handleToggleActive = (term: CustomPaymentTerm) => {
    updateTerm.mutate({ id: term.id, data: { active: term.active ? 0 : 1 } });
  };

  const handleDeleteTerm = (term: CustomPaymentTerm) => {
    deleteTerm.mutate(term.id);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>
    );
  }

  const employeeCount = employees?.length ?? 0;
  const status = authCompany?.status
    ? COMPANY_STATUS[authCompany.status] ?? { label: authCompany.status, style: "bg-muted text-muted-foreground" }
    : null;
  const subStatus = authSub?.status
    ? SUB_STATUS[authSub.status] ?? { label: authSub.status, style: "bg-muted text-muted-foreground" }
    : null;
  const maxEmployees = authPlan?.maxEmployees ?? 0;
  const limitText = maxEmployees < 0 ? `${employeeCount} / ubegrænset` : `${employeeCount} / ${maxEmployees}`;

  return (
    <div className="p-3 md:p-4 pb-24 space-y-3 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Indstillinger"
        title="Virksomhed"
        description="Virksomhedsoplysninger og konfiguration"
      />

      <FunctionMenu items={functionItems} active={activeFn} onChange={setActiveFn} />

      {/* 1. Virksomhedsoplysninger */}
      {activeFn === "generelt" && (
      <div data-testid="card-company-info">
        <SectionCard
          title="Virksomhedsoplysninger"
          icon={<Building className="w-4 h-4" />}
        >
          <div className="space-y-3">
            {/* Logo upload (visuelt placeholder) */}
            <div className="flex items-center gap-4" data-testid="logo-upload-area">
              <div
                className="flex h-[100px] w-[100px] items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/40"
                data-testid="logo-placeholder"
              >
                <span className="text-xl font-semibold text-muted-foreground select-none">
                  {(name || "?").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Virksomhedslogo</p>
                <p className="text-xs text-muted-foreground">Upload et firmanavn-logo (PNG/SVG, max 1 MB).</p>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-upload-logo"
                  disabled={!canEdit}
                  onClick={() => toast({ title: "Logoupload er ikke tilgængelig endnu" })}
                >
                  Upload logo
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="company-name" data-testid="label-name">Navn</Label>
                <Input
                  id="company-name"
                  data-testid="input-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-cvr" data-testid="label-cvr">CVR-nummer</Label>
                <Input
                  id="company-cvr"
                  data-testid="input-cvr"
                  value={cvr}
                  onChange={(e) => setCvr(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-address" data-testid="label-address">Adresse</Label>
              <Input
                id="company-address"
                data-testid="input-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="company-postcode" data-testid="label-postcode">Postnummer</Label>
                <Input
                  id="company-postcode"
                  data-testid="input-postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-city" data-testid="label-city">By</Label>
                <Input
                  id="company-city"
                  data-testid="input-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="company-phone" data-testid="label-phone">Telefon</Label>
                <Input
                  id="company-phone"
                  data-testid="input-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-email" data-testid="label-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  data-testid="input-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-website" data-testid="label-website">Hjemmeside</Label>
                <Input
                  id="company-website"
                  type="url"
                  data-testid="input-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={!canEdit}
                  placeholder="https://www.virksomhed.dk"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="company-ean" data-testid="label-ean">EAN-nummer</Label>
                <Input
                  id="company-ean"
                  data-testid="input-ean"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  disabled={!canEdit}
                  placeholder="EAN-nummer til fakturering"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-invoice-email" data-testid="label-invoice-email">Faktura-email</Label>
                <Input
                  id="company-invoice-email"
                  type="email"
                  data-testid="input-invoice-email"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  disabled={!canEdit}
                  placeholder="faktura@virksomhed.dk"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-notes" data-testid="label-notes">Noter</Label>
              <Textarea
                id="company-notes"
                data-testid="input-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={!canEdit}
                placeholder="Interne noter om virksomheden"
              />
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button
                data-testid="button-save-company"
                onClick={handleSaveCompany}
                disabled={updateCompany.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateCompany.isPending ? "Gemmer..." : "Gem ændringer"}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 2. Moms & Fakturering */}
      {activeFn === "okonomi" && (
      <div data-testid="card-vat">
        <SectionCard
          title="Moms & Fakturering"
          icon={<Receipt className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vat-rate" data-testid="label-vat-rate">Momsats (%)</Label>
                <Input
                  id="vat-rate"
                  type="number"
                  data-testid="input-vat-rate"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  disabled={!canEdit}
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>
              <div className="space-y-2">
                <Label data-testid="label-vat-mode">Momstilstand</Label>
                <Select
                  value={vatMode}
                  onValueChange={setVatMode}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-vat-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VAT_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value} data-testid={`option-vat-mode-${value}`}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label data-testid="label-currency">Valuta</Label>
                <Select
                  value={currency}
                  onValueChange={setCurrency}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c} data-testid={`option-currency-${c}`}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Yderligere økonomifelter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="space-y-2">
                <Label data-testid="label-payment-terms-select">Betalingsbetingelser</Label>
                <Select
                  value={paymentTermsSelect}
                  onValueChange={setPaymentTermsSelect}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-payment-terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8" data-testid="option-payment-terms-8">8 dage</SelectItem>
                    <SelectItem value="14" data-testid="option-payment-terms-14">14 dage</SelectItem>
                    <SelectItem value="30" data-testid="option-payment-terms-30">30 dage</SelectItem>
                    <SelectItem value="60" data-testid="option-payment-terms-60">60 dage</SelectItem>
                    <SelectItem value="kontant" data-testid="option-payment-terms-kontant">Kontant</SelectItem>
                    {(customTerms ?? []).filter((t) => t.active === 1).map((t) => (
                      <SelectItem key={t.id} value={`custom:${t.id}`} data-testid={`option-payment-terms-custom-${t.id}`}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label data-testid="label-vat-period">Momsstatus</Label>
                <Select
                  value={vatPeriod}
                  onValueChange={setVatPeriod}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-vat-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kvartal" data-testid="option-vat-period-kvartal">Kvartal</SelectItem>
                    <SelectItem value="halvaar" data-testid="option-vat-period-halvaar">Halvår</SelectItem>
                    <SelectItem value="maaned" data-testid="option-vat-period-maaned">Måned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscal-year-start" data-testid="label-fiscal-year-start">Regnskabsår start</Label>
                <Input
                  id="fiscal-year-start"
                  type="month"
                  data-testid="input-fiscal-year-start"
                  value={fiscalYearStart}
                  onChange={(e) => setFiscalYearStart(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button
                data-testid="button-save-vat"
                onClick={handleSaveVat}
                disabled={updateCompany.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateCompany.isPending ? "Gemmer..." : "Gem momsindstillinger"}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 3. Betalingsinformation */}
      {activeFn === "okonomi" && (
      <div data-testid="card-payment">
        <SectionCard
          title="Betalingsinformation"
          icon={<CreditCard className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="payment-terms" data-testid="label-payment-terms">
                  Betalingsbetingelser (Netto X dage)
                </Label>
                <Input
                  id="payment-terms"
                  type="number"
                  data-testid="input-payment-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={!canEdit}
                  min={0}
                  placeholder="8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-name" data-testid="label-bank-name">Bankens navn</Label>
                <Input
                  id="bank-name"
                  data-testid="input-bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Fx Danske Bank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-account" data-testid="label-bank-account">Kontonummer</Label>
                <Input
                  id="bank-account"
                  data-testid="input-bank-account"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iban" data-testid="label-iban">IBAN</Label>
                <Input
                  id="iban"
                  data-testid="input-iban"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  disabled={!canEdit}
                  placeholder="DK0000000000000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swift" data-testid="label-swift">SWIFT/BIC</Label>
                <Input
                  id="swift"
                  data-testid="input-swift"
                  value={swift}
                  onChange={(e) => setSwift(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-address" data-testid="label-invoice-address">
                Fakturaadresse
              </Label>
              <Input
                id="invoice-address"
                data-testid="input-invoice-address"
                value={invoiceAddress}
                onChange={(e) => setInvoiceAddress(e.target.value)}
                disabled={!canEdit}
                placeholder="Separat fakturaadresse (hvis forskellig fra virksomhedsadresse)"
              />
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button
                data-testid="button-save-payment"
                onClick={handleSavePayment}
                disabled={updateCompany.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateCompany.isPending ? "Gemmer..." : "Gem betalingsinfo"}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 4. Faktura-indstillinger */}
      {activeFn === "okonomi" && (
      <div data-testid="card-invoice-settings">
        <SectionCard
          title="Faktura-indstillinger"
          icon={<FileText className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invoice-prefix" data-testid="label-invoice-prefix">
                  Faktura-præfiks
                </Label>
                <Input
                  id="invoice-prefix"
                  data-testid="input-invoice-prefix"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  disabled={!canEdit}
                  placeholder="FA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-next-number" data-testid="label-invoice-next-number">
                  Næste fakturanummer
                </Label>
                <Input
                  id="invoice-next-number"
                  type="number"
                  data-testid="input-invoice-next-number"
                  value={invoiceNextNumber}
                  onChange={(e) => setInvoiceNextNumber(e.target.value)}
                  disabled={!canEdit}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-prefix" data-testid="label-offer-prefix">
                  Tilbud-præfiks
                </Label>
                <Input
                  id="offer-prefix"
                  data-testid="input-offer-prefix"
                  value={offerPrefix}
                  onChange={(e) => setOfferPrefix(e.target.value)}
                  disabled={!canEdit}
                  placeholder="TI"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-next-number" data-testid="label-offer-next-number">
                  Næste tilbudnummer
                </Label>
                <Input
                  id="offer-next-number"
                  type="number"
                  data-testid="input-offer-next-number"
                  value={offerNextNumber}
                  onChange={(e) => setOfferNextNumber(e.target.value)}
                  disabled={!canEdit}
                  min={1}
                />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <label htmlFor="auto-approve-invoices" className="flex items-center gap-2 cursor-pointer" data-testid="label-auto-approve-invoices">
                <input
                  id="auto-approve-invoices"
                  type="checkbox"
                  data-testid="input-auto-approve-invoices"
                  checked={autoApproveInvoices}
                  onChange={(e) => setAutoApproveInvoices(e.target.checked)}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">Godkend automatisk elektroniske fakturaer</span>
              </label>
              <label htmlFor="auto-add-time" className="flex items-center gap-2 cursor-pointer" data-testid="label-auto-add-time">
                <input
                  id="auto-add-time"
                  type="checkbox"
                  data-testid="input-auto-add-time"
                  checked={autoAddTimeToInvoice}
                  onChange={(e) => setAutoAddTimeToInvoice(e.target.checked)}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">Tilføj automatisk timer til fakturakladde</span>
              </label>
              <label htmlFor="auto-add-materials" className="flex items-center gap-2 cursor-pointer" data-testid="label-auto-add-materials">
                <input
                  id="auto-add-materials"
                  type="checkbox"
                  data-testid="input-auto-add-materials"
                  checked={autoAddMaterialsToInvoice}
                  onChange={(e) => setAutoAddMaterialsToInvoice(e.target.checked)}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">Tilføj automatisk materialer til fakturakladde</span>
              </label>
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button
                data-testid="button-save-invoice-settings"
                onClick={handleSaveInvoiceSettings}
                disabled={updateCompany.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateCompany.isPending ? "Gemmer..." : "Gem indstillinger"}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 4b. Betalingsbetingelser (standard + egne) */}
      {activeFn === "betalingsbetingelser" && (
      <div data-testid="card-payment-terms">
        <SectionCard
          title="Betalingsbetingelser"
          icon={<CalendarClock className="w-4 h-4" />}
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground" data-testid="payment-terms-hint">
              Standardbetingelser er faste. Tilføj egne betalingsbetingelser, så de kan vælges på fakturaer og tilbud.
            </p>

            {/* Standardbetingelser (skrivebeskyttede) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="standard-terms-badge">Standard</Badge>
                <span className="text-sm font-medium">Standardbetingelser</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="standard-terms-list">
                {STANDARD_PAYMENT_TERMS.map((t) => (
                  <div
                    key={t.name}
                    data-testid={`standard-term-${t.days}`}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.days === 0 ? "Kontant betaling" : `${t.days} dage`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Opret ny custom betingelse */}
            {canEdit && (
              <div className="space-y-2 rounded-md border border-dashed border-border p-3" data-testid="create-term-form">
                <div className="text-sm font-medium">Tilføj egen betalingsbetingelse</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new-term-name" data-testid="label-new-term-name">Navn</Label>
                    <Input
                      id="new-term-name"
                      data-testid="input-new-term-name"
                      value={newTermName}
                      onChange={(e) => setNewTermName(e.target.value)}
                      placeholder="Fx 45 dage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-term-days" data-testid="label-new-term-days">Dage</Label>
                    <Input
                      id="new-term-days"
                      type="number"
                      min={0}
                      data-testid="input-new-term-days"
                      value={newTermDays}
                      onChange={(e) => setNewTermDays(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                </div>
                <Button
                  data-testid="button-add-term"
                  onClick={handleAddTerm}
                  disabled={createTerm.isPending || !newTermName.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createTerm.isPending ? "Tilføjer..." : "Tilføj betingelse"}
                </Button>
              </div>
            )}

            {/* Liste over custom betingelser */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Egne betalingsbetingelser</div>
              {customTermsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !customTerms || customTerms.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4" data-testid="custom-terms-empty">
                  Ingen egne betalingsbetingelser endnu.
                </div>
              ) : (
                <div className="space-y-2" data-testid="custom-terms-list">
                  {customTerms.map((term) => (
                    <div
                      key={term.id}
                      data-testid={`custom-term-row-${term.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" data-testid={`custom-term-name-${term.id}`}>{term.name}</p>
                        <p className="text-[11px] text-muted-foreground" data-testid={`custom-term-days-${term.id}`}>
                          {term.days === 0 ? "Kontant" : `${term.days} dage`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer" data-testid={`label-term-active-${term.id}`}>
                          <Switch
                            checked={term.active === 1}
                            onCheckedChange={() => handleToggleActive(term)}
                            disabled={!canEdit || updateTerm.isPending}
                            data-testid={`switch-term-active-${term.id}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {term.active === 1 ? "Aktiv" : "Inaktiv"}
                          </span>
                        </label>
                        {canEdit && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-edit-term-${term.id}`}
                              onClick={() => openEditTerm(term)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Rediger
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-delete-term-${term.id}`}
                              onClick={() => handleDeleteTerm(term)}
                              disabled={deleteTerm.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Slet
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
      )}

      {/* 5. Åbningstider */}
      {activeFn === "drift" && canEdit && (
        <div data-testid="card-opening-hours">
          <SectionCard
            title="Åbningstider"
            icon={<Clock className="w-4 h-4" />}
          >
            <div className="space-y-3">
              {openingHours.map((entry, idx) => (
                <div key={entry.day} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end" data-testid={`opening-hours-row-${entry.day}`}>
                  <div className="space-y-2">
                    <Label data-testid={`label-opening-hours-day-${entry.day}`} className="capitalize">{entry.day}</Label>
                    <Input
                      type="text"
                      value={entry.day}
                      disabled
                      className="capitalize"
                      data-testid={`input-opening-hours-day-${entry.day}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`opening-hours-open-${entry.day}`} data-testid={`label-opening-hours-open-${entry.day}`}>Åbner</Label>
                    <Input
                      id={`opening-hours-open-${entry.day}`}
                      type="time"
                      data-testid={`input-opening-hours-open-${entry.day}`}
                      value={entry.open}
                      onChange={(e) => {
                        const next = [...openingHours];
                        next[idx] = { ...entry, open: e.target.value };
                        setOpeningHours(next);
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`opening-hours-close-${entry.day}`} data-testid={`label-opening-hours-close-${entry.day}`}>Lukker</Label>
                    <Input
                      id={`opening-hours-close-${entry.day}`}
                      type="time"
                      data-testid={`input-opening-hours-close-${entry.day}`}
                      value={entry.close}
                      onChange={(e) => {
                        const next = [...openingHours];
                        next[idx] = { ...entry, close: e.target.value };
                        setOpeningHours(next);
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  data-testid="button-save-opening-hours"
                  onClick={handleSaveOpeningHours}
                  disabled={updateCompany.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateCompany.isPending ? "Gemmer..." : "Gem åbningstider"}
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* 6. Timeregistrering */}
      {activeFn === "drift" && canEdit && (
        <div data-testid="card-time-settings">
          <SectionCard
            title="Timeregistrering"
            icon={<Timer className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label data-testid="label-working-hours-type">Arbejdstidstype</Label>
                  <Select
                    value={workingHoursType}
                    onValueChange={setWorkingHoursType}
                    disabled={!canEdit}
                  >
                    <SelectTrigger data-testid="select-working-hours-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interval" data-testid="option-working-hours-type-interval">Fast tidsinterval</SelectItem>
                      <SelectItem value="flex" data-testid="option-working-hours-type-flex">Fleksible timer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-break-minutes" data-testid="label-auto-break-minutes">Auto-pause (minutter)</Label>
                  <Input
                    id="auto-break-minutes"
                    type="number"
                    data-testid="input-auto-break-minutes"
                    value={autoBreakMinutes}
                    onChange={(e) => setAutoBreakMinutes(e.target.value)}
                    disabled={!canEdit}
                    min={0}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label data-testid="label-time-report-frequency">Timerapport frekvens</Label>
                  <Select
                    value={timeReportFrequency}
                    onValueChange={setTimeReportFrequency}
                    disabled={!canEdit}
                  >
                    <SelectTrigger data-testid="select-time-report-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly" data-testid="option-time-report-frequency-weekly">Ugentlig</SelectItem>
                      <SelectItem value="monthly" data-testid="option-time-report-frequency-monthly">Månedlig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label htmlFor="auto-time-report" className="flex items-center gap-2 cursor-pointer" data-testid="label-auto-time-report">
                <input
                  id="auto-time-report"
                  type="checkbox"
                  data-testid="input-auto-time-report"
                  checked={autoTimeReport}
                  onChange={(e) => setAutoTimeReport(e.target.checked)}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">Send automatisk timerapport</span>
              </label>
            </div>
            {canEdit && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  data-testid="button-save-time-settings"
                  onClick={handleSaveTimeSettings}
                  disabled={updateCompany.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateCompany.isPending ? "Gemmer..." : "Gem indstillinger"}
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* 7. Faste tekster */}
      {activeFn === "drift" && canEdit && (
        <div data-testid="card-standard-texts">
          <SectionCard
            title="Faste tekster"
            icon={<AlignLeft className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="invoice-standard-text" data-testid="label-invoice-standard-text">Standardtekst på fakturaer</Label>
                <Textarea
                  id="invoice-standard-text"
                  data-testid="input-invoice-standard-text"
                  value={invoiceStandardText}
                  onChange={(e) => setInvoiceStandardText(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  placeholder="Standardtekst der tilføjes fakturaer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-standard-text" data-testid="label-offer-standard-text">Standardtekst på tilbud</Label>
                <Textarea
                  id="offer-standard-text"
                  data-testid="input-offer-standard-text"
                  value={offerStandardText}
                  onChange={(e) => setOfferStandardText(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  placeholder="Standardtekst der tilføjes tilbud"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-standard-text" data-testid="label-reminder-standard-text">Standardtekst på rykkere</Label>
                <Textarea
                  id="reminder-standard-text"
                  data-testid="input-reminder-standard-text"
                  value={reminderStandardText}
                  onChange={(e) => setReminderStandardText(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  placeholder="Standardtekst der tilføjes rykkere"
                />
              </div>
            </div>
            {canEdit && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  data-testid="button-save-standard-texts"
                  onClick={handleSaveStandardTexts}
                  disabled={updateCompany.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateCompany.isPending ? "Gemmer..." : "Gem tekster"}
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* 7b. Service & priser */}
      {activeFn === "drift" && canEdit && (
        <div data-testid="card-operation-settings">
          <SectionCard
            title="Service & priser"
            icon={<CreditCard className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="service-areas" data-testid="label-service-areas">Serviceområder</Label>
                <Textarea
                  id="service-areas"
                  data-testid="input-service-areas"
                  value={serviceAreas}
                  onChange={(e) => setServiceAreas(e.target.value)}
                  rows={2}
                  disabled={!canEdit}
                  placeholder="København, Frederiksberg, Lyngby (kommasepareret)"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="standard-hourly-rate" data-testid="label-standard-hourly-rate">Standard timepris</Label>
                  <div className="relative">
                    <Input
                      id="standard-hourly-rate"
                      type="number"
                      data-testid="input-standard-hourly-rate"
                      value={standardHourlyRate}
                      onChange={(e) => setStandardHourlyRate(e.target.value)}
                      disabled={!canEdit}
                      min={0}
                      step={0.01}
                      placeholder="350"
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kr.</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage-surcharge" data-testid="label-mileage-surcharge">Kørselstillæg pr. km</Label>
                  <Input
                    id="mileage-surcharge"
                    type="number"
                    data-testid="input-mileage-surcharge"
                    value={mileageSurcharge}
                    onChange={(e) => setMileageSurcharge(e.target.value)}
                    disabled={!canEdit}
                    min={0}
                    step={0.01}
                    placeholder="3,25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material-surcharge" data-testid="label-material-surcharge">Materialetillæg</Label>
                  <div className="relative">
                    <Input
                      id="material-surcharge"
                      type="number"
                      data-testid="input-material-surcharge"
                      value={materialSurcharge}
                      onChange={(e) => setMaterialSurcharge(e.target.value)}
                      disabled={!canEdit}
                      min={0}
                      max={100}
                      step={0.1}
                      placeholder="10"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label data-testid="label-cleaning-frequency">Standard rengøringsfrekvens</Label>
                  <Select
                    value={cleaningFrequency}
                    onValueChange={setCleaningFrequency}
                    disabled={!canEdit}
                  >
                    <SelectTrigger data-testid="select-cleaning-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dagligt" data-testid="option-cleaning-frequency-dagligt">Dagligt</SelectItem>
                      <SelectItem value="ugentligt" data-testid="option-cleaning-frequency-ugentligt">Ugentligt</SelectItem>
                      <SelectItem value="hver-14-dag" data-testid="option-cleaning-frequency-hver-14-dag">Hver 14. dag</SelectItem>
                      <SelectItem value="maanedligt" data-testid="option-cleaning-frequency-maanedligt">Månedligt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  data-testid="button-save-operation-settings"
                  onClick={handleSaveOperationSettings}
                  disabled={updateCompany.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateCompany.isPending ? "Gemmer..." : "Gem indstillinger"}
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* 7c. Systemindstillinger */}
      {activeFn === "system" && (
      <div data-testid="card-system-policies">
        <SectionCard
          title="Systemindstillinger"
          icon={<Database className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label data-testid="label-backup-policy">Backup-politik</Label>
                <Select
                  value={backupPolicy}
                  onValueChange={setBackupPolicy}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-backup-policy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daglig" data-testid="option-backup-policy-daglig">Daglig</SelectItem>
                    <SelectItem value="ugentlig" data-testid="option-backup-policy-ugentlig">Ugentlig</SelectItem>
                    <SelectItem value="maanedlig" data-testid="option-backup-policy-maanedlig">Månedlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label data-testid="label-dpa-status">DPA/GDPR status</Label>
                <Select
                  value={dpaStatus}
                  onValueChange={setDpaStatus}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-dpa-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv" data-testid="option-dpa-status-aktiv">Aktiv</SelectItem>
                    <SelectItem value="indaktiveret" data-testid="option-dpa-status-indaktiveret">Indaktiveret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label data-testid="label-data-retention">Data retention</Label>
                <Select
                  value={dataRetention}
                  onValueChange={setDataRetention}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-data-retention">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" data-testid="option-data-retention-1">1 år</SelectItem>
                    <SelectItem value="3" data-testid="option-data-retention-3">3 år</SelectItem>
                    <SelectItem value="5" data-testid="option-data-retention-5">5 år</SelectItem>
                    <SelectItem value="7" data-testid="option-data-retention-7">7 år</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label data-testid="label-audit-trail">Revisionsspor</Label>
                <Select
                  value={auditTrail}
                  onValueChange={setAuditTrail}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-audit-trail">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv" data-testid="option-audit-trail-aktiv">Aktiv</SelectItem>
                    <SelectItem value="inaktiv" data-testid="option-audit-trail-inaktiv">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Skrivebeskyttede visningsfelter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">AI-support status</span>
                <p className="text-sm font-medium" data-testid="display-ai-support-status">
                  {(company as any)?.aiEnabled ? "Aktiv" : "Ikke aktiv"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Support-pakke</span>
                <p className="text-sm font-medium" data-testid="display-support-package">
                  {authPlan?.name ?? "—"}
                </p>
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button
                data-testid="button-save-system-policies"
                onClick={handleSaveSystemPolicies}
                disabled={updateCompany.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateCompany.isPending ? "Gemmer..." : "Gem indstillinger"}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 8. GDPR & Opbevaring (Dataretention) */}
      {activeFn === "system" && (
      <div data-testid="card-retention">
        <SectionCard
          title="Dataretention"
          icon={<Database className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="retention-hint">
              0 = gem uendeligt
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="retention-time" data-testid="label-retention-time">
                  Opbevaring af tidsregistreringer (måneder)
                </Label>
                <Input
                  id="retention-time"
                  type="number"
                  data-testid="input-retention-time"
                  value={retentionTimeEntries}
                  onChange={(e) => setRetentionTimeEntries(e.target.value)}
                  disabled={!canEdit}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention-gps" data-testid="label-retention-gps">
                  Opbevaring af GPS-data (måneder)
                </Label>
                <Input
                  id="retention-gps"
                  type="number"
                  data-testid="input-retention-gps"
                  value={retentionGps}
                  onChange={(e) => setRetentionGps(e.target.value)}
                  disabled={!canEdit}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention-absences" data-testid="label-retention-absences">
                  Opbevaring af fravær (måneder)
                </Label>
                <Input
                  id="retention-absences"
                  type="number"
                  data-testid="input-retention-absences"
                  value={retentionAbsences}
                  onChange={(e) => setRetentionAbsences(e.target.value)}
                  disabled={!canEdit}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention-photos" data-testid="label-retention-photos">
                  Opbevaring af fotos (måneder)
                </Label>
                <Input
                  id="retention-photos"
                  type="number"
                  data-testid="input-retention-photos"
                  value={retentionPhotos}
                  onChange={(e) => setRetentionPhotos(e.target.value)}
                  disabled={!canEdit}
                  min={0}
                />
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button
                data-testid="button-save-retention"
                onClick={handleSaveRetention}
                disabled={updateCompany.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateCompany.isPending ? "Gemmer..." : "Gem opbevaringspolitik"}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 9. Brugerstyring */}
      {activeFn === "system" && (
      <div data-testid="card-users">
        <SectionCard
          title="Brugerstyring"
          icon={<Users className="w-4 h-4" />}
          action={canEdit ? (
            <Button variant="outline" size="sm" data-testid="button-add-user" onClick={handleAddUser}>
              <UserPlus className="w-4 h-4 mr-2" />
              Tilføj bruger
            </Button>
          ) : undefined}
        >
          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : usersError || !users ? (
            <div className="text-xs text-muted-foreground py-4" data-testid="users-no-access">
              Du har ikke adgang til at se brugerlisten.
            </div>
          ) : users.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4" data-testid="users-empty">
              Ingen brugere fundet.
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} data-testid={`user-row-${u.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" data-testid={`user-name-${u.id}`}>{u.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate" data-testid={`user-email-${u.id}`}>{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    {u.active ? (
                      <Badge className="badge-soft badge-soft-green" data-testid={`user-status-${u.id}`}>
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`user-status-${u.id}`}>
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {/* 10. Abonnement */}
      {activeFn === "system" && (
      <div data-testid="card-subscription">
        <SectionCard
          title="Abonnement"
          icon={<Package className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Pakketype</span>
                <p className="text-sm font-medium" data-testid="subscription-plan-name">
                  {authPlan?.name ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Pris (pr. måned, ekskl. moms)</span>
                <p className="text-sm font-medium" data-testid="subscription-price">
                  {authPlan ? `${authPlan.monthlyPrice} DKK` : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Ansatte</span>
                <p className="text-sm font-medium" data-testid="subscription-employees">
                  {limitText}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Faktureringsperiode</span>
                <p className="text-sm font-medium" data-testid="subscription-billing">
                  {authSub?.billingCycle ? BILLING_LABELS[authSub.billingCycle] ?? authSub.billingCycle : "—"}
                </p>
              </div>
            </div>
            {subStatus && (
              <div className="flex items-center gap-2" data-testid="subscription-status">
                <span className="text-xs text-muted-foreground">Abonnementsstatus:</span>
                <Badge className={subStatus.style}>{subStatus.label}</Badge>
              </div>
            )}
            {authSub?.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground">
                Næste periode udløber: {dkDate(authSub.currentPeriodEnd)}
              </p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border/50">
            <Button asChild variant="outline" data-testid="button-goto-subscription">
              <a href="#/abonnement">Gå til abonnement</a>
            </Button>
          </div>
        </SectionCard>
      </div>
      )}

      {/* 11. Farezone */}
      {activeFn === "system" && (
      <div data-testid="card-danger-zone">
        <SectionCard
          title="Farezone"
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          className="border-destructive/30"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2" data-testid="company-status">
              <span className="text-xs text-muted-foreground">Virksomhedsstatus:</span>
              {status ? (
                <Badge className={status.style}>{status.label}</Badge>
              ) : (
                <span className="text-xs">—</span>
              )}
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="danger-zone-info">
              Virksomhedens status (aktiv, prøve, spærret m.v.) kan kun ændres af ADD SmartRegnskab platformen.
              Kontakt support, hvis du mener status skal ændres.
            </div>
          </div>
        </SectionCard>
      </div>
      )}

      {/* Tilføj bruger dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-add-user">
          <DialogHeader>
            <DialogTitle className="text-lg">Tilføj bruger</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-name" data-testid="label-new-user-name">Navn</Label>
              <Input id="new-user-name" data-testid="input-new-user-name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Fx Mette Hansen" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-email" data-testid="label-new-user-email">E-mail</Label>
              <Input id="new-user-email" type="email" data-testid="input-new-user-email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="navn@firma.dk" />
            </div>
            <div className="space-y-2">
              <Label data-testid="label-new-user-role">Rolle</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger data-testid="select-new-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leder" data-testid="option-role-leder">Leder</SelectItem>
                  <SelectItem value="holdleder" data-testid="option-role-holdleder">Holdleder</SelectItem>
                  <SelectItem value="assistent" data-testid="option-role-assistent">Assistent</SelectItem>
                  <SelectItem value="kunde" data-testid="option-role-kunde">Kunde</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password" data-testid="label-new-user-password">Adgangskode (min. 8 tegn)</Label>
              <Input id="new-user-password" type="password" data-testid="input-new-user-password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Mindst 8 tegn" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)} data-testid="button-cancel-add-user">Annuller</Button>
            <Button
              data-testid="button-confirm-add-user"
              disabled={createUser.isPending || !newUserName || !newUserEmail || !newUserPassword || newUserPassword.length < 8}
              onClick={() => createUser.mutate({ name: newUserName, email: newUserEmail, role: newUserRole, password: newUserPassword })}
            >
              {createUser.isPending ? "Opretter..." : "Opret bruger"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rediger betalingsbetingelse dialog */}
      <Dialog open={editTermOpen} onOpenChange={setEditTermOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-term">
          <DialogHeader>
            <DialogTitle className="text-lg">Rediger betalingsbetingelse</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-term-name" data-testid="label-edit-term-name">Navn</Label>
              <Input
                id="edit-term-name"
                data-testid="input-edit-term-name"
                value={editTermName}
                onChange={(e) => setEditTermName(e.target.value)}
                placeholder="Fx 45 dage"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-term-days" data-testid="label-edit-term-days">Dage</Label>
              <Input
                id="edit-term-days"
                type="number"
                min={0}
                data-testid="input-edit-term-days"
                value={editTermDays}
                onChange={(e) => setEditTermDays(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTermOpen(false)} data-testid="button-cancel-edit-term">Annuller</Button>
            <Button
              data-testid="button-save-edit-term"
              disabled={updateTerm.isPending || !editTermName.trim()}
              onClick={handleSaveEditTerm}
            >
              {updateTerm.isPending ? "Gemmer..." : "Gem ændringer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

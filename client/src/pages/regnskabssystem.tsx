import { lazy, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, openAuthedFile, queryClient } from "@//lib/queryClient";
import { useAuth } from "@//lib/auth";
import { useToast } from "@//hooks/use-toast";
import { PageHeader, SectionCard, StatusChip } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Building2,
  BookOpen,
  FileText,
  CalendarClock,
  Sparkles,
  ScanLine,
  Check,
  X,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Receipt,
  Landmark,
  FileBarChart,
  Upload,
  Wand2,
  Trash2,
  Pencil,
  Banknote,
  TrendingUp,
  TrendingDown,
  Calculator,
  Clock,
  Inbox,
  FileCheck2,
  Zap,
  ArrowLeftRight,
  CalendarCheck,
  ListChecks,
  Plug,
  Plus,
  RefreshCw,
  Power,
  ListPlus,
  Settings2,
  Users,
  Building,
  Briefcase,
  CreditCard,
  Calendar,
  ShieldCheck,
  Wallet,
  BrainCircuit,
  ClipboardCheck,
  Lock,
  Package,
  Archive,
  Activity,
} from "lucide-react";

// ── Nye SmartRegnskab tab komponenter ──
const BankIntegrationer = lazy(() => import("@/pages/regnskab-tabs/bank-integrationer"));
const Arkivering = lazy(() => import("@/pages/regnskab-tabs/arkivering"));
const Lonindberetning = lazy(() => import("@/pages/regnskab-tabs/lonindberetning"));
const Arsrapport = lazy(() => import("@/pages/regnskab-tabs/arsrapport"));
const Debitorstyring = lazy(() => import("@/pages/regnskab-tabs/debitorstyring"));
const Periodisering = lazy(() => import("@/pages/regnskab-tabs/periodisering"));
const Lagerregnskab = lazy(() => import("@/pages/regnskab-tabs/lagerregnskab"));
const ValutaMoms = lazy(() => import("@/pages/regnskab-tabs/valuta-moms"));
const Revisorportal = lazy(() => import("@/pages/regnskab-tabs/revisorportal"));
const RollerKontrol = lazy(() => import("@/pages/regnskab-tabs/roller-kontrol"));
const Importguide = lazy(() => import("@/pages/regnskab-tabs/importguide"));
const ApiWebhooks = lazy(() => import("@/pages/regnskab-tabs/api-webhooks"));
// ── Ruge 2 SmartRegnskab tabs ──
const IntegrationConfigs = lazy(() => import("@/pages/regnskab-tabs/integration-configs"));
const ComplianceChecks = lazy(() => import("@/pages/regnskab-tabs/compliance-checks"));
const BankPayments = lazy(() => import("@/pages/regnskab-tabs/bank-payments"));
const EinvoiceQueue = lazy(() => import("@/pages/regnskab-tabs/einvoice-queue"));
const ApiKeysMgmt = lazy(() => import("@/pages/regnskab-tabs/api-keys-mgmt"));
const MigrationWizard = lazy(() => import("@/pages/regnskab-tabs/migration-wizard"));
const Konsolidering = lazy(() => import("@/pages/regnskab-tabs/konsolidering"));
const AvanceretMoms = lazy(() => import("@/pages/regnskab-tabs/avanceret-moms"));
const LonmotorRegnskab = lazy(() => import("@/pages/regnskab-tabs/lonmotor-regnskab"));
const Revisionspakke = lazy(() => import("@/pages/regnskab-tabs/revisionspakke"));
const BudgetScenarier = lazy(() => import("@/pages/regnskab-tabs/budget-scenarier"));
const Afstemningscenter = lazy(() => import("@/pages/regnskab-tabs/afstemningscenter"));
// ── Ruge 3 SmartRegnskab tabs ──
const BrancheProfil = lazy(() => import("@/pages/regnskab-tabs/branche-profil"));
const KontoplanSkabeloner = lazy(() => import("@/pages/regnskab-tabs/kontoplan-skabeloner"));
const Dimensioner = lazy(() => import("@/pages/regnskab-tabs/dimensioner"));
const Regnskabskategorier = lazy(() => import("@/pages/regnskab-tabs/regnskabskategorier"));
const Saft = lazy(() => import("@/pages/regnskab-tabs/saft"));
const WorkflowBuilder = lazy(() => import("@/pages/regnskab-tabs/workflow-builder"));
const IntegrationRuns = lazy(() => import("@/pages/regnskab-tabs/integration-runs"));
const RetryQueue = lazy(() => import("@/pages/regnskab-tabs/retry-queue"));
const Filhaandtering = lazy(() => import("@/pages/regnskab-tabs/filhåndtering"));
const Filversioner = lazy(() => import("@/pages/regnskab-tabs/filversioner"));
const ComplianceDokumenter = lazy(() => import("@/pages/regnskab-tabs/compliance-dokumenter"));
const Kontroltests = lazy(() => import("@/pages/regnskab-tabs/kontroltests"));
const Sikkerhedsaudit = lazy(() => import("@/pages/regnskab-tabs/sikkerhedsaudit"));
const Systemovervaagning = lazy(() => import("@/pages/regnskab-tabs/systemovervågning"));
const Leveringslog = lazy(() => import("@/pages/regnskab-tabs/leveringslog"));
const RbacRettigheder = lazy(() => import("@/pages/regnskab-tabs/rbac-rettigheder"));
const KundePortalIndstillinger = lazy(() => import("@/pages/regnskab-tabs/kunde-portal-indstillinger"));
const PortalDokumenter = lazy(() => import("@/pages/regnskab-tabs/portal-dokumenter"));
const BackupRegnskab = lazy(() => import("@/pages/regnskab-tabs/backup-regnskab"));
const Fakturering = lazy(() => import("@/pages/regnskab-tabs/fakturering"));
const Kundekartotek = lazy(() => import("@/pages/regnskab-tabs/kundekartotek"));
const Leverandoerkartotek = lazy(() => import("@/pages/regnskab-tabs/leverandoerkartotek"));
const Produktkartotek = lazy(() => import("@/pages/regnskab-tabs/produktkartotek"));
const FasteFakturaer = lazy(() => import("@/pages/regnskab-tabs/faste-fakturaer"));
const Kontrolcenter = lazy(() => import("@/pages/regnskab-tabs/kontrolcenter"));
const AiStyring = lazy(() => import("@/pages/regnskab-tabs/ai-styring"));
const Driftsklarhed = lazy(() => import("@/pages/regnskab-tabs/driftsklarhed"));
const Fagportal = lazy(() => import("@/pages/regnskab-tabs/fagportal"));
const Abonnement = lazy(() => import("@/pages/regnskab-tabs/abonnement"));
const Selskabsstruktur = lazy(() => import("@/pages/regnskab-tabs/selskabsstruktur"));

/* ---------- typer ---------- */

type CompanySummary = {
  id: number;
  name: string;
  accountCount?: number | null;
  entryCount?: number | null;
};

type PlatformCompanySummary = {
  id: number;
  name: string;
  cvr?: string | null;
  status?: string | null;
  createdAt?: string | null;
  employeeCount?: number | null;
  userCount?: number | null;
  planName?: string | null;
  planId?: number | null;
  subscriptionStatus?: string | null;
  billingCycle?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  monthlyValue?: number | null;
};

type PlatformStats = {
  companyCount: number;
  activeCount: number;
  trialCount: number;
  blockedCount: number;
  mrr: number;
};

type Account = {
  id: number;
  accountNumber: string;
  name: string;
  type: string;
  vatCode?: string | null;
  balance?: number | null;
};

type JournalLine = {
  accountId?: number | null;
  accountNumber?: string | null;
  accountName?: string | null;
  debit?: number | null;
  credit?: number | null;
};

type JournalEntry = {
  id: number;
  entryNumber?: string | null;
  date?: string | null;
  description?: string | null;
  reference?: string | null;
  sourceType?: string | null;
  status?: string | null;
  amount?: number | null;
  lines?: JournalLine[];
};

type VatPeriod = {
  id: number;
  period?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  vatType?: string | null;
  outputVat?: number | null;
  inputVat?: number | null;
  netVat?: number | null;
  status?: string | null;
  reportedAmount?: number | null;
  dueDate?: string | null;
};

type CompanyDetail = {
  company?: CompanySummary;
  accounts: Account[];
  entries: JournalEntry[];
  vatPeriods: VatPeriod[];
};

type AiTaskType =
  | "bogføring"
  | "bankafstemning"
  | "moms"
  | "debitor"
  | "periodeafslutning"
  | "compliance";

type AiTask = {
  id: number;
  type: AiTaskType;
  title: string;
  description?: string | null;
  suggestion?: string | null;
  data?: string | null;
  status?: string | null;
  approved?: number | null;
  createdAt?: string | null;
};

type DashboardDeadline = {
  id?: number | null;
  type?: string | null;
  label?: string | null;
  period?: string | null;
  deadline?: string | null;
  amount?: number | null;
  status?: string | null;
};

type DashboardStats = {
  omsætning?: number | null;
  revenue?: number | null;
  udgifter?: number | null;
  expenses?: number | null;
  resultat?: number | null;
  result?: number | null;
  momsSkyldig?: number | null;
  vatPayable?: number | null;
  forfaldneFakturaer?: number | null;
  overdueInvoices?: number | null;
  åbneKladder?: number | null;
  openDrafts?: number | null;
  afventendeBankTx?: number | null;
  pendingBankTx?: number | null;
  upcomingDeadlines?: DashboardDeadline[];
};

type Voucher = {
  id: number;
  voucherNumber?: string | null;
  supplier?: string | null;
  date?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  category?: string | null;
  description?: string | null;
  status?: string | null;
};

type BankTransaction = {
  id: number;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  balance?: number | null;
  status?: string | null;
  matchedType?: string | null;
  matchedId?: number | null;
};

type TaxDeadline = {
  id: number;
  type?: string | null;
  period?: string | null;
  deadline?: string | null;
  amount?: number | null;
  status?: string | null;
};

type ReportLine = { label?: string | null; amount?: number | null };
type ReportSection = { title?: string | null; lines?: ReportLine[]; total?: number | null };
type ReportData = {
  type?: string | null;
  generatedAt?: string | null;
  companyName?: string | null;
  period?: string | null;
  lines?: ReportLine[];
  sections?: ReportSection[];
  [key: string]: unknown;
};

/* ---------- typer: nye faner ---------- */

type AiSuggestion = {
  account?: string | null;
  accountName?: string | null;
  debitAccount?: string | null;
  creditAccount?: string | null;
  vatAccount?: string | null;
  vatCode?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  action?: string | null;
  period?: string | null;
  periodLabel?: string | null;
  calculatedVat?: number | null;
  deadline?: string | null;
  invoiceId?: number | null;
  note?: string | null;
  [key: string]: unknown;
};

type DebitorEntry = {
  id: number;
  number?: string | null;
  customer?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  status?: string | null;
};

type KreditorEntry = {
  id: number;
  supplier?: string | null;
  amount?: number | null;
  date?: string | null;
  status?: string | null;
};

type DebitorKreditorData = {
  debitorer: DebitorEntry[];
  kreditorer: KreditorEntry[];
  totals: {
    debitorTotal?: number | null;
    kreditorTotal?: number | null;
    overdueCount?: number | null;
  };
  aging: {
    current: number;
    d0_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
  };
};

type ChecklistItem = { task: string; done: boolean };

type PeriodClose = {
  id: number;
  companyId?: number | null;
  periodType?: string | null;
  periodLabel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  checklist?: string | null;
  closedBy?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
};

type AccountingRule = {
  id: number;
  companyId?: number | null;
  matchText?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  vatCode?: string | null;
  category?: string | null;
  autoBook?: number | null;
  active?: number | null;
  createdAt?: string | null;
};

type AccountingIntegration = {
  id: number;
  companyId?: number | null;
  type?: string | null;
  displayName?: string | null;
  config?: string | null;
  status?: string | null;
  lastSync?: string | null;
  createdAt?: string | null;
};

/* ---------- typer: 12 nye faner ---------- */

type DocumentInboxItem = {
  id: number;
  fileName?: string | null;
  source?: string | null;
  supplier?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  invoiceDate?: string | null;
  suggestedAccount?: string | null;
  ocrStatus?: string | null;
  isDuplicate?: number | null;
  status?: string | null;
};

type PayrollEntry = {
  id: number;
  employeeName?: string | null;
  period?: string | null;
  regularHours?: number | null;
  hourlyRate?: number | null;
  grossSalary?: number | null;
  holidayPay?: number | null;
  pension?: number | null;
  atp?: number | null;
  aTax?: number | null;
  amContribution?: number | null;
  netSalary?: number | null;
  status?: string | null;
};

type FixedAsset = {
  id: number;
  name?: string | null;
  category?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  salvageValue?: number | null;
  usefulLife?: number | null;
  accumulatedDepreciation?: number | null;
  bookValue?: number | null;
  monthlyDepreciation?: number | null;
  status?: string | null;
};

type Budget = {
  id: number;
  year?: number | null;
  month?: number | null;
  category?: string | null;
  budgetedAmount?: number | null;
  actualAmount?: number | null;
};

type CostCenter = {
  id: number;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  revenue?: number | null;
  costs?: number | null;
  profit?: number | null;
};

type PaymentRun = {
  id: number;
  runDate?: string | null;
  totalAmount?: number | null;
  paymentCount?: number | null;
  status?: string | null;
  approvedBy?: string | null;
  items?: string | null;
};

type YearEndClose = {
  id: number;
  year?: number | null;
  status?: string | null;
  result?: number | null;
  taxResult?: number | null;
  checklist?: string | null;
};

type AuditLogEntry = {
  id: number;
  createdAt?: string | null;
  userName?: string | null;
  action?: string | null;
  module?: string | null;
  entityDescription?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
};

type VatReconciliation = {
  id: number;
  period?: string | null;
  outputVat?: number | null;
  inputVat?: number | null;
  netVat?: number | null;
  skatAccount?: number | null;
  difference?: number | null;
  status?: string | null;
  notes?: string | null;
};

type CashflowProjection = {
  id: number;
  date?: string | null;
  type?: string | null;
  description?: string | null;
  expectedAmount?: number | null;
  actualAmount?: number | null;
  status?: string | null;
};

/* ---------- helpers ---------- */

const ACCOUNT_TYPE_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  aktiv: "blue",
  passiv: "amber",
  indtaegt: "green",
  udgift: "red",
  mellemregning: "gray",
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  passiv: "Passiv",
  indtaegt: "Indtægt",
  udgift: "Udgift",
  mellemregning: "Mellemregning",
};

const ENTRY_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "gray"> = {
  kladde: "amber",
  bogført: "green",
  afstemt: "blue",
};

const VAT_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  open: "amber",
  åben: "amber",
  pending: "amber",
  reported: "blue",
  indberettet: "blue",
  paid: "green",
  betalt: "green",
  overdue: "red",
  forfalden: "red",
};

const VOUCHER_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  kladde: "amber",
  udkast: "amber",
  draft: "amber",
  bogfoert: "green",
  bogført: "green",
  posted: "green",
  afvist: "red",
  rejected: "red",
};

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  kladde: "Kladde",
  udkast: "Udkast",
  draft: "Udkast",
  bogfoert: "Bogført",
  bogført: "Bogført",
  posted: "Bogført",
  afvist: "Afvist",
  rejected: "Afvist",
};

const BANK_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  pending: "amber",
  afventer: "amber",
  unmatched: "amber",
  matched: "green",
  matchet: "green",
  ignored: "gray",
  ignoreret: "gray",
};

const BANK_STATUS_LABEL: Record<string, string> = {
  pending: "Afventer",
  afventer: "Afventer",
  unmatched: "Ikke matchet",
  matched: "Matchet",
  matchet: "Matchet",
  ignored: "Ignoreret",
  ignoreret: "Ignoreret",
};

const TAX_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  pending: "amber",
  afventer: "amber",
  open: "amber",
  åben: "amber",
  submitted: "green",
  indsendt: "green",
  paid: "blue",
  betalt: "blue",
  overdue: "red",
  forfalden: "red",
};

const TAX_STATUS_LABEL: Record<string, string> = {
  pending: "Afventer",
  afventer: "Afventer",
  open: "Åben",
  åben: "Åben",
  submitted: "Indsendt",
  indsendt: "Indsendt",
  paid: "Betalt",
  betalt: "Betalt",
  overdue: "Forfalden",
  forfalden: "Forfalden",
};

const AI_TASK_TYPE_LABEL: Record<AiTaskType, string> = {
  bogføring: "Bogføring",
  bankafstemning: "Bankafstemning",
  moms: "Moms",
  debitor: "Debitor",
  periodeafslutning: "Periodeafslutning",
  compliance: "Compliance",
};

const AI_TASK_TYPE_VARIANT: Record<AiTaskType, "blue" | "amber" | "green" | "red" | "gray"> = {
  bogføring: "blue",
  bankafstemning: "amber",
  moms: "amber",
  debitor: "red",
  periodeafslutning: "gray",
  compliance: "red",
};

const AI_TASK_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  afventer: "amber",
  igang: "blue",
  fuldført: "green",
  godkendt: "green",
  fejlet: "red",
  afvist: "red",
};

const VOUCHER_CATEGORY_LABEL: Record<string, string> = {
  kontor: "Kontor",
  transport: "Transport",
  materialer: "Materialer",
  andre: "Andre",
};

const PERIOD_TYPE_LABEL: Record<string, string> = {
  maaned: "Måned",
  kvartal: "Kvartal",
  aar: "År",
};

const PERIOD_STATUS_LABEL: Record<string, string> = {
  aabne: "Åben",
  åben: "Åben",
  open: "Åben",
  afsluttet: "Afsluttet",
  closed: "Afsluttet",
  genaabnet: "Genåbnet",
};

const PERIOD_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  aabne: "amber",
  åben: "amber",
  open: "amber",
  afsluttet: "green",
  closed: "green",
  genaabnet: "blue",
};

const RULE_CATEGORY_LABEL: Record<string, string> = {
  kontor: "Kontor",
  lon: "Løn",
  leje: "Leje",
  transport: "Transport",
  materialer: "Materialer",
  skat: "SKAT/Moms",
  bank: "Bank",
  diverse: "Diverse",
};

const INTEGRATION_TYPE_LABEL: Record<string, string> = {
  bank_api: "Bank API",
  bilagsindbakke: "Bilagsindbakke",
  csv_import: "CSV-import",
  revisor_export: "Revisor-eksport",
};

const INTEGRATION_STATUS_LABEL: Record<string, string> = {
  forbundet: "Forbundet",
  connected: "Forbundet",
  afbrudt: "Afbrudt",
  disconnected: "Afbrudt",
  fejl: "Fejl",
  error: "Fejl",
};

const INTEGRATION_STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "red" | "gray"> = {
  forbundet: "green",
  connected: "green",
  afbrudt: "gray",
  disconnected: "gray",
  fejl: "red",
  error: "red",
};

const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "resultatopgoerelse", label: "Resultatopgørelse" },
  { value: "balance", label: "Balance" },
  { value: "momsrapport", label: "Momsrapport" },
  { value: "revisorpakke", label: "Revisorpakke" },
];

function money(value?: number | null): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function num(value?: number | null): string {
  return new Intl.NumberFormat("da-DK").format(value ?? 0);
}

function dk(d?: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}

function parseAiSuggestion(raw?: string | null): AiSuggestion | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiSuggestion;
  } catch {
    return null;
  }
}

function parseChecklist(raw?: string | null): ChecklistItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChecklistItem[]) : [];
  } catch {
    return [];
  }
}

const YEAR_END_CHECKLIST_DEFAULT: string[] = [
  "Afslut åbne bilag og kladdeposter",
  "Bankafstemning gennemført",
  "Momsangivelse indsendt",
  "Løn og ATP bogført",
  "Afskrivninger kørt",
  "Debitor- og kreditorafstemning",
  "Varelager optalt og vurderet",
  "Interne transaktioner elimineret",
  "Årsregnskab udarbejdet",
  "Revisor gennemgang afsluttet",
];

function mergeYearEndChecklist(stored?: string | null): ChecklistItem[] {
  const parsed = parseChecklist(stored);
  const map = new Map(parsed.map((c) => [c.task, c.done]));
  return YEAR_END_CHECKLIST_DEFAULT.map((task) => ({
    task,
    done: map.get(task) ?? false,
  }));
}

/* ---------- hovedkomponent ---------- */

function getTabFromHash(): string {
  const hash = window.location.hash;
  const match = hash.match(/#\/smartregnskab\/app\/([^/?#]+)/);
  return match ? match[1] : "dashboard";
}

function CompanyRegnskabssystemPage(props: any = {}) {
  const { user, isPlatformAdmin, companyId: authCompanyId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(getTabFromHash());

  // Sync activeTab when URL hash changes (sidebar navigation)
  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    // Also check immediately
    const newTab = getTabFromHash();
    if (newTab !== activeTab) setActiveTab(newTab);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeTab]);

  /* Virksomhedsliste */
  const companiesQuery = useQuery<CompanySummary[]>({
    queryKey: ["/api/regnskabssystem/companies"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/regnskabssystem/companies");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.companies ?? []);
    },
  });

  const companies = companiesQuery.data ?? [];

  // Vælg automatisk den første virksomhed (eller egen for ikke-admin)
  const effectiveCompanyId =
    selectedCompanyId ?? (isPlatformAdmin ? companies[0]?.id ?? 0 : authCompanyId ?? 0);

  /* Virksomhedsdetaljer (Kontoplan & Bogføring) */
  const detailQuery = useQuery<CompanyDetail>({
    queryKey: ["/api/regnskabssystem", effectiveCompanyId],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/regnskabssystem/${effectiveCompanyId}`);
      return (await res.json()) as CompanyDetail;
    },
  });

  const detail = detailQuery.data;

  /* Dashboard */
  const dashboardQuery = useQuery<DashboardStats>({
    queryKey: ["/api/regnskabssystem/dashboard", effectiveCompanyId],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/regnskabssystem/dashboard/${effectiveCompanyId}`);
      return (await res.json()) as DashboardStats;
    },
  });

  const dashboard = dashboardQuery.data;

  /* Bilag & Udgifter */
  const vouchersQuery = useQuery<Voucher[]>({
    queryKey: ["/api/vouchers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/vouchers");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.vouchers ?? []);
    },
  });

  const vouchers = vouchersQuery.data ?? [];

  /* Bankafstemning */
  const bankTxQuery = useQuery<BankTransaction[]>({
    queryKey: ["/api/bank-transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/bank-transactions");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.transactions ?? []);
    },
  });

  const bankTx = bankTxQuery.data ?? [];

  /* Moms & Skat — fristkalender */
  const taxDeadlinesQuery = useQuery<TaxDeadline[]>({
    queryKey: ["/api/tax-deadlines"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tax-deadlines");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.deadlines ?? []);
    },
  });

  const taxDeadlines = taxDeadlinesQuery.data ?? [];

  /* AI Regnskab - opgaver */
  const aiTasksQuery = useQuery<AiTask[]>({
    queryKey: ["/api/ai-regnskab/tasks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-regnskab/tasks");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.tasks ?? []);
    },
  });

  const aiTasks = aiTasksQuery.data ?? [];

  /* Rapporter */
  const [reportType, setReportType] = useState<string | null>(null);
  const reportQuery = useQuery<ReportData>({
    queryKey: ["/api/regnskabssystem/report", effectiveCompanyId, reportType],
    enabled: !!effectiveCompanyId && !!reportType,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/regnskabssystem/report/${effectiveCompanyId}/${reportType}`,
      );
      return (await res.json()) as ReportData;
    },
  });

  /* ---------- mutationer: AI ---------- */
  const scanMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-regnskab/scan", {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai-regnskab/tasks"] });
      toast({
        title: "AI-scan startet",
        description: "Nye AI-opgaver er oprettet. Gennemgå dem under AI Regnskab.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "AI-scan fejlede", description: message, variant: "destructive" });
    },
  });

  const decideMut = useMutation({
    mutationFn: async ({ taskId, decision }: { taskId: number; decision: "godkend" | "afvis" }) => {
      const res = await apiRequest("POST", "/api/ai-regnskab/tasks/decide", { taskId, decision });
      return await res.json();
    },
    onMutate: ({ taskId, decision }) => {
      qc.setQueryData<AiTask[]>(["/api/ai-regnskab/tasks"], (old) =>
        (old ?? []).map((t) =>
          t.id === taskId ? { ...t, status: decision === "godkend" ? "godkendt" : "afvist" } : t,
        ),
      );
    },
    onSuccess: (_data, { taskId, decision }) => {
      qc.invalidateQueries({ queryKey: ["/api/ai-regnskab/tasks"] });
      toast({
        title: decision === "godkend" ? "Opgave godkendt" : "Opgave afvist",
        description: `AI-opgave #${taskId} er ${decision === "godkend" ? "godkendt" : "afvist"}.`,
      });
    },
    onError: (err: unknown, { decision }) => {
      qc.invalidateQueries({ queryKey: ["/api/ai-regnskab/tasks"] });
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: decision === "godkend" ? "Kunne ikke godkende" : "Kunne ikke afvise",
        description: message,
        variant: "destructive",
      });
    },
  });

  /* ---------- mutationer: Bilag ---------- */
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    supplier: "",
    date: "",
    amount: "",
    vatRate: "25",
    description: "",
    category: "kontor",
  });

  function resetVoucherForm() {
    setVoucherForm({
      supplier: "",
      date: "",
      amount: "",
      vatRate: "25",
      description: "",
      category: "kontor",
    });
  }

  const createVoucherMut = useMutation({
    mutationFn: async () => {
      const payload = {
        supplier: voucherForm.supplier,
        date: voucherForm.date,
        amount: Number(voucherForm.amount) || 0,
        vatRate: Number(voucherForm.vatRate) || 0,
        description: voucherForm.description,
        category: voucherForm.category,
        companyId: effectiveCompanyId,
      };
      const res = await apiRequest("POST", "/api/vouchers", payload);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vouchers"] });
      toast({ title: "Bilag oprettet", description: "Det nye bilag er gemt som kladde." });
      setVoucherDialogOpen(false);
      resetVoucherForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette bilag", description: message, variant: "destructive" });
    },
  });

  const postVoucherMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/vouchers/${id}`, { status: "bogfoert" });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vouchers"] });
      toast({ title: "Bilag bogført", description: "Bilaget er nu bogført." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke bogføre", description: message, variant: "destructive" });
    },
  });

  const deleteVoucherMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/vouchers/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vouchers"] });
      toast({ title: "Bilag slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  /* ---------- mutationer: Bankafstemning ---------- */
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");

  const importBankMut = useMutation({
    mutationFn: async () => {
      const rows = parseBankCsv(csvText);
      const res = await apiRequest("POST", "/api/bank-transactions/import", { rows });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Banktransaktioner importeret" });
      setImportDialogOpen(false);
      setCsvText("");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Import fejlede", description: message, variant: "destructive" });
    },
  });

  const autoMatchMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bank-transactions/auto-match", {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Auto-match kørt", description: "Banktransaktioner er forsøgt matchet automatisk." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Auto-match fejlede", description: message, variant: "destructive" });
    },
  });

  const matchBankMut = useMutation({
    mutationFn: async ({ id, matchedType }: { id: number; matchedType: string }) => {
      const res = await apiRequest("POST", `/api/bank-transactions/${id}/match`, {
        matchedType,
        matchedId: null,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Transaktion matchet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke matche", description: message, variant: "destructive" });
    },
  });

  const ignoreBankMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/bank-transactions/${id}/ignore`, {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Transaktion ignoreret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke ignorere", description: message, variant: "destructive" });
    },
  });

  /* ---------- mutationer: Moms & Skat ---------- */
  const submitTaxMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/tax-deadlines/${id}/submit`, {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tax-deadlines"] });
      toast({ title: "Frist markeret indsendt" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke markere indsendt", description: message, variant: "destructive" });
    },
  });

  /* ---------- ny fane: Automatisering & AI ---------- */
  const autoRunMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-regnskab/auto-run", {});
      return await res.json();
    },
    onSuccess: (data: { created?: number } | unknown) => {
      qc.invalidateQueries({ queryKey: ["/api/ai-regnskab/tasks"] });
      const created =
        data && typeof data === "object" && "created" in data
          ? String((data as { created: number }).created)
          : "";
      toast({
        title: "Automatisk gennemgang kørt",
        description: created
          ? `${created} nye AI-opgaver oprettet.`
          : "Gennemgang gennemført. Gennemgå opgaverne nedenfor.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: "Automatisk gennemgang fejlede",
        description: message,
        variant: "destructive",
      });
    },
  });

  const pendingAiCount = aiTasks.filter(
    (t) => !t.status || t.status === "afventer" || t.status === "igang",
  ).length;

  /* ---------- ny fane: Debitor/Kreditor ---------- */
  const debitorQuery = useQuery<DebitorKreditorData>({
    queryKey: ["/api/regnskabssystem/debitor-kreditor", effectiveCompanyId],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/regnskabssystem/debitor-kreditor/${effectiveCompanyId}`,
      );
      return (await res.json()) as DebitorKreditorData;
    },
  });

  const debitorData = debitorQuery.data;

  /* ---------- ny fane: Periodeafslutning ---------- */
  const periodClosesQuery = useQuery<PeriodClose[]>({
    queryKey: ["/api/period-closes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/period-closes");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.periodCloses ?? []);
    },
  });

  const periodCloses = periodClosesQuery.data ?? [];

  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    periodType: "maaned",
    periodLabel: "",
    startDate: "",
    endDate: "",
  });
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);

  function resetPeriodForm() {
    setPeriodForm({
      periodType: "maaned",
      periodLabel: "",
      startDate: "",
      endDate: "",
    });
  }

  const createPeriodMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/period-closes", {
        periodType: periodForm.periodType,
        periodLabel: periodForm.periodLabel,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/period-closes"] });
      toast({ title: "Periode oprettet", description: "Tjeklisten er genereret automatisk." });
      setPeriodDialogOpen(false);
      resetPeriodForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette periode", description: message, variant: "destructive" });
    },
  });

  const toggleChecklistMut = useMutation({
    mutationFn: async ({ id, index }: { id: number; index: number }) => {
      const res = await apiRequest(
        "POST",
        `/api/period-closes/${id}/checklist/${index}`,
        {},
      );
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/period-closes"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere tjekliste", description: message, variant: "destructive" });
    },
  });

  const closePeriodMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/period-closes/${id}`, {
        status: "afsluttet",
        closedBy: user?.name || user?.email || "system",
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/period-closes"] });
      toast({ title: "Periode afsluttet", description: "Periodeafslutningen er gennemført." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke afslutte periode", description: message, variant: "destructive" });
    },
  });

  /* ---------- ny fane: Regnskabsregler ---------- */
  const rulesQuery = useQuery<AccountingRule[]>({
    queryKey: ["/api/accounting-rules"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/accounting-rules");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.rules ?? []);
    },
  });

  const rules = rulesQuery.data ?? [];

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    matchText: "",
    accountNumber: "",
    accountName: "",
    vatCode: "",
    category: "diverse",
    autoBook: false,
  });

  function resetRuleForm() {
    setRuleForm({
      matchText: "",
      accountNumber: "",
      accountName: "",
      vatCode: "",
      category: "diverse",
      autoBook: false,
    });
  }

  const createRuleMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounting-rules", {
        matchText: ruleForm.matchText,
        accountNumber: ruleForm.accountNumber,
        accountName: ruleForm.accountName,
        vatCode: ruleForm.vatCode || null,
        category: ruleForm.category,
        autoBook: ruleForm.autoBook ? 1 : 0,
        active: 1,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-rules"] });
      toast({ title: "Regel oprettet", description: "Reglen er gemt og aktiv." });
      setRuleDialogOpen(false);
      resetRuleForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette regel", description: message, variant: "destructive" });
    },
  });

  const updateRuleMut = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Record<string, unknown>;
    }) => {
      const res = await apiRequest("PATCH", `/api/accounting-rules/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-rules"] });
      toast({ title: "Regel opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere regel", description: message, variant: "destructive" });
    },
  });

  const deleteRuleMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/accounting-rules/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-rules"] });
      toast({ title: "Regel slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette regel", description: message, variant: "destructive" });
    },
  });

  const RULE_SUGGESTIONS: {
    matchText: string;
    accountNumber: string;
    accountName: string;
    vatCode: string;
    category: string;
  }[] = [
    { matchText: "MobilePay", accountNumber: "5820", accountName: "MobilePay", vatCode: "udgaaende", category: "bank" },
    { matchText: "SKAT", accountNumber: "4730", accountName: "Skyldig skat", vatCode: "ingen", category: "skat" },
    { matchText: "Løn", accountNumber: "7000", accountName: "Lønninger", vatCode: "ingen", category: "lon" },
    { matchText: "Leje", accountNumber: "7100", accountName: "Husleje", vatCode: "ingen", category: "leje" },
    { matchText: "El", accountNumber: "7400", accountName: "El og vand", vatCode: "indgaaende", category: "kontor" },
  ];

  /* ---------- ny fane: Integrationer ---------- */
  const integrationsQuery = useQuery<AccountingIntegration[]>({
    queryKey: ["/api/accounting-integrations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/accounting-integrations");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.integrations ?? []);
    },
  });

  const integrations = integrationsQuery.data ?? [];

  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [integrationForm, setIntegrationForm] = useState({
    type: "bank_api",
    displayName: "",
  });

  function resetIntegrationForm() {
    setIntegrationForm({ type: "bank_api", displayName: "" });
  }

  const createIntegrationMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounting-integrations", {
        type: integrationForm.type,
        displayName: integrationForm.displayName,
        status: "afbrudt",
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-integrations"] });
      toast({ title: "Integration tilføjet", description: "Tilslut integrationen for at aktivere den." });
      setIntegrationDialogOpen(false);
      resetIntegrationForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje integration", description: message, variant: "destructive" });
    },
  });

  const updateIntegrationMut = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/accounting-integrations/${id}`, {
        status,
        lastSync: status === "forbundet" ? new Date().toISOString() : undefined,
      });
      return await res.json();
    },
    onSuccess: (_data, { status }) => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-integrations"] });
      toast({
        title: status === "forbundet" ? "Integration forbundet" : "Integration afbrudt",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere integration", description: message, variant: "destructive" });
    },
  });

  const deleteIntegrationMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/accounting-integrations/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-integrations"] });
      toast({ title: "Integration slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette integration", description: message, variant: "destructive" });
    },
  });

  /* =========================================================
     NYE FANER: forespørgsler, mutationer og dialog-tilstand
     ========================================================= */

  /* ---------- Bilagsindbakke ---------- */
  const documentInboxQuery = useQuery<DocumentInboxItem[]>({
    queryKey: ["/api/document-inbox"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/document-inbox");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
  });
  const documentInbox = documentInboxQuery.data ?? [];

  const [inboxUploadOpen, setInboxUploadOpen] = useState(false);
  const [inboxForm, setInboxForm] = useState({ fileName: "", source: "upload" });

  const uploadInboxMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/document-inbox", {
        fileName: inboxForm.fileName,
        source: inboxForm.source,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/document-inbox"] });
      toast({ title: "Bilag uploadet", description: "Dokumentet er tilføjet indbakken." });
      setInboxUploadOpen(false);
      setInboxForm({ fileName: "", source: "upload" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Upload fejlede", description: message, variant: "destructive" });
    },
  });

  const convertInboxMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/document-inbox/${id}/convert`, {});
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/document-inbox"] });
      qc.invalidateQueries({ queryKey: ["/api/vouchers"] });
      toast({ title: "Konverteret til bilag", description: "Dokumentet er nu et bilag." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Konvertering fejlede", description: message, variant: "destructive" });
    },
  });

  /* ---------- Lønbogføring ---------- */
  const payrollQuery = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll-entries"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/payroll-entries");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.entries ?? []);
    },
  });
  const payrollEntries = payrollQuery.data ?? [];

  const [payrollPeriodOpen, setPayrollPeriodOpen] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState("");

  const autoPayrollMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payroll-entries/auto-generate", {
        period: payrollPeriod,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-entries"] });
      toast({ title: "Løn auto-genereret", description: "Lønposter er oprettet fra tidsregistreringer." });
      setPayrollPeriodOpen(false);
      setPayrollPeriod("");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Auto-generering fejlede", description: message, variant: "destructive" });
    },
  });

  const postPayrollMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/payroll-entries/${id}`, { status: "bogfort" });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-entries"] });
      toast({ title: "Løn bogført" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke bogføre løn", description: message, variant: "destructive" });
    },
  });

  /* ---------- Anlægsregister ---------- */
  const fixedAssetsQuery = useQuery<FixedAsset[]>({
    queryKey: ["/api/fixed-assets"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/fixed-assets");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.assets ?? []);
    },
  });
  const fixedAssets = fixedAssetsQuery.data ?? [];

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: "",
    category: "",
    purchaseDate: "",
    purchasePrice: "",
    salvageValue: "",
    usefulLife: "",
  });

  const createAssetMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fixed-assets", {
        name: assetForm.name,
        category: assetForm.category,
        purchaseDate: assetForm.purchaseDate,
        purchasePrice: Number(assetForm.purchasePrice) || 0,
        salvageValue: Number(assetForm.salvageValue) || 0,
        usefulLife: Number(assetForm.usefulLife) || 0,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "Anlæg tilføjet" });
      setAssetDialogOpen(false);
      setAssetForm({ name: "", category: "", purchaseDate: "", purchasePrice: "", salvageValue: "", usefulLife: "" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje anlæg", description: message, variant: "destructive" });
    },
  });

  const sellAssetMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/fixed-assets/${id}`, { status: "solgt" });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "Anlæg markeret som solgt" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke sælge anlæg", description: message, variant: "destructive" });
    },
  });

  const depreciateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fixed-assets/depreciate", { companyId: effectiveCompanyId });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "Afskrivning kørt", description: "Månedlig afskrivning er gennemført." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Afskrivning fejlede", description: message, variant: "destructive" });
    },
  });

  /* ---------- Budget & Prognoser ---------- */
  const budgetsQuery = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/budgets");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.budgets ?? []);
    },
  });
  const budgets = budgetsQuery.data ?? [];

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    year: String(new Date().getFullYear()),
    month: "",
    category: "",
    budgetedAmount: "",
  });

  const createBudgetMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budgets", {
        year: Number(budgetForm.year) || 0,
        month: Number(budgetForm.month) || 0,
        category: budgetForm.category,
        budgetedAmount: Number(budgetForm.budgetedAmount) || 0,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budgetlinje tilføjet" });
      setBudgetDialogOpen(false);
      setBudgetForm({ year: String(new Date().getFullYear()), month: "", category: "", budgetedAmount: "" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje budgetlinje", description: message, variant: "destructive" });
    },
  });

  const updateBudgetActualMut = useMutation({
    mutationFn: async ({ id, actualAmount }: { id: number; actualAmount: number }) => {
      const res = await apiRequest("PATCH", `/api/budgets/${id}`, { actualAmount });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Faktisk beløb opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Opdatering fejlede", description: message, variant: "destructive" });
    },
  });

  const deleteBudgetMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/budgets/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budgetlinje slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  /* ---------- Omkostningssteder ---------- */
  const costCentersQuery = useQuery<CostCenter[]>({
    queryKey: ["/api/cost-centers"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cost-centers");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.centers ?? []);
    },
  });
  const costCenters = costCentersQuery.data ?? [];

  const [costCenterDialogOpen, setCostCenterDialogOpen] = useState(false);
  const [costCenterForm, setCostCenterForm] = useState({ code: "", name: "", type: "afdeling" });

  const createCostCenterMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cost-centers", {
        code: costCenterForm.code,
        name: costCenterForm.name,
        type: costCenterForm.type,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      toast({ title: "Omkostningssted tilføjet" });
      setCostCenterDialogOpen(false);
      setCostCenterForm({ code: "", name: "", type: "afdeling" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje omkostningssted", description: message, variant: "destructive" });
    },
  });

  const updateCostCenterMut = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: string }) => {
      const res = await apiRequest("PATCH", `/api/cost-centers/${id}`, { type });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      toast({ title: "Omkostningssted opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Opdatering fejlede", description: message, variant: "destructive" });
    },
  });

  const deleteCostCenterMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/cost-centers/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      toast({ title: "Omkostningssted slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  /* ---------- Betalingskørsler ---------- */
  const paymentRunsQuery = useQuery<PaymentRun[]>({
    queryKey: ["/api/payment-runs"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/payment-runs");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.runs ?? []);
    },
  });
  const paymentRuns = paymentRunsQuery.data ?? [];

  const [expandedPaymentRun, setExpandedPaymentRun] = useState<number | null>(null);

  const createPaymentRunMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payment-runs", { companyId: effectiveCompanyId });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payment-runs"] });
      toast({ title: "Betalingskørsel oprettet", description: "Kørslen er genereret fra åbne bilag." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette kørsel", description: message, variant: "destructive" });
    },
  });

  const approvePaymentRunMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/payment-runs/${id}`, { status: "godkendt" });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payment-runs"] });
      toast({ title: "Betalingskørsel godkendt" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke godkende", description: message, variant: "destructive" });
    },
  });

  /* ---------- Årsafslutning ---------- */
  const yearEndClosesQuery = useQuery<YearEndClose[]>({
    queryKey: ["/api/year-end-closes"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/year-end-closes");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.closes ?? []);
    },
  });
  const yearEndCloses = yearEndClosesQuery.data ?? [];

  const [yearEndDialogOpen, setYearEndDialogOpen] = useState(false);
  const [yearEndForm, setYearEndForm] = useState({ year: String(new Date().getFullYear()) });

  const createYearEndMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/year-end-closes", {
        year: Number(yearEndForm.year) || 0,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/year-end-closes"] });
      toast({ title: "Årsafslutning oprettet" });
      setYearEndDialogOpen(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette årsafslutning", description: message, variant: "destructive" });
    },
  });

  const toggleYearEndChecklistMut = useMutation({
    mutationFn: async ({ id, checklist }: { id: number; checklist: ChecklistItem[] }) => {
      const res = await apiRequest("PATCH", `/api/year-end-closes/${id}`, {
        checklist: JSON.stringify(checklist),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/year-end-closes"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere tjekliste", description: message, variant: "destructive" });
    },
  });

  const closeYearMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/year-end-closes/${id}`, { status: "afsluttet" });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/year-end-closes"] });
      toast({ title: "År afsluttet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke afslutte år", description: message, variant: "destructive" });
    },
  });

  /* ---------- Revisionsspor ---------- */
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>("alle");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("alle");
  const auditLogQuery = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log", auditModuleFilter, auditActionFilter],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (auditModuleFilter !== "alle") params.set("module", auditModuleFilter);
      if (auditActionFilter !== "alle") params.set("action", auditActionFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiRequest("GET", `/api/audit-log${qs}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.entries ?? []);
    },
  });
  const auditLog = auditLogQuery.data ?? [];

  /* ---------- Moms-afstemning ---------- */
  const vatReconciliationsQuery = useQuery<VatReconciliation[]>({
    queryKey: ["/api/vat-reconciliations"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/vat-reconciliations");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.reconciliations ?? []);
    },
  });
  const vatReconciliations = vatReconciliationsQuery.data ?? [];

  const [vatReconDialogOpen, setVatReconDialogOpen] = useState(false);
  const [vatReconForm, setVatReconForm] = useState({ period: "" });

  const createVatReconMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vat-reconciliations", {
        period: vatReconForm.period,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vat-reconciliations"] });
      toast({ title: "Momsafstemning oprettet", description: "Moms er automatisk beregnet for perioden." });
      setVatReconDialogOpen(false);
      setVatReconForm({ period: "" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette momsafstemning", description: message, variant: "destructive" });
    },
  });

  const updateVatReconMut = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status?: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/vat-reconciliations/${id}`, { status, notes });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vat-reconciliations"] });
      toast({ title: "Momsafstemning opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Opdatering fejlede", description: message, variant: "destructive" });
    },
  });

  /* ---------- Likviditet & Cashflow ---------- */
  const cashflowQuery = useQuery<CashflowProjection[]>({
    queryKey: ["/api/cashflow-projections"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cashflow-projections");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.projections ?? []);
    },
  });
  const cashflowProjections = cashflowQuery.data ?? [];

  const [cashflowDialogOpen, setCashflowDialogOpen] = useState(false);
  const [cashflowForm, setCashflowForm] = useState({
    date: "",
    type: "indbetalning",
    description: "",
    expectedAmount: "",
  });

  const autoCashflowMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cashflow-projections/auto-generate", { companyId: effectiveCompanyId });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cashflow-projections"] });
      toast({ title: "Projektioner auto-genereret", description: "Baseret på fakturaer, løn og skat." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Auto-generering fejlede", description: message, variant: "destructive" });
    },
  });

  const createCashflowMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cashflow-projections", {
        date: cashflowForm.date,
        type: cashflowForm.type,
        description: cashflowForm.description,
        expectedAmount: Number(cashflowForm.expectedAmount) || 0,
        companyId: effectiveCompanyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cashflow-projections"] });
      toast({ title: "Cashflow-post tilføjet" });
      setCashflowDialogOpen(false);
      setCashflowForm({ date: "", type: "indbetalning", description: "", expectedAmount: "" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje post", description: message, variant: "destructive" });
    },
  });

  const updateCashflowMut = useMutation({
    mutationFn: async ({ id, actualAmount }: { id: number; actualAmount: number }) => {
      const res = await apiRequest("PATCH", `/api/cashflow-projections/${id}`, { actualAmount });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cashflow-projections"] });
      toast({ title: "Cashflow-post opdateret" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Opdatering fejlede", description: message, variant: "destructive" });
    },
  });

  const deleteCashflowMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/cashflow-projections/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cashflow-projections"] });
      toast({ title: "Cashflow-post slettet" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette", description: message, variant: "destructive" });
    },
  });

  /* ---------- AI Regnskabschef ---------- */
  const chefTasksQuery = useQuery<AiTask[]>({
    queryKey: ["/api/ai-accounting-tasks"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-accounting-tasks");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.tasks ?? []);
    },
  });
  const chefTasks = chefTasksQuery.data ?? [];

  const chefRunMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-regnskab/chef-run", { companyId: effectiveCompanyId });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai-accounting-tasks"] });
      toast({
        title: "Fuld gennemgang kørt",
        description: "AI Regnskabschef har oprettet opgaver til godkendelse.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Gennemgang fejlede", description: message, variant: "destructive" });
    },
  });

  const decideChefTaskMut = useMutation({
    mutationFn: async ({ taskId, decision }: { taskId: number; decision: "godkend" | "afvis" }) => {
      const res = await apiRequest("POST", "/api/ai-regnskab/tasks/decide", { taskId, decision });
      return await res.json();
    },
    onMutate: ({ taskId, decision }) => {
      qc.setQueryData<AiTask[]>(["/api/ai-accounting-tasks"], (old) =>
        (old ?? []).map((t) =>
          t.id === taskId ? { ...t, status: decision === "godkend" ? "godkendt" : "afvist" } : t,
        ),
      );
    },
    onSuccess: (_data, { taskId, decision }) => {
      qc.invalidateQueries({ queryKey: ["/api/ai-accounting-tasks"] });
      toast({
        title: decision === "godkend" ? "Opgave godkendt" : "Opgave afvist",
        description: `AI-opgave #${taskId} er ${decision === "godkend" ? "godkendt" : "afvist"}.`,
      });
    },
    onError: (err: unknown, { decision }) => {
      qc.invalidateQueries({ queryKey: ["/api/ai-accounting-tasks"] });
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      toast({
        title: decision === "godkend" ? "Kunne ikke godkende" : "Kunne ikke afvise",
        description: message,
        variant: "destructive",
      });
    },
  });

  /* ---------- Skattekonto ---------- */
  // Genbruger vat-reconciliationsQuery ovenfor.

  /* =========================================================
     SLUT: nye faner
     ========================================================= */

  const accounts = detail?.accounts ?? [];
  const entries = detail?.entries ?? [];
  const vatPeriods = detail?.vatPeriods ?? [];
  const selectedCompany = companies.find((company) => company.id === effectiveCompanyId);
  const platformOverview = isPlatformAdmin && activeTab === "dashboard";
  const companiesOverview = isPlatformAdmin && activeTab === "virksomheder";
  const showCompanyContext = isPlatformAdmin && ![
    "dashboard", "virksomheder", "fagportal", "driftsklarhed", "kontrolcenter",
    "systemovervaagning", "sikkerhedsaudit", "compliance_checks", "leveringslog",
  ].includes(activeTab);

  const openCompany = (companyId: number) => {
    setSelectedCompanyId(companyId);
    window.location.hash = "/smartregnskab/app/virksomheds_dashboard";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={platformOverview ? "Platformoverblik" : companiesOverview ? "Virksomheder" : selectedCompany?.name ?? "Virksomhedsregnskab"}
        description={
          platformOverview
            ? "Administrér kunder, fagbrugere, drift og sikkerhed fra ét samlet overblik."
            : companiesOverview
              ? "Vælg en virksomhed for at åbne dens regnskab og arbejdsområder."
              : "Arbejd fokuseret med den valgte virksomheds økonomi, bilag og rapportering."
        }
      />

      {showCompanyContext && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between" data-testid="company-context-bar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Aktiv virksomhed</p><p className="truncate text-sm font-semibold">{selectedCompany?.name ?? "Vælg virksomhed"}</p></div>
          </div>
          <Select value={effectiveCompanyId ? String(effectiveCompanyId) : undefined} onValueChange={(value) => setSelectedCompanyId(Number(value))}>
            <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-active-company"><SelectValue placeholder="Vælg virksomhed" /></SelectTrigger>
            <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-4">
          {!effectiveCompanyId && !(platformOverview || companiesOverview) ? (
            <SectionCard>
              <div className="py-8 text-center"><Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Vælg en virksomhed</p><p className="mt-1 text-xs text-muted-foreground">Åbn Virksomheder i menuen for at fortsætte.</p></div>
            </SectionCard>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* ---------- DASHBOARD ---------- */}
              {isPlatformAdmin && (
                <TabsContent value="dashboard" className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="platform-kpis">
                    <KpiCard label="Virksomheder" value={num(companies.length)} icon={<Building2 className="size-4" />} variant="blue" testId="kpi-platform-companies" />
                    <KpiCard label="Konti i alt" value={num(companies.reduce((sum, company) => sum + Number(company.accountCount ?? 0), 0))} icon={<BookOpen className="size-4" />} variant="green" testId="kpi-platform-accounts" />
                    <KpiCard label="Bogføringsposter" value={num(companies.reduce((sum, company) => sum + Number(company.entryCount ?? 0), 0))} icon={<FileText className="size-4" />} variant="gray" testId="kpi-platform-entries" />
                    <KpiCard label="Systemstatus" value="Driftsklar" icon={<ShieldCheck className="size-4" />} variant="green" testId="kpi-platform-status" />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
                    <SectionCard title="Virksomheder" icon={<Building2 className="size-4" />} noPadding>
                      {companiesQuery.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
                        : companies.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ingen virksomheder er oprettet endnu.</p>
                        : <div className="divide-y" data-testid="platform-company-list">{companies.slice(0, 6).map((company) => <button key={company.id} type="button" onClick={() => openCompany(company.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{company.name}</p><p className="text-xs text-muted-foreground">{num(company.accountCount ?? 0)} konti · {num(company.entryCount ?? 0)} poster</p></div>
                          <span className="hidden text-xs font-medium text-primary sm:inline">Åbn regnskab</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>)}</div>}
                    </SectionCard>

                    <SectionCard title="Hurtige handlinger" icon={<Zap className="size-4" />}>
                      <div className="grid gap-2">
                        {[
                          ["Virksomheder", "#/smartregnskab/app/virksomheder", Building2],
                          ["Bogholder & Revisor", "#/smartregnskab/app/fagportal", Briefcase],
                          ["Driftsklarhed", "#/smartregnskab/app/driftsklarhed", ShieldCheck],
                          ["Kontrolcenter", "#/smartregnskab/app/kontrolcenter", ClipboardCheck],
                        ].map(([label, href, Icon]: any) => <a key={label} href={href} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"><Icon className="h-4 w-4 text-primary" /><span className="flex-1">{label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></a>)}
                      </div>
                    </SectionCard>
                  </div>
                </TabsContent>
              )}

              {isPlatformAdmin && (
                <TabsContent value="virksomheder" className="space-y-4">
                  <SectionCard title="Alle virksomheder" icon={<Building2 className="size-4" />} noPadding>
                    {companiesQuery.isLoading ? <div className="grid gap-3 p-4 sm:grid-cols-2"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
                      : companiesQuery.isError ? <p className="p-5 text-sm text-destructive">Kunne ikke hente virksomheder.</p>
                      : companies.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ingen virksomheder fundet.</p>
                      : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="list-companies">{companies.map((company) => <button key={company.id} type="button" data-testid={`btn-company-${company.id}`} onClick={() => openCompany(company.id)} className="group rounded-xl border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                        <div className="mb-4 flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
                        <p className="truncate text-sm font-semibold">{company.name}</p><p className="mt-1 text-xs text-muted-foreground">{num(company.accountCount ?? 0)} konti · {num(company.entryCount ?? 0)} poster</p>
                      </button>)}</div>}
                  </SectionCard>
                </TabsContent>
              )}

              <TabsContent value="driftsklarhed" className="space-y-4">
                <Driftsklarhed />
              </TabsContent>

              <TabsContent value={isPlatformAdmin ? "virksomheds_dashboard" : "dashboard"} className="space-y-4">
                <SectionCard
                  title="Dashboard"
                  icon={<LayoutDashboard className="size-4" />}
                >
                  {dashboardQuery.isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : dashboardQuery.isError ? (
                    <p className="text-xs text-destructive py-2">
                      Kunne ikke hente dashboard.
                    </p>
                  ) : (
                    <div
                      className="grid grid-cols-2 md:grid-cols-4 gap-2"
                      data-testid="dashboard-kpis"
                    >
                      <KpiCard
                        label="Omsætning"
                        value={money(dashboard?.omsætning ?? dashboard?.revenue)}
                        icon={<TrendingUp className="size-4" />}
                        variant="green"
                        testId="kpi-omsaetning"
                      />
                      <KpiCard
                        label="Udgifter"
                        value={money(dashboard?.udgifter ?? dashboard?.expenses)}
                        icon={<TrendingDown className="size-4" />}
                        variant="red"
                        testId="kpi-udgifter"
                      />
                      <KpiCard
                        label="Resultat"
                        value={money(dashboard?.resultat ?? dashboard?.result)}
                        icon={<Banknote className="size-4" />}
                        variant="blue"
                        testId="kpi-resultat"
                      />
                      <KpiCard
                        label="Moms skyldig"
                        value={money(dashboard?.momsSkyldig ?? dashboard?.vatPayable)}
                        icon={<Calculator className="size-4" />}
                        variant="amber"
                        testId="kpi-moms-skyldig"
                      />
                      <KpiCard
                        label="Forfaldne fakturaer"
                        value={num(dashboard?.forfaldneFakturaer ?? dashboard?.overdueInvoices)}
                        icon={<AlertTriangle className="size-4" />}
                        variant="red"
                        testId="kpi-forfaldne-fakturaer"
                      />
                      <KpiCard
                        label="Åbne kladder"
                        value={num(dashboard?.åbneKladder ?? dashboard?.openDrafts)}
                        icon={<FileText className="size-4" />}
                        variant="amber"
                        testId="kpi-aabne-kladder"
                      />
                      <KpiCard
                        label="Afventende banktransaktioner"
                        value={num(dashboard?.afventendeBankTx ?? dashboard?.pendingBankTx)}
                        icon={<Inbox className="size-4" />}
                        variant="gray"
                        testId="kpi-afventende-bank"
                      />
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Kommende frister"
                  icon={<Clock className="size-4" />}
                  noPadding
                >
                  {dashboardQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (dashboard?.upcomingDeadlines ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">
                      Ingen kommende frister.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border" data-testid="list-upcoming-deadlines">
                      {(dashboard?.upcomingDeadlines ?? []).map((d, i) => {
                        const status = d.status ?? "";
                        return (
                          <li key={d.id ?? i} className="px-3 py-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {d.label ?? d.type ?? "Frist"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {d.period ? `${d.period} · ` : ""}Forfald {dk(d.deadline)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {d.amount != null && (
                                <span className="text-xs tabular-nums">{money(d.amount)}</span>
                              )}
                              {status && (
                                <StatusChip
                                  status={TAX_STATUS_LABEL[status] ?? status}
                                  variant={TAX_STATUS_VARIANT[status] ?? "gray"}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- KONTOPLAN & BOGFØRING ---------- */}
              <TabsContent value="kontoplan" className="space-y-4">
                {detailQuery.isLoading ? (
                  <SectionCard>
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </SectionCard>
                ) : detailQuery.isError ? (
                  <SectionCard>
                    <p className="text-xs text-destructive py-2">
                      Kunne ikke hente regnskabsdata for virksomheden.
                    </p>
                  </SectionCard>
                ) : (
                  <>
                    <SectionCard title="Kontoplan" icon={<BookOpen className="size-4" />} noPadding>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" data-testid="table-accounts">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="font-medium px-3 py-1.5">Konto</th>
                              <th className="font-medium px-3 py-1.5">Navn</th>
                              <th className="font-medium px-3 py-1.5">Type</th>
                              <th className="font-medium px-3 py-1.5">Momskode</th>
                              <th className="font-medium px-3 py-1.5 text-right">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-3 text-muted-foreground">
                                  Ingen konti.
                                </td>
                              </tr>
                            ) : (
                              accounts.map((a) => (
                                <tr key={a.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-1.5 font-mono">{a.accountNumber}</td>
                                  <td className="px-3 py-1.5">{a.name}</td>
                                  <td className="px-3 py-1.5">
                                    <StatusChip
                                      status={ACCOUNT_TYPE_LABEL[a.type] ?? a.type}
                                      variant={ACCOUNT_TYPE_VARIANT[a.type] ?? "gray"}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">{a.vatCode ?? "—"}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">
                                    {money(a.balance)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>

                    <SectionCard title="Bogføringsposter" icon={<FileText className="size-4" />} noPadding>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" data-testid="table-entries">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="font-medium px-3 py-1.5">Bilag</th>
                              <th className="font-medium px-3 py-1.5">Dato</th>
                              <th className="font-medium px-3 py-1.5">Beskrivelse</th>
                              <th className="font-medium px-3 py-1.5">Reference</th>
                              <th className="font-medium px-3 py-1.5">Kilde</th>
                              <th className="font-medium px-3 py-1.5">Status</th>
                              <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-3 py-3 text-muted-foreground">
                                  Ingen bogføringsposter.
                                </td>
                              </tr>
                            ) : (
                              entries.map((e) => {
                                const statusVariant =
                                  ENTRY_STATUS_VARIANT[e.status ?? ""] ?? "gray";
                                return (
                                  <tr key={e.id} className="border-b border-border/50 last:border-0">
                                    <td className="px-3 py-1.5 font-mono">{e.entryNumber ?? "—"}</td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">{dk(e.date)}</td>
                                    <td className="px-3 py-1.5 max-w-[260px] truncate" title={e.description ?? ""}>
                                      {e.description ?? "—"}
                                    </td>
                                    <td className="px-3 py-1.5">{e.reference ?? "—"}</td>
                                    <td className="px-3 py-1.5">{e.sourceType ?? "—"}</td>
                                    <td className="px-3 py-1.5">
                                      {e.status && (
                                        <StatusChip status={e.status} variant={statusVariant} />
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">
                                      {money(e.amount)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>
                  </>
                )}
              </TabsContent>

              {/* ---------- BILAG & UD GIFTER ---------- */}
              <TabsContent value="bilag" className="space-y-4">
                <SectionCard
                  title="Bilag & Udgifter"
                  icon={<Receipt className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-nyt-bilag"
                      onClick={() => setVoucherDialogOpen(true)}
                    >
                      <FileText className="size-4" />
                      Nyt bilag
                    </Button>
                  }
                  noPadding
                >
                  {vouchersQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : vouchersQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente bilag.</p>
                  ) : vouchers.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen bilag.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-vouchers">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Bilagsnr.</th>
                            <th className="font-medium px-3 py-1.5">Leverandør</th>
                            <th className="font-medium px-3 py-1.5">Dato</th>
                            <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                            <th className="font-medium px-3 py-1.5 text-right">Moms</th>
                            <th className="font-medium px-3 py-1.5">Kategori</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vouchers.map((v) => {
                            const status = v.status ?? "";
                            return (
                              <tr key={v.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 font-mono">{v.voucherNumber ?? "—"}</td>
                                <td className="px-3 py-1.5">{v.supplier ?? "—"}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{dk(v.date)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(v.amount)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(v.vatAmount)}</td>
                                <td className="px-3 py-1.5">
                                  {v.category ? (VOUCHER_CATEGORY_LABEL[v.category] ?? v.category) : "—"}
                                </td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip
                                      status={VOUCHER_STATUS_LABEL[status] ?? status}
                                      variant={VOUCHER_STATUS_VARIANT[status] ?? "gray"}
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`btn-bogfoer-bilag-${v.id}`}
                                      onClick={() => postVoucherMut.mutate(v.id)}
                                      disabled={postVoucherMut.isPending || status === "bogfoert" || status === "bogført"}
                                    >
                                      <FileCheck2 className="size-3.5" />
                                      Bogfør
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`btn-slet-bilag-${v.id}`}
                                      onClick={() => deleteVoucherMut.mutate(v.id)}
                                      disabled={deleteVoucherMut.isPending}
                                    >
                                      <Trash2 className="size-3.5" />
                                      Slet
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Nyt bilag */}
                <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
                  <DialogContent data-testid="dialog-nyt-bilag">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Nyt bilag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="vf-supplier">Leverandør</Label>
                        <Input
                          id="vf-supplier"
                          data-testid="input-bilag-supplier"
                          value={voucherForm.supplier}
                          onChange={(e) => setVoucherForm((f) => ({ ...f, supplier: e.target.value }))}
                          placeholder="F.eks. Eksempel Produktion ApS"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="vf-date">Dato</Label>
                          <Input
                            id="vf-date"
                            type="date"
                            data-testid="input-bilag-date"
                            value={voucherForm.date}
                            onChange={(e) => setVoucherForm((f) => ({ ...f, date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="vf-amount">Beløb (inkl. moms)</Label>
                          <Input
                            id="vf-amount"
                            type="number"
                            step="0.01"
                            data-testid="input-bilag-amount"
                            value={voucherForm.amount}
                            onChange={(e) => setVoucherForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="vf-vatrate">Momsrate (%)</Label>
                          <Input
                            id="vf-vatrate"
                            type="number"
                            step="1"
                            data-testid="input-bilag-vatrate"
                            value={voucherForm.vatRate}
                            onChange={(e) => setVoucherForm((f) => ({ ...f, vatRate: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Kategori</Label>
                          <Select
                            value={voucherForm.category}
                            onValueChange={(val) => setVoucherForm((f) => ({ ...f, category: val }))}
                          >
                            <SelectTrigger data-testid="select-bilag-category">
                              <SelectValue placeholder="Vælg kategori" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kontor" data-testid="opt-bilag-kontor">Kontor</SelectItem>
                              <SelectItem value="transport" data-testid="opt-bilag-transport">Transport</SelectItem>
                              <SelectItem value="materialer" data-testid="opt-bilag-materialer">Materialer</SelectItem>
                              <SelectItem value="andre" data-testid="opt-bilag-andre">Andre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="vf-desc">Beskrivelse</Label>
                        <Textarea
                          id="vf-desc"
                          data-testid="input-bilag-description"
                          value={voucherForm.description}
                          onChange={(e) => setVoucherForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Beskrivelse af bilaget"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        data-testid="btn-bilag-annuller"
                        onClick={() => setVoucherDialogOpen(false)}
                      >
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-bilag-gem"
                        onClick={() => createVoucherMut.mutate()}
                        disabled={createVoucherMut.isPending || !voucherForm.supplier || !voucherForm.amount}
                      >
                        {createVoucherMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Gem bilag
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- BANKAFSTEMNING ---------- */}
              <TabsContent value="bank" className="space-y-4">
                <SectionCard
                  title="Bankafstemning"
                  icon={<Landmark className="size-4" />}
                  action={
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="btn-auto-match"
                        onClick={() => autoMatchMut.mutate()}
                        disabled={autoMatchMut.isPending}
                      >
                        {autoMatchMut.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Wand2 className="size-4" />
                        )}
                        Auto-match
                      </Button>
                      <Button
                        size="sm"
                        data-testid="btn-import-bank"
                        onClick={() => setImportDialogOpen(true)}
                      >
                        <Upload className="size-4" />
                        Importér bankudskrift
                      </Button>
                    </div>
                  }
                  noPadding
                >
                  {bankTxQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : bankTxQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente banktransaktioner.</p>
                  ) : bankTx.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">
                      Ingen banktransaktioner. Importér en bankudskrift for at begynde.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-bank-tx">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Dato</th>
                            <th className="font-medium px-3 py-1.5">Beskrivelse</th>
                            <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5">Match</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bankTx.map((t) => {
                            const status = t.status ?? "";
                            return (
                              <tr key={t.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 whitespace-nowrap">{dk(t.date)}</td>
                                <td className="px-3 py-1.5 max-w-[260px] truncate" title={t.description ?? ""}>
                                  {t.description ?? "—"}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(t.amount)}</td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip
                                      status={BANK_STATUS_LABEL[status] ?? status}
                                      variant={BANK_STATUS_VARIANT[status] ?? "gray"}
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-1.5">{t.matchedType ?? "—"}</td>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`btn-match-faktura-${t.id}`}
                                      onClick={() => matchBankMut.mutate({ id: t.id, matchedType: "faktura" })}
                                      disabled={matchBankMut.isPending}
                                    >
                                      Match faktura
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`btn-match-bilag-${t.id}`}
                                      onClick={() => matchBankMut.mutate({ id: t.id, matchedType: "bilag" })}
                                      disabled={matchBankMut.isPending}
                                    >
                                      Match bilag
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      data-testid={`btn-ignore-bank-${t.id}`}
                                      onClick={() => ignoreBankMut.mutate(t.id)}
                                      disabled={ignoreBankMut.isPending}
                                    >
                                      Ignorer
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Importér bankudskrift */}
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogContent data-testid="dialog-import-bank">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Importér bankudskrift</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Indsæt CSV-data adskilt med semikolon. Første linje springes over hvis det er en
                        overskrift. Format: <code className="font-mono">dato;beskrivelse;beløb;saldo</code>
                      </p>
                      <Textarea
                        data-testid="input-csv-bank"
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        placeholder={"01.08.2026;Betaling fra kunde;12500,00;112500,00\n02.08.2026;Husleje;-8000,00;104500,00"}
                        className="min-h-[160px] font-mono text-xs"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        data-testid="btn-import-annuller"
                        onClick={() => setImportDialogOpen(false)}
                      >
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-import-gem"
                        onClick={() => importBankMut.mutate()}
                        disabled={importBankMut.isPending || !csvText.trim()}
                      >
                        {importBankMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Importér
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- MOMS & SKAT ---------- */}
              <TabsContent value="moms" className="space-y-4">
                <SectionCard
                  title="Fristkalender"
                  icon={<CalendarClock className="size-4" />}
                  noPadding
                >
                  {taxDeadlinesQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : taxDeadlinesQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente frister.</p>
                  ) : taxDeadlines.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen frister.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-tax-deadlines">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Type</th>
                            <th className="font-medium px-3 py-1.5">Periode</th>
                            <th className="font-medium px-3 py-1.5">Frist</th>
                            <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handling</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taxDeadlines.map((t) => {
                            const status = t.status ?? "";
                            const submitted =
                              status === "submitted" || status === "indsendt" || status === "paid" || status === "betalt";
                            return (
                              <tr key={t.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5">{t.type ?? "—"}</td>
                                <td className="px-3 py-1.5">{t.period ?? "—"}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{dk(t.deadline)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(t.amount)}</td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip
                                      status={TAX_STATUS_LABEL[status] ?? status}
                                      variant={TAX_STATUS_VARIANT[status] ?? "gray"}
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-tax-submit-${t.id}`}
                                    onClick={() => submitTaxMut.mutate(t.id)}
                                    disabled={submitTaxMut.isPending || submitted}
                                  >
                                    <Check className="size-3.5" />
                                    Marker indsendt
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Momsperioder" icon={<Calculator className="size-4" />} noPadding>
                  {detailQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-vat-periods">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Periode</th>
                            <th className="font-medium px-3 py-1.5">Type</th>
                            <th className="font-medium px-3 py-1.5">Udgående moms</th>
                            <th className="font-medium px-3 py-1.5">Indgående moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Netto moms</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5">Forfald</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vatPeriods.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-3 text-muted-foreground">
                                Ingen momsperioder.
                              </td>
                            </tr>
                          ) : (
                            vatPeriods.map((v) => {
                              const statusVariant =
                                VAT_STATUS_VARIANT[v.status ?? ""] ?? "gray";
                              return (
                                <tr key={v.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-1.5">{v.period ?? dk(v.periodStart)}</td>
                                  <td className="px-3 py-1.5">{v.vatType ?? "—"}</td>
                                  <td className="px-3 py-1.5 tabular-nums">{money(v.outputVat)}</td>
                                  <td className="px-3 py-1.5 tabular-nums">{money(v.inputVat)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">
                                    {money(v.netVat ?? v.reportedAmount)}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    {v.status && <StatusChip status={v.status} variant={statusVariant} />}
                                  </td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{dk(v.dueDate)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- RAPPORTER ---------- */}
              <TabsContent value="rapporter" className="space-y-4">
                <SectionCard title="Rapporter" icon={<FileBarChart className="size-4" />}>
                  <div className="flex flex-wrap gap-2" data-testid="report-buttons">
                    {REPORT_TYPES.map((r) => (
                      <Button
                        key={r.value}
                        size="sm"
                        variant={reportType === r.value ? "default" : "outline"}
                        data-testid={`btn-report-${r.value}`}
                        onClick={() => setReportType(r.value)}
                      >
                        <FileBarChart className="size-4" />
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </SectionCard>

                {reportType && (
                  <SectionCard
                    title={REPORT_TYPES.find((r) => r.value === reportType)?.label ?? "Rapport"}
                    icon={<FileText className="size-4" />}
                    noPadding
                  >
                    {reportQuery.isLoading ? (
                      <div className="p-2 space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : reportQuery.isError ? (
                      <p className="text-xs text-destructive p-3">Kunne ikke hente rapport.</p>
                    ) : reportQuery.data ? (
                      <ReportView data={reportQuery.data} testId="report-result" />
                    ) : null}
                  </SectionCard>
                )}
              </TabsContent>

              {/* ---------- AI REGNSKAB (BETA) ---------- */}
              <TabsContent value="ai" className="space-y-4">
                <SectionCard
                  title="AI Regnskab (beta)"
                  icon={<Sparkles className="size-4" />}
                  action={
                    <Button
                      data-testid="btn-ai-scan"
                      size="sm"
                      onClick={() => scanMut.mutate()}
                      disabled={scanMut.isPending}
                    >
                      {scanMut.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ScanLine className="size-4" />
                      )}
                      Scan nu
                    </Button>
                  }
                >
                  {/* Disclaimer banner */}
                  <div
                    data-testid="ai-disclaimer"
                    className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-2.5 mb-3"
                  >
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>AI Regnskab er BETA.</strong> Kræver revisor/juridisk godkendelse.
                      AI kan ikke erstatte en revisor 100%.
                    </p>
                  </div>

                  {aiTasksQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : aiTasksQuery.isError ? (
                    <p className="text-xs text-muted-foreground">
                      Kunne ikke hente AI-opgaver.
                    </p>
                  ) : aiTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Ingen AI-opgaver. Klik "Scan nu" for at oprette opgaver.
                    </p>
                  ) : (
                    <ul className="space-y-2" data-testid="list-ai-tasks">
                      {aiTasks.map((task) => {
                        const decided = task.status === "godkendt" || task.status === "afvist";
                        return (
                          <li
                            key={task.id}
                            data-testid={`ai-task-${task.id}`}
                            className="rounded-md border border-border bg-card p-2.5 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <StatusChip
                                    status={AI_TASK_TYPE_LABEL[task.type] ?? task.type}
                                    variant={
                                      task.type === "moms"
                                        ? "amber"
                                        : task.type === "compliance"
                                          ? "red"
                                          : "blue"
                                    }
                                  />
                                  <p className="text-xs font-medium truncate">{task.title}</p>
                                </div>
                                {task.description && (
                                  <p className="text-[11px] text-muted-foreground mt-1">
                                    {task.description}
                                  </p>
                                )}
                                {task.suggestion && (
                                  <p className="text-[11px] mt-1 rounded bg-muted/50 px-2 py-1">
                                    <span className="font-medium">Forslag:</span> {task.suggestion}
                                  </p>
                                )}
                              </div>
                              {task.status && decided && (
                                <StatusChip
                                  status={task.status}
                                  variant={task.status === "godkendt" ? "green" : "red"}
                                />
                              )}
                            </div>
                            {!decided && (
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  data-testid={`btn-ai-godkend-${task.id}`}
                                  size="sm"
                                  variant="default"
                                  onClick={() =>
                                    decideMut.mutate({ taskId: task.id, decision: "godkend" })
                                  }
                                  disabled={decideMut.isPending}
                                >
                                  <Check className="size-3.5" />
                                  Godkend
                                </Button>
                                <Button
                                  data-testid={`btn-ai-afvis-${task.id}`}
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    decideMut.mutate({ taskId: task.id, decision: "afvis" })
                                  }
                                  disabled={decideMut.isPending}
                                >
                                  <X className="size-3.5" />
                                  Afvis
                                </Button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- AUTOMATISERING & AI ---------- */}
              <TabsContent value="automatisering" className="space-y-4">
                <SectionCard
                  title="Automatisering & AI"
                  icon={<Zap className="size-4" />}
                  action={
                    <Button
                      data-testid="btn-ai-auto-run"
                      size="sm"
                      onClick={() => autoRunMut.mutate()}
                      disabled={autoRunMut.isPending}
                    >
                      {autoRunMut.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Kør automatisk gennemgang
                    </Button>
                  }
                >
                  {/* Disclaimer banner */}
                  <div
                    data-testid="automatisering-disclaimer"
                    className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-2.5 mb-3"
                  >
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>AI Regnskab er BETA.</strong> Kræver revisor/juridisk godkendelse.
                      AI bogfører eller sender aldrig automatisk — alle handlinger kræver manuel godkendelse.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3" data-testid="automatisering-stats">
                    <KpiCard
                      label="Afventende opgaver"
                      value={num(pendingAiCount)}
                      icon={<Clock className="size-3.5" />}
                      variant="amber"
                      testId="stat-pending-ai"
                    />
                    <KpiCard
                      label="Godkendte opgaver"
                      value={num(aiTasks.filter((t) => t.status === "godkendt").length)}
                      icon={<Check className="size-3.5" />}
                      variant="green"
                      testId="stat-approved-ai"
                    />
                    <KpiCard
                      label="Afviste opgaver"
                      value={num(aiTasks.filter((t) => t.status === "afvist" || t.status === "fejlet").length)}
                      icon={<X className="size-3.5" />}
                      variant="red"
                      testId="stat-rejected-ai"
                    />
                  </div>

                  {aiTasksQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : aiTasksQuery.isError ? (
                    <p className="text-xs text-muted-foreground">
                      Kunne ikke hente AI-opgaver.
                    </p>
                  ) : aiTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2" data-testid="empty-automatisering">
                      Ingen AI-opgaver. Klik "Kør automatisk gennemgang" for at starte.
                    </p>
                  ) : (
                    <div className="space-y-4" data-testid="list-automatisering-tasks">
                      {(["bogføring", "bankafstemning", "moms", "debitor", "periodeafslutning", "compliance"] as AiTaskType[])
                        .map((groupType) => {
                          const groupTasks = aiTasks.filter((t) => t.type === groupType);
                          if (groupTasks.length === 0) return null;
                          return (
                            <div key={groupType} data-testid={`automatisering-group-${groupType}`}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <StatusChip
                                  status={AI_TASK_TYPE_LABEL[groupType]}
                                  variant={AI_TASK_TYPE_VARIANT[groupType]}
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  {groupTasks.length} opgave{groupTasks.length !== 1 ? "r" : ""}
                                </span>
                              </div>
                              <ul className="space-y-2">
                                {groupTasks.map((task) => {
                                  const decided =
                                    task.status === "godkendt" ||
                                    task.status === "afvist" ||
                                    task.status === "fejlet";
                                  const statusVariant =
                                    AI_TASK_STATUS_VARIANT[task.status ?? ""] ?? "gray";
                                  const sug = parseAiSuggestion(task.suggestion);
                                  return (
                                    <li
                                      key={task.id}
                                      data-testid={`auto-task-${task.id}`}
                                      className="rounded-md border border-border bg-card p-2.5 space-y-1.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium truncate">{task.title}</p>
                                          {task.description && (
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                              {task.description}
                                            </p>
                                          )}
                                        </div>
                                        {task.status && (
                                          <StatusChip status={task.status} variant={statusVariant} />
                                        )}
                                      </div>
                                      {sug && (
                                        <div className="text-[11px] rounded bg-muted/50 px-2 py-1.5 space-y-0.5" data-testid={`auto-task-suggestion-${task.id}`}>
                                          <p className="font-medium">AI-forslag:</p>
                                          {sug.account && (
                                            <p>
                                              <span className="text-muted-foreground">Konto:</span>{" "}
                                              <span className="font-mono">{sug.account}</span>
                                              {sug.accountName ? ` — ${sug.accountName}` : ""}
                                            </p>
                                          )}
                                          {sug.debitAccount && (
                                            <p>
                                              <span className="text-muted-foreground">Debet:</span>{" "}
                                              <span className="font-mono">{sug.debitAccount}</span>
                                              {sug.creditAccount ? (
                                                <>
                                                  {" · "}
                                                  <span className="text-muted-foreground">Kredit:</span>{" "}
                                                  <span className="font-mono">{sug.creditAccount}</span>
                                                </>
                                              ) : null}
                                            </p>
                                          )}
                                          {sug.vatAccount && (
                                            <p>
                                              <span className="text-muted-foreground">Momskonto:</span>{" "}
                                              <span className="font-mono">{sug.vatAccount}</span>
                                            </p>
                                          )}
                                          {sug.vatCode && (
                                            <p>
                                              <span className="text-muted-foreground">Momsgruppe:</span>{" "}
                                              {sug.vatCode}
                                            </p>
                                          )}
                                          {sug.amount != null && (
                                            <p>
                                              <span className="text-muted-foreground">Beløb:</span>{" "}
                                              <span className="tabular-nums">{money(sug.amount)}</span>
                                              {sug.vatAmount != null ? (
                                                <span className="text-muted-foreground">
                                                  {" (moms: "}
                                                  <span className="tabular-nums">{money(sug.vatAmount)}</span>
                                                  {")"}
                                                </span>
                                              ) : null}
                                            </p>
                                          )}
                                          {sug.action && (
                                            <p>
                                              <span className="text-muted-foreground">Handling:</span>{" "}
                                              {sug.action}
                                            </p>
                                          )}
                                          {sug.period && (
                                            <p>
                                              <span className="text-muted-foreground">Periode:</span>{" "}
                                              {sug.period}
                                            </p>
                                          )}
                                          {sug.note && (
                                            <p className="italic text-muted-foreground">{sug.note}</p>
                                          )}
                                        </div>
                                      )}
                                      {!decided && (
                                        <div className="flex items-center gap-2 pt-1">
                                          <Button
                                            data-testid={`btn-auto-godkend-${task.id}`}
                                            size="sm"
                                            variant="default"
                                            onClick={() =>
                                              decideMut.mutate({ taskId: task.id, decision: "godkend" })
                                            }
                                            disabled={decideMut.isPending}
                                          >
                                            <Check className="size-3.5" />
                                            Godkend
                                          </Button>
                                          <Button
                                            data-testid={`btn-auto-afvis-${task.id}`}
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              decideMut.mutate({ taskId: task.id, decision: "afvis" })
                                            }
                                            disabled={decideMut.isPending}
                                          >
                                            <X className="size-3.5" />
                                            Afvis
                                          </Button>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- DEBITOR/KREDITOR ---------- */}
              <TabsContent value="debitor" className="space-y-4">
                <SectionCard title="Debitor/Kreditor" icon={<ArrowLeftRight className="size-4" />}>
                  {debitorQuery.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : debitorQuery.isError ? (
                    <p className="text-xs text-destructive">Kunne ikke hente debitor/kreditor-oversigt.</p>
                  ) : !debitorData ? (
                    <p className="text-xs text-muted-foreground">Ingen data tilgængelig.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="debitor-kreditor-stats">
                      <KpiCard
                        label="Total debitor"
                        value={money(debitorData.totals?.debitorTotal)}
                        icon={<TrendingUp className="size-3.5" />}
                        variant="green"
                        testId="stat-debitor-total"
                      />
                      <KpiCard
                        label="Total kreditor"
                        value={money(debitorData.totals?.kreditorTotal)}
                        icon={<TrendingDown className="size-3.5" />}
                        variant="red"
                        testId="stat-kreditor-total"
                      />
                      <KpiCard
                        label="Forfaldne fakturaer"
                        value={num(debitorData.totals?.overdueCount)}
                        icon={<AlertTriangle className="size-3.5" />}
                        variant="amber"
                        testId="stat-overdue-invoices"
                      />
                    </div>
                  )}
                </SectionCard>

                {debitorData && (
                  <>
                    <SectionCard title="Debitorer (åbne fakturaer)" icon={<FileText className="size-4" />} noPadding>
                      {debitorData.debitorer.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3">Ingen åbne fakturaer.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs" data-testid="table-debitorer">
                            <thead>
                              <tr className="text-left text-muted-foreground border-b border-border">
                                <th className="font-medium px-3 py-1.5">Fakturanr.</th>
                                <th className="font-medium px-3 py-1.5">Kunde</th>
                                <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                                <th className="font-medium px-3 py-1.5">Forfaldsdato</th>
                                <th className="font-medium px-3 py-1.5">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debitorData.debitorer.map((d) => (
                                <tr key={d.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-1.5 font-mono">{d.number ?? "—"}</td>
                                  <td className="px-3 py-1.5">{d.customer ?? "—"}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{money(d.amount)}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{dk(d.dueDate)}</td>
                                  <td className="px-3 py-1.5">
                                    {d.status && (
                                      <StatusChip
                                        status={d.status}
                                        variant={d.status === "overdue" || d.status === "forfalden" ? "red" : "amber"}
                                      />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Kreditorer (åbne bilag)" icon={<Receipt className="size-4" />} noPadding>
                      {debitorData.kreditorer.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3">Ingen åbne bilag.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs" data-testid="table-kreditorer">
                            <thead>
                              <tr className="text-left text-muted-foreground border-b border-border">
                                <th className="font-medium px-3 py-1.5">Leverandør</th>
                                <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                                <th className="font-medium px-3 py-1.5">Dato</th>
                                <th className="font-medium px-3 py-1.5">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debitorData.kreditorer.map((k) => (
                                <tr key={k.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-1.5">{k.supplier ?? "—"}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{money(k.amount)}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{dk(k.date)}</td>
                                  <td className="px-3 py-1.5">
                                    {k.status && (
                                      <StatusChip status={k.status} variant="amber" />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Aldersfordeling" icon={<CalendarClock className="size-4" />} noPadding>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" data-testid="table-aging">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="font-medium px-3 py-1.5">Periode</th>
                              <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border/50">
                              <td className="px-3 py-1.5">Current</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(debitorData.aging?.current)}</td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="px-3 py-1.5">0–30 dage</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(debitorData.aging?.d0_30)}</td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="px-3 py-1.5">31–60 dage</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(debitorData.aging?.d31_60)}</td>
                            </tr>
                            <tr className="border-b border-border/50">
                              <td className="px-3 py-1.5">61–90 dage</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(debitorData.aging?.d61_90)}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1.5">90+ dage</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(debitorData.aging?.d90_plus)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>
                  </>
                )}
              </TabsContent>

              {/* ---------- PERIODEAFSLUTNING ---------- */}
              <TabsContent value="periode" className="space-y-4">
                <SectionCard
                  title="Periodeafslutning"
                  icon={<CalendarCheck className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-opret-periode"
                      onClick={() => setPeriodDialogOpen(true)}
                    >
                      <Plus className="size-4" />
                      Opret periode
                    </Button>
                  }
                >
                  <p className="text-xs text-muted-foreground">
                    Opret og gennemfør periodeafslutninger med automatisk tjekliste (måned, kvartal eller år).
                  </p>
                </SectionCard>

                <SectionCard title="Perioder" icon={<CalendarCheck className="size-4" />} noPadding>
                  {periodClosesQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : periodClosesQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente perioder.</p>
                  ) : periodCloses.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3" data-testid="empty-periods">
                      Ingen perioder. Klik "Opret periode" for at starte.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border" data-testid="list-period-closes">
                      {periodCloses.map((pc) => {
                        const checklist = parseChecklist(pc.checklist);
                        const doneCount = checklist.filter((c) => c.done).length;
                        const isOpen = pc.status !== "afsluttet" && pc.status !== "closed";
                        const expanded = expandedPeriodId === pc.id;
                        return (
                          <li key={pc.id} data-testid={`period-close-${pc.id}`} className="p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium">{pc.periodLabel ?? "—"}</p>
                                  {pc.status && (
                                    <StatusChip
                                      status={PERIOD_STATUS_LABEL[pc.status] ?? pc.status}
                                      variant={PERIOD_STATUS_VARIANT[pc.status] ?? "gray"}
                                    />
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {PERIOD_TYPE_LABEL[pc.periodType ?? ""] ?? pc.periodType ?? "—"}
                                  {" · "}{dk(pc.startDate)} – {dk(pc.endDate)}
                                  {" · "}{doneCount}/{checklist.length} opgaver
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  data-testid={`btn-period-toggle-${pc.id}`}
                                  onClick={() => setExpandedPeriodId(expanded ? null : pc.id)}
                                >
                                  <ChevronDown
                                    className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                                  />
                                  {expanded ? "Skjul" : "Tjekliste"}
                                </Button>
                                {isOpen && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-period-close-${pc.id}`}
                                    onClick={() => closePeriodMut.mutate(pc.id)}
                                    disabled={closePeriodMut.isPending}
                                  >
                                    <FileCheck2 className="size-3.5" />
                                    Afslut periode
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Collapsible open={expanded}>
                              <CollapsibleContent className="space-y-1 pt-1">
                                {checklist.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground">Ingen tjekliste.</p>
                                ) : (
                                  checklist.map((item, idx) => (
                                    <label
                                      key={idx}
                                      className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer"
                                      data-testid={`period-checklist-${pc.id}-${idx}`}
                                    >
                                      <Checkbox
                                        checked={item.done}
                                        onCheckedChange={() =>
                                          toggleChecklistMut.mutate({ id: pc.id, index: idx })
                                        }
                                        disabled={toggleChecklistMut.isPending || !isOpen}
                                        data-testid={`chk-period-${pc.id}-${idx}`}
                                      />
                                      <span className={`text-xs ${item.done ? "line-through text-muted-foreground" : ""}`}>
                                        {item.task}
                                      </span>
                                    </label>
                                  ))
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>

                {/* Dialog: Opret periode */}
                <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
                  <DialogContent data-testid="dialog-opret-periode">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Opret periode</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="pf-type">Periode-type</Label>
                        <Select
                          value={periodForm.periodType}
                          onValueChange={(val) => setPeriodForm((f) => ({ ...f, periodType: val }))}
                        >
                          <SelectTrigger data-testid="select-periode-type">
                            <SelectValue placeholder="Vælg type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="maaned" data-testid="opt-periode-maaned">Måned</SelectItem>
                            <SelectItem value="kvartal" data-testid="opt-periode-kvartal">Kvartal</SelectItem>
                            <SelectItem value="aar" data-testid="opt-periode-aar">År</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="pf-label">Periode-betegnelse</Label>
                        <Input
                          id="pf-label"
                          data-testid="input-periode-label"
                          value={periodForm.periodLabel}
                          onChange={(e) => setPeriodForm((f) => ({ ...f, periodLabel: e.target.value }))}
                          placeholder="F.eks. August 2026, Q3 2026 eller 2026"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="pf-start">Startdato</Label>
                          <Input
                            id="pf-start"
                            type="date"
                            data-testid="input-periode-start"
                            value={periodForm.startDate}
                            onChange={(e) => setPeriodForm((f) => ({ ...f, startDate: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="pf-end">Slutdato</Label>
                          <Input
                            id="pf-end"
                            type="date"
                            data-testid="input-periode-end"
                            value={periodForm.endDate}
                            onChange={(e) => setPeriodForm((f) => ({ ...f, endDate: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        data-testid="btn-periode-annuller"
                        onClick={() => setPeriodDialogOpen(false)}
                      >
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-periode-gem"
                        onClick={() => createPeriodMut.mutate()}
                        disabled={
                          createPeriodMut.isPending ||
                          !periodForm.periodLabel ||
                          !periodForm.startDate ||
                          !periodForm.endDate
                        }
                      >
                        {createPeriodMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Opret periode
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- REGNSKABSREGLER ---------- */}
              <TabsContent value="regler" className="space-y-4">
                <SectionCard
                  title="Regnskabsregler"
                  icon={<ListChecks className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-tilfoej-regel"
                      onClick={() => setRuleDialogOpen(true)}
                    >
                      <Plus className="size-4" />
                      Tilføj regel
                    </Button>
                  }
                  noPadding
                >
                  {rulesQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : rulesQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente regler.</p>
                  ) : rules.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3" data-testid="empty-rules">
                      Ingen regler. Tilføj en regel for automatisk at matche banktransaktioner.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-rules">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Match-tekst</th>
                            <th className="font-medium px-3 py-1.5">Konto</th>
                            <th className="font-medium px-3 py-1.5">Kontonavn</th>
                            <th className="font-medium px-3 py-1.5">Momsgruppe</th>
                            <th className="font-medium px-3 py-1.5">Kategori</th>
                            <th className="font-medium px-3 py-1.5">Auto-book</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map((r) => {
                            const isAuto = (r.autoBook ?? 0) === 1;
                            return (
                              <tr key={r.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 font-medium">{r.matchText ?? "—"}</td>
                                <td className="px-3 py-1.5 font-mono">{r.accountNumber ?? "—"}</td>
                                <td className="px-3 py-1.5">{r.accountName ?? "—"}</td>
                                <td className="px-3 py-1.5">{r.vatCode ?? "—"}</td>
                                <td className="px-3 py-1.5">
                                  {RULE_CATEGORY_LABEL[r.category ?? ""] ?? r.category ?? "—"}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Switch
                                    checked={isAuto}
                                    onCheckedChange={(checked) =>
                                      updateRuleMut.mutate({
                                        id: r.id,
                                        updates: { autoBook: checked ? 1 : 0 },
                                      })
                                    }
                                    disabled={updateRuleMut.isPending}
                                    data-testid={`switch-autobook-${r.id}`}
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`btn-rule-toggle-active-${r.id}`}
                                      onClick={() =>
                                        updateRuleMut.mutate({
                                          id: r.id,
                                          updates: { active: (r.active ?? 0) === 1 ? 0 : 1 },
                                        })
                                      }
                                      disabled={updateRuleMut.isPending}
                                    >
                                      <Power className="size-3.5" />
                                      {(r.active ?? 0) === 1 ? "Deaktivér" : "Aktivér"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`btn-slet-regel-${r.id}`}
                                      onClick={() => deleteRuleMut.mutate(r.id)}
                                      disabled={deleteRuleMut.isPending}
                                    >
                                      <Trash2 className="size-3.5" />
                                      Slet
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Regelforslag" icon={<ListPlus className="size-4" />} noPadding>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Foruddefinerede forslag til regler. Klik "Tilføj" for at oprette en regel ud fra forslaget.
                    </p>
                    <ul className="space-y-1.5" data-testid="list-rule-suggestions">
                      {RULE_SUGGESTIONS.map((s, i) => (
                        <li
                          key={i}
                          data-testid={`rule-suggestion-${i}`}
                          className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium">
                              {s.matchText}{" "}
                              <span className="text-muted-foreground">→ {s.accountNumber} {s.accountName}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Momsgruppe: {s.vatCode} · Kategori: {RULE_CATEGORY_LABEL[s.category] ?? s.category}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`btn-tilfoej-forslag-${i}`}
                            onClick={() => {
                              setRuleForm({
                                matchText: s.matchText,
                                accountNumber: s.accountNumber,
                                accountName: s.accountName,
                                vatCode: s.vatCode,
                                category: s.category,
                                autoBook: false,
                              });
                              setRuleDialogOpen(true);
                            }}
                          >
                            <Plus className="size-3.5" />
                            Tilføj
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </SectionCard>

                {/* Dialog: Tilføj regel */}
                <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                  <DialogContent data-testid="dialog-tilfoej-regel">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Tilføj regel</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="rf-match">Match-tekst</Label>
                        <Input
                          id="rf-match"
                          data-testid="input-regel-match"
                          value={ruleForm.matchText}
                          onChange={(e) => setRuleForm((f) => ({ ...f, matchText: e.target.value }))}
                          placeholder="F.eks. MobilePay, SKAT, Løn"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="rf-account">Kontonummer</Label>
                          <Input
                            id="rf-account"
                            data-testid="input-regel-account"
                            value={ruleForm.accountNumber}
                            onChange={(e) => setRuleForm((f) => ({ ...f, accountNumber: e.target.value }))}
                            placeholder="F.eks. 5820"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rf-name">Kontonavn</Label>
                          <Input
                            id="rf-name"
                            data-testid="input-regel-accountname"
                            value={ruleForm.accountName}
                            onChange={(e) => setRuleForm((f) => ({ ...f, accountName: e.target.value }))}
                            placeholder="F.eks. MobilePay"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="rf-vat">Momsgruppe</Label>
                          <Select
                            value={ruleForm.vatCode}
                            onValueChange={(val) => setRuleForm((f) => ({ ...f, vatCode: val }))}
                          >
                            <SelectTrigger data-testid="select-regel-vat">
                              <SelectValue placeholder="Vælg momsgruppe" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="udgaaende" data-testid="opt-vat-udgaaende">Udgående moms</SelectItem>
                              <SelectItem value="indgaaende" data-testid="opt-vat-indgaaende">Indgående moms</SelectItem>
                              <SelectItem value="ingen" data-testid="opt-vat-ingen">Ingen moms</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rf-cat">Kategori</Label>
                          <Select
                            value={ruleForm.category}
                            onValueChange={(val) => setRuleForm((f) => ({ ...f, category: val }))}
                          >
                            <SelectTrigger data-testid="select-regel-category">
                              <SelectValue placeholder="Vælg kategori" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kontor" data-testid="opt-cat-kontor">Kontor</SelectItem>
                              <SelectItem value="lon" data-testid="opt-cat-lon">Løn</SelectItem>
                              <SelectItem value="leje" data-testid="opt-cat-leje">Leje</SelectItem>
                              <SelectItem value="transport" data-testid="opt-cat-transport">Transport</SelectItem>
                              <SelectItem value="materialer" data-testid="opt-cat-materialer">Materialer</SelectItem>
                              <SelectItem value="skat" data-testid="opt-cat-skat">SKAT/Moms</SelectItem>
                              <SelectItem value="bank" data-testid="opt-cat-bank">Bank</SelectItem>
                              <SelectItem value="diverse" data-testid="opt-cat-diverse">Diverse</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="rf-autobook"
                          checked={ruleForm.autoBook}
                          onCheckedChange={(checked) => setRuleForm((f) => ({ ...f, autoBook: checked }))}
                          data-testid="switch-regel-autobook"
                        />
                        <Label htmlFor="rf-autobook" className="cursor-pointer">
                          Auto-book (bogfør automatisk ved match — ellers kun forslag til godkendelse)
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        data-testid="btn-regel-annuller"
                        onClick={() => setRuleDialogOpen(false)}
                      >
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-regel-gem"
                        onClick={() => createRuleMut.mutate()}
                        disabled={
                          createRuleMut.isPending ||
                          !ruleForm.matchText ||
                          !ruleForm.accountNumber ||
                          !ruleForm.accountName
                        }
                      >
                        {createRuleMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Gem regel
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- INTEGRATIONER ---------- */}
              <TabsContent value="integrationer" className="space-y-4">
                <SectionCard
                  title="Integrationer"
                  icon={<Plug className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-tilfoej-integration"
                      onClick={() => setIntegrationDialogOpen(true)}
                    >
                      <Plus className="size-4" />
                      Tilføj integration
                    </Button>
                  }
                  noPadding
                >
                  {integrationsQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : integrationsQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente integrationer.</p>
                  ) : integrations.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3" data-testid="empty-integrations">
                      Ingen integrationer. Tilføj en bank API, bilagsindbakke eller anden integration.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border" data-testid="list-integrations">
                      {integrations.map((it) => {
                        const status = it.status ?? "afbrudt";
                        const connected = status === "forbundet" || status === "connected";
                        return (
                          <li
                            key={it.id}
                            data-testid={`integration-${it.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium truncate">{it.displayName ?? "—"}</p>
                                <StatusChip
                                  status={INTEGRATION_STATUS_LABEL[status] ?? status}
                                  variant={INTEGRATION_STATUS_VARIANT[status] ?? "gray"}
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {INTEGRATION_TYPE_LABEL[it.type ?? ""] ?? it.type ?? "—"}
                                {it.lastSync ? ` · Seneste sync: ${dk(it.lastSync)}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={connected ? "outline" : "default"}
                                data-testid={`btn-integration-connect-${it.id}`}
                                onClick={() =>
                                  updateIntegrationMut.mutate({
                                    id: it.id,
                                    status: connected ? "afbrudt" : "forbundet",
                                  })
                                }
                                disabled={updateIntegrationMut.isPending}
                              >
                                <Power className="size-3.5" />
                                {connected ? "Afbryd" : "Tilslut"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`btn-slet-integration-${it.id}`}
                                onClick={() => deleteIntegrationMut.mutate(it.id)}
                                disabled={deleteIntegrationMut.isPending}
                              >
                                <Trash2 className="size-3.5" />
                                Slet
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>

                {/* Dialog: Tilføj integration */}
                <Dialog open={integrationDialogOpen} onOpenChange={setIntegrationDialogOpen}>
                  <DialogContent data-testid="dialog-tilfoej-integration">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Tilføj integration</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="if-type">Type</Label>
                        <Select
                          value={integrationForm.type}
                          onValueChange={(val) => setIntegrationForm((f) => ({ ...f, type: val }))}
                        >
                          <SelectTrigger data-testid="select-integration-type">
                            <SelectValue placeholder="Vælg type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_api" data-testid="opt-int-bank-api">Bank API</SelectItem>
                            <SelectItem value="bilagsindbakke" data-testid="opt-int-bilagsindbakke">Bilagsindbakke</SelectItem>
                            <SelectItem value="csv_import" data-testid="opt-int-csv-import">CSV-import</SelectItem>
                            <SelectItem value="revisor_export" data-testid="opt-int-revisor-export">Revisor-eksport</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="if-name">Visningsnavn</Label>
                        <Input
                          id="if-name"
                          data-testid="input-integration-name"
                          value={integrationForm.displayName}
                          onChange={(e) => setIntegrationForm((f) => ({ ...f, displayName: e.target.value }))}
                          placeholder="F.eks. Danske Bank API, Bilagsindbakke 2026"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        data-testid="btn-integration-annuller"
                        onClick={() => setIntegrationDialogOpen(false)}
                      >
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-integration-gem"
                        onClick={() => createIntegrationMut.mutate()}
                        disabled={createIntegrationMut.isPending || !integrationForm.displayName}
                      >
                        {createIntegrationMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Tilføj integration
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- BILAGSINDBAKKE ---------- */}
              <TabsContent value="bilagsindbakke" className="space-y-4">
                <SectionCard
                  title="Bilagsindbakke"
                  icon={<Inbox className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-upload-bilag"
                      onClick={() => setInboxUploadOpen(true)}
                    >
                      <Upload className="size-4" />
                      Upload bilag
                    </Button>
                  }
                  noPadding
                >
                  {documentInboxQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : documentInboxQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente bilagsindbakke.</p>
                  ) : documentInbox.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen dokumenter i indbakken.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-document-inbox">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Filnavn</th>
                            <th className="font-medium px-3 py-1.5">Leverandør</th>
                            <th className="font-medium px-3 py-1.5 text-right">Beløb</th>
                            <th className="font-medium px-3 py-1.5 text-right">Moms</th>
                            <th className="font-medium px-3 py-1.5">Fakturadato</th>
                            <th className="font-medium px-3 py-1.5">Konto</th>
                            <th className="font-medium px-3 py-1.5">OCR</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documentInbox.map((item) => {
                            const dup = !!item.isDuplicate;
                            return (
                              <tr key={item.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 font-medium">{item.fileName ?? "—"}</td>
                                <td className="px-3 py-1.5">{item.supplier ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(item.amount)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(item.vatAmount)}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{dk(item.invoiceDate)}</td>
                                <td className="px-3 py-1.5 font-mono">{item.suggestedAccount ?? "—"}</td>
                                <td className="px-3 py-1.5">
                                  {item.ocrStatus ? (
                                    <StatusChip status={item.ocrStatus} variant={item.ocrStatus === "afsluttet" || item.ocrStatus === "done" ? "green" : "amber"} />
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center gap-1">
                                    {item.status && (
                                      <StatusChip status={item.status} variant={VOUCHER_STATUS_VARIANT[item.status] ?? "gray"} />
                                    )}
                                    {dup && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-medium" data-testid={`dup-badge-${item.id}`}>
                                        <AlertTriangle className="size-3" />
                                        Dublet
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-konverter-bilag-${item.id}`}
                                    onClick={() => convertInboxMut.mutate(item.id)}
                                    disabled={convertInboxMut.isPending}
                                  >
                                    <FileCheck2 className="size-3.5" />
                                    Konverter til bilag
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Upload bilag */}
                <Dialog open={inboxUploadOpen} onOpenChange={setInboxUploadOpen}>
                  <DialogContent data-testid="dialog-upload-bilag">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Upload bilag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="inbox-file">Filnavn</Label>
                        <Input
                          id="inbox-file"
                          data-testid="input-inbox-filename"
                          value={inboxForm.fileName}
                          onChange={(e) => setInboxForm((f) => ({ ...f, fileName: e.target.value }))}
                          placeholder="faktura.pdf"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="inbox-source">Kilde</Label>
                        <Input
                          id="inbox-source"
                          data-testid="input-inbox-source"
                          value={inboxForm.source}
                          onChange={(e) => setInboxForm((f) => ({ ...f, source: e.target.value }))}
                          placeholder="upload / email / scan"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-inbox-annuller" onClick={() => setInboxUploadOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-inbox-gem"
                        onClick={() => uploadInboxMut.mutate()}
                        disabled={uploadInboxMut.isPending || !inboxForm.fileName}
                      >
                        {uploadInboxMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Upload
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- LØNBOGFØRING ---------- */}
              <TabsContent value="lon" className="space-y-4">
                <SectionCard
                  title="Lønbogføring"
                  icon={<Users className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-auto-lon"
                      onClick={() => setPayrollPeriodOpen(true)}
                    >
                      <Wand2 className="size-4" />
                      Auto-generer løn
                    </Button>
                  }
                  noPadding
                >
                  {payrollQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : payrollQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente lønposter.</p>
                  ) : payrollEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen lønposter.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-payroll">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Medarbejder</th>
                            <th className="font-medium px-3 py-1.5">Periode</th>
                            <th className="font-medium px-3 py-1.5 text-right">Timer</th>
                            <th className="font-medium px-3 py-1.5 text-right">Timepris</th>
                            <th className="font-medium px-3 py-1.5 text-right">Bruttoløn</th>
                            <th className="font-medium px-3 py-1.5 text-right">Ferie</th>
                            <th className="font-medium px-3 py-1.5 text-right">Pension</th>
                            <th className="font-medium px-3 py-1.5 text-right">ATP</th>
                            <th className="font-medium px-3 py-1.5 text-right">A-skat</th>
                            <th className="font-medium px-3 py-1.5 text-right">AM-bidrag</th>
                            <th className="font-medium px-3 py-1.5 text-right">Nettoløn</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollEntries.map((p) => {
                            const status = p.status ?? "";
                            return (
                              <tr key={p.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 font-medium">{p.employeeName ?? "—"}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{p.period ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{num(p.regularHours)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.hourlyRate)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.grossSalary)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.holidayPay)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.pension)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.atp)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.aTax)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(p.amContribution)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{money(p.netSalary)}</td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip status={status} variant={status === "bogfort" || status === "bogført" ? "green" : "amber"} />
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-bogfoer-lon-${p.id}`}
                                    onClick={() => postPayrollMut.mutate(p.id)}
                                    disabled={postPayrollMut.isPending || status === "bogfort" || status === "bogført"}
                                  >
                                    <FileCheck2 className="size-3.5" />
                                    Bogfør
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Auto-generer løn */}
                <Dialog open={payrollPeriodOpen} onOpenChange={setPayrollPeriodOpen}>
                  <DialogContent data-testid="dialog-auto-lon">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Auto-generer løn</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="payroll-period">Periode (f.eks. 2026-08)</Label>
                        <Input
                          id="payroll-period"
                          data-testid="input-payroll-period"
                          value={payrollPeriod}
                          onChange={(e) => setPayrollPeriod(e.target.value)}
                          placeholder="2026-08"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-payroll-annuller" onClick={() => setPayrollPeriodOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-payroll-generer"
                        onClick={() => autoPayrollMut.mutate()}
                        disabled={autoPayrollMut.isPending || !payrollPeriod}
                      >
                        {autoPayrollMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Generer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- ANLÆGSREGISTER ---------- */}
              <TabsContent value="anlaeg" className="space-y-4">
                <SectionCard
                  title="Anlægsregister"
                  icon={<Building className="size-4" />}
                  action={
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="btn-afskrivning"
                        onClick={() => depreciateMut.mutate()}
                        disabled={depreciateMut.isPending}
                      >
                        <RefreshCw className="size-4" />
                        Kør afskrivning
                      </Button>
                      <Button
                        size="sm"
                        data-testid="btn-tilfoej-anlaeg"
                        onClick={() => setAssetDialogOpen(true)}
                      >
                        <Plus className="size-4" />
                        Tilføj anlæg
                      </Button>
                    </div>
                  }
                  noPadding
                >
                  {fixedAssetsQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : fixedAssetsQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente anlæg.</p>
                  ) : fixedAssets.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen anlægsaktiver.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-fixed-assets">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Navn</th>
                            <th className="font-medium px-3 py-1.5">Kategori</th>
                            <th className="font-medium px-3 py-1.5">Købsdato</th>
                            <th className="font-medium px-3 py-1.5 text-right">Købspris</th>
                            <th className="font-medium px-3 py-1.5 text-right">Akk. afskr.</th>
                            <th className="font-medium px-3 py-1.5 text-right">Bogført værdi</th>
                            <th className="font-medium px-3 py-1.5 text-right">Månedlig afskr.</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixedAssets.map((a) => {
                            const status = a.status ?? "";
                            return (
                              <tr key={a.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 font-medium">{a.name ?? "—"}</td>
                                <td className="px-3 py-1.5">{a.category ?? "—"}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{dk(a.purchaseDate)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(a.purchasePrice)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(a.accumulatedDepreciation)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{money(a.bookValue)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(a.monthlyDepreciation)}</td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip status={status} variant={status === "solgt" || status === "sold" ? "gray" : status === "aktiv" ? "green" : "blue"} />
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-saelg-anlaeg-${a.id}`}
                                    onClick={() => sellAssetMut.mutate(a.id)}
                                    disabled={sellAssetMut.isPending || status === "solgt" || status === "sold"}
                                  >
                                    Sælg
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Tilføj anlæg */}
                <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
                  <DialogContent data-testid="dialog-tilfoej-anlaeg">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Tilføj anlæg</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="asset-name">Navn</Label>
                        <Input id="asset-name" data-testid="input-asset-name" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} placeholder="F.eks. Vaskemaskine" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="asset-category">Kategori</Label>
                          <Input id="asset-category" data-testid="input-asset-category" value={assetForm.category} onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))} placeholder="Maskiner / IT / Inventar" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="asset-date">Købsdato</Label>
                          <Input id="asset-date" type="date" data-testid="input-asset-date" value={assetForm.purchaseDate} onChange={(e) => setAssetForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="asset-price">Købspris</Label>
                          <Input id="asset-price" type="number" step="0.01" data-testid="input-asset-price" value={assetForm.purchasePrice} onChange={(e) => setAssetForm((f) => ({ ...f, purchasePrice: e.target.value }))} placeholder="0,00" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="asset-salvage">Restværdi</Label>
                          <Input id="asset-salvage" type="number" step="0.01" data-testid="input-asset-salvage" value={assetForm.salvageValue} onChange={(e) => setAssetForm((f) => ({ ...f, salvageValue: e.target.value }))} placeholder="0,00" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="asset-life">Levetid (måneder)</Label>
                        <Input id="asset-life" type="number" data-testid="input-asset-life" value={assetForm.usefulLife} onChange={(e) => setAssetForm((f) => ({ ...f, usefulLife: e.target.value }))} placeholder="60" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-asset-annuller" onClick={() => setAssetDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-asset-gem"
                        onClick={() => createAssetMut.mutate()}
                        disabled={createAssetMut.isPending || !assetForm.name || !assetForm.purchasePrice}
                      >
                        {createAssetMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Gem anlæg
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- BUDGET & PROGNOSER ---------- */}
              <TabsContent value="budget" className="space-y-4">
                <SectionCard title="Budget & Prognoser" icon={<TrendingUp className="size-4" />}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3" data-testid="budget-summary">
                    <KpiCard label="Total budget" value={money(budgets.reduce((s, b) => s + (b.budgetedAmount ?? 0), 0))} icon={<TrendingUp className="size-4" />} variant="blue" testId="kpi-budget-total" />
                    <KpiCard label="Total faktisk" value={money(budgets.reduce((s, b) => s + (b.actualAmount ?? 0), 0))} icon={<Banknote className="size-4" />} variant="green" testId="kpi-budget-actual" />
                    <KpiCard
                      label="Total afvigelse"
                      value={money(budgets.reduce((s, b) => s + ((b.actualAmount ?? 0) - (b.budgetedAmount ?? 0)), 0))}
                      icon={<AlertTriangle className="size-4" />}
                      variant={budgets.reduce((s, b) => s + ((b.actualAmount ?? 0) - (b.budgetedAmount ?? 0)), 0) >= 0 ? "green" : "red"}
                      testId="kpi-budget-variance"
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Budgetlinjer"
                  icon={<TrendingUp className="size-4" />}
                  action={
                    <Button size="sm" data-testid="btn-tilfoej-budget" onClick={() => setBudgetDialogOpen(true)}>
                      <Plus className="size-4" />
                      Tilføj budgetlinje
                    </Button>
                  }
                  noPadding
                >
                  {budgetsQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : budgetsQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente budget.</p>
                  ) : budgets.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen budgetlinjer.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-budgets">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">År</th>
                            <th className="font-medium px-3 py-1.5">Måned</th>
                            <th className="font-medium px-3 py-1.5">Kategori</th>
                            <th className="font-medium px-3 py-1.5 text-right">Budget</th>
                            <th className="font-medium px-3 py-1.5 text-right">Faktisk</th>
                            <th className="font-medium px-3 py-1.5 text-right">Afvigelse</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgets.map((b) => {
                            const variance = (b.actualAmount ?? 0) - (b.budgetedAmount ?? 0);
                            return (
                              <tr key={b.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 tabular-nums">{b.year ?? "—"}</td>
                                <td className="px-3 py-1.5 tabular-nums">{b.month ?? "—"}</td>
                                <td className="px-3 py-1.5">{b.category ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(b.budgetedAmount)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(b.actualAmount)}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {money(variance)}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-slet-budget-${b.id}`}
                                    onClick={() => deleteBudgetMut.mutate(b.id)}
                                    disabled={deleteBudgetMut.isPending}
                                  >
                                    <Trash2 className="size-3.5" />
                                    Slet
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Tilføj budgetlinje */}
                <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
                  <DialogContent data-testid="dialog-tilfoej-budget">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Tilføj budgetlinje</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="budget-year">År</Label>
                          <Input id="budget-year" type="number" data-testid="input-budget-year" value={budgetForm.year} onChange={(e) => setBudgetForm((f) => ({ ...f, year: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="budget-month">Måned (1-12)</Label>
                          <Input id="budget-month" type="number" data-testid="input-budget-month" value={budgetForm.month} onChange={(e) => setBudgetForm((f) => ({ ...f, month: e.target.value }))} placeholder="8" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="budget-category">Kategori</Label>
                        <Input id="budget-category" data-testid="input-budget-category" value={budgetForm.category} onChange={(e) => setBudgetForm((f) => ({ ...f, category: e.target.value }))} placeholder="Omsætning / Leje / Løn" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="budget-amount">Budgeteret beløb</Label>
                        <Input id="budget-amount" type="number" step="0.01" data-testid="input-budget-amount" value={budgetForm.budgetedAmount} onChange={(e) => setBudgetForm((f) => ({ ...f, budgetedAmount: e.target.value }))} placeholder="0,00" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-budget-annuller" onClick={() => setBudgetDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-budget-gem"
                        onClick={() => createBudgetMut.mutate()}
                        disabled={createBudgetMut.isPending || !budgetForm.category || !budgetForm.budgetedAmount}
                      >
                        {createBudgetMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Gem linje
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- OMKOSTNINGSSTEDER ---------- */}
              <TabsContent value="omkostning" className="space-y-4">
                <SectionCard
                  title="Omkostningssteder"
                  icon={<Briefcase className="size-4" />}
                  action={
                    <Button size="sm" data-testid="btn-tilfoej-omkostning" onClick={() => setCostCenterDialogOpen(true)}>
                      <Plus className="size-4" />
                      Tilføj omkostningssted
                    </Button>
                  }
                  noPadding
                >
                  {costCentersQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : costCentersQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente omkostningssteder.</p>
                  ) : costCenters.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen omkostningssteder.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-cost-centers">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Kode</th>
                            <th className="font-medium px-3 py-1.5">Navn</th>
                            <th className="font-medium px-3 py-1.5">Type</th>
                            <th className="font-medium px-3 py-1.5 text-right">Omsætning</th>
                            <th className="font-medium px-3 py-1.5 text-right">Omkostninger</th>
                            <th className="font-medium px-3 py-1.5 text-right">Resultat</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costCenters.map((c) => {
                            const profit = c.profit ?? ((c.revenue ?? 0) - (c.costs ?? 0));
                            return (
                              <tr key={c.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 font-mono">{c.code ?? "—"}</td>
                                <td className="px-3 py-1.5 font-medium">{c.name ?? "—"}</td>
                                <td className="px-3 py-1.5">{c.type ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(c.revenue)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(c.costs)}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {money(profit)}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-slet-omkostning-${c.id}`}
                                    onClick={() => deleteCostCenterMut.mutate(c.id)}
                                    disabled={deleteCostCenterMut.isPending}
                                  >
                                    <Trash2 className="size-3.5" />
                                    Slet
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Tilføj omkostningssted */}
                <Dialog open={costCenterDialogOpen} onOpenChange={setCostCenterDialogOpen}>
                  <DialogContent data-testid="dialog-tilfoej-omkostning">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Tilføj omkostningssted</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="cc-code">Kode</Label>
                        <Input id="cc-code" data-testid="input-cc-code" value={costCenterForm.code} onChange={(e) => setCostCenterForm((f) => ({ ...f, code: e.target.value }))} placeholder="A001" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cc-name">Navn</Label>
                        <Input id="cc-name" data-testid="input-cc-name" value={costCenterForm.name} onChange={(e) => setCostCenterForm((f) => ({ ...f, name: e.target.value }))} placeholder="Afdeling Nord" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cc-type">Type</Label>
                        <Select value={costCenterForm.type} onValueChange={(val) => setCostCenterForm((f) => ({ ...f, type: val }))}>
                          <SelectTrigger data-testid="select-cc-type">
                            <SelectValue placeholder="Vælg type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="afdeling" data-testid="opt-cc-afdeling">Afdeling</SelectItem>
                            <SelectItem value="projekt" data-testid="opt-cc-projekt">Projekt</SelectItem>
                            <SelectItem value="lokation" data-testid="opt-cc-lokation">Lokation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-cc-annuller" onClick={() => setCostCenterDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-cc-gem"
                        onClick={() => createCostCenterMut.mutate()}
                        disabled={createCostCenterMut.isPending || !costCenterForm.code || !costCenterForm.name}
                      >
                        {createCostCenterMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Gem
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- BETALINGSKØRSLER ---------- */}
              <TabsContent value="betaling" className="space-y-4">
                <SectionCard
                  title="Betalingskørsler"
                  icon={<CreditCard className="size-4" />}
                  action={
                    <Button
                      size="sm"
                      data-testid="btn-opret-betalingskoersel"
                      onClick={() => createPaymentRunMut.mutate()}
                      disabled={createPaymentRunMut.isPending}
                    >
                      {createPaymentRunMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Opret betalingskørsel
                    </Button>
                  }
                  noPadding
                >
                  {paymentRunsQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : paymentRunsQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente betalingskørsler.</p>
                  ) : paymentRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen betalingskørsler.</p>
                  ) : (
                    <div className="divide-y divide-border" data-testid="list-payment-runs">
                      {paymentRuns.map((run) => {
                        const open = expandedPaymentRun === run.id;
                        let items: unknown[] = [];
                        try {
                          items = run.items ? JSON.parse(run.items) : [];
                        } catch {
                          items = [];
                        }
                        const status = run.status ?? "";
                        return (
                          <div key={run.id} data-testid={`payment-run-${run.id}`}>
                            <div className="flex items-center justify-between px-3 py-2 gap-2">
                              <button
                                type="button"
                                className="flex items-center gap-2 text-left min-w-0 flex-1"
                                data-testid={`btn-expand-payment-run-${run.id}`}
                                onClick={() => setExpandedPaymentRun(open ? null : run.id)}
                              >
                                {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                <span className="text-xs font-medium whitespace-nowrap">{dk(run.runDate)}</span>
                                <span className="text-xs text-muted-foreground">{(run.paymentCount ?? 0)} betalinger</span>
                                <span className="text-xs font-medium tabular-nums">{money(run.totalAmount)}</span>
                              </button>
                              <div className="flex items-center gap-2">
                                {status && (
                                  <StatusChip status={status} variant={status === "godkendt" || status === "approved" ? "green" : "amber"} />
                                )}
                                {(status === "kladde" || status === "draft" || !status) && (
                                  <Button
                                    size="sm"
                                    data-testid={`btn-godkend-betaling-${run.id}`}
                                    onClick={() => approvePaymentRunMut.mutate(run.id)}
                                    disabled={approvePaymentRunMut.isPending}
                                  >
                                    <Check className="size-3.5" />
                                    Godkend
                                  </Button>
                                )}
                              </div>
                            </div>
                            {open && (
                              <div className="px-3 pb-2">
                                {Array.isArray(items) && items.length > 0 ? (
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {items.map((it, i) => (
                                        <tr key={i} className="border-b border-border/40 last:border-0">
                                          <td className="py-1" colSpan={2}>
                                            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words">{JSON.stringify(it, null, 2)}</pre>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground">Ingen linjer på kørslen.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- ÅRSAFSLUTNING ---------- */}
              <TabsContent value="aarafslutning" className="space-y-4">
                <SectionCard
                  title="Årsafslutning"
                  icon={<Calendar className="size-4" />}
                  action={
                    <Button size="sm" data-testid="btn-opret-aarsafslutning" onClick={() => setYearEndDialogOpen(true)}>
                      <Plus className="size-4" />
                      Opret årsafslutning
                    </Button>
                  }
                >
                  {/* BETA disclaimer */}
                  <div
                    data-testid="aarsafslutning-disclaimer"
                    className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-2.5 mb-3"
                  >
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>Årsafslutning er BETA.</strong> Kræver revisor/juridisk godkendelse.
                    </p>
                  </div>

                  {yearEndClosesQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : yearEndClosesQuery.isError ? (
                    <p className="text-xs text-destructive">Kunne ikke hente årsafslutninger.</p>
                  ) : yearEndCloses.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Ingen årsafslutninger.</p>
                  ) : (
                    <div className="space-y-3" data-testid="list-year-end-closes">
                      {yearEndCloses.map((yc) => {
                        const checklist = mergeYearEndChecklist(yc.checklist);
                        const status = yc.status ?? "";
                        return (
                          <div key={yc.id} data-testid={`year-end-${yc.id}`} className="rounded-md border border-border bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="size-4 text-muted-foreground" />
                                <p className="text-sm font-semibold">{yc.year ?? "—"}</p>
                                {status && (
                                  <StatusChip status={status} variant={status === "afsluttet" || status === "closed" ? "green" : "amber"} />
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`btn-afslut-aar-${yc.id}`}
                                onClick={() => closeYearMut.mutate(yc.id)}
                                disabled={closeYearMut.isPending || status === "afsluttet" || status === "closed"}
                              >
                                Afslut år
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Årets resultat</p>
                                <p className="font-medium tabular-nums">{money(yc.result)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Skatteresultat</p>
                                <p className="font-medium tabular-nums">{money(yc.taxResult)}</p>
                              </div>
                            </div>
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tjekliste</p>
                              {checklist.map((item, idx) => (
                                <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <Checkbox
                                    data-testid={`chk-yearend-${yc.id}-${idx}`}
                                    checked={item.done}
                                    onCheckedChange={(val) => {
                                      const next = checklist.map((c, i) => (i === idx ? { ...c, done: !!val } : c));
                                      toggleYearEndChecklistMut.mutate({ id: yc.id, checklist: next });
                                    }}
                                  />
                                  <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.task}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Opret årsafslutning */}
                <Dialog open={yearEndDialogOpen} onOpenChange={setYearEndDialogOpen}>
                  <DialogContent data-testid="dialog-opret-aarsafslutning">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Opret årsafslutning</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="ye-year">År</Label>
                        <Input id="ye-year" type="number" data-testid="input-ye-year" value={yearEndForm.year} onChange={(e) => setYearEndForm({ year: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-ye-annuller" onClick={() => setYearEndDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-ye-gem"
                        onClick={() => createYearEndMut.mutate()}
                        disabled={createYearEndMut.isPending || !yearEndForm.year}
                      >
                        {createYearEndMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Opret
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- REVISIONSSPOR ---------- */}
              <TabsContent value="revision" className="space-y-4">
                <SectionCard
                  title="Revisionsspor"
                  icon={<ShieldCheck className="size-4" />}
                  action={
                    <div className="flex items-center gap-2">
                      <Select value={auditModuleFilter} onValueChange={setAuditModuleFilter}>
                        <SelectTrigger className="w-[140px]" data-testid="select-audit-module">
                          <SelectValue placeholder="Modul" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alle" data-testid="opt-audit-module-alle">Alle moduler</SelectItem>
                          <SelectItem value="bilag" data-testid="opt-audit-module-bilag">Bilag</SelectItem>
                          <SelectItem value="moms" data-testid="opt-audit-module-moms">Moms</SelectItem>
                          <SelectItem value="bank" data-testid="opt-audit-module-bank">Bank</SelectItem>
                          <SelectItem value="lon" data-testid="opt-audit-module-lon">Løn</SelectItem>
                          <SelectItem value="anlaeg" data-testid="opt-audit-module-anlaeg">Anlæg</SelectItem>
                          <SelectItem value="periode" data-testid="opt-audit-module-periode">Periode</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                        <SelectTrigger className="w-[140px]" data-testid="select-audit-action">
                          <SelectValue placeholder="Handling" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alle" data-testid="opt-audit-action-alle">Alle handlinger</SelectItem>
                          <SelectItem value="opret" data-testid="opt-audit-action-opret">Opret</SelectItem>
                          <SelectItem value="opdater" data-testid="opt-audit-action-opdater">Opdater</SelectItem>
                          <SelectItem value="slet" data-testid="opt-audit-action-slet">Slet</SelectItem>
                          <SelectItem value="bogfoer" data-testid="opt-audit-action-bogfoer">Bogfør</SelectItem>
                          <SelectItem value="godkend" data-testid="opt-audit-action-godkend">Godkend</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  }
                  noPadding
                >
                  <p className="text-xs text-muted-foreground p-3" data-testid="audit-info">
                    Alle ændringer logges automatisk.
                  </p>
                  {auditLogQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : auditLogQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente revisionsspor.</p>
                  ) : auditLog.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen logposter.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-audit-log">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Tidspunkt</th>
                            <th className="font-medium px-3 py-1.5">Bruger</th>
                            <th className="font-medium px-3 py-1.5">Handling</th>
                            <th className="font-medium px-3 py-1.5">Modul</th>
                            <th className="font-medium px-3 py-1.5">Entitet</th>
                            <th className="font-medium px-3 py-1.5">Gammel → Ny værdi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLog.map((e) => (
                            <tr key={e.id} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{dk(e.createdAt)}</td>
                              <td className="px-3 py-1.5">{e.userName ?? "—"}</td>
                              <td className="px-3 py-1.5">{e.action ?? "—"}</td>
                              <td className="px-3 py-1.5">{e.module ?? "—"}</td>
                              <td className="px-3 py-1.5">{e.entityDescription ?? "—"}</td>
                              <td className="px-3 py-1.5">
                                <span className="text-muted-foreground">{e.oldValue ?? "—"}</span>
                                <span className="mx-1">→</span>
                                <span className="font-medium">{e.newValue ?? "—"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- MOMS-AFSTEMNING ---------- */}
              <TabsContent value="momsafstemning" className="space-y-4">
                <SectionCard
                  title="Moms-afstemning"
                  icon={<Calculator className="size-4" />}
                  action={
                    <Button size="sm" data-testid="btn-opret-momsafstemning" onClick={() => setVatReconDialogOpen(true)}>
                      <Plus className="size-4" />
                      Opret momsafstemning
                    </Button>
                  }
                  noPadding
                >
                  {vatReconciliationsQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : vatReconciliationsQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente momsafstemninger.</p>
                  ) : vatReconciliations.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen momsafstemninger.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-vat-reconciliations">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Periode</th>
                            <th className="font-medium px-3 py-1.5 text-right">Udgående moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Indgående moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Netto moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Skattekonto</th>
                            <th className="font-medium px-3 py-1.5 text-right">Difference</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vatReconciliations.map((r) => {
                            const diff = r.difference ?? 0;
                            const status = r.status ?? "";
                            return (
                              <tr key={r.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 whitespace-nowrap">{r.period ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.outputVat)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.inputVat)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{money(r.netVat)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.skatAccount)}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${diff === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {money(diff)}
                                </td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip status={status} variant={status === "afstemt" || status === "reconciled" ? "green" : "amber"} />
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-afstem-moms-${r.id}`}
                                    onClick={() => updateVatReconMut.mutate({ id: r.id, status: "afstemt" })}
                                    disabled={updateVatReconMut.isPending || status === "afstemt" || status === "reconciled"}
                                  >
                                    <Check className="size-3.5" />
                                    Afstem
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Opret momsafstemning */}
                <Dialog open={vatReconDialogOpen} onOpenChange={setVatReconDialogOpen}>
                  <DialogContent data-testid="dialog-opret-momsafstemning">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Opret momsafstemning</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="vat-period">Periode (f.eks. 2026-08)</Label>
                        <Input id="vat-period" data-testid="input-vat-period" value={vatReconForm.period} onChange={(e) => setVatReconForm({ period: e.target.value })} placeholder="2026-08" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Momsbeløbene beregnes automatisk for perioden.</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-vat-annuller" onClick={() => setVatReconDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-vat-gem"
                        onClick={() => createVatReconMut.mutate()}
                        disabled={createVatReconMut.isPending || !vatReconForm.period}
                      >
                        {createVatReconMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Opret
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- LIKVIDITET & CASHFLOW ---------- */}
              <TabsContent value="cashflow" className="space-y-4">
                <SectionCard title="Likviditet & Cashflow" icon={<Wallet className="size-4" />}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="cashflow-summary">
                    <KpiCard
                      label="Forventet cashflow"
                      value={money(cashflowProjections.reduce((s, c) => s + (c.expectedAmount ?? 0), 0))}
                      icon={<Wallet className="size-4" />}
                      variant={cashflowProjections.reduce((s, c) => s + (c.expectedAmount ?? 0), 0) >= 0 ? "green" : "red"}
                      testId="kpi-cashflow-expected"
                    />
                    <KpiCard
                      label="Faktisk cashflow"
                      value={money(cashflowProjections.reduce((s, c) => s + (c.actualAmount ?? 0), 0))}
                      icon={<Banknote className="size-4" />}
                      variant="blue"
                      testId="kpi-cashflow-actual"
                    />
                    <KpiCard
                      label="Antal poster"
                      value={num(cashflowProjections.length)}
                      icon={<Clock className="size-4" />}
                      variant="gray"
                      testId="kpi-cashflow-count"
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Cashflow-projektioner"
                  icon={<Wallet className="size-4" />}
                  action={
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="btn-auto-cashflow"
                        onClick={() => autoCashflowMut.mutate()}
                        disabled={autoCashflowMut.isPending}
                      >
                        {autoCashflowMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                        Auto-generer projektioner
                      </Button>
                      <Button size="sm" data-testid="btn-tilfoej-cashflow" onClick={() => setCashflowDialogOpen(true)}>
                        <Plus className="size-4" />
                        Tilføj post
                      </Button>
                    </div>
                  }
                  noPadding
                >
                  {cashflowQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : cashflowQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente cashflow.</p>
                  ) : cashflowProjections.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen cashflow-projektioner.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-cashflow">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Dato</th>
                            <th className="font-medium px-3 py-1.5">Type</th>
                            <th className="font-medium px-3 py-1.5">Beskrivelse</th>
                            <th className="font-medium px-3 py-1.5 text-right">Forventet</th>
                            <th className="font-medium px-3 py-1.5 text-right">Faktisk</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                            <th className="font-medium px-3 py-1.5 text-right">Handlinger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashflowProjections.map((c) => {
                            const amt = c.expectedAmount ?? 0;
                            return (
                              <tr key={c.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 whitespace-nowrap">{dk(c.date)}</td>
                                <td className="px-3 py-1.5">{c.type ?? "—"}</td>
                                <td className="px-3 py-1.5">{c.description ?? "—"}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${amt >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {money(amt)}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(c.actualAmount)}</td>
                                <td className="px-3 py-1.5">
                                  {c.status && (
                                    <StatusChip status={c.status} variant={c.status === "afstemt" || c.status === "reconciled" ? "green" : "amber"} />
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`btn-slet-cashflow-${c.id}`}
                                    onClick={() => deleteCashflowMut.mutate(c.id)}
                                    disabled={deleteCashflowMut.isPending}
                                  >
                                    <Trash2 className="size-3.5" />
                                    Slet
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Dialog: Tilføj cashflow-post */}
                <Dialog open={cashflowDialogOpen} onOpenChange={setCashflowDialogOpen}>
                  <DialogContent data-testid="dialog-tilfoej-cashflow">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Tilføj cashflow-post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="cf-date">Dato</Label>
                        <Input id="cf-date" type="date" data-testid="input-cf-date" value={cashflowForm.date} onChange={(e) => setCashflowForm((f) => ({ ...f, date: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="cf-type">Type</Label>
                          <Select value={cashflowForm.type} onValueChange={(val) => setCashflowForm((f) => ({ ...f, type: val }))}>
                            <SelectTrigger data-testid="select-cf-type">
                              <SelectValue placeholder="Vælg type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="indbetalning" data-testid="opt-cf-indbetalning">Indbetaling</SelectItem>
                              <SelectItem value="udbetaling" data-testid="opt-cf-udbetaling">Udbetaling</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cf-amount">Forventet beløb</Label>
                          <Input id="cf-amount" type="number" step="0.01" data-testid="input-cf-amount" value={cashflowForm.expectedAmount} onChange={(e) => setCashflowForm((f) => ({ ...f, expectedAmount: e.target.value }))} placeholder="0,00" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cf-desc">Beskrivelse</Label>
                        <Input id="cf-desc" data-testid="input-cf-desc" value={cashflowForm.description} onChange={(e) => setCashflowForm((f) => ({ ...f, description: e.target.value }))} placeholder="F.eks. Kundebetaling" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" data-testid="btn-cf-annuller" onClick={() => setCashflowDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button
                        data-testid="btn-cf-gem"
                        onClick={() => createCashflowMut.mutate()}
                        disabled={createCashflowMut.isPending || !cashflowForm.date || !cashflowForm.expectedAmount}
                      >
                        {createCashflowMut.isPending && <Loader2 className="size-4 animate-spin" />}
                        Gem post
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---------- AI REGNSKABSCHEF ---------- */}
              <TabsContent value="ai_chef" className="space-y-4">
                <SectionCard
                  title="AI Regnskabschef (beta)"
                  icon={<BrainCircuit className="size-4" />}
                  action={
                    <Button
                      data-testid="btn-chef-run"
                      onClick={() => chefRunMut.mutate()}
                      disabled={chefRunMut.isPending}
                    >
                      {chefRunMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
                      Kør fuld gennemgang
                    </Button>
                  }
                >
                  {/* BETA disclaimer */}
                  <div
                    data-testid="chef-disclaimer"
                    className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-2.5 mb-3"
                  >
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>AI Regnskabschef (beta).</strong> Kræver revisor/juridisk godkendelse.
                      AI Regnskabschef gennemgår automatisk: bilag, løn, anlæg, budget, likviditet, fakturaer, moms, og mere — alt lander i godkendelseskø.
                    </p>
                  </div>

                  {chefTasksQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : chefTasksQuery.isError ? (
                    <p className="text-xs text-muted-foreground">Kunne ikke hente opgaver.</p>
                  ) : chefTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Ingen opgaver. Klik "Kør fuld gennemgang" for at starte.
                    </p>
                  ) : (
                    (() => {
                      const groups: { key: string; label: string }[] = [
                        { key: "bilag", label: "Bilag" },
                        { key: "lon", label: "Løn" },
                        { key: "afskrivning", label: "Afskrivning" },
                        { key: "budget", label: "Budget" },
                        { key: "likviditet", label: "Likviditet" },
                        { key: "bogføring", label: "Bogføring" },
                        { key: "debitor", label: "Debitor" },
                      ];
                      const grouped = groups.map((g) => ({
                        ...g,
                        tasks: chefTasks.filter((t) => (t.type as string) === g.key),
                      }));
                      const others = chefTasks.filter(
                        (t) => !groups.some((g) => g.key === (t.type as string)),
                      );
                      return (
                        <div className="space-y-4" data-testid="list-chef-tasks">
                          {grouped.map((g) =>
                            g.tasks.length === 0 ? null : (
                              <div key={g.key} data-testid={`chef-group-${g.key}`}>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                  {g.label}
                                </p>
                                <ul className="space-y-2">
                                  {g.tasks.map((task) => {
                                    const decided = task.status === "godkendt" || task.status === "afvist";
                                    return (
                                      <li key={task.id} data-testid={`chef-task-${task.id}`} className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="text-xs font-medium truncate">{task.title}</p>
                                            {task.description && (
                                              <p className="text-[11px] text-muted-foreground mt-1">{task.description}</p>
                                            )}
                                            {task.suggestion && (
                                              <p className="text-[11px] mt-1 rounded bg-muted/50 px-2 py-1">
                                                <span className="font-medium">Forslag:</span> {task.suggestion}
                                              </p>
                                            )}
                                          </div>
                                          {task.status && decided && (
                                            <StatusChip status={task.status} variant={task.status === "godkendt" ? "green" : "red"} />
                                          )}
                                        </div>
                                        {!decided && (
                                          <div className="flex items-center gap-2 pt-1">
                                            <Button
                                              data-testid={`btn-chef-godkend-${task.id}`}
                                              size="sm"
                                              variant="default"
                                              onClick={() => decideChefTaskMut.mutate({ taskId: task.id, decision: "godkend" })}
                                              disabled={decideChefTaskMut.isPending}
                                            >
                                              <Check className="size-3.5" />
                                              Godkend
                                            </Button>
                                            <Button
                                              data-testid={`btn-chef-afvis-${task.id}`}
                                              size="sm"
                                              variant="outline"
                                              onClick={() => decideChefTaskMut.mutate({ taskId: task.id, decision: "afvis" })}
                                              disabled={decideChefTaskMut.isPending}
                                            >
                                              <X className="size-3.5" />
                                              Afvis
                                            </Button>
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ),
                          )}
                          {others.length > 0 && (
                            <div data-testid="chef-group-andre">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Andre</p>
                              <ul className="space-y-2">
                                {others.map((task) => {
                                  const decided = task.status === "godkendt" || task.status === "afvist";
                                  return (
                                    <li key={task.id} data-testid={`chef-task-${task.id}`} className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium truncate">{task.title}</p>
                                          {task.description && (
                                            <p className="text-[11px] text-muted-foreground mt-1">{task.description}</p>
                                          )}
                                        </div>
                                        {task.status && decided && (
                                          <StatusChip status={task.status} variant={task.status === "godkendt" ? "green" : "red"} />
                                        )}
                                      </div>
                                      {!decided && (
                                        <div className="flex items-center gap-2 pt-1">
                                          <Button
                                            data-testid={`btn-chef-godkend-${task.id}`}
                                            size="sm"
                                            variant="default"
                                            onClick={() => decideChefTaskMut.mutate({ taskId: task.id, decision: "godkend" })}
                                            disabled={decideChefTaskMut.isPending}
                                          >
                                            <Check className="size-3.5" />
                                            Godkend
                                          </Button>
                                          <Button
                                            data-testid={`btn-chef-afvis-${task.id}`}
                                            size="sm"
                                            variant="outline"
                                            onClick={() => decideChefTaskMut.mutate({ taskId: task.id, decision: "afvis" })}
                                            disabled={decideChefTaskMut.isPending}
                                          >
                                            <X className="size-3.5" />
                                            Afvis
                                          </Button>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </SectionCard>
              </TabsContent>

              {/* ---------- SKATTEKONTO ---------- */}
              <TabsContent value="skattekonto" className="space-y-4">
                <SectionCard title="Skattekonto" icon={<Landmark className="size-4" />}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2" data-testid="skattekonto-summary">
                    <KpiCard
                      label="Total udgående moms"
                      value={money(vatReconciliations.reduce((s, r) => s + (r.outputVat ?? 0), 0))}
                      icon={<TrendingUp className="size-4" />}
                      variant="amber"
                      testId="kpi-skat-output"
                    />
                    <KpiCard
                      label="Total indgående moms"
                      value={money(vatReconciliations.reduce((s, r) => s + (r.inputVat ?? 0), 0))}
                      icon={<TrendingDown className="size-4" />}
                      variant="blue"
                      testId="kpi-skat-input"
                    />
                    <KpiCard
                      label="Netto moms at betale"
                      value={money(vatReconciliations.reduce((s, r) => s + (r.netVat ?? 0), 0))}
                      icon={<Landmark className="size-4" />}
                      variant={vatReconciliations.reduce((s, r) => s + (r.netVat ?? 0), 0) >= 0 ? "red" : "green"}
                      testId="kpi-skat-net"
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Skatteafstemninger"
                  icon={<Landmark className="size-4" />}
                  action={
                    <Button size="sm" data-testid="btn-opret-skatteafstemning" onClick={() => setVatReconDialogOpen(true)}>
                      <Plus className="size-4" />
                      Opret skatteafstemning
                    </Button>
                  }
                  noPadding
                >
                  {vatReconciliationsQuery.isLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : vatReconciliationsQuery.isError ? (
                    <p className="text-xs text-destructive p-3">Kunne ikke hente skatteafstemninger.</p>
                  ) : vatReconciliations.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Ingen skatteafstemninger.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="table-skattekonto">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="font-medium px-3 py-1.5">Periode</th>
                            <th className="font-medium px-3 py-1.5 text-right">Udgående moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Indgående moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Netto moms</th>
                            <th className="font-medium px-3 py-1.5 text-right">Skattekonto</th>
                            <th className="font-medium px-3 py-1.5 text-right">Difference</th>
                            <th className="font-medium px-3 py-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vatReconciliations.map((r) => {
                            const diff = r.difference ?? 0;
                            const status = r.status ?? "";
                            return (
                              <tr key={r.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-1.5 whitespace-nowrap">{r.period ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.outputVat)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.inputVat)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{money(r.netVat)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.skatAccount)}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${diff === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {money(diff)}
                                </td>
                                <td className="px-3 py-1.5">
                                  {status && (
                                    <StatusChip status={status} variant={status === "afstemt" || status === "reconciled" ? "green" : "amber"} />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ── Nye SmartRegnskab tabs ── */}
              <TabsContent value="fagportal" className="space-y-4">
                <Fagportal />
              </TabsContent>
              <TabsContent value="bank_integrationer" className="space-y-4">
                <BankIntegrationer companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="arkivering" className="space-y-4">
                <Arkivering companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="lonindberetning" className="space-y-4">
                <Lonindberetning companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="arsrapport" className="space-y-4">
                <Arsrapport companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="debitorstyring" className="space-y-4">
                <Debitorstyring companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="periodisering" className="space-y-4">
                <Periodisering companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="lagerregnskab" className="space-y-4">
                <Lagerregnskab companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="valuta_moms" className="space-y-4">
                <ValutaMoms companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="revisorportal" className="space-y-4">
                <Revisorportal companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="roller_kontrol" className="space-y-4">
                <RollerKontrol companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="importguide" className="space-y-4">
                <Importguide companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="api_webhooks" className="space-y-4">
                <ApiWebhooks companyId={effectiveCompanyId} />
              </TabsContent>

              {/* ── Ruge 2 SmartRegnskab tabs ── */}
              <TabsContent value="integration_configs" className="space-y-4">
                <IntegrationConfigs companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="compliance_checks" className="space-y-4">
                <ComplianceChecks companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="bank_payments" className="space-y-4">
                <BankPayments companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="einvoice_queue" className="space-y-4">
                <EinvoiceQueue companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="api_keys_mgmt" className="space-y-4">
                <ApiKeysMgmt companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="migration_wizard" className="space-y-4">
                <MigrationWizard companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="konsolidering" className="space-y-4">
                <Konsolidering companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="avanceret_moms" className="space-y-4">
                <AvanceretMoms companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="lonmotor_regnskab" className="space-y-4">
                <LonmotorRegnskab companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="revisionspakke" className="space-y-4">
                <Revisionspakke companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="budget_scenarier" className="space-y-4">
                <BudgetScenarier companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="afstemningscenter" className="space-y-4">
                <Afstemningscenter companyId={effectiveCompanyId} />
              </TabsContent>

              {/* ── Ruge 3 SmartRegnskab tabs ── */}
              <TabsContent value="branche_profil" className="space-y-4">
                <BrancheProfil companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="kontoplan_skabeloner" className="space-y-4">
                <KontoplanSkabeloner companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="dimensioner" className="space-y-4">
                <Dimensioner companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="regnskabskategorier" className="space-y-4">
                <Regnskabskategorier companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="saft" className="space-y-4">
                <Saft />
              </TabsContent>
              <TabsContent value="workflow_builder" className="space-y-4">
                <WorkflowBuilder companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="integration_runs" className="space-y-4">
                <IntegrationRuns companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="retry_queue" className="space-y-4">
                <RetryQueue companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="filhaandtering" className="space-y-4">
                <Filhaandtering companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="filversioner" className="space-y-4">
                <Filversioner companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="compliance_dokumenter" className="space-y-4">
                <ComplianceDokumenter companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="kontroltests" className="space-y-4">
                <Kontroltests companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="sikkerhedsaudit" className="space-y-4">
                <Sikkerhedsaudit companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="systemovervaagning" className="space-y-4">
                <Systemovervaagning companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="leveringslog" className="space-y-4">
                <Leveringslog companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="rbac_rettigheder" className="space-y-4">
                <RbacRettigheder companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="kunde_portal_indstillinger" className="space-y-4">
                <KundePortalIndstillinger companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="portal_dokumenter" className="space-y-4">
                <PortalDokumenter companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="backup_regnskab" className="space-y-4">
                <BackupRegnskab companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="fakturering" className="space-y-4">
                <Fakturering companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="kundekartotek" className="space-y-4">
                <Kundekartotek companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="leverandoerkartotek" className="space-y-4">
                <Leverandoerkartotek companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="produktkartotek" className="space-y-4">
                <Produktkartotek companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="faste_fakturaer" className="space-y-4">
                <FasteFakturaer companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="kontrolcenter" className="space-y-4">
                <Kontrolcenter companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="ai_styring" className="space-y-4">
                <AiStyring companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="abonnement" className="space-y-4">
                <Abonnement />
              </TabsContent>
              <TabsContent value="selskabsstruktur" className="space-y-4">
                <Selskabsstruktur />
              </TabsContent>

            </Tabs>
          )}
        </div>

      {user && (
        <p className="text-[11px] text-muted-foreground">
          Logget ind som {user.name} ({user.email}).
          {isPlatformAdmin ? " Platform-admin." : ""}
        </p>
      )}
    </div>
  );
}

/* ---------- underkomponenter ---------- */

function KpiCard({
  label,
  value,
  icon,
  variant,
  testId,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "blue" | "amber" | "green" | "red" | "gray";
  testId: string;
}) {
  const dot: Record<string, string> = {
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
    gray: "bg-gray-400",
  };
  return (
    <div
      data-testid={testId}
      className="rounded-md border border-border bg-card px-3 py-2.5"
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot[variant]}`} />
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
          {label}
        </p>
      </div>
      <p className="text-lg font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function ReportView({ data, testId }: { data: ReportData; testId: string }) {
  const sections =
    data.sections && data.sections.length > 0
      ? data.sections
      : data.lines
        ? [{ title: data.type ?? "Rapport", lines: data.lines, total: undefined }]
        : [];

  return (
    <div data-testid={testId} className="divide-y divide-border">
      {(data.companyName || data.period) && (
        <div className="px-3 py-2 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold">{data.companyName ?? "Virksomhed"}</p>
          {data.period && (
            <p className="text-xs text-muted-foreground">Periode: {data.period}</p>
          )}
        </div>
      )}
      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-3">
          Rapporten indeholder ingen data.
        </p>
      ) : (
        sections.map((sec, i) => (
          <div key={i} className="px-3 py-2">
            {sec.title && (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {sec.title}
              </p>
            )}
            <table className="w-full text-xs">
              <tbody>
                {(sec.lines ?? []).map((line, j) => (
                  <tr key={j} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5">{line.label ?? "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(line.amount)}</td>
                  </tr>
                ))}
                {sec.total != null && (
                  <tr className="font-semibold">
                    <td className="py-1.5">I alt</td>
                    <td className="py-1.5 text-right tabular-nums">{money(sec.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------- hjælpere: CSV-parsing ---------- */

function parseBankCsv(
  text: string,
): { date: string; description: string; amount: number; balance: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Spring overskriftslinje over hvis den ikke kan parses som dato/beløb
  const firstCols = lines[0].split(";");
  const looksLikeHeader =
    /dato|date|tekst|beskrivelse|beløb|amount|saldo|balance/i.test(firstCols.join(" "));
  const rows = looksLikeHeader ? lines.slice(1) : lines;

  const toNum = (s: string | undefined): number => {
    if (!s) return 0;
    const normalized = s.replace(/\./g, "").replace(",", ".").replace(/[^0-9\-]/g, "");
    return Number(normalized) || 0;
  };

  return rows.map((line) => {
    const cols = line.split(";");
    return {
      date: (cols[0] ?? "").trim(),
      description: (cols[1] ?? "").trim(),
      amount: toNum(cols[2]),
      balance: toNum(cols[3]),
    };
  });
}

const PLAN_FEATURES = [
  ["regnskab", "Bogføring og kontoplan"],
  ["kontoplan", "Dansk standardkontoplan"],
  ["bilag", "Bilag og udgifter"],
  ["fakturering", "Fakturering og kreditnotaer"],
  ["moms", "Moms og skat"],
  ["rapporter", "Resultat, balance og rapporter"],
  ["bank_csv", "Bankimport via CSV"],
  ["revisoradgang", "Bogholder- og revisoradgang"],
  ["bank", "Automatisk bankintegration"],
  ["ai_bogforing", "AI-bogføringsforslag"],
  ["automation", "Automatisering og regler"],
  ["faste_fakturaer", "Faste fakturaer"],
  ["debitorstyring", "Rykkerflow og debitorstyring"],
  ["budget", "Budget og prognoser"],
  ["cashflow", "Likviditet og cashflow"],
  ["nemhandel", "OIOUBL og NemHandel"],
  ["betalinger", "Betalingskørsler"],
  ["loen", "Lønbogføring"],
  ["revision", "Revisionsspor og kontrol"],
  ["periodeafslutning", "Periode- og årsafslutning"],
  ["aarsrapport", "Årsrapport"],
  ["saft", "SAF-T eksport"],
  ["api_integration", "API og integrationer"],
  ["backup", "Krypteret ekstern backup"],
  ["gdpr_vaerktoejer", "GDPR-værktøjer"],
  ["dimensioner", "Dimensioner og omkostningssteder"],
  ["konsolidering", "Koncern og konsolidering"],
  ["workflow_builder", "Workflow Builder"],
  ["dedikeret_onboarding", "Dedikeret onboarding"],
  ["support_sla", "Prioriteret support og SLA"],
] as const;

const PLAN_FEATURE_LABELS = Object.fromEntries(PLAN_FEATURES);

function parsePlanFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((feature): feature is string => typeof feature === "string");
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((feature): feature is string => typeof feature === "string") : [];
  } catch {
    return [];
  }
}

function PlatformRegnskabssystemPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(getTabFromHash());
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [selectedSupportCase, setSelectedSupportCase] = useState<any | null>(null);
  const [supportReply, setSupportReply] = useState("");
  const [companyForm, setCompanyForm] = useState({
    name: "", cvr: "", email: "", address: "", phone: "",
    adminName: "", adminEmail: "", adminPassword: "", planId: "", billingCycle: "maanedlig", trialDays: "14",
  });
  const [planForm, setPlanForm] = useState({
    name: "", slug: "", description: "", monthlyPrice: "", pricePerEmployee: "",
    maxDocuments: "", maxEntries: "", maxCompanies: "", maxIntegrations: "",
    includedCompanies: "1", additionalCompanyPrice: "0", includedAiCredits: "0",
    aiAddonPrice: "0", aiAddonCredits: "0", aiCreditsPerAdditionalCompany: "0",
    aiCostCap: "0", aiCostCapPerAdditionalCompany: "0",
    features: [] as string[], sortOrder: "1", active: true,
  });
  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const statsQuery = useQuery<PlatformStats>({
    queryKey: ["/api/platform/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/stats")).json(),
  });
  const companiesQuery = useQuery<PlatformCompanySummary[]>({
    queryKey: ["/api/platform/companies"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/companies")).json(),
  });
  const plansQuery = useQuery<any[]>({ queryKey: ["/api/platform/plans"], enabled: activeTab === "pakker" || activeTab === "virksomheder", queryFn: async () => (await apiRequest("GET", "/api/platform/plans")).json() });
  const paymentsQuery = useQuery<any>({ queryKey: ["/api/platform/payments"], enabled: activeTab === "betalinger", queryFn: async () => (await apiRequest("GET", "/api/platform/payments")).json() });
  const platformInvoicesQuery = useQuery<any[]>({ queryKey: ["/api/platform/invoices"], enabled: activeTab === "betalinger", queryFn: async () => (await apiRequest("GET", "/api/platform/invoices")).json() });
  const backupsQuery = useQuery<any[]>({ queryKey: ["/api/platform/backups"], enabled: activeTab === "backup_platform", queryFn: async () => (await apiRequest("GET", "/api/platform/backups")).json() });
  const operationsQuery = useQuery<any>({ queryKey: ["/api/operations/status"], enabled: activeTab === "platform_drift" || activeTab === "backup_platform", queryFn: async () => (await apiRequest("GET", "/api/operations/status")).json() });
  const supportQuery = useQuery<any[]>({ queryKey: ["/api/support-cases"], enabled: activeTab === "platform_support", queryFn: async () => (await apiRequest("GET", "/api/support-cases")).json() });
  const jobsQuery = useQuery<any>({ queryKey: ["/api/platform/jobs"], enabled: activeTab === "platform_drift", queryFn: async () => (await apiRequest("GET", "/api/platform/jobs")).json() });
  const professionalsQuery = useQuery<any[]>({ queryKey: ["/api/platform/professionals"], enabled: activeTab === "fagbrugere", queryFn: async () => (await apiRequest("GET", "/api/platform/professionals")).json() });
  const gdprQuery = useQuery<any>({ queryKey: ["/api/platform/gdpr"], enabled: activeTab === "adgangspolitik", queryFn: async () => (await apiRequest("GET", "/api/platform/gdpr")).json() });
  const platformAuditQuery = useQuery<any[]>({ queryKey: ["/api/platform/audit-logs"], enabled: activeTab === "adgangspolitik", queryFn: async () => (await apiRequest("GET", "/api/platform/audit-logs")).json() });
  const stats = statsQuery.data;
  const companies = companiesQuery.data ?? [];
  const refreshPlatform = async (...keys: string[]) => {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const mutationError = (error: unknown) => toast({ title: "Handlingen mislykkedes", description: error instanceof Error ? error.message : "Prøv igen.", variant: "destructive" });
  const createCompanyMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/platform/companies", {
      ...companyForm,
      cvr: companyForm.cvr || null, email: companyForm.email || null, address: companyForm.address || null, phone: companyForm.phone || null,
      planId: Number(companyForm.planId), trialDays: Number(companyForm.trialDays),
    })).json(),
    onSuccess: async () => {
      await refreshPlatform("/api/platform/companies", "/api/platform/stats");
      setCompanyDialogOpen(false);
      setCompanyForm({ name: "", cvr: "", email: "", address: "", phone: "", adminName: "", adminEmail: "", adminPassword: "", planId: "", billingCycle: "maanedlig", trialDays: "14" });
      toast({ title: "Virksomheden er oprettet", description: "Lederkonto og prøveabonnement er klar." });
    },
    onError: mutationError,
  });
  const companyActionMutation = useMutation({
    mutationFn: async ({ companyId, action }: { companyId: number; action: "invoice" | "suspend" | "reactivate" }) => (await apiRequest("POST", `/api/platform/companies/${companyId}/${action}`, action === "suspend" ? { reason: "Spærret af platformadministrator" } : undefined)).json(),
    onSuccess: async (_data, variables) => {
      await refreshPlatform("/api/platform/companies", "/api/platform/stats", "/api/platform/invoices");
      toast({ title: variables.action === "invoice" ? "Abonnementsfaktura oprettet" : variables.action === "suspend" ? "Virksomheden er spærret" : "Virksomheden er genåbnet" });
    },
    onError: mutationError,
  });
  const savePlanMutation = useMutation({
    mutationFn: async () => (await apiRequest(editingPlan?.id ? "PATCH" : "POST", editingPlan?.id ? `/api/platform/plans/${editingPlan.id}` : "/api/platform/plans", {
      name: planForm.name, slug: planForm.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), description: planForm.description || null,
      monthlyPrice: Number(planForm.monthlyPrice), pricePerEmployee: Number(planForm.pricePerEmployee),
      maxUsers: -1, maxEmployees: -1, maxCustomers: -1,
      maxDocuments: Number(planForm.maxDocuments), maxEntries: Number(planForm.maxEntries),
      maxCompanies: Number(planForm.maxCompanies), maxIntegrations: Number(planForm.maxIntegrations),
      includedCompanies: Number(planForm.includedCompanies), additionalCompanyPrice: Number(planForm.additionalCompanyPrice),
      includedAiCredits: Number(planForm.includedAiCredits), aiAddonPrice: Number(planForm.aiAddonPrice),
      aiAddonCredits: Number(planForm.aiAddonCredits), aiCreditsPerAdditionalCompany: Number(planForm.aiCreditsPerAdditionalCompany),
      aiCostCap: Number(planForm.aiCostCap), aiCostCapPerAdditionalCompany: Number(planForm.aiCostCapPerAdditionalCompany),
      features: JSON.stringify(planForm.features), sortOrder: Number(planForm.sortOrder), active: planForm.active ? 1 : 0,
    })).json(),
    onSuccess: async () => { const created = !editingPlan?.id; await refreshPlatform("/api/platform/plans", "/api/platform/companies", "/api/platform/stats"); setEditingPlan(null); toast({ title: created ? "Pakken er oprettet" : "Pakken er opdateret" }); },
    onError: mutationError,
  });
  const invoiceActionMutation = useMutation({
    mutationFn: async ({ invoiceId, action }: { invoiceId: number; action: "send" | "remind" | "paid" }) => (await apiRequest("POST", `/api/platform/invoices/${invoiceId}/${action}`)).json(),
    onSuccess: async (_data, variables) => { await refreshPlatform("/api/platform/invoices", "/api/platform/payments", "/api/platform/stats"); toast({ title: variables.action === "paid" ? "Faktura markeret som betalt" : variables.action === "remind" ? "Rykker lagt i mailkø" : "Faktura lagt i mailkø" }); },
    onError: mutationError,
  });
  const runJobMutation = useMutation({
    mutationFn: async (jobId: string) => (await apiRequest("POST", `/api/platform/jobs/${jobId}`)).json(),
    onSuccess: async (result) => { await refreshPlatform("/api/platform/jobs", "/api/operations/status", "/api/platform/backups"); toast({ title: "Driftsjobbet er afsluttet", description: result?.detail ?? "Kørslen er registreret." }); },
    onError: mutationError,
  });
  const supportAiMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/support-cases/${id}/ai-reply`)).json(),
    onSuccess: (updated) => { setSelectedSupportCase(updated); setSupportReply(updated.reply ?? ""); toast({ title: "Svarudkast er oprettet", description: "Kontrollér altid teksten før afsendelse." }); },
    onError: mutationError,
  });
  const supportSaveMutation = useMutation({
    mutationFn: async ({ send, close }: { send: boolean; close?: boolean }) => (await apiRequest(send ? "POST" : "PATCH", send ? `/api/support-cases/${selectedSupportCase.id}/send-reply` : `/api/support-cases/${selectedSupportCase.id}`, send ? { reply: supportReply, close: Boolean(close) } : { reply: supportReply, replyStatus: "kladde", status: "under_behandling" })).json(),
    onSuccess: async (updated, variables) => { await refreshPlatform("/api/support-cases", "/api/platform/audit-logs"); setSelectedSupportCase(updated); setSupportReply(updated.reply ?? ""); toast({ title: variables.send ? "Svaret er sendt" : "Svarudkastet er gemt" }); },
    onError: mutationError,
  });
  const openPlanEditor = (plan: any) => {
    setPlanForm({
      name: plan.name ?? "", slug: plan.slug ?? "", description: plan.description ?? "",
      monthlyPrice: String(plan.monthlyPrice ?? 0), pricePerEmployee: String(plan.pricePerEmployee ?? 0),
      maxDocuments: String(plan.maxDocuments ?? 500), maxEntries: String(plan.maxEntries ?? 5000),
      maxCompanies: String(plan.maxCompanies ?? 1), maxIntegrations: String(plan.maxIntegrations ?? 2),
      includedCompanies: String(plan.includedCompanies ?? 1), additionalCompanyPrice: String(plan.additionalCompanyPrice ?? 0),
      includedAiCredits: String(plan.includedAiCredits ?? 0), aiAddonPrice: String(plan.aiAddonPrice ?? 0),
      aiAddonCredits: String(plan.aiAddonCredits ?? 0), aiCreditsPerAdditionalCompany: String(plan.aiCreditsPerAdditionalCompany ?? 0),
      aiCostCap: String(plan.aiCostCap ?? 0), aiCostCapPerAdditionalCompany: String(plan.aiCostCapPerAdditionalCompany ?? 0),
      features: parsePlanFeatures(plan.features), sortOrder: String(plan.sortOrder ?? 1), active: Boolean(plan.active),
    });
    setEditingPlan(plan);
  };
  const openNewPlan = () => {
    setPlanForm({ name: "", slug: "", description: "", monthlyPrice: "0", pricePerEmployee: "0", maxDocuments: "500", maxEntries: "5000", maxCompanies: "1", maxIntegrations: "2", includedCompanies: "1", additionalCompanyPrice: "0", includedAiCredits: "0", aiAddonPrice: "0", aiAddonCredits: "0", aiCreditsPerAdditionalCompany: "0", aiCostCap: "0", aiCostCapPerAdditionalCompany: "0", features: ["regnskab", "kontoplan", "bilag", "fakturering", "moms", "rapporter"], sortOrder: String((plansQuery.data?.length ?? 0) + 1), active: true });
    setEditingPlan({ id: null });
  };
  const togglePlanFeature = (feature: string, checked: boolean) => setPlanForm((form) => ({
    ...form,
    features: checked ? Array.from(new Set([...form.features, feature])) : form.features.filter((item) => item !== feature),
  }));
  const allowedTabs = ["dashboard", "virksomheder", "pakker", "betalinger", "backup_platform", "platform_drift", "fagbrugere", "platform_support", "adgangspolitik"];
  const tab = allowedTabs.includes(activeTab) ? activeTab : "dashboard";
  const headings: Record<string, [string, string]> = {
    dashboard: ["Platformoverblik", "Drift, abonnementer og kundestatus – uden beløb, bilag, bankdata eller posteringer."],
    virksomheder: ["Virksomheder", "Administrér abonnement og teknisk kundestatus uden adgang til bogføringen."],
    pakker: ["Pakkeløsninger", "Administrér de abonnementspakker, virksomhederne kan vælge."],
    betalinger: ["Fakturaer & QuickPay", "Overblik over ADD SmartRegnskabs abonnementsbetalinger og betalingsudbyder."],
    backup_platform: ["Backup-system", "Teknisk backupstatus for platformen uden visning af kundernes indhold."],
    platform_drift: ["Systemdrift", "Sundhed, integrationer og baggrundstjenester for ADD SmartRegnskab."],
    fagbrugere: ["Bogholder & Revisor", "Virksomheden styrer selv invitation, rettigheder og udløb for fagbrugere."],
    platform_support: ["Support", "Supportsager, som virksomhederne selv har sendt til ADD SmartRegnskab."],
    adgangspolitik: ["Adgang og databeskyttelse", "Platformrollen er teknisk adskilt fra kundernes regnskabsdata."],
  };

  return <div className="space-y-5">
    <PageHeader
      title={headings[tab][0]}
      description={headings[tab][1]}
    />

    {tab === "dashboard" && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="platform-kpis">
        <KpiCard label="Virksomheder" value={num(stats?.companyCount ?? companies.length)} icon={<Building2 className="size-4" />} variant="blue" testId="kpi-platform-companies" />
        <KpiCard label="Aktive abonnementer" value={num(stats?.activeCount ?? 0)} icon={<Check className="size-4" />} variant="green" testId="kpi-platform-active" />
        <KpiCard label="Prøveperioder" value={num(stats?.trialCount ?? 0)} icon={<Clock className="size-4" />} variant="gray" testId="kpi-platform-trials" />
        <KpiCard label="Systemstatus" value="Driftsklar" icon={<ShieldCheck className="size-4" />} variant="green" testId="kpi-platform-status" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <SectionCard title="Kundestatus" icon={<Building2 className="size-4" />} noPadding>
          {companiesQuery.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            : companies.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ingen kundevirksomheder er oprettet.</p>
            : <div className="divide-y">{companies.slice(0, 8).map((company) => <div key={company.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{company.name}</p><p className="text-xs text-muted-foreground">{company.planName ?? "Ingen pakke"} · {num(company.userCount ?? 0)} brugere</p></div>
              <StatusChip status={company.status ?? "ukendt"} />
            </div>)}</div>}
        </SectionCard>
        <SectionCard title="Databeskyttelse" icon={<ShieldCheck className="size-4" />}>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><p className="font-semibold">Kundedata er afskærmet</p><p className="mt-1 text-xs opacity-80">Platformadministratoren kan ikke åbne posteringer, bilag, bankdata eller økonomiske rapporter.</p></div>
            <a href="#/smartregnskab/app/adgangspolitik" className="flex items-center justify-between rounded-lg border px-3 py-2.5 font-medium hover:bg-muted">Se adgangspolitik <ChevronRight className="h-4 w-4" /></a>
          </div>
        </SectionCard>
      </div>
    </>}

    {tab === "virksomheder" && <SectionCard title="Kundevirksomheder" icon={<Building2 className="size-4" />} noPadding>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-medium">Kunder og abonnementer</p><p className="text-xs text-muted-foreground">Opret adgang, udsted abonnementsfaktura og administrér teknisk status.</p></div>
        <Button onClick={() => setCompanyDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Opret virksomhed</Button>
      </div>
      {companiesQuery.isLoading ? <div className="grid gap-3 p-4 sm:grid-cols-2"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
        : companiesQuery.isError ? <p className="p-5 text-sm text-destructive">Kunne ikke hente kundestatus.</p>
        : companies.length === 0 ? <div className="p-8 text-center"><Building2 className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="text-sm font-medium">Ingen kundevirksomheder endnu</p><p className="mt-1 text-xs text-muted-foreground">Brug “Opret virksomhed” for at oprette den første kunde og lederkonto.</p></div>
        : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{companies.map((company) => <div key={company.id} className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><StatusChip status={company.status ?? "ukendt"} /></div>
          <p className="truncate text-sm font-semibold">{company.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{company.cvr ? `CVR ${company.cvr} · ` : ""}{company.planName ?? "Ingen pakke"}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-muted p-2"><span className="block text-muted-foreground">Brugere</span><strong>{num(company.userCount ?? 0)}</strong></div><div className="rounded-lg bg-muted p-2"><span className="block text-muted-foreground">Næste periode</span><strong>{company.currentPeriodEnd ?? "—"}</strong></div></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={companyActionMutation.isPending} onClick={() => companyActionMutation.mutate({ companyId: company.id, action: "invoice" })}><FileText className="mr-1.5 h-3.5 w-3.5"/>Opret faktura</Button>
            {company.status === "spaerret" ? <Button size="sm" variant="outline" disabled={companyActionMutation.isPending} onClick={() => companyActionMutation.mutate({ companyId: company.id, action: "reactivate" })}><Power className="mr-1.5 h-3.5 w-3.5"/>Genåbn</Button> : <Button size="sm" variant="outline" disabled={companyActionMutation.isPending} onClick={() => { if (window.confirm(`Spær adgangen for ${company.name}?`)) companyActionMutation.mutate({ companyId: company.id, action: "suspend" }); }}><Lock className="mr-1.5 h-3.5 w-3.5"/>Spær</Button>}
          </div>
          <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> Regnskabsdata er ikke tilgængelige</p>
        </div>)}</div>}
    </SectionCard>}

    {tab === "pakker" && <SectionCard title="Pakkeløsninger" icon={<Package className="size-4" />}>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold">Pakker med rigtigt indhold</p><p className="mt-1 text-xs text-muted-foreground">Funktionerne her bliver vist som pakkens indhold og gemmes sammen med abonnementet. Årsbetaling beregnes som 10 måneders pris.</p></div>
        <Button onClick={openNewPlan}><Plus className="mr-2 h-4 w-4"/>Opret ny pakke</Button>
      </div>
      {plansQuery.isLoading ? <Skeleton className="h-32 w-full" /> : plansQuery.isError ? <p className="text-sm text-destructive">Kunne ikke hente pakkeløsningerne.</p> : (plansQuery.data ?? []).length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><Package className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="text-sm font-medium">Ingen pakkeløsninger endnu</p><Button className="mt-3" size="sm" onClick={openNewPlan}>Opret den første pakke</Button></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{(plansQuery.data ?? []).map((plan) => {
        const features = parsePlanFeatures(plan.features);
        return <div key={plan.id} className={`flex flex-col rounded-xl border bg-background p-4 shadow-sm ${plan.active ? "" : "opacity-65"}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plan.name}</p><p className="text-[11px] text-muted-foreground">{plan.slug}</p></div><StatusChip status={plan.active ? "aktiv" : "inaktiv"} /></div>
          <p className="mt-4 text-2xl font-bold">{money(plan.monthlyPrice)}<span className="text-xs font-normal text-muted-foreground"> / md. ekskl. moms</span></p>
          <p className="mt-1 text-[11px] text-muted-foreground">{money(Number(plan.monthlyPrice) * 10)} / år · 2 måneder inkluderet</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted p-2">Bilag / md.<br/><strong>{plan.maxDocuments === -1 ? "Ubegrænset" : num(plan.maxDocuments)}</strong></div>
            <div className="rounded-lg bg-muted p-2">Posteringer / md.<br/><strong>{plan.maxEntries === -1 ? "Ubegrænset" : num(plan.maxEntries)}</strong></div>
            <div className="rounded-lg bg-muted p-2">Virksomheder<br/><strong>{plan.maxCompanies === -1 ? "Ubegrænset" : num(plan.maxCompanies)}</strong></div>
            <div className="rounded-lg bg-muted p-2">Integrationer<br/><strong>{plan.maxIntegrations === -1 ? "Ubegrænset" : num(plan.maxIntegrations)}</strong></div>
          </div>
          <div className="mt-2 rounded-lg border bg-primary/5 p-2 text-xs"><strong>{plan.includedAiCredits > 0 ? `${num(plan.includedAiCredits)} AI inkluderet` : `AI-tilkøb ${money(plan.aiAddonPrice)}`}</strong><span className="block text-muted-foreground">{plan.includedCompanies} CVR inkluderet{plan.additionalCompanyPrice > 0 ? ` · +${money(plan.additionalCompanyPrice)} pr. ekstra` : ""}</span></div>
          <p className="mt-3 min-h-12 text-xs text-muted-foreground">{plan.description || "Ingen beskrivelse"}</p>
          <div className="mt-3 flex-1 border-t pt-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{features.length} funktioner inkluderet</p><ul className="space-y-1.5">{features.map((feature) => <li key={feature} className="flex gap-2 text-xs"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"/><span>{PLAN_FEATURE_LABELS[feature] ?? feature.replaceAll("_", " ")}</span></li>)}</ul>{features.length === 0 && <p className="text-xs text-amber-700">Pakken mangler funktioner.</p>}</div>
          <Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => openPlanEditor(plan)}><Pencil className="mr-2 h-3.5 w-3.5"/>Rediger pakke</Button>
        </div>;
      })}</div>}
    </SectionCard>}

    {tab === "betalinger" && <div className="grid gap-4 xl:grid-cols-[.7fr_1.3fr]">
      <SectionCard title="QuickPay-status" icon={<CreditCard className="size-4" />}>
        {paymentsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : <div className="space-y-3"><div className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">QuickPay</p><p className="text-xs text-muted-foreground">Betalingsudbyder</p></div><StatusChip status={paymentsQuery.data?.providers?.find((provider: any) => provider.id === "quickpay")?.configured ? "konfigureret" : "mangler opsætning"} /></div><p className="text-xs text-muted-foreground">Denne side viser kun betalinger til ADD SmartRegnskab – ikke virksomhedernes egne fakturaer.</p></div>}
      </SectionCard>
      <SectionCard title="Abonnementsfakturaer" icon={<FileText className="size-4" />} noPadding>
        {platformInvoicesQuery.isLoading ? <div className="p-4"><Skeleton className="h-28 w-full" /></div> : (platformInvoicesQuery.data ?? []).length === 0 ? <div className="p-5"><p className="text-sm font-medium">Ingen abonnementsfakturaer endnu</p><p className="mt-1 text-xs text-muted-foreground">Opret den første fra siden Virksomheder. Fakturaerne her er kun ADD SmartRegnskabs egne abonnementsfakturaer.</p></div> : <div className="divide-y">{(platformInvoicesQuery.data ?? []).slice(0, 20).map((invoice) => <div key={invoice.id} className="px-4 py-3"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invoice.invoiceNumber ?? `Faktura ${invoice.id}`}</p><p className="text-xs text-muted-foreground">{invoice.issueDate ?? "—"} · {invoice.companyName ?? `Virksomhed ${invoice.companyId}`}</p></div><strong className="text-sm">{money(invoice.totalAmount)}</strong><StatusChip status={invoice.status ?? "ukendt"} /></div><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => openAuthedFile(`/api/platform/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber ?? "faktura"}.pdf`)}>PDF</Button>{invoice.status !== "betalt" && <><Button size="sm" variant="outline" disabled={invoiceActionMutation.isPending} onClick={() => invoiceActionMutation.mutate({ invoiceId: invoice.id, action: "send" })}>Send</Button><Button size="sm" variant="outline" disabled={invoiceActionMutation.isPending} onClick={() => invoiceActionMutation.mutate({ invoiceId: invoice.id, action: "remind" })}>Send rykker</Button><Button size="sm" variant="outline" disabled={invoiceActionMutation.isPending} onClick={() => { if (window.confirm("Marker fakturaen som betalt?")) invoiceActionMutation.mutate({ invoiceId: invoice.id, action: "paid" }); }}>Markér betalt</Button></>}</div></div>)}</div>}
      </SectionCard>
    </div>}

    {tab === "backup_platform" && <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <SectionCard title="Backupberedskab" icon={<ShieldCheck className="size-4" />}>
        {operationsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : (() => { const backupService = (operationsQuery.data?.services ?? []).find((service: any) => service.id === "backup"); return <div className="space-y-3"><div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-semibold">Ekstern, adskilt backup</p><p className="mt-1 text-xs text-muted-foreground">{backupService?.message ?? "Status kan ikke hentes."}</p></div><StatusChip status={backupService?.status ?? "ukendt"}/></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Vigtigt:</strong> Vedvarende serverlager er ikke i sig selv en backup. Siden viser derfor ikke “sikret”, før den eksterne S3-backup faktisk er konfigureret.</div></div>; })()}
      </SectionCard>
      <SectionCard title="Dokumenterede backupkørsler" icon={<Archive className="size-4" />} noPadding>
        {backupsQuery.isLoading ? <div className="p-4"><Skeleton className="h-28 w-full" /></div> : (backupsQuery.data ?? []).length === 0 ? <div className="p-5"><p className="text-sm font-medium">Ingen verificerede backupkørsler registreret</p><p className="mt-1 text-xs text-muted-foreground">Der oprettes ikke falske backupkvitteringer. Når ekstern backup er koblet på, vises kørsler, tidspunkt, destination og resultat her.</p></div> : <div className="divide-y">{(backupsQuery.data ?? []).map((backup) => <div key={backup.id} className="flex items-center gap-3 px-4 py-3"><Archive className="h-4 w-4 text-primary"/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{backup.scope ?? "Platform"} · {backup.destination ?? "backup"}</p><p className="text-xs text-muted-foreground">{backup.createdAt ?? "—"} · {backup.size ?? "størrelse ukendt"}</p></div><StatusChip status={backup.status ?? "ukendt"}/></div>)}</div>}
      </SectionCard>
    </div>}

    {tab === "platform_drift" && <div className="space-y-4">
      <SectionCard title="Tjenester" icon={<Activity className="size-4" />}>
        <div className="mb-3 flex justify-end"><Button size="sm" variant="outline" onClick={() => { operationsQuery.refetch(); jobsQuery.refetch(); }}><RefreshCw className="mr-2 h-3.5 w-3.5"/>Opdatér status</Button></div>
        {operationsQuery.isLoading ? <Skeleton className="h-32 w-full" /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(operationsQuery.data?.services ?? []).map((service: any) => <div key={service.id} className="rounded-xl border bg-background p-4"><div className="flex items-center justify-between"><p className="font-semibold">{service.name ?? service.id}</p><StatusChip status={service.status ?? "ukendt"}/></div><p className="mt-2 text-xs text-muted-foreground">{service.message ?? "Tjenesten svarer normalt."}</p></div>)}</div>}
      </SectionCard>
      <SectionCard title="Automatiske driftsjob" icon={<RefreshCw className="size-4" />} noPadding>
        {jobsQuery.isLoading ? <div className="p-4"><Skeleton className="h-24 w-full"/></div> : <div className="divide-y">{(jobsQuery.data?.jobs ?? []).map((job: any) => { const latest = (jobsQuery.data?.runs ?? []).find((run: any) => run.job === job.id); return <div key={job.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{job.label}</p><p className="text-xs text-muted-foreground">Hver {job.everyMinutes >= 1440 ? `${Math.round(job.everyMinutes / 1440)} dag` : `${job.everyMinutes} min.`} · Senest: {latest?.createdAt ?? latest?.startedAt ?? "ikke registreret"}</p></div><StatusChip status={latest?.status ?? "planlagt"}/><Button size="sm" variant="outline" disabled={runJobMutation.isPending} onClick={() => { if (window.confirm(`Kør “${job.label}” nu?`)) runJobMutation.mutate(job.id); }}>{runJobMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>}Kør nu</Button></div>; })}</div>}
      </SectionCard>
    </div>}

    {tab === "fagbrugere" && <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><SectionCard title="Virksomhedsstyret adgang" icon={<Briefcase className="size-4" />}><p className="text-sm text-muted-foreground">Bogholdere og revisorer inviteres fra den enkelte virksomheds egen konto. Platformen kan kontrollere kontostatus og 2FA, men kan ikke tildele sig selv adgang til klientens regnskab.</p></SectionCard><SectionCard title="Sikkerhedskrav" icon={<ShieldCheck className="size-4" />}><ul className="space-y-2 text-sm">{["Tofaktorgodkendelse før klientadgang", "Tidsbegrænset adgang", "Læs- eller skriverettigheder pr. klient", "Fuld logning af handlinger"].map((text) => <li key={text} className="flex gap-2"><Check className="h-4 w-4 text-emerald-600"/>{text}</li>)}</ul></SectionCard></div>
      <SectionCard title="Registrerede fagbrugere" icon={<Users className="size-4" />} noPadding>{professionalsQuery.isLoading ? <div className="p-4"><Skeleton className="h-24 w-full"/></div> : (professionalsQuery.data ?? []).length === 0 ? <div className="p-5"><p className="text-sm font-medium">Ingen fagbrugere registreret endnu</p><p className="mt-1 text-xs text-muted-foreground">En virksomheds administrator inviterer den første bogholder eller revisor fra sin egen konto.</p></div> : <div className="divide-y">{(professionalsQuery.data ?? []).map((professional) => <div key={professional.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Briefcase className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{professional.name}</p><p className="truncate text-xs text-muted-foreground">{professional.email} · {professional.clientCount} aktive klientadgange</p></div><StatusChip status={professional.active ? "aktiv" : "inaktiv"}/><StatusChip status={professional.twoFactorEnabled ? "2FA aktiv" : "2FA mangler"}/></div>)}</div>}</SectionCard>
    </div>}

    {tab === "platform_support" && <SectionCard title="Modtagne supportsager" icon={<AlertTriangle className="size-4" />} noPadding>
      {supportQuery.isLoading ? <div className="p-4"><Skeleton className="h-28 w-full" /></div> : (supportQuery.data ?? []).length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ingen åbne supportsager.</p> : <div className="divide-y">{(supportQuery.data ?? []).slice(0, 30).map((supportCase) => <button type="button" key={supportCase.id} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => { setSelectedSupportCase(supportCase); setSupportReply(supportCase.reply ?? ""); }}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{supportCase.subject ?? `Sag ${supportCase.id}`}</p><p className="text-xs text-muted-foreground">{supportCase.createdAt ?? "—"} · {supportCase.companyName ?? `Virksomhed ${supportCase.companyId}`} · {supportCase.createdBy ?? "ukendt afsender"}</p></div><StatusChip status={supportCase.priority ?? "normal"}/><StatusChip status={supportCase.status ?? "aaben"}/><ChevronRight className="h-4 w-4 text-muted-foreground"/></button>)}</div>}
    </SectionCard>}

    {tab === "adgangspolitik" && <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Platformadministrator" icon={<Lock className="size-4" />}>
        <ul className="space-y-3 text-sm">
          {["Kan administrere abonnement og kundestatus", "Kan se teknisk drift og antal brugere", "Kan ikke se bilag, posteringer, bankdata eller rapporter", "Kan ikke bogføre eller godkende på kundens vegne"].map((text) => <li key={text} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{text}</span></li>)}
        </ul>
      </SectionCard>
      <SectionCard title="Bogholder og revisor" icon={<Briefcase className="size-4" />}>
        <ul className="space-y-3 text-sm">
          {["Adgang gives af virksomhedens egen administrator", "Tofaktorgodkendelse kræves", "Rettigheder kan være læseadgang eller skriveadgang", "Adgangen kan udløbe og alle handlinger logges"].map((text) => <li key={text} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{text}</span></li>)}
        </ul>
      </SectionCard>
      <SectionCard title="Databehandleraftaler" icon={<FileCheck2 className="size-4" />}><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-muted p-3"><strong className="block text-xl">{gdprQuery.data?.companyCount ?? 0}</strong><span className="text-xs text-muted-foreground">Virksomheder</span></div><div className="rounded-lg bg-muted p-3"><strong className="block text-xl text-emerald-600">{gdprQuery.data?.dpaAccepted ?? 0}</strong><span className="text-xs text-muted-foreground">Accepteret</span></div><div className="rounded-lg bg-muted p-3"><strong className="block text-xl text-amber-600">{gdprQuery.data?.dpaPending ?? 0}</strong><span className="text-xs text-muted-foreground">Mangler</span></div></div></SectionCard>
      <SectionCard title="Seneste platformhandlinger" icon={<ListChecks className="size-4" />} noPadding>{platformAuditQuery.isLoading ? <div className="p-4"><Skeleton className="h-24 w-full"/></div> : (platformAuditQuery.data ?? []).length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ingen platformhandlinger registreret.</p> : <div className="divide-y">{(platformAuditQuery.data ?? []).slice(0, 8).map((entry) => <div key={entry.id} className="px-4 py-3"><p className="text-sm font-medium">{entry.action} · {entry.target}</p><p className="text-xs text-muted-foreground">{entry.createdAt ?? "—"} · {entry.userEmail ?? "system"}</p></div>)}</div>}</SectionCard>
    </div>}

    <Dialog open={Boolean(selectedSupportCase)} onOpenChange={(open) => { if (!open) setSelectedSupportCase(null); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{selectedSupportCase?.subject ?? "Supportsag"}</DialogTitle></DialogHeader>
        {selectedSupportCase && <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-2"><p><span className="text-muted-foreground">Virksomhed:</span> {selectedSupportCase.companyName ?? selectedSupportCase.companyId}</p><p><span className="text-muted-foreground">Afsender:</span> {selectedSupportCase.createdBy ?? "—"}</p><p><span className="text-muted-foreground">Prioritet:</span> {selectedSupportCase.priority ?? "normal"}</p><p><span className="text-muted-foreground">Status:</span> {selectedSupportCase.status ?? "aaben"}</p></div>
          <div><Label>Henvendelse</Label><div className="mt-2 whitespace-pre-wrap rounded-lg border p-3 text-sm">{selectedSupportCase.message}</div></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="support-reply">Svar</Label><Button size="sm" variant="outline" disabled={supportAiMutation.isPending} onClick={() => supportAiMutation.mutate(selectedSupportCase.id)}><Sparkles className="mr-2 h-3.5 w-3.5"/>{supportAiMutation.isPending ? "Opretter…" : "Lav AI-udkast"}</Button></div><Textarea id="support-reply" className="min-h-44" value={supportReply} onChange={(event) => setSupportReply(event.target.value)}/><p className="text-[11px] text-muted-foreground">AI laver kun et udkast. Intet sendes, før du trykker “Send svar”.</p></div>
        </div>}
        <DialogFooter className="flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => setSelectedSupportCase(null)}>Luk</Button><Button variant="outline" disabled={supportSaveMutation.isPending || !supportReply.trim()} onClick={() => supportSaveMutation.mutate({ send: false })}>Gem kladde</Button><Button disabled={supportSaveMutation.isPending || !supportReply.trim()} onClick={() => { if (window.confirm(`Send svaret til ${selectedSupportCase?.createdBy}?`)) supportSaveMutation.mutate({ send: true }); }}>{supportSaveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Send svar</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Opret kundevirksomhed</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="platform-company-name">Virksomhedsnavn *</Label><Input id="platform-company-name" value={companyForm.name} onChange={(event) => setCompanyForm((form) => ({ ...form, name: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="platform-company-cvr">CVR</Label><Input id="platform-company-cvr" inputMode="numeric" value={companyForm.cvr} onChange={(event) => setCompanyForm((form) => ({ ...form, cvr: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="platform-company-email">Virksomhedens e-mail</Label><Input id="platform-company-email" type="email" value={companyForm.email} onChange={(event) => setCompanyForm((form) => ({ ...form, email: event.target.value }))}/></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="platform-company-address">Adresse</Label><Input id="platform-company-address" value={companyForm.address} onChange={(event) => setCompanyForm((form) => ({ ...form, address: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="platform-admin-name">Lederens navn</Label><Input id="platform-admin-name" value={companyForm.adminName} onChange={(event) => setCompanyForm((form) => ({ ...form, adminName: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="platform-admin-email">Lederens e-mail *</Label><Input id="platform-admin-email" type="email" value={companyForm.adminEmail} onChange={(event) => setCompanyForm((form) => ({ ...form, adminEmail: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="platform-admin-password">Midlertidig adgangskode *</Label><Input id="platform-admin-password" type="password" autoComplete="new-password" value={companyForm.adminPassword} onChange={(event) => setCompanyForm((form) => ({ ...form, adminPassword: event.target.value }))}/><p className="text-[11px] text-muted-foreground">Mindst 8 tegn. Send den til lederen via en separat, sikker kanal.</p></div>
          <div className="space-y-2"><Label>Pakke *</Label><Select value={companyForm.planId} onValueChange={(value) => setCompanyForm((form) => ({ ...form, planId: value }))}><SelectTrigger><SelectValue placeholder="Vælg pakke"/></SelectTrigger><SelectContent>{(plansQuery.data ?? []).filter((plan) => plan.active).map((plan) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name} · {money(plan.monthlyPrice)}/md.</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Fakturering</Label><Select value={companyForm.billingCycle} onValueChange={(value) => setCompanyForm((form) => ({ ...form, billingCycle: value }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="maanedlig">Månedlig</SelectItem><SelectItem value="aarlig">Årlig</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="platform-trial-days">Prøveperiode (dage)</Label><Input id="platform-trial-days" type="number" min="0" max="90" value={companyForm.trialDays} onChange={(event) => setCompanyForm((form) => ({ ...form, trialDays: event.target.value }))}/></div>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground"><Lock className="mr-1 inline h-3.5 w-3.5"/>Oprettelsen giver platformen adgang til abonnement og teknisk status, ikke til virksomhedens regnskabsdata.</div>
        <DialogFooter><Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Annuller</Button><Button disabled={createCompanyMutation.isPending || !companyForm.name || !companyForm.adminEmail || companyForm.adminPassword.length < 8 || !companyForm.planId} onClick={() => createCompanyMutation.mutate()}>{createCompanyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Opret virksomhed</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(editingPlan)} onOpenChange={(open) => { if (!open) setEditingPlan(null); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editingPlan?.id ? "Rediger pakkeløsning" : "Opret pakkeløsning"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="plan-name">Navn *</Label><Input id="plan-name" value={planForm.name} onChange={(event) => setPlanForm((form) => ({ ...form, name: event.target.value, ...(!editingPlan?.id && !form.slug ? { slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } : {}) }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-slug">Systemnavn *</Label><Input id="plan-slug" value={planForm.slug} disabled={Boolean(editingPlan?.id)} onChange={(event) => setPlanForm((form) => ({ ...form, slug: event.target.value }))}/><p className="text-[11px] text-muted-foreground">Bruges internt og kan ikke ændres efter oprettelse.</p></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="plan-description">Beskrivelse</Label><Textarea id="plan-description" value={planForm.description} onChange={(event) => setPlanForm((form) => ({ ...form, description: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-price">Pris pr. måned, kr.</Label><Input id="plan-price" type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={(event) => setPlanForm((form) => ({ ...form, monthlyPrice: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-employee-price">Pris pr. ansat, kr.</Label><Input id="plan-employee-price" type="number" min="0" step="0.01" value={planForm.pricePerEmployee} onChange={(event) => setPlanForm((form) => ({ ...form, pricePerEmployee: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-documents">Bilag pr. måned (-1 = fri)</Label><Input id="plan-documents" type="number" min="-1" value={planForm.maxDocuments} onChange={(event) => setPlanForm((form) => ({ ...form, maxDocuments: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-entries">Posteringer pr. måned (-1 = fri)</Label><Input id="plan-entries" type="number" min="-1" value={planForm.maxEntries} onChange={(event) => setPlanForm((form) => ({ ...form, maxEntries: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-companies">Virksomheder (-1 = fri)</Label><Input id="plan-companies" type="number" min="-1" value={planForm.maxCompanies} onChange={(event) => setPlanForm((form) => ({ ...form, maxCompanies: event.target.value }))}/></div>
          <div className="space-y-2"><Label htmlFor="plan-integrations">Aktive integrationer (-1 = fri)</Label><Input id="plan-integrations" type="number" min="-1" value={planForm.maxIntegrations} onChange={(event) => setPlanForm((form) => ({ ...form, maxIntegrations: event.target.value }))}/></div>
          <div className="space-y-2"><Label>Inkluderede CVR-numre</Label><Input type="number" min="1" value={planForm.includedCompanies} onChange={(event) => setPlanForm((form) => ({ ...form, includedCompanies: event.target.value }))}/></div>
          <div className="space-y-2"><Label>Pris pr. ekstra CVR</Label><Input type="number" min="0" value={planForm.additionalCompanyPrice} onChange={(event) => setPlanForm((form) => ({ ...form, additionalCompanyPrice: event.target.value }))}/></div>
          <div className="space-y-2"><Label>Inkluderede AI-handlinger</Label><Input type="number" min="0" value={planForm.includedAiCredits} onChange={(event) => setPlanForm((form) => ({ ...form, includedAiCredits: event.target.value }))}/></div>
          <div className="space-y-2"><Label>AI-handlinger pr. ekstra CVR</Label><Input type="number" min="0" value={planForm.aiCreditsPerAdditionalCompany} onChange={(event) => setPlanForm((form) => ({ ...form, aiCreditsPerAdditionalCompany: event.target.value }))}/></div>
          <div className="space-y-2"><Label>AI-tilkøbspris</Label><Input type="number" min="0" value={planForm.aiAddonPrice} onChange={(event) => setPlanForm((form) => ({ ...form, aiAddonPrice: event.target.value }))}/></div>
          <div className="space-y-2"><Label>AI-handlinger i tilkøb</Label><Input type="number" min="0" value={planForm.aiAddonCredits} onChange={(event) => setPlanForm((form) => ({ ...form, aiAddonCredits: event.target.value }))}/></div>
          <div className="space-y-2"><Label>Internt AI-omkostningsloft</Label><Input type="number" min="0" value={planForm.aiCostCap} onChange={(event) => setPlanForm((form) => ({ ...form, aiCostCap: event.target.value }))}/></div>
          <div className="space-y-2"><Label>Ekstra AI-loft pr. ekstra CVR</Label><Input type="number" min="0" value={planForm.aiCostCapPerAdditionalCompany} onChange={(event) => setPlanForm((form) => ({ ...form, aiCostCapPerAdditionalCompany: event.target.value }))}/></div>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs sm:col-span-2"><strong>Brugere, kunder og leverandører begrænses ikke.</strong><p className="mt-1 text-muted-foreground">Pakkerne skelnes i stedet på regnskabsvolumen, virksomheder, integrationer og funktioner.</p></div>
          <div className="space-y-2"><Label htmlFor="plan-order">Placering</Label><Input id="plan-order" type="number" min="1" value={planForm.sortOrder} onChange={(event) => setPlanForm((form) => ({ ...form, sortOrder: event.target.value }))}/></div>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs"><span className="text-muted-foreground">Årspris</span><strong className="mt-1 block text-base">{money((Number(planForm.monthlyPrice) || 0) * 10)} ekskl. moms</strong><span className="text-muted-foreground">10 måneders pris</span></div>
          <div className="space-y-3 sm:col-span-2"><div><Label>Inkluderede funktioner *</Label><p className="text-xs text-muted-foreground">Vælg præcis hvad kunden får adgang til i pakken.</p></div><div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">{PLAN_FEATURES.map(([key, label]) => <label key={key} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-muted"><Checkbox checked={planForm.features.includes(key)} onCheckedChange={(checked) => togglePlanFeature(key, checked === true)} /><span className="text-sm leading-4">{label}</span></label>)}</div></div>
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2"><div><p className="text-sm font-medium">Pakken kan vælges</p><p className="text-xs text-muted-foreground">Deaktivering ændrer ikke eksisterende abonnementer.</p></div><Switch checked={planForm.active} onCheckedChange={(checked) => setPlanForm((form) => ({ ...form, active: checked }))}/></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEditingPlan(null)}>Annuller</Button><Button disabled={savePlanMutation.isPending || !planForm.name.trim() || !planForm.slug.trim() || planForm.features.length === 0 || Number(planForm.monthlyPrice) < 0} onClick={() => savePlanMutation.mutate()}>{savePlanMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingPlan?.id ? "Gem ændringer" : "Opret pakke"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

export default function RegnskabssystemPage() {
  const { isPlatformAdmin } = useAuth();
  return isPlatformAdmin ? <PlatformRegnskabssystemPage /> : <CompanyRegnskabssystemPage />;
}

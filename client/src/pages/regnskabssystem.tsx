import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@//lib/queryClient";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";

// ── Nye SmartRegnskab tab komponenter ──
import BankIntegrationer from "@/pages/regnskab-tabs/bank-integrationer";
import Arkivering from "@/pages/regnskab-tabs/arkivering";
import Lonindberetning from "@/pages/regnskab-tabs/lonindberetning";
import Arsrapport from "@/pages/regnskab-tabs/arsrapport";
import Debitorstyring from "@/pages/regnskab-tabs/debitorstyring";
import Periodisering from "@/pages/regnskab-tabs/periodisering";
import Lagerregnskab from "@/pages/regnskab-tabs/lagerregnskab";
import ValutaMoms from "@/pages/regnskab-tabs/valuta-moms";
import Revisorportal from "@/pages/regnskab-tabs/revisorportal";
import RollerKontrol from "@/pages/regnskab-tabs/roller-kontrol";
import Importguide from "@/pages/regnskab-tabs/importguide";
import ApiWebhooks from "@/pages/regnskab-tabs/api-webhooks";
// ── Ruge 2 SmartRegnskab tabs ──
import IntegrationConfigs from "@/pages/regnskab-tabs/integration-configs";
import ComplianceChecks from "@/pages/regnskab-tabs/compliance-checks";
import BankPayments from "@/pages/regnskab-tabs/bank-payments";
import EinvoiceQueue from "@/pages/regnskab-tabs/einvoice-queue";
import ApiKeysMgmt from "@/pages/regnskab-tabs/api-keys-mgmt";
import MigrationWizard from "@/pages/regnskab-tabs/migration-wizard";
import Konsolidering from "@/pages/regnskab-tabs/konsolidering";
import AvanceretMoms from "@/pages/regnskab-tabs/avanceret-moms";
import LonmotorRegnskab from "@/pages/regnskab-tabs/lonmotor-regnskab";
import Revisionspakke from "@/pages/regnskab-tabs/revisionspakke";
import BudgetScenarier from "@/pages/regnskab-tabs/budget-scenarier";
import Afstemningscenter from "@/pages/regnskab-tabs/afstemningscenter";
// ── Ruge 3 SmartRegnskab tabs ──
import BrancheProfil from "@/pages/regnskab-tabs/branche-profil";
import KontoplanSkabeloner from "@/pages/regnskab-tabs/kontoplan-skabeloner";
import Dimensioner from "@/pages/regnskab-tabs/dimensioner";
import Regnskabskategorier from "@/pages/regnskab-tabs/regnskabskategorier";
import PlatformSync from "@/pages/regnskab-tabs/platform-sync";
import SyncMappings from "@/pages/regnskab-tabs/sync-mappings";
import WorkflowBuilder from "@/pages/regnskab-tabs/workflow-builder";
import IntegrationRuns from "@/pages/regnskab-tabs/integration-runs";
import RetryQueue from "@/pages/regnskab-tabs/retry-queue";
import Filhaandtering from "@/pages/regnskab-tabs/filhåndtering";
import Filversioner from "@/pages/regnskab-tabs/filversioner";
import ComplianceDokumenter from "@/pages/regnskab-tabs/compliance-dokumenter";
import Kontroltests from "@/pages/regnskab-tabs/kontroltests";
import Sikkerhedsaudit from "@/pages/regnskab-tabs/sikkerhedsaudit";
import Systemovervaagning from "@/pages/regnskab-tabs/systemovervågning";
import Leveringslog from "@/pages/regnskab-tabs/leveringslog";
import RbacRettigheder from "@/pages/regnskab-tabs/rbac-rettigheder";
import KundePortalIndstillinger from "@/pages/regnskab-tabs/kunde-portal-indstillinger";
import PortalDokumenter from "@/pages/regnskab-tabs/portal-dokumenter";
import BackupRegnskab from "@/pages/regnskab-tabs/backup-regnskab";
import Fakturering from "@/pages/regnskab-tabs/fakturering";
import Kundekartotek from "@/pages/regnskab-tabs/kundekartotek";
import Leverandoerkartotek from "@/pages/regnskab-tabs/leverandoerkartotek";
import Produktkartotek from "@/pages/regnskab-tabs/produktkartotek";
import FasteFakturaer from "@/pages/regnskab-tabs/faste-fakturaer";
import Kontrolcenter from "@/pages/regnskab-tabs/kontrolcenter";
import AiStyring from "@/pages/regnskab-tabs/ai-styring";

/* ---------- typer ---------- */

type CompanySummary = {
  id: number;
  name: string;
  accountCount?: number | null;
  entryCount?: number | null;
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

export default function RegnskabssystemPage(props: any = {}) {
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
    selectedCompanyId ?? (isPlatformAdmin ? companies[0]?.id ?? null : authCompanyId ?? null);

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Regnskabssystem"
        description="Dashboard, kontoplan, bogføring, bilag, bankafstemning, moms og AI Regnskab (beta)."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* VENSTRE SIDEBAR — VIRKSOMHEDER */}
        <aside className="space-y-2">
          <SectionCard title="Virksomheder" icon={<Building2 className="size-4" />} noPadding>
            {companiesQuery.isLoading ? (
              <div className="p-2 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : companiesQuery.isError ? (
              <p className="text-xs text-muted-foreground p-3">
                Kunne ikke hente virksomheder.
              </p>
            ) : companies.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">
                Ingen virksomheder fundet.
              </p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <ul className="divide-y divide-border" data-testid="list-companies">
                  {companies.map((c) => {
                    const active = c.id === effectiveCompanyId;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          data-testid={`btn-company-${c.id}`}
                          onClick={() => setSelectedCompanyId(c.id)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-muted/50 transition-colors ${
                            active ? "bg-muted" : ""
                          }`}
                        >
                          <Building2 className="size-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(c.accountCount ?? 0)} konti · {(c.entryCount ?? 0)} poster
                            </p>
                          </div>
                          {active && <ChevronRight className="size-3.5 text-muted-foreground" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </SectionCard>
        </aside>

        {/* HØJRE — FANEOPD ELT INDHOLD */}
        <div className="space-y-4">
          {!effectiveCompanyId ? (
            <SectionCard>
              <p className="text-xs text-muted-foreground py-4">
                Vælg en virksomhed til venstre for at se regnskabsdata.
              </p>
            </SectionCard>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex flex-wrap h-auto" data-testid="tabs-regnskabssystem">
                <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                  <LayoutDashboard className="size-3.5 mr-1.5" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="kontoplan" data-testid="tab-kontoplan">
                  <BookOpen className="size-3.5 mr-1.5" />
                  Kontoplan & Bogføring
                </TabsTrigger>
                <TabsTrigger value="bilag" data-testid="tab-bilag">
                  <Receipt className="size-3.5 mr-1.5" />
                  Bilag & Udgifter
                </TabsTrigger>
                <TabsTrigger value="bank" data-testid="tab-bank">
                  <Landmark className="size-3.5 mr-1.5" />
                  Bankafstemning
                </TabsTrigger>
                <TabsTrigger value="moms" data-testid="tab-moms">
                  <Calculator className="size-3.5 mr-1.5" />
                  Moms & Skat
                </TabsTrigger>
                <TabsTrigger value="rapporter" data-testid="tab-rapporter">
                  <FileBarChart className="size-3.5 mr-1.5" />
                  Rapporter
                </TabsTrigger>
                <TabsTrigger value="ai" data-testid="tab-ai">
                  <Sparkles className="size-3.5 mr-1.5" />
                  AI Regnskab (beta)
                </TabsTrigger>
                <TabsTrigger value="automatisering" data-testid="tab-automatisering">
                  <Zap className="size-3.5 mr-1.5" />
                  Automatisering
                </TabsTrigger>
                <TabsTrigger value="debitor" data-testid="tab-debitor">
                  <ArrowLeftRight className="size-3.5 mr-1.5" />
                  Debitor/Kreditor
                </TabsTrigger>
                <TabsTrigger value="periode" data-testid="tab-periode">
                  <CalendarCheck className="size-3.5 mr-1.5" />
                  Periodeafslutning
                </TabsTrigger>
                <TabsTrigger value="regler" data-testid="tab-regler">
                  <ListChecks className="size-3.5 mr-1.5" />
                  Regnskabsregler
                </TabsTrigger>
                <TabsTrigger value="integrationer" data-testid="tab-integrationer">
                  <Plug className="size-3.5 mr-1.5" />
                  Integrationer
                </TabsTrigger>
                <TabsTrigger value="bilagsindbakke" data-testid="tab-bilagsindbakke">
                  <Inbox className="size-3.5 mr-1.5" />
                  Bilagsindbakke
                </TabsTrigger>
                <TabsTrigger value="lon" data-testid="tab-lon">
                  <Users className="size-3.5 mr-1.5" />
                  Lønbogføring
                </TabsTrigger>
                <TabsTrigger value="anlaeg" data-testid="tab-anlaeg">
                  <Building className="size-3.5 mr-1.5" />
                  Anlægsregister
                </TabsTrigger>
                <TabsTrigger value="budget" data-testid="tab-budget">
                  <TrendingUp className="size-3.5 mr-1.5" />
                  Budget & Prognoser
                </TabsTrigger>
                <TabsTrigger value="omkostning" data-testid="tab-omkostning">
                  <Briefcase className="size-3.5 mr-1.5" />
                  Omkostningssteder
                </TabsTrigger>
                <TabsTrigger value="betaling" data-testid="tab-betaling">
                  <CreditCard className="size-3.5 mr-1.5" />
                  Betalingskørsler
                </TabsTrigger>
                <TabsTrigger value="aarafslutning" data-testid="tab-aarafslutning">
                  <Calendar className="size-3.5 mr-1.5" />
                  Årsafslutning
                </TabsTrigger>
                <TabsTrigger value="revision" data-testid="tab-revision">
                  <ShieldCheck className="size-3.5 mr-1.5" />
                  Revisionsspor
                </TabsTrigger>
                <TabsTrigger value="momsafstemning" data-testid="tab-momsafstemning">
                  <Calculator className="size-3.5 mr-1.5" />
                  Moms-afstemning
                </TabsTrigger>
                <TabsTrigger value="cashflow" data-testid="tab-cashflow">
                  <Wallet className="size-3.5 mr-1.5" />
                  Likviditet & Cashflow
                </TabsTrigger>
                <TabsTrigger value="ai_chef" data-testid="tab-ai-chef">
                  <BrainCircuit className="size-3.5 mr-1.5" />
                  AI Regnskabschef (beta)
                </TabsTrigger>
                <TabsTrigger value="skattekonto" data-testid="tab-skattekonto">
                  <Landmark className="size-3.5 mr-1.5" />
                  Skattekonto
                </TabsTrigger>
              </TabsList>

              {/* ---------- DASHBOARD ---------- */}
              <TabsContent value="dashboard" className="space-y-4">
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
                          placeholder="F.eks. Renserimaskiner ApS"
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
                        <Input id="cc-name" data-testid="input-cc-name" value={costCenterForm.name} onChange={(e) => setCostCenterForm((f) => ({ ...f, name: e.target.value }))} placeholder="Renseri Nord" />
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
              <TabsContent value="platform_sync" className="space-y-4">
                <PlatformSync companyId={effectiveCompanyId} />
              </TabsContent>
              <TabsContent value="sync_mappings" className="space-y-4">
                <SyncMappings companyId={effectiveCompanyId} />
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

            </Tabs>
          )}
        </div>
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

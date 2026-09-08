import { useEffect, useState } from"react";
import { useAuth } from"@/lib/auth";
import { apiRequest, queryClient } from"@/lib/queryClient";
import { useQuery, useMutation } from"@tanstack/react-query";
import { useToast } from"@/hooks/use-toast";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import {
 Card,
 CardHeader,
 CardTitle,
 CardDescription,
 CardContent,
 CardFooter,
} from"@/components/ui/card";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from"@/components/ui/dialog";
import { Skeleton } from"@/components/ui/skeleton";
import { formatCurrency } from"@/App";
import {
 Building2,
 Save,
 Users,
 CreditCard,
 FileText,
 UserPlus,
 AlertTriangle,
 ShieldOff,
 Database,
 Clock,
 Timer,
} from"lucide-react";
import type { Company, User, Plan } from"@shared/schema";

// ── Etiketter ──
const VAT_MODE_LABELS: Record<string, string> = {
 dansk:"Dansk moms",
 eu_omvendt:"EU-omvendt moms",
 eksport_fritaget:"Eksport / fritaget",
 momsfri:"Momsfri",
};

const CURRENCIES = ["DKK","EUR","USD","SEK","NOK"] as const;

const COMPANY_STATUS: Record<string, { label: string; style: string }> = {
 proeve: { label:"Prøveperiode", style:"badge-soft badge-soft-blue" },
 aktiv: { label:"Aktiv", style:"badge-soft badge-soft-green" },
 i_restance: { label:"I restance", style:"badge-soft badge-soft-amber" },
 spaerret: { label:"Spærret", style:"badge-soft badge-soft-red" },
 opsagt: { label:"Opsagt", style:"badge-soft badge-soft-red" },
};

const SUB_STATUS: Record<string, { label: string; style: string }> = {
 proeve: { label:"Prøveperiode", style:"badge-soft badge-soft-blue" },
 aktiv: { label:"Aktivt", style:"badge-soft badge-soft-green" },
 i_restance: { label:"I restance", style:"badge-soft badge-soft-amber" },
 opsagt: { label:"Opsagt", style:"badge-soft badge-soft-red" },
};

const ROLE_LABELS: Record<string, string> = {
 leder:"Leder",
 platform_admin:"Platformadministrator",
};

const BILLING_LABELS: Record<string, string> = {
 maanedlig:"Månedlig",
 aarlig:"Årlig",
};

function dkDate(d?: string | null): string {
 if (!d) return"—";
 const [y, m, day] = d.slice(0, 10).split("-");
 if (!y || !m || !day) return d;
 return `${day}.${m}.${y}`;
}

function retentionText(months: number | null | undefined): string {
 if (months == null) return"—";
 if (months === 0) return"Gem uendeligt";
 return `${months} måneder`;
}

export default function PlatformVirksomhed() {
 const { isPlatformAdmin, company: authCompany, plan: authPlan, subscription: authSub } = useAuth();
 const { toast } = useToast();

 // ── Form-tilstand ──
 const [name, setName] = useState("");
 const [cvr, setCvr] = useState("");
 const [address, setAddress] = useState("");
 const [phone, setPhone] = useState("");
 const [email, setEmail] = useState("");
 const [notes, setNotes] = useState("");

 const [vatRate, setVatRate] = useState("25");
 const [vatMode, setVatMode] = useState("dansk");
 const [currency, setCurrency] = useState("DKK");

 // Betalingsinformation
 const [website, setWebsite] = useState("");
 const [bankName, setBankName] = useState("");
 const [bankAccount, setBankAccount] = useState("");
 const [iban, setIban] = useState("");
 const [swift, setSwift] = useState("");
 const [paymentTerms, setPaymentTerms] = useState("8");
 const [invoiceAddress, setInvoiceAddress] = useState("");

 // Faktura-indstillinger
 const [invoicePrefix, setInvoicePrefix] = useState("FA");
 const [invoiceNextNumber, setInvoiceNextNumber] = useState("1");
 const [offerPrefix, setOfferPrefix] = useState("TI");
 const [offerNextNumber, setOfferNextNumber] = useState("1");
 const [autoApproveInvoices, setAutoApproveInvoices] = useState(false);
 const [autoAddTimeToInvoice, setAutoAddTimeToInvoice] = useState(false);
 const [autoAddMaterialsToInvoice, setAutoAddMaterialsToInvoice] = useState(false);

 // Åbningstider
 const [openingHours, setOpeningHours] = useState<{day:string; open:string; close:string}[]>([]);
 // Timeregistrering
 const [autoBreakMinutes, setAutoBreakMinutes] = useState("30");
 const [workingHoursType, setWorkingHoursType] = useState("interval");
 const [timeReportFrequency, setTimeReportFrequency] = useState("monthly");
 // Faste tekster
 const [invoiceStandardText, setInvoiceStandardText] = useState("");
 const [offerStandardText, setOfferStandardText] = useState("");
 const [reminderStandardText, setReminderStandardText] = useState("");

 // ── Indlæs virksomhedsdata ──
 const { data: company, isLoading } = useQuery<Company>({
 queryKey: ["/api/company"],
 enabled: isPlatformAdmin,
 });

 const { data: users, isLoading: usersLoading } = useQuery<User[]>({
 queryKey: ["/api/users"],
 enabled: isPlatformAdmin,
 });

 const { data: plans } = useQuery<Plan[]>({
 queryKey: ["/api/plans"],
 enabled: isPlatformAdmin,
 });

 // Synkroniser formfelter når data ankommer.
 useEffect(() => {
 if (!company) return;
 setName(company.name ??"");
 setCvr(company.cvr ??"");
 setAddress(company.address ??"");
 setPhone(company.phone ??"");
 setEmail(company.email ??"");
 setNotes(company.notes ??"");
 setVatRate(String(company.vatRate ?? 25));
 setVatMode(company.vatMode ??"dansk");
 setCurrency(company.currency ??"DKK");
 // Betaling
 setWebsite((company as any).website ??"");
 setBankName((company as any).bankName ??"");
 setBankAccount((company as any).bankAccount ??"");
 setIban((company as any).iban ??"");
 setSwift((company as any).swift ??"");
 setPaymentTerms(String((company as any).paymentTerms ?? 8));
 setInvoiceAddress((company as any).invoiceAddress ??"");
 // Faktura
 setInvoicePrefix((company as any).invoicePrefix ??"FA");
 setInvoiceNextNumber(String((company as any).invoiceNextNumber ?? 1));
 setOfferPrefix((company as any).offerPrefix ??"TI");
 setOfferNextNumber(String((company as any).offerNextNumber ?? 1));
 setAutoApproveInvoices(Boolean((company as any).autoApproveInvoices));
 setAutoAddTimeToInvoice(Boolean((company as any).autoAddTimeToInvoice));
 setAutoAddMaterialsToInvoice(Boolean((company as any).autoAddMaterialsToInvoice));
 // Åbningstider
 try {
 const oh = JSON.parse((company as any).openingHours ||"[]");
 setOpeningHours(Array.isArray(oh) && oh.length > 0 ? oh : [
 {day:"mandag",open:"08:00",close:"16:00"},{day:"tirsdag",open:"08:00",close:"16:00"},
 {day:"onsdag",open:"08:00",close:"16:00"},{day:"torsdag",open:"08:00",close:"16:00"},
 {day:"fredag",open:"08:00",close:"16:00"},{day:"lørdag",open:"",close:""},
 {day:"søndag",open:"",close:""}
 ]);
 } catch { setOpeningHours([]); }
 // Tid
 setAutoBreakMinutes(String((company as any).autoBreakMinutes ?? 30));
 setWorkingHoursType((company as any).workingHoursType ??"interval");
 setTimeReportFrequency((company as any).timeReportFrequency ??"monthly");
 // Tekster
 setInvoiceStandardText((company as any).invoiceStandardText ??"");
 setOfferStandardText((company as any).offerStandardText ??"");
 setReminderStandardText((company as any).reminderStandardText ??"");
 }, [company]);

 // ── Mutationer ──
 const updateCompany = useMutation({
 mutationFn: async (data: Partial<Company>) => {
 const res = await apiRequest("PATCH","/api/company", data);
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/company"] });
 queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
 },
 onError: (e: Error) =>
 toast({ title:"Kunne ikke gemme", description: e.message, variant:"destructive" }),
 });

 const handleSaveCompany = () => {
 updateCompany.mutate(
 { name, cvr, address, phone, email, notes },
 {
 onSuccess: () => toast({ title:"Virksomhedsoplysninger gemt" }),
 },
 );
 };

 const handleSaveVat = () => {
 updateCompany.mutate(
 {
 vatRate: Number(vatRate),
 vatMode,
 currency,
 },
 {
 onSuccess: () => toast({ title:"Momsindstillinger gemt" }),
 },
 );
 };

 const handleSavePayment = () => {
 updateCompany.mutate(
 {
 website, bankName, bankAccount, iban, swift,
 paymentTerms: Number(paymentTerms), invoiceAddress,
 } as any,
 {
 onSuccess: () => toast({ title:"Betalingsinformation gemt" }),
 },
 );
 };

 const handleSaveInvoiceSettings = () => {
 updateCompany.mutate(
 {
 invoicePrefix, invoiceNextNumber: Number(invoiceNextNumber),
 offerPrefix, offerNextNumber: Number(offerNextNumber),
 autoApproveInvoices: autoApproveInvoices ? 1 : 0,
 autoAddTimeToInvoice: autoAddTimeToInvoice ? 1 : 0,
 autoAddMaterialsToInvoice: autoAddMaterialsToInvoice ? 1 : 0,
 } as any,
 {
 onSuccess: () => toast({ title:"Faktura-indstillinger gemt" }),
 },
 );
 };

 const handleSaveOpeningHours = () => {
 updateCompany.mutate(
 { openingHours: JSON.stringify(openingHours) } as any,
 { onSuccess: () => toast({ title:"Åbningstider gemt" }) },
 );
 };

 const handleSaveTimeSettings = () => {
 updateCompany.mutate(
 {
 autoBreakMinutes: Number(autoBreakMinutes),
 workingHoursType, timeReportFrequency,
 } as any,
 { onSuccess: () => toast({ title:"Tidsindstillinger gemt" }) },
 );
 };

 const handleSaveStandardTexts = () => {
 updateCompany.mutate(
 { invoiceStandardText, offerStandardText, reminderStandardText } as any,
 { onSuccess: () => toast({ title:"Faste tekster gemt" }) },
 );
 };

 // ── Tilføj bruger dialog ──
 const [addUserOpen, setAddUserOpen] = useState(false);
 const [newUserName, setNewUserName] = useState("");
 const [newUserEmail, setNewUserEmail] = useState("");
 const [newUserRole, setNewUserRole] = useState("leder");
 const [newUserPassword, setNewUserPassword] = useState("");

 const createUser = useMutation({
 mutationFn: async (data: { name: string; email: string; role: string; password: string }) => {
 const res = await apiRequest("POST","/api/users", data);
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/users"] });
 toast({ title:"Bruger oprettet", description: `${newUserName} er tilføjet som ${ROLE_LABELS[newUserRole] ?? newUserRole}.` });
 setAddUserOpen(false);
 setNewUserName("");
 setNewUserEmail("");
 setNewUserRole("leder");
 setNewUserPassword("");
 },
 onError: (e: Error) => {
 let msg ="Kunne ikke oprette bruger.";
 try {
 msg = JSON.parse(e.message).error || msg;
 } catch {
 msg = e.message || msg;
 }
 toast({ title:"Fejl", description: msg, variant:"destructive" });
 },
 });

 // ── Adgangskontrol ──
 if (!isPlatformAdmin) {
 return (
 <div className="p-4 md:p-4 max-w-lg mx-auto">
 <div className="rounded-md border border-border/50 bg-card p-4 text-center space-y-3" data-testid="notice-not-platform-admin">
 <ShieldOff className="w-8 h-8 mx-auto text-muted-foreground" />
 <h1 className="text-lg font-bold text-foreground">Kun for platformadministratorer</h1>
 <p className="text-sm text-muted-foreground">Denne side kræver rollen platformadministrator.</p>
 </div>
 </div>
 );
 }

 if (isLoading) {
 return (
 <div className="p-4 space-y-3 max-w-4xl mx-auto" data-testid="page-loading">
 <Skeleton className="h-8 w-64" />
 <Skeleton className="h-48 rounded-md" />
 <Skeleton className="h-48 rounded-md" />
 <Skeleton className="h-48 rounded-md" />
 </div>
 );
 }

 const status = authCompany?.status
 ? COMPANY_STATUS[authCompany.status] ?? { label: authCompany.status, style:"bg-muted text-muted-foreground" }
 : null;
 const subStatus = authSub?.status
 ? SUB_STATUS[authSub.status] ?? { label: authSub.status, style:"bg-muted text-muted-foreground" }
 : null;
 const activePlan = authPlan ?? (plans && plans.length > 0 ? plans[0] : null);
 const hasSubscription = !!authSub && !!activePlan;

 return (
 <div className="p-4 md:p-4 space-y-5 max-w-4xl mx-auto" data-testid="page-platform-virksomhed">
 {/* Overskrift */}
 <div className="flex items-center gap-2" data-testid="section-header">
 <Building2 className="w-5 h-5 text-primary shrink-0" />
 <div>
 <h1 className="text-lg font-bold text-foreground">Virksomhed</h1>
 <p className="text-sm text-muted-foreground mt-0.5">
 Administrer platformens egne virksomhedsoplysninger, moms, brugere og abonnement
 </p>
 </div>
 </div>

 {/* 1. Virksomhedsoplysninger */}
 <Card data-testid="card-company-info">
 <CardHeader>
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <Building2 className="w-4 h-4 text-muted-foreground" />
 <div>
 <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Virksomhedsoplysninger</CardTitle>
 <CardDescription>Grundlæggende information om ADD SmartRegnskab ApS</CardDescription>
 </div>
 </div>
 {status && (
 <Badge className={status.style} data-testid="badge-company-status">
 {status.label}
 </Badge>
 )}
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="company-name" data-testid="label-name">Navn</Label>
 <Input
 id="company-name"
 data-testid="input-name"
 value={name}
 onChange={(e) => setName(e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="company-cvr" data-testid="label-cvr">CVR-nummer</Label>
 <Input
 id="company-cvr"
 data-testid="input-cvr"
 value={cvr}
 onChange={(e) => setCvr(e.target.value)}
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
 />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="company-phone" data-testid="label-phone">Telefon</Label>
 <Input
 id="company-phone"
 data-testid="input-phone"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="company-email" data-testid="label-email">E-mail</Label>
 <Input
 id="company-email"
 type="email"
 data-testid="input-email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
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
 placeholder="Interne noter om virksomheden"
 />
 </div>
 </CardContent>
 <CardFooter>
 <Button
 data-testid="button-save-company"
 onClick={handleSaveCompany}
 disabled={updateCompany.isPending}
 >
 <Save className="w-4 h-4 mr-2" />
 {updateCompany.isPending ?"Gemmer..." :"Gem ændringer"}
 </Button>
 </CardFooter>
 </Card>

 {/* 2. Moms & Fakturering */}
 <Card data-testid="card-vat">
 <CardHeader>
 <div className="flex items-center gap-2">
 <FileText className="w-4 h-4 text-muted-foreground" />
 <div>
 <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Moms & Fakturering</CardTitle>
 <CardDescription>Indstillinger for moms og valuta på fakturaer</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <div className="space-y-2">
 <Label htmlFor="vat-rate" data-testid="label-vat-rate">Momsats (%)</Label>
 <Input
 id="vat-rate"
 type="number"
 data-testid="input-vat-rate"
 value={vatRate}
 onChange={(e) => setVatRate(e.target.value)}
 min={0}
 max={100}
 step={0.1}
 />
 </div>
 <div className="space-y-2">
 <Label data-testid="label-vat-mode">Momstilstand</Label>
 <Select value={vatMode} onValueChange={setVatMode}>
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
 <Select value={currency} onValueChange={setCurrency}>
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
 </CardContent>
 <CardFooter>
 <Button
 data-testid="button-save-vat"
 onClick={handleSaveVat}
 disabled={updateCompany.isPending}
 >
 <Save className="w-4 h-4 mr-2" />
 {updateCompany.isPending ?"Gemmer..." :"Gem momsindstillinger"}
 </Button>
 </CardFooter>
 </Card>

 {/* 2b. Betalingsinformation */}
 <Card data-testid="card-payment">
 <CardHeader>
 <div className="flex items-center gap-2">
 <CreditCard className="w-4 h-4 text-muted-foreground" />
 <div>
 <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Betalingsinformation</CardTitle>
 <CardDescription>Bankoplysninger og betalingsbetingelser</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="website" data-testid="label-website">Hjemmeside</Label>
 <Input id="website" data-testid="input-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.virksomhed.dk" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="payment-terms" data-testid="label-payment-terms">Betalingsbetingelser (dage)</Label>
 <Input id="payment-terms" type="number" data-testid="input-payment-terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} min={0} />
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="bank-name" data-testid="label-bank-name">Bank</Label>
 <Input id="bank-name" data-testid="input-bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Fx Nordea, Danske Bank" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="bank-account" data-testid="label-bank-account">Kontonummer</Label>
 <Input id="bank-account" data-testid="input-bank-account" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="1234-5678901" />
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="iban" data-testid="label-iban">IBAN</Label>
 <Input id="iban" data-testid="input-iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DK1234..." />
 </div>
 <div className="space-y-2">
 <Label htmlFor="swift" data-testid="label-swift">SWIFT/BIC</Label>
 <Input id="swift" data-testid="input-swift" value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="NDEADKKK" />
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="invoice-address" data-testid="label-invoice-address">Fakturaadresse</Label>
 <Input id="invoice-address" data-testid="input-invoice-address" value={invoiceAddress} onChange={(e) => setInvoiceAddress(e.target.value)} placeholder="Hvis forskellig fra virksomhedsadresse" />
 </div>
 </CardContent>
 <CardFooter>
 <Button data-testid="button-save-payment" onClick={handleSavePayment} disabled={updateCompany.isPending}>
 <Save className="w-4 h-4 mr-2" />
 {updateCompany.isPending ?"Gemmer..." :"Gem betalingsinfo"}
 </Button>
 </CardFooter>
 </Card>

 {/* 2c. Faktura-indstillinger */}
 <Card data-testid="card-invoice-settings">
 <CardHeader>
 <div className="flex items-center gap-2">
 <FileText className="w-4 h-4 text-muted-foreground" />
 <div>
 <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faktura-indstillinger</CardTitle>
 <CardDescription>Nummerserier og automatisering</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="invoice-prefix" data-testid="label-invoice-prefix">Faktura-præfiks</Label>
 <Input id="invoice-prefix" data-testid="input-invoice-prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="FA" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="invoice-next" data-testid="label-invoice-next">Næste fakturanummer</Label>
 <Input id="invoice-next" type="number" data-testid="input-invoice-next" value={invoiceNextNumber} onChange={(e) => setInvoiceNextNumber(e.target.value)} min={1} />
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="offer-prefix" data-testid="label-offer-prefix">Tilbud-præfiks</Label>
 <Input id="offer-prefix" data-testid="input-offer-prefix" value={offerPrefix} onChange={(e) => setOfferPrefix(e.target.value)} placeholder="TI" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="offer-next" data-testid="label-offer-next">Næste tilbudnummer</Label>
 <Input id="offer-next" type="number" data-testid="input-offer-next" value={offerNextNumber} onChange={(e) => setOfferNextNumber(e.target.value)} min={1} />
 </div>
 </div>
 <div className="space-y-3 pt-2 border-t border-border">
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" data-testid="checkbox-auto-approve" checked={autoApproveInvoices} onChange={(e) => setAutoApproveInvoices(e.target.checked)} className="h-4 w-4 rounded border-border" />
 <span className="text-sm text-foreground">Godkend automatisk elektroniske fakturaer</span>
 </label>
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" data-testid="checkbox-auto-time" checked={autoAddTimeToInvoice} onChange={(e) => setAutoAddTimeToInvoice(e.target.checked)} className="h-4 w-4 rounded border-border" />
 <span className="text-sm text-foreground">Tilføj automatisk timer til fakturakladde</span>
 </label>
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" data-testid="checkbox-auto-materials" checked={autoAddMaterialsToInvoice} onChange={(e) => setAutoAddMaterialsToInvoice(e.target.checked)} className="h-4 w-4 rounded border-border" />
 <span className="text-sm text-foreground">Tilføj automatisk materialer til fakturakladde</span>
 </label>
 </div>
 </CardContent>
 <CardFooter>
 <Button data-testid="button-save-invoice-settings" onClick={handleSaveInvoiceSettings} disabled={updateCompany.isPending}>
 <Save className="w-4 h-4 mr-2" />
 {updateCompany.isPending ?"Gemmer..." :"Gem indstillinger"}
 </Button>
 </CardFooter>
 </Card>

 {/* 3. Brugerstyring */}
 <Card data-testid="card-users">
 <CardHeader>
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <Users className="w-4 h-4 text-muted-foreground" />
 <div>
 <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brugerstyring</CardTitle>
 <CardDescription>Oversigt over platformbrugere</CardDescription>
 </div>
 </div>
 <Button variant="outline" size="sm" data-testid="button-add-user" onClick={() => setAddUserOpen(true)}>
 <UserPlus className="w-4 h-4 mr-2" />
 Tilføj bruger
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 {usersLoading ? (
 <div className="space-y-2" data-testid="users-loading">
 {Array.from({ length: 3 }).map((_, i) => (
 <Skeleton key={i} className="h-12 w-full" />
 ))}
 </div>
 ) : !users || users.length === 0 ? (
 <div className="text-sm text-muted-foreground py-4" data-testid="users-empty">
 Ingen brugere fundet.
 </div>
 ) : (
 <div className="flex flex-col gap-2" data-testid="users-list">
 {users.map((u) => (
 <div
 key={u.id}
 data-testid={`user-row-${u.id}`}
 className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
 >
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium truncate" data-testid={`user-name-${u.id}`}>{u.name}</p>
 <p className="text-xs text-muted-foreground truncate" data-testid={`user-email-${u.id}`}>{u.email}</p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <Badge variant="secondary" data-testid={`user-role-${u.id}`}>
 {ROLE_LABELS[u.role] ?? u.role}
 </Badge>
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
 </CardContent>
 </Card>

 {/* 4. Farezone */}
 <Card data-testid="card-danger-zone" className="border-destructive/30">
 <CardHeader>
 <div className="flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-destructive" />
 <div>
 <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Farezone</CardTitle>
 <CardDescription>Virksomhedens status (read-only)</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center gap-2" data-testid="danger-zone-status">
 <span className="text-sm text-muted-foreground">Virksomhedsstatus:</span>
 {status ? (
 <Badge className={status.style} data-testid="badge-danger-status">{status.label}</Badge>
 ) : (
 <span className="text-sm">—</span>
 )}
 </div>
 <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="danger-zone-info">
 Platform-admin kan ikke ændre sin egen virksomhedsstatus. Status styres af platformen.
 </div>
 </CardContent>
 </Card>

 {/* Tilføj bruger dialog */}
 <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
 <DialogContent className="max-w-md" data-testid="dialog-add-user">
 <DialogHeader>
 <DialogTitle className="text-lg">Tilføj bruger</DialogTitle>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div className="space-y-2">
 <Label htmlFor="new-user-name" data-testid="label-new-user-name">Navn</Label>
 <Input
 id="new-user-name"
 data-testid="input-new-user-name"
 value={newUserName}
 onChange={(e) => setNewUserName(e.target.value)}
 placeholder="Fx Mette Hansen"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="new-user-email" data-testid="label-new-user-email">E-mail</Label>
 <Input
 id="new-user-email"
 type="email"
 data-testid="input-new-user-email"
 value={newUserEmail}
 onChange={(e) => setNewUserEmail(e.target.value)}
 placeholder="navn@smartdrift.dk"
 />
 </div>
 <div className="space-y-2">
 <Label data-testid="label-new-user-role">Rolle</Label>
 <Select value={newUserRole} onValueChange={setNewUserRole}>
 <SelectTrigger data-testid="select-new-user-role">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="platform_admin" data-testid="option-role-platform_admin">Platformadministrator</SelectItem>
 <SelectItem value="leder" data-testid="option-role-leder">Leder</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="new-user-password" data-testid="label-new-user-password">Adgangskode (min. 8 tegn)</Label>
 <Input
 id="new-user-password"
 type="password"
 data-testid="input-new-user-password"
 value={newUserPassword}
 onChange={(e) => setNewUserPassword(e.target.value)}
 placeholder="Mindst 8 tegn"
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setAddUserOpen(false)} data-testid="button-cancel-add-user">
 Annuller
 </Button>
 <Button
 data-testid="button-confirm-add-user"
 disabled={createUser.isPending || !newUserName || !newUserEmail || !newUserPassword || newUserPassword.length < 8}
 onClick={() =>
 createUser.mutate({
 name: newUserName,
 email: newUserEmail,
 role: newUserRole,
 password: newUserPassword,
 })
 }
 >
 {createUser.isPending ?"Opretter..." :"Opret bruger"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}

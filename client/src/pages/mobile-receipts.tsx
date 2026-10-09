import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, ArrowLeft, Building2, Camera, CheckCircle2, FileText,
  Loader2, LogOut, RefreshCw, ShieldCheck, Sparkles, Upload, WifiOff,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { getNetworkStatus, hapticError, hapticSuccess, onNetworkChange, takePhoto } from "@/lib/native-bridge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LegalCompany = { id: number; name: string; cvr?: string | null };
type Organization = { activeCompanyId: number; companies: LegalCompany[] };
type DocumentSettings = {
  address: string | null;
  emailReady: boolean;
  emailPilot: boolean;
  manualApprovalRequired: boolean;
  payablesAccountId: number | null;
  inputVatAccountId: number | null;
};
type InboxDocument = {
  id: number;
  fileName: string;
  fileType?: string | null;
  supplier?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
  suggestedAccount?: string | null;
  ocrStatus: "afventer" | "behandlet" | "fejlet" | string;
  status: string;
  postedJournalEntryId?: number | null;
  createdAt: string;
};
type PendingFile = { fileName: string; dataUrl: string; sizeBytes: number; kind: "camera" | "file" };

const MAX_BYTES = 7 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);

function dataUrlBytes(value: string) {
  const comma = value.indexOf(",");
  return comma < 0 ? 0 : Math.ceil((value.length - comma - 1) * 3 / 4);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Filen kunne ikke læses."));
    reader.readAsDataURL(file);
  });
}

function money(value?: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(value);
}

function statusFor(document: InboxDocument) {
  if (document.postedJournalEntryId || document.status === "behandlet") {
    return { label: "Bogført", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }
  if (document.ocrStatus === "fejlet") {
    return { label: "Manuel kontrol", className: "bg-red-100 text-red-800 border-red-200" };
  }
  if (document.ocrStatus === "behandlet") {
    return { label: "Klar til godkendelse", className: "bg-amber-100 text-amber-900 border-amber-200" };
  }
  return { label: "AI læser bilaget", className: "bg-blue-100 text-blue-800 border-blue-200" };
}

export default function MobileReceipts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, company, switchCompany, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [review, setReview] = useState<InboxDocument | null>(null);

  useEffect(() => {
    getNetworkStatus().then((value) => setOnline(value.connected));
    return onNetworkChange(setOnline);
  }, []);

  const organization = useQuery<Organization>({
    queryKey: ["/api/organization", "mobile"],
    queryFn: async () => (await apiRequest("GET", "/api/organization")).json(),
  });
  const settings = useQuery<DocumentSettings>({
    queryKey: ["/api/document-receiving/settings", "mobile"],
    queryFn: async () => (await apiRequest("GET", "/api/document-receiving/settings")).json(),
  });
  const inbox = useQuery<InboxDocument[]>({
    queryKey: ["/api/document-inbox", "mobile"],
    queryFn: async () => (await apiRequest("GET", "/api/document-inbox")).json(),
    refetchInterval: (query) => (query.state.data as InboxDocument[] | undefined)?.some((item) => item.ocrStatus === "afventer") ? 5_000 : false,
  });

  const documents = useMemo(() => [...(inbox.data ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30), [inbox.data]);
  // Matcher backendens rollekrav præcist; andre roller kan uploade og kontrollere,
  // men kan ikke få vist en handling som serveren efterfølgende vil afvise.
  const canApprove = user?.role === "leder";

  const upload = useMutation({
    mutationFn: async (file: PendingFile) => {
      if (!online) throw new Error("Telefonen er offline. Forbind til internettet og prøv igen.");
      setUploadProgress(35);
      const response = await apiRequest("POST", "/api/document-receiving/upload", {
        fileName: file.fileName,
        dataUrl: file.dataUrl,
      });
      setUploadProgress(90);
      return response.json() as Promise<{ id: number; duplicate: boolean }>;
    },
    onSuccess: async (result) => {
      setUploadProgress(100);
      await qc.invalidateQueries({ queryKey: ["/api/document-inbox"] });
      await hapticSuccess();
      toast({
        title: result.duplicate ? "Bilaget fandtes allerede" : "Bilaget er modtaget",
        description: result.duplicate ? "Vi har ikke gemt en ekstra kopi." : "Originalen er gemt, og AI-forslaget er klar til menneskelig kontrol.",
      });
      window.setTimeout(() => { setPending(null); setUploadProgress(0); }, 350);
    },
    onError: async (error: Error) => {
      setUploadProgress(0);
      await hapticError();
      toast({ title: "Upload fejlede", description: error.message, variant: "destructive" });
    },
  });

  const processAgain = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/document-receiving/${id}/process`, {})).json(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/document-inbox"] });
      toast({ title: "AI-kontrollen er kørt igen" });
    },
    onError: (error: Error) => toast({ title: "Kunne ikke analysere bilaget", description: error.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/document-receiving/${id}/approve`, {})).json(),
    onSuccess: async () => {
      setReview(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/document-inbox"] }),
        qc.invalidateQueries({ queryKey: ["/api/vouchers"] }),
        qc.invalidateQueries({ queryKey: ["/api/journal-entries"] }),
      ]);
      await hapticSuccess();
      toast({ title: "Bilaget er godkendt og bogført", description: "Godkendelsen er registreret i revisionssporet." });
    },
    onError: async (error: Error) => {
      await hapticError();
      toast({ title: "Bilaget kunne ikke bogføres", description: error.message, variant: "destructive" });
    },
  });

  const chooseCamera = async () => {
    const dataUrl = await takePhoto("high");
    if (!dataUrl) return;
    const sizeBytes = dataUrlBytes(dataUrl);
    if (sizeBytes > MAX_BYTES) {
      toast({ title: "Fotoet er for stort", description: "Tag fotoet igen i lavere kvalitet. Maksimum er 7 MB.", variant: "destructive" });
      return;
    }
    setPending({ fileName: `bilag-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, dataUrl, sizeBytes, kind: "camera" });
    setUploadProgress(10);
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      toast({ title: "Filtypen understøttes ikke", description: "Vælg PDF, JPG, PNG, WebP eller GIF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Filen er for stor", description: "Maksimum er 7 MB.", variant: "destructive" });
      return;
    }
    setPending({ fileName: file.name, dataUrl: await readAsDataUrl(file), sizeBytes: file.size, kind: "file" });
    setUploadProgress(10);
    if (inputRef.current) inputRef.current.value = "";
  };

  const changeCompany = async (companyId: string) => {
    try {
      await switchCompany(Number(companyId));
      await qc.invalidateQueries();
      setPending(null);
      toast({ title: "Virksomheden er skiftet", description: "Nye bilag gemmes nu i det valgte regnskab." });
    } catch (error) {
      toast({ title: "Kunne ikke skifte virksomhed", description: error instanceof Error ? error.message : "Ukendt fejl", variant: "destructive" });
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-200">ADD SmartRegnskab</p>
            <h1 className="truncate text-lg font-semibold">Bilagsapp</h1>
          </div>
          <div className="flex gap-1">
            <Button aria-label="Åbn hele regnskabet" size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => { window.location.hash = "#/smartregnskab/app/bilagsindbakke"; }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button aria-label="Log ud" size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => logout()}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        {!online && <Alert variant="destructive"><WifiOff className="h-4 w-4"/><AlertTitle>Ingen internetforbindelse</AlertTitle><AlertDescription>Bilaget bliver ikke sendt, før forbindelsen er tilbage.</AlertDescription></Alert>}

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-emerald-700"/>Vælg virksomhed</CardTitle>
            <CardDescription>Bilaget gemmes kun i det valgte selskabs regnskab.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={String(organization.data?.activeCompanyId ?? company?.id ?? "")} onValueChange={changeCompany} disabled={organization.isLoading || upload.isPending}>
              <SelectTrigger className="h-12 bg-white dark:bg-slate-900" aria-label="Aktiv virksomhed"><SelectValue placeholder="Indlæser virksomheder…"/></SelectTrigger>
              <SelectContent>{organization.data?.companies.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}{item.cvr ? ` · CVR ${item.cvr}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nyt bilag</CardTitle>
            <CardDescription>Tag et tydeligt foto eller vælg en PDF/billedfil. Maks. 7 MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pending ? <div className="grid grid-cols-2 gap-3">
              <Button className="h-28 flex-col gap-2 bg-emerald-700 text-base hover:bg-emerald-800" onClick={chooseCamera} disabled={!online}>
                <Camera className="h-7 w-7"/>Tag foto
              </Button>
              <Button className="h-28 flex-col gap-2 text-base" variant="outline" onClick={() => inputRef.current?.click()} disabled={!online}>
                <Upload className="h-7 w-7"/>Vælg fil
              </Button>
              <input ref={inputRef} className="hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => chooseFile(event.target.files?.[0])}/>
            </div> : <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3 dark:bg-slate-900">
                {pending.dataUrl.startsWith("data:image/") ? <img src={pending.dataUrl} alt="Forhåndsvisning af bilag" className="h-20 w-20 rounded-lg object-cover"/> : <div className="grid h-20 w-20 place-items-center rounded-lg bg-red-50 text-red-700"><FileText className="h-8 w-8"/></div>}
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{pending.fileName}</p><p className="text-xs text-muted-foreground">{(pending.sizeBytes / 1024 / 1024).toFixed(2)} MB · {pending.kind === "camera" ? "Kamera" : "Fil"}</p></div>
              </div>
              {uploadProgress > 0 && <div className="space-y-1"><Progress value={uploadProgress}/><p className="text-center text-xs text-muted-foreground">{upload.isPending ? "Gemmer original og analyserer med AI…" : "Klar til sikker upload"}</p></div>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => { setPending(null); setUploadProgress(0); }} disabled={upload.isPending}>Vælg om</Button>
                <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => upload.mutate(pending)} disabled={upload.isPending || !online}>{upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}Send bilag</Button>
              </div>
            </div>}
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/>Kamerabilledet gemmes ikke i telefonens galleri. Originalen opbevares privat pr. virksomhed og omfattes af regnskabets sikkerhedskopi og opbevaringspolitik.</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div><CardTitle className="text-base">Seneste bilag</CardTitle><CardDescription>AI foreslår. Et menneske godkender altid.</CardDescription></div>
              <Button aria-label="Opdater bilagslisten" size="icon" variant="ghost" onClick={() => inbox.refetch()} disabled={inbox.isFetching}><RefreshCw className={`h-4 w-4 ${inbox.isFetching ? "animate-spin" : ""}`}/></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {inbox.isLoading && <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-700"/></div>}
            {!inbox.isLoading && documents.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center"><FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground"/><p className="font-medium">Ingen bilag endnu</p><p className="mt-1 text-sm text-muted-foreground">Tag det første foto ovenfor.</p></div>}
            {documents.map((document) => {
              const status = statusFor(document);
              return <article key={document.id} className="space-y-3 rounded-xl border bg-white p-3 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{document.supplier || document.fileName}</p><p className="text-xs text-muted-foreground">{document.invoiceDate || new Date(document.createdAt).toLocaleDateString("da-DK")}{document.invoiceNumber ? ` · ${document.invoiceNumber}` : ""}</p></div><Badge variant="outline" className={status.className}>{status.label}</Badge></div>
                {document.ocrStatus === "behandlet" && !document.postedJournalEntryId && <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-950"><div><span className="block text-muted-foreground">Beløb</span><strong>{money(document.amount)}</strong></div><div><span className="block text-muted-foreground">Moms</span><strong>{money(document.vatAmount)}</strong></div><div><span className="block text-muted-foreground">Konto</span><strong>{document.suggestedAccount || "Kontrollér"}</strong></div></div>}
                {document.ocrStatus === "afventer" && <p className="flex items-center gap-2 text-xs text-blue-700"><Loader2 className="h-3.5 w-3.5 animate-spin"/>AI læser filen. Opdateringen kommer automatisk.</p>}
                {document.ocrStatus === "fejlet" && <div className="flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs text-red-700"><AlertCircle className="h-3.5 w-3.5"/>AI kunne ikke færdiggøre forslaget. Originalen er gemt til manuel kontrol.</p><Button size="sm" variant="outline" onClick={() => processAgain.mutate(document.id)} disabled={processAgain.isPending}><Sparkles className="mr-1.5 h-3.5 w-3.5"/>Prøv AI igen</Button></div>}
                {document.ocrStatus === "behandlet" && !document.postedJournalEntryId && canApprove && <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => setReview(document)}><CheckCircle2 className="mr-2 h-4 w-4"/>Kontrollér og godkend</Button>}
              </article>;
            })}
          </CardContent>
        </Card>

        {settings.data?.address && <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Bilag via e-mail</CardTitle><CardDescription>Hver virksomhed har sin egen adresse.</CardDescription></CardHeader><CardContent><p className="break-all rounded-lg bg-slate-100 p-3 font-mono text-xs dark:bg-slate-900">{settings.data.address}</p></CardContent></Card>}
      </div>

      <Dialog open={!!review} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-md">
          <DialogHeader><DialogTitle>Godkend leverandørbilag</DialogTitle></DialogHeader>
          {review && <div className="space-y-3 text-sm">
            <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Din kontrol er nødvendig</AlertTitle><AlertDescription>Kontrollér leverandør, dato, fakturanummer, beløb, moms og konto. AI bogfører ikke uden din godkendelse.</AlertDescription></Alert>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg border p-3">
              <dt className="text-muted-foreground">Leverandør</dt><dd className="text-right font-medium">{review.supplier || "Ikke fundet"}</dd>
              <dt className="text-muted-foreground">Dato</dt><dd className="text-right font-medium">{review.invoiceDate || "Ikke fundet"}</dd>
              <dt className="text-muted-foreground">Fakturanummer</dt><dd className="text-right font-medium">{review.invoiceNumber || "Ikke fundet"}</dd>
              <dt className="text-muted-foreground">Beløb</dt><dd className="text-right font-medium">{money(review.amount)}</dd>
              <dt className="text-muted-foreground">Moms</dt><dd className="text-right font-medium">{money(review.vatAmount)}</dd>
              <dt className="text-muted-foreground">Udgiftskonto</dt><dd className="text-right font-medium">{review.suggestedAccount || "Ikke fundet"}</dd>
            </dl>
            {(!settings.data?.payablesAccountId || !settings.data?.inputVatAccountId) && <p className="text-xs text-amber-800">Kreditor- og købsmomskonto skal først vælges i den fulde bilagsindbakke.</p>}
          </div>}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => setReview(null)}>Tilbage</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={!review || approve.isPending || !settings.data?.payablesAccountId || (Number(review?.vatAmount || 0) > 0 && !settings.data?.inputVatAccountId)} onClick={() => review && approve.mutate(review.id)}>{approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Godkend og bogfør</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

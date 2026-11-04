import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, ExternalLink, FileCheck2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VatApiStatus = {
  configured: boolean;
  environment: string;
  certificateConfigured: boolean;
  providerCvrConfigured: boolean;
  humanApprovalRequired: boolean;
};

type DraftResult = {
  providerTransactionId: string;
  deepLink: string;
  requiresFinalApproval: true;
};

const currentQuarter = () => {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const from = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth + 3, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
};

export default function MomsApi() {
  const initial = useMemo(currentQuarter, []);
  const [periodFrom, setPeriodFrom] = useState(initial.from);
  const [periodTo, setPeriodTo] = useState(initial.to);
  const [salesVat, setSalesVat] = useState("0");
  const [purchaseVat, setPurchaseVat] = useState("0");
  const [netVat, setNetVat] = useState("0");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"calendar" | "draft" | "receipt" | null>(null);
  const [calendar, setCalendar] = useState<unknown>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [receiptReady, setReceiptReady] = useState(false);
  const { toast } = useToast();
  const status = useQuery<VatApiStatus>({ queryKey: ["/api/vat-api/status"] });

  async function loadCalendar() {
    setBusy("calendar");
    try {
      const response = await apiRequest("POST", "/api/vat-api/calendar", { from: periodFrom, to: periodTo });
      setCalendar(await response.json());
      toast({ title: "Momsfrister hentet", description: "Perioder og frister er hentet direkte fra Skattestyrelsen." });
    } catch (error: any) {
      toast({ title: "Momsfrister kunne ikke hentes", description: error.message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  async function createDraft() {
    if (!confirmed) return;
    setBusy("draft");
    try {
      const response = await apiRequest("POST", "/api/vat-api/draft", {
        periodFrom,
        periodTo,
        confirmation: "OPRET_MOMSKLADDE",
        amounts: {
          MomsAngivelseAfgiftTilsvarBeloeb: Number(netVat),
          MomsAngivelseKoebsMomsBeloeb: Number(purchaseVat),
          MomsAngivelseSalgsMomsBeloeb: Number(salesVat),
        },
      });
      const result = await response.json() as DraftResult;
      setDraft(result);
      setReceiptReady(false);
      toast({ title: "Momsudkast oprettet", description: "Tallene er ikke indberettet endnu. Virksomheden skal godkende dem i TastSelv." });
    } catch (error: any) {
      toast({ title: "Momsudkast kunne ikke oprettes", description: error.message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  async function fetchReceipt() {
    if (!draft?.providerTransactionId) return;
    setBusy("receipt");
    try {
      const response = await apiRequest("POST", "/api/vat-api/receipt", { providerTransactionId: draft.providerTransactionId });
      const result = await response.json() as { received: boolean; receiptBase64?: string | null };
      setReceiptReady(result.received);
      if (result.receiptBase64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${result.receiptBase64}`;
        link.download = `moms-kvittering-${periodFrom}-${periodTo}.pdf`;
        link.click();
      }
      toast({
        title: result.received ? "Kvittering modtaget" : "Afventer godkendelse",
        description: result.received ? "Kvitteringen er hentet fra Skattestyrelsen." : "Godkend først momsudkastet i TastSelv, og prøv derefter igen.",
      });
    } catch (error: any) {
      toast({ title: "Kvittering kunne ikke hentes", description: error.message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  const usable = Boolean(status.data?.configured);
  return <Card data-testid="skat-moms-api">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4" />Moms API til TastSelv</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {status.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : usable ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Forbindelsen til Skattestyrelsens {status.data?.environment === "production" ? "produktionsmiljø" : "testmiljø"} er konfigureret. Endelig indberetning kræver altid virksomhedens godkendelse i TastSelv.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Afventer Skattestyrelsens testendpoints og OCES3-certifikat. Funktionen er låst, så der ikke kan sendes momsdata til en ukonfigureret tjeneste.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="moms-api-from">Periode fra</Label><Input id="moms-api-from" type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></div>
        <div><Label htmlFor="moms-api-to">Periode til</Label><Input id="moms-api-to" type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></div>
        <div><Label htmlFor="moms-api-sales">Salgsmoms</Label><Input id="moms-api-sales" inputMode="decimal" value={salesVat} onChange={(event) => setSalesVat(event.target.value)} /></div>
        <div><Label htmlFor="moms-api-purchase">Købsmoms</Label><Input id="moms-api-purchase" inputMode="decimal" value={purchaseVat} onChange={(event) => setPurchaseVat(event.target.value)} /></div>
        <div><Label htmlFor="moms-api-net">Moms i alt</Label><Input id="moms-api-net" inputMode="decimal" value={netVat} onChange={(event) => setNetVat(event.target.value)} /></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!usable || busy !== null} onClick={loadCalendar}>
          {busy === "calendar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}Hent frister
        </Button>
      </div>
      {calendar != null && <p className="text-xs text-muted-foreground">Momsperioderne er hentet fra Skattestyrelsen og registreret i revisionssporet.</p>}

      <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
        <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
        <span>Jeg har kontrolleret momsafstemningen og godkender, at der oprettes en <strong>kladde</strong> hos Skattestyrelsen. Kladden bliver først indberettet efter særskilt login og godkendelse i TastSelv.</span>
      </label>
      <Button disabled={!usable || !confirmed || busy !== null} onClick={createDraft}>
        {busy === "draft" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opret momsudkast
      </Button>

      {draft && <div className="space-y-3 rounded-lg border p-3 text-sm">
        <p className="font-medium">Udkastet er oprettet, men ikke indberettet.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.location.assign(draft.deepLink)}><ExternalLink className="mr-2 h-4 w-4" />Godkend i TastSelv</Button>
          <Button variant="outline" disabled={busy !== null} onClick={fetchReceipt}>{busy === "receipt" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hent kvittering</Button>
        </div>
        {receiptReady && <p className="text-emerald-700">Kvitteringen er modtaget og kan dokumentere indberetningen.</p>}
      </div>}
    </CardContent>
  </Card>;
}

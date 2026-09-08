import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, apiUrl, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";

type Status = { ready: boolean; version: string; standardAccountVersion: string; errors: string[]; unmappedAccounts: number };
type Preview = { version: string; accounts: unknown[]; entries: unknown[]; totalDebit: number; totalCredit: number; errors: string[] };
type Account = { id: number; accountNumber: string; name: string; standardAccountNumber: string | null; active: number };

const auth = () => ({ Authorization: `Bearer ${getAuthToken() || ""}` });

export default function Saft() {
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const { toast } = useToast();
  const status = useQuery<Status>({ queryKey: ["/api/saft/status"] });
  const accounts = useQuery<Account[]>({ queryKey: ["/api/saft/accounts"] });

  async function saveMapping(account: Account) {
    setBusy(true);
    try {
      await apiRequest("PATCH", `/api/saft/accounts/${account.id}`, { standardAccountNumber: mapping[account.id] ?? account.standardAccountNumber ?? "" });
      await Promise.all([accounts.refetch(), status.refetch()]);
      toast({ title: "Kontomapping gemt" });
    } catch (error: any) { toast({ title: "Mapping kunne ikke gemmes", description: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function download() {
    setBusy(true);
    try {
      const response = await fetch(apiUrl(`/api/saft/export?from=${from}&to=${to}`), { headers: auth() });
      if (!response.ok) throw new Error((await response.json()).error || "SAF-T-eksport fejlede.");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "SAF-T.xml";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
    } catch (error: any) { toast({ title: "Eksport fejlede", description: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function sendImport(commit: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const xml = await file.text();
      const response = await fetch(apiUrl(commit ? "/api/saft/import" : "/api/saft/import/preview"), { method: "POST", headers: { ...auth(), "Content-Type": "application/xml" }, body: xml });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "SAF-T-import fejlede.");
      if (commit) {
        toast({ title: "SAF-T importeret", description: `${result.accountsCreated} konti og ${result.entriesCreated} posteringer oprettet.` });
        setPreview(null); setFile(null); await status.refetch();
      } else setPreview(result);
    } catch (error: any) { toast({ title: "Import fejlede", description: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <div>
      <h2 className="text-xl font-semibold">SAF-T 2.1</h2>
      <p className="text-sm text-muted-foreground">Importér og eksportér bogføringsdata i Erhvervsstyrelsens danske standardformat.</p>
    </div>
    <Card><CardHeader><CardTitle className="text-base">Klarhedskontrol</CardTitle></CardHeader><CardContent className="space-y-3">
      {status.isLoading ? <Loader2 className="animate-spin" /> : status.data?.ready ? <p className="flex gap-2 text-emerald-700"><CheckCircle2 className="w-5 h-5" /> Klar til SAF-T {status.data.version}</p> : <div className="space-y-2 text-amber-700"><p className="flex gap-2"><AlertTriangle className="w-5 h-5" /> Følgende skal rettes før eksport:</p><ul className="list-disc pl-6">{status.data?.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <p className="text-xs text-muted-foreground">Standardkontoplan: {status.data?.standardAccountVersion || "—"}. Konti uden offentlig mapping: {status.data?.unmappedAccounts ?? "—"}.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Eksport</CardTitle></CardHeader><CardContent className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Fra<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="text-sm">Til<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <Button onClick={download} disabled={busy || !status.data?.ready}><Download className="w-4 h-4 mr-2" />Hent SAF-T XML</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Mapping til offentlig standardkontoplan</CardTitle></CardHeader><CardContent className="space-y-2">
      {accounts.data?.map((account) => <div key={account.id} className="grid grid-cols-[90px_1fr_120px_auto] items-center gap-2 text-sm">
        <span>{account.accountNumber}</span><span className="truncate">{account.name}</span>
        <Input aria-label={`Standardkonto for ${account.accountNumber}`} maxLength={4} value={mapping[account.id] ?? account.standardAccountNumber ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [account.id]: event.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="4 cifre" />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => saveMapping(account)}>Gem</Button>
      </div>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Import</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input type="file" accept=".xml,application/xml,text/xml" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} />
      <Button variant="outline" disabled={!file || busy} onClick={() => sendImport(false)}><Upload className="w-4 h-4 mr-2" />Kontrollér fil</Button>
      {preview && <div className="rounded-md border p-3 text-sm space-y-2"><p>Version {preview.version}: {preview.accounts.length} konti og {preview.entries.length} posteringer. Debet {preview.totalDebit.toFixed(2)} / kredit {preview.totalCredit.toFixed(2)}.</p>{preview.errors.length ? <ul className="list-disc pl-6 text-destructive">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <Button disabled={busy} onClick={() => sendImport(true)}>Godkend og importér</Button>}</div>}
    </CardContent></Card>
  </div>;
}

import QRCode from "qrcode";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Clipboard, KeyRound, Lock, LockKeyhole, MailCheck, MapPin, ShieldCheck, ShieldX, Clock, Users } from "lucide-react";
import type { Consent, LoginAttempt, Employee } from "@shared/schema";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { PageHeader, SectionCard } from "@/components/premium";

type SecurityData = { twoFactorEnabled: boolean; emailVerified: boolean; backupCodesLeft: number; lastLoginAt: string | null; passwordChangedAt: string | null; recentAttempts: LoginAttempt[]; krypteringAdvarsel: string | null };
const REASONS: Record<string, string> = { forkert_kode: "Forkert adgangskode", deaktiveret: "Kontoen er deaktiveret", forkert_to_faktor: "Forkert engangskode", abonnement_spaerret: "Abonnement spærret" };
function date(value?: string | null) { return value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

export default function Sikkerhed() {
  const { user, companyId, refresh } = useAuth(); const { toast } = useToast();
  const [setup, setSetup] = useState<{ secret: string; uri: string; vejledning: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null); const [disableOpen, setDisableOpen] = useState(false); const [backupOpen, setBackupOpen] = useState(false);
  const { data, isLoading } = useQuery<SecurityData>({ queryKey: ["/api/security", companyId], queryFn: async () => (await apiRequest("GET", "/api/security")).json() });
  const { data: consentData } = useQuery<{ consents: Consent[] }>({ queryKey: ["/api/samtykke", companyId], queryFn: async () => (await apiRequest("GET", "/api/samtykke")).json() });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["/api/security"] }); queryClient.invalidateQueries({ queryKey: ["/api/samtykke"] }); };
  const start = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/security/2fa/start")).json(), onSuccess: setSetup, onError: (e: Error) => toast({ title: "Kunne ikke starte to-faktor", description: e.message, variant: "destructive" }) });
  const enable = useMutation({ mutationFn: async (code: string) => (await apiRequest("POST", "/api/security/2fa/enable", { code })).json(), onSuccess: (result: { backupCodes: string[] }) => { setSetup(null); setBackupCodes(result.backupCodes); invalidate(); }, onError: (e: Error) => toast({ title: "Kunne ikke slå to-faktor til", description: e.message, variant: "destructive" }) });
  const resend = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/auth/verify/resend", { email: user?.email })).json(), onSuccess: (result) => { toast({ title: "Bekræftelse sendt", description: result.message }); if (result.demoToken) setDemoToken(result.demoToken); }, onError: (e: Error) => toast({ title: "Kunne ikke sende bekræftelse", description: e.message, variant: "destructive" }) });
  const consent = useMutation({ mutationFn: async ({ kind, granted }: { kind: string; granted: boolean }) => (await apiRequest("POST", "/api/samtykke", { kind, granted })).json(), onSuccess: () => { invalidate(); toast({ title: "Samtykke er opdateret" }); }, onError: (e: Error) => toast({ title: "Kunne ikke opdatere samtykke", description: e.message, variant: "destructive" }) });
  const [demoToken, setDemoToken] = useState<string | null>(null);
  if (isLoading || !data) return <Loading />;
  const allowed = (kind: string) => consentData?.consents.find((row) => row.kind === kind)?.granted === 1;
  return <div className="p-3 md:p-4 space-y-3 max-w-6xl mx-auto">
    <PageHeader eyebrow="Sikkerhed" title="Sikkerhed" description="Sikkerhedsindstillinger og 2FA" />
    {data.krypteringAdvarsel && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2" data-testid="card-encryption-warning"><AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" /><p className="text-xs text-amber-800 dark:text-amber-300">{data.krypteringAdvarsel}</p></div>}
    <SectionCard data-testid="card-security-status" title="Kontostatus" icon={<Lock className="w-4 h-4" />} className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><Stat label="To-faktor" value={data.twoFactorEnabled ? "Slået til" : "Slået fra"} good={data.twoFactorEnabled} /><Stat label="E-mail" value={data.emailVerified ? "Bekræftet" : "Ikke bekræftet"} good={data.emailVerified} /><Stat label="Reservekoder" value={`${data.backupCodesLeft} tilbage`} good={data.backupCodesLeft > 0} /><Stat label="Seneste login" value={date(data.lastLoginAt)} /></div><p className="text-[11px] text-muted-foreground">Adgangskode senest skiftet: {date(data.passwordChangedAt)}</p></SectionCard>
    {!data.emailVerified && <SectionCard data-testid="card-email-verification" className="p-3 space-y-2"><div className="flex justify-between gap-3 flex-wrap items-center"><div><h2 className="font-medium text-xs text-amber-900 dark:text-amber-200">Din e-mail er ikke bekræftet</h2><p className="text-xs text-amber-800 dark:text-amber-300 mt-1">Bekræft e-mailen for at sikre, at du kan modtage vigtige sikkerhedsbeskeder.</p></div><Button size="sm" variant="outline" data-testid="button-resend-verification" disabled={resend.isPending} onClick={() => resend.mutate()}>{resend.isPending ? "Sender..." : "Send bekræftelse igen"}</Button></div>{demoToken && <p className="text-[11px] text-amber-800 dark:text-amber-300">Dette link vises kun, fordi der ikke er en mailudbyder sat op: <a className="underline font-medium" href={`#/bekraeft?token=${encodeURIComponent(demoToken)}`} data-testid="link-demo-verification">Bekræft e-mail</a></p>}</SectionCard>}
    <TwoFactorCard enabled={data.twoFactorEnabled} setup={setup} start={start} enable={enable} onDisable={() => setDisableOpen(true)} onBackup={() => setBackupOpen(true)} />
    <PasswordCard afterSave={async () => { invalidate(); await refresh(); }} />
    <SectionCard data-testid="card-own-consents" title="Mit samtykke" icon={<Lock className="w-4 h-4" />} className="space-y-3"><ConsentToggle label="GPS-sporing" description="Du accepterer, at GPS-position bruges ved registrering af arbejdstid og kontrol af check-ind." kind="gps" checked={allowed("gps")} pending={consent.isPending} onChange={(granted) => consent.mutate({ kind: "gps", granted })} /><ConsentToggle label="Fotodokumentation" description="Du accepterer, at fotos kan knyttes til udførte opgaver og kvalitetsdokumentation." kind="foto" checked={allowed("foto")} pending={consent.isPending} onChange={(granted) => consent.mutate({ kind: "foto", granted })} /></SectionCard>
    <GpsTrackingSection />
    <SecurityPolicySection twoFactorEnabled={data.twoFactorEnabled} />
    <SectionCard data-testid="card-login-attempts" title="Seneste loginforsøg" icon={<Lock className="w-4 h-4" />} className="space-y-3">{data.recentAttempts.length === 0 ? <p className="text-xs text-muted-foreground py-2" data-testid="empty-login-attempts">Der er ingen loginforsøg at vise endnu.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-xs"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="py-2 font-medium">Tidspunkt</th><th className="py-2 font-medium">IP</th><th className="py-2 font-medium">Resultat</th><th className="py-2 font-medium">Årsag</th></tr></thead><tbody>{data.recentAttempts.map((attempt) => <tr key={attempt.id} className="divide-y divide-border/50" data-testid={`row-login-attempt-${attempt.id}`}><td className="py-2 text-[11px]">{date(attempt.createdAt)}</td><td className="py-2 font-mono text-[11px]">{attempt.ip ?? "—"}</td><td className={`py-2 ${attempt.success === 1 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{attempt.success === 1 ? "Lykkedes" : "Mislykkedes"}</td><td className="py-2 text-[11px] text-muted-foreground">{attempt.success === 1 ? "—" : REASONS[attempt.reason ?? ""] ?? attempt.reason ?? "—"}</td></tr>)}</tbody></table></div>}</SectionCard>
    <PasswordDialog mode="disable" open={disableOpen} onOpenChange={setDisableOpen} onSuccess={() => { setDisableOpen(false); invalidate(); }} />
    <PasswordDialog mode="backup" open={backupOpen} onOpenChange={setBackupOpen} onSuccess={(codes) => { setBackupOpen(false); if (codes) setBackupCodes(codes); invalidate(); }} />
    <BackupCodesDialog codes={backupCodes} onClose={() => setBackupCodes(null)} />
  </div>;
}
function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div className="rounded-md border border-border/50 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`text-xs font-medium mt-1 ${good === true ? "text-emerald-700 dark:text-emerald-400" : good === false ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>{value}</p></div>; }
function Loading() { return <div className="p-3 md:p-4 space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-36 rounded-md" /><Skeleton className="h-52 rounded-md" /></div>; }
function TwoFactorCard({ enabled, setup, start, enable, onDisable, onBackup }: { enabled: boolean; setup: { secret: string; uri: string; vejledning: string } | null; start: { isPending: boolean; mutate: () => void }; enable: { isPending: boolean; mutate: (code: string) => void }; onDisable: () => void; onBackup: () => void }) { const { toast } = useToast(); const [code, setCode] = useState(""); const [qr, setQr] = useState<string>(""); useEffect(() => { if (!setup?.uri) { setQr(""); return; } let alive = true; QRCode.toDataURL(setup.uri, { margin: 0, width: 320 }).then((url) => { if (alive) setQr(url); }).catch(() => { if (alive) setQr(""); }); return () => { alive = false; }; }, [setup?.uri]); const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast({ title: "Kopieret" }); } catch { toast({ title: "Kunne ikke kopiere", description: "Kopiér teksten manuelt.", variant: "destructive" }); } }; return <SectionCard data-testid="card-two-factor" title="To-faktor-godkendelse" icon={<Lock className="w-4 h-4" />} action={enabled ? <div className="flex gap-2"><Button size="sm" variant="outline" data-testid="button-new-backup-codes" onClick={onBackup}>Nye reservekoder</Button><Button size="sm" variant="destructive" data-testid="button-disable-2fa" onClick={onDisable}>Slå fra</Button></div> : !setup ? <Button size="sm" data-testid="button-start-2fa" disabled={start.isPending} onClick={() => start.mutate()}>Slå to-faktor til</Button> : undefined} className="space-y-3"><p className="text-xs text-muted-foreground">{enabled ? "Din konto er ekstra beskyttet med en godkendelsesapp." : "Brug en godkendelsesapp som ekstra sikkerhed ved login."}</p>{setup && <div className="border-t border-border pt-3 space-y-2"><p className="text-xs">{setup.vejledning}</p>{qr ? <div className="flex justify-center"><img src={qr} alt="QR-kode til godkendelsesapp" className="w-44 h-44 rounded-md border border-border bg-white p-2" data-testid="img-2fa-qr" /></div> : null}<p className="text-[11px] text-muted-foreground">Kan du ikke scanne? Indtast nøglen nedenfor manuelt i godkendelsesappen.</p><div className="rounded-md bg-muted p-3 flex gap-2 justify-between items-center"><code className="font-mono text-xs tracking-[0.18em] break-all" data-testid="text-2fa-secret">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code><Button size="sm" variant="ghost" data-testid="button-copy-2fa-secret" onClick={() => copy(setup.secret)}><Clipboard className="w-4 h-4" /></Button></div><div className="flex gap-2 flex-wrap"><Input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="Seks cifre" data-testid="input-2fa-code" /><Button data-testid="button-enable-2fa" disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate(code)}>{enable.isPending ? "Bekræfter..." : "Bekræft og slå til"}</Button></div></div>}</SectionCard>; }
function PasswordCard({ afterSave }: { afterSave: () => Promise<void> }) { const { toast } = useToast(); const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [repeat, setRepeat] = useState(""); const [problems, setProblems] = useState<string[]>([]); const mutation = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/auth/password", { currentPassword, newPassword })).json(), onSuccess: async (result) => { await afterSave(); setCurrentPassword(""); setNewPassword(""); setRepeat(""); setProblems([]); toast({ title: "Adgangskoden er skiftet", description: result.message }); }, onError: (error: any) => { setProblems(error.payload?.problems ?? []); toast({ title: "Kunne ikke skifte adgangskode", description: error.message, variant: "destructive" }); } }); const submit = () => { if (newPassword !== repeat) { setProblems(["De to nye adgangskoder er ikke ens."]); return; } setProblems([]); mutation.mutate(); }; return <SectionCard data-testid="card-password" title="Skift adgangskode" icon={<Lock className="w-4 h-4" />} className="space-y-3"><p className="text-[11px] text-muted-foreground">Vælg mindst 10 tegn med både bogstaver og tal.</p><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="space-y-1.5"><Label htmlFor="current-password">Nuværende adgangskode</Label><Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} data-testid="input-current-password" /></div><div className="space-y-1.5"><Label htmlFor="new-password">Ny adgangskode</Label><Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} data-testid="input-new-password" /></div><div className="space-y-1.5"><Label htmlFor="repeat-password">Gentag ny adgangskode</Label><Input id="repeat-password" type="password" value={repeat} onChange={(event) => setRepeat(event.target.value)} data-testid="input-repeat-password" /></div></div>{problems.length > 0 && <ul className="text-xs text-destructive list-disc pl-5" data-testid="text-password-problems">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}<Button size="sm" data-testid="button-change-password" disabled={!currentPassword || !newPassword || !repeat || mutation.isPending} onClick={submit}>{mutation.isPending ? "Skifter..." : "Skift adgangskode"}</Button></SectionCard>; }
function PasswordDialog({ mode, open, onOpenChange, onSuccess }: { mode: "disable" | "backup"; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (codes?: string[]) => void }) { const { toast } = useToast(); const [password, setPassword] = useState(""); const mutation = useMutation({ mutationFn: async () => (await apiRequest("POST", mode === "disable" ? "/api/security/2fa/disable" : "/api/security/2fa/backup", { password })).json(), onSuccess: (result) => { setPassword(""); onSuccess(result.backupCodes); toast({ title: mode === "disable" ? "To-faktor er slået fra" : "Nye reservekoder er oprettet", description: result.besked }); }, onError: (e: Error) => toast({ title: "Handlingen mislykkedes", description: e.message, variant: "destructive" }) }); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{mode === "disable" ? "Slå to-faktor fra" : "Opret nye reservekoder"}</DialogTitle></DialogHeader>{mode === "disable" && <p className="text-sm text-destructive">Du logges ud af alle enheder, når to-faktor slås fra.</p>}<div className="space-y-2"><Label htmlFor={`password-${mode}`}>Adgangskode</Label><Input id={`password-${mode}`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} data-testid={`input-${mode}-password`} /><Button className="w-full" disabled={!password || mutation.isPending} onClick={() => mutation.mutate()} data-testid={`button-confirm-${mode}`}>{mutation.isPending ? "Bekræfter..." : "Bekræft med adgangskode"}</Button></div></DialogContent></Dialog>; }
function BackupCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) { const { toast } = useToast(); const copy = async () => { try { await navigator.clipboard.writeText((codes ?? []).join("\n")); toast({ title: "Reservekoder er kopieret" }); } catch { toast({ title: "Kunne ikke kopiere", description: "Kopiér koderne manuelt.", variant: "destructive" }); } }; return <Dialog open={Boolean(codes)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md" onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}><DialogHeader><DialogTitle>Gem dine reservekoder</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">De vises kun nu. Gem dem et sikkert sted, så du kan få adgang, hvis din godkendelsesapp ikke er tilgængelig.</p><div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 font-mono text-sm" data-testid="text-backup-codes">{codes?.map((code) => <span key={code}>{code}</span>)}</div><div className="flex gap-2"><Button variant="outline" className="flex-1" data-testid="button-copy-all-backup-codes" onClick={copy}>Kopiér alle</Button><Button className="flex-1" data-testid="button-saved-backup-codes" onClick={onClose}>Jeg har gemt dem</Button></div></DialogContent></Dialog>; }
function ConsentToggle({ label, description, kind, checked, pending, onChange }: { label: string; description: string; kind: string; checked: boolean; pending: boolean; onChange: (value: boolean) => void }) { return <div className="flex justify-between gap-3 border-t border-border pt-3"><div><p className="text-xs font-medium">{label}</p><p className="text-[11px] text-muted-foreground mt-1">{description}</p></div><Switch checked={checked} disabled={pending} onCheckedChange={onChange} aria-label={label} data-testid={`switch-consent-${kind}`} /></div>; }

// ═══════════════════════════════════════════════════════════════
// GPS-sporing — virksomheden styrer GPS pr. medarbejder
// ═══════════════════════════════════════════════════════════════
function GpsTrackingSection() {
  const { companyId } = useAuth();
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
  });
  const list = employees ?? [];
  const gpsOn = list.filter((e) => e.gpsRequired !== 0).length;
  const gpsOff = list.length - gpsOn;

  return (
    <SectionCard data-testid="card-gps-tracking" title="GPS-sporing" icon={<MapPin className="w-4 h-4" />} className="space-y-3">
      {/* Virksomhedsstyret banner */}
      <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3" data-testid="gps-company-banner">
        <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">Virksomheden styrer GPS pr. medarbejder</p>
          <p className="text-[11px] text-blue-800 dark:text-blue-300">GPS aktiveres eller deaktiveres for hver medarbejder under Ansatte → Adgang &amp; GPS.</p>
        </div>
      </div>

      {/* Status-række */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-[11px] text-muted-foreground">GPS-status</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" data-testid="gps-status-dot" />
            <p className="text-xs font-medium text-foreground" data-testid="text-gps-status">Pr. medarbejder</p>
          </div>
        </div>
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-[11px] text-muted-foreground">Medarbejdere med GPS</p>
          <p className="text-xs font-medium mt-1 text-emerald-700 dark:text-emerald-400" data-testid="text-gps-on-count">{gpsOn} aktiveret</p>
        </div>
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-[11px] text-muted-foreground">Medarbejdere uden GPS</p>
          <p className="text-xs font-medium mt-1 text-amber-700 dark:text-amber-400" data-testid="text-gps-off-count">{gpsOff} deaktiveret</p>
        </div>
      </div>

      {/* Oversigt pr. medarbejder */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium">GPS-status pr. medarbejder</p>
        </div>
        {isLoading ? (
          <p className="text-[11px] text-muted-foreground">Henter medarbejdere…</p>
        ) : list.length === 0 ? (
          <p className="text-[11px] text-muted-foreground" data-testid="empty-gps-employees">Ingen ansatte registreret.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[420px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbejder</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="text-right">GPS-krav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((emp) => {
                  const on = emp.gpsRequired !== 0;
                  return (
                    <TableRow key={emp.id} data-testid={`row-gps-employee-${emp.id}`}>
                      <TableCell className="py-2 font-medium">{emp.name}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{emp.role || "—"}</TableCell>
                      <TableCell className="py-2 text-right">
                        {on ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400" data-testid={`gps-on-${emp.id}`}>
                            <MapPin className="w-3 h-3" />Aktiveret
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400" data-testid={`gps-off-${emp.id}`}>
                            <MapPin className="w-3 h-3" />Deaktiveret
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Geofence konfigureres pr. kundeadresse i kundeportalen. Standard-radius er 150 meter.</p>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sikkerhedspolitik — adgangskodekrav, 2FA, session timeout
// ═══════════════════════════════════════════════════════════════
function SecurityPolicySection({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const policies = [
    { label: "Adgangskodekrav", value: "Min. 10 tegn, bogstaver og tal", icon: <KeyRound className="w-3.5 h-3.5" /> },
    { label: "To-faktor (2FA)", value: twoFactorEnabled ? "Aktiveret" : "Ikke aktiveret", good: twoFactorEnabled, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { label: "Session timeout", value: "30 minutter inaktivitet", icon: <Clock className="w-3.5 h-3.5" /> },
    { label: "Backup-koder", value: "8 koder pr. konto", icon: <LockKeyhole className="w-3.5 h-3.5" /> },
  ];
  return (
    <SectionCard data-testid="card-security-policy" title="Sikkerhedspolitik" icon={<ShieldCheck className="w-4 h-4" />} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {policies.map((p) => (
          <div key={p.label} className="rounded-md border border-border/50 p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{p.icon}</span>
              <p className="text-[11px] text-muted-foreground">{p.label}</p>
            </div>
            <p className={`text-xs font-medium mt-1 ${p.good === true ? "text-emerald-700 dark:text-emerald-400" : p.good === false ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>{p.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

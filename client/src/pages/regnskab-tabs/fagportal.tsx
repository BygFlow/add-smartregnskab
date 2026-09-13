import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Clock3, ShieldCheck, UserPlus, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Client = { id: number; companyId: number; professionalRole: string; permissions: string[]; active: boolean; company?: { name: string; cvr?: string | null } };
type Team = { id: number; professionalRole: string; status: string; accessExpiresAt?: string | null; user?: { name: string; email: string; twoFactorEnabled: number } | null };
type Approval = { id: number; title: string; approvalType: string; status: string; description?: string | null; requestedBy: number; dueDate?: string | null };

const roleLabel: Record<string, string> = { bogholder: "Bogholder", revisor: "Revisor", revisor_admin: "Revisionsadministrator", leder: "Virksomhedsleder" };

export default function Fagportal() {
  const { user, company, switchCompany, refresh } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = ["leder", "revisor_admin", "platform_admin"].includes(user?.role ?? "");
  const isProfessional = ["bogholder", "revisor", "revisor_admin"].includes(user?.role ?? "");
  const mfaRequired = isProfessional && user?.twoFactorEnabled !== 1;
  const [invite, setInvite] = useState({ name: "", email: "", role: "revisor", accessExpiresAt: "" });
  const [approval, setApproval] = useState({ title: "", approvalType: "bogfoering", description: "", dueDate: "" });
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const clients = useQuery<{ clients: Client[] }>({ queryKey: ["/api/professional/clients"] });
  const team = useQuery<Team[]>({ queryKey: ["/api/professional/team"], enabled: canManage && !mfaRequired });
  const approvals = useQuery<Approval[]>({ queryKey: ["/api/professional/approvals"], enabled: !mfaRequired });

  const switchMut = useMutation({
    mutationFn: async (companyId: number) => switchCompany(companyId),
    onSuccess: async () => { await refresh(); qc.clear(); toast({ title: "Klient skiftet", description: "Du arbejder nu i den valgte virksomhed." }); },
    onError: (e: Error) => toast({ title: "Klienten kunne ikke åbnes", description: e.message, variant: "destructive" }),
  });
  const inviteMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/professional/invite", { ...invite, accessExpiresAt: invite.accessExpiresAt || null })).json(),
    onSuccess: () => { setInvite({ name: "", email: "", role: "revisor", accessExpiresAt: "" }); qc.invalidateQueries({ queryKey: ["/api/professional/team"] }); toast({ title: "Invitation sendt" }); },
    onError: (e: Error) => toast({ title: "Invitationen fejlede", description: e.message, variant: "destructive" }),
  });
  const approvalMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/professional/approvals", { ...approval, dueDate: approval.dueDate || null })).json(),
    onSuccess: () => { setApproval({ title: "", approvalType: "bogfoering", description: "", dueDate: "" }); qc.invalidateQueries({ queryKey: ["/api/professional/approvals"] }); toast({ title: "Godkendelse oprettet" }); },
    onError: (e: Error) => toast({ title: "Kunne ikke oprette godkendelsen", description: e.message, variant: "destructive" }),
  });
  const decideMut = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: string }) => (await apiRequest("PATCH", `/api/professional/approvals/${id}/decision`, { decision })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/professional/approvals"] }),
    onError: (e: Error) => toast({ title: "Afgørelsen blev afvist", description: e.message, variant: "destructive" }),
  });
  const accessMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => (await apiRequest("PATCH", `/api/professional/team/${id}`, { status })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/professional/team"] }),
    onError: (e: Error) => toast({ title: "Adgangen kunne ikke ændres", description: e.message, variant: "destructive" }),
  });
  const startMfa = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/security/2fa/start")).json(),
    onSuccess: (data) => setMfaSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl }),
    onError: (e: Error) => toast({ title: "MFA-opsætning fejlede", description: e.message, variant: "destructive" }),
  });
  const enableMfa = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/security/2fa/enable", { code: mfaCode })).json(),
    onSuccess: (data) => setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []),
    onError: (e: Error) => toast({ title: "Koden kunne ikke bekræftes", description: e.message, variant: "destructive" }),
  });

  if (mfaRequired) return <div className="mx-auto max-w-xl space-y-5" data-testid="professional-mfa-setup">
    <div><h2 className="text-xl font-semibold">Beskyt din fagadgang</h2><p className="mt-1 text-sm text-muted-foreground">Tofaktorgodkendelse er obligatorisk for bogholdere og revisorer.</p></div>
    <div className="rounded-lg border bg-card p-5 space-y-4">
      {backupCodes.length > 0 ? <><h3 className="font-semibold text-emerald-700">Tofaktor er aktiveret</h3><p className="text-sm">Gem reservekoderne sikkert. De vises kun nu.</p><div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm">{backupCodes.map(code => <span key={code}>{code}</span>)}</div><Button className="w-full" onClick={() => refresh()}>Jeg har gemt koderne – fortsæt</Button></> : !mfaSetup ? <><p className="text-sm">Brug Google Authenticator, Microsoft Authenticator eller 1Password.</p><Button disabled={startMfa.isPending} onClick={() => startMfa.mutate()}>Start sikker opsætning</Button></> : <><div className="grid place-items-center"><img src={mfaSetup.qrDataUrl} alt="QR-kode til tofaktorgodkendelse" className="h-60 w-60 rounded bg-white p-2" /></div><div><Label>Manuel nøgle</Label><p className="break-all rounded bg-muted p-2 font-mono text-xs">{mfaSetup.secret}</p></div><div><Label>Sekscifret kode</Label><Input inputMode="numeric" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))} /></div><Button className="w-full" disabled={mfaCode.length !== 6 || enableMfa.isPending} onClick={() => enableMfa.mutate()}>Aktivér tofaktor</Button></>}
    </div>
  </div>;

  const pending = (approvals.data ?? []).filter((item) => item.status === "pending");
  return <div className="space-y-6" data-testid="professional-portal">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Bogholder- og revisorportal</h2><p className="text-sm text-muted-foreground">Flerklientadgang, arbejdsdeling og dokumenteret godkendelse.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Serverbeskyttet adgang</span>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border bg-card p-4"><Building2 className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-2xl font-semibold">{clients.data?.clients.length ?? (company ? 1 : 0)}</p><p className="text-xs text-muted-foreground">Klientvirksomheder</p></div>
      <div className="rounded-lg border bg-card p-4"><Users className="h-5 w-5 text-blue-600" /><p className="mt-2 text-2xl font-semibold">{team.data?.filter(x => x.status === "active").length ?? 0}</p><p className="text-xs text-muted-foreground">Aktive fagbrugere</p></div>
      <div className="rounded-lg border bg-card p-4"><Clock3 className="h-5 w-5 text-amber-600" /><p className="mt-2 text-2xl font-semibold">{pending.length}</p><p className="text-xs text-muted-foreground">Afventer godkendelse</p></div>
    </div>

    {(clients.data?.clients.length ?? 0) > 0 && <section className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Mine klienter</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{clients.data!.clients.map((client) => <div key={client.id} className={`rounded-lg border p-4 ${client.active ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
        <p className="font-medium">{client.company?.name ?? `Virksomhed ${client.companyId}`}</p><p className="text-xs text-muted-foreground">{roleLabel[client.professionalRole] ?? client.professionalRole}{client.company?.cvr ? ` · CVR ${client.company.cvr}` : ""}</p>
        <Button className="mt-3 w-full" size="sm" variant={client.active ? "secondary" : "outline"} disabled={client.active || switchMut.isPending} onClick={() => switchMut.mutate(client.companyId)}>{client.active ? <><Check className="mr-1 h-4 w-4" /> Aktiv klient</> : "Åbn klient"}</Button>
      </div>)}</div>
    </section>}

    {canManage && <section className="rounded-lg border bg-card p-4 space-y-4">
      <div><h3 className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invitér fagbruger</h3><p className="text-xs text-muted-foreground">Tofaktorgodkendelse bliver obligatorisk. Adgangen kan udløbe eller tilbagekaldes.</p></div>
      <div className="grid gap-3 md:grid-cols-4"><div><Label>Navn</Label><Input value={invite.name} onChange={e => setInvite(v => ({ ...v, name: e.target.value }))} /></div><div><Label>E-mail</Label><Input type="email" value={invite.email} onChange={e => setInvite(v => ({ ...v, email: e.target.value }))} /></div><div><Label>Rolle</Label><Select value={invite.role} onValueChange={role => setInvite(v => ({ ...v, role }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bogholder">Bogholder</SelectItem><SelectItem value="revisor">Revisor</SelectItem><SelectItem value="revisor_admin">Revisionsadministrator</SelectItem></SelectContent></Select></div><div><Label>Adgang udløber (valgfrit)</Label><Input type="date" value={invite.accessExpiresAt} onChange={e => setInvite(v => ({ ...v, accessExpiresAt: e.target.value }))} /></div></div>
      <Button disabled={!invite.email || inviteMut.isPending} onClick={() => inviteMut.mutate()}>Send sikker invitation</Button>
      {(team.data?.length ?? 0) > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Navn</th><th className="p-2">Rolle</th><th className="p-2">MFA</th><th className="p-2">Status</th><th className="p-2 text-right">Adgang</th></tr></thead><tbody>{team.data!.map(member => <tr key={member.id} className="border-b"><td className="p-2"><p>{member.user?.name}</p><p className="text-xs text-muted-foreground">{member.user?.email}</p></td><td className="p-2">{roleLabel[member.professionalRole] ?? member.professionalRole}</td><td className="p-2">{member.user?.twoFactorEnabled ? "Aktiv" : "Påkrævet"}</td><td className="p-2">{member.status}</td><td className="p-2 text-right"><Button size="sm" variant="outline" disabled={accessMut.isPending} onClick={() => accessMut.mutate({ id: member.id, status: member.status === "active" ? "revoked" : "active" })}>{member.status === "active" ? "Tilbagekald" : "Genaktivér"}</Button></td></tr>)}</tbody></table></div>}
    </section>}

    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div><h3 className="font-semibold">Fire-øjne-godkendelser</h3><p className="text-xs text-muted-foreground">Den, der opretter en anmodning, kan ikke selv godkende den.</p></div>
      <div className="grid gap-3 md:grid-cols-4"><div className="md:col-span-2"><Label>Titel</Label><Input value={approval.title} onChange={e => setApproval(v => ({ ...v, title: e.target.value }))} placeholder="Fx Godkend momsindberetning" /></div><div><Label>Type</Label><Select value={approval.approvalType} onValueChange={approvalType => setApproval(v => ({ ...v, approvalType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bogfoering">Bogføring</SelectItem><SelectItem value="moms">Moms</SelectItem><SelectItem value="betaling">Betaling</SelectItem><SelectItem value="aarsafslutning">Årsafslutning</SelectItem></SelectContent></Select></div><div><Label>Frist</Label><Input type="date" value={approval.dueDate} onChange={e => setApproval(v => ({ ...v, dueDate: e.target.value }))} /></div></div>
      <Textarea value={approval.description} onChange={e => setApproval(v => ({ ...v, description: e.target.value }))} placeholder="Beskriv kontrollen og det materiale, der skal gennemgås" />
      <Button disabled={!approval.title || approvalMut.isPending} onClick={() => approvalMut.mutate()}>Opret godkendelse</Button>
      <div className="space-y-2">{(approvals.data ?? []).map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.approvalType} · {item.status}{item.dueDate ? ` · frist ${item.dueDate}` : ""}</p></div>{item.status === "pending" && item.requestedBy !== user?.id && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decideMut.mutate({ id: item.id, decision: "rejected" })}>Afvis</Button><Button size="sm" onClick={() => decideMut.mutate({ id: item.id, decision: "approved" })}>Godkend</Button></div>}</div>)}</div>
    </section>
  </div>;
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Bell, Send, CheckCircle2, XCircle, Clock, Settings, MessageSquare } from "lucide-react";

// ── Typer ──
interface BillingStatus {
  stripeConfigured: boolean;
  emailConfigured: boolean;
  subscription: unknown;
  plan: unknown;
  hasPaymentMethod: boolean;
}

interface NotificationPreferences {
  invoiceEmail: boolean;
  reminderEmail: boolean;
  shiftSms: boolean;
  taskAssignmentEmail: boolean;
  absenceEmail: boolean;
  trialEndingEmail: boolean;
  paymentFailedEmail: boolean;
  weeklyReportEmail: boolean;
}

interface OutboxMessage {
  id: number;
  companyId: number;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string; // i_koe, sendt, fejl, simuleret
  relatedType: string | null;
  relatedId: number | null;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

// ── Hjælpefunktioner ──
function dkDate(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return new Date(d).toLocaleString("da-DK");
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const map: Record<string, { cls: string; label: string }> = {
    sendt: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", label: "Sendt" },
    fejl: { cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", label: "Fejl" },
    simuleret: { cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", label: "Simuleret" },
    i_koe: { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", label: "I kø" },
  };
  const e = map[s] ?? map.i_koe;
  return <Badge className={e.cls}>{e.label}</Badge>;
}

function ConfigBadge({ ok, missing }: { ok: boolean; missing: string }) {
  if (ok) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="mr-1 h-3 w-3" />Konfigureret
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <XCircle className="mr-1 h-3 w-3" />Ikke konfigureret — mangler {missing}
    </Badge>
  );
}

const TEMPLATES = [
  { value: "welcome", label: "Velkomst" },
  { value: "trial_ending", label: "Prøveperiode udløber" },
  { value: "payment_failed", label: "Betaling fejlet" },
  { value: "task_assigned", label: "Opgave tildelt" },
  { value: "absence_notification", label: "Fravær" },
  { value: "sla_alert", label: "SLA-alarm" },
  { value: "weekly_report", label: "Ugentlig rapport" },
];

const PREF_FIELDS: { key: keyof NotificationPreferences; label: string; desc: string }[] = [
  { key: "invoiceEmail", label: "Faktura-email", desc: "Send faktura pr. email" },
  { key: "reminderEmail", label: "Rykker-email", desc: "Send rykkere pr. email" },
  { key: "shiftSms", label: "Vagt-SMS", desc: "SMS ved vagtændringer" },
  { key: "taskAssignmentEmail", label: "Opgave-tildeling email", desc: "Email når opgave tildeles" },
  { key: "absenceEmail", label: "Fravær email", desc: "Email ved fravær" },
  { key: "trialEndingEmail", label: "Prøveperiode udløber", desc: "Email før prøveperiode udløber" },
  { key: "paymentFailedEmail", label: "Betaling fejlet", desc: "Email ved mislykket betaling" },
  { key: "weeklyReportEmail", label: "Ugentlig rapport", desc: "Ugentlig opsummering pr. email" },
];

// ── Komponent ──
export default function Notifikationsstyring({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Integration status ──
  const { data: billing, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/billing/status")).json(),
  });

  // ── Notifikationspræferencer ──
  const { data: prefs, isLoading: prefsLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notification-preferences", companyId],
    queryFn: async () => (await apiRequest("GET", "/api/notification-preferences")).json(),
  });

  const prefPatch = useMutation({
    mutationFn: async (patch: Partial<NotificationPreferences>) =>
      (await apiRequest("PATCH", "/api/notification-preferences", patch)).json(),
    onSuccess: (data) => {
      qc.setQueryData(["/api/notification-preferences", companyId], data);
    },
    onError: (e: Error) =>
      toast({ title: "Kunne ikke opdatere præference", description: e.message, variant: "destructive" }),
  });

  const togglePref = (key: keyof NotificationPreferences, value: boolean) => {
    prefPatch.mutate({ [key]: value } as Partial<NotificationPreferences>);
  };

  // ── Send testbesked ──
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sendMsg = useMutation({
    mutationFn: async (payload: {
      channel: string;
      recipient: string;
      subject?: string;
      body: string;
    }) => (await apiRequest("POST", "/api/messages/send", payload)).json(),
    onSuccess: () => {
      toast({ title: "Besked sendt", description: "Beskeden er lagt i udbakken." });
      setRecipient("");
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["/api/messages/outbox", companyId] });
    },
    onError: (e: Error) =>
      toast({ title: "Kunne ikke sende besked", description: e.message, variant: "destructive" }),
  });

  const handleSendMsg = () => {
    if (!recipient.trim() || !body.trim()) {
      toast({ title: "Udfyld modtager og besked", variant: "destructive" });
      return;
    }
    const payload: { channel: string; recipient: string; subject?: string; body: string } = {
      channel,
      recipient: recipient.trim(),
      body: body.trim(),
    };
    if (channel === "email") payload.subject = subject.trim();
    sendMsg.mutate(payload);
  };

  // ── Send fra skabelon ──
  const [template, setTemplate] = useState<string>("");
  const [tplRecipient, setTplRecipient] = useState("");

  const sendTpl = useMutation({
    mutationFn: async (payload: { template: string; recipient: string; data?: Record<string, unknown> }) =>
      (await apiRequest("POST", "/api/notifications/send", payload)).json(),
    onSuccess: () => {
      toast({ title: "Skabelon sendt", description: "Notifikationen er afsendt." });
      setTplRecipient("");
      setTemplate("");
      qc.invalidateQueries({ queryKey: ["/api/messages/outbox", companyId] });
    },
    onError: (e: Error) =>
      toast({ title: "Kunne ikke sende skabelon", description: e.message, variant: "destructive" }),
  });

  const handleSendTpl = () => {
    if (!template || !tplRecipient.trim()) {
      toast({ title: "Vælg skabelon og modtager", variant: "destructive" });
      return;
    }
    sendTpl.mutate({
      template,
      recipient: tplRecipient.trim(),
      data: { companyName: user?.name ?? "" },
    });
  };

  // ── Udbakke ──
  const { data: outbox = [], isLoading: outboxLoading } = useQuery<OutboxMessage[]>({
    queryKey: ["/api/messages/outbox", companyId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/messages/outbox?companyId=${companyId}`)).json(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Notifikationsstyring</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span>Styr email- og SMS-notifikationer for virksomheden</span>
        </p>
      </div>

      {/* Integration Status Card */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-foreground">Integration status</h2>
          </div>
          {billingLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Indlæser status…</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Email</span>
                <ConfigBadge
                  ok={!!billing?.emailConfigured}
                  missing="RESEND_API_KEY og MAIL_FROM"
                />
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Stripe</span>
                <ConfigBadge
                  ok={!!billing?.stripeConfigured}
                  missing="STRIPE_SECRET_KEY"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="indstillinger">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="indstillinger" data-testid="tab-indstillinger">
            <Settings className="mr-1 h-4 w-4" />Indstillinger
          </TabsTrigger>
          <TabsTrigger value="send" data-testid="tab-send">
            <Send className="mr-1 h-4 w-4" />Send besked
          </TabsTrigger>
          <TabsTrigger value="udbakke" data-testid="tab-udbakke">
            <Mail className="mr-1 h-4 w-4" />Udbakke
          </TabsTrigger>
        </TabsList>

        {/* Indstillinger */}
        <TabsContent value="indstillinger">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-foreground">Notifikationspræferencer</h2>
              </div>
              {prefsLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Indlæser præferencer…</p>
              ) : (
                <div className="divide-y divide-border">
                  {PREF_FIELDS.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          {f.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                      <Switch
                        data-testid={`pref-${f.key}`}
                        checked={!!prefs?.[f.key]}
                        onCheckedChange={(v) => togglePref(f.key, v)}
                        disabled={prefPatch.isPending}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send besked */}
        <TabsContent value="send">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Send testbesked */}
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-base font-semibold text-foreground">Send testbesked</h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="msg-channel">Kanal</Label>
                  <Select
                    value={channel}
                    onValueChange={(v) => setChannel(v as "email" | "sms")}
                  >
                    <SelectTrigger data-testid="msg-channel" id="msg-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="msg-recipient">Modtager</Label>
                  <Input
                    id="msg-recipient"
                    data-testid="msg-recipient"
                    placeholder={channel === "email" ? "navn@eksempel.dk" : "+45 12 34 56 78"}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>

                {channel === "email" && (
                  <div className="space-y-2">
                    <Label htmlFor="msg-subject">Emne</Label>
                    <Input
                      id="msg-subject"
                      data-testid="msg-subject"
                      placeholder="Emne"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="msg-body">Besked</Label>
                  <Textarea
                    id="msg-body"
                    data-testid="msg-body"
                    placeholder="Skriv besked…"
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>

                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="msg-send"
                  onClick={handleSendMsg}
                  disabled={sendMsg.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendMsg.isPending ? "Sender…" : "Send besked"}
                </Button>
              </CardContent>
            </Card>

            {/* Send fra skabelon */}
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-base font-semibold text-foreground">Send fra skabelon</h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpl-select">Skabelon</Label>
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger data-testid="tpl-select" id="tpl-select">
                      <SelectValue placeholder="Vælg skabelon" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpl-recipient">Modtager</Label>
                  <Input
                    id="tpl-recipient"
                    data-testid="tpl-recipient"
                    placeholder="navn@eksempel.dk"
                    value={tplRecipient}
                    onChange={(e) => setTplRecipient(e.target.value)}
                  />
                </div>

                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="tpl-send"
                  onClick={handleSendTpl}
                  disabled={sendTpl.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendTpl.isPending ? "Sender…" : "Send fra skabelon"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Udbakke */}
        <TabsContent value="udbakke">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-foreground">Udbakke</h2>
                <Badge variant="secondary" className="ml-1">{outbox.length}</Badge>
              </div>

              {outboxLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Indlæser beskeder…</p>
              ) : outbox.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Ingen beskeder sendt endnu</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Kanal</TableHead>
                        <TableHead>Modtager</TableHead>
                        <TableHead>Emne</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fejl</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outbox.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-muted-foreground">
                            {dkDate(m.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {m.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {m.recipient}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {m.subject ?? "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={m.status} />
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate text-muted-foreground">
                            {m.error ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

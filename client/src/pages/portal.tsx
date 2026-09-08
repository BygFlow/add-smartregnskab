import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { statusLabel, statusColor, formatCurrency, formatDuration, recurrenceLabel, priorityColor, priorityLabel } from "@/App";
import type { Task, Invoice, TimeEntry, Company, Customer } from "@shared/schema";
import { Bell, Calendar, Clock, FileText, LogOut, MapPin, CheckCircle2, MessageSquare, Send, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function Portal({ companyId, customerId }: { companyId: number; customerId: number }) {
  const { logout, company } = useAuth();

  const { data: tasks, isLoading: tLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks/customer", customerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks?companyId=${companyId}`);
      const all = await res.json();
      return all.filter((t: Task) => t.customerId === customerId);
    },
  });
  const { data: invoices, isLoading: iLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices/customer", customerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices?companyId=${companyId}`);
      const all = await res.json();
      return all.filter((i: Invoice) => i.customerId === customerId);
    },
  });

  const [tab, setTab] = useState<"opgaver" | "fakturaer" | "beskeder">("opgaver");
  const loading = tLoading || iLoading;

  const upcomingTasks = (tasks || []).filter(t => t.status === "planlagt" || t.status === "igang").sort((a, b) => a.date.localeCompare(b.date));
  const completedTasks = (tasks || []).filter(t => t.status === "færdig").sort((a, b) => b.date.localeCompare(a.date));
  const unpaidInvoices = (invoices || []).filter(i => i.status !== "betalt");
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Portal header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 text-primary" />
            <div>
              <div className="font-bold text-sm text-foreground">Kundeportal</div>
              <div className="text-[11px] text-muted-foreground">{company?.name}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} data-testid="button-portal-logout">
            <LogOut className="w-4 h-4 mr-1.5" />Log ud
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        {/* Welcome */}
        <div>
          <h1 className="text-lg font-bold text-foreground">Velkommen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Se dine opgaver og fakturaer</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-md p-3">
            <Calendar className="w-4 h-4 text-blue-500 mb-1" />
            <div className="text-lg font-bold text-foreground">{upcomingTasks.length}</div>
            <div className="text-xs text-muted-foreground">Kommende</div>
          </div>
          <div className="bg-card border border-border rounded-md p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
            <div className="text-lg font-bold text-foreground">{completedTasks.length}</div>
            <div className="text-xs text-muted-foreground">Afsluttet</div>
          </div>
          <div className="bg-card border border-border rounded-md p-3">
            <FileText className="w-4 h-4 text-amber-500 mb-1" />
            <div className="text-lg font-bold text-foreground">{unpaidInvoices.length}</div>
            <div className="text-xs text-muted-foreground">Ubetalte</div>
          </div>
          <div className="bg-card border border-border rounded-md p-3">
            <Bell className="w-4 h-4 text-red-500 mb-1" />
            <div className="text-lg font-bold text-foreground">{formatCurrency(totalOutstanding)}</div>
            <div className="text-xs text-muted-foreground">Udestående</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button onClick={() => setTab("opgaver")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "opgaver" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            Opgaver
          </button>
          <button onClick={() => setTab("fakturaer")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "fakturaer" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            Fakturaer
          </button>
          <button onClick={() => setTab("beskeder")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "beskeder" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            Beskeder
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
        ) : tab === "opgaver" ? (
          <div className="space-y-4">
            {/* Upcoming */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Kommende opgaver</h2>
              <div className="space-y-2">
                {upcomingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Ingen kommende opgaver</p>
                ) : upcomingTasks.map((t) => (
                  <div key={t.id} className="bg-card border border-border rounded-md p-3 flex items-center gap-3" data-testid={`portal-task-${t.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3 h-3" />{t.date}
                        {t.startTime && <><Clock className="w-3 h-3 ml-1" />{t.startTime}{t.endTime && `-${t.endTime}`}</>}
                        {t.recurrence !== "ingen" && <Badge variant="secondary" className="text-[10px] ml-1">{recurrenceLabel(t.recurrence)}</Badge>}
                      </div>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] ${statusColor(t.status)}`}>{statusLabel(t.status)}</Badge>
                  </div>
                ))}
              </div>
            </div>
            {/* Completed */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Afsluttede opgaver</h2>
              <div className="space-y-2">
                {completedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Ingen afsluttede opgaver</p>
                ) : completedTasks.slice(0, 10).map((t) => (
                  <div key={t.id} className="bg-card border border-border rounded-md p-3 flex items-center gap-3 opacity-70">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : tab === "beskeder" ? (
          <KundeMessages customerId={customerId} companyId={companyId} />
        ) : (
          <div className="space-y-2">
            {(invoices || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Ingen fakturaer</p>
            ) : (invoices || []).map((inv) => (
              <div key={inv.id} className="bg-card border border-border rounded-md p-4 flex items-center gap-3" data-testid={`portal-invoice-${inv.id}`}>
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{inv.invoiceNumber}</span>
                    <Badge variant="secondary" className={`text-[10px] ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Udstedt {inv.issueDate} • Forfald {inv.dueDate || "—"}</div>
                </div>
                <div className="text-sm font-bold text-foreground">{formatCurrency(inv.totalAmount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Kunde beskeder — lukket kommunikation med virksomheden
// ═══════════════════════════════════════════════════════════════

type Conv = {
  id: number; companyId: number; type: string; title: string | null;
  customerId: number | null; participantIds: string; unreadCount: number;
  createdAt: string; lastMessageAt: string; lastMessagePreview: string | null;
};

type Msg = {
  id: number; conversationId: number; companyId: number; senderId: number;
  senderName: string; senderRole: string; body: string; read: number; createdAt: string;
};

function formatMsgTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function KundeMessages({ customerId, companyId }: { customerId: number; companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id || 0;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading } = useQuery<Conv[]>({
    queryKey: ["/api/conversations", "kunde", customerId],
    queryFn: async () => (await apiRequest("GET", "/api/conversations")).json(),
    refetchInterval: 5000,
  });

  const selectedConv = selectedId ? (conversations || []).find((c) => c.id === selectedId) : null;

  const { data: messages } = useQuery<Msg[]>({
    queryKey: ["/api/conversations", selectedId, "messages"],
    queryFn: async () => {
      if (!selectedId) return [];
      return (await apiRequest("GET", `/api/conversations/${selectedId}/messages`)).json();
    },
    refetchInterval: 5000,
    enabled: !!selectedId,
  });

  const markRead = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/conversations/${selectedId}/read`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations", "kunde", customerId] }),
  });

  useEffect(() => {
    if (selectedConv?.unreadCount && selectedConv.unreadCount > 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedConv?.unreadCount]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => (await apiRequest("POST", `/api/conversations/${selectedId}/messages`, { body })).json(),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", "kunde", customerId] });
    },
    onError: (e: any) => toast({ title: "Kunne ikke sende", description: e.message, variant: "destructive" }),
  });

  const createConv = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", "/api/conversations", body)).json(),
    onSuccess: (conv: Conv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", "kunde", customerId] });
      setCreateOpen(false);
      setNewTitle("");
      setSelectedId(conv.id);
    },
    onError: (e: any) => toast({ title: "Kunne ikke oprette", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    sendMessage.mutate(body);
  };

  const msgList = messages ?? [];
  const convList = conversations ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Beskeder til virksomheden</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-kunde-new-conv">
          <Plus className="w-4 h-4 mr-1" />Ny besked
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : convList.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-6 text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Ingen beskeder endnu</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Opret en ny besked for at kontakte virksomheden</p>
        </div>
      ) : !selectedConv ? (
        <div className="space-y-2">
          {convList.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              data-testid={`kunde-conv-${conv.id}`}
              className="w-full text-left bg-card border border-border rounded-md p-3 hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{conv.title || "Beskeder"}</span>
                {conv.unreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground px-1.5 text-[10px]">{conv.unreadCount}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessagePreview || "Ingen beskeder"}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <button onClick={() => setSelectedId(null)} className="text-xs text-muted-foreground hover:text-foreground" data-testid="button-kunde-back">
              ← Tilbage
            </button>
            <span className="text-sm font-medium text-foreground">{selectedConv.title || "Beskeder"}</span>
          </div>
          <div className="max-h-80 overflow-y-auto p-3 space-y-2" data-testid="kunde-message-list">
            {msgList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Ingen beskeder endnu</p>
            ) : msgList.map((msg) => {
              const isOwn = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`} data-testid={`kunde-msg-${msg.id}`}>
                  {!isOwn && <span className="text-[11px] font-medium text-muted-foreground mb-0.5 px-1">{msg.senderName}</span>}
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-accent text-accent-foreground rounded-bl-sm"}`}>
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatMsgTime(msg.createdAt)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-border p-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Skriv en besked..."
                className="min-h-[36px] max-h-24 resize-none text-sm"
                data-testid="input-kunde-message"
              />
              <Button onClick={handleSend} disabled={!draft.trim() || sendMessage.isPending} size="icon" data-testid="button-kunde-send">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ny besked til virksomheden</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <MessageSquare className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">Beskeden sendes til virksomhedens ledere</p>
            </div>
            <div className="space-y-1.5">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Emne (valgfrit)"
                data-testid="input-kunde-conv-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-kunde-cancel-conv">Annuller</Button>
            <Button
              onClick={() => createConv.mutate({ title: newTitle.trim() || "Henvendelse fra kunde", type: "customer", participantIds: [currentUserId] })}
              disabled={createConv.isPending}
              data-testid="button-kunde-create-conv"
            >
              {createConv.isPending ? "Opretter..." : "Opret samtale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

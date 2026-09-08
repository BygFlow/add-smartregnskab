import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, MessageSquare, Plus, Users, User, ArrowLeft } from "lucide-react";
import type { Customer } from "@shared/schema";

// ── Typer ──
type Conversation = {
  id: number;
  companyId: number;
  type: "internal" | "customer";
  title: string | null;
  customerId: number | null;
  participantIds: string; // JSON-array
  unreadCount: number;
  createdAt: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
};

type ChatMessage = {
  id: number;
  conversationId: number;
  companyId: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  body: string;
  read: number;
  createdAt: string;
};

type EmployeeUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  employeeId: number | null;
};

// ── Hjælpefunktioner ──
function parseParticipantIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function conversationTitle(conv: Conversation, employees: EmployeeUser[] | undefined, customers: Customer[] | undefined, currentUserId: number): string {
  if (conv.title) return conv.title;
  if (conv.type === "customer" && conv.customerId) {
    const c = customers?.find((x) => x.id === conv.customerId);
    if (c) return c.name;
  }
  const pids = parseParticipantIds(conv.participantIds).filter((id) => id !== currentUserId);
  const names = pids
    .map((id) => employees?.find((e) => e.id === id)?.name)
    .filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return "Samtale";
}

// ── Samtaleliste-element ──
function ConversationItem({
  conv,
  active,
  employees,
  customers,
  currentUserId,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  employees: EmployeeUser[] | undefined;
  customers: Customer[] | undefined;
  currentUserId: number;
  onClick: () => void;
}) {
  const title = conversationTitle(conv, employees, customers, currentUserId);
  const preview = conv.lastMessagePreview || "Ingen beskeder endnu";
  const unread = conv.unreadCount > 0;
  return (
    <button
      onClick={onClick}
      data-testid={`conversation-item-${conv.id}`}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        active
          ? "bg-primary/5 border-primary/30"
          : "bg-card border-border/50 hover:bg-accent/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {conv.type === "customer" ? (
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={`text-sm truncate ${unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>{title}</span>
          </div>
          <p className={`text-xs mt-1 truncate ${unread ? "text-foreground/80" : "text-muted-foreground"}`}>{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(conv.lastMessageAt || conv.createdAt)}</span>
          {unread && (
            <Badge className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-bold" data-testid={`unread-badge-${conv.id}`}>
              {conv.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Ny samtale dialog (rollebaseret — lukket system) ──
function NewConversationDialog({
  open,
  onOpenChange,
  employees,
  customers,
  currentUserId,
  role,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: EmployeeUser[] | undefined;
  customers: Customer[] | undefined;
  currentUserId: number;
  role: string;
  onCreated: (conv: Conversation) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");

  // Rolle-baserede begrænsninger
  const isLeader = role === "leder" || role === "holdleder" || role === "platform_admin";
  const isAssistent = role === "assistent";
  const isKunde = role === "kunde";

  // Filtrer medarbejdere baseret på rolle
  const availableEmployees = (employees ?? []).filter((e) => {
    if (e.id === currentUserId) return false;
    if (isAssistent) return e.role === "leder" || e.role === "holdleder"; // assistent kan kun skrive til ledere
    if (isKunde) return false; // kunde vælger ikke medarbejdere — skriver til virksomheden
    return true; // ledere kan vælge alle
  });

  const reset = () => {
    setTitle("");
    setSelectedEmployees([]);
    setSelectedCustomer("");
  };

  const createConversation = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", "/api/conversations", body)).json(),
    onSuccess: (conv: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Samtale oprettet" });
      reset();
      onOpenChange(false);
      onCreated(conv);
    },
    onError: (e: any) => toast({ title: "Kunne ikke oprette samtale", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    let finalTitle = title.trim();
    let customerId: number | null = null;

    if (isKunde) {
      // Kunde skriver til virksomheden — ingen valg nødvendigt
      if (!finalTitle) finalTitle = "Henvendelse til virksomheden";
      createConversation.mutate({
        title: finalTitle,
        type: "customer",
        participantIds: [currentUserId],
      });
      return;
    }

    if (isAssistent) {
      if (selectedEmployees.length === 0) {
        toast({ title: "Vælg mindst én leder", variant: "destructive" });
        return;
      }
      if (!finalTitle) {
        const names = selectedEmployees
          .map((id) => employees?.find((e) => e.id === id)?.name)
          .filter(Boolean);
        finalTitle = names.length > 0 ? names.join(", ") : "Samtale med kontoret";
      }
      createConversation.mutate({
        title: finalTitle,
        type: "internal",
        participantIds: [currentUserId, ...selectedEmployees.filter((id) => id !== currentUserId)],
      });
      return;
    }

    // Leder: kan vælge medarbejdere eller kunde
    if (selectedCustomer) {
      customerId = Number(selectedCustomer);
      if (!finalTitle) {
        const c = customers?.find((x) => x.id === customerId);
        finalTitle = c?.name || "Kundesamtale";
      }
      createConversation.mutate({
        title: finalTitle,
        type: "customer",
        customerId,
        participantIds: [currentUserId, ...selectedEmployees.filter((id) => id !== currentUserId)],
      });
      return;
    }

    if (selectedEmployees.length === 0) {
      toast({ title: "Vælg mindst én medarbejder eller kunde", variant: "destructive" });
      return;
    }
    if (!finalTitle) {
      const names = selectedEmployees
        .map((id) => employees?.find((e) => e.id === id)?.name)
        .filter(Boolean);
      finalTitle = names.length > 0 ? names.join(", ") : "Intern samtale";
    }
    createConversation.mutate({
      title: finalTitle,
      type: "internal",
      participantIds: [currentUserId, ...selectedEmployees.filter((id) => id !== currentUserId)],
    });
  };

  const toggleEmployee = (id: number) => {
    setSelectedEmployees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ny samtale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isKunde ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <User className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">Beskeden sendes til virksomheden</p>
              </div>
              <p className="text-xs text-muted-foreground">Virksomhedens ledere og holdledere vil modtage din besked.</p>
            </div>
          ) : isAssistent ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">Samtale med kontoret</p>
              </div>
              <p className="text-xs text-muted-foreground">Du kan skrive til virksomhedens ledere og holdledere.</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="conv-title">Titel (valgfri)</Label>
            <Input
              id="conv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Autogenereres fra deltagere"
              data-testid="input-conversation-title"
            />
          </div>

          {/* Kunde: ingen medarbejder-vælger, ingen kunde-vælger */}
          {/* Assistent: vælg blandt ledere/holdledere */}
          {/* Leder: vælg blandt alle medarbejdere + evt. kunde */}
          {!isKunde && (
            <div className="space-y-1.5">
              <Label>{isAssistent ? "Vælg leder" : "Vælg medarbejdere"}</Label>
              <div className="border border-border/50 rounded-lg p-2 max-h-56 overflow-y-auto space-y-1">
                {availableEmployees.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1.5">Ingen brugere fundet</p>
                )}
                {availableEmployees.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent/40 cursor-pointer"
                    data-testid={`employee-option-${e.id}`}
                  >
                    <Checkbox checked={selectedEmployees.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                    <span className="text-sm flex-1">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground">{e.role}</span>
                  </label>
                ))}
              </div>
              {selectedEmployees.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedEmployees.length} valgt</p>
              )}
            </div>
          )}

          {/* Kun ledere kan vælge kunde */}
          {isLeader && (
            <div className="space-y-1.5">
              <Label>Vælg kunde (valgfrit — starter kundesamtale)</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger data-testid="select-conversation-customer">
                  <SelectValue placeholder="Ingen kunde" />
                </SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-conversation">
            Annuller
          </Button>
          <Button onClick={handleSubmit} disabled={createConversation.isPending} data-testid="button-create-conversation">
            {createConversation.isPending ? "Opretter..." : "Opret samtale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aktiv samtale-visning ──
function ChatView({
  conversation,
  currentUserId,
}: {
  conversation: Conversation;
  currentUserId: number;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/conversations", conversation.id, "messages"],
    queryFn: async () => (await apiRequest("GET", `/api/conversations/${conversation.id}/messages`)).json(),
    refetchInterval: 5000,
  });

  const markRead = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/conversations/${conversation.id}/read`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations"] }),
  });

  // Markér som læst når samtalen åbnes eller har ulæste beskeder
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, conversation.unreadCount]);

  // Auto-scroll til bunden når nye beskeder ankommer
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => (await apiRequest("POST", `/api/conversations/${conversation.id}/messages`, { body })).json(),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversation.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (e: any) => toast({ title: "Kunne ikke sende besked", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    sendMessage.mutate(body);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const msgList = messages ?? [];

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        {conversation.type === "customer" ? (
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground truncate">{conversation.title || "Samtale"}</h2>
          {conversation.type === "customer" && (
            <span className="text-[11px] text-muted-foreground">Kundesamtale</span>
          )}
        </div>
      </div>

      {/* Beskeder */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" data-testid="message-list">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-2/3 rounded-lg" />
            <Skeleton className="h-12 w-1/2 rounded-lg ml-auto" />
            <Skeleton className="h-12 w-3/5 rounded-lg" />
          </div>
        ) : msgList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Ingen beskeder endnu</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Skriv den første besked herunder</p>
          </div>
        ) : (
          msgList.map((msg) => {
            const isOwn = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                data-testid={`message-${msg.id}`}
              >
                {!isOwn && (
                  <span className="text-[11px] font-medium text-muted-foreground mb-0.5 px-1">{msg.senderName}</span>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-accent text-accent-foreground rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatTime(msg.createdAt)}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en besked..."
            className="min-h-[40px] max-h-32 resize-none text-sm"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Hovedside ──
export default function Kommunikation() {
  const { user } = useAuth();
  const role = user?.role || "";
  const companyId = user?.companyId || 1;
  const currentUserId = user?.id || 0;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  // Rolle-baserede etiketter
  const isKunde = role === "kunde";
  const isAssistent = role === "assistent";
  const pageDesc = isKunde
    ? "Skriv til virksomheden"
    : isAssistent
    ? "Skriv til virksomhedens ledere"
    : "Send beskeder til medarbejdere og kunder";

  // Samtaler — opdateres hvert 5. sekund
  const { data: conversations, isLoading: convLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    queryFn: async () => (await apiRequest("GET", "/api/conversations")).json(),
    refetchInterval: 5000,
  });

  // Medarbejdere (brugere) til ny samtale
  const { data: employees } = useQuery<EmployeeUser[]>({
    queryKey: ["/api/conversations", "employees"],
    queryFn: async () => (await apiRequest("GET", "/api/conversations/employees/list")).json(),
  });

  // Kunder til ny kundesamtale
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const sortedConvs = useMemo(() => {
    const list = conversations ?? [];
    return [...list].sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt));
  }, [conversations]);

  const selectedConv = selectedId ? sortedConvs.find((c) => c.id === selectedId) : null;

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setShowListOnMobile(false);
  };

  const handleBack = () => {
    setShowListOnMobile(true);
  };

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kommunikation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pageDesc}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-conversation">
          <Plus className="w-4 h-4 mr-1.5" />Ny samtale
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-220px)] min-h-[400px]">
        {/* Venstre panel: samtaleliste */}
        <div
          className={`flex flex-col bg-card rounded-lg border border-border/50 overflow-hidden ${
            showListOnMobile ? "block" : "hidden md:flex"
          }`}
        >
          <div className="px-3 py-2.5 border-b border-border/50">
            <h2 className="text-sm font-semibold text-foreground">Samtaler</h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5" data-testid="conversation-list">
            {convLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : sortedConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 px-3">
                <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Ingen samtaler</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Opret en ny samtale for at komme i gang</p>
              </div>
            ) : (
              sortedConvs.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  active={selectedId === conv.id}
                  employees={employees}
                  customers={customers}
                  currentUserId={currentUserId}
                  onClick={() => handleSelect(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Højre panel: aktiv samtale eller tom tilstand */}
        <div
          className={`${
            showListOnMobile ? "hidden md:flex" : "flex"
          } flex-col min-h-0`}
        >
          {selectedConv ? (
            <div className="flex flex-col h-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="md:hidden mb-2 self-start"
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />Tilbage
              </Button>
              <div className="flex-1 min-h-0">
                <ChatView conversation={selectedConv} currentUserId={currentUserId} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-card rounded-lg border border-border/50 text-center px-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">Vælg en samtale</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Vælg en samtale fra listen til venstre, eller opret en ny for at starte en chat
              </p>
            </div>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        customers={customers}
        currentUserId={currentUserId}
        role={role}
        onCreated={(conv) => {
          setSelectedId(conv.id);
          setShowListOnMobile(false);
        }}
      />
    </div>
  );
}

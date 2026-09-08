import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Headset, X, Send, MessageCircle, Sparkles, Wrench, Check, ChevronRight } from "lucide-react";

// ── Vidensbase med almindelige spørgsmål og svar ──
type KbEntry = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  fix?: string; // foreslået rettelse
};

const KNOWLEDGE_BASE: KbEntry[] = [
  {
    id: "opret-kunde",
    question: "Hvordan opretter jeg en kunde?",
    keywords: ["opret", "kunde", "ny kunde", "tilføj kunde", "oprette"],
    answer:
      "Sådan opretter du en kunde:\n\n1. Gå til siden \"Kunder\" i menuen til venstre.\n2. Klik på knappen \"Opret kunde\" øverst til højre.\n3. Vælg kundetype: \"Privat\" eller \"Erhverv\".\n   • Privat: indtast navn, telefon og adresse.\n   • Erhverv: indtast firmanavn, CVR-nummer, kontaktperson og adresse.\n4. Udfyld de resterende felter (e-mail, telefon, adresse).\n5. Klik \"Gem\" for at oprette kunden.\n\nKunden er nu klar til at tildeles opgaver og modtage fakturaer.",
    fix: "Tjek at kundetypen er valgt korrekt (privat/erhverv) før du gemmer — det bestemmer hvilke felter der vises.",
  },
  {
    id: "send-faktura",
    question: "Hvordan sender jeg en faktura?",
    keywords: ["faktura", "send", "fakturere", "sende faktura", "udsted"],
    answer:
      "Sådan sender du en faktura:\n\n1. Gå til siden \"Fakturaer\" i menuen.\n2. Klik på \"Opret faktura\".\n3. Vælg kunden fra dropdown-listen.\n4. Tilføj fakturalinjer med ydelse, antal og pris.\n   • Du kan vælge ydelser fra jeres ydelseskatalog.\n5. Kontroller moms (25% er standard).\n6. Vælg betalingsfrist (standard: 8 dage).\n7. Klik \"Gem\" og derefter \"Send\" for at sende fakturaen.\n\nFakturaen sendes via e-mailintegrationen hvis denne er opsat, ellers kan du downloade en PDF.",
    fix: "Hvis fakturaen ikke kan sendes, tjek at e-mailintegrationen er aktiv under \"Integrationer\".",
  },
  {
    id: "opsaet-gps",
    question: "Hvordan opsætter jeg GPS?",
    keywords: ["gps", "sporing", "lokation", "position", "opsæt gps", "spor"],
    answer:
      "GPS-sporing er indbygget i tidsregistreringen og kan ikke slås fra af medarbejdere.\n\nSådan fungerer det:\n\n1. GPS aktiveres automatisk når en medarbejder stempler ind via tidsregistrering.\n2. Positionen logges med start- og sluttidspunkt.\n3. Virksomheden kan se medarbejderens placering under \"Tidsregistrering\".\n4. GPS låses så medarbejderen ikke kan deaktivere den.\n\nFor at se GPS-historik:\n1. Gå til \"Tidsregistrering\".\n2. Vælg den pågældende medarbejder og dato.\n3. Klik på en registrering for at se kortvisning.\n\nBemærk: GPS-sporing kræver at medarbejderen har givet tilladelse via sin mobilenhed.",
    fix: "Hvis GPS ikke virker, tjek at medarbejderen har givet lokationstilladelse i sin browser eller app-indstillinger.",
  },
  {
    id: "tilkobl-email",
    question: "Hvordan tilkobler jeg e-mail?",
    keywords: ["e-mail", "email", "tilkobl", "smtp", "integration", "mail", "forbind"],
    answer:
      "Sådan tilkobler du e-mailintegration:\n\n1. Gå til siden \"Integrationer\" i menuen.\n2. Find sektionen \"Kommunikation\".\n3. Klik \"Tilføj integration\".\n4. Vælg udbyder: \"E-mail\".\n5. Udfyld felterne:\n   • Afsender-e-mail (f.eks. info@virksomhed.dk)\n   • Afsender-navn (f.eks. Renseriet)\n   • SMTP-host (f.eks. smtp.gmail.com)\n   • SMTP-port (f.eks. 587)\n   • SMTP-brugernavn og adgangskode\n6. Aktivér integrationen med kontaktbryderen.\n7. Klik \"Gem\" og derefter \"Test forbindelse\".\n\nNår integrationen er aktiv, kan du sende fakturaer og leads direkte fra systemet.",
    fix: "Hvis e-mail ikke virker, tjek at SMTP-host og port er korrekte, og at brugernavn/adgangskode er indtastet rigtigt.",
  },
  {
    id: "ai-pris",
    question: "Hvad koster AI-tilæg?",
    keywords: ["ai", "tilæg", "pris", "koster", "pris på ai", "ai pris", "betale"],
    answer:
      "AI-tilægget koster 199 kr./md. pr. virksomhed.\n\nAI-tilægget omfatter:\n\n• Automatisk lead-fangst fra e-mail\n• AI-genererede tilbudsudkast\n• AI-analyse af kundehenvendelser\n• AI-svarudkast til leads\n• AI-support med vidensbase\n\nBemærk: AI sender aldrig automatisk — alle handlinger kræver manuel godkendelse fra virksomheden.\n\nAI-tilægget kan aktiveres under \"Virksomhed\" → \"Indstillinger\".",
    fix: "Hvis AI-funktioner ikke er tilgængelige, tjek at AI-tilægget er aktiveret under virksomhedsindstillinger.",
  },
  {
    id: "opret-vagtplan",
    question: "Hvordan opretter jeg en vagtplan?",
    keywords: ["vagtplan", "vagt", "plan", "planlæg", "schema", "arbejdsplan", "tilkald"],
    answer:
      "Sådan opretter du en vagtplan:\n\n1. Gå til siden \"Vagtplan\" i menuen.\n2. Vælg visning: dag, uge eller måned.\n3. Klik på den dato/det tidspunkt du vil tilføje en vagt.\n4. Vælg medarbejder fra dropdown-listen.\n5. Angiv start- og sluttidspunkt.\n6. Vælg eventuelt tilknyttet opgave.\n7. Klik \"Gem\" for at oprette vagten.\n\nDu kan trække og slippe vagter for at flytte dem, eller kopiere en uges vagtplan til næste uge via \"Kopiér uge\"-knappen.\n\nMedarbejderne kan se deres vagtplan i deres egen visning.",
    fix: "Hvis medarbejdere ikke vises i dropdown, tjek at de er oprettet under \"Medarbejdere\".",
  },
];

// Find bedste match i vidensbasen ud fra brugerens spørgsmål
function matchKnowledgeBase(query: string): KbEntry | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  let bestMatch: KbEntry | null = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.length; // længere match = højere score
      }
    }
    // Tjek også om spørgsmålet selv matcher
    if (q.includes(entry.question.toLowerCase().replace("?", ""))) {
      score += 5;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

type ChatMessage = {
  role: "user" | "ai";
  content: string;
  fix?: string;
  fixApplied?: boolean;
};

export default function SupportButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"ai" | "cases">("ai");

  // AI chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content:
        "Hej! Jeg er AI-assistenten. Jeg kan hjælpe med spørgsmål om systemet. Prøv at spørge om f.eks. at oprette en kunde, sende en faktura eller opsætte GPS. Du kan også klikke på et af de foreslåede spørgsmål nedenfor.",
    },
  ]);
  const [suggestedFix, setSuggestedFix] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const { data: cases = [] } = useQuery({
    queryKey: ["/api/support-cases"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/support-cases");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/support-cases", {
        companyId: user?.companyId || 1,
        subject: data.subject,
        message: data.message,
        status: "åben",
        priority: "normal",
        replyStatus: "kladde",
        createdBy: user?.email || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support-cases"] });
      toast({ title: "Support-sag oprettet", description: "Vi behandler sagen og svarer hurtigst muligt." });
      setSubject("");
      setMessage("");
    },
  });

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    createMutation.mutate({ subject, message });
  };

  // AI: Håndter brugerens spørgsmål
  const handleAiAsk = (query?: string) => {
    const q = (query ?? chatInput).trim();
    if (!q) return;

    const userMsg: ChatMessage = { role: "user", content: q };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    const match = matchKnowledgeBase(q);
    if (match) {
      const aiMsg: ChatMessage = {
        role: "ai",
        content: match.answer,
        fix: match.fix,
        fixApplied: false,
      };
      setChatMessages((prev) => [...prev, aiMsg]);
      if (match.fix) {
        setSuggestedFix(match.fix);
      } else {
        setSuggestedFix(null);
      }
    } else {
      const aiMsg: ChatMessage = {
        role: "ai",
        content:
          "Jeg kunne ikke finde et præcist svar på dit spørgsmål. Prøv at omformulere det, eller opret en support-sag så vores team kan hjælpe dig. Du kan klikke på \"Opret support-sag\" fanen ovenfor.\n\nPrøv også et af disse emner:\n• Oprette en kunde\n• Sende en faktura\n• Opsætte GPS\n• Tilkoble e-mail\n• Pris på AI-tilæg\n• Oprette en vagtplan",
      };
      setChatMessages((prev) => [...prev, aiMsg]);
      setSuggestedFix(null);
    }
  };

  // AI: Foreslå rettelse
  const handleSuggestFix = () => {
    if (!suggestedFix) return;
    const aiMsg: ChatMessage = {
      role: "ai",
      content: `Foreslået rettelse:\n\n${suggestedFix}\n\nKlik "Anvend rettelse" for at bekræfte, at du har gennemført den.`,
      fix: suggestedFix,
      fixApplied: false,
    };
    setChatMessages((prev) => [...prev, aiMsg]);
  };

  // AI: Anvend rettelse (marker som løst)
  const handleApplyFix = () => {
    setChatMessages((prev) => {
      const next = [...prev];
      // Marker den sidste AI-besked med fix som anvendt
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].fix && !next[i].fixApplied) {
          next[i] = { ...next[i], fixApplied: true };
          break;
        }
      }
      return next;
    });
    setSuggestedFix(null);
    toast({ title: "Rettelse anvendt", description: "Problemet er markeret som løst." });
    setChatMessages((prev) => [
      ...prev,
      { role: "ai", content: "Rettelsen er anvendt. Er der andet, jeg kan hjælpe med?" },
    ]);
  };

  const priorityLabel = (p: string) => {
    const map: Record<string, string> = { lav: "Lav", normal: "Normal", hoj: "Høj", akut: "Akut" };
    return map[p] || p;
  };

  const priorityColor = (p: string) => {
    const map: Record<string, string> = {
      lav: "badge-soft badge-soft-gray",
      normal: "badge-soft badge-soft-blue",
      hoj: "badge-soft badge-soft-red",
      akut: "badge-soft badge-soft-red",
    };
    return map[p] || "badge-soft badge-soft-gray";
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { aaben: "Åben", under_behandling: "Under behandling", lukket: "Lukket" };
    return map[s] || s;
  };

  return (
    <>
      <button
        data-testid="button-support"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        title="Support"
      >
        <Headset className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex h-[600px] max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Support</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b dark:border-slate-700">
              <button
                onClick={() => setActiveTab("ai")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "ai"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                data-testid="tab-ai-assistant"
              >
                <Sparkles className="h-4 w-4 inline mr-1.5" />
                AI-assistent
              </button>
              <button
                onClick={() => setActiveTab("cases")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "cases"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                data-testid="tab-support-cases"
              >
                <Headset className="h-4 w-4 inline mr-1.5" />
                Support-sager
              </button>
            </div>

            {/* AI Assistant Tab */}
            {activeTab === "ai" && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                        data-testid={`chat-message-${i}`}
                      >
                        {msg.role === "ai" && (
                          <div className="flex items-center gap-1.5 mb-1.5 text-xs font-medium opacity-70">
                            <Sparkles className="h-3.5 w-3.5" /> AI
                          </div>
                        )}
                        {msg.content}
                        {msg.fix && !msg.fixApplied && msg.role === "ai" && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleApplyFix}
                              data-testid={`button-apply-fix-${i}`}
                              className="h-7 text-xs"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Anvend rettelse
                            </Button>
                          </div>
                        )}
                        {msg.fixApplied && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                            <Check className="h-3.5 w-3.5" /> Rettelse anvendt
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Foreslåede spørgsmål */}
                  {chatMessages.length <= 1 && (
                    <div className="space-y-1.5 pt-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ofte stillede spørgsmål:</p>
                      {KNOWLEDGE_BASE.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => handleAiAsk(entry.question)}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                          data-testid={`button-suggested-question-${entry.id}`}
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          {entry.question}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Foreslå rettelse knap */}
                  {suggestedFix && (
                    <div className="flex justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSuggestFix}
                        data-testid="button-suggest-fix"
                        className="h-8 text-xs"
                      >
                        <Wrench className="h-3.5 w-3.5 mr-1.5" />
                        Foreslå rettelse
                      </Button>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* AI input */}
                <div className="border-t p-3 dark:border-slate-700">
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-2">
                    <Sparkles className="h-3 w-3" />
                    AI sender intet uden godkendelse — svar er kun forslag.
                  </div>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-ai-question"
                      placeholder="Skriv dit spørgsmål..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAiAsk();
                        }
                      }}
                    />
                    <Button
                      data-testid="button-ai-ask"
                      onClick={() => handleAiAsk()}
                      disabled={!chatInput.trim()}
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Support Cases Tab */}
            {activeTab === "cases" && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cases.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">Ingen support-sager.</p>
                  )}
                  {cases.map((c: any) => (
                    <div key={c.id} className="rounded-lg border p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">#{c.id} {c.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColor(c.priority)}`}>
                          {priorityLabel(c.priority)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{c.message}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "lukket" ? "badge-soft badge-soft-gray" : "badge-soft badge-soft-blue"}`}>
                          {statusLabel(c.status)}
                        </span>
                        {c.reply && (
                          <span className="text-xs text-slate-500">Svar: {c.reply.substring(0, 50)}...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create form */}
                <div className="border-t p-4 space-y-2 dark:border-slate-700">
                  <Input
                    data-testid="input-support-subject"
                    placeholder="Emne"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  <Textarea
                    data-testid="input-support-message"
                    placeholder="Beskriv dit problem..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                  <Button
                    data-testid="button-support-submit"
                    onClick={handleSubmit}
                    disabled={!subject.trim() || !message.trim() || createMutation.isPending}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? "Sender..." : "Opret support-sag"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

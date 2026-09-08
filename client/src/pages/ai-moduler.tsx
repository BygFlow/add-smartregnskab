import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, SectionCard } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const AI_FEATURES = [
  { label: "AI-assistent", desc: "Global chat-assistent der hjælper med drift, planlægning og kundehåndtering." },
  { label: "AI lead-scoring", desc: "Automatisk vurdering af kunder/leads baseret på aktivitet, historik og værdi." },
  { label: "AI auto-planlægning", desc: "Intelligent vagtplanlægning og ruteoptimering baseret på opgaver og ansatte." },
];

export default function AiModuler() {
  const { hasAI, refresh } = useAuth() as any;
  const { toast } = useToast();

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) =>
      (await apiRequest("PATCH", "/api/company/ai", { enabled })).json(),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: enabled ? "AI-tilæg aktiveret" : "AI-tilæg deaktiveret",
        description: enabled ? "Alle AI-funktioner er nu tilgængelige." : "AI-funktioner er nu låst.",
      });
      refresh?.();
    },
    onError: (e: Error) => toast({ title: "Fejl", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-3" data-testid="page-ai-moduler">
      <PageHeader title="AI-tilæg" description="Tilkøb AI-funktioner til din virksomhed" />

      <SectionCard title="AI-tilæg" icon={<Sparkles className="w-4 h-4" />} className="overflow-hidden" noPadding>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">Komplet AI-pakke</span>
              <p className="text-xs text-muted-foreground mt-0.5">Alle AI-funktioner samlet i ét tilæg</p>
            </div>
            <span className="text-[11px] text-primary font-medium">199 kr./md</span>
          </div>
          <div className="divide-y divide-border/50">
            {AI_FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
                {hasAI && <Check className="w-4 h-4 text-primary shrink-0 mt-1" />}
              </div>
            ))}
          </div>
          <Button
            data-testid="button-ai-toggle"
            onClick={() => toggle.mutate(!hasAI)}
            disabled={toggle.isPending}
            className="w-full"
            variant={hasAI ? "outline" : "default"}
          >
            {toggle.isPending ? "..." : hasAI ? "Deaktiver AI-tilæg" : "Aktiver AI-tilæg (199 kr./md)"}
          </Button>
        </div>
      </SectionCard>

      {!hasAI && (
        <div className="rounded-md border border-border/50 bg-muted/30 p-4 space-y-2" data-testid="notice-ai-locked">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">AI-funktioner er låst</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Når AI-tilæg ikke er aktiveret, er AI-assistenten, lead-scoring og auto-planlægning skjult.
            Aktivér tilægget ovenfor for at få adgang.
          </p>
        </div>
      )}
    </div>
  );
}

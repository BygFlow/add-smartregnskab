import { useAuth } from "@/lib/auth";
import { Lock } from "lucide-react";
import { Link } from "wouter";

/** Viser børn kun når AI-tilæg er aktiveret. Ellers vises en låst placeholder. */
export function AiGate({ children, label = "AI-funktion" }: { children: React.ReactNode; label?: string }) {
  const { hasAI } = useAuth();
  if (hasAI) return <>{children}</>;
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-6 text-center space-y-2" data-testid="notice-ai-locked">
      <Lock className="w-5 h-5 mx-auto text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label} kræver AI-tilæg</p>
      <p className="text-xs text-muted-foreground">Aktivér AI-tilæg for at bruge denne funktion.</p>
      <Link href="/ai-moduler" className="text-xs text-primary underline" data-testid="link-ai-moduler">
        Aktivér AI-tilæg (199 kr./md)
      </Link>
    </div>
  );
}

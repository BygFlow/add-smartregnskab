import { Phone, Mail, MessageCircle, Monitor } from "lucide-react";
import { Headset } from "lucide-react";

export function SupportPanel() {
  return (
    <aside className="hidden xl:flex flex-col w-64 shrink-0 border-l border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Headset className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Support</span>
      </div>

      <div className="flex flex-col items-center px-4 py-6 border-b border-border">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
          <Headset className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground text-center">Brug for hjælp?</p>
        <p className="text-xs text-muted-foreground text-center mt-1">Vi er klar alle hverdage 8-16</p>
      </div>

      <div className="p-3 space-y-2">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/50 transition-colors text-sm" data-testid="button-support-phone">
          <Phone className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground">Telefon</span>
        </button>
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/50 transition-colors text-sm" data-testid="button-support-email">
          <Mail className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground">E-mail</span>
        </button>
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/50 transition-colors text-sm" data-testid="button-support-chat">
          <MessageCircle className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground">Chat</span>
        </button>
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/50 transition-colors text-sm" data-testid="button-support-remote">
          <Monitor className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground">Fjernsupport</span>
        </button>
      </div>

      <div className="mt-auto p-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground text-center">ADD SmartRegnskab v1.0</p>
      </div>
    </aside>
  );
}

import { useAuth } from"@/lib/auth";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from"@/App";
import { Button } from"@/components/ui/button";
import { Skeleton } from"@/components/ui/skeleton";
import { Bell, AlertTriangle, CheckCircle2, Info, CheckCheck, Trash2 } from"lucide-react";

const TYPE_ICON = {
 info: { icon: Info, color:"text-blue-500" },
 warning: { icon: AlertTriangle, color:"text-amber-500" },
 success: { icon: CheckCircle2, color:"text-emerald-500" },
};

export default function Notifikationer() {
 const { companyId } = useAuth();
 const { data: notifs, isLoading } = useNotifications(companyId);
 const markRead = useMarkNotificationRead(companyId);
 const markAllRead = useMarkAllNotificationsRead(companyId);

 if (isLoading) {
 return (
 <div className="p-4 space-y-6">
 <Skeleton className="h-8 w-64" />
 <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
 </div>
 );
 }

 const list = (notifs || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
 const unread = list.filter(n => !n.read);

 return (
 <div className="p-4 md:p-4 space-y-5 max-w-3xl mx-auto">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div>
 <h1 className="text-lg font-bold text-foreground">Notifikationer</h1>
 <p className="text-sm text-muted-foreground mt-0.5">{unread.length} ulæste af {list.length} total</p>
 </div>
 {unread.length > 0 && (
 <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} data-testid="button-mark-all-read">
 <CheckCheck className="w-4 h-4 mr-1.5" />Marker alle som læst
 </Button>
 )}
 </div>

 {list.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
 <p className="text-sm">Ingen notifikationer</p>
 </div>
 ) : (
 <div className="space-y-2">
 {list.map((n) => {
 const cfg = TYPE_ICON[n.type as keyof typeof TYPE_ICON] || TYPE_ICON.info;
 return (
 <div
 key={n.id}
 className={`flex items-start gap-3 p-4 rounded-md border transition-colors ${n.read ?"bg-card border-border opacity-70" :"bg-card border-primary/30"}`}
 data-testid={`card-notif-${n.id}`}
 >
 <div className={`mt-0.5 shrink-0 ${cfg.color}`}><cfg.icon className="w-5 h-5" /></div>
 <div className="flex-1 min-w-0 pr-1">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-foreground truncate">{n.title}</span>
 {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
 </div>
 {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
 <div className="text-[10px] text-muted-foreground mt-1.5">{new Date(n.createdAt).toLocaleString("da-DK")}</div>
 </div>
 {!n.read && (
 <button onClick={() => markRead.mutate(n.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0" data-testid={`button-read-notif-${n.id}`}>
 <CheckCircle2 className="w-4 h-4" />
 </button>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}

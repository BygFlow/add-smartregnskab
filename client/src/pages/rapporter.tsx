import { useAuth } from "@/lib/auth";
import { openAuthedFile } from "@/lib/queryClient";
import { useTimeEntries, useTasks, useEmployees, useCustomers, formatDuration, formatCurrency } from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, FileText, Users, Building2, Clock } from "lucide-react";

export default function Rapporter() {
  const { companyId } = useAuth();
  const { data: timeEntries, isLoading: teLoading } = useTimeEntries(companyId);
  const { data: tasks, isLoading: tLoading } = useTasks(companyId);
  const { data: employees, isLoading: eLoading } = useEmployees(companyId);
  const { data: customers, isLoading: cLoading } = useCustomers(companyId);

  const loading = teLoading || tLoading || eLoading || cLoading;

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-md" />)}
        </div>
      </div>
    );
  }

  const entries = (timeEntries || []).filter(t => t.durationMinutes);
  const empMap = new Map((employees || []).map(e => [e.id, e]));
  const custMap = new Map((customers || []).map(c => [c.id, c]));
  const taskMap = new Map((tasks || []).map(t => [t.id, t]));

  // By employee
  const byEmp = new Map<number, number>();
  entries.forEach(t => byEmp.set(t.employeeId, (byEmp.get(t.employeeId) || 0) + (t.durationMinutes || 0)));

  // By customer
  const byCust = new Map<number, { mins: number; rate: number }>();
  entries.forEach(t => {
    const task = taskMap.get(t.taskId || 0);
    if (task?.customerId) {
      const cust = custMap.get(task.customerId);
      const rate = cust?.hourlyRate || 350;
      const cur = byCust.get(task.customerId) || { mins: 0, rate };
      cur.mins += t.durationMinutes || 0;
      byCust.set(task.customerId, cur);
    }
  });

  // Totals
  const totalMinutes = entries.reduce((s, t) => s + (t.durationMinutes || 0), 0);
  const totalRevenue = Array.from(byCust.entries()).reduce((s, [_, v]) => s + (v.mins / 60) * v.rate, 0);

  const exportCSV = (type: string) => {
    openAuthedFile(`/api/reports/${type}?companyId=${companyId}`);
  };

  const reportCards = [
    { title: "Timer pr. ansat", desc: "Total registrerede timer for hver medarbejder", icon: Users, action: () => exportCSV("time-by-employee"), count: byEmp.size },
    { title: "Timer pr. kunde", desc: "Registrerede timer og omsætning pr. kunde", icon: Building2, desc2: `Omsætning: ${formatCurrency(totalRevenue)}`, action: () => exportCSV("time-by-customer"), count: byCust.size },
    { title: "Opgaverapport", desc: "Alle opgaver med status, kunde og ansat", icon: FileText, action: () => exportCSV("tasks"), count: (tasks || []).length },
    { title: "Lønrapport", desc: "Timer pr. ansat til lønkørsel", icon: Clock, action: () => exportCSV("time-by-employee"), count: byEmp.size },
  ];

  return (
    <div className="p-4 md:p-4 space-y-3 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-foreground">Rapporter</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Eksportér data som CSV-filer</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-card border border-border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">Total timer</div>
          <div className="text-sm font-bold text-foreground">{formatDuration(totalMinutes)}</div>
        </div>
        <div className="bg-card border border-border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">Total omsætning</div>
          <div className="text-sm font-bold text-foreground">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-card border border-border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">Ansatte</div>
          <div className="text-sm font-bold text-foreground">{(employees || []).length}</div>
        </div>
        <div className="bg-card border border-border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">Kunder</div>
          <div className="text-sm font-bold text-foreground">{(customers || []).length}</div>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {reportCards.map((r) => (
          <div key={r.title} className="bg-card border border-border rounded-md p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center text-primary shrink-0">
                <r.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-xs text-foreground">{r.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</p>
                {r.desc2 && <p className="text-[11px] font-medium text-primary mt-0.5">{r.desc2}</p>}
              </div>
            </div>
            <Button onClick={r.action} variant="outline" className="w-full" data-testid={`button-export-${r.title.toLowerCase().replace(/\s+/g, "-")}`}>
              <Download className="w-4 h-4 mr-1.5" />Eksportér CSV
            </Button>
          </div>
        ))}
      </div>

      {/* Detail: by employee */}
      <div className="bg-card border border-border rounded-md p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timer pr. ansat</h2>
        <div className="divide-y divide-border/50">
          {Array.from(byEmp.entries()).map(([empId, mins]) => {
            const emp = empMap.get(empId);
            return (
              <div key={empId} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs text-foreground">{emp?.name || "Ukendt"}</div>
                  <div className="text-[11px] text-muted-foreground">{emp?.role}</div>
                </div>
                <div className="text-xs font-medium text-foreground">{formatDuration(mins)}</div>
              </div>
            );
          })}
          {byEmp.size === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Ingen data</p>}
        </div>
      </div>

      {/* Detail: by customer */}
      <div className="bg-card border border-border rounded-md p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timer og omsætning pr. kunde</h2>
        <div className="divide-y divide-border/50">
          {Array.from(byCust.entries()).map(([custId, data]) => {
            const cust = custMap.get(custId);
            const hours = data.mins / 60;
            const amount = hours * data.rate;
            return (
              <div key={custId} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs text-foreground">{cust?.name || "Ukendt"}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDuration(data.mins)} × {formatCurrency(data.rate)}/t</div>
                </div>
                <div className="text-xs font-medium text-foreground">{formatCurrency(amount)}</div>
              </div>
            );
          })}
          {byCust.size === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Ingen data</p>}
        </div>
      </div>
    </div>
  );
}

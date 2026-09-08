import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useTimeEntries, useEmployees, useCreateTimeEntry, useUpdateTimeEntry, useDeleteTimeEntry, formatDuration, todayStr } from "@/App";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, MapPin, Trash2, Clock, Calendar, List, Plus, Navigation, CheckCircle2, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { TimeEntry } from "@shared/schema";
import { PageHeader, MetricCard, SectionCard } from "@/components/premium";

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
function mondayOf(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(12, 0, 0, 0);
  return copy;
}
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function iso(d: Date) { return d.toISOString().slice(0, 10); }

export default function Tidregistrering() {
  const { companyId, user } = useAuth();
  const role = user?.role;
  const isAssistent = role === "assistent";
  const { data: timeEntries, isLoading } = useTimeEntries(companyId);
  const { data: employees } = useEmployees(companyId);
  const createTimeEntry = useCreateTimeEntry(companyId);
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const { toast } = useToast();

  const isCompany = ["leder", "holdleder", "platform_admin"].includes(user?.role || "");
  const [selectedEmp, setSelectedEmp] = useState(user?.employeeId?.toString() || "");
  const [now, setNow] = useState(Date.now());
  const [manualOpen, setManualOpen] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const entries = timeEntries || [];
  const empEntries = selectedEmp ? entries.filter(t => t.employeeId === Number(selectedEmp)) : entries;
  const activeTimers = empEntries.filter(t => !t.endTime);
  const completedEntries = empEntries.filter(t => t.endTime && t.durationMinutes);

  const empName = (id: number) => employees?.find(e => e.id === id)?.name || "Ukendt";
  const empId = selectedEmp ? Number(selectedEmp) : null;
  const selectedEmpData = employees?.find(e => e.id === empId);
  const gpsRequired = selectedEmpData ? selectedEmpData.gpsRequired !== 0 : true;

  // Group by date
  const grouped = completedEntries.reduce((acc, t) => {
    (acc[t.date] = acc[t.date] || []).push(t);
    return acc;
  }, {} as Record<string, TimeEntry[]>);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Stats
  const totalMinutes = completedEntries.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const todayMinutes = completedEntries.filter(t => t.date === todayStr()).reduce((sum, t) => sum + (t.durationMinutes || 0), 0);

  // Ugentlig opsummering per ansat (aktuel uge)
  const weekStart = mondayOf(new Date());
  const weekKey = isoWeek(new Date());
  const weeklyByEmployee = useMemo(() => {
    const weekEntries = entries.filter(t => {
      const d = new Date(t.date + "T12:00:00");
      return d >= weekStart && d < addDays(weekStart, 7);
    });
    const map = new Map<number, { name: string; minutes: number; count: number }>();
    for (const t of weekEntries) {
      if (!t.endTime || !t.durationMinutes) continue;
      const emp = employees?.find(e => e.id === t.employeeId);
      const cur = map.get(t.employeeId) ?? { name: emp?.name || `Ansat #${t.employeeId}`, minutes: 0, count: 0 };
      cur.minutes += t.durationMinutes;
      cur.count += 1;
      map.set(t.employeeId, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.minutes - a.minutes);
  }, [entries, employees, weekStart]);

  const handleStart = async () => {
    if (!selectedEmp) {
      toast({ title: "Vælg ansat", variant: "destructive" });
      return;
    }
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // GPS — kræves kun når virksomheden har aktiveret gpsRequired for medarbejderen
    let lat: number | null = null;
    let lng: number | null = null;
    if (gpsRequired) {
      if (!("geolocation" in navigator)) {
        toast({ title: "GPS kræves", description: "GPS er ikke tilgængelig på denne enhed, men er påkrævet for medarbejderen.", variant: "destructive" });
        return;
      }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        toast({ title: "GPS kræves", description: "GPS blev afvist eller er ikke tilgængelig. Stempling kræver GPS for denne medarbejder.", variant: "destructive" });
        return;
      }
    } else if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}
    }

    await createTimeEntry.mutateAsync({
      employeeId: Number(selectedEmp),
      date: todayStr(),
      startTime: time,
      note: "",
      checkInLat: lat,
      checkInLng: lng,
    });
    toast({ title: "Tidsmåler startet", description: lat ? `Check-in lokation registreret` : "Uden GPS" });
  };

  const handleStop = async (entry: TimeEntry) => {
    const now = new Date();
    const endTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const start = new Date(`${entry.date}T${entry.startTime}:00`);
    const end = new Date(`${entry.date}T${endTime}:00`);
    const duration = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 60000));

    // GPS checkout
    let lat: number | null = null;
    let lng: number | null = null;
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}
    }

    await updateTimeEntry.mutateAsync({
      id: entry.id,
      data: { endTime, durationMinutes: duration, checkOutLat: lat, checkOutLng: lng },
    });
    toast({ title: "Tidsmåler stoppet", description: formatDuration(duration) });
  };

  const saveNote = async (entry: TimeEntry, note: string) => {
    await updateTimeEntry.mutateAsync({ id: entry.id, data: { note } });
    setNoteDrafts((prev) => { const n = { ...prev }; delete n[entry.id]; return n; });
    toast({ title: "Notat gemt" });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  // ── Assistent: view-only — kan kun se egne registreringer ──
  if (isAssistent) {
    const myEntries = (timeEntries || []).filter((e: TimeEntry) => e.employeeId === user?.employeeId);
    const myCompleted = myEntries.filter((e: TimeEntry) => e.endTime);
    const todayMinutes = myCompleted
      .filter((e: TimeEntry) => e.date === todayStr())
      .reduce((acc: number, e: TimeEntry) => acc + (e.durationMinutes || 0), 0);
    const totalMinutes = myCompleted.reduce((acc: number, e: TimeEntry) => acc + (e.durationMinutes || 0), 0);
    const grouped: Record<string, TimeEntry[]> = {};
    for (const e of myCompleted) { (grouped[e.date] ||= []).push(e); }
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return (
      <div className="p-4 pb-24 space-y-3 max-w-4xl mx-auto">
        <PageHeader eyebrow="Tid" title="Mine registreringer" description="Din arbejdstid registreres automatisk via opgaveforløb" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard icon={<Clock className="w-5 h-5" />} value={formatDuration(todayMinutes)} label="I dag" variant="primary" valueTestId="text-time-today" />
          <MetricCard icon={<Calendar className="w-5 h-5" />} value={formatDuration(totalMinutes)} label="Total" variant="blue" />
          <MetricCard icon={<List className="w-5 h-5" />} value={myCompleted.length} label="Registreringer" variant="green" />
        </div>

        <SectionCard title="Historik">
          {sortedDates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Ingen tidsregistreringer</p>
          ) : (
            <div className="space-y-3">
              {sortedDates.map((date) => (
                <div key={date}>
                  <div className="text-xs font-medium text-muted-foreground mb-2">{date}</div>
                  <div className="divide-y divide-border/50">
                    {grouped[date].map((entry: TimeEntry) => (
                      <div key={entry.id} className="py-2" data-testid={`row-time-${entry.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span>{entry.startTime} - {entry.endTime}</span>
                              <GpsIndicator entry={entry} />
                            </div>
                            <div className="text-xs font-medium text-foreground mt-0.5">{formatDuration(entry.durationMinutes || 0)}</div>
                            {entry.note && <div className="text-xs text-muted-foreground mt-1">{entry.note}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-3 max-w-4xl mx-auto">
      <PageHeader eyebrow="Tid" title="Tidsregistrering" description="Registrering af arbejdstid med GPS-stemplning" />

      {/* Employee selector + stamping */}
      <SectionCard>
        <div className="space-y-3">
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <Label>Vælg ansat</Label>
              {selectedEmp && (
                gpsRequired ? (
                  <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100" data-testid="badge-gps-required">
                    <MapPin className="w-3 h-3 mr-0.5" />GPS kræves
                  </Badge>
                ) : (
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100" data-testid="badge-gps-optional">
                    <MapPin className="w-3 h-3 mr-0.5" />GPS valgfrit
                  </Badge>
                )
              )}
            </div>
            <Select value={selectedEmp} onValueChange={setSelectedEmp}>
              <SelectTrigger data-testid="select-time-employee"><SelectValue placeholder="Vælg ansat" /></SelectTrigger>
              <SelectContent>
                {(employees || []).map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isCompany && (
            <Button variant="outline" onClick={() => setManualOpen(true)} data-testid="button-manual-arrival">
              <Plus className="w-4 h-4 mr-1.5" />
              Registrér ankomst
            </Button>
          )}
        </div>

        {/* Active timers */}
        {activeTimers.length > 0 && (
          <div className="space-y-2">
            {activeTimers.map((timer) => {
              const startMs = new Date(`${timer.date}T${timer.startTime}:00`).getTime();
              let elapsed = Math.floor((now - startMs) / 60000);
              if (elapsed < 0) elapsed = 0;
              return (
                <div key={timer.id} className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3" data-testid={`card-active-timer-${timer.id}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{empName(timer.employeeId)}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Startet {timer.startTime} • {formatDuration(elapsed)}</span>
                      <GpsIndicator entry={timer} />
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => handleStop(timer)} data-testid={`button-stop-timer-${timer.id}`}>
                    <Square className="w-3.5 h-3.5 mr-1" />Stop
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Start button */}
        {activeTimers.length === 0 && (
          <Button onClick={handleStart} className="w-full" disabled={!selectedEmp || createTimeEntry.isPending} data-testid="button-start-timer">
            <Play className="w-4 h-4 mr-1.5" />
            {createTimeEntry.isPending ? "Starter..." : gpsRequired ? "Stempel ind med GPS" : "Stempel ind"}
          </Button>
        )}
        </div>
      </SectionCard>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard icon={<Clock className="w-5 h-5" />} value={formatDuration(todayMinutes)} label="I dag" variant="primary" valueTestId="text-time-today" />
        <MetricCard icon={<Calendar className="w-5 h-5" />} value={formatDuration(totalMinutes)} label="Total" variant="blue" />
        <MetricCard icon={<List className="w-5 h-5" />} value={completedEntries.length} label="Registreringer" variant="green" />
      </div>

      {/* Weekly summary per employee */}
      <SectionCard title={`Ugentlig oversigt — uge ${weekKey}`} icon={<Calendar className="w-4 h-4" />}>
        {weeklyByEmployee.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Ingen registreringer denne uge</p>
        ) : (
          <div className="divide-y divide-border/50" data-testid="weekly-summary">
            {weeklyByEmployee.map((row) => (
              <div key={row.id} className="flex items-center justify-between py-2" data-testid={`row-weekly-${row.id}`}>
                <div>
                  <p className="text-sm font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.count} registreringer</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground" data-testid={`text-weekly-minutes-${row.id}`}>{formatDuration(row.minutes)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* History */}
      <SectionCard title="Historik">
        {sortedDates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Ingen tidsregistreringer</p>
        ) : (
          <div className="space-y-3">
            {sortedDates.map((date) => (
              <div key={date}>
                <div className="text-xs font-medium text-muted-foreground mb-2">{date}</div>
                <div className="divide-y divide-border/50">
                  {grouped[date].map((entry) => (
                    <div key={entry.id} className="py-2 space-y-2" data-testid={`row-time-${entry.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-foreground font-medium">{empName(entry.employeeId)}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{entry.startTime} - {entry.endTime}</span>
                            <GpsIndicator entry={entry} />
                            {entry.checkOutLat && <span className="flex items-center gap-0.5 text-muted-foreground"><Navigation className="w-3 h-3" />Ud-GPS</span>}
                          </div>
                          <div className="text-xs font-medium text-foreground mt-0.5">{formatDuration(entry.durationMinutes || 0)}</div>
                        </div>
                        <button onClick={() => deleteTimeEntry.mutate(entry.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid={`button-delete-time-${entry.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Notatfelt — redigerbart */}
                      <div className="flex gap-2 pl-0">
                        <Textarea
                          value={noteDrafts[entry.id] ?? entry.note ?? ""}
                          onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                          placeholder="Tilføj notat til registreringen…"
                          rows={2}
                          data-testid={`textarea-time-note-${entry.id}`}
                          className="text-xs resize-y"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateTimeEntry.isPending}
                          onClick={() => saveNote(entry, noteDrafts[entry.id] ?? entry.note ?? "")}
                          data-testid={`button-save-note-${entry.id}`}
                        >
                          Gem
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ManualArrivalDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        employees={employees || []}
        pending={createTimeEntry.isPending}
        onSubmit={async (data) => {
          await createTimeEntry.mutateAsync(data);
          queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
          setManualOpen(false);
          toast({ title: "Ankomst registreret", description: `${data.startTime} for ${employees?.find(e => e.id === data.employeeId)?.name || "ansat"}` });
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GPS-indikator — viser om GPS var aktiv ved stempling
// ═══════════════════════════════════════════════════════════════

function GpsIndicator({ entry }: { entry: TimeEntry }) {
  const hasGps = entry.checkInLat != null && entry.checkInLng != null;
  if (hasGps) {
    return (
      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" data-testid={`gps-active-${entry.id}`} title="GPS var aktiv ved stempling">
        <MapPin className="w-3 h-3" />GPS aktiv
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400" data-testid={`gps-inactive-${entry.id}`} title="Ingen GPS ved stempling">
      <MapPin className="w-3 h-3" />Ingen GPS
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// Manuel ankomstregistrering — virksomheden kan indtaste for en ansat
// ═══════════════════════════════════════════════════════════════

function ManualArrivalDialog({ open, onOpenChange, employees, pending, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: { id: number; name: string }[];
  pending: boolean;
  onSubmit: (data: { employeeId: number; date: string; startTime: string; note: string }) => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id.toString() || "");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !employeeId && employees.length > 0) setEmployeeId(employees[0].id.toString());
  }, [open, employeeId, employees]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return setError("Vælg en ansat.");
    setError(null);
    onSubmit({ employeeId: Number(employeeId), date, startTime, note: note.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrér ankomst</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-muted-foreground">Registrér en ankomsttid for en ansat manuelt — f.eks. hvis stempling ikke blev foretaget.</p>
          <div className="space-y-1.5">
            <Label>Ansat *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger data-testid="select-manual-employee"><SelectValue placeholder="Vælg ansat" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-date">Dato *</Label>
              <Input id="manual-date" type="date" data-testid="input-manual-date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-start">Ankomsttid *</Label>
              <Input id="manual-start" type="time" data-testid="input-manual-start" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-note">Notat</Label>
            <Textarea id="manual-note" rows={2} data-testid="input-manual-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfrit notat" />
          </div>
          {error && <p className="text-xs text-destructive" data-testid="text-manual-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending} data-testid="button-save-manual">
            {pending ? "Gemmer..." : "Registrér ankomst"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, UserPlus, Check, X, Clock, AlertCircle } from "lucide-react";

/* ----------------------------- Typer ----------------------------- */

interface SubstitutionSuggestion {
  id: number;
  companyId: number;
  absenceId: number;
  originalEmployeeId: number | null;
  suggestedEmployeeId: number | null;
  shiftId: number | null;
  taskId: number | null;
  reason: string;
  score: number | string | null;
  status: "foreslaaet" | "accepteret" | "afvist" | "udløbet";
  respondedAt?: string | null;
  createdAt?: string | null;
}

interface Absence {
  id: number;
  companyId: number;
  employeeId: number | null;
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  reason?: string | null;
  type?: string | null;
  createdAt?: string | null;
}

interface Employee {
  id: number;
  companyId?: number;
  name?: string | null;
  fullName?: string | null;
}

interface Named {
  id: number;
  name?: string | null;
  fullName?: string | null;
}

/* --------------------------- Hjælpere ---------------------------- */

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("da-DK") : "—";

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
};

const nameOf = (x?: Named | null) => x?.name ?? x?.fullName ?? "Ukendt medarbejder";

type StatusKey = "foreslaaet" | "accepteret" | "afvist" | "udløbet";

const STATUS_META: Record<StatusKey, { label: string; cls: string; icon: React.ElementType }> = {
  foreslaaet: { label: "Foreslået", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  accepteret: { label: "Accepteret", cls: "bg-green-100 text-green-800 border-green-300", icon: Check },
  afvist: { label: "Afvist", cls: "bg-red-100 text-red-800 border-red-300", icon: X },
  udløbet: { label: "Udløbet", cls: "bg-gray-100 text-gray-700 border-gray-300", icon: AlertCircle },
};

type ReasonKey = "kompetence_match" | "lokation_naerhed" | "ledig" | "rolle_match";

const REASON_META: Record<ReasonKey, { label: string; cls: string }> = {
  kompetence_match: { label: "Kompetence", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  lokation_naerhed: { label: "Lokation", cls: "bg-green-100 text-green-800 border-green-300" },
  ledig: { label: "Ledig", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  rolle_match: { label: "Rolle", cls: "bg-purple-100 text-purple-800 border-purple-300" },
};

function reasonBadge(reason: string) {
  const key = (reason as ReasonKey);
  const meta = REASON_META[key];
  if (!meta) return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">{reason || "—"}</Badge>;
  return <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>;
}

function scoreColor(score: number) {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function scoreBadgeCls(score: number) {
  if (score >= 75) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-red-100 text-red-800 border-red-300";
}

/* ----------------------------- Komponent ----------------------------- */

export default function VikarFlow({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [generating, setGenerating] = useState<number | null>(null);

  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ["substitution-suggestions", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/substitution-suggestions?companyId=${companyId}`);
      const json = await res.json();
      return (json ?? []) as SubstitutionSuggestion[];
    },
  });

  const { data: absences = [], isLoading: loadingAbsences } = useQuery({
    queryKey: ["absences", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/absences?companyId=${companyId}`);
      const json = await res.json();
      return (json ?? []) as Absence[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employees?companyId=${companyId}`);
      const json = await res.json();
      return (json ?? []) as Employee[];
    },
  });

  const employeeById = useMemo(() => {
    const m = new Map<number, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const acceptedByAbsence = useMemo(() => {
    const s = new Set<number>();
    for (const sugg of suggestions) {
      if (sugg.status === "accepteret") s.add(sugg.absenceId);
    }
    return s;
  }, [suggestions]);

  const absencesNeedingCoverage = useMemo(
    () => absences.filter((a) => !acceptedByAbsence.has(a.id)),
    [absences, acceptedByAbsence],
  );

  const stats = useMemo(() => {
    const pending = suggestions.filter((s) => s.status === "foreslaaet").length;
    const accepted = suggestions.filter((s) => s.status === "accepteret").length;
    const rejected = suggestions.filter((s) => s.status === "afvist").length;
    return { total: suggestions.length, pending, accepted, rejected };
  }, [suggestions]);

  const generateMutation = useMutation({
    mutationFn: async (absenceId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/substitution-suggestions/generate/${absenceId}`,
        {},
      );
      return res.json();
    },
    onSuccess: (_data, absenceId) => {
      toast({ title: "Forslag genereret", description: "Vikarforslag er nu oprettet." });
      setGenerating(null);
      void absenceId;
      qc.invalidateQueries({ queryKey: ["substitution-suggestions", companyId] });
      qc.invalidateQueries({ queryKey: ["absences", companyId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Kunne ikke generere forslag";
      toast({ title: "Fejl", description: msg, variant: "destructive" });
      setGenerating(null);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: StatusKey }) => {
      const res = await apiRequest("PATCH", `/api/substitution-suggestions/${id}`, {
        status,
        respondedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.status === "accepteret" ? "Forslag accepteret" : "Forslag afvist",
      });
      qc.invalidateQueries({ queryKey: ["substitution-suggestions", companyId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Handlingen fejlede";
      toast({ title: "Fejl", description: msg, variant: "destructive" });
    },
  });

  const onGenerate = (absenceId: number) => {
    setGenerating(absenceId);
    generateMutation.mutate(absenceId);
  };

  /* ----------------------------- Render ----------------------------- */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold tracking-tight">Vikarflow</h2>
        </div>
        {user && <span className="text-sm text-muted-foreground">Firma #{companyId}</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Forslag i alt" value={stats.total} icon={Users} accent="blue" />
        <StatCard label="Afventende" value={stats.pending} icon={Clock} accent="amber" />
        <StatCard label="Accepteret" value={stats.accepted} icon={Check} accent="green" />
        <StatCard label="Afvist" value={stats.rejected} icon={X} accent="red" />
      </div>

      {/* Fravær der dækning */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <h3 className="text-base font-semibold">Fravær der dækning</h3>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            {absencesNeedingCoverage.length}
          </Badge>
        </div>

        {loadingAbsences ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Indlæser fravær…</CardContent></Card>
        ) : absencesNeedingCoverage.length === 0 ? (
          <EmptyState
            icon={Check}
            title="Alt fravær er dækket"
            text="Der er i øjeblikket intet fravær, der mangler dækning."
          />
        ) : (
          <div className="space-y-2">
            {absencesNeedingCoverage.map((a) => {
              const emp = a.employeeId ? employeeById.get(a.employeeId) : null;
              const dateStr = a.date ?? a.startDate ?? a.createdAt;
              const isGenerating = generating === a.id;
              return (
                <Card key={a.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{nameOf(emp)}</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          {fmtDate(dateStr)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Årsag: {(a.reason || a.type || "Ikke angivet").replace(/_/g, " ")}
                      </p>
                    </div>
                    <Button
                      data-testid={`generate-suggestions-${a.id}`}
                      onClick={() => onGenerate(a.id)}
                      disabled={isGenerating || generateMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {isGenerating ? "Genererer…" : "Generer forslag"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Alle forslag */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-blue-600" />
          <h3 className="text-base font-semibold">Alle forslag</h3>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            {suggestions.length}
          </Badge>
        </div>

        {loadingSuggestions ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Indlæser forslag…</CardContent></Card>
        ) : suggestions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Ingen forslag endnu"
            text="Generer forslag fra fravær ovenfor for at se vikarforslag her."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dato</TableHead>
                      <TableHead>Fraværende medarbejder</TableHead>
                      <TableHead>Foreslået vikar</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Årsag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.map((s) => {
                      const score = num(s.score);
                      const pct = Math.max(0, Math.min(100, score));
                      const original = s.originalEmployeeId ? employeeById.get(s.originalEmployeeId) : null;
                      const suggested = s.suggestedEmployeeId ? employeeById.get(s.suggestedEmployeeId) : null;
                      const meta = STATUS_META[s.status] ?? STATUS_META.foreslaaet;
                      const StatusIcon = meta.icon;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {fmtDate(s.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">{nameOf(original)}</TableCell>
                          <TableCell className="text-sm">{nameOf(suggested)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className={`h-full ${scoreColor(pct)}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <Badge variant="outline" className={scoreBadgeCls(pct)}>
                                {pct}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{reasonBadge(s.reason)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.cls}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {s.status === "foreslaaet" ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  data-testid={`accept-suggestion-${s.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="border-green-300 text-green-700 hover:bg-green-50"
                                  disabled={respondMutation.isPending}
                                  onClick={() =>
                                    respondMutation.mutate({ id: s.id, status: "accepteret" })
                                  }
                                >
                                  <Check className="mr-1 h-3.5 w-3.5" /> Accepter
                                </Button>
                                <Button
                                  data-testid={`reject-suggestion-${s.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-700 hover:bg-red-50"
                                  disabled={respondMutation.isPending}
                                  onClick={() =>
                                    respondMutation.mutate({ id: s.id, status: "afvist" })
                                  }
                                >
                                  <X className="mr-1 h-3.5 w-3.5" /> Afvis
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

/* --------------------------- Sub-komponenter --------------------------- */

const ACCENTS: Record<string, { ring: string; icon: string }> = {
  blue: { ring: "bg-blue-50", icon: "text-blue-600" },
  amber: { ring: "bg-amber-50", icon: "text-amber-600" },
  green: { ring: "bg-green-50", icon: "text-green-600" },
  red: { ring: "bg-red-50", icon: "text-red-600" },
};

function StatCard({
  label, value, icon: Icon, accent,
}: { label: string; value: number; icon: React.ElementType; accent: keyof typeof ACCENTS }) {
  const a = ACCENTS[accent] ?? ACCENTS.blue;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.ring}`}>
          <Icon className={`h-4 w-4 ${a.icon}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-none">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon, title, text,
}: { icon: React.ElementType; title: string; text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

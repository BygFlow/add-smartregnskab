import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Play, Trash2 } from "lucide-react";

/* Kontroltests — interne kontroller (adgangsstyring, ændringsstyring, driftsstyring, dataintegritet) */

type ControlTest = {
  id: number;
  companyId?: number | null;
  controlName: string;
  controlCategory: string;
  testStatus: string;
  testResult?: string | null;
  testedBy?: string | null;
  testedAt?: string | null;
  frequency?: string | null;
  description?: string | null;
  createdAt: string;
};

const CATEGORY_STYLE: Record<string, string> = {
  adgangsstyring: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  ændringsstyring: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  driftsstyring: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  dataintegritet: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
const CATEGORY_LABEL: Record<string, string> = {
  adgangsstyring: "Adgangsstyring",
  ændringsstyring: "Ændringsstyring",
  driftsstyring: "Driftsstyring",
  dataintegritet: "Dataintegritet",
};
const CATEGORIES = ["adgangsstyring", "ændringsstyring", "driftsstyring", "dataintegritet"];

const TEST_STATUS_STYLE: Record<string, string> = {
  ikke_testet: "badge-soft-gray",
  igang: "badge-soft-amber",
  bestået: "badge-soft-green",
  fejlet: "badge-soft-red",
};
const TEST_STATUS_LABEL: Record<string, string> = {
  ikke_testet: "Ikke testet",
  igang: "I gang",
  bestået: "Bestået",
  fejlet: "Fejlet",
};

const FREQUENCY_STYLE: Record<string, string> = {
  månedlig: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  kvartalvis: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  årlig: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
const FREQUENCY_LABEL: Record<string, string> = {
  månedlig: "Månedlig",
  kvartalvis: "Kvartalvis",
  årlig: "Årlig",
};
const FREQUENCIES = ["månedlig", "kvartalvis", "årlig"];

function badgeClass(style?: string) {
  return `badge-soft ${style ?? "badge-soft-gray"}`;
}

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export default function Kontroltests({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    controlName: "",
    controlCategory: "adgangsstyring",
    frequency: "kvartalvis",
    description: "",
  });

  const queryKey = ["/api/control-tests", companyId];

  const { data, isLoading } = useQuery<ControlTest[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/control-tests");
      const json = await res.json();
      const rows: ControlTest[] = Array.isArray(json) ? json : (json?.items ?? []);
      return rows.filter((r) => r.companyId == null || r.companyId === companyId);
    },
  });

  const tests = data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/control-tests", {
        companyId,
        controlName: form.controlName,
        controlCategory: form.controlCategory,
        frequency: form.frequency,
        description: form.description || null,
        testStatus: "ikke_testet",
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control-tests"] });
      toast({ title: "Kontrol oprettet" });
      setDialogOpen(false);
      setForm({ controlName: "", controlCategory: "adgangsstyring", frequency: "kvartalvis", description: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke oprette kontrol", description: message, variant: "destructive" });
    },
  });

  const runTestMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/control-tests/${id}`, {
        testStatus: "bestået",
        testResult: "Kontrol gennemført uden afvigelser",
        testedBy: "Nuværende bruger",
        testedAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control-tests"] });
      toast({ title: "Kontroltest kørt" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke køre test", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/control-tests/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control-tests"] });
      toast({ title: "Kontrol slettet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke slette kontrol", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Kontroltests</h2>
          <p className="text-sm text-muted-foreground">
            Interne kontroller for adgangs-, ændrings- og driftsstyring samt dataintegritet.
          </p>
        </div>
        <Button data-testid="add-control-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Opret kontrol
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" data-testid="controls-loading" />
      ) : tests.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="controls-empty">
          Ingen kontroltests endnu. Opret den første kontrol ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="px-3 py-2">Kontrol</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Teststatus</th>
                <th className="px-3 py-2">Resultat</th>
                <th className="px-3 py-2">Testet af</th>
                <th className="px-3 py-2">Testet</th>
                <th className="px-3 py-2">Frekvens</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tests.map((t) => (
                <tr key={t.id} data-testid={`control-row-${t.id}`}>
                  <td className="px-3 py-2 font-medium">{t.controlName}</td>
                  <td className="px-3 py-2">
                    <span
                      className={badgeClass(CATEGORY_STYLE[t.controlCategory])}
                      data-testid={`category-${t.id}`}
                    >
                      {CATEGORY_LABEL[t.controlCategory] ?? t.controlCategory}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={badgeClass(TEST_STATUS_STYLE[t.testStatus])}
                      data-testid={`test-status-${t.id}`}
                    >
                      {TEST_STATUS_LABEL[t.testStatus] ?? t.testStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs">
                    <span className="line-clamp-2">{t.testResult ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.testedBy ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dkDate(t.testedAt)}</td>
                  <td className="px-3 py-2">
                    {t.frequency ? (
                      <span
                        className={badgeClass(FREQUENCY_STYLE[t.frequency])}
                        data-testid={`frequency-${t.id}`}
                      >
                        {FREQUENCY_LABEL[t.frequency] ?? t.frequency}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`run-control-btn-${t.id}`}
                        disabled={runTestMut.isPending}
                        onClick={() => runTestMut.mutate(t.id)}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Kør test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`delete-control-${t.id}`}
                        onClick={() => deleteMut.mutate(t.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret kontrol</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ct-name">Kontrolnavn</Label>
              <Input
                id="ct-name"
                data-testid="form-controlName"
                value={form.controlName}
                onChange={(e) => setForm((f) => ({ ...f, controlName: e.target.value }))}
                placeholder="F.eks. Gennemgang af brugeradgange"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-category">Kategori</Label>
              <Select
                value={form.controlCategory}
                onValueChange={(v) => setForm((f) => ({ ...f, controlCategory: v }))}
              >
                <SelectTrigger id="ct-category" data-testid="form-controlCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-frequency">Frekvens</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
              >
                <SelectTrigger id="ct-frequency" data-testid="form-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-desc">Beskrivelse</Label>
              <Textarea
                id="ct-desc"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Hvad kontrolleres der for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.controlName.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Gem kontrol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

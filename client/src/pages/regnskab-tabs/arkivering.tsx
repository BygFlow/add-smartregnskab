import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Lock, Unlock, Search, Archive } from "lucide-react";

/* Bogføringslov arkivering */

type ArchiveRecord = {
  id: number;
  companyId?: number | null;
  voucherNumber?: string | null;
  date?: string | null;
  description?: string | null;
  amount?: number | null;
  fileName?: string | null;
  period?: string | null;
  locked?: number | boolean | null;
  archivePath?: string | null;
  createdAt?: string | null;
};

const fmtDKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 2,
});

function dkDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("da-DK");
}

export default function Arkivering({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("alle");
  const [lockFilter, setLockFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    voucherNumber: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    fileName: "",
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  });

  const { data, isLoading } = useQuery<ArchiveRecord[]>({
    queryKey: ["/api/archive-records", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/archive-records");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });

  const records = data ?? [];

  const periods = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.period && set.add(r.period));
    return Array.from(set).sort().reverse();
  }, [records]);

  const filtered = useMemo(() => {
    return records
      .filter((r) => (periodFilter === "alle" ? true : r.period === periodFilter))
      .filter((r) => {
        if (lockFilter === "alle") return true;
        const isLocked = !!r.locked;
        return lockFilter === "locked" ? isLocked : !isLocked;
      })
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (r.voucherNumber ?? "").toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.fileName ?? "").toLowerCase().includes(q)
        );
      });
  }, [records, periodFilter, lockFilter, search]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/archive-records", {
        voucherNumber: form.voucherNumber,
        date: form.date,
        description: form.description,
        amount: Number(form.amount) || 0,
        fileName: form.fileName || null,
        period: form.period,
        locked: 0,
        companyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/archive-records"] });
      toast({ title: "Bilag arkiveret", description: "Arkivposten er oprettet." });
      setDialogOpen(false);
      setForm({
        voucherNumber: "",
        date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: "",
        fileName: "",
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke arkivere", description: message, variant: "destructive" });
    },
  });

  const toggleLockMut = useMutation({
    mutationFn: async ({ id, locked }: { id: number; locked: boolean }) => {
      const res = await apiRequest("PATCH", `/api/archive-records/${id}`, {
        locked: locked ? 1 : 0,
      });
      return await res.json();
    },
    onSuccess: (_data, { locked }) => {
      qc.invalidateQueries({ queryKey: ["/api/archive-records"] });
      toast({ title: locked ? "Post låst" : "Post låst op", description: "Bogføringslov-status opdateret." });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke opdatere lås", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Arkivering</h2>
          <p className="text-sm text-muted-foreground">
            Bogføringslov arkivering af bilag og regnskabsposter.
          </p>
        </div>
        <Button data-testid="add-archive-btn" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Arkiver bilag
        </Button>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
        Bogføringslov arkivering (beta) — Kræver revisor/juridisk godkendelse.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Søg bilag, beskrivelse, fil…"
            data-testid="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-44" data-testid="period-filter">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle perioder</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lockFilter} onValueChange={setLockFilter}>
          <SelectTrigger className="w-40" data-testid="lock-filter">
            <SelectValue placeholder="Lås" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle</SelectItem>
            <SelectItem value="locked">Låst</SelectItem>
            <SelectItem value="unlocked">Ulåst</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Archive className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Ingen arkivposter fundet for det valgte filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-premium">
            <thead>
              <tr>
                <th className="p-2">Bilagsnr.</th>
                <th className="p-2">Dato</th>
                <th className="p-2">Beskrivelse</th>
                <th className="p-2 text-right">Beløb</th>
                <th className="p-2">Periode</th>
                <th className="p-2">Fil</th>
                <th className="p-2">Låst</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const locked = !!r.locked;
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r.voucherNumber ?? "—"}</td>
                    <td className="p-2 whitespace-nowrap">{dkDate(r.date)}</td>
                    <td className="p-2 max-w-xs truncate">{r.description ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">{fmtDKK.format(Number(r.amount ?? 0))}</td>
                    <td className="p-2 whitespace-nowrap">{r.period ?? "—"}</td>
                    <td className="p-2 max-w-[12rem] truncate text-xs text-muted-foreground">
                      {r.fileName ?? "—"}
                    </td>
                    <td className="p-2">
                      <span className={`badge-soft ${locked ? "badge-soft-green" : "badge-soft-gray"}`}>
                        {locked ? "Låst" : "Ulåst"}
                      </span>
                    </td>
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`toggle-lock-${r.id}`}
                        disabled={toggleLockMut.isPending}
                        onClick={() => toggleLockMut.mutate({ id: r.id, locked: !locked })}
                      >
                        {locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">{locked ? "Lås op" : "Lås"}</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arkiver bilag</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ar-voucher">Bilagsnummer</Label>
              <Input
                id="ar-voucher"
                data-testid="form-voucherNumber"
                value={form.voucherNumber}
                onChange={(e) => setForm((f) => ({ ...f, voucherNumber: e.target.value }))}
                placeholder="F.eks. 2026-0123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-date">Dato</Label>
              <Input
                id="ar-date"
                type="date"
                data-testid="form-date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ar-desc">Beskrivelse</Label>
              <Input
                id="ar-desc"
                data-testid="form-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="F.eks. Køb af rengøringsmidler"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-amount">Beløb (DKK)</Label>
              <Input
                id="ar-amount"
                type="number"
                inputMode="decimal"
                data-testid="form-amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-period">Periode</Label>
              <Input
                id="ar-period"
                data-testid="form-period"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                placeholder="YYYY-MM"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ar-file">Filnavn / reference</Label>
              <Input
                id="ar-file"
                data-testid="form-fileName"
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                placeholder="bilag-2026-0123.pdf"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createMut.isPending || !form.voucherNumber.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Gemmer…" : "Arkiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

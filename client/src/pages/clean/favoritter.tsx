import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Star,
  StarOff,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Info,
  Bookmark,
} from "lucide-react";

/* ---------- typer ---------- */

interface NavigationFavorite {
  id: number;
  userId: string;
  companyId?: number | null;
  path: string;
  label: string;
  platform: string;
  sortOrder?: number | null;
  createdAt: string;
}

const PLATFORM_CONFIG: Record<string, { label: string; className: string }> = {
  smartdrift_clean: { label: "SmartDrift Clean", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  smartregnskab: { label: "SmartRegnskab", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
};

function platformBadge(platform: string) {
  return (
    PLATFORM_CONFIG[platform] ?? {
      label: platform,
      className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    }
  );
}

/* ---------- komponent ---------- */

export default function Favoritter({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user ? String(user.id) : `company-${companyId}`;

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<NavigationFavorite[]>({
    queryKey: ["/api/navigation-favorites", companyId, userId],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/navigation-favorites?companyId=${companyId}&userId=${encodeURIComponent(userId)}`,
        )
      ).json(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/navigation-favorites"] });

  const createMutation = useMutation({
    mutationFn: async (body: unknown) =>
      (await apiRequest("POST", `/api/navigation-favorites?companyId=${companyId}`, body)).json(),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast({ title: "Favorit tilføjet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke tilføje favorit", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) =>
      (await apiRequest("PATCH", `/api/navigation-favorites/${id}?companyId=${companyId}`, data)).json(),
    onSuccess: () => invalidate(),
    onError: (e: any) =>
      toast({ title: "Kunne ikke opdatere favorit", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/navigation-favorites/${id}?companyId=${companyId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Favorit fjernet" });
    },
    onError: (e: any) =>
      toast({ title: "Kunne ikke fjerne favorit", description: e.message, variant: "destructive" }),
  });

  const list = useMemo(
    () => [...(data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((f) => f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  }, [list, search]);

  const move = (fav: NavigationFavorite, direction: -1 | 1) => {
    const idx = list.findIndex((f) => f.id === fav.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    updateMutation.mutate({ id: fav.id, data: { sortOrder: other.sortOrder ?? swapIdx } });
    updateMutation.mutate({ id: other.id, data: { sortOrder: fav.sortOrder ?? idx } });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" data-testid="loading-favoritter">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Star className="w-5 h-5" />
            Favoritter
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dine hurtige genveje til navigation
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-favorite" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Tilføj favorit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ny favorit</DialogTitle>
            </DialogHeader>
            <FavoriteForm
              pending={createMutation.isPending}
              nextSortOrder={list.length}
              onSubmit={async (data) => {
                await createMutation.mutateAsync({ ...data, userId });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div
        className="rounded-md border border-border/70 bg-card p-3 flex items-start gap-2 text-sm"
        data-testid="info-banner-favoritter"
      >
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          Favoritter vises øverst i navigationen for hurtig adgang
        </span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="input-search-favorites"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg i favoritter..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center" data-testid="empty-favoritter">
          <StarOff className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {search ? "Ingen favoritter matcher søgningen" : "Ingen favoritter tilføjet endnu"}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden" data-testid="table-favoritter">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sti</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Sortering</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((fav, idx) => {
                const badge = platformBadge(fav.platform);
                return (
                  <TableRow key={fav.id} data-testid={`row-favorite-${fav.id}`}>
                    <TableCell className="font-mono text-xs">{fav.path}</TableCell>
                    <TableCell className="font-medium flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                      {fav.label}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                        data-testid={`badge-platform-${fav.id}`}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fav.sortOrder ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-move-up-${fav.id}`}
                          disabled={idx === 0 || updateMutation.isPending}
                          onClick={() => move(fav, -1)}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-move-down-${fav.id}`}
                          disabled={idx === filtered.length - 1 || updateMutation.isPending}
                          onClick={() => move(fav, 1)}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-remove-favorite-${fav.id}`}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(fav.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ---------- tilføj favorit-formular ---------- */

function FavoriteForm({
  pending,
  nextSortOrder,
  onSubmit,
}: {
  pending: boolean;
  nextSortOrder: number;
  onSubmit: (data: { path: string; label: string; platform: string; sortOrder: number }) => Promise<void>;
}) {
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [platform, setPlatform] = useState("smartdrift_clean");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      path,
      label,
      platform,
      sortOrder: nextSortOrder,
    };
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fav-path">Sti *</Label>
        <Input
          id="fav-path"
          data-testid="input-fav-path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/clean/live-driftstavle"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fav-label">Label *</Label>
        <Input
          id="fav-label"
          data-testid="input-fav-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="f.eks. Live driftstavle"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fav-platform">Platform</Label>
        <select
          id="fav-platform"
          data-testid="select-fav-platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(PLATFORM_CONFIG).map(([id, c]) => (
            <option key={id} value={id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || pending} data-testid="button-save-favorite">
          {submitting || pending ? "Tilføjer..." : "Tilføj favorit"}
        </Button>
      </DialogFooter>
    </form>
  );
}

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
import { Plus, Trash2, Layers, Tags } from "lucide-react";

/* Dimensioner — dimensionsdefinitioner og deres værdier for branche-uafhængig kontering */

type DimensionDefinition = {
  id: number;
  companyId: number;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

type DimensionValue = {
  id: number;
  dimensionId: number;
  code: string;
  name: string;
  parentId?: number | null;
  isActive?: boolean | null;
};

const DIMENSION_NAME_STYLE: Record<string, string> = {
  afdeling: "badge-soft badge-soft-blue",
  projekt: "badge-soft badge-soft-green",
  lokation: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  kunde: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  produkt: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
};

function dimBadgeClass(name?: string | null) {
  return DIMENSION_NAME_STYLE[name ?? ""] ?? "badge-soft badge-soft-gray";
}

export default function Dimensioner({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [defDialogOpen, setDefDialogOpen] = useState(false);
  const [valDialogOpen, setValDialogOpen] = useState(false);
  const [selectedDimId, setSelectedDimId] = useState<number | null>(null);

  const [defForm, setDefForm] = useState({ name: "afdeling", code: "", description: "" });
  const [valForm, setValForm] = useState({ code: "", name: "", parentId: "" });

  const defsQueryKey = ["/api/dimension-definitions", companyId];
  const { data: defsData, isLoading: defsLoading } = useQuery<DimensionDefinition[]>({
    queryKey: defsQueryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dimension-definitions");
      const json = await res.json();
      const items: DimensionDefinition[] = Array.isArray(json) ? json : (json?.items ?? []);
      return items.filter((d) => d.companyId === companyId);
    },
  });
  const definitions = defsData ?? [];

  const valsQueryKey = ["/api/dimension-values"];
  const { data: valsData, isLoading: valsLoading } = useQuery<DimensionValue[]>({
    queryKey: valsQueryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dimension-values");
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.items ?? []);
    },
  });
  const allValues = valsData ?? [];
  const selectedValues = selectedDimId
    ? allValues.filter((v) => v.dimensionId === selectedDimId)
    : [];
  const selectedDim = definitions.find((d) => d.id === selectedDimId);

  const createDefMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/dimension-definitions", {
        companyId,
        name: defForm.name,
        code: defForm.code,
        description: defForm.description || null,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dimension-definitions"] });
      toast({ title: "Dimension tilføjet" });
      setDefDialogOpen(false);
      setDefForm({ name: "afdeling", code: "", description: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje dimension", description: message, variant: "destructive" });
    },
  });

  const deleteDefMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/dimension-definitions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dimension-definitions"] });
      toast({ title: "Dimension fjernet" });
      setSelectedDimId((cur) => (cur ? null : cur));
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne dimension", description: message, variant: "destructive" });
    },
  });

  const createValMut = useMutation({
    mutationFn: async () => {
      if (!selectedDimId) throw new Error("Vælg en dimension først");
      const res = await apiRequest("POST", "/api/dimension-values", {
        dimensionId: selectedDimId,
        code: valForm.code,
        name: valForm.name,
        parentId: valForm.parentId ? parseInt(valForm.parentId) : null,
        isActive: true,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dimension-values"] });
      toast({ title: "Værdi tilføjet" });
      setValDialogOpen(false);
      setValForm({ code: "", name: "", parentId: "" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke tilføje værdi", description: message, variant: "destructive" });
    },
  });

  const deleteValMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/dimension-values/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dimension-values"] });
      toast({ title: "Værdi fjernet" });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne værdi", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Dimensioner</h2>
            <p className="text-sm text-muted-foreground">
              Definer dimensioner (afdeling, projekt, lokation, kunde, produkt) og deres værdier
              til branche-uafhængig kontering.
            </p>
          </div>
          <Button data-testid="add-dimension-btn" onClick={() => setDefDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tilføj dimension
          </Button>
        </div>

        {defsLoading ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : definitions.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            <Layers className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            Ingen dimensioner defineret endnu. Tilføj den første dimension ovenfor.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="px-3 py-2">Navn</th>
                  <th className="px-3 py-2">Kode</th>
                  <th className="px-3 py-2">Beskrivelse</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {definitions.map((d) => (
                  <tr
                    key={d.id}
                    data-testid={`dimension-row-${d.id}`}
                    className={`cursor-pointer ${selectedDimId === d.id ? "bg-muted/50" : ""}`}
                    onClick={() => setSelectedDimId(d.id)}
                  >
                    <td className="px-3 py-2">
                      <span className={dimBadgeClass(d.name)} data-testid={`dimension-badge-${d.id}`}>
                        {d.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{d.code}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.description ?? "—"}</td>
                    <td className="px-3 py-2">
                      {d.isActive ? (
                        <span className="badge-soft badge-soft-green">Aktiv</span>
                      ) : (
                        <span className="badge-soft badge-soft-gray">Inaktiv</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        data-testid={`delete-dimension-btn-${d.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDefMut.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Værdier {selectedDim ? `for ${selectedDim.name}` : ""}
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedDim
                ? `Værdier tilknyttet dimensionen "${selectedDim.name}" (${selectedDim.code}).`
                : "Vælg en dimension i tabellen ovenfor for at se og tilføje værdier."}
            </p>
          </div>
          <Button
            data-testid="add-value-btn"
            disabled={!selectedDimId}
            onClick={() => setValDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Tilføj værdi
          </Button>
        </div>

        {!selectedDimId ? (
          <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Tags className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            Vælg en dimension for at se dens værdier.
          </div>
        ) : valsLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : selectedValues.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Ingen værdier endnu for denne dimension.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="px-3 py-2">Kode</th>
                  <th className="px-3 py-2">Navn</th>
                  <th className="px-3 py-2">Overordnet ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedValues.map((v) => (
                  <tr key={v.id} data-testid={`value-row-${v.id}`}>
                    <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                    <td className="px-3 py-2 font-medium">{v.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.parentId ?? "—"}</td>
                    <td className="px-3 py-2">
                      {v.isActive ? (
                        <span className="badge-soft badge-soft-green">Aktiv</span>
                      ) : (
                        <span className="badge-soft badge-soft-gray">Inaktiv</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        data-testid={`delete-value-btn-${v.id}`}
                        onClick={() => deleteValMut.mutate(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={defDialogOpen} onOpenChange={setDefDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tilføj dimension</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dd-name">Navn</Label>
              <Select
                value={defForm.name}
                onValueChange={(v) => setDefForm((f) => ({ ...f, name: v }))}
              >
                <SelectTrigger id="dd-name" data-testid="form-name">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["afdeling", "projekt", "lokation", "kunde", "produkt"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dd-code">Kode</Label>
              <Input
                id="dd-code"
                data-testid="form-code"
                value={defForm.code}
                onChange={(e) => setDefForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="F.eks. DIM-AFD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dd-description">Beskrivelse</Label>
              <Textarea
                id="dd-description"
                data-testid="form-description"
                value={defForm.description}
                onChange={(e) => setDefForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-cancel" onClick={() => setDefDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-save"
              disabled={createDefMut.isPending || !defForm.code.trim()}
              onClick={() => createDefMut.mutate()}
            >
              {createDefMut.isPending ? "Gemmer…" : "Gem dimension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={valDialogOpen} onOpenChange={setValDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tilføj værdi{selectedDim ? ` — ${selectedDim.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dv-code">Kode</Label>
              <Input
                id="dv-code"
                data-testid="form-value-code"
                value={valForm.code}
                onChange={(e) => setValForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="F.eks. AFD-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dv-name">Navn</Label>
              <Input
                id="dv-name"
                data-testid="form-value-name"
                value={valForm.name}
                onChange={(e) => setValForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="F.eks. Salgsafdeling"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dv-parent">Overordnet værdi-ID (valgfrit)</Label>
              <Input
                id="dv-parent"
                type="number"
                data-testid="form-value-parentId"
                value={valForm.parentId}
                onChange={(e) => setValForm((f) => ({ ...f, parentId: e.target.value }))}
                placeholder="F.eks. 3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" data-testid="form-value-cancel" onClick={() => setValDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              data-testid="form-value-save"
              disabled={createValMut.isPending || !valForm.code.trim() || !valForm.name.trim()}
              onClick={() => createValMut.mutate()}
            >
              {createValMut.isPending ? "Gemmer…" : "Gem værdi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

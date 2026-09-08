import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Pencil, Check } from "lucide-react";

type Frequency = "hver_gang" | "daglig" | "ugentlig" | "maanedlig";

interface ChecklistItem { label: string; required: boolean; frequency?: string }
interface LocationChecklist {
  id: number; companyId: number; customerId: number | null; name: string;
  area?: string | null; items: string; frequency: Frequency | string;
  isActive: boolean; createdAt: string;
}
interface ExecutionResult { item: string; checked: boolean; note?: string }
interface ChecklistExecution {
  id: number; companyId: number; checklistId: number; taskId?: number | null;
  employeeId?: number | null; executedAt: string; results: string;
  completedCount: number; totalCount: number; notes?: string | null; createdAt: string;
}
interface Customer { id: number; name: string }

const FREQUENCY_LABELS: Record<string, string> = {
  hver_gang: "Hver gang", daglig: "Daglig", ugentlig: "Ugentlig", maanedlig: "Månedlig",
};
const FREQUENCY_OPTIONS: Frequency[] = ["hver_gang", "daglig", "ugentlig", "maanedlig"];
const EMPTY_ITEM: ChecklistItem = { label: "", required: false, frequency: "" };

function parseItems(raw?: string | null): ChecklistItem[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? (p as ChecklistItem[]) : []; }
  catch { return []; }
}
function startOfMonth(d = new Date()): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }

export default function TjeklisterLokation({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<LocationChecklist | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<LocationChecklist | null>(null);
  const [executeTarget, setExecuteTarget] = useState<LocationChecklist | null>(null);

  const { data: checklists = [], isLoading } = useQuery<LocationChecklist[]>({
    queryKey: ["/api/location-checklists", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/location-checklists?companyId=${companyId}`)).json(),
  });
  const { data: executions = [] } = useQuery<ChecklistExecution[]>({
    queryKey: ["/api/checklist-executions", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/checklist-executions?companyId=${companyId}`)).json(),
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/location-checklists"] });
    qc.invalidateQueries({ queryKey: ["/api/checklist-executions"] });
  };

  const saveChecklist = useMutation({
    mutationFn: async (vars: { id?: number; data: unknown }) =>
      vars.id
        ? (await apiRequest("PATCH", `/api/location-checklists/${vars.id}`, vars.data)).json()
        : (await apiRequest("POST", `/api/location-checklists`, vars.data)).json(),
    onSuccess: () => { invalidateAll(); setEditTarget(null); setCreateOpen(false); toast({ title: "Tjekliste gemt" }); },
    onError: (e: any) => toast({ title: "Kunne ikke gemme tjekliste", description: e.message, variant: "destructive" }),
  });
  const deleteChecklist = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/location-checklists/${id}`)).json(),
    onSuccess: () => { invalidateAll(); toast({ title: "Tjekliste slettet" }); },
    onError: (e: any) => toast({ title: "Kunne ikke slette tjekliste", description: e.message, variant: "destructive" }),
  });
  const createExecution = useMutation({
    mutationFn: async (data: unknown) => (await apiRequest("POST", `/api/checklist-executions`, data)).json(),
    onSuccess: () => { invalidateAll(); setExecuteTarget(null); toast({ title: "Udførelse registreret" }); },
    onError: (e: any) => toast({ title: "Kunne ikke registrere udførelse", description: e.message, variant: "destructive" }),
  });

  const customerName = (id: number | null): string =>
    !id ? "—" : customers.find((c) => c.id === id)?.name || `Kunde #${id}`;

  const stats = useMemo(() => {
    const monthStart = startOfMonth().getTime();
    const monthExecs = executions.filter((e) => new Date(e.executedAt || e.createdAt).getTime() >= monthStart);
    const rate = (list: ChecklistExecution[]) =>
      list.length ? list.reduce((s, e) => s + (e.totalCount ? e.completedCount / e.totalCount : 0), 0) / list.length : 0;
    return {
      total: checklists.length,
      active: checklists.filter((c) => c.isActive).length,
      monthExecs: monthExecs.length,
      avgRate: Math.round((rate(executions.length ? executions : monthExecs)) * 100),
    };
  }, [checklists, executions]);

  const execsForChecklist = (id: number) =>
    executions
      .filter((e) => e.checklistId === id)
      .sort((a, b) => new Date(b.executedAt || b.createdAt).getTime() - new Date(a.executedAt || a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" /> Tjeklister pr. lokation
        </h2>
        <Button data-testid="btn-create-checklist" onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" /> Opret tjekliste
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tjeklister i alt", value: stats.total, cls: "" },
          { label: "Aktive", value: stats.active, cls: "text-green-600" },
          { label: "Udførelser denne måned", value: stats.monthExecs, cls: "" },
          { label: "Gns. fuldførelse", value: `${stats.avgRate}%`, cls: "" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.cls}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-medium">Tjeklister</h3>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Navn</TableHead><TableHead>Kunde</TableHead><TableHead>Område</TableHead>
              <TableHead>Frekvens</TableHead><TableHead>Antal punkter</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Handlinger</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Indlæser tjeklister…</TableCell></TableRow>
              ) : checklists.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Ingen tjeklister endnu.</TableCell></TableRow>
              ) : checklists.map((c) => {
                const items = parseItems(c.items);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{customerName(c.customerId)}</TableCell>
                    <TableCell>{c.area || "—"}</TableCell>
                    <TableCell>{FREQUENCY_LABELS[c.frequency as string] || c.frequency}</TableCell>
                    <TableCell>{items.length}</TableCell>
                    <TableCell>
                      {c.isActive
                        ? <Badge className="badge-soft badge-soft-green">Aktiv</Badge>
                        : <Badge className="badge-soft badge-soft-gray">Inaktiv</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" data-testid={`btn-view-${c.id}`} onClick={() => setViewTarget(c)}>Vis</Button>
                      <Button variant="ghost" size="sm" data-testid={`btn-edit-${c.id}`} onClick={() => setEditTarget(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" data-testid={`btn-delete-${c.id}`} onClick={() => deleteChecklist.mutate(c.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-medium">Udførelser</h3>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tjekliste</TableHead><TableHead>Medarbejder</TableHead>
              <TableHead>Udført</TableHead><TableHead>Færdige/Total</TableHead><TableHead>Note</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {executions.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Ingen udførelser registreret.</TableCell></TableRow>
              ) : executions
                  .slice()
                  .sort((a, b) => new Date(b.executedAt || b.createdAt).getTime() - new Date(a.executedAt || a.createdAt).getTime())
                  .map((e) => {
                    const cl = checklists.find((c) => c.id === e.checklistId);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{cl?.name || `Tjekliste #${e.checklistId}`}</TableCell>
                        <TableCell>{e.employeeId || "—"}</TableCell>
                        <TableCell>{new Date(e.executedAt || e.createdAt).toLocaleDateString("da-DK")}</TableCell>
                        <TableCell><span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />{e.completedCount}/{e.totalCount}</span></TableCell>
                        <TableCell className="max-w-xs truncate">{e.notes || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </section>

      {(createOpen || editTarget) && (
        <ChecklistDialog
          companyId={companyId} target={editTarget} customers={customers}
          onClose={() => { setCreateOpen(false); setEditTarget(null); }}
          onSave={(payload) => saveChecklist.mutate(payload)} saving={saveChecklist.isPending}
        />
      )}
      {viewTarget && (
        <ViewDialog
          checklist={viewTarget} executions={execsForChecklist(viewTarget.id)}
          customerName={customerName(viewTarget.customerId)}
          onClose={() => setViewTarget(null)}
          onExecute={(cl) => { setViewTarget(null); setExecuteTarget(cl); }}
        />
      )}
      {executeTarget && (
        <ExecuteDialog
          checklist={executeTarget}
          onClose={() => setExecuteTarget(null)}
          onSave={(payload) => createExecution.mutate(payload)} saving={createExecution.isPending}
        />
      )}
    </div>
  );
}

interface ChecklistDialogProps {
  companyId: number; target: LocationChecklist | null; customers: Customer[];
  onClose: () => void; onSave: (payload: { id?: number; data: unknown }) => void; saving: boolean;
}
function ChecklistDialog({ companyId, target, customers, onClose, onSave, saving }: ChecklistDialogProps) {
  const existing = target ? parseItems(target.items) : [];
  const [name, setName] = useState(target?.name || "");
  const [customerId, setCustomerId] = useState(target?.customerId ? String(target.customerId) : "none");
  const [area, setArea] = useState(target?.area || "");
  const [frequency, setFrequency] = useState(target?.frequency || "hver_gang");
  const [isActive, setIsActive] = useState(target?.isActive ?? true);
  const [items, setItems] = useState<ChecklistItem[]>(existing.length ? existing : [{ ...EMPTY_ITEM }]);

  const updateItem = (idx: number, patch: Partial<ChecklistItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      id: target?.id,
      data: {
        companyId, name: name.trim(),
        customerId: customerId === "none" ? null : Number(customerId),
        area: area.trim() || null, frequency, isActive,
        items: JSON.stringify(items.filter((it) => it.label.trim())),
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{target ? "Rediger tjekliste" : "Opret tjekliste"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cl-name">Navn</Label>
            <Input id="cl-name" data-testid="input-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Daglig rengøringstilsyn" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Kunde</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="select-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen kunde</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cl-area">Område</Label>
              <Input id="cl-area" data-testid="input-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="F.eks. Kælder, Reception" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Frekvens</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger data-testid="select-frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox id="cl-active" data-testid="checkbox-active" checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
              <Label htmlFor="cl-active" className="cursor-pointer">Aktiv</Label>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tjekpunkter</Label>
              <Button variant="outline" size="sm" data-testid="btn-add-item" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Tilføj punkt</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input data-testid={`input-item-label-${idx}`} value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} placeholder={`Punkt ${idx + 1}`} className="flex-1" />
                  <div className="flex items-center gap-1">
                    <Checkbox id={`req-${idx}`} data-testid={`checkbox-required-${idx}`} checked={it.required} onCheckedChange={(v) => updateItem(idx, { required: Boolean(v) })} />
                    <Label htmlFor={`req-${idx}`} className="text-xs text-muted-foreground">Krævet</Label>
                  </div>
                  <Button variant="ghost" size="sm" data-testid={`btn-remove-item-${idx}`} onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-muted-foreground">Ingen punkter. Klik "Tilføj punkt".</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel">Annuller</Button>
          <Button data-testid="btn-save-checklist" disabled={saving || !name.trim()} onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">{saving ? "Gemmer…" : "Gem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ViewDialogProps {
  checklist: LocationChecklist; executions: ChecklistExecution[]; customerName: string;
  onClose: () => void; onExecute: (cl: LocationChecklist) => void;
}
function ViewDialog({ checklist, executions, customerName, onClose, onExecute }: ViewDialogProps) {
  const items = parseItems(checklist.items);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{checklist.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Kunde:</span> {customerName}</div>
            <div><span className="text-muted-foreground">Område:</span> {checklist.area || "—"}</div>
            <div><span className="text-muted-foreground">Frekvens:</span> {FREQUENCY_LABELS[checklist.frequency as string] || checklist.frequency}</div>
            <div><span className="text-muted-foreground">Status:</span>{" "}
              {checklist.isActive ? <Badge className="badge-soft badge-soft-green">Aktiv</Badge> : <Badge className="badge-soft badge-soft-gray">Inaktiv</Badge>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tjekpunkter</Label>
            <ul className="space-y-1 border rounded-md p-3">
              {items.length === 0 ? <li className="text-sm text-muted-foreground">Ingen punkter.</li>
                : items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="flex-1">{it.label}</span>
                    {it.required && <Badge className="badge-soft badge-soft-amber">Krævet</Badge>}
                  </li>
                ))}
            </ul>
          </div>
          <div className="space-y-2">
            <Label>Seneste udførelser</Label>
            <div className="border rounded-md divide-y">
              {executions.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Ingen udførelser endnu.</p>
                : executions.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-2 text-sm">
                    <span>{new Date(e.executedAt || e.createdAt).toLocaleDateString("da-DK")}</span>
                    <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />{e.completedCount}/{e.totalCount}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Luk</Button>
          <Button data-testid="btn-start-execute" onClick={() => onExecute(checklist)} className="bg-blue-600 hover:bg-blue-700" disabled={!checklist.isActive}><ClipboardList className="h-4 w-4 mr-1" /> Udfør tjekliste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExecuteDialogProps {
  checklist: LocationChecklist; onClose: () => void; onSave: (payload: unknown) => void; saving: boolean;
}
function ExecuteDialog({ checklist, onClose, onSave, saving }: ExecuteDialogProps) {
  const items = parseItems(checklist.items);
  const [results, setResults] = useState<ExecutionResult[]>(items.map((it) => ({ item: it.label, checked: false, note: "" })));
  const [employeeId, setEmployeeId] = useState("");
  const [generalNote, setGeneralNote] = useState("");

  const toggle = (idx: number, checked: boolean) => setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, checked } : r)));
  const setNote = (idx: number, note: string) => setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, note } : r)));
  const completedCount = results.filter((r) => r.checked).length;

  const handleSubmit = () => {
    onSave({
      companyId: checklist.companyId, checklistId: checklist.id,
      employeeId: employeeId ? Number(employeeId) : null,
      executedAt: new Date().toISOString(),
      results: JSON.stringify(results),
      completedCount, totalCount: results.length,
      notes: generalNote.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Udfør: {checklist.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ex-employee">Medarbejder-ID</Label>
            <Input id="ex-employee" data-testid="input-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Valgfrit" />
          </div>
          <div className="space-y-2">
            <Label>Tjekpunkter</Label>
            <div className="space-y-3">
              {results.length === 0 ? <p className="text-sm text-muted-foreground">Denne tjekliste har ingen punkter.</p>
                : results.map((r, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`exec-${idx}`} data-testid={`checkbox-exec-${idx}`} checked={r.checked} onCheckedChange={(v) => toggle(idx, Boolean(v))} />
                      <Label htmlFor={`exec-${idx}`} className="cursor-pointer flex-1">{r.item}</Label>
                      {items[idx]?.required && <Badge className="badge-soft badge-soft-amber">Krævet</Badge>}
                    </div>
                    <Input data-testid={`input-note-${idx}`} value={r.note || ""} onChange={(e) => setNote(idx, e.target.value)} placeholder="Note til dette punkt (valgfrit)" className="text-sm" />
                  </div>
                ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ex-note">Generel note</Label>
            <Textarea id="ex-note" data-testid="input-general-note" value={generalNote} onChange={(e) => setGeneralNote(e.target.value)} placeholder="Samlet kommentar til udførelsen" />
          </div>
          <div className="text-sm text-muted-foreground">Fuldført: {completedCount}/{results.length}</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button data-testid="btn-save-execution" disabled={saving || results.length === 0} onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">{saving ? "Gemmer…" : "Registrer udførelse"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

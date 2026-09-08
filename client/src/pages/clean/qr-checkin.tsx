import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QrCode, Camera, Clock, Image as ImageIcon, LogIn, X, History, MapPin } from "lucide-react";

type QRStatus = "aktiv" | "afsluttet" | "afbrudt";

interface QRCheckin {
  id: number; companyId: number; customerId: number | null; customerLocationId: number | null;
  taskId: number | null; checklistId: number | null; employeeId: number | null;
  checkInTime: string; checkOutTime: string | null;
  beforePhotos: string[] | string | null; afterPhotos: string[] | string | null;
  notes: string | null; status: QRStatus | string; createdAt: string;
}
interface Customer { id: number; name: string; }
interface Task { id: number; title: string; customerId?: number | null; }
interface Checklist { id: number; name: string; }
interface Employee { id: number; name: string; }

function photosArray(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}
function dkTime(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString("da-DK");
}
function duration(ci: string | null, co: string | null): string {
  if (!ci || !co) return "—";
  const s = new Date(ci).getTime(), e = new Date(co).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return "—";
  const mins = Math.round((e - s) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}t ${m}min` : `${m}min`;
}
const STATUS_LABEL: Record<string, string> = { aktiv: "Aktiv", afsluttet: "Afsluttet", afbrudt: "Afbrudt" };

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls = s === "aktiv"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : s === "afsluttet"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return <Badge className={cls}>{STATUS_LABEL[s] ?? status}</Badge>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function PhotoGrid({ photos, onOpen }: { photos: string[]; onOpen: (p: string) => void }) {
  if (photos.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-6 text-sm text-muted-foreground">
        <ImageIcon className="h-5 w-5" /><span>Ingen fotos</span>
      </div>
    );
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((p, i) => (
        <button key={i} type="button" data-testid={`photo-thumb-${i}`}
          className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          onClick={() => onOpen(p)}>
          <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

function PhotoUploader({ label, photos, onChange, testId }: {
  label: string; photos: string[]; onChange: (p: string[]) => void; testId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const conv = await Promise.all(Array.from(files).map(fileToBase64));
      onChange([...photos, ...conv]);
    } catch { toast({ title: "Kunne ikke indlæse fotos", variant: "destructive" }); }
    finally { if (inputRef.current) inputRef.current.value = ""; }
  }
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} data-testid={testId}>
          <Camera className="mr-2 h-4 w-4" />Vælg fotos
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        {photos.length > 0 && (
          <span className="text-sm text-muted-foreground">{photos.length} foto{photos.length > 1 ? "s" : ""}</span>
        )}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
              <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))} data-testid={`remove-photo-${i}`}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailDialog({ checkin, open, onOpenChange, employeeName, onView }: {
  checkin: QRCheckin | null; open: boolean; onOpenChange: (o: boolean) => void;
  employeeName?: string; onView: (p: string) => void;
}) {
  if (!checkin) return null;
  const before = photosArray(checkin.beforePhotos);
  const after = photosArray(checkin.afterPhotos);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl">Tjek-ind detaljer</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {employeeName && (
              <div><span className="text-muted-foreground">Medarbejder</span><p className="font-medium">{employeeName}</p></div>
            )}
            <div><span className="text-muted-foreground">Tjek ind</span><p className="font-medium">{dkTime(checkin.checkInTime)}</p></div>
            <div><span className="text-muted-foreground">Tjek ud</span><p className="font-medium">{dkTime(checkin.checkOutTime)}</p></div>
            <div><span className="text-muted-foreground">Varighed</span><p className="font-medium">{duration(checkin.checkInTime, checkin.checkOutTime)}</p></div>
            <div><span className="text-muted-foreground">Status</span><div className="pt-1"><StatusBadge status={checkin.status} /></div></div>
          </div>
          {checkin.notes && (
            <div className="text-sm"><span className="text-muted-foreground">Noter</span>
              <p className="mt-1 rounded-md bg-muted p-3">{checkin.notes}</p></div>
          )}
          <div><h4 className="mb-2 text-sm font-medium">Før-billeder ({before.length})</h4><PhotoGrid photos={before} onOpen={onView} /></div>
          <div><h4 className="mb-2 text-sm font-medium">Efter-billeder ({after.length})</h4><PhotoGrid photos={after} onOpen={onView} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Luk</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function QRCheckinPage({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isLeder = user?.role === "leder" || user?.role === "admin";
  const employeeId = user?.employeeId ?? 0;

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["qr-customers", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/customers?companyId=${companyId}`)).json(),
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["qr-tasks", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/tasks?companyId=${companyId}`)).json(),
  });
  const { data: checklists = [] } = useQuery<Checklist[]>({
    queryKey: ["qr-checklists", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/location-checklists?companyId=${companyId}`)).json(),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["qr-employees", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/employees?companyId=${companyId}`)).json(),
    enabled: isLeder,
  });
  const { data: allCheckins = [] } = useQuery<QRCheckin[]>({
    queryKey: ["qr-checkins", companyId],
    queryFn: async () => (await apiRequest("GET", `/api/qr-checkins?companyId=${companyId}`)).json(),
  });
  const { data: activeCheckin } = useQuery<QRCheckin | null>({
    queryKey: ["qr-active", employeeId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/qr-checkins/active/${employeeId}`);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!employeeId,
  });

  const employeeCheckins = useMemo(
    () => allCheckins.filter((c) => c.employeeId === employeeId), [allCheckins, employeeId]
  );

  const checkInMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiRequest("POST", "/api/qr-checkins", payload),
    onSuccess: () => {
      toast({ title: "Tjekket ind", description: "Check-in oprettet" });
      qc.invalidateQueries({ queryKey: ["qr-checkins", companyId] });
      qc.invalidateQueries({ queryKey: ["qr-active", employeeId] });
      resetForm();
    },
    onError: () => toast({ title: "Fejl ved tjek-ind", variant: "destructive" }),
  });
  const checkOutMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("POST", `/api/qr-checkins/${id}/checkout`, payload),
    onSuccess: () => {
      toast({ title: "Tjekket ud", description: "Check-out gennemført" });
      qc.invalidateQueries({ queryKey: ["qr-checkins", companyId] });
      qc.invalidateQueries({ queryKey: ["qr-active", employeeId] });
      setAfterPhotos([]); setNotes("");
    },
    onError: () => toast({ title: "Fejl ved tjek-ud", variant: "destructive" }),
  });
  const abortMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/qr-checkins/${id}`, { status }),
    onSuccess: () => {
      toast({ title: "Afbrudt", description: "Check-in afbrudt" });
      qc.invalidateQueries({ queryKey: ["qr-checkins", companyId] });
      qc.invalidateQueries({ queryKey: ["qr-active", employeeId] });
    },
    onError: () => toast({ title: "Fejl ved afbryd", variant: "destructive" }),
  });

  const [selCustomer, setSelCustomer] = useState("");
  const [selTask, setSelTask] = useState("");
  const [selChecklist, setSelChecklist] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [detailItem, setDetailItem] = useState<QRCheckin | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [adminStatusFilter, setAdminStatusFilter] = useState("alle");
  const [adminDateFilter, setAdminDateFilter] = useState("");

  function resetForm() { setSelCustomer(""); setSelTask(""); setSelChecklist(""); setBeforePhotos([]); }
  const filteredTasks = useMemo(
    () => (selCustomer ? tasks.filter((t) => t.customerId === Number(selCustomer)) : tasks),
    [tasks, selCustomer]
  );

  function handleCheckIn() {
    if (!selCustomer) { toast({ title: "Vælg en kunde", variant: "destructive" }); return; }
    checkInMutation.mutate({
      customerId: Number(selCustomer), employeeId,
      taskId: selTask ? Number(selTask) : null,
      checklistId: selChecklist ? Number(selChecklist) : null,
      checkInTime: new Date().toISOString(), beforePhotos, status: "aktiv" as QRStatus,
    });
  }
  function handleCheckOut() {
    if (activeCheckin) checkOutMutation.mutate({ id: activeCheckin.id, payload: { afterPhotos, notes } });
  }
  function handleAbort() {
    if (activeCheckin) abortMutation.mutate({ id: activeCheckin.id, status: "afbrudt" });
  }
  function openDetail(item: QRCheckin) { setDetailItem(item); setDetailOpen(true); }

  const adminFiltered = useMemo(() => allCheckins.filter((c) => {
    if (adminStatusFilter !== "alle" && c.status !== adminStatusFilter) return false;
    if (adminDateFilter && new Date(c.checkInTime).toISOString().slice(0, 10) !== adminDateFilter) return false;
    return true;
  }), [allCheckins, adminStatusFilter, adminDateFilter]);

  const empName = (id: number | null) => id ? employees.find((e) => e.id === id)?.name ?? "—" : "—";
  const custName = (id: number | null) => id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";

  if (isLeder) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold">QR Tjek-ind oversigt</h1>
        </div>
        <Card><CardContent className="pt-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={adminStatusFilter} onValueChange={setAdminStatusFilter}>
                <SelectTrigger className="w-40" data-testid="admin-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle</SelectItem>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="afsluttet">Afsluttet</SelectItem>
                  <SelectItem value="afbrudt">Afbrudt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dato</Label>
              <Input type="date" value={adminDateFilter} onChange={(e) => setAdminDateFilter(e.target.value)}
                className="w-44" data-testid="admin-date-filter" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Medarbejder</TableHead><TableHead>Kunde</TableHead>
                <TableHead>Tjek ind</TableHead><TableHead>Tjek ud</TableHead>
                <TableHead>Varighed</TableHead><TableHead>Status</TableHead><TableHead>Fotos</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {adminFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Ingen check-ins fundet</TableCell></TableRow>
                ) : adminFiltered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                    <TableCell className="font-medium">{empName(c.employeeId)}</TableCell>
                    <TableCell>{custName(c.customerId)}</TableCell>
                    <TableCell>{dkTime(c.checkInTime)}</TableCell>
                    <TableCell>{dkTime(c.checkOutTime)}</TableCell>
                    <TableCell>{duration(c.checkInTime, c.checkOutTime)}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>{photosArray(c.beforePhotos).length + photosArray(c.afterPhotos).length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent></Card>
        <DetailDialog checkin={detailItem} open={detailOpen} onOpenChange={setDetailOpen}
          employeeName={detailItem ? empName(detailItem.employeeId) : undefined} onView={setViewer} />
        <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
          <DialogContent className="max-w-3xl">
            <img src={viewer ?? ""} alt="Foto" className="max-h-[80vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-semibold">QR Tjek-ind</h1>
      </div>
      <Tabs defaultValue="checkin">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checkin" data-testid="tab-checkin"><LogIn className="mr-1 h-4 w-4" />Tjek ind</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active"><Clock className="mr-1 h-4 w-4" />Aktiv</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history"><History className="mr-1 h-4 w-4" />Historik</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
          <Card><CardContent className="space-y-4 pt-4">
            {activeCheckin ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                Du har allerede en aktiv check-in. Gå til fanen &quot;Aktiv&quot; for at tjekke ud.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Kunde <span className="text-destructive">*</span></Label>
                  <Select value={selCustomer} onValueChange={(v) => { setSelCustomer(v); setSelTask(""); }}>
                    <SelectTrigger data-testid="select-customer"><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Opgave (valgfri)</Label>
                  <Select value={selTask} onValueChange={setSelTask}>
                    <SelectTrigger data-testid="select-task"><SelectValue placeholder="Vælg opgave" /></SelectTrigger>
                    <SelectContent>
                      {filteredTasks.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tjekliste (valgfri)</Label>
                  <Select value={selChecklist} onValueChange={setSelChecklist}>
                    <SelectTrigger data-testid="select-checklist"><SelectValue placeholder="Vælg tjekliste" /></SelectTrigger>
                    <SelectContent>
                      {checklists.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <PhotoUploader label="Før-billeder" photos={beforePhotos} onChange={setBeforePhotos} testId="upload-before" />
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCheckIn}
                  disabled={checkInMutation.isPending || !selCustomer} data-testid="btn-checkin">
                  <LogIn className="mr-2 h-4 w-4" />Tjek ind
                </Button>
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="active">
          <Card><CardContent className="space-y-4 pt-4">
            {!activeCheckin ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                <Clock className="h-8 w-8" />
                <p>Du har ingen aktiv check-in.</p>
                <p className="text-sm">Gå til &quot;Tjek ind&quot; for at starte.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />Kunde</span>
                    <p className="font-medium">{custName(activeCheckin.customerId)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground"><Clock className="mr-1 inline h-3.5 w-3.5" />Tjek ind</span>
                    <p className="font-medium">{dkTime(activeCheckin.checkInTime)}</p>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-medium">Før-billeder ({photosArray(activeCheckin.beforePhotos).length})</h4>
                  <PhotoGrid photos={photosArray(activeCheckin.beforePhotos)} onOpen={setViewer} />
                </div>
                <PhotoUploader label="Efter-billeder" photos={afterPhotos} onChange={setAfterPhotos} testId="upload-after" />
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Noter</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tilføj noter..." rows={3} data-testid="notes-input" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending} data-testid="btn-checkout">
                    <LogIn className="mr-2 h-4 w-4" />Tjek ud
                  </Button>
                  <Button variant="outline" onClick={handleAbort} disabled={abortMutation.isPending} data-testid="btn-abort">
                    <X className="mr-1 h-4 w-4" />Afbryd
                  </Button>
                </div>
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Dato</TableHead><TableHead>Kunde</TableHead>
                  <TableHead>Tjek ind</TableHead><TableHead>Tjek ud</TableHead>
                  <TableHead>Status</TableHead><TableHead>Fotos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {employeeCheckins.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Ingen historik endnu</TableCell></TableRow>
                  ) : employeeCheckins.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                      <TableCell>{new Date(c.checkInTime).toLocaleDateString("da-DK")}</TableCell>
                      <TableCell>{custName(c.customerId)}</TableCell>
                      <TableCell>{dkTime(c.checkInTime)}</TableCell>
                      <TableCell>{dkTime(c.checkOutTime)}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>{photosArray(c.beforePhotos).length + photosArray(c.afterPhotos).length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      <DetailDialog checkin={detailItem} open={detailOpen} onOpenChange={setDetailOpen} onView={setViewer} />
      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl">
          <img src={viewer ?? ""} alt="Foto" className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

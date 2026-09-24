import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Network, Plus, Store } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LegalCompany = {
  id: number; name: string; cvr?: string | null; address?: string | null;
  parentCompanyId?: number | null; groupRole?: string | null; ownershipPercent?: number | null;
};
type CompanyUnit = {
  id: number; companyId: number; name: string; seNumber?: string | null;
  unitType: "department" | "se_unit"; active: number;
};
type Organization = {
  ownerCompanyId: number; activeCompanyId: number; companies: LegalCompany[];
  units: CompanyUnit[]; limits: { companies: number; maxCompanies: number };
};

const roleLabel: Record<string, string> = {
  standalone: "Selvstændig virksomhed", holding: "Holdingselskab",
  parent: "Moderselskab", subsidiary: "Datterselskab",
};

export default function Selskabsstruktur() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { switchCompany } = useAuth();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", cvr: "", parentCompanyId: "", groupRole: "subsidiary", ownershipPercent: "100" });
  const [unitForm, setUnitForm] = useState({ companyId: "", name: "", unitType: "department", seNumber: "" });

  const organization = useQuery<Organization>({
    queryKey: ["/api/organization"],
    queryFn: async () => (await apiRequest("GET", "/api/organization")).json(),
  });
  const data = organization.data;
  const canAddCompany = !!data && (data.limits.maxCompanies === -1 || data.limits.companies < data.limits.maxCompanies);

  const createCompany = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/organization/companies", {
      ...companyForm,
      parentCompanyId: companyForm.parentCompanyId === "none" ? null : companyForm.parentCompanyId ? Number(companyForm.parentCompanyId) : data?.ownerCompanyId,
      ownershipPercent: companyForm.parentCompanyId === "none" ? null : companyForm.ownershipPercent ? Number(companyForm.ownershipPercent) : null,
    })).json(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/organization"] });
      await qc.invalidateQueries({ queryKey: ["/api/regnskabssystem/companies"] });
      setCompanyOpen(false);
      setCompanyForm({ name: "", cvr: "", parentCompanyId: "", groupRole: "subsidiary", ownershipPercent: "100" });
      toast({ title: "Selskabet er oprettet", description: "Det har sit eget adskilte regnskab under jeres fælles abonnement." });
    },
    onError: (error: Error) => toast({ title: "Selskabet kunne ikke oprettes", description: error.message, variant: "destructive" }),
  });

  const createUnit = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/organization/units", { ...unitForm, companyId: Number(unitForm.companyId) })).json(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/organization"] });
      setUnitOpen(false);
      setUnitForm({ companyId: "", name: "", unitType: "department", seNumber: "" });
      toast({ title: "Enheden er oprettet", description: "Enheden er også oprettet som en regnskabsdimension." });
    },
    onError: (error: Error) => toast({ title: "Enheden kunne ikke oprettes", description: error.message, variant: "destructive" }),
  });

  if (organization.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data) return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Selskabsstrukturen kunne ikke indlæses.</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Selskaber & SE-enheder</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Ét ApS eller A/S er ét juridisk regnskab. Afdelinger og SE-numre hører under det valgte CVR og får ikke deres eget selskabsregnskab.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => { setUnitForm((f) => ({ ...f, companyId: String(data.activeCompanyId) })); setUnitOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj afdeling/SE
        </Button>
        <Button disabled={!canAddCompany} onClick={() => { setCompanyForm((f) => ({ ...f, parentCompanyId: String(data.ownerCompanyId) })); setCompanyOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Tilføj juridisk selskab
        </Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border bg-card p-4"><Building2 className="mb-2 h-5 w-5 text-primary"/><p className="text-2xl font-semibold">{data.companies.length}</p><p className="text-xs text-muted-foreground">Juridiske selskaber</p></div>
      <div className="rounded-lg border bg-card p-4"><Store className="mb-2 h-5 w-5 text-primary"/><p className="text-2xl font-semibold">{data.units.length}</p><p className="text-xs text-muted-foreground">Afdelinger og SE-enheder</p></div>
      <div className="rounded-lg border bg-card p-4"><Network className="mb-2 h-5 w-5 text-primary"/><p className="text-2xl font-semibold">{data.limits.companies}/{data.limits.maxCompanies === -1 ? "∞" : data.limits.maxCompanies}</p><p className="text-xs text-muted-foreground">Selskaber i abonnementet</p></div>
    </div>

    {!canAddCompany && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Jeres pakke har nået grænsen for juridiske selskaber. Afdelinger og SE-enheder kan stadig oprettes under et eksisterende CVR.</div>}

    <div className="space-y-3">
      {data.companies.map((company) => {
        const parent = data.companies.find((item) => item.id === company.parentCompanyId);
        const units = data.units.filter((unit) => unit.companyId === company.id);
        const active = company.id === data.activeCompanyId;
        return <div key={company.id} className={`rounded-xl border bg-card p-4 ${active ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{company.name}</h3>{active && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Check className="h-3 w-3"/>Aktivt regnskab</span>}</div>
              <p className="mt-1 text-sm text-muted-foreground">CVR {company.cvr || "ikke angivet"} · {roleLabel[company.groupRole || "standalone"] || company.groupRole}</p>
              {parent && <p className="text-xs text-muted-foreground">Ejet under {parent.name}{company.ownershipPercent != null ? ` · ${company.ownershipPercent}%` : ""}</p>}
            </div>
            {!active && <Button size="sm" variant="outline" onClick={async () => { await switchCompany(company.id); window.location.hash = "#/smartregnskab/app/dashboard"; }}>Åbn regnskab</Button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {units.length === 0 ? <span className="text-xs text-muted-foreground">Ingen afdelinger eller SE-enheder.</span> : units.map((unit) => <span key={unit.id} className="rounded-md bg-muted px-2.5 py-1 text-xs">{unit.name}{unit.seNumber ? ` · SE ${unit.seNumber}` : " · afdeling"}</span>)}
          </div>
        </div>;
      })}
    </div>

    <Dialog open={companyOpen} onOpenChange={setCompanyOpen}><DialogContent><DialogHeader><DialogTitle>Tilføj juridisk selskab</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div><Label htmlFor="legal-name">Selskabsnavn</Label><Input id="legal-name" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Eksempel ApS"/></div>
        <div><Label htmlFor="legal-cvr">CVR-nummer</Label><Input id="legal-cvr" inputMode="numeric" maxLength={8} value={companyForm.cvr} onChange={(e) => setCompanyForm({ ...companyForm, cvr: e.target.value.replace(/\D/g, "") })} placeholder="8 cifre"/></div>
        <div><Label>Moderselskab i denne konto</Label><Select value={companyForm.parentCompanyId} onValueChange={(value) => setCompanyForm({ ...companyForm, parentCompanyId: value, groupRole: value === "none" ? "standalone" : companyForm.groupRole === "standalone" ? "subsidiary" : companyForm.groupRole, ownershipPercent: value === "none" ? "" : companyForm.ownershipPercent || "100" })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Ingen intern ejerrelation</SelectItem>{data.companies.map((company) => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent></Select></div>
        {companyForm.parentCompanyId === "none" && <p className="text-sm text-muted-foreground">Selskabet deler abonnement, men registreres ikke som ejet af et andet selskab i denne konto. En ekstern ejer kan tilføjes til strukturen senere.</p>}
        <div><Label>Type</Label><Select value={companyForm.groupRole} onValueChange={(value) => setCompanyForm({ ...companyForm, groupRole: value })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{companyForm.parentCompanyId === "none" ? <><SelectItem value="standalone">Selvstændigt juridisk selskab</SelectItem><SelectItem value="holding">Holdingselskab</SelectItem></> : <><SelectItem value="subsidiary">Datterselskab</SelectItem><SelectItem value="parent">Moderselskab</SelectItem><SelectItem value="holding">Holdingselskab</SelectItem></>}</SelectContent></Select></div>
        {companyForm.parentCompanyId !== "none" && <div><Label htmlFor="ownership">Ejerandel i procent</Label><Input id="ownership" type="number" min="0" max="100" value={companyForm.ownershipPercent} onChange={(e) => setCompanyForm({ ...companyForm, ownershipPercent: e.target.value })}/></div>}
      </div><DialogFooter><Button variant="outline" onClick={() => setCompanyOpen(false)}>Annuller</Button><Button disabled={!companyForm.name || companyForm.cvr.length !== 8 || createCompany.isPending} onClick={() => createCompany.mutate()}>Opret selskab</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={unitOpen} onOpenChange={setUnitOpen}><DialogContent><DialogHeader><DialogTitle>Tilføj afdeling eller SE-enhed</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div><Label>Juridisk selskab</Label><Select value={unitForm.companyId} onValueChange={(value) => setUnitForm({ ...unitForm, companyId: value })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{data.companies.map((company) => <SelectItem key={company.id} value={String(company.id)}>{company.name} · CVR {company.cvr || "—"}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="unit-name">Navn</Label><Input id="unit-name" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} placeholder="Butik, afdeling eller driftsenhed"/></div>
        <div><Label>Enhedstype</Label><Select value={unitForm.unitType} onValueChange={(value) => setUnitForm({ ...unitForm, unitType: value, seNumber: value === "department" ? "" : unitForm.seNumber })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="department">Afdeling</SelectItem><SelectItem value="se_unit">SE-enhed</SelectItem></SelectContent></Select></div>
        {unitForm.unitType === "se_unit" && <div><Label htmlFor="unit-se">SE-nummer</Label><Input id="unit-se" inputMode="numeric" maxLength={8} value={unitForm.seNumber} onChange={(e) => setUnitForm({ ...unitForm, seNumber: e.target.value.replace(/\D/g, "") })} placeholder="8 cifre"/></div>}
      </div><DialogFooter><Button variant="outline" onClick={() => setUnitOpen(false)}>Annuller</Button><Button disabled={!unitForm.companyId || !unitForm.name || (unitForm.unitType === "se_unit" && unitForm.seNumber.length !== 8) || createUnit.isPending} onClick={() => createUnit.mutate()}>Opret enhed</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

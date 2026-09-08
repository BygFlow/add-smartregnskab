import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SectionCard } from "@/components/premium";
import {
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  Star,
  LayoutTemplate,
} from "lucide-react";

type TemplateType = "tilbud" | "faktura" | "rykker" | "standard";
type LogoPosition = "left" | "center" | "right" | "none";
type HeaderLayout = "classic" | "modern" | "minimal";

interface TemplateColumn {
  key: string;
  label: string;
  width: string;
}

interface Template {
  id: number;
  companyId: number | null;
  type: TemplateType;
  name: string;
  subject: string | null;
  body: string | null;
  isDefault: number;
  logoPosition: string | null;
  primaryColor: string | null;
  headerLayout: string | null;
  showBankInfo: number | null;
  showPaymentTerms: number | null;
  showEAN: number | null;
  columns: string | null; // JSON array
  footerText: string | null;
  termsConditions: string | null;
  createdAt: string | null;
}

const TYPE_LABELS: Record<TemplateType, string> = {
  tilbud: "Tilbud",
  faktura: "Faktura",
  rykker: "Rykker",
  standard: "Standard",
};

const TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: "tilbud", label: "Tilbud" },
  { value: "faktura", label: "Faktura" },
  { value: "rykker", label: "Rykker" },
  { value: "standard", label: "Standard" },
];

const LOGO_OPTIONS: { value: LogoPosition; label: string }[] = [
  { value: "left", label: "Venstre" },
  { value: "center", label: "Centreret" },
  { value: "right", label: "Højre" },
  { value: "none", label: "Ingen" },
];

const HEADER_OPTIONS: { value: HeaderLayout; label: string }[] = [
  { value: "classic", label: "Klassisk" },
  { value: "modern", label: "Moderne" },
  { value: "minimal", label: "Minimal" },
];

const DEFAULT_COLUMNS: TemplateColumn[] = [
  { key: "description", label: "Beskrivelse", width: "40" },
  { key: "qty", label: "Antal", width: "15" },
  { key: "unit", label: "Enhed", width: "15" },
  { key: "price", label: "Pris", width: "15" },
  { key: "total", label: "Total", width: "15" },
];

function parseColumns(raw: string | null): TemplateColumn[] {
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

interface FormState {
  name: string;
  type: TemplateType;
  logoPosition: LogoPosition;
  primaryColor: string;
  headerLayout: HeaderLayout;
  showBankInfo: boolean;
  showPaymentTerms: boolean;
  showEAN: boolean;
  subject: string;
  body: string;
  columns: TemplateColumn[];
  footerText: string;
  termsConditions: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "tilbud",
  logoPosition: "left",
  primaryColor: "#2176d4",
  headerLayout: "classic",
  showBankInfo: true,
  showPaymentTerms: true,
  showEAN: false,
  subject: "",
  body: "",
  columns: DEFAULT_COLUMNS,
  footerText: "",
  termsConditions: "",
};

function toForm(t: Template): FormState {
  return {
    name: t.name,
    type: t.type,
    logoPosition: (t.logoPosition as LogoPosition) || "left",
    primaryColor: t.primaryColor || "#2176d4",
    headerLayout: (t.headerLayout as HeaderLayout) || "classic",
    showBankInfo: t.showBankInfo !== 0,
    showPaymentTerms: t.showPaymentTerms !== 0,
    showEAN: t.showEAN === 1,
    subject: t.subject ?? "",
    body: t.body ?? "",
    columns: parseColumns(t.columns),
    footerText: t.footerText ?? "",
    termsConditions: t.termsConditions ?? "",
  };
}

export default function Skabeloner() {
  const { companyId, isPlatformAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [designerOpen, setDesignerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Når true oprettes/redigeres en platform-skabelon (companyId = null, synlig for alle virksomheder).
  const [platformMode, setPlatformMode] = useState(false);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["templates", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/templates");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data, isPlatform }: { id: number | null; data: Partial<Template>; isPlatform: boolean }) => {
      if (isPlatform) {
        // Platform-skabeloner (companyId = null) håndteres via platform-ruterne
        if (id) {
          const res = await apiRequest("PATCH", `/api/platform/templates/${id}`, data);
          return res.json();
        }
        const res = await apiRequest("POST", `/api/platform/templates`, { ...data, companyId: null });
        return res.json();
      }
      if (id) {
        const res = await apiRequest("PATCH", `/api/templates/${id}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/templates", data);
      return res.json();
    },
    onSuccess: (saved: Template) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Skabelon gemt" });
      setEditingTemplate(saved);
    },
    onError: () => toast({ title: "Kunne ikke gemme skabelon", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, isPlatform }: { id: number; isPlatform: boolean }) => {
      if (isPlatform) {
        await apiRequest("DELETE", `/api/platform/templates/${id}`);
        return;
      }
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Skabelon slettet" });
      setEditingTemplate(null);
      setDesignerOpen(false);
    },
    onError: () => toast({ title: "Kunne ikke slette skabelon", variant: "destructive" }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (t: Template) => {
      const isPlatform = t.companyId == null;
      const url = isPlatform ? `/api/platform/templates/${t.id}` : `/api/templates/${t.id}`;
      const res = await apiRequest("PATCH", url, { isDefault: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Sat som standard" });
    },
    onError: () => toast({ title: "Kunne ikke ændre standard", variant: "destructive" }),
  });

  const allTemplates = templates ?? [];
  const standardTemplates = allTemplates.filter((t) => t.companyId == null);
  const companyTemplates = allTemplates.filter((t) => t.companyId === companyId);

  // En redigeres en platform-skabelon? Det gælder hvis enten platformMode er slået til ved oprettelse,
  // eller den valgte skabelon har companyId === null.
  const editingPlatform = platformMode || (editingTemplate?.companyId == null && editingTemplate != null);
  // Standardskabeloner er skrivebeskyttede for almindelige brugere — men platform_admin kan redigere dem.
  const readOnly = editingPlatform ? !isPlatformAdmin : false;

  function openCreate(asPlatform = false) {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setPlatformMode(asPlatform);
    setDesignerOpen(true);
  }

  function openTemplate(t: Template) {
    setEditingTemplate(t);
    setForm(toForm(t));
    setPlatformMode(t.companyId == null);
    setDesignerOpen(true);
  }

  function backToList() {
    setDesignerOpen(false);
    setEditingTemplate(null);
    setPlatformMode(false);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Navn er påkrævet", variant: "destructive" });
      return;
    }
    const id = editingTemplate?.id ?? null;
    // For platform-skabeloner gemmes companyId som null; ellers virksomhedens eget id.
    const resolvedCompanyId = editingPlatform ? null : (id ? editingTemplate!.companyId : companyId);
    const payload: Partial<Template> = {
      companyId: resolvedCompanyId,
      name: form.name.trim(),
      type: form.type,
      subject: form.subject || null,
      body: form.body || null,
      logoPosition: form.logoPosition,
      primaryColor: form.primaryColor,
      headerLayout: form.headerLayout,
      showBankInfo: form.showBankInfo ? 1 : 0,
      showPaymentTerms: form.showPaymentTerms ? 1 : 0,
      showEAN: form.showEAN ? 1 : 0,
      columns: JSON.stringify(form.columns),
      footerText: form.footerText || null,
      termsConditions: form.termsConditions || null,
    };
    saveMutation.mutate({ id, data: payload, isPlatform: editingPlatform });
  }

  // Update a form field
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Column management
  function addColumn() {
    setForm((f) => ({ ...f, columns: [...f.columns, { key: "ny", label: "Ny kolonne", width: "15" }] }));
  }
  function updateColumn(idx: number, field: keyof TemplateColumn, value: string) {
    setForm((f) => ({ ...f, columns: f.columns.map((c, i) => (i === idx ? { ...c, [field]: value } : c)) }));
  }
  function removeColumn(idx: number) {
    setForm((f) => ({ ...f, columns: f.columns.filter((_, i) => i !== idx) }));
  }

  // ─── DESIGNER VIEW ──────────────────────────────────────────────
  if (designerOpen) {
    return (
      <DesignerView
        form={form}
        readOnly={readOnly}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        isPlatform={editingPlatform}
        onBack={backToList}
        onSave={handleSave}
        onDelete={editingTemplate && !readOnly ? () => deleteMutation.mutate({ id: editingTemplate.id, isPlatform: editingPlatform }) : undefined}
        onSetDefault={editingTemplate && !readOnly ? () => setDefaultMutation.mutate(editingTemplate) : undefined}
        update={update}
        addColumn={addColumn}
        updateColumn={updateColumn}
        removeColumn={removeColumn}
        isDefault={editingTemplate?.isDefault === 1}
      />
    );
  }

  // ─── LIST VIEW ─────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Dokumenter"
        title="Skabeloner"
        description="Visuel designer til tilbud, fakturaer og rykkere"
      />

      <div className="flex items-center justify-end gap-2">
        {isPlatformAdmin && (
          <Button variant="outline" onClick={() => openCreate(true)} data-testid="button-new-platform-template">
            <Plus className="w-4 h-4 mr-1.5" />
            Opret platform-skabelon
          </Button>
        )}
        <Button onClick={() => openCreate(false)} data-testid="button-new-template">
          <Plus className="w-4 h-4 mr-1.5" />
          Opret skabelon
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Company templates */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Virksomhedens skabeloner
            </h3>
            {companyTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="empty-company-templates">
                Ingen virksomhedsskabeloner endnu. Opret en ny skabelon for at komme i gang.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {companyTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onClick={() => openTemplate(t)}
                    testId={`card-template-${t.id}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Platform templates (standard) — visible to all, editable only by platform_admin */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Platform skabeloner
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {isPlatformAdmin ? "Synlig for alle virksomheder — du kan redigere" : "Standardskabeloner (skrivebeskyttet)"}
              </span>
            </div>
            {standardTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="empty-platform-templates">
                {isPlatformAdmin ? "Ingen platform-skabeloner endnu. Opret en for at gøre den tilgængelig for alle virksomheder." : "Ingen platform-skabeloner endnu."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {standardTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onClick={() => openTemplate(t)}
                    testId={`card-standard-template-${t.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template card ──────────────────────────────────────────────
function TemplateCard({
  template,
  onClick,
  testId,
}: {
  template: Template;
  onClick: () => void;
  testId: string;
}) {
  const isStandard = template.companyId == null;
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="text-left bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutTemplate className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">{template.name}</span>
        </div>
        {template.isDefault === 1 && (
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="secondary" data-testid={`badge-type-${template.id}`}>
          {TYPE_LABELS[template.type] ?? template.type}
        </Badge>
        {isStandard ? (
          <Badge variant="outline" data-testid={`badge-standard-${template.id}`}>
            Standard
          </Badge>
        ) : (
          <Badge variant="default" data-testid={`badge-company-${template.id}`}>
            Virksomhed
          </Badge>
        )}
      </div>
    </button>
  );
}

// ─── Designer view (split) ──────────────────────────────────────
interface DesignerProps {
  form: FormState;
  readOnly: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isDefault: boolean;
  isPlatform: boolean;
  onBack: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  addColumn: () => void;
  updateColumn: (idx: number, field: keyof TemplateColumn, value: string) => void;
  removeColumn: (idx: number) => void;
}

function DesignerView({
  form,
  readOnly,
  isSaving,
  isDeleting,
  isDefault,
  isPlatform,
  onBack,
  onSave,
  onDelete,
  onSetDefault,
  update,
  addColumn,
  updateColumn,
  removeColumn,
}: DesignerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-list">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Tilbage
        </Button>
        <div className="flex items-center gap-2">
          {isPlatform && (
            <Badge variant="outline" data-testid="badge-platform-template">Platform</Badge>
          )}
          {isDefault && (
            <Badge variant="default" data-testid="badge-isdefault">
              <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
              Standard
            </Badge>
          )}
          {onSetDefault && !readOnly && !isDefault && (
            <Button variant="outline" size="sm" onClick={onSetDefault} data-testid="button-set-default">
              <Star className="w-4 h-4 mr-1" />
              Brug som standard
            </Button>
          )}
          {onDelete && !readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid="button-delete-template"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Slet
            </Button>
          )}
          {!readOnly && (
            <Button onClick={onSave} disabled={isSaving} data-testid="button-save-template">
              {isSaving ? "Gemmer…" : "Gem skabelon"}
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
          Dette er en platform-skabelon og kan ikke redigeres her. Opret en virksomhedsskabelon for at tilpasse.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* LEFT: settings */}
        <SectionCard title="Indstillinger" icon={<LayoutTemplate className="w-4 h-4" />} noPadding>
          <div className="space-y-4 p-3">
            <div className="space-y-1">
              <Label htmlFor="tpl-name">Navn</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                disabled={readOnly}
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v: TemplateType) => update("type", v)}
                disabled={readOnly}
              >
                <SelectTrigger id="tpl-type" data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-logo">Logo placering</Label>
              <Select
                value={form.logoPosition}
                onValueChange={(v: LogoPosition) => update("logoPosition", v)}
                disabled={readOnly}
              >
                <SelectTrigger id="tpl-logo" data-testid="select-template-logo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-color">Primær farve</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  disabled={readOnly}
                  className="h-9 w-12 rounded-md border border-border cursor-pointer disabled:cursor-not-allowed"
                  data-testid="input-template-color-picker"
                />
                <Input
                  id="tpl-color"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  disabled={readOnly}
                  placeholder="#2176d4"
                  data-testid="input-template-color"
                />
                <div
                  className="h-9 w-9 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: form.primaryColor }}
                  data-testid="preview-color-swatch"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-header">Header layout</Label>
              <Select
                value={form.headerLayout}
                onValueChange={(v: HeaderLayout) => update("headerLayout", v)}
                disabled={readOnly}
              >
                <SelectTrigger id="tpl-header" data-testid="select-template-header">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visning</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tpl-bank"
                    checked={form.showBankInfo}
                    onCheckedChange={(v) => update("showBankInfo", v === true)}
                    disabled={readOnly}
                    data-testid="checkbox-template-bank"
                  />
                  <Label htmlFor="tpl-bank" className="text-sm font-normal cursor-pointer">
                    Vis bankoplysninger
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tpl-terms"
                    checked={form.showPaymentTerms}
                    onCheckedChange={(v) => update("showPaymentTerms", v === true)}
                    disabled={readOnly}
                    data-testid="checkbox-template-terms"
                  />
                  <Label htmlFor="tpl-terms" className="text-sm font-normal cursor-pointer">
                    Vis betalingsbetingelser
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tpl-ean"
                    checked={form.showEAN}
                    onCheckedChange={(v) => update("showEAN", v === true)}
                    disabled={readOnly}
                    data-testid="checkbox-template-ean"
                  />
                  <Label htmlFor="tpl-ean" className="text-sm font-normal cursor-pointer">
                    Vis EAN
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-subject">Email emne</Label>
              <Input
                id="tpl-subject"
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                disabled={readOnly}
                placeholder="f.eks. Tilbud fra {virksomhed}"
                data-testid="input-template-subject"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-body">Email tekst</Label>
              <Textarea
                id="tpl-body"
                value={form.body}
                onChange={(e) => update("body", e.target.value)}
                disabled={readOnly}
                rows={4}
                placeholder="Tekst der sendes sammen med dokumentet"
                data-testid="input-template-body"
              />
            </div>

            {/* Columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kolonner</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addColumn}
                    data-testid="button-template-addcolumn"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tilføj
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {form.columns.map((c, idx) => (
                  <div key={idx} className="flex items-end gap-2" data-testid={`column-item-${idx}`}>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`col-key-${idx}`} className="text-xs text-muted-foreground">
                        Nøgle
                      </Label>
                      <Input
                        id={`col-key-${idx}`}
                        value={c.key}
                        onChange={(e) => updateColumn(idx, "key", e.target.value)}
                        disabled={readOnly}
                        data-testid={`input-column-key-${idx}`}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`col-label-${idx}`} className="text-xs text-muted-foreground">
                        Label
                      </Label>
                      <Input
                        id={`col-label-${idx}`}
                        value={c.label}
                        onChange={(e) => updateColumn(idx, "label", e.target.value)}
                        disabled={readOnly}
                        data-testid={`input-column-label-${idx}`}
                      />
                    </div>
                    <div className="w-20 space-y-1">
                      <Label htmlFor={`col-width-${idx}`} className="text-xs text-muted-foreground">
                        Bredde
                      </Label>
                      <Input
                        id={`col-width-${idx}`}
                        type="number"
                        min="1"
                        max="100"
                        value={c.width}
                        onChange={(e) => updateColumn(idx, "width", e.target.value)}
                        disabled={readOnly}
                        data-testid={`input-column-width-${idx}`}
                      />
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeColumn(idx)}
                        className="p-2 rounded-md hover:bg-muted text-destructive mb-0.5"
                        data-testid={`button-removecolumn-${idx}`}
                        aria-label="Fjern kolonne"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-footer">Footer tekst</Label>
              <Textarea
                id="tpl-footer"
                value={form.footerText}
                onChange={(e) => update("footerText", e.target.value)}
                disabled={readOnly}
                rows={2}
                placeholder="f.eks. Tak for samarbejdet"
                data-testid="input-template-footer"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-conditions">Vilkår og betingelser</Label>
              <Textarea
                id="tpl-conditions"
                value={form.termsConditions}
                onChange={(e) => update("termsConditions", e.target.value)}
                disabled={readOnly}
                rows={4}
                placeholder="Standard vilkår der vises i bunden af dokumentet"
                data-testid="input-template-conditions"
              />
            </div>
          </div>
        </SectionCard>

        {/* RIGHT: live preview */}
        <SectionCard title="Live preview" icon={<FileText className="w-4 h-4" />} noPadding>
          <div className="p-3 bg-muted/30">
            <DocumentPreview form={form} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Document preview ──────────────────────────────────────────
function DocumentPreview({ form }: { form: FormState }) {
  const { logoPosition, primaryColor, headerLayout, showBankInfo, showPaymentTerms, showEAN, columns, footerText, termsConditions, type } = form;

  const accent = primaryColor || "#2176d4";
  const docTitle = TYPE_LABELS[type] ?? "Dokument";

  // Sample line items for preview
  const sampleItems = [
    { description: "Kontorrengøring", qty: "4", unit: "timer", price: "350,00", total: "1.400,00" },
    { description: "Gulvvask", qty: "120", unit: "m²", price: "12,50", total: "1.500,00" },
    { description: "Vinduespudsning", qty: "8", unit: "stk", price: "75,00", total: "600,00" },
  ];

  const subtotal = 3500;
  const vat = Math.round(subtotal * 0.25);
  const total = subtotal + vat;

  const logoBlock =
    logoPosition !== "none" ? (
      <div
        className="w-14 h-14 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: accent }}
      >
        LOGO
      </div>
    ) : null;

  // Logo placement controls: where on the full-width header the logo sits
  const logoOnRight = logoPosition === "right";
  const logoCentered = logoPosition === "center";

  const totalColWidth = columns.reduce((sum, c) => {
    const n = parseInt(c.width, 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0) || 100;

  return (
    <div
      className="bg-white text-gray-900 rounded-md shadow-sm border border-gray-200 overflow-hidden mx-auto"
      style={{ maxWidth: "640px" }}
      data-testid="document-preview"
    >
      {/* Color accent bar */}
      <div className="h-1.5" style={{ backgroundColor: accent }} />

      <div className="p-5">
        {/* Header */}
        {headerLayout === "minimal" ? (
          <div className="mb-4">
            {logoCentered ? (
              <div className="flex flex-col items-center gap-2 w-full">
                {logoBlock}
                <div className="text-center shrink-0">
                  <p className="text-base font-bold" style={{ color: accent }}>Virksomhed ApS</p>
                  <p className="text-[10px] text-gray-500">Rengøringsservice</p>
                </div>
              </div>
            ) : (
              <div className={`flex items-center gap-3 w-full ${logoOnRight ? "flex-row-reverse" : ""}`}>
                {logoBlock}
                <div className="shrink-0">
                  <p className="text-base font-bold" style={{ color: accent }}>Virksomhed ApS</p>
                  <p className="text-[10px] text-gray-500">Rengøringsservice</p>
                </div>
              </div>
            )}
          </div>
        ) : headerLayout === "modern" ? (
          logoCentered ? (
            <div className="mb-4 text-center">
              <div className="flex justify-center mb-2">{logoBlock}</div>
              <p className="text-base font-bold" style={{ color: accent }}>Virksomhed ApS</p>
              <p className="text-[10px] text-gray-500">Virksomhedsvej 1 · 1000 København</p>
              <p className="text-[10px] text-gray-500">CVR 12345678</p>
              <p className="text-xl font-bold mt-2" style={{ color: accent }}>{docTitle}</p>
              <p className="text-[10px] text-gray-500">Nr. 2026-0001</p>
            </div>
          ) : (
            <div className={`mb-4 flex items-center justify-between gap-3 ${logoOnRight ? "flex-row-reverse" : ""}`}>
              <div className="flex items-center gap-3 flex-1">
                {logoBlock}
                <div className="shrink-0">
                  <p className="text-base font-bold" style={{ color: accent }}>Virksomhed ApS</p>
                  <p className="text-[10px] text-gray-500">Virksomhedsvej 1 · 1000 København</p>
                  <p className="text-[10px] text-gray-500">CVR 12345678</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold" style={{ color: accent }}>{docTitle}</p>
                <p className="text-[10px] text-gray-500">Nr. 2026-0001</p>
              </div>
            </div>
          )
        ) : (
          logoCentered ? (
            <div className="mb-4 text-center">
              <div className="flex justify-center mb-2">{logoBlock}</div>
              <p className="text-base font-bold" style={{ color: accent }}>Virksomhed ApS</p>
              <p className="text-[10px] text-gray-500">Virksomhedsvej 1</p>
              <p className="text-[10px] text-gray-500">1000 København</p>
              <p className="text-[10px] text-gray-500">CVR 12345678</p>
              <p className="text-xl font-bold mt-2 text-gray-900">{docTitle}</p>
              <p className="text-[10px] text-gray-500">Dato: 16.08.2026</p>
              <p className="text-[10px] text-gray-500">Nr. 2026-0001</p>
            </div>
          ) : (
            <div className={`mb-4 flex items-start justify-between gap-3 ${logoOnRight ? "flex-row-reverse" : ""}`}>
              <div className="flex items-center gap-3 flex-1">
                {logoBlock}
                <div className="shrink-0">
                  <p className="text-base font-bold" style={{ color: accent }}>Virksomhed ApS</p>
                  <p className="text-[10px] text-gray-500">Virksomhedsvej 1</p>
                  <p className="text-[10px] text-gray-500">1000 København</p>
                  <p className="text-[10px] text-gray-500">CVR 12345678</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-gray-900">{docTitle}</p>
                <p className="text-[10px] text-gray-500">Dato: 16.08.2026</p>
                <p className="text-[10px] text-gray-500">Nr. 2026-0001</p>
              </div>
            </div>
          )
        )}

        {/* Customer block */}
        <div className="mb-4 rounded border border-gray-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Til kunde</p>
          <p className="text-sm font-medium">Kunde A/S</p>
          <p className="text-[11px] text-gray-600">Att. Jens Hansen</p>
          <p className="text-[11px] text-gray-600">Kundegade 12</p>
          <p className="text-[11px] text-gray-600">2000 Frederiksberg</p>
          {showEAN && (
            <p className="text-[11px] text-gray-600 mt-1">
              EAN: 5790000000001
            </p>
          )}
        </div>

        {/* Line items table */}
        <div className="mb-4">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr style={{ backgroundColor: accent }}>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-1.5 text-white font-semibold text-left first:rounded-l first:pl-2.5 last:rounded-r"
                    style={{ width: `${(parseInt(c.width, 10) / totalColWidth) * 100}%` }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 first:pl-2.5 text-gray-700">
                      {(item as Record<string, string>)[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-48 text-[11px]">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular-nums">{subtotal.toLocaleString("da-DK")} kr.</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Moms (25%)</span>
              <span className="tabular-nums">{vat.toLocaleString("da-DK")} kr.</span>
            </div>
            <div
              className="flex justify-between py-1.5 mt-1 border-t font-bold text-white px-2 rounded"
              style={{ backgroundColor: accent }}
            >
              <span>Total</span>
              <span className="tabular-nums">{total.toLocaleString("da-DK")} kr.</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        {showPaymentTerms && (
          <div className="mb-3 text-[11px]">
            <p className="font-semibold text-gray-700 mb-0.5">Betalingsbetingelser</p>
            <p className="text-gray-500">Betalingsfrist: 8 dage. Betaling via bankoverførsel.</p>
          </div>
        )}

        {/* Bank info */}
        {showBankInfo && (
          <div className="mb-3 text-[11px]">
            <p className="font-semibold text-gray-700 mb-0.5">Bankoplysninger</p>
            <p className="text-gray-500">Bank: Eksempel Bank · Regnr: 1234 · Kontonr: 0000001234</p>
          </div>
        )}

        {/* Footer */}
        {footerText && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500">
            {footerText}
          </div>
        )}

        {/* Terms */}
        {termsConditions && (
          <div className="mt-3 text-[10px] text-gray-400 leading-relaxed">
            <p className="font-semibold text-gray-500 mb-0.5">Vilkår og betingelser</p>
            {termsConditions}
          </div>
        )}
      </div>
    </div>
  );
}

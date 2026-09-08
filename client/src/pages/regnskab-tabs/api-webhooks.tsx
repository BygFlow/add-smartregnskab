import { useState } from "react";
import { PageHeader, SectionCard, StatusChip } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Webhook,
  KeyRound,
  Gauge,
  Plug,
  Code2,
  CheckCircle2,
  Copy,
  ShieldCheck,
} from "lucide-react";

/* ---------- data ---------- */

const APIS = [
  {
    name: "Bogførings-API",
    path: "/api/journal-entries",
    desc: "Opret, opdater og hent bogføringsposter og bilagslinjer.",
    badge: "Klar til integration",
  },
  {
    name: "Kontoplan-API",
    path: "/api/accounts",
    desc: "Administrér kontoplanen — opret, rediger og afstil konti.",
    badge: "Klar til integration",
  },
  {
    name: "Moms-API",
    path: "/api/vat-periods",
    desc: "Hent og indberet momsperioder og afstem momsregistreringer.",
    badge: "Klar til integration",
  },
  {
    name: "Bilags-API",
    path: "/api/receipts",
    desc: "Upload, klassificér og hent bilag med OCR- og AI-understøttelse.",
    badge: "Klar til integration",
  },
  {
    name: "Bank-API",
    path: "/api/bank-reconciliation",
    desc: "Afstem banktransaktioner og kør automatiske afstemningsregler.",
    badge: "Beta",
  },
  {
    name: "Rapport-API",
    path: "/api/reports",
    desc: "Generér resultatopgørelse, balance og driftsregnskab som PDF/CSV.",
    badge: "Klar til integration",
  },
];

const WEBHOOKS = [
  { event: "journal_entry.created", desc: "Når en bogføringspost oprettes." },
  { event: "journal_entry.approved", desc: "Når en post godkendes." },
  { event: "vat_period.submitted", desc: "Når en momsperiode indberettes." },
  { event: "receipt.uploaded", desc: "Når et bilag uploades." },
  { event: "bank.imported", desc: "Når banktransaktioner importeres." },
  { event: "report.generated", desc: "Når en rapport genereres." },
];

const RATE_LIMITS = [
  { window: "Pr. sekund", limit: "30 anmodninger" },
  { window: "Pr. minut", limit: "600 anmodninger" },
  { window: "Pr. dag", limit: "50.000 anmodninger" },
  { window: "Burst", limit: "Op til 50 anmodninger" },
];

const CODE_SAMPLES: Record<string, string> = {
  curl: `# Hent bogføringsposter
curl -X GET "https://api.smartregnskab.dk/api/journal-entries?companyId=42" \\
  -H "Authorization: Bearer <DIN_API_NØGLE>" \\
  -H "Content-Type: application/json"`,
  node: `// Opret en bogføringspost (Node.js)
const res = await fetch(
  "https://api.smartregnskab.dk/api/journal-entries?companyId=42",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.SMARTREGNSKAB_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date: "2026-08-25",
      description: "Kontortilbehør",
      lines: [{ accountId: 6000, debit: 1250 }],
    }),
  },
);
const entry = await res.json();`,
  php: `<?php
// Hent kontoplan (PHP)
$ch = curl_init("https://api.smartregnskab.dk/api/accounts?companyId=42");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer " . getenv("SMARTREGNSKAB_API_KEY"),
  "Content-Type: application/json",
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);`,
  webhook: `// Modtag et webhook (Express)
app.post("/webhooks/smartregnskab", (req, res) => {
  const signature = req.headers["x-smartregnskab-signature"];
  const payload = req.body; // verifikér signatur i produktion

  if (payload.event === "vat_period.submitted") {
    console.log("Moms indberettet:", payload.data.periodId);
  }
  res.sendStatus(200);
});`,
};

const SAMPLE_TABS = [
  { id: "curl", label: "cURL" },
  { id: "node", label: "Node.js" },
  { id: "php", label: "PHP" },
  { id: "webhook", label: "Webhook" },
] as const;

type SampleId = (typeof SAMPLE_TABS)[number]["id"];

/* ---------- komponent ---------- */

export default function ApiWebhooks({ companyId }: { companyId: number }) {
  const [activeSample, setActiveSample] = useState<SampleId>("curl");
  const [copied, setCopied] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(CODE_SAMPLES[activeSample]).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="API & Webhooks (beta) — Dokumentation og integration"
        description="Oversigt over tilgængelige API'er, webhooks, rate limits og autentificering."
        action={
          <Button
            data-testid="generate-key-btn"
            size="sm"
            variant="outline"
            onClick={() => setKeyOpen(true)}
          >
            <KeyRound className="w-4 h-4 mr-1" /> Opret API-nøgle
          </Button>
        }
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        Beta: API & Webhooks er under udvikling. Endpoints og payloads kan ændres inden endelig udgivelse. Regnskab for virksomhed #{companyId} bruges i alle eksempler.
      </div>

      {/* Tilgængelige API'er */}
      <SectionCard title="Tilgængelige API'er" icon={<Plug className="w-4 h-4" />} noPadding>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {APIS.map((api) => (
            <Card key={api.path} data-testid={`api-card-${api.path}`} className="overflow-hidden">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{api.name}</p>
                  <StatusChip
                    status={api.badge}
                    variant={api.badge === "Klar til integration" ? "green" : "amber"}
                    icon={<CheckCircle2 className="w-3 h-3" />}
                  />
                </div>
                <code className="block text-xs text-blue-600 dark:text-blue-400 font-mono">
                  {api.path}
                </code>
                <p className="text-xs text-muted-foreground">{api.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionCard>

      {/* Webhooks */}
      <SectionCard title="Webhooks" icon={<Webhook className="w-4 h-4" />} noPadding>
        <div className="divide-y divide-border">
          {WEBHOOKS.map((wh) => (
            <div
              key={wh.event}
              data-testid={`webhook-${wh.event}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <code className="text-xs font-mono text-foreground">{wh.event}</code>
                <p className="text-xs text-muted-foreground">{wh.desc}</p>
              </div>
              <StatusChip status="Aktiv" variant="green" icon={<CheckCircle2 className="w-3 h-3" />} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Rate limits */}
      <SectionCard title="Rate limits" icon={<Gauge className="w-4 h-4" />} noPadding>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {RATE_LIMITS.map((rl) => (
            <div key={rl.window} className="px-3 py-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{rl.window}</p>
              <p className="text-sm font-semibold mt-1">{rl.limit}</p>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
          Rate limits returneres i headers: <code className="font-mono">X-RateLimit-Remaining</code> og{" "}
          <code className="font-mono">X-RateLimit-Reset</code>.
        </div>
      </SectionCard>

      {/* Autentificering */}
      <SectionCard title="Autentificering" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="space-y-2 text-sm">
          <p>
            Alle anmodninger kræver en gyldig API-nøgle sendt som Bearer-token i{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Authorization</code>-headeren.
          </p>
          <div className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs overflow-x-auto">
            Authorization: Bearer &lt;DIN_API_NØGLE&gt;
          </div>
          <p className="text-xs text-muted-foreground">
            API-nøgler er bundet til din virksomhed og har kun adgang til dens data. Generér,
            roter og tilbagekald nøgler under virksomhedsindstillinger.
          </p>
        </div>
      </SectionCard>

      {/* Kodeeksempler */}
      <SectionCard
        title="Kodeeksempler"
        icon={<Code2 className="w-4 h-4" />}
        noPadding
      >
        <div className="flex items-center justify-between border-b border-border px-2">
          <div className="flex" role="tablist">
            {SAMPLE_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeSample === t.id}
                data-testid={`sample-tab-${t.id}`}
                onClick={() => setActiveSample(t.id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeSample === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            data-testid="copy-code-btn"
            variant="ghost"
            size="sm"
            onClick={copyCode}
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <pre
          data-testid="code-sample"
          className="px-3 py-3 text-xs font-mono overflow-x-auto bg-muted/30 whitespace-pre"
        >
          {CODE_SAMPLES[activeSample]}
        </pre>
      </SectionCard>

      <KeyDialog open={keyOpen} onOpenChange={setKeyOpen} />
    </div>
  );
}

/* ---------- API-nøgle dialog (mock) ---------- */

function KeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret API-nøgle</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            I produktion oprettes og roteres API-nøgler i virksomhedsindstillinger under
            <span className="text-foreground"> Integrationer → API-nøgler</span>.
          </p>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Beta: Generering af API-nøgler er ikke aktiveret i denne sandbox.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="close-key-dialog-btn"
          >
            Luk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

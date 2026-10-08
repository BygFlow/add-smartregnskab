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
    name: "Virksomheds-API",
    path: "GET /api/external/v1/company",
    desc: "Hent stamdata for den virksomhed, som API-nøglen tilhører.",
    badge: "API-kontrakt",
  },
  {
    name: "Kunde-API",
    path: "GET /api/external/v1/customers",
    desc: "Hent virksomhedens kunder til sikre integrationer og fakturaflow.",
    badge: "API-kontrakt",
  },
  {
    name: "Fakturaliste",
    path: "GET /api/external/v1/invoices",
    desc: "Hent fakturaer og status for den virksomhed, som nøglen er bundet til.",
    badge: "API-kontrakt",
  },
  {
    name: "Fakturamodtagelse",
    path: "POST /api/external/v1/invoices",
    desc: "Modtag fakturakladder eller endelige fakturaer. Endelige fakturaer bogføres automatisk.",
    badge: "API-kontrakt",
  },
];

const WEBHOOKS = [
  { event: "invoice.created", desc: "Når en fakturakladde eller endelig faktura modtages gennem integrations-API'et." },
];

const RATE_LIMITS = [
  { window: "Standard pr. nøgle", limit: "1.000 pr. minut" },
  { window: "Minimum", limit: "60 pr. minut" },
  { window: "Maksimum", limit: "10.000 pr. minut" },
  { window: "Overskridelse", limit: "HTTP 429" },
];

const CODE_SAMPLES: Record<string, string> = {
  curl: `# Hent virksomhedens fakturaer
curl -X GET "https://app.addsmartregnskab.dk/api/external/v1/invoices" \\
  -H "Authorization: Bearer <DIN_API_NØGLE>"`,
  node: `// Send en endelig faktura fra et eksternt system (Node.js)
const res = await fetch(
  "https://app.addsmartregnskab.dk/api/external/v1/invoices",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.SMARTREGNSKAB_API_KEY}\`,
      "Content-Type": "application/json",
      "Idempotency-Key": "kildesystem-faktura-103",
    },
    body: JSON.stringify({
      documentType: "invoice", // eller "draft"
      invoiceNumber: "103",
      customerId: 42,
      issueDate: "2026-10-08",
      paymentTerms: 14,
      lines: [{
        description: "Udført arbejde",
        quantity: 2,
        unitPrice: 750,
        vatRate: 25,
        accountNumber: "1010",
      }],
    }),
  },
);
const invoice = await res.json();`,
  php: `<?php
// Hent kunder (PHP)
$ch = curl_init("https://app.addsmartregnskab.dk/api/external/v1/customers");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer " . getenv("SMARTREGNSKAB_API_KEY"),
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);`,
  webhook: `// Modtag og verificér et webhook (Express)
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

app.post("/webhooks/smartregnskab", express.raw({ type: "application/json" }), (req, res) => {
  const received = String(req.headers["x-smartregnskab-signature"] || "");
  const signingSecret = createHash("sha256")
    .update(process.env.SMARTREGNSKAB_API_KEY)
    .digest("hex");
  const expected = createHmac("sha256", signingSecret)
    .update(req.body)
    .digest("hex");
  const valid = received.length === expected.length &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!valid) return res.sendStatus(401);

  const payload = JSON.parse(req.body.toString("utf8"));
  if (payload.event === "invoice.created") {
    console.log("Faktura modtaget:", payload.data.invoiceNumber);
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
        title="API & Webhooks — Dokumentation og integration"
        description="Tenant-isoleret integrations-API til eksterne programmer, fakturaflow og signerede webhooks."
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

      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        API-nøglen vælger automatisk virksomhed #{companyId}; et companyId kan derfor ikke bruges til at læse en anden virksomheds data. Fakturakladder forbliver kladder. Endelige fakturaer kræver et kildesystem-fakturanummer, bogføres ved modtagelsen og beskyttes mod dubletter med <code className="font-mono">Idempotency-Key</code>.
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
                    variant={api.badge === "API-kontrakt" ? "blue" : "amber"}
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
              <StatusChip status="Hændelsestype" variant="blue" icon={<CheckCircle2 className="w-3 h-3" />} />
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
          Den valgte grænse gælder pr. API-nøgle og pr. minut. Rate limits returneres i headers: <code className="font-mono">X-RateLimit-Limit</code>,{" "}
          <code className="font-mono">X-RateLimit-Remaining</code> og{" "}
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

/* ---------- Genvej til den rigtige API-nøglestyring ---------- */

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
            API-nøgler oprettes, roteres og tilbagekaldes i den separate nøglestyring under
            <span className="text-foreground"> Integrationer → API-nøgler</span>.
          </p>
          <p className="text-xs">
            Den fulde nøgle vises kun én gang. Opbevar den i en godkendt password manager eller secret manager.
          </p>
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
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              window.location.hash = "/smartregnskab/app/api_keys_mgmt";
            }}
            data-testid="open-api-key-management-btn"
          >
            Gå til API-nøgler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

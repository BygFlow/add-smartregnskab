# ADD SmartDrift Clean — Produktionsdrift

## Oversigt

Denne vejledning beskriver hvordan ADD SmartDrift Clean sættes i produktion på Render.

**System version:** 3.1.0
**Stack:** Express + Vite + React 19 + TypeScript + Tailwind v3 + shadcn/ui + Drizzle ORM + SQLite + TanStack Query v5

---

## 1. Forberedelse

### 1.1 Generer krypteringsnøgle

```bash
openssl rand -hex 32
```

Gem denne streng — den bruges til at kryptere følsomme data (API-nøgler, betalingsinfo).
Uden denne nøgle kan data ikke dekrypteres efter genstart.

### 1.2 Opret Stripe-konto

1. Gå til [dashboard.stripe.com](https://dashboard.stripe.com)
2. Hent API-nøgler: `sk_live_...` (secret key)
3. Opret webhook endpoint: `https://addsmartdrift.dk/api/webhooks/stripe`
4. Hent webhook secret: `whsec_...`

### 1.3 Opret Resend-konto (email)

1. Gå til [resend.com](https://resend.com)
2. Opret API key: `re_...`
3. Verificer afsenderdomæne: `addsmartdrift.dk`
4. Sæt `MAIL_FROM=noreply@addsmartdrift.dk`

### 1.4 Køb domæne

Køb `addsmartdrift.dk` hos en DNS-udbyder (f.eks. Simply.com, Scannet).

---

## 2. Deployment på Render

### 2.1 Opret web service

1. Gå til [render.com](https://render.com) og opret en konto
2. "New" → "Web Service" → vælg dit GitHub-repository
3. Render læser automatisk `render.yaml`

### 2.2 Konfiguration

| Indstilling | Værdi |
|-------------|-------|
| Runtime | Node |
| Plan | Starter ($7/mo) |
| Region | Frankfurt |
| Build | `npm ci && npm run build` |
| Start | `node dist/index.cjs` |
| Health check | `/healthz` |
| Disk | 5 GB persistent (`/var/data`) |

### 2.3 Miljøvariabler

Sæt disse i Render's dashboard (Environment tab):

**Kritisk:**
- `ENCRYPTION_KEY` — fra trin 1.1
- `APP_BASE_URL` — `https://addsmartdrift.dk`
- `DATABASE_PATH` — `/var/data/data.db` (auto-sat af render.yaml)
- `FILE_STORAGE_DIR` — `/var/data/files` (auto-sat af render.yaml)

**Betaling:**
- `STRIPE_SECRET_KEY` — fra trin 1.2
- `STRIPE_WEBHOOK_SECRET` — fra trin 1.2

**Email:**
- `RESEND_API_KEY` — fra trin 1.3
- `MAIL_FROM` — `noreply@addsmartdrift.dk`

### 2.4 Peg domæne

1. I Render: Settings → Custom Domains → tilføj `addsmartdrift.dk`
2. Hos din DNS-udbyder: opret CNAME-record:
   ```
   addsmartdrift.dk → add-smartdrift-clean.onrender.com
   ```
3. Vent på at SSL-certifikat genereres automatisk (5-30 min)

### 2.5 Verificer

Tjek at serveren kører:
```bash
curl https://addsmartdrift.dk/healthz
curl https://addsmartdrift.dk/readyz
```

Kør miljøtjek:
```bash
node scripts/check-production-env.mjs
```

---

## 3. Stripe webhook

### 3.1 Opsætning

1. Stripe Dashboard → Developers → Webhooks
2. Endpoint URL: `https://addsmartdrift.dk/api/webhooks/stripe`
3. Events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 3.2 Verificer

Send en test-event fra Stripe dashboardet. Tjek at serveren logger:
```
[express] POST /api/webhooks/stripe 200 45ms
```

---

## 4. Backup

### 4.1 Automatisk backup

Kør backup-scriptet manuelt eller via cron:
```bash
node scripts/backup-sqlite.mjs
```

Backups gemmes i `BACKUP_DIR` (default: `/var/data/backups`).
De 10 nyeste backups beholdes automatisk.

### 4.2 Gendannelse

```bash
# Stop serveren først
cp /var/data/backups/data-2026-09-04T10-30-00.db /var/data/data.db
# Genstart serveren
```

---

## 5. Migrering

Ved schema-ændringer (nye tabeller/kolonner):

```bash
# Tager automatisk backup først
node scripts/migrate-sqlite-prod.mjs
```

Kør ALDRIG `drizzle-kit push --force` direkte i produktion uden backup.

---

## 6. Overvågning

### 6.1 Health endpoints

- `/healthz` — app status, version, konfiguration, memory, jobs
- `/readyz` — DB tilgængelig, filsystem skrivbart

### 6.2 Render dashboard

Render viser automatisk:
- CPU/RAM forbrug
- Request volumen
- Response times
- Deploy historik

### 6.3 Logs

Alle API-requests logges med:
- Request ID
- Metode + sti
- Status kode
- Responstid

Fejl logges med fuld stack trace server-side, men vises ikke til klienten.

---

## 7. Mobil-app

### 7.1 Android (Google Play)

1. Byg APK: `cd android && ./gradlew assembleRelease`
2. Upload til [Google Play Console](https://play.google.com/console)
3. Kræver: Google Play udviklerkonto ($25 engangs)

### 7.2 iOS (App Store)

1. Åbn `ios/App.xcworkspace` i Xcode
2. Archive og upload til App Store Connect
3. Kræver: Apple Developer konto ($99/år)

---

## 8. Regnskabsmodulet (SmartRegnskab)

**VIGTIGT:** SmartRegnskab er i **beta** og kræver:
- Revisorgodkendelse af bogførings- og momsrapporter
- Juridisk gennemgang af GDPR-compliance for regnskabsdata
- API-aftale med e-conomic for reel bogføringsintegration

Brug ikke SmartRegnskab til reel bogføring før disse er på plads.

---

## 9. Tjekliste før go-live

- [ ] `ENCRYPTION_KEY` genereret og sat
- [ ] Stripe API-nøgler sat (live mode)
- [ ] Stripe webhook oprettet og verificeret
- [ ] Resend API key sat og domæne verificeret
- [ ] Domæne købt og pegt mod Render
- [ ] SSL-certifikat aktiv
- [ ] `/healthz` returnerer status "ok"
- [ ] `/readyz` returnerer status "ready"
- [ ] Backup testet (opret + gendan)
- [ ] Demo-brugere slettet fra produktion
- [ ] `node scripts/check-production-env.mjs` passerer
- [ ] Android app uploadet til Google Play (valgfrit)
- [ ] iOS app uploadet til App Store (valgfrit)

# ADD SmartRegnskab

Selvstændig web- og mobilapplikation til dansk bogføring, fakturering, moms,
afstemning, rapportering, dokumentarkiv og regnskabsautomatisering.

SmartRegnskab har sit eget navn, login, PWA-manifest, mobil-app-id,
produktkonfiguration og driftsmiljø. SmartDrift-ruter er afskåret ved serverens
API-grænse og indgår ikke i den brugerrettede SmartRegnskab-applikation.

## Lokal start

Krav: Node.js 20 og npm.

```bash
npm ci
copy .env.example .env
npm run dev
```

Sæt mindst `ENCRYPTION_KEY`, `PLATFORM_ADMIN_EMAIL` og
`PLATFORM_ADMIN_PASSWORD` i `.env`. Produktionsadgangskoden skal være mindst
12 tegn.

## Verifikation

```bash
npm run verify
```

Kommandoen kører TypeScript-kontrol, produktions-build og smoke-tests af
migrering, backup, login, roller og centrale regnskabsfunktioner.

## Produktion

`render.yaml` beskriver en separat Render-tjeneste med persistent disk. Før
deploy skal alle værdier markeret `sync: false` sættes i Render. Eksterne
tjenester som Stripe, Resend, MobilePay og S3 aktiveres først, når gyldige
nøgler er tilføjet.

Startkommando:

```bash
npm run build
npm start
```

Sundhedstjek findes på `/healthz`, og readiness findes på `/readyz`.

## Juridisk status

Tekster om privatliv og databehandling er tekniske udkast og skal godkendes og
tilpasses af juridisk rådgiver før kommerciel produktion.

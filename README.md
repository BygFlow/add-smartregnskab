# ADD SmartRegnskab

Selvstændig web- og mobilapplikation til dansk bogføring, fakturering, moms,
afstemning, rapportering, dokumentarkiv og regnskabsautomatisering.

SmartRegnskab har sit eget navn, login, PWA-manifest, mobil-app-id,
produktkonfiguration og driftsmiljø. Kun SmartRegnskabs API-ruter er offentligt
tilgængelige; ældre interne tabeller er ikke en del af produktets brugerflade
eller API.

## Lokal start

Krav: Node.js 22.12 eller nyere og npm.

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

SAF-T 2.1 kan importeres og eksporteres fra menupunktet `SAF-T 2.1`. Eksporten
bruger standardkontoplanens version `20260101` og afviser ubalancerede
posteringer eller manglende stamdata.

Ekstern backup kræver S3-kompatibel objektlagring. En konsistent databasekopi
kontrolleres, uploades krypteret og verificeres med størrelse og SHA-256.

Startkommando:

```bash
npm run build
npm start
```

Sundhedstjek findes på `/healthz`, og readiness findes på `/readyz`.

## Juridisk status

Tekster om privatliv og databehandling er tekniske udkast og skal godkendes og
tilpasses af juridisk rådgiver før kommerciel produktion.

Den tekniske registreringspakke og de resterende myndighedskrav findes i
[`docs/REGISTRERING-ERHVERVSSTYRELSEN.md`](docs/REGISTRERING-ERHVERVSSTYRELSEN.md).

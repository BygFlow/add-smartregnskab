# ADD SmartRegnskab

Selvstændig dansk regnskabsplatform med bogføring, fakturering, bankafstemning, moms, rapportering, kontrolcenter og AI-styring.

## Adskillelse

- Eget Git-repository og eget versionsforløb.
- Egen Render-service: `add-smartregnskab`.
- Egen persistent disk: `smartregnskab-data`.
- Egen SQLite-database og filstorage via miljøvariabler.
- Ingen forbindelse til eller ændring af ADD SmartDrift Cleans produktionsdatabase.
- Frontenden starter direkte i ADD SmartRegnskab og bygger ikke SmartDrift-navigationen.

## Lokal kontrol

Kræver Node.js 20.19 eller nyere.

```bash
npm ci
npm test
```

Testen kører typekontrol, produktionsbuild og smoke-test på en midlertidig database.

## Produktion

1. Opret et separat repository til dette projekt.
2. Opret en separat Render-service fra `render.yaml`.
3. Udfyld alle hemmeligheder ud fra `.env.example`.
4. Brug aldrig samme `DATABASE_PATH`, disk eller krypteringsnøgle som SmartDrift Clean.
5. Kontrollér `/readyz` efter hver udgivelse.

AI-funktionerne er beslutningsstøtte. Betalinger, indberetninger, periodelukning, årsrapport, revisorerklæringer, adgangsændringer og juridiske regelændringer kræver menneskelig godkendelse.

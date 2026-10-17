# Object Lock- og gendannelsesbevis — 17. oktober 2026

Produkt: ADD SmartRegnskab 3.16.2  
Miljø: Produktion  
Udbyder: ADD SmartDrift ApS, CVR 46761898

Dette dokument beskriver en kontrolleret, syntetisk arkivprøve. Prøven
indeholder ingen kunde- eller bogføringsdata og er ikke i sig selv bevis for,
at alle virkelige regnskabsdata er fuldstændigt dækket af årsarkivet.

## Produktionskørsel

- Render-tjeneste: `srv-dafrq3740ujc73cm2i8g`
- Render-job: `job-db9rk3jbc2fs73cvvlq0`
- Start: 17. oktober 2026 kl. 20.10 dansk tid
- Afslutning: 17. oktober 2026 kl. 20.11 dansk tid
- Resultat: `succeeded`
- Kommando: `env ARCHIVE_LIVE_DRILL=YES node /app/dist/archive-drill.cjs`

Kørslen kontrollerede bucketens Object Lock-konfiguration, skrev et lille
syntetisk objekt med `COMPLIANCE`-retention, læste den konkrete objektversion
tilbage, dekrypterede den og sammenlignede de gendannede bytes med kilden.

## Kvittering

- Verificeret: `true`
- Bucket: `add-smartdrift-bookkeeping-archive-16071063`
- Objekt: `companies/0/fiscal-years/2026-01-01/drills/cfb0bd7a-be9c-4743-8d29-edfe9dd1cff7.json`
- Objektversion: `fw1tfdNRBx4o7jP7VwUJaOOJMcUW8m1`
- SHA-256: `b5f4725fba6487fb6e1e61c55bed5211e0df645304a411a6bf68830dec6dae57`
- Retention til: `2031-12-31T23:59:59.999Z`

## Konklusion og afgrænsning

Prøven dokumenterer, at det faktiske produktionsmiljø kan oprette en
versionsbestemt, krypteret og permanent Compliance-låst ekstern kopi og læse
den identisk tilbage. Den dokumenterer dermed den tekniske Object Lock- og
gendannelsesmekanisme frem til udgangen af det relevante femårsinterval.

Før den samlede femårsarkivkontrol kan markeres fuldstændig, mangler fortsat en
kontrolleret årsarkivering og isoleret gendannelse af en rigtig virksomheds
repræsentative bogføringsdata og originalbilag. Den kørsel kræver fastlagt
regnskabsårsstart, arkivansvarlig og godkendelse fra den berørte virksomhed.

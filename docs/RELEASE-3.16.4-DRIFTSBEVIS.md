# Release 3.16.4 — kontosletning og App Review

## Formål

Release 3.16.4 tilføjer et tydeligt, selvbetjent startpunkt for permanent kontosletning i **Abonnement og betaling > Konto og data**. Ændringen understøtter App Stores krav til apps, der tilbyder kontooprettelse, uden at tilsidesætte dansk bogføringslovs krav om fortsat opbevaring af regnskabsmateriale.

## Brugerflow

- Kun virksomhedens administrator kan starte kontosletning.
- Dialogen forklarer forskellen mellem abonnementsopsigelse, lukning af brugeradgang og lovpligtig opbevaring.
- Brugeren skal skrive `SLET KONTO` før knappen aktiveres.
- Automatisk abonnementsfornyelse stoppes ved registreringen.
- Der oprettes en GDPR-sletteanmodning og en prioriteret supportsag med revisionsspor.
- En gentaget anmodning er idempotent og opretter ikke dubletter.
- Data uden fortsat lovligt behov slettes eller anonymiseres efter identitetskontrol.
- Lovpligtigt regnskabsmateriale begrænses til nødvendig opbevaring og slettes eller anonymiseres efter fristens udløb.

## App Store-opfølgning

App Review-besvarelsen og den præcise optagelsesplan findes i:

- `release-artifacts/2026-11-01/APPLE-APP-REVIEW-RESPONSE.md`
- `release-artifacts/2026-11-01/APPLE-PHYSICAL-IPHONE-RECORDING.md`

Den endelige optagelse skal komme fra en fysisk iPhone med den iOS-version, Apple kræver. Den må ikke erstattes af simulator, browseroptagelse eller mock-up.

## Verifikation

- Produktionsbuild af klient og server gennemføres med `npm run build`.
- Versionsnumre: web/server `3.16.4`, Android `3.16.4 (30)`, iOS `3.16.4 (31604)`.
- Før App Store-resubmission skal den nye iOS-build testes via TestFlight på en fysisk iPhone, og optagelsen skal vedhæftes App Review-noterne.

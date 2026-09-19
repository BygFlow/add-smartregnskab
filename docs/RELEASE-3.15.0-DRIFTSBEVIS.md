# Driftsbevis — ADD SmartRegnskab 3.15.0

Dato: 19. september 2026  
Leverandør: ADD SmartDrift ApS, CVR 46761898  
Produkt: ADD SmartRegnskab  
Release-commit: `577e20d9c31f5c66e3ba7e36bb7d195aed04bfd8`

## Teknisk verifikation

- TypeScript-typekontrol: bestået.
- Produktionsbuild, klient og server: bestået.
- Automatiske tests: 8 af 8 bestået.
- Sikkerhedsselvkontrol: 173 filer kontrolleret, ingen fund.
- NPM-produktionsafhængigheder: 0 kendte sårbarheder på moderat niveau eller højere.
- Lokal restore-øvelse: bestået med SQLite `quick_check=ok` og 173 tabeller.
- Android debug-build: bestået for version 3.15.0, versionCode 22.
- CSP-hash for strukturerede data: verificeret mod den producerede HTML.

## Produktionsverifikation

Render-deploy `dep-dan7mjh42hec73dhctp0` blev gennemført og markeret `Live`.

Den offentlige health-kontrol returnerede:

- status: `ok`
- version: `3.15.0`

Den offentlige readiness-kontrol returnerede:

- database: `ok`
- fillager: `ok`
- scheduler: `running`
- ekstern backup: `configured`
- QuickPay: `configured`
- AiiA: `configured`
- e-mail: `configured`

Service workeren blev kontrolleret til cacheversion `smartregnskab-v3.15.0`.

## Kontroller i denne release

- S3-kompatibel fillagring respekterer leverandørens endpoint og path-style-indstilling.
- HTML-navigationer og API-kald leveres ikke fra en gammel PWA-cache.
- Virksomheder ser kun backupstatus; platformadministratoren får ikke adgang til kundernes regnskabsindhold.
- Push-token skrives ikke til klientloggen.
- Browserzoom er tilladt.
- Eksterne fontkald er fjernet, og strukturerede data er tilladt med en afgrænset CSP-hash.

## Eksterne punkter før registreret fuld drift

Dette dokument beviser den tekniske release, men erstatter ikke følgende eksterne beviser:

1. Registrering og offentlig optagelse hos Erhvervsstyrelsen.
2. Skriftlig bekræftelse af AiiA-produktionsmiljø og godkendte scopes.
3. NemHandel/Peppol access-point-aftale, produktionsnøgler, validator og webhook-hemmelighed.
4. Dokumenteret rigtig QuickPay-køb, fornyelse, fejlet betaling, refundering og webhook-genafspilning.
5. Dokumenteret restore fra det eksterne Hetzner-lager i et isoleret miljø.
6. Juridisk godkendelse af vilkår, privatliv, databehandleraftaler og underdatabehandlere.
7. Uafhængig penetrationstest og faglig accepttest hos bogholder eller revisor.
8. Apple-signering, App Store-gennemgang og iOS-test, hvis iOS skal udgives.

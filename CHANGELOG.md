# Ændringslog

## 3.11.5 — 2026-09-17

- Tilpasset den krypterede S3-backup til Hetzner Object Storage uden ikke-understøttede streaming-checksum-trailere.
- Sender kendt indholdslængde for database og bilag, så uploaden kan verificeres stabilt hos S3-kompatible EU-udbydere.

## 3.11.4 — 2026-09-17

- Gjort Systemdrift operationel med statusopdatering, jobhistorik og kontrolleret manuel kørsel.
- Tilføjet sikkert platformsoverblik over fagbrugere, 2FA og antal klientadgange uden adgang til klienternes regnskaber.
- Gjort supportsager handlingsklare med AI-udkast, redigering, kladde og faktisk e-mailafsendelse.
- Tilføjet overblik over databehandleraftaler og platformens eget revisionsspor på adgangssiden.

## 3.11.3 — 2026-09-17

- Gjort platformens virksomhedsside operationel med oprettelse af kunde, lederkonto og prøveabonnement.
- Tilføjet sikker styring af kundestatus og oprettelse af ADD SmartRegnskabs abonnementsfakturaer uden adgang til kundens bogføring.
- Gjort pakkeløsninger redigerbare og rettet visningen af pakkegrænser.
- Tilføjet afsendelse, rykker, PDF og manuel betalingsmarkering for abonnementsfakturaer.
- Backup-siden skelner nu tydeligt mellem vedvarende lager og en verificeret ekstern backup og viser ikke falsk backupstatus.

## 3.11.2 — 2026-09-17

- Bevarer login sikkert efter sideopdatering med en HttpOnly-sessioncookie.
- Genindsætter sikre platformmenuer til pakker, QuickPay, abonnementsfakturaer, backup, drift, fagbrugere og support.
- Holder fortsat kundernes bilag, posteringer, bankdata og rapporter afskærmet fra platformadministratoren.

## 3.11.1 — 2026-09-17

- Adskilte platformadministration fra kundernes bogføringsdata med en fail-closed API-vagt.
- Fjernede platformadministratorens adgang til bilag, posteringer, bankdata og økonomiske rapporter.
- Begrænsede virksomhedsoversigten til abonnement, status og tekniske nøgletal.
- Tilføjede synlig adgangs- og databeskyttelsespolitik i platformen.
- Tilføjede produktionstest, der bekræfter, at platformrollen afvises ved forsøg på adgang til kunderegnskaber.

## 3.11.0 — 2026-09-17

- Ny rolleopdelt navigation for platformadministration og virksomhedsregnskab.
- Nyt platformoverblik med virksomheder, systemstatus og hurtige handlinger.
- Virksomhedsvalg er flyttet til en tydelig kontekstlinje og en separat oversigtsside.
- Den dobbelte, overfyldte modulrække er fjernet; specialfunktioner er samlet under "Flere funktioner".
- Forbedret responsivt layout og mobilmenu til små skærme.

## 3.10.2 — 2026-09-16

- Reparerer automatisk ældre produktionsdatabaser med manglende additive migrationer før opstart.
- Retter loginfejlen `sessions.active_company_id` uden at slette eller omskrive eksisterende kundedata.
- Tilføjer regressionstest af ejer-login mod den oprindelige legacy-databasestruktur.
- Android version 3.10.2 (versionCode 16).

## 3.10.1 — 2026-09-16

- Ejer-administratoren kan nu oprettes sikkert i en allerede eksisterende platformvirksomhed via Render-miljøvariabler.
- Bootstrap-flowet genbruger platformens virksomhedspost og undgår dermed dubletter i produktionsdatabasen.
- Demo-login er fortsat deaktiveret i produktion; kun en særskilt, stærk administratoradgang kan oprettes.
- Android version 3.10.1 (versionCode 15).

## 3.10.0 — 2026-09-16

- SmartRegnskabs produktidentitet er tilpasset den godkendte designpakke med underteksten “TIL DIN VIRKSOMHED”.
- “Mere tid til det, der skaber værdi” er nu det entydige produktslogan på tværs af login og metadata.
- Appikonet kombinerer ADD-familiens dybe grønne udtryk med dokument, beregning, økonomigraf og vækstpil.
- Browser-, PWA- og Android-adaptive ikoner følger den samme regnskabsidentitet, og demo-login peger nu på de faktiske demokonti.
- Login er fortsat lyst, responsivt og tydeligt afgrænset som sit eget produkt.
- Eksisterende priser, loginflow, regnskabsfunktioner, database, backend og integrationer er bevaret.
- Android version 3.10.0 (versionCode 14).

## 3.9.0 — 2026-09-15

- SmartRegnskab har fået et samlet produkt-brand med dyb grøn accent og det eksisterende ADD-symbol.
- Login er opdateret til en responsiv, lys/mørk splitvisning med produktsloganet “Overblik der skaber vækst.”
- Det fælles slogan “Mere tid til det, der skaber værdi.” og signaturen “En del af ADD SmartDrift ApS” er tilføjet de relevante produktflader.
- Appskal, offentlige adgangssider, supportpanel, browsermetadata og PWA-manifest følger nu samme identitet.
- Brandkravene er dækket af en automatisk regressionstest; login- og forretningslogik er uændret.
- Android version 3.9.0 (versionCode 13).

## 3.8.0 — 2026-09-14

- AiiA/Mastercard Open Banking OAuth 2.0-flow med engangs-state og udtrykkeligt banksamtykke.
- Krypteret opbevaring og automatisk fornyelse af AiiA-tokens.
- Automatisk import af bogførte DKK-bankposter hvert 15. minut med ekstern-id og dubletbeskyttelse.
- QuickPay API v10 som primær abonnementsbetaling med betalingslink, tilbagevendende opkrævning og refundering.
- QuickPay-callback valideres med HMAC-SHA256 over den rå request body og behandles idempotent.
- Driftsklarhed, miljøskabelon, Render-konfiguration og bankintegrationens brugerflade er opdateret.
- Android version 3.8.0 (versionCode 12).

## 3.7.0 — 2026-09-13

- Ny flerklientportal for bogholdere, revisorer og revisionsadministratorer.
- Ét login kan skifte sikkert mellem klientvirksomheder via servervaliderede medlemskaber.
- Obligatorisk tofaktorgodkendelse, udløb, suspension og tilbagekaldelse af fagadgang.
- Serverhåndhævede læse-, skrive-, slette-, godkendelses- og administratorrettigheder.
- Fire-øjne-godkendelser for bogføring, moms, betaling og årsafslutning.
- Beskyttelse mod selv-godkendelse og adgang på tværs af virksomheder.
- Sikker invitation af både nye og eksisterende fagbrugere.
- Android version 3.7.0 (versionCode 11).

## 3.6.0 — 2026-09-10

- Ny driftsklarheds- og onboardingkontrol med målbare trin.
- Ny live status for database, mail, backup, NemHandel, betalinger og sikkerhedsnøgler.
- Migreringsguiden udfører nu reel valideret import af kunder, leverandører og kontoplan fra e-conomic-, Dinero-, Billy-, Excel- og CSV-eksporter.
- Import bruger signeret preview-token, dubletkontrol og tenant-afgrænset rollback-manifest.
- AI-køen viser risiko, sikkerhed, begrundelse, dokumentation og model; høj risiko og lovpligtige handlinger kræver stadig menneskelig godkendelse.
- Nyt hjælpecenter, adapterstatus og planoversigt i produktet.
- Supportsager er hærdet med felt-allowlist og adgang til egne sager for kundeprofiler.
- Udvidet produktions-sm test dækker import/rollback, manipulation, onboarding, integrationer, AI-validering og isolation mellem virksomheder.
- Ny versionsstyret myndighedspakke med checksum-manifest, pilotplan, onboarding, support, pris-/pakke- og sikkerhedsdokumentation.
- Android version 3.6.0 (versionCode 10) er synkroniseret og build-verificeret.

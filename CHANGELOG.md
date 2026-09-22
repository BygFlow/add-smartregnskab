# Ændringslog

## 3.15.4 — 2026-09-22

- Rettet QuickPay-aktivering, så signeret callback kan finde en afventende aftale og håndtere numeriske QuickPay-ID'er.
- Tilføjet callback-header på QuickPay API-kald, sikker kortudskiftning og fælles betalingsaftale for hele kundeorganisationen.
- Tilføjet opsigelse ved periodens udløb med mulighed for at fortryde samt automatisk afslutning uden ny opkrævning.
- Lukket manuel oprettelse af betalingsreferencer i produktion og tilføjet målrettede QuickPay-regressionstests.
- Synkroniseret server-, PWA-, SAF-T- og Android-version til 3.15.4.

## 3.15.3 — 2026-09-21

- Rettet OIOUBL-endpoint-koder til `DK:CVR` og `GLN`, mens Peppol fortsat
  bruger ISO 6523-koderne `0184` og `0088`.
- Tilføjet Sproom `X-Request-Id`, så genforsøg er idempotente og ikke opretter
  dobbelte e-fakturaer.
- Tilføjet sikker håndtering af Sprooms `409`-svar med eksisterende dokument-ID.
- Tilføjet kontrakttests for formater, upload og dubletbeskyttelse.

## 3.15.2 — 2026-09-20

- Rettet Sproom company-map validering, så projektet typekontrollerer og bygger rent.
- Rettet SAF-T-eksporten, så den viser den aktuelle produktversion i stedet for et gammelt versionsnummer.
- Koblet API-dokumentationen direkte til den rigtige API-nøglestyring og fjernet misvisende sandbox-tekst.
- Synkroniseret serverstatus, systemopdateringslog, PWA-cache, pakkeversion og Android-version.
- Erstattet rengøringsspecifikke eksempeltekster med generelle regnskabseksempler.
- Tilføjet regressionstests for API-nøgleflow og SAF-T-version.

## 3.15.1 — 2026-09-19

- Tilføjet produktionsadapter til Sproom for NemHandel og Peppol.
- Tilføjet modtageropslag, binær XML-upload og krav om Sprooms dokument-ID før status “sendt”.
- Tilføjet isolerede child-company-tokens og eksplicit kobling mellem hver kundevirksomhed og Sproom.
- Tilføjet RSA-SHA256-verificeret Sproom-webhook til leveringsstatus og indgående dokumenter.
- Opdateret driftsvejledning og releasekontrol med Sproom-konfiguration.

## 3.15.0 — 2026-09-19

- Rettet S3-kompatibel fillagring, så Hetzner-endpoint og path-style-konfiguration respekteres.
- Opdateret PWA-cache til network-first for navigationer og versionshash'ede statiske filer.
- Erstattet simulerede kundebackuphandlinger med læsebeskyttet, verificerbar platformstatus.
- Opdateret Android-version, cacheversion, API-status og dokumentation til 3.15.0.
- Fjernet ubrugte SmartDrift-komponenter og rengøringsspecifikke hjælpetekster fra klienten.
- Fjernet eksterne fontkald, beskyttet strukturerede data med CSP-hash og genaktiveret browserzoom.
- Fjernet logning af push-token og indført automatisk genindlæsning af friske forespørgsler.

## 3.14.0 — 2026-09-19

- Komplet offentlig hjemmeside med produkt-, pris-, integrations-, sikkerheds-, FAQ-, kontakt-, demo- og juridiske sider.
- Seks SEO-landingssider til mindre virksomheder, fakturering, bilag, økonomioverblik, håndværkere og servicevirksomheder.
- Offentligt hjælpecenter med 14 danske artikler og søgning.
- Cookievalg, dynamiske metadata, structured data, sitemap, robots og social-card.
- Kontakt- og demoformular gemmer ratebegrænsede leads og sender intern notifikation, når mail er opsat.
- Onboarding udvidet til ti kontroller fra virksomhedsopsætning til første faktura og databehandleraftale.
- Ti danske hjælpevideomanuskripter, marketingvideo-shotlist og marketing-/launchpakke.

## 3.13.1 — 2026-09-17

- Retter opgraderingen af eksisterende standardpakker, så hver pakke får sine egne bilags-, posterings-, virksomheds- og integrationsgrænser.
- Bevarer administratorens selvoprettede og selvtilpassede pakker.

## 3.13.0 — 2026-09-17

- Tilføjer virksomhedens egen side til abonnement, pakkevalg, QuickPay og abonnementsfakturaer.
- Kræver administratorens udtrykkelige godkendelse før pakkeskift og viser priser ekskl. moms tydeligt.
- Viser sikker betalingsstatus uden at gemme eller udstille kortoplysninger i ADD SmartRegnskab.
- Erstatter bruger- og kundelofter med relevante grænser for bilag, posteringer, virksomheder og integrationer.
- Håndhæver bilags-, posterings- og integrationsgrænser server-side og forhindrer ugyldig nedgradering.

## 3.12.1 — 2026-09-17

- Fastlægger pakkepriserne til 199 / 349 / 549 / 749 kr. pr. måned ekskl. moms.
- Bevarer separate grænser for brugere og lønansatte samt ubegrænsede kunder og leverandører.

## 3.12.0 — 2026-09-17

- Indfører en tydelig og konkurrencedygtig prisliste: 0 / 199 / 399 / 699 kr. pr. måned ekskl. moms.
- Gør kunder og leverandører ubegrænsede i alle pakker og adskiller brugerlicenser fra lønansatte.
- Håndhæver bruger- og lønlofter ved oprettelse, invitation og nedgradering uden at blande dem sammen.
- Opgraderer urørte standardpakker automatisk, mens administratorens egne priser fortsat bevares.

## 3.11.9 — 2026-09-17

- Gør adskillelsen mellem ADD SmartRegnskab og ADD SmartDrift permanent ved opstart.
- Forhindrer den historiske SmartDrift-demodatabase i at blive indlæst i regnskabsproduktet, også i udviklingsmiljøer.
- Tilføjer regressionstest, som sikrer, at SmartRegnskabs navigation ikke får rengørings-, vagtplan- eller geofencefunktioner tilbage.

## 3.11.8 — 2026-09-17

- Migrerer de sidste historiske SmartDrift-standardpakker til det korrekte SmartRegnskab-katalog.
- Genkender både den gamle “Drift”-pakke og nyere “Virksomhed”-pakke uden at bryde eksisterende abonnementer.
- Opretter manglende standardpakker sikkert, hvis en ældre installation kun har en del af kataloget.

## 3.11.7 — 2026-09-17

- Udfylder pakkeløsningerne med konkrete regnskabsfunktioner for Start, Virksomhed, Professionel og Enterprise.
- Viser alle inkluderede funktioner, årsbesparelse og brugsgrænser direkte på pakkesiden.
- Tilføjer oprettelse af nye pakker og fuld redigering af funktioner, pris, grænser, rækkefølge og aktiv status.
- Opgraderer kun urørte standardpakker automatisk og bevarer administratorens egne pakketilpasninger.

## 3.11.6 — 2026-09-17

- Krypterer database, bilag og manifest lokalt med AES-256-GCM før upload til Hetzner Object Storage.
- Fjerner AWS SSE-S3-headeren, som Hetzner ikke understøtter, uden at opgive kryptering ved lagring.
- Verificerer dekryptering, SHA-256-kontrolsummer og SQLite-integritet ved hver backupkørsel.

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

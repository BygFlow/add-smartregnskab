# Komplet gennemgang af ADD SmartRegnskab

Dato: 14. oktober 2026
Kontrolleret version: 3.16.1

## Samlet vurdering

Den tekniske kerne er stabil og kan bruges til fortsat pilot- og godkendelsesarbejde. Systemet er dog ikke klar til at blive markedsført som fuldt produktionsklart eller som registreret digitalt standardbogføringssystem endnu. Kildekoden håndhæver nu udløbne prøveperioder; før fuld lancering mangler især produktionsudrulning af rettelsen, det særskilte femårsarkiv, NemHandel/Peppol og de resterende eksterne godkendelser.

Der er ikke ændret produktionsdata. Efter gennemgangen er Sproom-masterfundamentet
udbygget i programkoden som beskrevet nedenfor. Koden er klar til kontrolleret
udrulning, mens selve Sproom-afsendelsen fortsat er låst bag de to produktionsflag.

## Det, der er bestået

- TypeScript-kontrol og produktionsbuild består.
- 121 automatiske tests består: 54 JavaScript-tests og 67 TypeScript-tests.
- Sikkerhedsscanningen kontrollerede 205 filer uden fund.
- `npm audit --omit=dev --audit-level=high` fandt 0 kendte sårbarheder.
- Alle 46 hovedruter i virksomhedsprogrammet blev åbnet lokalt og i produktion uden 404-sider eller browserfejl.
- Den særskilte mobilside til bilag åbner og indeholder virksomhedsvalg, kamera, filvalg og menneskelig godkendelse før bogføring.
- Produktionsmiljøet svarer `ready`, og version 3.16.1 kører.
- Almindelig ekstern backup er konfigureret, krypteret og verificeret. Seneste observerede kørsel var fuldført 14. oktober 2026.
- Simply-mail, ekstern S3-backup, AiiA-konfiguration, QuickPay-konfiguration og OpenAI-konfiguration fremgår som aktive i produktionsstatus.
- Rolle- og virksomhedsadskillelse, dokumentmodtagelse, QuickPay, Sproom-adapter, Object Lock-arkivkode, mobilbilag og store arkiver dækkes af automatiske tests.

## Kritiske fund før fuld lancering

### 1. Udløbet prøveabonnement — rettet i kildekoden, mangler produktionsudrulning

Produktionskontoen “ADD SmartRegnskab – Clearhaus test” står stadig som `proeve`, selv om både prøveperioden og perioden udløb 9. oktober 2026. Den 14. oktober er programmet og beskyttede API-ruter stadig tilgængelige.

Årsagen er, at adgangskontrollen kun spærrer statusserne `i_restance`, `spaerret` og `opsagt`. Den kontrollerer ikke, om `trialEndsAt` er passeret. Fornyelsesjobbet forsøger at oprette/opkræve en faktura, men sætter ikke automatisk et udløbet prøveabonnement uden betalingsmiddel i en begrænset tilstand.

Rettelsen er nu implementeret fail-closed: slutdatoen er inkluderet, dagen efter får kunden kun adgang til abonnement, betaling, egne kontooplysninger og support. Regnskabsdata bevares, mens øvrige API-ruter svarer 402. Prøveperioden faktureres ikke bagud, fakturaoprettelse aktiverer ikke længere abonnementet, og genåbning sker først ved en gennemført betaling. Den samme adgangstilstand gælder hele kundeorganisationen via abonnementsejeren.

Der er også tilføjet et bagudrettet værn: ældre prøvekonti, som den tidligere kode kan have markeret `aktiv` uden en eneste betalt abonnementsfaktura, begrænses fortsat. Ni målrettede regressionstests dækker datoen, betalingsadgangen, API-spærringen, gamle fejlstatusser og fornyelsesjobbet. Ændringen er testet lokalt, men er endnu ikke sat i produktion; produktionskontoen skal genkontrolleres efter en kontrolleret udrulning.

### 2. Femårigt bogføringsarkiv er ikke dokumenteret som aktivt i produktion

Den almindelige daglige backup er sund, men den er ikke det samme som det særskilte lovpligtige bogføringsarkiv. Ugejobbet for bogføringsarkiv er konstrueret til at forblive lukket, indtil fuld datadækning og en produktionsdrill er godkendt. Releasebeviset siger også udtrykkeligt, at Object Lock, rigtig produktionsbucket og gendannelse med rigtige data endnu ikke er bevist.

Før dette kan kaldes færdigt, skal der foreligge dokumentation for:

- rigtig produktionsbucket med Object Lock/retention;
- kontrolleret arkivering af rigtige virksomhedsdata;
- kvittering og checksum;
- isoleret gendannelsestest;
- korrekt regnskabsårsstart og arkivansvarlig for hver virksomhed;
- godkendt driftsbevis uden hemmelige nøgler i dokumentationen.

### 3. NemHandel/Peppol er ikke tilsluttet i produktion

Produktionsstatus viser `NemHandel/Peppol configured: false`. Brugerfladen oplyser også, at afsendelse er låst, indtil en rigtig leverandør er tilsluttet. Sproom-adapteren, masterregisteret og onboarding-flowet er kodet og testet, men API-adgang, validator og inbound-webhook er ikke dokumenteret som aktive.

Elektronisk fakturering må derfor ikke præsenteres som live endnu.

### 4. Myndigheds- og leverandørgodkendelser er separate porte

Koden og registreringspakken er forberedt, men repositoryets egen checklist siger, at systemet ikke må markeres som registreret, før myndigheden har bekræftet det. Mastercard Open Banking har 14. oktober 2026 meddelt, at appen `add_smartregnskab-e4b7816b-39b6-4fee-92d7-7968518edd37` har fået produktionsadgang. SmartRegnskab viser AiiA som konfigureret, men ingen rigtig bankkonto er endnu tilsluttet; et kontrolleret samtykke-, callback-, webhook- og synkroniseringsforløb mangler derfor stadig som driftsbevis. Clearhaus, Sproom og myndighedsregistrering er fortsat separate eksterne porte.

### 4a. Sproom-kontrakten er bekræftet som master-API/ISV-aftalen

Den tre sider lange aftale dateret 9. oktober 2026 er mellem ADD SmartDrift ApS, CVR 46761898, og Sproom A/S. Bilag 1 fastsætter:

- 399 kr. pr. måned ekskl. moms;
- op til 500 sendte og modtagne fakturatransaktioner pr. måned;
- 0,80 kr. ekskl. moms pr. ekstra transaktion;
- ingen etableringsydelse;
- 30 dages betalingsfrist;
- ikrafttræden 1. november 2026;
- planskift med varsel på løbende måned plus to måneder.

Sproom har efterfølgende bekræftet direkte over for Aurel Dan, at aftalen er master-API/ISV-aftalen, og at ADD SmartDrift ApS skal oprettes med én parent/master-adgang. Den tidligere mailkorrespondance beskriver child-company-oprettelse, integrationsservice samt NemHandel/Peppol-afsendelse og -modtagelse under denne aftale. Det åbne punkt er derfor ikke aftaletypen, men modtagelse af den lovede tekniske opsætningsvejledning og de nødvendige produktionsoplysninger til API'et og webhooks. PDF'en har ingen synlige underskriftsbeviser, formularfelter eller vedlagt Addo-certifikat; det separate Addo-bevis bør derfor gemmes sammen med kontrakten, når det er tilgængeligt.

Koden følger nu denne model: ADD SmartDrift ApS, CVR 46761898, er den eneste
parent/master. Hver juridisk kundevirksomhed registreres centralt med sit CVR
som unik nøgle og kan kun få ét Sproom child-company-ID. SmartRegnskab, Pro og
Clean registreres som produktkilder på samme profil. Kundeonboarding kræver
udtrykkelig godkendelse, mens kobling af Sprooms eksterne ID er forbeholdt en
platformadministrator. Den tidligere miljøbaserede virksomhedsmapning bevares
kun som overgangsfallback. Afsendelse forbliver låst, indtil master-CVR,
mastertoken, child-ID, webhook og validering er korrekt konfigureret.

## Rettede produkt- og tekstfejl

### 5. Misvisende løfte om AI-autobogføring — rettet

Backend afviser `autoPost` og kræver menneskelig godkendelse af alle
leverandørbilag. Hjemmesiden, FAQ'en og AI-systemteksten siger nu ensartet:
AI udtrækker og foreslår, men en bruger godkender altid før bogføring.

### 6. Uklar visning af inaktiv AI — rettet

På Drift uden AI-tilkøb vises nu “AI er ikke aktivt” og mulighed for tilkøb.
Interne leverandøromkostninger skjules, når der ikke findes en aktiv AI-kvote.

### 7. Rå intern backupstatus — rettet

Backup-siden oversætter nu statusværdien `fuldfort` til “Fuldført”.

### 8. Produktions-testvirksomheden er ikke onboarding-klar

Clearhaus-testvirksomheden står 0/10 i onboarding. Der mangler virksomhedsdata, regnskabsår, kontoplan, bank/integration, fakturaopsætning, moms, første bilag, kunde, faktura og accept af databehandleraftale. Det er acceptabelt for en tom testkonto, men den er ikke egnet som færdig demonstration til Clearhaus før punkterne er udfyldt med sikre testdata.

## Mindre vedligeholdelsesfund

- Den gamle udkommenterede juridiske tekstblok i `marketing.tsx` er fjernet.
- Skemakommentarerne beskriver nu menneskelig godkendelse frem for automatisk bogføring.
- Flere avancerede moduler er tydeligt mærket beta og kræver revisor- eller juridisk godkendelse. De bør ikke præsenteres som færdige standardfunktioner.
- Lokal `release-readiness` rapporterer manglende produktionshemmeligheder, fordi de ikke ligger i den lokale shell. Det er korrekt sikkerhedsadfærd og må ikke forveksles med produktionsstatus.

## Anbefalet rækkefølge

1. Udrul den testede adgangsrettelse, og bekræft med en udløbet prøvevirksomhed, at kun abonnement/betaling er tilgængeligt.
2. Gennemfør og dokumentér femårsarkivets rigtige produktionsdrill.
3. Færdiggør Sproom ISV/masterintegration og test send/modtag med kvitteringer.
4. Verificér AiiA med én rigtig, kontrolleret banktilslutning; afslut Clearhaus-godkendelsen og gem beviser uden hemmeligheder.
5. Gennemfør myndighedens registreringsforløb; markér først derefter systemet som registreret.
6. Klargør en komplet, ikke-produktiv demovirksomhed til ekstern gennemgang.

## Konklusion

Programmet er teknisk betydeligt længere end en prototype: build, tests, sikkerhedscheck, sider og almindelig backup fungerer. Det er stadig en kontrolleret pilot, ikke en helt færdig offentlig lancering. Abonnementsstoppet er nu rettet og testet i kildekoden; de største resterende mangler er den kontrollerede produktionsudrulning, bevist femårsarkiv og færdige eksterne aftaler.

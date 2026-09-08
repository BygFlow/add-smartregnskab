# ADD SmartDrift Clean — Specifikation

**Styring af rengøringsvirksomheder som betalt abonnementstjeneste** — en flerlejer-webapplikation, hvor rengøringsvirksomheder styrer opgaver, tid, ansatte, vagtplan, fravær, tilbud, materialer, kvalitet og fakturering. ADD SmartDrift Clean-teamet har en særskilt platformskonsol til administration af virksomheder, pakker, abonnementer, betalinger og drift.

Version 4 · opdateret 14. august 2026

---

## 1. Formål og forretningsmodel

ADD SmartDrift Clean sælges som abonnement til rengøringsvirksomheder. Hver virksomhed er en isoleret lejer med egne brugere, ansatte, kunder og driftsdata. ADD SmartDrift Clean ApS driver platformen, administrerer pakker og abonnementer, udsteder abonnementsfakturaer og kan spærre en virksomhed ved manglende betaling.

### To lag

| Lag | Brugere | Formål |
|-----|---------|--------|
| **Virksomhedslaget** | Leder, holdleder, assistent, kunde | Daglig drift i én rengøringsvirksomhed |
| **Platformslaget** | ADD SmartDrift Clean-teamet (`platform_admin`) | Administration af virksomheder, pakker, abonnementer, betalinger, job og filer |

Alle driftstabeller er afgrænset med `companyId`. Rolle- og lejerafgrænsning håndhæves på serveren; grænsefladens skjul af funktioner er kun et supplement.

---

## 2. Roller og adgang

| Rolle | Adgang |
|-------|--------|
| `platform_admin` | Hele platformskonsollen, driftsjob og filflytning; kan skifte ind i enhver virksomhed ved support |
| `leder` | Fuld adgang i egen virksomhed, herunder abonnement, betaling, GDPR, fakturering, integrationer og revisionsspor |
| `holdleder` | Opgaver, tid, ansatte, vagtplan, fravær, tilbud og kvalitetskontrol; ikke abonnement, betaling eller GDPR-administration |
| `assistent` | Egne opgaver, egen tidsregistrering, egne fraværsansøgninger og egne samtykker |
| `kunde` | Kundeportal med egne opgaver, status, kvalitetskontrol og fakturaer |

Adgang kontrolleres i tre lag: rolle (`requireRole`), lejer (`tenantId`/`companyId`) og pakke (`requireFeature`). Alle tre kontroller udføres serverside.

---

## 3. Abonnementspakker

| | **Start** | **Vækst** | **Fuld** |
|---|---|---|---|
| Grundpris/md. | 299 kr. | 599 kr. | 1.299 kr. |
| Pr. ansat/md. | 39 kr. | 29 kr. | 19 kr. |
| Maks. ansatte | 5 | 25 | Ubegrænset |
| Maks. kunder | 15 | 100 | Ubegrænset |
| Opgaver, tid, kunder og fakturering med moms | ✓ | ✓ | ✓ |
| Vagtplan, fravær og fotodokumentation | — | ✓ | ✓ |
| Løn- og regnskabseksport samt GPS-kontrol | — | ✓ | ✓ |
| Direkte API-integration og revisionsspor | — | — | ✓ |
| Tilbud, aftaler, materialer, nøgler og kvalitet | Efter funktionsflag | Efter funktionsflag | Efter funktionsflag |

Alle priser er ekskl. 25 % moms. Årlig betaling faktureres som 10 måneder, svarende til to måneders rabat. Virksomhedsstatus er `proeve`, `aktiv`, `i_restance`, `spaerret` eller `opsagt`.

En ny virksomhed får 14 dages gratis prøveperiode uden betalingskort. En spærret virksomhed kan ikke logge ind. Når en abonnementsfaktura registreres betalt, løftes restance og spærring automatisk.

---

## 4. Funktioner — virksomhedslaget

### Dashboard
Dagens opgaver, aktive tidsmålere, ugens timer, ledige ansatte, ubetalte fakturaer, ventende fraværsansøgninger og relevante advarsler.

### Opgaver
CRUD med kunde, ansat, dato, tidsrum, status (`planlagt`/`igang`/`færdig`/`aflyst`), prioritet, beskrivelse og redigerbar tjekliste. Gentagelse kan være `ingen`, `daglig`, `ugentlig` eller `maanedlig`; fremtidige forekomster oprettes automatisk, og der er et sikkerhedsloft mod ubegrænset oprettelse.

### Tidsregistrering med GPS
Start og stop pr. ansat og opgave. Ved check-in og check-ud kan browserens koordinater sendes med. Serveren beregner afstand til kundens koordinater med Haversine-formlen og kundens valgte geofence-radius. Status er `indenfor`, `udenfor`, `ingen_gps` eller `ukendt`. GPS blokerer ikke en registrering, men dokumenterer resultatet.

### Vagtplan
Ugevisning mandag–søndag med ISO-ugenummer og planlagte timer. Vagter oprettes pr. ansat, kunde, dato og tidsrum med status `planlagt`, `bekraeftet` eller `afbud`. Publicering markerer vagterne som udsendt og lægger en SMS i beskedkøen. Oprettes en vagt oven i godkendt fravær, bevares vagten, men serveren returnerer en advarsel.

### Fravær og ferie
Ansatte kan anmode om ferie, sygdom, barns sygedag, barsel, omsorgsdag eller andet fravær. Leder eller holdleder godkender eller afviser (`afventer`/`godkendt`/`afvist`). Godkendt fravær indgår i saldoer, løngrundlag og vurderingen af tilgængelighed.

### Fakturering og moms
Kundefakturaer oprettes med linjer og kan bygges på timer, løse beløb eller aftalegrundlag. Systemet beregner nettobeløb, moms og bruttobeløb samt rapporterer salgsmoms. Status er `kladde`, `sendt`, `betalt`, `forfalden` eller `krediteret`.

- **PDF:** Genereres på serveren med dansk layout, CVR-oplysninger, betalingsbetingelser og relevante momstekster.
- **Udsendelse:** Markerer fakturaen som sendt og lægger mailen i beskedkøen.
- **Kundefaktura-rykkere:** Kan først udsendes efter forfald. Den automatiske kørsel sender første rykker efter tre dage, derefter tidligst hver tiende dag og højst tre gange.

### Moms
Momsopsætningen ligger på virksomheden og bruges på både tilbud og fakturaer.

| Tilstand | Sats | Påtegning/virkning |
|----------|-----:|--------------------|
| `dansk` | 25 % som standard | Almindelig dansk moms |
| `eu_omvendt` | 0 % | Omvendt betalingspligt; køber afregner moms |
| `eksport_fritaget` | 0 % | Momssalg til land uden for EU |
| `momsfri` | 0 % | Virksomheden er ikke momsregistreret |

### Fotodokumentation og bilag
Fotos og PDF-bilag kan knyttes til opgaver og kvalitetskontroller med typer som før, efter, kvalitet og afvigelse. Funktionen er pakkeafhængig. Filer accepteres kun som billeder eller PDF og højst 10 MB.

### Tilbud og aftaler
Tilbud har nummerformatet `T-ÅÅÅÅ-NNNN`, linjer, PDF og status `kladde`, `sendt`, `accepteret`, `afvist` eller `udloebet`. Et accepteret tilbud opretter automatisk en aftale med nummerformatet `K-ÅÅÅÅ-NNNN`.

| Aftalefelt | Muligheder |
|------------|------------|
| Prismodel | `timepris`, `fast_maaned`, `pr_besoeg`, `pr_m2` |
| Frekvens | `daglig`, `ugentlig`, `hver_14_dag`, `maanedlig` |
| Øvrige vilkår | Start/slut, opsigelsesvarsel, aftalt sats, inkluderede timer, overtidssats og vilkårstekst |

Aftalegrundlaget kan beregne periodens pris. Ved fast månedspris kan timer over det inkluderede antal afregnes særskilt.

### Materialer og lager
Varekartoteket indeholder varenavn, varenummer, enhed, kostpris, salgspris, beholdning, minimumsbeholdning og leverandør. Farlige stoffer markeres særskilt og kan have link til sikkerhedsdatablad.

Forbrug, indkøb og korrektioner bogføres mod vare, opgave, kunde og eventuelt ansat. Forbrug kan markeres som viderefakturerbart til kunden. Systemet afviser forbrug, når beholdningen ikke rækker, og opretter advarsel/notifikation, når beholdningen er under minimumsbeholdningen.

### Nøgler og alarmkoder
Nøgler knyttes til kundeadresser med type `noegle`, `brik`, `kode` eller `alarmkode` og status `paa_lager`, `udlaant`, `bortkommet` eller `returneret`. Udlån, retur og bortkomst gemmes i overdragelseshistorikken med afsender, modtager, dato og kvittering.

Alarm- og adgangskoder gemmes krypteret med AES-256-GCM via `ENCRYPTION_KEY`. Kun autoriserede brugere kan hente den dekrypterede kode.

### Kvalitetskontrol
Kvalitetskontrol gemmer en vægtet score fra 0 til 100, resultat, opfølgningsdato, noter, bilag og om kontrollen må deles med kunden.

| Område | Vægt |
|--------|----:|
| Gulve og trapper | 25 % |
| Toiletter og sanitet | 25 % |
| Inventar og flader | 20 % |
| Køkken og kantine | 15 % |
| Affald og forbrugsvarer | 10 % |
| Generelt indtryk | 5 % |

Hvert område bedømmes 0–5 og omregnes til vægtet totalscore. Resultat er **godkendt** ved mindst 90, **anmærkning** ved mindst 75 og ellers **ikke godkendt**.

### Rapporter og eksport
Timerapporter pr. ansat, kunde og periode, lønrapport, regnskabsrapport samt momsrapport. Eksport findes i otte formater: Danløn, Dataløn, Zenegy, Lessor, e-conomic, Dinero, Billy og generisk CSV.

### Integrationer
Direkte API-forbindelse findes til **e-conomic** for fakturaudtræk og **Danløn** for lønpost-overførsel. Der er testforbindelse, synkroniseringslog og fejlvisning. De øvrige viste systemer anvendes via eksportfiler. Mail- og SMS-udbydere konfigureres i driften; uden udbydernøgler får beskeder status `simuleret`.

### Notifikationer og kundeportal
Systemgenererede beskeder om blandt andet fakturaer, fravær, vagtplaner, pakkegrænser, betaling og lager har typerne `info`, `warning` og `success` samt læst-markering. Kundeportalen er afgrænset til kundens egne opgaver, fakturaer og tilgængelige kvalitetskontroller.

### Revisionsspor
Væsentlige handlinger såsom login, oprettelser, statusændringer, betaling, spærring og GDPR-behandling logges med bruger, tidspunkt, handling og målobjekt. Revisionssporet er tilgængeligt for leder og platform efter pakkeadgang.

### Abonnement, betaling og historik
Abonnementssiden viser pakke, forbrug mod pakkegrænser, næste opkrævning, prøveperiode/restance, pakkeskift og abonnementsfakturaer. Betalingssiden viser betalingsmidler, standardbetalingsmiddel, automatisk fornyelse, åbne abonnementsfakturaer, rykkerstatus og betalingshistorik.

---

## 5. Betalingsmodul

Betalingsmodulet anvendes til ADD SmartDrift Cleans opkrævning af abonnementer fra virksomhederne. Det understøtter tre udbydere.

| Udbyder | Betalingsmiddel | Krævede miljøvariabler | Bemærkning |
|---------|----------------|-------------------------|------------|
| Stripe | Kort | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Opsætning, opkrævning og refundering via Stripe |
| MobilePay | MobilePay Subscriptions | `MOBILEPAY_CLIENT_ID`, `MOBILEPAY_CLIENT_SECRET`, `MOBILEPAY_WEBHOOK_SECRET` | OAuth-baseret forbindelse og betalingsopkrævning |
| Betalingsservice | Nets-/bankfilflow | `BETALINGSSERVICE_PBS_NUMBER` | Opretter betalingsoplysning til filflow; bankfilens retur bekræfter resultatet |

Mangler en udbyders krævede nøgler, kører den pågældende udbyder i `simuleret` tilstand. Der oprettes stadig sporbare betalingsposter, men der gennemføres ingen ekstern betaling. Status `simuleret` må derfor ikke betragtes som et reelt indbetalt beløb.

### Betalingsmidler og automatisk fornyelse
Et betalingsmiddel består af udbyderreference og relevante visningsoplysninger, eksempelvis kortmærke, sidste fire cifre og udløb. Virksomheden kan have flere betalingsmidler og vælge ét som standard. Kortoplysninger, herunder fuldt kortnummer og sikkerhedskode, gemmes aldrig i ADD SmartDrift Clean.

`autoRenew` styrer, om abonnementet fornyes ved periodeudløb med virksomhedens aktive standardbetalingsmiddel. Betalingshistorikken viser beløb, udbyder, status, tidspunkt, forsøg og eventuel fejlbesked.

### Rykkerforløb ved abonnement
Forfaldne abonnementsfakturaer følger et rykkerforløb. Systemet kan forsøge opkrævning igen med standardbetalingsmidlet, når et rykkertrin aktiveres.

| Trin | Tidspunkt efter forfald | Virkning |
|------|-------------------------|----------|
| 1 | 3 dage | Venlig betalingspåmindelse |
| 2 | 7 dage | Virksomheden sættes i `i_restance` |
| 3 | 14 dage | Virksomheden sættes i `spaerret` |

Når betaling registreres, nulstilles rykkertrinnet og virksomhedens restance/spærring ophæves automatisk.

### Webhooks
Indgående betalingshændelser modtages på `POST /api/webhooks/:provider`. Hændelser registreres idempotent i `webhook_events` med udbyder, hændelses-id, type, payload, signaturstatus og behandlingsstatus. Ugyldige signaturer afvises. Stripe- og MobilePay-hændelser bruges til at opdatere betalinger, refusioner og fjernede betalingsmidler.

---

## 6. Selvbetjent tilmelding og login-sikkerhed

### Selvbetjent tilmelding
På `/#/tilmeld` kan en ny virksomhed vælge pakke, indtaste virksomheds- og lederoplysninger, vælge adgangskode og acceptere privatlivspolitikken. Oprettelsen opretter virksomhed, lederbruger og abonnement med 14 dages gratis prøveperiode uden betalingskort.

E-mailbekræftelse, nulstilling af adgangskode og invitation af kolleger anvender kryptografisk tilfældige engangstokens.

| Formål | Gyldighed | Regel |
|--------|----------:|-------|
| E-mailbekræftelse | 24 timer | Kan kun bruges én gang |
| Glemt adgangskode | 1 time | Kan kun bruges én gang; nulstilling afslutter eksisterende sessioner |
| Invitation af kollega | 24 timer | Kan kun bruges én gang |

Uden opsat mailudbyder vises det konkrete link direkte på den relevante demoside. Det er kun en demonstrativ leveringsmåde; tokenet er stadig engangs og tidsbegrænset.

### Adgangskoder og loginbegrænsning
Adgangskoder hashes med scrypt og tilfældigt salt. Nye adgangskoder skal være mindst 10 tegn og indeholde mindst ét bogstav og ét tal; kendte svage adgangskoder afvises.

| Situation | Reaktion |
|-----------|----------|
| 5 mislykkede forsøg for en konto inden for 15 min. | Kontoen spærres i 15 min. |
| 10 mislykkede forsøg for en konto inden for 15 min. | Kontoen spærres i 60 min. |
| 20 mislykkede forsøg fra samme IP inden for 15 min. | Nye forsøg fra IP-adressen afvises, indtil vinduet udløber |

Fejlbeskeder ved login er med vilje generiske og afslører ikke, om en e-mailadresse findes. Alle loginforsøg logges med tidspunkt, IP-adresse, resultat og årsag.

### To-faktor-godkendelse
To-faktor-godkendelse er TOTP efter RFC 6238 med SHA-1, seks cifre og 30-sekunders trin. Systemet danner en standardiseret TOTP-URI; QR-koden genereres lokalt i browseren med `qrcode` og deles ikke med en ekstern QR-tjeneste.

Ved aktivering oprettes otte reservekoder. De gemmes kun som hashværdier og vises kun én gang i klartekst; hver reservekode kan kun bruges én gang. Deaktivering af to-faktor afslutter alle eksisterende sessioner.

---

## 7. GDPR og datapolitik

Virksomheden er dataansvarlig for egne ansatte, kunder og brugere; ADD SmartDrift Clean behandler data på virksomhedens vegne. Virksomheden har en konfigurerbar opbevaringspolitik, som kan sættes fra 0 til 240 måneder. Værdien `0` betyder gem for altid.

| Datatype | Standard | Oprydning |
|----------|---------:|----------|
| Tidsregistreringer | 60 mdr. | Sletter gamle tidsregistreringer |
| GPS-positioner | 6 mdr. | Fjerner koordinater fra tidsregistreringer, men kan bevare timerne |
| Fravær | 60 mdr. | Sletter gamle fraværsposter |
| Fotos og bilag | 24 mdr. | Sletter både fil og databasepost efter udløb |

Jobbet `gdpr_oprydning` anvender politikken automatisk, og leder kan også starte oprydning manuelt. Hver kørsel logges.

### Registreredes rettigheder
Systemet kan registrere og behandle anmodninger om indsigt, sletning og dataportabilitet. Dataudlevering hentes som JSON eller CSV for en valgt ansat, kunde eller bruger. Kodeordshashes og to-faktor-hemmeligheder udleveres aldrig.

Anonymisering af en ansat fjerner eller anonymiserer profiloplysninger, fravær, samtykker, bilag og GPS, mens timer kan bevares uden GPS af hensyn til løn og bogføring. Anonymisering af en kunde fjerner kontaktoplysninger, adresse, koordinater, tilknyttede konti og bilag; fakturaer bevares som regnskabsbilag.

### Samtykker og aftaler
Samtykkeregistret håndterer `databehandling`, `gps` og `foto` med tekstversion, givet tidspunkt og tidspunkt for tilbagetrækning. Samtykke kan trækkes tilbage. Databehandleraftalen læses og accepteres i systemet, og accepttidspunkt samt accepterende bruger gemmes. Privatlivspolitikken er tilgængelig uden login på `GET /api/legal/privatliv`.

---

## 8. Filhåndtering

Nye fotos og bilag gemmes uden base64-indhold i databasen.

| Lager | Valg | Adgang |
|-------|------|--------|
| Lokal disk | Standard, når S3-variabler mangler | Filer leveres af applikationen efter adgangskontrol |
| S3 | Når `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` og `S3_SECRET_ACCESS_KEY` alle er sat | Tidsbegrænset læseadresse på 15 minutter |

Ældre base64-bilag kan flyttes automatisk af `migrateLegacyAttachments`. Flytningen dekoder og validerer filen, gemmer bytes i det aktuelt valgte lager, opdaterer filmetadata og fjerner derefter den gamle `data_url`. Platformadministratoren kan starte flytningen fra platformskonsollen.

---

## 9. Automatiske job og driftsstyring

Automatiske job kører i samme Node-proces som webserveren, forskudt ved opstart, og logger hver gennemførte eller fejlede kørsel i `job_runs`. Platformadministratorer kan se seneste kørsler og starte et enkelt job manuelt i platformskonsollen. `DISABLE_JOBS=1` slår alle job fra.

| Jobnavn | Formål | Interval |
|---------|--------|----------|
| `gentagne_opgaver` | Lægger fremtidige forekomster af gentagne opgaver frem | Hver 6. time |
| `faktura_rykkere` | Sender rykkere på forfaldne kundefakturaer | Hver 12. time |
| `abonnement_fornyelse` | Fornyer abonnementer, opkræver og kører abonnementets rykkerforløb | Hver 12. time |
| `proeveperiode_paamindelse` | Minder om prøveperiodens udløb tre dage før og på udløbsdagen | Dagligt |
| `gdpr_oprydning` | Anvender opbevaringspolitik på GPS, tider, fravær og bilag | Dagligt |
| `oprydning` | Fjerner udløbne sessioner og engangstokens | Hver 6. time |
| `beskedkoe` | Forsøger igen på fejlede beskeder; e-mailfejl genforsøges begrænset | Hvert 30. minut |

Ved flere webserverinstanser må planlæggeren kun køre ét sted, medmindre der indføres ekstern planlægning, låsning og idempotens.

---

## 10. Funktioner — platformskonsollen

Kun `platform_admin` har adgang. Alle andre afvises både i grænsefladen og API'et.

- **Nøgletal:** Virksomheder efter status, MRR, ARR, udestående beløb og samlet antal ansatte.
- **Virksomhedsliste:** Navn, CVR, status, pakke, ansatte/kunder mod grænser og månedspris.
- **Opret virksomhed:** Firmaoplysninger, pakke, betalingscyklus og første leder oprettes samlet med prøveperiode.
- **Pakker og abonnementer:** Oprette og ændre pakker, priser, funktionsflag, pakkevalg og automatisk fornyelse.
- **Abonnementsfakturaer:** Udstede, vise PDF, markere betalt og følge status. Nummerformatet er `RA-ÅÅÅÅ-NNNN`.
- **Betalinger:** Se platformens betalingshistorik, betalingsudbydernes konfiguration, rykkerforløb og køre fornyelse/rykker manuelt.
- **Spær / genaktivér:** Med begrundelse og revisionsspor.
- **Drift:** Se `job_runs`, starte et job manuelt og migrere ældre base64-bilag.
- **Skift ind i virksomhed:** Platformadministrator kan åbne en virksomheds egne sider til support.

---

## 11. Teknologi

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Routing | wouter med hash-routing |
| Datahentning | TanStack Query v5 |
| Backend | Express + Node.js |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Validering | Zod med drizzle-zod |
| Adgangskoder | Node `crypto.scrypt` med tilfældigt salt |
| Sessioner | Serverside tokens i `sessions` med Bearer-header |
| PDF | pdfkit |
| QR-koder | qrcode |
| Ikoner | Lucide |

Omfang: 171 API-endpoints og 23 klientsider.

### PostgreSQL-klar drift
`shared/schema.pg.ts` og `drizzle.config.pg.ts` findes som parallelle PostgreSQL-filer. De bruger rigtige boolean-felter, hvor SQLite-skemaet i dag anvender 0/1-heltal, blandt andet for aktive brugere, to-faktor, læste notifikationer, abonnementets automatiske fornyelse, betalingsmidlers standardmarkering, samtykke og kvalitetskontrol.

PostgreSQL er ikke et runtime-flag i den nuværende server: lagerlaget skal porteres fra synkrone SQLite-kald til en PostgreSQL-adapter, og data skal migreres kontrolleret. Se **DRIFT.md** for rækkefølge, boolean-konvertering, test og tilbagefald ved migrering.

---

## 12. Datamodel

Versionskravet angiver 37 tabeller. Den gennemgåede `shared/schema.ts` deklarerer aktuelt **36 fysiske tabeller**; der er ikke opfundet en 37. tabel i denne specifikation. Tabellen nedenfor er derfor den præcise, implementerede datamodel og skal opdateres, når en eventuel 37. tabel bliver tilføjet til skemaet.

| Gruppe | Tabel | Indhold |
|--------|-------|---------|
| Kerne | `companies` | Virksomhed/lejer, kontakt, status, moms, opbevaringspolitik og databehandleraftale |
| Kerne | `users` | Login, rolle, tilknytning, scrypt-hash, e-mailbekræftelse og to-faktor |
| Kerne | `sessions` | Aktive login-tokens med udløb |
| Kerne | `employees` | Ansatte, kontakt, rolle, status og ugentlig arbejdstid |
| Kerne | `customers` | Kunder, kontakt, pris og geofence-koordinater |
| Drift | `tasks` | Opgaver, tjekliste, status, prioritet og gentagelse |
| Drift | `time_entries` | Tidsregistreringer, GPS, afstand, geofence og godkendelse |
| Drift | `absences` | Fravær, periode, status, løn og godkendelse |
| Drift | `shifts` | Vagter, tidsrum, status og publicering |
| Drift | `notifications` | Systembeskeder og læst-markering |
| Drift | `attachments` | Fotos/PDF, filmetadata, lagerreference og sletningsdato |
| Drift | `message_outbox` | Mail- og SMS-kø med leveringsstatus |
| Fakturering | `invoices` | Kundefakturaer, moms, forfald, betaling og rykkere |
| Fakturering | `invoice_items` | Fakturalinjer |
| Platform | `plans` | Pakker, priser, grænser og funktionsflag |
| Platform | `subscriptions` | Abonnement, periode, prøveperiode, standardbetalingsmiddel og rykkertrin |
| Platform | `platform_invoices` | ADD SmartDrift Cleans abonnementsfakturaer til virksomheder |
| Platform | `audit_logs` | Revisionsspor |
| Platform | `integrations` | Konfiguration af løn-, regnskabs- og øvrige integrationer |
| Platform | `sync_logs` | Resultat af synkroniseringer og eksporter |
| Sikkerhed og betaling | `payment_methods` | Udbyderreference og begrænsede visningsoplysninger om betalingsmiddel |
| Sikkerhed og betaling | `payments` | Betalingsforsøg, status, beløb, forsøg og afregning |
| Sikkerhed og betaling | `webhook_events` | Indgående betalingshændelser og idempotens |
| Sikkerhed og betaling | `auth_tokens` | Engangstokens til bekræftelse, nulstilling og invitation |
| Sikkerhed og betaling | `login_attempts` | Loginforsøg, IP, resultat og årsag |
| GDPR | `data_requests` | Anmodninger om indsigt, sletning og portabilitet |
| GDPR | `consents` | Samtykker til databehandling, GPS og foto |
| Branchemoduler | `quotes` | Tilbud med status og kobling til aftale |
| Branchemoduler | `quote_items` | Tilbudslinjer |
| Branchemoduler | `contracts` | Aftaler, prismodel, frekvens og vilkår |
| Branchemoduler | `materials` | Varekartotek og lagerbeholdning |
| Branchemoduler | `material_usage` | Forbrug, indkøb, korrektion og viderefakturering |
| Branchemoduler | `keys` | Nøgler, brikker, adgangskoder og krypterede alarmkoder |
| Branchemoduler | `key_handovers` | Udlånshistorik og nøgleoverdragelser |
| Branchemoduler | `inspections` | Kvalitetskontrol, score og opfølgning |
| Branchemoduler | `job_runs` | Kørsel og resultat for automatiske job |

SQLite har ikke array-kolonner; lister og sammensatte værdier, for eksempel tjeklister, kvalitetsscorer, funktionsflag og reservekodehashes, gemmes som JSON-tekst.

---

## 13. Arkitektur

```text
addsmartdriftclean/
├── client/src/
│   ├── App.tsx             # Auth-kontekst, rollebaseret navigation og hash-routing
│   ├── pages/              # 23 sider, herunder betaling, GDPR, sikkerhed,
│   │                       # tilbud, materialer, nøgler og kvalitet
│   └── lib/queryClient.ts  # API-kald og åbning af beskyttede filer
├── server/
│   ├── auth.ts             # Adgangskodehash, sessioner og adgangskontrol
│   ├── security.ts         # Loginspærring, TOTP, reservekoder og engangstokens
│   ├── payments.ts         # Udbydere, opkrævning, rykkere og webhooks
│   ├── gdpr.ts             # Opbevaring, udlevering og anonymisering
│   ├── files.ts            # Disk/S3, signering og flytning af gamle bilag
│   ├── scheduler.ts        # Syv automatiske job og joblogning
│   ├── domain.ts           # Geofence, moms, aftalepris og kvalitetsscore
│   ├── documents.ts        # PDF-generering
│   ├── messaging.ts        # Mail-/SMS-kø
│   ├── connectors.ts       # e-conomic og Danløn
│   ├── exportFormats.ts    # Eksportformater
│   ├── routes.ts           # 171 REST-endpoints
│   ├── storage.ts          # Drizzle-datalag og lejerafgrænsning
│   └── seed.ts             # Demodata
├── shared/
│   ├── schema.ts           # SQLite-skema og Zod-skemaer
│   └── schema.pg.ts        # PostgreSQL-parallel med boolean-felter
├── drizzle.config.pg.ts    # PostgreSQL-konfiguration til migrering
└── dist/                   # Bygget server og klient
```

---

## 14. Demobrugere

Adgangskode for alle: `demo1234`

| E-mail | Rolle | Virksomhed |
|-------|-------|------------|
| `platform@smartdriftclean.dk` | `platform_admin` | ADD SmartDrift Clean ApS |
| `leder@smartdriftclean.dk` | `leder` | Renser København ApS |
| `holdleder@smartdriftclean.dk` | `holdleder` | Renser København ApS |
| `assistent@smartdriftclean.dk` | `assistent` | Renser København ApS |
| `kunde@smartdriftclean.dk` | `kunde` | Renser København ApS |
| `leder2@smartdriftclean.dk` | `leder` | Nordjylland Rengøring, prøveperiode |
| `leder3@smartdriftclean.dk` | `leder` | Sydhavn Service ApS, i restance |

---

## 15. Ærlige begrænsninger

1. **Sessionen ligger kun i browserens hukommelse.** Browserens lagrings-API'er er blokeret i sandkassen, så brugeren logges ud ved genindlæsning. Det er ikke en vedvarende loginoplevelse.
2. **SQLite i sandkassen er ikke produktionspersistens.** Den mangler robust backup, replikering og flerinstansdrift. Brug PostgreSQL i drift efter den kontrollerede migrering i DRIFT.md.
3. **Betalinger er simulerede uden udbydernøgler.** Stripe, MobilePay og Betalingsservice opretter sporbare simuleringer, men ingen reel opkrævning uden de krævede miljøvariabler. Betalingsservice er desuden et filbaseret flow, hvor returfil/afstemning bekræfter resultatet.
4. **Mail og SMS simuleres uden udbydernøgler.** Beskeder gemmes i `message_outbox` med status `simuleret`; de har ikke forladt systemet.
5. **Direkte API-synkronisering findes kun til e-conomic og Danløn.** Dataløn, Zenegy, Lessor, Dinero og Billy leveres som eksportfiler, ikke som direkte API-synkronisering.
6. **Geofence dokumenterer position, men beviser ikke tilstedeværelse.** Brugeren kan afvise eller manipulere browserens GPS, og geofence beviser heller ikke udført arbejde.
7. **Manglende `ENCRYPTION_KEY` giver kun en demonøgle.** Alarm- og adgangskoder kan da afvikles i sandkassen, men er ikke reelt beskyttet mod en person med kendskab til demonøglen. Nøglen skal sættes i produktion og må ikke skiftes ukontrolleret.
8. **Automatiske job kører i samme proces som webserveren.** Ved flere instanser kan de køre dobbelt, medmindre de slås fra på alle undtagen én eller flyttes til en ekstern, låst planlægger.
9. **Webhookverificering skal gennemtestes før produktionsbrug.** Signaturverificering skal anvende den byte-nøjagtige rå request body; mellemled må ikke ændre indholdet.
10. **Databehandleraftalen er et praktisk systemudkast.** Den skal juridisk gennemgås og tilpasses den konkrete behandling, hosting og underdatabehandlere før produktion.

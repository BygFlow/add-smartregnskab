# Driftsvejledning for ADD SmartDrift Clean

Denne vejledning er til den it-ansvarlige i en mindre virksomhed. Den beskriver den version af ADD SmartDrift Clean, der ligger i dette projekt, herunder dens nuværende begrænsninger. Gem hemmeligheder i platformens secret-/miljøvariabel-funktion, aldrig i Git, dokumenter eller chat.

## Kort om systemet

ADD SmartDrift Clean er et dansk administrationssystem for rengøringsvirksomheder. Det håndterer blandt andet kunder, medarbejdere, opgaver og vagter, tidsregistrering med geofence, fravær, tilbud, kontrakter, materialer, nøgler/alarmkoder, kvalitet, fakturering, abonnementer, betalinger, bilag og GDPR-anmodninger.

Systemet er multi-tenant: næsten alle driftsdata hører til en virksomhed (`company_id`). API'et kontrollerer den loggede brugers virksomhed og rolle før adgang til beskyttede ruter.

```text
Brugerens browser
        │
        ▼
React + Vite-frontend ───────────────┐
        │ HTTP /api                  │ statiske filer i produktion
        ▼                             │
Express-API ──────── Drizzle ORM ────┼── SQLite: data.db (nuværende drift)
        │                             └── PostgreSQL (kræver lagerlagsmigrering)
        ├── filsystem: uploads/ eller S3
        ├── Resend / valgfri SMS-udbyder
        ├── Stripe / MobilePay / Betalingsservice
        └── planlagte job i samme Node-proces
```

## Sådan kører du det lokalt

### Forudsætninger

- En understøttet Node.js-version (projektet har TypeScript-typer til Node 20).
- `npm`.
- Ved SQLite-drift: skriveadgang til projektmappen, så `data.db` og `uploads/` kan oprettes.

### Installation og udvikling

Kør fra projektets rodmappe:

```bash
npm install
npx drizzle-kit push
npm run dev
```

`npx drizzle-kit push` bruger den nuværende `drizzle.config.ts`, som peger på SQLite-filen `./data.db`. Udviklingsserveren startes af `npm run dev` på port 5000, medmindre `PORT` er sat.

### Byg og produktionsstart

```bash
npm run build
NODE_ENV=production npm run start
```

Bygget samler frontend og server i `dist/`; `npm run start` kører `dist/index.cjs`. Sæt nødvendige miljøvariabler i procesmanageren/hostingplatformen før start. Kør altid en backup og en kort gennemtest af login, oprettelse og filupload efter deployment.

## Miljøvariabler

`dotenv/config` læses ved serverstart, så en lokal `.env` kan bruges under udvikling. I produktion skal værdier lægges ind som hemmelige miljøvariabler. Ingen af de hemmelige værdier må logges.

| Variabel | Hvad den gør | Krav | Eksempel |
|---|---|---|---|
| `NODE_ENV` | Styrer produktionsgrenen og den måde frontend leveres på. | `production` i produktion. | `production` |
| `PORT` | HTTP-port. Standard er `5000`. | Valgfri. Skal være en ledig TCP-port. | `5000` |
| `APP_URL` | Grund-URL, der bruges til links i invitationer og kontorelaterede e-mails. | Anbefalet i produktion, inkl. `https://`; tom værdi giver relative/ufuldstændige links. | `https://app.eksempel.dk` |
| `DATABASE_URL` | PostgreSQL-forbindelsesstreng for **`drizzle.config.pg.ts`**. Den nuværende server læser stadig hardkodet SQLite `data.db`; variablen skifter derfor ikke alene runtime til PostgreSQL. | Kræves til PostgreSQL-schema-push og efter et kommende lagerlags-skift. | `postgresql://addsmartdriftclean:hemmelig@db.example:5432/addsmartdriftclean?sslmode=require` |
| `ENCRYPTION_KEY` | Materiale til AES-256-GCM-kryptering af små følsomme felter, især alarm- og nøglekoder. | **Påkrævet i produktion**, mindst 16 tegn; brug en lang tilfældig secret. | `en-lang-tilfaeldig-produktionsnoegle...` |
| `STRIPE_SECRET_KEY` | Servernøgle til Stripe Setup Intents, betalinger og refunderinger. | Kræves sammen med Stripe-webhookhemmeligheden for reel Stripe-drift. | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Verificerer Stripe-signaturer og aktiverer sammen med nøglen reel Stripe-drift. | Kræves med `STRIPE_SECRET_KEY`. | `whsec_...` |
| `MOBILEPAY_CLIENT_ID` | OAuth-klient-id til MobilePay Subscriptions. | Kræves sammen med de to andre MobilePay-værdier. | `xxxxxxxx-...` |
| `MOBILEPAY_CLIENT_SECRET` | OAuth-klienthemmelighed til MobilePay. | Kræves sammen med de to andre MobilePay-værdier. | `meget-hemmelig` |
| `MOBILEPAY_WEBHOOK_SECRET` | HMAC-hemmelighed til MobilePay-webhooks. | Kræves sammen med de to andre MobilePay-værdier. | `meget-hemmelig` |
| `BETALINGSSERVICE_PBS_NUMBER` | PBS-/leverandørnummer til Nets Betalingsservice-filflow. | Kun hvis Betalingsservice bruges. Det er et filbaseret flow, ikke live charge-API. | `12345678` |
| `RESEND_API_KEY` | API-nøgle til afsendelse af e-mail gennem Resend. | Kræves sammen med `MAIL_FROM` for reel e-mail. | `re_...` |
| `MAIL_FROM` | Afsenderadresse, som Resend må sende fra. | Kræves sammen med `RESEND_API_KEY`; domænet skal være verificeret hos Resend. | `ADD SmartDrift Clean <drift@eksempel.dk>` |
| `SMS_API_URL` | HTTPS-endepunkt hos SMS-udbyderen. | Kræves sammen med `SMS_API_KEY` for reel SMS. API'et skal acceptere JSON med `to` og `message`. | `https://sms.example.dk/v1/messages` |
| `SMS_API_KEY` | Bearer-token til SMS-udbyderen. | Kræves sammen med `SMS_API_URL`. | `sms_...` |
| `S3_BUCKET` | Navn på S3-bucket til bilag. | Kræves sammen med alle tre øvrige S3-værdier for at vælge S3. | `addsmartdriftclean-bilag-prod` |
| `S3_REGION` | AWS-region for bucket. | Kræves med de øvrige S3-værdier. | `eu-central-1` |
| `S3_ACCESS_KEY_ID` | AWS access key til S3. | Kræves med de øvrige S3-værdier; begræns IAM-rettigheder til den konkrete bucket/prefix. | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS secret key til S3. | Kræves med de øvrige S3-værdier. | `...` |
| `DISABLE_JOBS` | Slår alle automatiske job fra, når værdien er præcis `1`. | Brug kun bevidst, fx på en ekstra serverinstans eller under vedligehold. | `1` |

### Bemærkning om SMTP/EMAIL-variabler

Koden læser **ikke** `SMTP_*` eller generiske `EMAIL_*`-variabler. E-mail går konkret via Resend og kræver `RESEND_API_KEY` og `MAIL_FROM`. Hvis jeres driftsplatform tilbyder SMTP-variabler, har de ingen virkning, før afsendelseskoden ændres.

### Eksempel på lokal `.env`

```dotenv
PORT=5000
APP_URL=http://localhost:5000
ENCRYPTION_KEY=udskift-denne-med-en-lang-tilfaeldig-lokal-noegle
# DATABASE_URL=postgresql://addsmartdriftclean:hemmelig@localhost:5432/addsmartdriftclean
# RESEND_API_KEY=re_...
# MAIL_FROM=ADD SmartDrift Clean <drift@eksempel.dk>
# SMS_API_URL=https://sms.example.dk/v1/messages
# SMS_API_KEY=...
```

## Skift fra SQLite til PostgreSQL

### Status og forventning

`shared/schema.pg.ts` og `drizzle.config.pg.ts` er en PostgreSQL-skabelon. Den aktuelle applikation bruger dog `better-sqlite3` og synkrone Drizzle-kald direkte i `server/storage.ts`. Et databaseskift er derfor et reelt udviklings- og testarbejde, **ikke** et flag, man slår om med `DATABASE_URL`.

### Foreslået forløb

1. Planlæg nedetid og tag en verificeret SQLite-backup, inklusive `uploads/` hvis lokal disk bruges.
2. Opret en tom PostgreSQL-database og en mindst privilegeret databasebruger.
3. Sæt `DATABASE_URL` på maskinen, hvor schemaet skal køres.
4. Opret PostgreSQL-tabellerne fra det parallelle skema:

   ```bash
   export DATABASE_URL='postgresql://addsmartdriftclean:HEMMELIG@db.example:5432/addsmartdriftclean?sslmode=require'
   npx drizzle-kit push --config drizzle.config.pg.ts
   ```

5. Eksporter og indlæs data med et kontrolleret ETL-script. Behold tabeller og kolonnenavne; de er lavet ens i de to skemaer. Håndtér sekvenser efter import, fx med `setval`, så nye `serial`-id'er fortsætter efter højeste importerede id.
6. Konvertér disse 0/1-kolonner til `false`/`true`: `users.active`, `users.email_verified`, `users.two_factor_enabled`, `time_entries.approved`, `notifications.read`, `integrations.auto_sync`, `absences.paid`, `shifts.published`, `plans.active`, `subscriptions.auto_renew`, `payment_methods.is_default`, `webhook_events.signature_valid`, `webhook_events.processed`, `login_attempts.success`, `consents.granted`, `contracts.index_adjustment`, `materials.hazardous`, `materials.active`, `material_usage.billable`, `inspections.follow_up_done` og `inspections.customer_visible`.
7. Portér og test lagerlaget, derefter kør en komplet accepttest i et ikke-produktionsmiljø før cutover.

### Konkrete ændringer i `server/storage.ts`

Dette er minimumsarbejdet i lagerlaget:

- **Linje 43–49:** Erstat importen `drizzle-orm/better-sqlite3`, `better-sqlite3`-driveren og `new Database("data.db")`/WAL-pragmet med en PostgreSQL-driver og Drizzle-adapter. `pg` mangler i den aktuelle afhængighedsliste og skal først tilføjes som en bevidst del af migreringen.
- **Linje 1–42:** Skift schema-/typeimporter fra `@shared/schema` til `@shared/schema.pg`, når resten af serveren er gjort PostgreSQL-kompatibel.
- **Hele `DatabaseStorage` (ca. linje 198–839):** SQLite-kaldene `.get()`, `.all()` og `.run()` er synkrone. PostgreSQL-adapteren bruger promises, så de skal erstattes af de relevante `await`-ede forespørgsler, typisk `.then(...)`, `.returning()` eller adapterens tilsvarende metoder. Sletninger skal hente `rowCount`/returnerede rækker i stedet for `.run().changes`.
- **Boolean-casts overalt:** Koden sammenligner og skriver i dag ofte tal, fx `eq(paymentMethods.isDefault, 1)` omkring linje 537, `.set({ isDefault: 0 })` omkring linje 546 og `eq(loginAttempts.success, 0)` omkring linje 604. De skal blive `true`/`false`. Samme gennemgang kræves i `server/routes.ts`, `server/security.ts`, `server/gdpr.ts`, `server/domain.ts` og seed-data, fordi de alle skriver/læser 0/1.
- **Direkte databasekald uden om storage:** `server/files.ts` (bl.a. omkring linje 234), `server/gdpr.ts` og `server/seed.ts` bruger også den eksporterede `db` med SQLite-syntaks. De skal porteres og await'es.
- **Transaktioner, samtidighed og test:** Indfør transaktioner for flertrinsopdateringer, og test tenant-afgrænsning, idempotente webhooks, sletninger, GDPR-oprydning og alle betalingsflow før produktion.

Kør aldrig den nye PostgreSQL-konfiguration mod produktionsdata som første test. Brug en kopi, afstem antal og beløb pr. tabel, og gem et tilbagefaldspunkt med den gamle database.

## Betalinger

### Simulering og reel drift

Hver betalingsudbyder kører i simulering, når dens nødvendige miljøvariabler mangler. I simulering oprettes der stadig sporbare betalingsposter, men ingen ekstern betaling udføres. Status kan derfor være `simuleret`; den må ikke behandles som et reelt indbetalt beløb.

- **Stripe:** Reelle kald aktiveres først, når både `STRIPE_SECRET_KEY` og `STRIPE_WEBHOOK_SECRET` er sat. Systemet bruger Stripe Setup Intents, Payment Intents og refunds.
- **MobilePay:** Reelle kald aktiveres først, når `MOBILEPAY_CLIENT_ID`, `MOBILEPAY_CLIENT_SECRET` og `MOBILEPAY_WEBHOOK_SECRET` alle er sat.
- **Betalingsservice:** Med `BETALINGSSERVICE_PBS_NUMBER` dannes et filrecord til Nets-/bank-flow. Det er ikke en liveopkrævning; returfil eller afstemning skal bekræfte resultatet.

Følg betalingsudbydernes egne testmiljøer før produktionsnøgler sættes. Overvåg altid betalinger med status `fejlet`, `afventer` og `simuleret`.

### Webhooks

Registrér følgende offentligt tilgængelige, HTTPS-beskyttede URL'er hos udbyderne:

```text
https://app.eksempel.dk/api/webhooks/stripe
https://app.eksempel.dk/api/webhooks/mobilepay
```

Ruten er generisk i koden: `POST /api/webhooks/:provider`. Den ligger bevidst før login-kravet og kontrollerer udbydersignaturen. En ugyldig signatur afvises med HTTP 400.

**Vigtigt:** Stripe og MobilePay-signaturer skal kontrolleres mod den byte-nøjagtige, rå request body. Serveren gemmer allerede request-bufferen som `req.rawBody` i Express' JSON-`verify`-funktion, men den nuværende webhook-handler serialiserer `req.body` igen. Før produktion bør handleren ændres til at verificere `req.rawBody` direkte og tests bør bekræfte, at mellemled ikke ændrer body eller signatur-header. Sæt ikke en almindelig JSON-parser foran webhook-ruten uden samtidig at bevare rå body.

## Post og SMS

Alle udgående e-mails og SMS'er lægges først i databasen som en række i `message_outbox`. Rækken indeholder kanal, modtager, emne/indhold, relateret objekt, fejltekst og tidsstempler. Det giver et revisionsspor, også hvis leverandøren er nede.

- E-mail sendes via Resend, når `RESEND_API_KEY` og `MAIL_FROM` er sat. Der sendes blandt andet fakturaer, rykkere og prøveperiodepåmindelser.
- SMS sendes til den konfigurerede `SMS_API_URL` med bearer-token. Vagtpublicering kan bruge SMS med dato, klokkeslæt og kundested.
- Uden en konfigureret kanal får beskeden status **`simuleret`**. Den er gemt og synlig i systemet, men intet har forladt systemet.
- Ved netværks- eller leverandørfejl får den status `fejl`. Jobbet `beskedkoe` forsøger fejlede beskeder igen, men markerer efter genforsøg for at undgå endeløse løkker.

Brug køen som driftskontrol: undersøg `fejl` med fejltekst, og efterse `simuleret` før I antager, at kunder eller medarbejdere har modtaget noget.

## Automatiske job

Jobbene kører med `setInterval` i samme Node-proces som webserveren. Første kørsel er forskudt med 20 sekunder pr. job. De skriver resultat eller fejl i `job_runs`.

| Jobnavn | Hvad det gør | Interval |
|---|---|---:|
| `gentagne_opgaver` | Lægger fremtidige forekomster af gentagne opgaver frem for aktive virksomheder. | Hver 6. time |
| `faktura_rykkere` | Sender rykker på forfaldne kundefakturaer: første efter 3 dage, derefter mindst 10 dage imellem og maks. tre rykkere. | Hver 12. time |
| `abonnement_fornyelse` | Fornyer abonnementer, udsteder/opkræver og kører rykkerforløb. | Hver 12. time |
| `proeveperiode_paamindelse` | Sender påmindelse 3 dage før og på dagen, hvor en prøveperiode slutter. | Hver 24. time |
| `gdpr_oprydning` | Anvender hver virksomheds opbevaringspolitik på GPS, tider, fravær og bilag. | Hver 24. time |
| `oprydning` | Fjerner udløbne sessioner og engangstokens. | Hver 6. time |
| `beskedkoe` | Forsøger igen på beskeder med status `fejl`, når e-mailudbyderen er sat op. | Hvert 30. minut |

Sæt `DISABLE_JOBS=1` for at slå dem alle fra, fx på en sekundær instans. I et setup med flere webinstanser må planlæggeren kun køre ét sted; ellers kan jobs udføres flere gange. Alternativt skal I bruge en ekstern scheduler/worker med låsning og idempotens.

Platformadministratorer kan se de seneste jobkørsler på `GET /api/platform/jobs` og starte ét job manuelt med:

```bash
curl -X POST \
  -H 'Authorization: Bearer <platform-admin-token>' \
  https://app.eksempel.dk/api/platform/jobs/gdpr_oprydning
```

Gyldige job-id'er er navnene i tabellen. Det manuelle endpoint kræver platformadministrator.

## Sikkerhed

### Login og adgangskoder

- Adgangskoder hashes med scrypt og salt i serverkoden.
- Adgangskodekontrollen kræver mindst 10 tegn, mindst ét bogstav og mindst ét tal. Specialtegn tæller med i styrkescoren, men er ikke et hårdt krav. Den afviser også en liste med kendte svage adgangskoder.
- Efter fem fejl i et 15-minutters vindue låses kontoen i 15 minutter; ved ti eller flere fejl låses den i en time. Der er desuden grænse på 20 mislykkede forsøg pr. IP-adresse pr. 15 minutter.
- Fejlteksten er med vilje generisk, så login ikke afslører, om en e-mailadresse findes.
- To-faktor-login er TOTP med seks cifre og 30-sekunders trin. Backupkoder gemmes hash'et og kan kun bruges én gang.
- Nulstilling af adgangskode afslutter brugerens eksisterende sessioner.

### Krypteringsnøgle

`ENCRYPTION_KEY` **skal** sættes i produktion. Uden den afleder applikationen en nøgle fra en fast demo-streng for at kunne køre i sandkassen. Det betyder, at alarm- og nøglekoder kun er nominelt beskyttet, ikke reelt beskyttet mod en person med kendskab til koden.

Nøglen må ikke skiftes ukontrolleret: eksisterende AES-GCM-krypterede værdier kan derefter ikke dekrypteres. Ved nøgleskift skal I planlægge en nøgle-rotationsprocedure, der dekrypterer med gammel nøgle og genkrypterer med ny nøgle i en testet, sikker proces. Tag backup først, og opbevar den gamle nøgle sikkert, indtil verifikation og tilbagefaldsvindue er afsluttet.

### Praktiske minimumskrav

- Brug HTTPS foran applikationen; terminer TLS i en betroet reverse proxy eller hostingplatform.
- Begræns database-, S3- og leverandørnøgler til mindst mulige rettigheder, og rotér dem efter jeres politik.
- Giv kun platformadministratorrollen til få personer.
- Gennemgå revisionsloggen og loginforsøg jævnligt.
- Hold Node.js og afhængigheder opdaterede efter test i et stagingmiljø.

## Backup og genskabelse

### SQLite

Stop helst applikationen kort, eller brug SQLite's online backup-kommando. Gem database og eventuelle lokale bilag samlet.

```bash
# Databasebackup
sqlite3 data.db ".backup '/sikker/backupmappe/data-$(date +%F).db'"

# Hvis lokal filopbevaring bruges, tag også backup af bilag
rsync -a uploads/ /sikker/backupmappe/uploads-$(date +%F)/
```

En enkel gendannelse er at stoppe appen og erstatte `data.db` med den testede backup. Husk også den matchende `uploads/`-kopi; databasens filmetadata er ikke nok uden selve filerne.

### PostgreSQL

Når PostgreSQL-migreringen er gennemført, brug eksempelvis et custom-format dump:

```bash
pg_dump --format=custom --no-owner --file=/sikker/backupmappe/addsmartdriftclean-$(date +%F).dump "$DATABASE_URL"

# Gendannelse til en tom database
createdb addsmartdriftclean_restore
pg_restore --no-owner --clean --if-exists --dbname=addsmartdriftclean_restore /sikker/backupmappe/addsmartdriftclean-YYYY-MM-DD.dump
```

Hvis jeres databasehost leverer snapshots og point-in-time recovery, skal det konfigureres som supplement, ikke som eneste dokumenterede rutine. S3-bilag skal have versionering/livscyklus og uafhængig backup efter jeres databehandlerkrav.

### Anbefalet rytme

- Tag mindst daglig automatisk backup af database og filer.
- Opbevar flere generationer, og mindst én kopi adskilt fra driftsmiljøet.
- Overvåg at backup-job faktisk lykkes.
- **Øv en komplet genskabelse mindst én gang.** Gendan til et isoleret testmiljø, kontrollér login, et udvalg af data, bilag og beløbsafstemning, og dokumentér tid, resultat og eventuelle mangler.

## GDPR i drift

Virksomheden er dataansvarlig; ADD SmartDrift Clean beskriver sig som databehandler. Databehandleraftalen i systemet er et praktisk udkast og skal gennemgås/tilpasses juridisk før faktisk brug. Indgå også databehandleraftaler med hosting, e-mail-, SMS- og S3-leverandører efter jeres konkrete setup.

### Opbevaring og oprydning

Hver virksomhed har egne opbevaringsperioder. Standarderne er:

| Datatype | Standard | Hvad oprydning gør |
|---|---:|---|
| GPS | 6 måneder | Fjerner koordinater fra gamle tidsregistreringer, men bevarer timerne. |
| Tidsregistrering | 60 måneder | Sletter gamle tidsregistreringer. |
| Fravær | 60 måneder | Sletter gamle fraværsposter. |
| Foto/PDF-bilag | 24 måneder | Sletter både filen fra disk/S3 og dens databasepost, når `delete_after` er udløbet. |

Værdien `0` betyder behold altid. Det bør kun vælges efter en konkret, dokumenteret vurdering. Ved anonymisering af ansatte bevares timer uden GPS af hensyn til dokumentation for løn og bogføring; ved anonymisering af kunder bevares fakturaer som regnskabsbilag.

### Anmodninger og dataudlevering

Systemet kan registrere anmodninger om indsigt, sletning og portabilitet. Platformen kan udlevere persondata som JSON eller CSV via `GET /api/gdpr/udlevering` for en valgt type og id. Sikkerhedsoplysninger som kodeordshash og 2FA-hemmeligheder udleveres ikke.

Det er stadig den dataansvarlige, der skal validere identitet, træffe den juridiske vurdering, svare den registrerede rettidigt og dokumentere udfaldet. Brug anonymiserings- og eksportfunktioner som hjælpemidler, ikke som erstatning for en GDPR-proces.

### Logning

API-loglinjer kan indeholde request-sti, HTTP-status og serialiserede JSON-svar. `audit_logs`, loginforsøg, beskedkø og betalings-/webhookposter kan også indeholde e-mailadresser, navne, id'er, fejltekster eller andre personoplysninger. Beskyt logadgang, begræns logopbevaring og undgå at eksportere logs til ukontrollerede tjenester.

## Filer og bilag

Bilag er begrænset til billeder og PDF-filer på højst 10 MB. Nye filer gemmes ikke længere som base64 i databasen, men vælges automatisk sådan:

- **Lokal disk:** Hvis alle S3-variabler mangler, gemmes filerne under den hardkodede mappe `uploads/` i projektmiljøet. Mappen skal være persistent, have adgangskontrol og være med i backup.
- **S3:** Hvis `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` og `S3_SECRET_ACCESS_KEY` alle er sat, gemmes nye filer i bucket'en. Applikationen signer selv S3-kald og kan lave en tidsbegrænset læseadresse på 15 minutter.

`migrateLegacyAttachments` finder ældre rækker med `data_url`, dekoder og validerer dem, gemmer bytes i det aktuelt valgte lager, opdaterer `storage`, `storage_key` og størrelse og sætter derefter `data_url` til `null`. Platformadministratoren kan udløse flytningen via `POST /api/platform/filer/migrer`. Tag backup først, kør helst i vedligeholdelsesvindue og kontrollér antal, filstørrelser og stikprøver bagefter.

## Overvågning

Sæt alarmer eller faste driftsrutiner op for mindst følgende:

| Område | Hvad skal kontrolleres | Forslag til handling |
|---|---|---|
| Betalinger | `fejlet`, `afventer` og uventet mange `simuleret`-betalinger; manglende webhookevents. | Kontroller nøgler, webhook-signatur, udbyderdashboard og berørte abonnementer. |
| Beskedkø | `message_outbox` med status `fejl` eller uventet `simuleret`. | Læs fejltekst, ret leverandørkonfiguration og følg op på kritiske modtagere. |
| Abonnementer | Virksomheder i restance, udløbne prøveperioder og rykkerniveau. | Afstem med betalingsudbyder og kontakt kunden efter jeres proces. |
| Job | `job_runs` med status `fejlet` eller gamle sidste-kørsler. | Ret fejl, kør eventuelt job manuelt som platformadministrator. |
| Disk/S3 | Lokal diskplads, vækst i `uploads/`, fejl ved upload/sletning og S3-omkostninger. | Udvid lager, kontrollér backup og opbevaringspolitik. |
| Database | SQLite-filens plads, fejl, backupstatus; PostgreSQL-forbindelser, plads og backup/PITR. | Reagér før disken er fuld, og test gendannelse. |
| Sikkerhed | Loginfejl, konto-spærringer, usædvanlige API-fejl og ændringer i revisionslog. | Undersøg konto/IP, rotér kompromitterede secrets og dokumentér hændelsen. |

Sørg desuden for procesovervågning: applikationen skal genstartes ved crash, og den bør have en simpel sundheds-/syntetisk test af login eller en beskyttet API-rute efter deployment.

## Kendte begrænsninger

- Brugerens session lever kun i browserens hukommelse i den nuværende sandkasse-visning. Den forsvinder ved genindlæsning af siden; det er ikke en vedvarende loginoplevelse.
- SQLite-filen i sandkassen er ikke produktionsholdbar lagring. Den mangler blandt andet en robust flerinstansstrategi, administreret backup/PITR og den driftssikkerhed, der forventes ved rigtig produktion.
- Direkte API-synkronisering findes kun til **e-conomic** og **Danløn**. Andre viste integrationsnavne er ikke direkte API-synkronisering; brug eksport eller udvikl en integration.
- Geofence dokumenterer en check-in/check-ud-position og afstand til kundens adresse, men beviser ikke fysisk tilstedeværelse eller udført arbejde.
- Automatiske job er in-process timers. Ved flere serverinstanser kan de køre dobbelt, medmindre de slås fra på alle undtagen én eller flyttes til en ekstern, låst worker.
- Den nuværende webhook-handler skal strammes, så signaturer verifices mod den gemte byte-nøjagtige rå body før produktion.

## Fast driftscheckliste

**Dagligt eller ugentligt**

1. Bekræft at backup lykkes, og gennemgå fejl i jobkørsler.
2. Gennemgå fejlede betalinger og beskeder.
3. Kontroller diskplads/S3 og usædvanlig vækst.
4. Gennemgå kritiske sikkerheds- og adgangsændringer.

**Månedligt eller kvartalsvist**

1. Revider brugere, roller og afmeld tidligere medarbejdere.
2. Kontroller leverandørnøgler og webhook-status.
3. Afstem abonnementer og fakturaer.
4. Kontrollér opbevaringsperioder og gennemførte GDPR-oprydninger.
5. Test gendannelse og dokumentér resultatet efter den valgte frekvens.

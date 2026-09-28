# EDI for SmartRegnskab, Pro og Clean — staging og lancering

Status: private integrationstesttjenester er oprettet; fælles EDI-gateway er stadig kun lokalt bygget og testet. Dette dokument er **ikke** en godkendelse til at åbne hjemmesiden eller aktivere EDI i produktion.

## Første spor: intern integration uden Sproom

SmartRegnskab, Pro og Clean kan afprøves separat fra EDI, men kun i tre isolerede stagingmiljøer med egne databaser, fillagre, testbrugere og testvirksomheder. Den eksisterende `render.yaml` i hvert produkt beskriver produktion og må ikke bruges som staging uden eksplicit adskillelse. Oprettelse af nye Render-tjenester kan koste penge og kræver særskilt godkendelse.

- SmartRegnskab-staging: kopi af appen med separat database/fillager og uden produktionsnøgler til betaling, mail, bank og Sproom. Udsted en ADD Connect-testnøgle bundet til den fiktive virksomhed og det rigtige kildeprogram.
- Pro-staging: sæt ADD SmartRegnskab-integrationens `endpoint` eksplicit til **SmartRegnskab-staging**. Gem ingen produktionsnøgle eller rigtige fakturaer i testvirksomheden.
- Clean-staging: sæt integrationens `baseUrl` eksplicit til `http://add-smartregnskab-staging:10000`. `ADD_DEPLOYMENT_MODE=staging` afviser nu en manglende eller anden adresse, så connectoren ikke falder tilbage til produktionsadressen.
- Alle tre: lad `EDI_GATEWAY_URL`, `EDI_GATEWAY_KEYS_JSON` og Sproom-credentials være tomme. Slå automatisk afsendelse, live betalinger og kundemails fra, eller brug dokumenterede testudbydere. Brug kun fiktive CVR-numre, modtagere og dokumenter.
- Test én allerede udstedt faktura fra Pro og én fra Clean: original PDF og SHA-256 skal matche, SmartRegnskab skal bogføre præcis én gang, og det må ikke sende fakturaen igen. Test også kladde, dublet, forkert virksomheds-/programnøgle, manglende konti, genforsøg og gendannelse fra backup.
- Først efter en logget stagingrapport og en vellykket restore-test kan intern integration foreslås til produktion. Det er en **separat** beslutning fra Sproom/EDI og fra offentlig lancering; brugerens særskilte godkendelse kræves.

De private stagingtjenester er oprettet, og en afgrænset fakturatest mellem de tre kørende tjenester er gennemført 28. september 2026. Pro testede direkte ADD Connect-transport; Clean testede sin fakturaconnector. Begge blev bogført/arkiveret i SmartRegnskab uden dubletter. Det fulde brugerflow, restore og EDI er ikke testet. Se `ADD-CONNECT-RENDER-STAGING-TEST-2026-09-28.md`.

### Render-kontrol 28. september 2026

Tre isolerede private tjenester er nu oprettet på Render fra `staging/internal-integration-2026-09-28`: `add-smartregnskab-staging`, `add-smartdrift-pro-staging` og `add-smartdrift-clean-staging`. Pro bruger en separat staging-PostgreSQL-database; SmartRegnskab og Clean har hver sin persistente staging-SQLite-disk. Staging-databasens offentlige IP-adgang er blokeret. Pro og Clean afviser produktionsadressen for SmartRegnskab i staging. Der er ikke ændret i produktionsgrenene eller åbnet en offentlig stagingadresse.

Lokalt er ADD Connect testet med én fiktiv virksomhed, en midlertidig testnøgle og fakturaer fra både Pro og Clean: de bogføres hver én gang, selv når kilde-ID'et er ens, og en anden virksomhed kan ikke se posteringerne. EDI-gatewayens simulerede tre-program-flow, kundeadskillelse, signaturer, kø/genforsøg og Sproom-adapter består også. I Render-staging blev en fiktiv virksomhed og en kortlivet ADD Connect-nøgle oprettet til den faktiske tre-tjeneste-test. Nøglen blev efter testen fjernet fra alle tre tjenesters miljø og deaktiveret i SmartRegnskab. Ingen Sproom- eller betalingsnøgler blev sat i staging.

## Før EDI-staging kan begynde

- Bekræft at Sproom-aftalen for ADD SmartDrift ApS er aktiv, og få adgang til staging-parent-token, child-profiler, webhook-public key og relevante API-rettigheder. Ét CVR må kun mappes til én child-profil; eksisterende profil kræver Sprooms særlige enrollment-proces og kundens dokumenterede samtykke.
- Vælg en faktisk OIOUBL/Peppol-validator og test den med gyldige og ugyldige dokumenter. `EINVOICE_VALIDATOR_URL` må ikke sættes til en attrap.
- Opret en separat gateway-tjeneste med persistent disk til `EDI_GATEWAY_DATABASE_PATH`, isoleret fra SmartRegnskabs database. Sæt admin-token, Sproom-nøgle og virksomhedsopdelte produktnøgler som secrets i driftsmiljøet, ikke i kildekode eller chat.
- En separat, **ikke synkroniseret** Render-skabelon ligger i `render.edi-staging.yaml`. Den ændrer ikke den eksisterende `render.yaml` eller produktionsmiljøet. Den må først synkroniseres efter godkendelse af den nye tjenestes omkostning og adgangs-/backupopsætning. Den peger kun på `staging.sproom.net`, bruger separat disk og har automatisk deploy slået fra.
- Opret særskilt objektlager og krypteringsnøgle til `npm run edi:backup:offsite`; slå versionshistorik, passende retention, mindst mulige rettigheder og alarmer for mislykkede kørsler til. Test gendannelse til en ny tjeneste før kundedata modtages. `/ready` tester ikke offsite-backup.
- Render-cronjobs kan ikke læse en webtjenestes persistente disk. Slå derfor først `EDI_GATEWAY_OFFSITE_BACKUP_ENABLED=true` til **på gateway-tjenesten** efter manuel offsite-test. Det interne job kører efter fem minutter og derefter dagligt, afviser manglende konfiguration og logger fejl. Der mangler fortsat ekstern alarm, dokumenteret retention og separat gendannelsesøvelse.
- Afgør for hvert CVR hvilken løsning der er primær NemHandel/Peppol-modtager: SmartRegnskab, Pro, Clean eller eksisterende eksternt ERP. Aktivér ikke to konkurrerende modtagere. Afgør også hvem der udsteder og sender hver faktura; SmartRegnskab må ikke gensende en faktura fra Pro/Clean.
- Kør `npm run edi:cutover:audit` med læseadgang til **begge** eksisterende databaser. Rapporten optæller gamle XML-originaler, udestående udgående dokumenter, overlappende provider-ID'er og uenighed om CVR/child-profil. Den er læsebeskyttet og flytter intet. Afklar alle `blockers` manuelt, før den gamle SmartRegnskab-webhook eller direkte afsendelse slukkes. Rapporten alene er ikke en go-live-godkendelse.

## Staging-test, der skal bestå

1. Opret fiktive testvirksomheder fra hvert af de tre programmer og verificér, at en nøgle til A hverken kan se eller sende for B. Test samme CVR på tværs af produkter og modstridende child-mapping.
2. Send OIOUBL og Peppol BIS 3.0 fra hver relevant afsender. Kontroller fakturanummer, udsteder-CVR, modtager-CVR/EAN, moms, totaler og original XML hos modtager. `submitted` må ikke vises som leveret.
3. Modtag fakturaer i hver valgt indbakke. Afprøv gyldig/ugyldig RSA-signatur, identiske webhooks, manglende dokument, timeout, genforsøg og servergenstart. Verificér at webhook-køen overlever genstart og at alle mislykkede hændelser er synlige.
4. Afprøv statusforløb `sent`, `received`, `rejected` og forsinkede/modstridende hændelser. Afstem mod Sprooms status-API; genafsend aldrig automatisk efter et usikkert udfald.
5. Test at Pro/Clean kan sende uden SmartRegnskab, og at SmartRegnskab kun arkiverer og bogfører en faktura, som Pro/Clean allerede har udstedt. For en kunde med eksternt ERP: afprøv kun dokumenteret, godkendt dataflow; der er endnu ingen generel ERP-connector.
6. Kør offsite-backup på staging, hent den tilbage og gendan både dokumenter og ubehandlede webhook-hændelser på en separat instans. Prøv et korrupt objekt og en forkert nøgle; begge skal afvises. Dokumentér RPO/RTO og hvem der reagerer på alarm.
7. Gennemgå adgangslog, databehandleraftaler, opbevaring/sletning, hændelsesberedskab og brugerrettigheder. Kundens CVR, EAN og godkendelse må verificeres inden aktivering.

Den lokale, fiktive 3-program-test ligger i `tests/edi-three-products-staging.test.ts`. Den tester fælles CVR/child-profil, tre selvstændige afsendere, ét valgt indgående modtagerprogram, signeret webhook og afvisning af dobbelte fakturanumre. Den erstatter ikke en test hos Sproom.

## Go-live-spærring

Produktionsskift kræver brugerens særskilte godkendelse efter en dokumenteret staging-rapport, fungerende backup/gendannelse og afklaret Sproom/validator-/ERP-routing. Indtil da: ingen produktionsnøgler, ingen Sproom-webhook-ompegning, ingen registrering af rigtige CVR-profiler og ingen offentlig lancering.

## Aktuelle uafklarede forhold

- Sproom-produktionsadgang, rigtige credentials, validator og objektlager er ikke sat op i dette workspace.
- Kundevendt onboarding/valg af primær modtager og distribution til andre programmer eller eksternt ERP er ikke fuldt implementeret.
- SmartRegnskabs ældre direkte Sproom-flow er ikke migreret til den fælles gateway. En planlagt dataflytning og parallel-løbsanalyse er nødvendig.
- Historiske SmartRegnskab-dokumenter forbliver i den gamle database. Cutover-kontrollen er implementeret, men den kan først køres mod de faktiske databaser i det rette driftsmiljø. Automatisk flytning er bevidst ikke udført uden en gennemgået bevarings- og dubletplan.
- Automatiske AI-ændringer af priser og automatisk bogføring er ikke en del af EDI-gatewayen; de kræver separate sikkerheds- og godkendelsesregler.

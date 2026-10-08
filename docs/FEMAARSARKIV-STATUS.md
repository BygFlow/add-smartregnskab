# Femårsarkiv – teknisk status 8. oktober 2026

Dette er en driftsstatus, ikke en erklæring om lovlig eller registreret drift.

## Krav, som arkivløsningen skal bevise

Erhvervsstyrelsens vejledning til udbydere af digitale standardbogføringssystemer beskriver opbevaring af bogførte transaktioner og digitale bilag i fem år fra udgangen af det regnskabsår, materialet vedrører. Vejledningen om ikke-registrerede systemer beskriver mindst ugentlig fuld sikkerhedskopi af disse data hos tredjepart, medmindre der ikke er bogført siden sidste kopi. Se:

- https://erhvervsstyrelsen.dk/vejledning-vejledning-til-udbydere-af-digitale-standard-bogfoeringssystemer
- https://erhvervsstyrelsen.dk/ikke-registrerede-digitale-bogfoeringssystemer

Kravet kan ikke bevises med almindelige rullende driftsbackups alene.

## Hvad der findes lokalt

- Særskilt arkiv-bucket og klientkryptering er konfigurerbare; Object Lock, objektversion, retention og SHA-256 kan kontrolleres ved upload og læsning.
- Et **manuelt**, virksomhedsspecifikt årsudtræk kan hente posteringer, fakturaer, kreditnotaer, bankposter, momsperioder, periodeafslutninger, e-fakturakø, arkivposter, udlæg med kvitteringsbilleder, bilagsrækker og tilknyttede originale bilagsfiler. Det medtager nu også filobjekter kategoriseret som bilag, hvis originalfilen er uploadet gennem den virksomhedsafgrænsede filservice og består checksumkontrol. Manglende originaler, en fil fra en anden virksomhed, forkert regnskabsår eller en arkivpost med en endnu ikke understøttet ekstern fil stopper kørslen.
- Udtrækket kan læses tilbage og kontrolleres for format, virksomhed, relationer og filhashes. En særskilt, læsende kontrol af en faktisk kvittering er bygget som `npm run archive:verify` med `DATABASE_PATH` og `ARCHIVE_RECEIPT_ID`; den kræver arkivets S3- og krypteringsmiljøvariabler og er endnu ikke kørt mod produktion.
- Filhåndteringens lokale upload-flow gemmer nu selve PDF-/billedfilen med en virksomhedsafgrænset nøgle og SHA-256; download kontrollerer checksum. Nye filversioner uploades ligeledes som separate originalfiler, og årsudtrækket medtager versionerne for bogføringsbilag. Ældre registreringer uden originalfil eller med opdigtede `/storage/`-stier genskabes ikke af denne ændring.
- Årsudtrækket og gendannelseskontrollen afviser nu journal-linjer, hvis deres eget virksomheds-ID ikke stemmer med den eksporterede virksomheds ID; dette er dækket af regressionstest. Kontrollen beviser ikke i sig selv, at alle bilags- og posteringstyper er kortlagt.
- Et bilag, som blev modtaget i et tidligere regnskabsår og senere knyttet til en postering eller et bilag i det aktuelle år, medtages også i det senere års udtræk. En test kontrollerer både grænseåret og virksomhedsadskillelsen. Dette er stadig ikke en fuld kortlægning af alle mulige dokumentrelationer.
- Tilknyttede linjer og bilag hentes nu i afgrænsede SQL-batches, så et år med mere end 900 posteringer ikke rammer SQLite-parametergrænsen. Sammen med det segmenterede format undgår det de tidligere faste årsgrænser.
- Det nye årsudtræk skriver tabeller og originalfiler som en kanonisk NDJSON-strøm, opdelt i individuelt krypterede og Compliance-låste objektversioner. Et låst manifest skrives sidst. Gendannelseskontrollen gennemgår delene i rækkefølge og kontrollerer tabelrelationer, hver originalfils SHA-256 samt samlet byteantal og kildehash uden at samle hele regnskabsåret i hukommelsen. Tests afviser manglende, ombyttede og ændrede dele og gennemfører et syntetisk udtræk med over 100 MB originalfiler.
- Det manuelle produktionsscript og det standard-lukkede ugejob er koblet til det segmenterede format. Kvitteringsledgeren gemmer kildehash og manifestkvittering; læsekontrollen understøtter både nye manifestkvitteringer og gamle enkeltobjekt-kvitteringer. **Formatet er stadig ikke aktiveret eller prøvet mod den faktiske produktions-bucket og reelle produktionsdata.**
- Et ugentligt job og en separat kvitteringstabel er kodet. Jobbet udvælger nu alle regnskabsår med daterede arkivkilder, også tidligere år med efterfølgende rettelser. Det sammenligner SHA-256 af årsudtrækkets faktiske indhold med seneste kvittering og springer kun uændrede udtræk over; en rettelse kan derfor arkiveres ved næste kørsel, selv inden for syv dage. Det er lukket som standard og må først aktiveres med `BOOKKEEPING_ARCHIVE_WEEKLY_ENABLED=YES`, efter fuld datadækning og en produktionsgendannelsestest er godkendt. Hver fejl registreres i systemets sundhedsstatus.
- Test med syntetiske data passerer. Ingen test med reelle produktionsdata er dokumenteret.

## Åbne porte før produktionspåstand

1. Gennemgå alle veje, der opretter eller ændrer bogførte transaktioner og digitale købs-/salgsbilag. Dokumentér, hvilke tabeller og filer der er omfattet. Det nuværende udtræk er **ikke** bekræftet som fuldstændigt.
   Den nuværende eksport læser originalfiler fra `document_inbox`, vedhæftninger knyttet til `expense_reports.receipt_image` og `file_objects` kategoriseret som `bilag` med deres filversioner; øvrige vedhæftninger skal kortlægges, hvis de er bogføringsbilag. Ældre filobjekter uden faktisk originalfil, filversioner med uverificerede stier og `archive_records.archive_path` stopper eksporten. Det nye segmentformat fjerner årsgrænsen på 100/150 MB, men afviser fortsat en enkelt originalfil over 64 MB som en bevidst sikkerhedsgrænse; de nuværende uploadflows har lavere filgrænser.
2. Verificér, at det ugentlige job faktisk giver en **fuld** kopi, inklusive ophørte kundeforhold og efterfølgende rettelser, uden at sammenblande virksomheder. Test genkørsel og alarmer i produktion, før aktivering.
3. Gem verificerbare kvitteringer og udfør en isoleret gendannelsestest med reelle produktionsdata, hvor de originale transaktioner og bilag kan udleveres læsbart.
4. Kontroller Hetzner-bucketens Object Lock, krypteringsnøglens beredskab, retention, adgangsrettigheder og databehandlerforhold i den faktiske produktion.
5. Pro og Clean skal vurderes særskilt: deres eksisterende driftsbackups er ikke dokumentation for femårigt bogføringsarkiv. For kunder med eksternt regnskab skal rolle- og ansvarsfordelingen bekræftes; for kunder uden ekstern løsning skal egne udstedte fakturaer og bilag dækkes.

Indtil alle porte er bestået, skal driftsklarhed vise **ikke klar** for femårsarkivet. Ingen manuel eller automatisk arkivering bør aktiveres for alle kunder ud fra en syntetisk test alene.

## Kontrol 8. oktober 2026

TypeScript-kontrol, produktionsbygning og den samlede lokale verifikation med 79 tests bestod. Den lokale release-kontrol viser teknisk kodeklarhed, men **ikke** klarhed til registreret drift: den kan ikke verificere Render-miljøvariabler og mangler stadig en dokumenteret gendannelse af reelle produktionsdata. De beståede tests må ikke omtales som bevis for femårig opbevaring eller komplet backup.

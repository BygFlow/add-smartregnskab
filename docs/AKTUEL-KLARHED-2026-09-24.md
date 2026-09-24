# ADD SmartRegnskab – aktuel klarhed (24. september 2026)

Dette er en status over det, der kan verificeres i kodebasen. Den er ikke en godkendelse til almindelig kundedrift eller offentlig lancering.

## Verificeret lokalt

- Typekontrol, produktionsbuild og alle automatiske tests består (`npm run verify`).
- Den statiske, interne sikkerhedskontrol består (`npm run security:check`). Den erstatter ikke en uvildig sikkerhedstest.
- Release-kontrollen accepterer nu korrekt Clean som et separat produkt i ADD Connect. Den rapporterer `readyForTechnicalRelease: true` og `readyForRegisteredOperation: false`.
- Bilagsindbakken har automatiske tests for individuelle virksomhedsadresser, afvisning af ukendte modtagere, dubletbeskyttelse og godkendelse før bogføring. Disse tests beviser ikke levering fra en virkelig leverandørmail i produktionsmiljøet.

## Åbne verificeringer før almindelig kundedrift

| Område | Krævet bevis | Bemærkning |
| --- | --- | --- |
| Sproom/NemHandel/Peppol | Underskrevet ISV-aftale, produktionsadgang og test af både afsendelse og modtagelse | At kontrakten er sendt til underskrift er ikke det samme som aktiveret adgang. |
| Mastercard/AiiA | Bekræftet produktionsadgang, produktionsnøgler og samtykkeflow testet ende til ende | Sidst delte leverandørstatus var, at ansøgningen behandles. |
| Clearhaus/QuickPay | Godkendt indløsningsaftale, aktiv betalingsopsætning og test af abonnement/callback/refusion | Indsendt ansøgning og tests i kode er ikke en produktionsgodkendelse. |
| Ekstern backup | Gendannelse af en krypteret ekstern backup i isoleret miljø med dokumenteret resultat | En konfigureret bucket eller backupplan er ikke et restore-bevis. |
| Jura og registrering | Faglig gennemgang af vilkår, persondata og relevant registreringsbekræftelse | Dokumentudkast og tjeklister alene er ikke godkendelse. |
| Sikkerhed | Uvildig sikkerhedstest og lukning af kritiske fund | Den interne statiske kontrol er kun en delkontrol. |
| Pilot | Dokumenteret accepttest af faktura, bilag, bogføring, bank, adgang og eksport med ejerens sign-off | Skal ske med kontrollerede testdata og uden at blande kunders regnskaber. |
| Mail til bilagsindbakke | Reelt ende-til-ende-test fra virksomhedens leverandørmail til netop dens egen indbakke | Må ikke åbnes generelt, før routing og adgang er verificeret. |

Release-scriptets lokale kontrol af manglende miljøvariabler siger kun noget om den maskine, hvor kommandoen køres. Produktionskonfiguration skal kontrolleres særskilt uden at udskrive hemmeligheder.

## Beslutninger, der stadig tilhører ejeren

- Godkend den endelige offentlige hjemmeside og pakkebeskrivelser, før den lanceres eller annonceres.
- Godkend almindelig kundedrift, automatisering og eventuelle betalings-/leverandøraftaler, når beviserne ovenfor foreligger.
- Flyt Simply-kontoen og domænet fra ADD Group ApS til ADD SmartDrift ApS senere som en særskilt administrativ ændring; en sådan overførsel er ikke udført her.

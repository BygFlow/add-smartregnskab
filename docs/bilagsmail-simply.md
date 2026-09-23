# Bilagsmail via Simply.com

## Status

- `bilag-system@addsmartregnskab.dk` er en dedikeret teknisk postkasse. Testvideresendelse fra `bilag-test@addsmartregnskab.dk` til postkassen er bekræftet.
- Webhook, selskabsspecifikke adresser, filopbevaring og en IMAP-bro findes i koden. Render-jobbet `add-smartregnskab-bilagsmail` blev oprettet 2026-09-23; første manuelle kørsel sluttede uden fejl. Det beviser endnu ikke levering af et bilag fra en selskabsspecifik adresse.
- En isoleret lokal test med to fiktive virksomheder bekræfter korrekt selskabsadskillelse, afvisning af ukendt modtager, ingen dublet ved genforsøg og ingen automatisk bogføring af mailbilaget. Dette er ikke en produktionsmailtest.
- `DOCUMENT_INBOUND_READY` skal være `false`, indtil automatisk polling, routing og en ende-til-ende-test er verificeret. Vis ikke selskabsadresserne for kunder før dette.
- Til en kontrolleret pilot kan `DOCUMENT_INBOUND_TEST_COMPANY_ID` sættes til **én** testvirksomheds interne id. Kun dens leder kan da se den tokenbaserede adresse i bilagsindbakken med en tydelig testadvarsel. Flaget åbner ikke adressen for andre virksomheder og ændrer ikke `DOCUMENT_INBOUND_READY`.
- Catch-all på hoveddomænet er ikke aktiveret og må ikke aktiveres som genvej. Den eksisterende testvideresendelse dækker kun én fast adresse; nye selskabsadresser leveres ikke automatisk til postkassen.

## Sikker driftsopsætning

1. Deploy appkode og databasemigrationer. Bekræft at appen starter og at eksisterende selskaber og bilag kan læses.
2. Vælg en dokumenteret routing for adresser på formen `bilag-<selskabstoken>@<domæne>` til maskinpostkassen. Simply.coms [API til videresendelser](https://api.simply.com/2/doc/) kan oprette én regel per selskab, men det kræver separat beslutning om API-adgang, fejlhåndtering og fjernelse af regler, når et selskab ophører. Et særskilt modtagedomæne eller en leverandør med inbound-webhook er også muligt. Hvis routing kræver catch-all, skal risiko og domæneafgrænsning godkendes særskilt. Brug ikke testaliaset som om det var en individuel selskabsadresse.
3. Opret en separat periodisk jobtjeneste, der kører `npm run mail:poll:simply`. IMAP-scriptet kører kun én gang per start; det er ikke en permanent proces. Jobbet kræver Node.js, projektets installerede afhængigheder og udgående HTTPS/IMAPS.
4. Sæt `DOCUMENT_INBOUND_DOMAIN` og en stærk, tilfældig `DOCUMENT_INBOUND_WEBHOOK_SECRET` på appen. Sæt samme domæne og hemmelighed samt `DOCUMENT_INBOUND_API_URL=https://app.addsmartregnskab.dk`, `SIMPLY_DOCUMENT_IMAP_USER=bilag-system@addsmartregnskab.dk` og `SIMPLY_DOCUMENT_IMAP_PASSWORD` på jobbet. Brug hemmelige miljøvariabler; læg aldrig adgangskode eller webhook-hemmelighed i Git, logs eller chat.
5. Hold `DOCUMENT_INBOUND_READY=false`, mens testen udføres. Sæt pilot-id'et til testvirksomhedens id, og opret hos Simply én videresendelse fra netop dens viste tokenadresse til maskinpostkassen. Send en ufarlig PDF med entydigt testindhold. Bekræft i appens bilagsindbakke, at filen lander hos det rigtige selskab, og at en gentagen IMAP-kørsel ikke opretter en dublet.
6. Bekræft at mailbilaget **ikke** autobogføres, og at en bruger hos virksomheden kan gennemse og godkende det. Bekræft også at ugyldig signatur, forkert modtager og for store filer afvises.
7. Først når routing virker for **nye** selskaber uden manuelle ad hoc-regler, sættes `DOCUMENT_INBOUND_READY=true`. Overvåg fejlede jobkørsler og mails, der forbliver ulæste i maskinpostkassen.

## Afgrænsning

IMAP-broen læser kun ulæste mails og accepterer PDF eller understøttede billeder på højst 7 MB. Beskeder uden præcis én gyldig selskabsadresse eller et understøttet bilag bliver liggende ulæste til kontrol. Et accepteret bilag markeres først læst, når appen har bekræftet modtagelsen. E-mailafsender er ikke identitetsbevis; derfor skal mailbilag altid godkendes af virksomheden før bogføring.

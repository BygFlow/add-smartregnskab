# Clearhaus – svar og testadgang (25. september 2026)

Status: Klargøring, ikke en indsendt eller godkendt ansøgning. Del aldrig en almindelig administratoradgang eller rigtige kundedata med testbrugeren.

## Bekræftede oplysninger

- Faktisk månedlig abonnementsomsætning i dag: **0 kr.** (oplyst af ejeren 25. september 2026).
- Testadresse: `clearhaus-test@addsmartregnskab.dk` (godkendt af ejeren). Den er 25. september oprettet som videresendelse hos Simply til `admin@addsmartregnskab.dk` og ses på listen over videresendelser. En faktisk leveringstest er endnu ikke gennemført. Adressen må kun bruges til et særskilt, tomt testfirma.
- Hjemmesiden har en særskilt side med abonnementsbetingelser, og købsflowet har en særskilt, ikke-forudafkrydset accept med link til siden.
- Lokal kodeændring sikrer, at abonnementsbetingelserne også kan åbnes, mens testbrugeren er logget ind. Ændringen skal være deployeret og verificeret på den offentlige URL, før det meddeles Clearhaus som færdigt.
- Ved visuel kontrol af den nuværende produktionsapp stod QuickPay som manglende, og knappen til betalingsaftale var deaktiveret. Det er ikke et færdigt betalingsflow.

## Skal afklares før ansøgningen sendes retur

1. Verificér levering til den oprettede interne videresendelse fra en anden afsender end modtagerkontoen.
2. Opret et isoleret testfirma med testbrugeren. Brugeren vælger selv adgangskode; ingen eksisterende kundedata eller betalingskort må knyttes til kontoen.
3. Bekræft at testbrugeren kan se pakker, abonnementsoverblik, almindelige handelsvilkår og de særskilte abonnementsbetingelser.
4. Få ejerens realistiske forventning til omsætningsandel fordelt på månedlige, kvartalsvise, halvårlige og årlige abonnementer. Skriv ikke opdigtede procenttal ved 0 kr. faktisk omsætning.
5. Oplys forventet kundeforhold/opsigelsestid som estimat, eller oplys tydeligt, at der endnu ikke er historik.
6. Afklar med Clearhaus hvordan de ønsker at teste betalingsdelen, mens QuickPay-indløsning endnu ikke er aktiveret. Undlad en virkelig betaling for at opfylde testen.
7. Endelige abonnements- og handelsvilkår skal gennemgås af relevant juridisk rådgiver og godkendes af ejeren.

## Svarudkast – først efter ovenstående er klart

> Hej Mathias
>
> Tak for tilbagemeldingen. Den faktiske månedlige abonnementsomsætning er aktuelt 0 kr., da tjenesten endnu ikke har betalende kunder. Fremtidige tal beskrives derfor som estimater og ikke som historisk omsætning.
>
> Den forventede andel fra abonnementer er [ejerens svar]. Forventet fordeling mellem månedlige, kvartalsvise, halvårlige og årlige abonnementer er [ejerens svar eller tydelig oplysning om manglende historik]. Den forventede varighed af et kundeforhold er [ejerens svar eller tydelig oplysning om manglende historik].
>
> Der er en særskilt, obligatorisk afkrydsning med link til abonnementsbetingelserne i købsflowet: https://app.addsmartregnskab.dk/#/abonnementsbetingelser . De almindelige vilkår findes på https://app.addsmartregnskab.dk/#/vilkaar .
>
> Et isoleret test-login kan deles via en sikker kanal, når testkontoen og de offentlige sider er verificeret. Vi sender ikke adgangskoden i denne e-mail. Betalingsdelen er [bekræftet teststatus efter afklaring med Clearhaus].
>
> Med venlig hilsen
> Aurel Dan

Udkastet er ikke afsendt. Udfyld ikke parenteserne uden ejerens svar.

# Release 3.16.3 — endelige fakturaer via ADD Connect

Dato: 27. oktober 2026
Produkt: ADD SmartRegnskab
Udbyder: ADD SmartDrift ApS, CVR 46761898

## Leverance

- ADD Connect skelner nu mellem fakturakladder og udstedte fakturaer.
- En kladde gemmes fortsat som kladde og danner ingen postering.
- En udstedt faktura fra ADD SmartDrift Pro, ADD SmartDrift Clean eller et
  andet tilsluttet system bogføres automatisk med samme fakturanummer.
- Bogføringen debiterer debitor, krediterer omsætning og krediterer udgående
  moms i én databasetransaktion.
- Gentagen levering med samme kilde-id er idempotent og danner ikke dubletter.
- Økonomiske felter på en allerede bogført faktura kan ikke ændres gennem en
  senere synkronisering.
- Ukendte statusværdier og fakturaer med uoverensstemmende linjer, beløb eller
  momstal afvises.

## Gennemførte kontroller

- TypeScript-kontrol: bestået.
- Målrettet integrationstest for kladde, udstedelse, genlevering og
  ændringsbeskyttelse: bestået.
- Den samlede releaseverifikation køres før produktionsudrulning.

## Relaterede beviser

- SAF-T 2.1-XSD og Object Lock-beviset fra release 3.16.2 bevares som
  historiske, versionsbundne driftsbeviser.
- Clearhaus-produktionsaftalen er bekræftet af virksomhedens ejer 27. oktober
  2026 og dokumenteret særskilt.

## Åbne eksterne driftsbeviser

Følgende kræver virkelige eksterne data eller tredjepartsbehandling og må ikke
markeres som gennemført på grundlag af kode alene:

- kontrolleret QuickPay-opkrævning, webhook og refundering;
- Sproom/NemHandel-test med en separat virkelig kundevirksomhed og samtykke;
- første AiiA-produktionsforbindelse med en virkelig bankkonto;
- isoleret gendannelse af repræsentative bogføringsdata for en rigtig
  virksomhed og et afsluttet regnskabsår;
- uvildig sikkerhedstest, juridisk fagkontrol og myndighedsregistrering.

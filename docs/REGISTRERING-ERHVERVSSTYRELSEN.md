# Registreringspakke — ADD SmartRegnskab

Status: teknisk bevispakke under færdiggørelse pr. 17. oktober 2026.
Dokumentet er ikke en myndighedsgodkendelse.

## Produkt og udbyder

- Produkt: ADD SmartRegnskab
- Produktionsadresse: https://app.addsmartregnskab.dk
- Udbyder: ADD SmartDrift ApS
- CVR: 46761898
- Adresse: Lynæs Søpark 49, 3390 Hundested
- Kontakt: Aurel Dan, regnskab@addsmartregnskab.dk, +45 42 75 13 41
- Systemtype: Cloudbaseret standardbogføringssystem
- Versionsstyring: Git, automatiseret CI og versionsstyrede databasemigrationer

Kontakt- og virksomhedsoplysninger skal kontrolleres mod CVR-registeret umiddelbart
før anmeldelsen.

## Teknisk kravkort

| Kravområde | Implementering | Dokumentation/test |
| --- | --- | --- |
| Registrerings- og kontrolspor | Posteringer har dato, fortløbende virksomhedsunik post-ID, opretter og oprettelsesdato. Bogførte posteringer kan ikke ændres eller slettes; fejl rettes ved tilbageførsel. | API-test af låsning, tilbageførsel og virksomhedsadskillelse. |
| Debet/kredit | En postering kan kun bogføres, når mindst to linjer balancerer inden for 0,005 kr. | Automatiseret test med balanceret og ubalanceret postering. |
| Bilag | Bilag tilhører én virksomhed. Bogførte bilag er låst. | Adgangs- og uforanderlighedstest. |
| SAF-T | Import, forhåndskontrol og eksport af dansk SAF-T 2.1. Standardkontoplanversion `20260101`. | Roundtrip-test og officiel XSD-validering er bestået og gemt for release 3.16.2. |
| Kontoplan | Hver lokal konto kan mappes til `standardAccountNumber`. | Rapport over ikke-mappede konti i SAF-T-klarhedskontrollen. |
| Backup | Konsistent SQLite-backup, `quick_check`, SHA-256, krypteret S3-upload og downloadbaseret gendannelseskontrol. | Dagligt job samt dokumenteret restore-øvelse. |
| Adgangskontrol | Tenant-filtrering, rollebaseret adgang, stærke adgangskoder, loginlås og TOTP. | Produktionstest og ekstern penetrationstest. |
| Hændelseslog | Væsentlige handlinger logges med bruger, tidspunkt og virksomhed. | Revisionspakke og stikprøvetest. |
| E-fakturering | OIOUBL 2.1/Peppol BIS 3-generering, kø, fail-closed afsendelse, signeret indgående webhook og revisionsspor er implementeret. Sproom-masteraftale, token, child-company-flow og stagingtest er gennemført. | Rigtig produktionsprøve med separat kunde, send/modtag, kreditnota, afvisning og kvittering mangler. |
| Bankafstemning | Filimport og afstemningsstatus findes. Direkte bankfeed kræver leverandøraftale. | Test af synlige differencer og afstemningsspor. |

## Før anmeldelse

1. Gennemfør den resterende NemHandel/Peppol-produktionsprøve med afsendelse,
   modtagelse, kreditnota, afvisning og application response.
2. Indsæt korrekte virksomhedsoplysninger og få privatlivspolitik,
   databehandleraftale, abonnementsvilkår og underdatabehandlerliste godkendt.
3. Gem bevis for Object Lock-retention og gennemfør en dokumenteret restore-
   øvelse fra den eksterne kopi i et isoleret miljø.
4. Vedlæg den gemte SAF-T 2.1-XSD-validering og den syntetiske eksport fra release 3.16.2.
5. Bestil uvildig sikkerhedstest og luk alle fund med høj eller kritisk risiko.
6. Udarbejd produktbeskrivelse, systemarkitektur, ændringsstyring,
   hændelsesberedskab, driftsaftale og supportprocedure.
7. Indsend anmeldelsen via Virk og afvent Erhvervsstyrelsens registrering, før
   produktet markedsføres som et registreret bogføringssystem.

## Kommende krav 2027–2028

- SAF-T 2.1 fra 1. januar 2027 er implementeret og automatisk testet.
- MitID-validering, stamdata-lås, løbende CVR-validering, automatisk
  NemHandel-tilmelding og prioriteret e-faktura fra 1. marts 2027 kræver en
  særskilt leverandør- og produktionsimplementering.
- MitID-validering ved ændring af supplerende stamdata fra 1. januar 2028 skal
  indgå i samme identitets- og revisionsspor.

## Release-regel

Ingen release må beskrives som "lovgodkendt", "registreret" eller "100 %
automatisk revisor", før der foreligger dokumentation fra den relevante
myndighed eller fagperson. AI-forslag skal vise grundlag, sikkerhedsniveau og
eventuelt godkendelseskrav.

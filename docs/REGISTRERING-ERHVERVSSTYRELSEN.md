# Registreringspakke — ADD SmartRegnskab

Status: teknisk forberedelse. Dokumentet er ikke en myndighedsgodkendelse.

## Produkt og udbyder

- Produkt: ADD SmartRegnskab
- Produktionsadresse: https://app.addsmartregnskab.dk
- Udbyder: ADD MultiService ApS
- CVR: 44822539
- Adresse: Lynæs Søpark 49, 3390 Hundested
- Kontakt: regnskab@addsmartregnskab.dk
- Versionsstyring: Git, automatiseret CI og versionsstyrede databasemigrationer

Telefon, ansvarlige personer og endelige supportvilkår skal indsættes i
anmeldelsen og de juridiske tekster.

## Teknisk kravkort

| Kravområde | Implementering | Dokumentation/test |
| --- | --- | --- |
| Registrerings- og kontrolspor | Posteringer har dato, fortløbende virksomhedsunik post-ID, opretter og oprettelsesdato. Bogførte posteringer kan ikke ændres eller slettes; fejl rettes ved tilbageførsel. | API-test af låsning, tilbageførsel og virksomhedsadskillelse. |
| Debet/kredit | En postering kan kun bogføres, når mindst to linjer balancerer inden for 0,005 kr. | Automatiseret test med balanceret og ubalanceret postering. |
| Bilag | Bilag tilhører én virksomhed. Bogførte bilag er låst. | Adgangs- og uforanderlighedstest. |
| SAF-T | Import, forhåndskontrol og eksport af dansk SAF-T 2.1. Standardkontoplanversion `20260101`. | Roundtrip-test og validering mod Erhvervsstyrelsens XSD skal gemmes som releaseartefakt. |
| Kontoplan | Hver lokal konto kan mappes til `standardAccountNumber`. | Rapport over ikke-mappede konti i SAF-T-klarhedskontrollen. |
| Backup | Konsistent SQLite-backup, `quick_check`, SHA-256, krypteret S3-upload og downloadbaseret gendannelseskontrol. | Dagligt job samt dokumenteret restore-øvelse. |
| Adgangskontrol | Tenant-filtrering, rollebaseret adgang, stærke adgangskoder, loginlås og TOTP. | Produktionstest og ekstern penetrationstest. |
| Hændelseslog | Væsentlige handlinger logges med bruger, tidspunkt og virksomhed. | Revisionspakke og stikprøvetest. |
| E-fakturering | OIOUBL 2.1/Peppol BIS 3-generering, kø, fail-closed afsendelse, signeret indgående webhook og revisionsspor er implementeret. | Access-point-aftale, officiel validering, kreditnota/svarmeddelelser og ende-til-ende-test mangler. |
| Bankafstemning | Filimport og afstemningsstatus findes. Direkte bankfeed kræver leverandøraftale. | Test af synlige differencer og afstemningsspor. |

## Før anmeldelse

1. Indgå NemHandel/Peppol-aftale og gennemfør ende-til-ende-test af afsendelse,
   modtagelse, kreditnota og application response.
2. Indsæt korrekte virksomhedsoplysninger og få privatlivspolitik,
   databehandleraftale, abonnementsvilkår og underdatabehandlerliste godkendt.
3. Konfigurér ekstern backup med versionering/Object Lock og gennemfør en
   dokumenteret restore-øvelse i et isoleret miljø.
4. Validér SAF-T-eksempelfiler mod myndighedens seneste XSD og gem resultatet.
5. Bestil uvildig sikkerhedstest og luk alle fund med høj eller kritisk risiko.
6. Udarbejd produktbeskrivelse, systemarkitektur, ændringsstyring,
   hændelsesberedskab, driftsaftale og supportprocedure.
7. Indsend anmeldelsen via Virk og afvent Erhvervsstyrelsens registrering, før
   produktet markedsføres som et registreret bogføringssystem.

## Release-regel

Ingen release må beskrives som "lovgodkendt", "registreret" eller "100 %
automatisk revisor", før der foreligger dokumentation fra den relevante
myndighed eller fagperson. AI-forslag skal vise grundlag, sikkerhedsniveau og
eventuelt godkendelseskrav.

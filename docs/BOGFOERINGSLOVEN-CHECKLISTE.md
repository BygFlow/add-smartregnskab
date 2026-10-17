# Bogføringslovens krav — kontrol- og bevisoversigt

Status: 17. oktober 2026
Produkt: ADD SmartRegnskab 3.16.2
Udbyder: ADD SmartDrift ApS, CVR 46761898

Dokumentet er en teknisk sporbarhedsmatrice til anmeldelsen af et digitalt
standardbogføringssystem. Det er ikke en juridisk godkendelse.

## Gældende krav

| Kravområde | Implementering | Automatisk bevis | Eksternt bevis før anmeldelse |
| --- | --- | --- | --- |
| Virksomhedsadskillelse | Alle regnskabsdata er knyttet til virksomhed/tenant, og serveren håndhæver virksomhedsfilter og roller. | Produktions-smoke, adgangsmatrice og tenant-isolationstest. | Stikprøve med to adskilte testvirksomheder. |
| Registreringer | Posteringer har dato, bilagsreference, fortløbende virksomhedsunik reference, beskrivelse og opretter. | Bogførings-, validerings- og API-tests. | Revisorstikprøve af repræsentativ journal. |
| Debet/kredit | Bogføring afvises, hvis linjerne ikke balancerer inden for systemets afrundingstolerance. | Test af balanceret og ubalanceret postering. | Gem testudskrift i myndighedspakken. |
| Uforanderlighed | Bogførte poster og tilknyttede bilag ændres ikke direkte; fejl rettes gennem dokumenteret korrektion/tilbageførsel. | Låsnings-, tilbageførsels- og revisionssporstest. | Stikprøve af korrektion og kreditnota. |
| Bilag | Originalfiler gemmes tenant-isoleret og knyttes til den relevante registrering. | Filadgangs-, upload- og bilagsindbakketest. | Kontrolleret upload/download af repræsentative formater. |
| Femårig opbevaring | Krypteret ekstern backup og særskilt arkivflow med retention er implementeret. | Backup-, integritets- og restore-tests samt bestået syntetisk produktionsprøve med Compliance-retention til 31. december 2031. | Gennemfør isoleret gendannelse af repræsentative rigtige bogføringsdata og originalbilag. |
| Sikkerhedskopi | Konsistent databasekopi, SHA-256, SQLite-kontrol, AES-256-GCM og ekstern S3-kompatibel kopi. | Daglig jobstatus og restore-drill. | Arkivér seneste succeslog og leverandørkonfiguration uden hemmeligheder. |
| Adgangskontrol | Rollebaseret adgang, stærke adgangskoder, loginlås, sessionskontrol og TOTP-understøttelse. | Sikkerheds- og adgangsmatricetests. | Uafhængig sikkerhedstest og dokumenteret adgangsreview. |
| Kontrolspor | Væsentlige bruger-, bogførings-, integrations- og administrationshandlinger logges. Klienter kan ikke ændre sikkerhedsloggen. | Revisionsspor- og API-mutationstests. | Eksportér et anonymiseret eksempel til myndighedspakken. |
| Dataudtræk | SAF-T 2.1, almindelige rapporter og relevante CSV/JSON-udtræk findes. | SAF-T roundtrip, produktions-smoke og bestået officiel XSD-validering for release 3.16.2. | Vedlæg den maskerede valideringsrapport og syntetiske eksport. |
| E-fakturering | OIOUBL og Peppol BIS, kreditnota, svar, modtageropslag, idempotens og signeret webhook er implementeret gennem Sproom. | Adapter-, webhook-, child-company- og stagingtests. | Rigtig produktionsprøve med send, modtag, kreditnota, afvisning og kvittering. |
| Drift og hændelser | Helbredstjek, driftsalarmer, køer, retry, backupstatus og hændelsesprocedure er dokumenteret. | Produktions-readiness og driftskontrol. | Gennemfør og referér en bordøvelse for hændelseshåndtering. |

## Kommende krav

Erhvervsstyrelsens vejledning, opdateret 5. oktober 2026, beskriver følgende
kommende frister:

- **1. januar 2027:** SAF-T version 2.1. ADD SmartRegnskab eksporterer allerede
  version 2.1 og bruger standardkontoplanversion `20260101`.
- **1. marts 2027:** MitID-validering og låsning af slutkundens stamdata,
  løbende CVR-validering, automatisk NemHandel-tilmelding med
  fravalg/information samt prioriteret visning af e-faktura.
- **1. januar 2028:** MitID-validering ved ændring af supplerende stamdata.

MitID-valideringen må ikke markeres færdig, før en konkret MitID
Erhverv-leverandør, fuldmagt, samtykketekst, revisionsspor og produktionsprøve
er på plads. Sproom-onboardingen og NemHandel-låsen er implementeret, men den
første rigtige kundeprøve skal gennemføres, før automatisk registrering åbnes.

## Bevisregel

Hvert punkt i anmeldelsen skal pege på mindst ét versionsstyret dokument og ét
reproducerbart test- eller driftsbevis. Hemmelige nøgler, kundedata og private
bilag må ikke vedlægges; anvend maskerede konfigurationsoversigter og
syntetiske eller anonymiserede eksempler.

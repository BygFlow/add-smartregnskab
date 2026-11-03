# Produktionsbevis: rigtigt bilag, femårsarkiv og gendannelse — 3. november 2026

Produkt: ADD SmartRegnskab 3.16.4  
Miljø: Produktion  
Udbyder: ADD SmartDrift ApS, CVR 46761898

Dette dokument beskriver en kontrolleret arkivering fra den seneste
krypterede, eksterne produktionsbackup. Loggen indeholder kun virksomheds-ID,
hashes og antal. Virksomhedsnavne, beløb og dokumentindhold er ikke udskrevet.

## Udrulning og kontrol

- Produktionscommit: `8505407583b25b5d11600dd2a06573a5021c5378`
- Render-deploy: `dep-dbl037dbedkc73enml9g`
- Status: `live`
- Lokale automatiske tests: 76 af 76 bestået
- `npm audit`: 0 kendte sårbarheder

Jobbet gendannede den seneste eksterne backup til en ny, midlertidig og
skrivebeskyttet SQLite-fil. Før arkivering blev backupens SHA-256 og SQLite
`quick_check` valideret. Den midlertidige fil blev slettet efter kontrollen.

## Virkelig arkivering

- Render-job: `job-dbl04cnf3r2c738362tg`
- Resultat: `succeeded`
- Virksomheds-ID: `4`
- Regnskabsårsstart: `2026-01-01`
- Arkivmanifest:
  `companies/4/fiscal-years/2026-01-01/real-data/e610dde8-57f9-4d4a-9593-31ebe6649b32/manifest-f6900b71-c2ef-4acc-abc3-e8cfab2ee0d6.json`
- Objektversion modtaget: ja
- Gendannelseskontrol: `verified=true`
- Originalfiler: `1`
- Datamængde: én virksomhed, én brancheprofil, ét bilag i bilagsindbakken,
  to revisionslogposter og fire fristposter
- Bogførte posteringer: `0`
- Fakturaer: `0`

Arkivet blev skrevet krypteret og versionsbestemt til den særskilte
Object Lock-bucket med `COMPLIANCE`-retention til udgangen af femårsfristen.
Det konkrete manifest og alle dele blev læst tilbage og kontrolleret byte for
byte, før jobbet fik status `succeeded`.

## Skrivebeskyttet dækningskontrol

- Produktionscommit: `376a8b76b9a85508f9a39689becdb40792a4186d`
- Render-deploy: `dep-dbl0749srm7s73bb9h9g`
- Render-job: `job-dbl07q15efls73frvg70`
- Resultat: `succeeded`
- Permanent arkiv oprettet af denne kontrol: nej

Kontrollen fandt, at virksomhed 4 var den eneste ikke-platformsvirksomhed med
et gemt regnskabsår i den aktuelle backup. Virksomheds-ID 2, 3, 5, 6, 7, 8
og 9 mangler regnskabsårets start. Der blev ikke udskrevet navne eller andre
virksomhedsoplysninger.

## Konklusion og afgrænsning

Prøven dokumenterer, at et rigtigt originalbilag fra en krypteret
produktionsbackup kan isoleres pr. virksomhed, arkiveres med femårig
Compliance-lås og gendannes identisk.

Den fulde myndighedsstikprøve er **ikke** afsluttet endnu, fordi den valgte
virksomhed ikke har bogførte posteringer eller fakturaer i perioden. Før dette
punkt kan markeres fuldt gennemført, skal en ansvarlig bruger:

1. angive korrekt regnskabsårsstart for den relevante virkelige virksomhed;
2. vælge en periode med mindst én bogført postering og det tilknyttede
   originalbilag; og
3. gentage den samme isolerede arkiv- og gendannelseskontrol.

Regnskabsårsstart må ikke gættes eller sættes automatisk for eksisterende
juridiske virksomheder, fordi en forkert dato ændrer både årsudtrækket og den
lovpligtige opbevaringsfrist.

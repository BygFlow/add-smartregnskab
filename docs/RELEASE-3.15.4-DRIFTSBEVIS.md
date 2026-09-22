# Release 3.15.4 — driftsbevis

Dato: 22. september 2026  
Produkt: ADD SmartRegnskab  
Udbyder: ADD SmartDrift ApS, CVR 46761898

## Gennemførte kontroller

- TypeScript-kontrol: bestået.
- Produktionsbuild: bestået.
- Automatiske tests: 19 af 19 bestået.
- Sikkerhedsselvtest: 175 filer kontrolleret, ingen fund.
- Teknisk release-readiness: bestået.
- Myndighedspakke: genereret i `artifacts/myndighedspakke-3.15.4`.

## Restore-øvelse

Den lokale, ikke-destruktive restore-øvelse blev gennemført den 22. september
2026 kl. 11.29 dansk tid.

- Database: `data.db`
- Gendannet størrelse: 913.408 bytes
- SQLite-integritet: `ok`
- Tabeller fundet: 177
- Manglende centrale tabeller: ingen
- Resultat: bestået

Øvelsen dokumenterer, at en konsistent kopi kan åbnes og valideres. Den erstatter
ikke den krævede produktionsøvelse, hvor en krypteret ekstern S3-kopi downloades
og gendannes i et isoleret miljø.

## Eksterne godkendelsesporte

Følgende må ikke markeres som afsluttet alene på baggrund af den tekniske test:

- Clearhaus-produktionsgodkendelse og aktiv QuickPay-indløseraftale.
- Underskrevet Sproom ISV-aftale, produktionsnøgler og ende-til-ende-test.
- AiiA/Mastercard Open Banking-produktionsaftale og produktionsnøgler.
- Juridisk godkendelse af vilkår, privatlivspolitik og databehandleraftale.
- Uvildig sikkerhedstest.
- Anmeldelse og registreringsbekræftelse fra Erhvervsstyrelsen.

## Offentlig adresse

Virksomhedens postadresse vises kun, hvor den er nødvendig, herunder juridiske
oplysninger, aftaledokumenter, fakturaer og myndighedsmateriale. Den er fjernet
fra generel markedsføring, kontaktvisning, footer og strukturerede produktdata.

# Fuld programgennemgang — ADD SmartRegnskab

Dato: 17. oktober 2026

## Resultat

ADD SmartRegnskab er gennemgået separat som offentlig hjemmeside, regnskabsprogram, platformadministration og mobil bilagsflade. Produktionsbuild, sikkerhedskontrol og hele den automatiske testserie er bestået.

## Rettet i denne gennemgang

- Samlet pakkevalg, tilkøb, AI og valgfrie integrationer i **Appmarked**.
- Gjort Abonnement til et rent status-, betalings-, faktura- og forbrugsoverblik.
- Kræver synlig pris og aktiv accept af abonnementsbetingelser før pakke- eller tilkøbsændringer.
- Låste moduler sender brugeren til Appmarked og ikke til en anden skjult købsside.
- Fjernet to ufærdige rolleeditorer fra brugerfladen. De beskrev regler, som serveren ikke håndhævede, og måtte derfor ikke fremstå som aktiv adgangsstyring.
- Gjort den gamle rolle-konfigurations-API skrivebeskyttet og lukket dens mutationskald med HTTP 410.
- Gjort sikkerhedsloggens API skrivebeskyttet, så en klient ikke kan oprette, redigere eller slette hændelser, der ligner serverens revisionsspor.
- Tilføjet en eksplicit allowlist til virksomhedsfaner, så skjulte eller ukendte hash-adresser ikke kan åbne ufærdige flader.

## Kontrolleret

- Menuer, ruter, samme-vindue-navigation, mobilvisning og tomme tilstande.
- Virksomhedsoplysninger, regnskabsår, moms, kontoplan, fakturaopsætning og betalingsbetingelser.
- Kunder, leverandører, bilag, særskilt bilagsmail pr. virksomhed, bogføring, faktura og kreditnota.
- Bank/AiiA, afstemning, selskabsstruktur, roller, tenant-isolation og revisionsspor.
- Pakker, abonnement, AI-forbrug, Appmarked og platformfakturering.
- Sproom parent/child, OIOUBL/Peppol-validering, idempotens og webhook-verifikation.
- Backup, originalfiler, femårsarkiv og kontrolleret gendannelseslogik.

## Verifikation

- Produktionsbuild: bestået.
- JavaScript-testserie: 56 af 56 bestået.
- TypeScript-/integration-/arkivtestserie: 75 af 75 bestået.
- Sikkerhedskontrol: 208 filer, 0 fund.
- Dependency-audit med produktionsafhængigheder: 0 kendte sårbarheder.
- `git diff --check`: bestået; kun Windows-linjeendingsadvarsler.

## Afgrænsning

Testene dokumenterer lokal kodeparathed. En rigtig AiiA-banktilslutning, fuld Sproom send/modtag/kreditnota/afvisning, endelig Clearhaus-accept, permanent Object Lock-prøve med reelle virksomhedsdata og eventuel myndighedsregistrering er særskilte produktionsbeviser.

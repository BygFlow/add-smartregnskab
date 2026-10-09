# Release 3.16.1 — driftsbevis

Dato: 9. oktober 2026
Produkt: ADD SmartRegnskab
Udbyder: ADD SmartDrift ApS, CVR 46761898

## Leverance

- Udvidet, virksomhedsspecifikt femårsarkiv for bogføringsmateriale.
- Fakturaer og kreditnotaer medtager nu de refererede kundedata og afviser manglende eller fremmede kunder.
- Løn, anlæg, betalingskørsler, årsafslutning, momsafstemning, periodisering, lager, valuta, konsolidering, bankbetalinger, revision, regnskabseksporter, kørselsbilag, skattefrister og rykkerflow indgår i årsudtrækket.
- Virksomhed og regnskabsprofil indgår i både enkeltfil- og segmentformatet.
- Arkivformat v7 og strømformat v2 kan fortsat validere de tidligere v6/v1-prøvearkiver.

## Gennemførte kontroller

- TypeScript-kontrol: bestået.
- Produktionsbuild: bestået.
- Automatiske tests: 101 deltests bestået.
- Diff-kontrol: bestået.

## Begrænsning før aktivering

Denne release udvider den tekniske dækning, men dokumenterer ikke i sig selv lovmæssig eller produktionsmæssig femårsopbevaring. Den automatiske ugearkivering forbliver deaktiveret, indtil der er udført en kontrolleret arkivering og isoleret gendannelsestest med reelle virksomhedsdata, kvittering, Object Lock-kontrol og godkendt regnskabsårsopsætning.

Clearhaus-, Sproom-, AiiA- og myndighedsgodkendelser er separate eksterne porte og dokumenteres ikke som afsluttet af denne build.

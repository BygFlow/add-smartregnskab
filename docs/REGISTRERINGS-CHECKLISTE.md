# Registreringspakke for ADD SmartRegnskab

Denne mappe forbereder den dokumentation, ADD SmartDrift ApS normalt skal bruge ved anmeldelse af ADD SmartRegnskab som digitalt standardbogføringssystem. Den er ikke en myndighedsgodkendelse.

## Produktoplysninger

- Udbyder: ADD SmartDrift ApS
- CVR: 46761898
- Adresse: Lynæs Søpark 49, 3390 Hundested
- Produkt: ADD SmartRegnskab
- Produktionsadresse: https://app.addsmartregnskab.dk
- Release: 3.16.2

## Før indsendelse

- [ ] Kontrollér umiddelbart før indsendelse, at oplysninger og kontaktperson matcher CVR-registeret.
- [x] Gennemgå funktionsbeskrivelse, dataflow og systemarkitektur.
- [x] Klargør sikkerheds-, backup-, revisionsspor- og exitbeskrivelse.
- [x] Klargør beskrivelse af elektronisk fakturering og SAF-T.
- [x] Validér en syntetisk SAF-T 2.1-eksport mod Erhvervsstyrelsens officielle XSD og gem hashes.
- [x] Vedlæg syntetisk Object Lock-bevis og identisk restore fra den faktiske produktionsbucket.
- [ ] Gennemfør og vedlæg isoleret restore af repræsentative, rigtige bogføringsdata og originalbilag.
- [x] Angiv aktuelle underdatabehandlere og kendte datalokaliteter i dokumentationen.
- [x] Kontrollér skrivebeskyttet adgang til Sprooms master-API i produktion uden at eksponere tokenet.
- [ ] Gennemfør den første rigtige Sproom/NemHandel-produktionsprøve med separat kunde.
- [ ] Bestil en uvildig sikkerheds-/penetrationstest og luk eventuelle høje eller kritiske fund.
- [ ] Fastlæg leverandør og plan for MitID- og CVR-valideringskravene fra marts 2027.
- [ ] Få dansk bogførings-/IT-revisor og juridisk rådgiver til at kontrollere materialet.
- [ ] Indsend via den aktuelle myndighedsproces og gem kvittering/sagsnummer.

## Efter indsendelse

- [ ] Registrér sagsnummer internt.
- [ ] Besvar myndighedens spørgsmål med versionsstyrede bilag.
- [ ] Markér ikke systemet som registreret, før der foreligger en udtrykkelig myndighedsbekræftelse.
- [ ] Opdatér bilagene ved væsentlige ændringer i drift, leverandører eller funktionalitet.

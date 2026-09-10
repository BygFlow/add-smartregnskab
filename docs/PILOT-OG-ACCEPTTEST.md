# Pilot- og accepttest

## Omfang

Piloten skal køres med én kontrolleret dansk virksomhed, kopier af ikke-følsomme testdata og en navngiven ansvarlig bogholder. Produktion må først bruges til lovpligtig bogføring, når alle kritiske kontroller er bestået.

## Acceptkriterier

| Område | Test | Godkendelseskriterium |
|---|---|---|
| Adgang | Leder, medarbejder og kunde | Ingen rolle kan se funktioner eller data uden for sit behov |
| Tenant-isolation | To virksomheder med overlappende id'er | Krydsadgang giver 404/403 |
| Bogføring | Kladde, balanceret postering, låsning | Kun balancerede posteringer bogføres; bogførte poster kan ikke slettes |
| Faktura | Kladde, afsendelse og kreditnota | Nummer, moms, totaler og revisionsspor er korrekte |
| Moms | Periode og afstemning | Alle differencer er forklaret og godkendt |
| E-faktura | OIOUBL/Peppol-validering | Lokal og ekstern validering består før afsendelse |
| SAF-T | Eksport og genimport | Filen validerer og debet er lig kredit |
| AI | Lav/høj risiko og manglende evidens | Betaling, skat, moms, løn, lukning og jura kræver menneske |
| Backup | Backup, checksum og restore | Gendannet database består integrity check |
| Mobil | Android-login og kerneflows | Ingen kritiske layout-, netværks- eller lagringsfejl |

## Stopkriterier

Stop piloten ved datatab, tenant-læk, forkert bogføring, ukontrolleret ekstern afsendelse, manglende revisionsspor eller uverificerbar backup. Opret hændelse, bevar logfiler og genoptag først efter rettelse og regressionstest.

## Sign-off

Dato, release, virksomhed, testansvarlig, bogholder/revisor, kendte afvigelser og beslutning dokumenteres. Sign-off er en driftsbeslutning, ikke en juridisk certificering.

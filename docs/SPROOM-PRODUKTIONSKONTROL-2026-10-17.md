# Sproom master-API — produktionskontrol 17. oktober 2026

Produkt: ADD SmartRegnskab 3.16.2  
Parent/master: ADD SmartDrift ApS, CVR 46761898  
Miljø: Produktion

## Kontrol

En skrivebeskyttet kontrol blev kørt fra SmartRegnskabs Render-produktionsmiljø
med det konfigurerede Sproom-mastertoken. Tokenet blev ikke skrevet til loggen.

- Render-job: `job-db9rmklg1s2s739qclkg`
- Endpoint: `GET /api/child-companies`
- HTTP-status: `200`
- Svarformat: array
- Antal child-companies: `0`
- Jobstatus: `succeeded`

Kontrollen dokumenterer, at produktionsmiljøet kan autentificere mod Sprooms
master-API, og at Integrationsservice er aktiv. Der blev ikke oprettet eller
ændret virksomheder, registreringer eller dokumenter.

## Resterende produktionstest

En fuld ende-til-ende-test kan ikke udføres med parent-CVR 46761898 som sit
eget child-company. Der skal bruges en separat, virkelig juridisk virksomhed
med eget CVR samt dennes samtykke og korrekte kontaktoplysninger. Herefter skal
testen dokumentere:

1. oprettelse eller kontrolleret tilknytning af child-company;
2. NemHandel-/Peppol-registrering og modtageropslag;
3. afsendelse og modtagelse af et godkendt testdokument;
4. application response, fejl/afvisning og idempotent genforsøg;
5. korrekt tenant-routing, revisionsspor og femårigt arkiv.

Der må ikke oprettes et opdigtet CVR i produktion for at omgå dette krav.

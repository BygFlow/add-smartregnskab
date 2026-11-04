# SKAT NemVirksomhed / Moms API

Status: integrationskoden er implementeret og automatisk testet. Test- og
produktionsforbindelsen må først aktiveres, når Skattestyrelsen har udleveret de
miljøspecifikke endpoints og certifikater til ADD SmartDrift ApS, CVR 46761898.

## Ansvar og virksomheder

- ADD SmartDrift ApS er regnskabssystemsudbyder (RSU).
- Den enkelte kundevirksomhed er den juridiske enhed, der indberetter moms.
- Kunden skal delegere `Nemvirksomhed-adgang for systemudbyderne` til ADD
  SmartDrift ApS hos Skattestyrelsen.
- ADD Multiservice og MultiClean kan anvendes som adskilte pilotvirksomheder.
  Deres data, CVR-/SE-numre, brugeradgang og revisionsspor må ikke blandes.

## Implementeret flow

1. `VirksomhedKalenderHent` henter åbne perioder og frister.
2. `ModtagMomsangivelseForeloebig` opretter kun en kladde med de 17 officielle
   momsangivelsesfelter i den rækkefølge, Skattestyrelsen kræver.
3. Skattestyrelsen returnerer et HTTPS-link under `skat.dk`.
4. En tegnings-/indberetningsberettiget person logger særskilt på TastSelv
   Erhverv og godkender tallene. ADD SmartRegnskab kan ikke gøre dette automatisk.
5. `MomsangivelseKvitteringHent` henter kvittering og betalingsoplysninger efter
   godkendelsen.

Alle kald får et nyt transaktions-id og tidspunkt. Udkast kræver en eksplicit
lederbekræftelse i brugerfladen og registreres i revisionssporet.

## Sikkerhed

- SOAP over TLS.
- WS-Security-signering med miljøspecifikt OCES3/VOCES3-certifikat.
- Privat nøgle, certifikat og eventuel passphrase lagres kun som hemmelige
  miljøvariabler i drift; de må ikke lagres i Git, databasen eller logfiler.
- Klienten er fail-closed, hvis et endpoint eller certifikat mangler.
- Et returneret godkendelseslink accepteres kun, hvis det bruger HTTPS og har
  værtsnavnet `skat.dk` eller et underdomæne til `skat.dk`.
- Ingen moms kan færdiggodkendes uden kundens særskilte TastSelv-login.

## Miljøvariabler

Se `.env.example` for den fulde liste. Skattestyrelsen skal udlevere eller
bekræfte følgende før en rigtig test:

- kalender-, kladde- og kvitterings-WSDL
- kalender-, kladde- og kvitteringsendpoints
- testcertifikat og adgangsvejledning
- krav til produktionscertifikat og godkendelse

## Test og accept

Automatiske tests dækker konfiguration, SE-nummer, datoer, alle 17 felter,
feltorden, transaktions-id, linkvalidering og kvitteringsforespørgsel. Den
officielle accepttest kan først udføres, når Skattestyrelsen har udleveret
testadgangen. Acceptforløbet skal dokumentere:

1. delegation fra en pilotvirksomhed
2. succesfuldt kalenderkald
3. momsudkast med godkendelseslink
4. manuel godkendelse i TastSelv-testforløbet
5. hentet kvittering
6. afvisning ved manglende delegation og ugyldig periode

## Officielle kilder

- https://skat.dk/erhverv/moms/moms-saadan-goer-du/saadan-laver-du-din-virksomheds-momsregnskab/api-loesning-til-momsindberetning
- https://github.com/skat/rsu-b2b-sample-client-java


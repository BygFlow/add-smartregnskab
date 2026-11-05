# Repræsentativt arkivgrundlag — 5. november 2026

Produkt: ADD SmartRegnskab 3.16.4  
Udbyder: ADD SmartDrift ApS, CVR 46761898

## Konklusion

Der findes endnu ikke en rigtig slutkundeperiode i produktion, som kan bruges
til et repræsentativt femårsarkivbevis. Der er derfor ikke oprettet et nyt,
permanent Object Lock-arkiv på baggrund af de eksisterende prøveposter.

## Skrivebeskyttet produktionskontrol

Kontrollen den 5. november 2026 viste:

- ADD SmartDrift ApS' kundetenant havde 0 bogførte journaler og 0 fakturaer,
  som var sendt eller bogført;
- de to fakturarækker var kladder, og den ene var udtrykkeligt navngivet
  `F-TEST-001`;
- den eneste bilagsrække stod i papirkurven og var ikke knyttet til en
  bogført journal eller voucher;
- historiske AiiA-rækker stod som afventende og var ikke bogført; der var
  ingen aktiv AiiA-integration på tenantens integrationsliste;
- ADD Multi Service ApS og ADD Group ApS havde heller ingen bogførte journaler,
  ikke-kladdefakturaer eller aktive originalbilag.

Disse rækker er derfor ikke behandlet som rigtigt regnskabsmateriale i
registreringsbeviset. De er ikke slettet eller ændret som led i kontrollen.

## Registreringsgrundlag

Registreringspakken dokumenterer i stedet systemets femårsflow med:

1. reproducerbare syntetiske arkiv- og restoretests;
2. Object Lock, read-back og isoleret gendannelse af en rigtig originalfil;
3. driftskontrol af ekstern backup, checksum og restore;
4. en procedure om at gentage hele kontrollen, når den første rigtige
   slutkundeperiode med bogført transaktion og originalbilag findes.

Der må ikke fremstilles, sendes eller bogføres kunstige kundetransaktioner
alene for at skabe et produktionsbevis.

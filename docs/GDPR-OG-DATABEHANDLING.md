# GDPR- og databehandlingsgrundlag

Status: teknisk og organisatorisk udkast til juridisk godkendelse.

## Roller og formål

ADD SmartDrift ApS er databehandler for kundens brug af ADD SmartRegnskab,
mens den enkelte kunde som udgangspunkt er dataansvarlig for oplysninger om
egne medarbejdere, kunder og leverandører. ADD SmartDrift ApS er selv
dataansvarlig for konto-, abonnements-, support- og faktureringsoplysninger.

Behandlingen omfatter drift af bogføring, fakturering, bilag, support,
sikkerhed, adgangskontrol, backup og kundestyrede AI-forslag. Kunden skal selv
fastlægge behandlingsgrundlag og oplysningspligt for sine registrerede.

## Implementerede kontroller

- Virksomhedsadskillelse og rollebaseret adgang.
- Kryptering af hemmeligheder, stærke adgangskoder, kontolås og TOTP.
- Revisionslog for væsentlige handlinger.
- Dataudtræk i JSON og CSV for registreredes rettigheder.
- Anonymisering af medarbejdere og kunder med særskilt bevarelse af lovpligtigt
  regnskabsmateriale.
- Kundestyrede opbevaringsperioder og automatisk oprydning.
- Sletning af sessioner og hemmeligheder ved deaktivering.
- Daglig ekstern backupfunktion med integritetskontrol.

## Standardfrister

Bogføringsmateriale bevares efter den gældende bogføringspligt. GPS-data er som
standard sat til 6 måneder, fotos 24 måneder og tids-/fraværsdata 60 måneder.
Kunden skal ændre fristerne, hvis nødvendighed, overenskomst eller lovgrundlag
kræver andet. Sletning suspenderes ved dokumenteret retskrav eller myndighedssag.

## Registreredes rettigheder

Anmodninger registreres, identiteten kontrolleres, og adgang, rettelse,
sletning, begrænsning eller dataportabilitet vurderes konkret. Udleveringer må
ikke indeholde andre personers oplysninger, kodeordshash, TOTP-hemmeligheder
eller sikkerhedsnøgler.

## Mangler før kundeaftaler

- Juridisk godkendt privatlivspolitik og databehandleraftale med bilag om
  instrukser, sikkerhed, sletning, revision og bistand.
- Endelig fortegnelse over behandlingsaktiviteter og behandlingsgrundlag.
- Risikoanalyse og vurdering af, om GPS- og AI-behandling kræver DPIA.
- Underskrevne databehandleraftaler med alle underdatabehandlere.
- Dokumentation af dataplacering og eventuelle overførselsgrundlag uden for EU/EØS.

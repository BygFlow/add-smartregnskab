# NemHandel og Peppol — drifts- og integrationsbeskrivelse

Status: Sproom-masteraftalen for ADD SmartDrift ApS er indgået. Adapter,
centralt child-register og onboarding-flow er implementeret. Mastertokenet er
lagt i produktion, og Sprooms signerede webhook-test svarer HTTP 200. Rigtig
afsendelse er fortsat låst, indtil den enkelte virksomheds child-profil og
NemHandel-registrering er godkendt og ende-til-ende-valideret.

## Implementeret

- Generering af OIOUBL 2.1 og Peppol BIS Billing 3 fra en eksisterende faktura.
- Generering af elektroniske kreditnotaer med reference til oprindelig faktura.
- Oprettelse af Application Response, Message Level Response og Invoice Response til indgående dokumenter.
- Modtageridentifikation via GLN/EAN (`0088`) eller dansk CVR (`0184`).
- Lokal XML- og minimumskontrol samt mulighed for ekstern validator.
- Afsendelse med idempotensnøgle til en access-point-leverandør.
- Afsendelse fejler lukket, hvis leverandøren eller validatoren afviser dokumentet.
- Leverandør-ID, antal forsøg, fejl, tider og status gemmes i revisionssporet.
- Signaturkontrolleret webhook til indgående dokumenter.
- Manuel, godkendt import samt XML-download til ekstern validering.
- Sproom-modtageropslag før afsendelse, binær dokumentupload og kontrol af
  `X-Sproom-DocumentId`.
- Deterministisk `X-Request-Id` på alle Sproom-uploads. Et sikkert genforsøg,
  som Sproom svarer `409` på, genbruger det eksisterende dokument-ID og skaber
  ikke en dublet.
- Formatspecifikke endpoint-koder: `DK:CVR`/`GLN` i dansk OIOUBL og
  `0184`/`0088` i Peppol BIS Billing 3.
- Sproom child-company-token pr. virksomhed, så kunders dokumenter ikke sendes
  under platformens egen juridiske identitet.
- Centralt register med CVR som unik nøgle. Samme juridiske virksomhed
  genbruger dermed én child-profil i SmartRegnskab, Pro og Clean.
- Samtykkebaseret onboarding i SmartRegnskab samt platformbeskyttet kobling af
  det eksterne Sproom child-company-ID.
- Automatisk oprettelse via `POST /api/child-companies`, når masteradgangen er
  aktiveret. Hvis CVR'et allerede findes hos Sproom (`409`), startes Sprooms
  officielle tilmelding via `POST /api/child-companies/enrollments` i stedet
  for at oprette en dublet. Sproom sender selv autentificeringslinket til den
  godkendte e-mail; linket gemmes ikke i ADD SmartRegnskab.
- Automatisk kobling af en godkendt eksisterende profil via den signerede
  `childCompanyEnrollmentAccepted`-webhook.
- Valgfri automatisk NemHandel-registrering med child-token. Peppol står som
  "kræver verifikation", indtil Sprooms særskilte deltagerkontrol er afsluttet.
- Sproom-webhook med RSA-SHA256-signatur, leveringstilstande og automatisk
  hentning af modtagne OIOUBL/Peppol-dokumenter.

## Anbefalet produktionsadapter: Sproom

Den indgåede aftale er bekræftet som én ISV Parent/masteraftale for ADD
SmartDrift ApS, CVR 46761898, hvor alle kundeprofiler kan oprettes som
child-companies. Der kan kun være én Sproom-
profil pr. CVR-nummer, og både afsendelse og modtagelse tæller som en
transaktion. Registrering på NemHandel/Peppol samt integration service til
oprettelse af child-companies er oplyst uden særskilt gebyr. Aftalen er oplyst
med 12 måneders binding og derefter tre måneders opsigelse til udgangen af en
kalendermåned. Den tekniske produktionsopsætning må først aktiveres, når de
leverede produktionsoplysninger er sat og kontrolleret.

Sæt `EINVOICE_PROVIDER=sproom`, `SPROOM_PARENT_CVR=46761898`,
`SPROOM_PARENT_NAME=ADD SmartDrift ApS` og `SPROOM_API_TOKEN`. Nye koblinger gemmes i tabellen
`sproom_child_companies`. `SPROOM_COMPANY_MAP` er kun en overgangs-fallback
fra ADD SmartRegnskabs interne virksomheds-ID til Sprooms child-company UUID:

```json
{"1":"e042e119-fd0c-4dd6-bf7e-02564c9fbd7b"}
```

Hver juridisk kundevirksomhed skal oprettes eller tilmeldes én gang som child
company. Pro og Clean registrerer blot deres produktnavn på den eksisterende
CVR-profil gennem ADD Connect og må aldrig oprette en parallel Sproom-profil.
Adapteren
henter et tidsbegrænset virksomhedstoken, slår modtageren op i NemHandel/Peppol
og uploader XML binært til `POST /api/documents`. Sprooms webhook-URL er:

`https://app.addsmartregnskab.dk/api/einvoice/sproom/webhook`

Opret `documentStatusChanged`, `documentReceived` og
`childCompanyEnrollmentAccepted`. Hent Sprooms offentlige
webhooknøgle fra `GET /api/webhooks/key`, og sæt den som PEM i
`SPROOM_WEBHOOK_PUBLIC_KEY` eller som base64 af hele PEM-filen i
`SPROOM_WEBHOOK_PUBLIC_KEY_BASE64`. Webhooken afviser alle kald, hvor
RSA-SHA256-signaturen i `X-Signature` ikke kan bekræftes.

## Staging

Brug `SPROOM_API_URL=https://staging.sproom.net/api` sammen med et særskilt
staging-token og staging child-company-ID. Brug aldrig produktionsnøgler i
staging. Sproom oplyser i sin aktuelle Swagger-side, at stagingdatabasen
nulstilles 16. maj og 16. november; testprofiler og integrationer skal derfor
kunne oprettes igen efter disse datoer.

Adapterens kontrakt er kontrolleret mod Sprooms aktuelle API-dokumentation den 14. oktober 2026:
`POST /api/child-companies`, `GET /api/child-companies/{id}/token`,
`GET /api/recipients/{orgId}`, `POST /api/documents` og webhook-endpoints under
`/api/webhooks`.

## Produktionslåse

Begge automatiske handlinger er som standard slået fra:

```dotenv
SPROOM_AUTOMATIC_PROVISIONING=false
SPROOM_AUTO_REGISTER_NEMHANDEL=false
```

Første flag må først sættes til `true`, når Sproom har aktiveret ISV/
Integration Service på ADD SmartDrift ApS' parent-konto, mastertokenet er lagt
ind som hemmelig miljøvariabel, og staging kan oprette både en ny child-profil
og starte enrollment for et eksisterende CVR. Andet flag åbnes først efter en
vellykket registrering og modtagelsestest i staging. En kundeadministrator skal
fortsat aktivt godkende onboardingen i programmet; flagene omgår ikke samtykke.

## Generisk leverandørkontrakt

`EINVOICE_PROVIDER_URL` modtager JSON med `format`, `recipient` og
`documentBase64`. Et vellykket svar skal være HTTP 2xx og bør indeholde `id`
eller `messageId`. Bearer-token sættes fra `EINVOICE_PROVIDER_API_KEY`.

Webhooken `POST /api/einvoice/inbound` modtager `companyId`, `format`,
`messageId` og `documentBase64`. Hele JSON-requesten signeres med HMAC-SHA256
og sendes i `X-Einvoice-Signature`. Hemmeligheden er
`EINVOICE_WEBHOOK_SECRET`.

## Før produktionsaktivering

1. Arkivér Sproom-masteraftalen og den tekniske produktionsvejledning sammen
   med databehandlergrundlaget.
2. Kortlæg leverandørens API til den dokumenterede kontrakt eller tilføj en
   leverandørspecifik adapter. Sproom-adapteren er allerede implementeret.
3. Opret eller tilmeld hver kunde som child company gennem masteraftalen, og
   registrér dens CVR/GLN
   til modtagelse i NemHandel og eventuelt Peppol. ADD SmartRegnskab må ikke
   registrere kundens identitet uden kundens gyldige accept og leverandørflow.
4. Validér repræsentative dokumenter i NemHandels officielle validator.
5. Kør ende-til-ende-test til et separat CVR/GLN og gem kvitteringerne.
6. Gennemfør leverandørspecifik ende-til-ende-test af afvisning, timeout,
   kreditnota og alle svarmeddelelser. Dublet- og signaturkontrol dækkes også
   automatisk af den lokale produktions-smoke-test.

En lokal grøn strukturkontrol er ikke det samme som NemHandel-godkendelse.

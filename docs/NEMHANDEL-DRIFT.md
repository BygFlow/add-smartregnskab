# NemHandel og Peppol — drifts- og integrationsbeskrivelse

Status: Sproom-adapter og generisk adapter er implementeret, men et
produktionsadgangspunkt er ikke tilsluttet, før aftale og nøgler er sat.

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
- Sproom-webhook med RSA-SHA256-signatur, leveringstilstande og automatisk
  hentning af modtagne OIOUBL/Peppol-dokumenter.

## Anbefalet produktionsadapter: Sproom

Sæt `EINVOICE_PROVIDER=sproom`, `SPROOM_API_TOKEN` og
`SPROOM_COMPANY_MAP`. Kortet er JSON fra ADD SmartRegnskabs interne
virksomheds-ID til Sprooms child-company UUID, eksempel:

```json
{"1":"e042e119-fd0c-4dd6-bf7e-02564c9fbd7b"}
```

Hver virksomhed skal oprettes eller tilmeldes som child company. Adapteren
henter et tidsbegrænset virksomhedstoken, slår modtageren op i NemHandel/Peppol
og uploader XML binært til `POST /api/documents`. Sprooms webhook-URL er:

`https://app.addsmartregnskab.dk/api/einvoice/sproom/webhook`

Opret både `documentStatusChanged` og `documentReceived`. Hent Sprooms offentlige
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

Adapterens kontrakt er kontrolleret mod Sproom API v1 den 21. september 2026:
`POST /api/child-companies`, `GET /api/child-companies/{id}/token`,
`GET /api/recipients/{orgId}`, `POST /api/documents` og webhook-endpoints under
`/api/webhooks`.

## Generisk leverandørkontrakt

`EINVOICE_PROVIDER_URL` modtager JSON med `format`, `recipient` og
`documentBase64`. Et vellykket svar skal være HTTP 2xx og bør indeholde `id`
eller `messageId`. Bearer-token sættes fra `EINVOICE_PROVIDER_API_KEY`.

Webhooken `POST /api/einvoice/inbound` modtager `companyId`, `format`,
`messageId` og `documentBase64`. Hele JSON-requesten signeres med HMAC-SHA256
og sendes i `X-Einvoice-Signature`. Hemmeligheden er
`EINVOICE_WEBHOOK_SECRET`.

## Før produktionsaktivering

1. Indgå aftale med et NemHandel/Peppol access point, der understøtter både
   afsendelse, modtagelse, kreditnotaer og nødvendige svarmeddelelser.
2. Kortlæg leverandørens API til den dokumenterede kontrakt eller tilføj en
   leverandørspecifik adapter. Sproom-adapteren er allerede implementeret.
3. Opret eller tilmeld hver kunde som child company, og registrér dens CVR/GLN
   til modtagelse i NemHandel og eventuelt Peppol. ADD SmartRegnskab må ikke
   registrere kundens identitet uden kundens gyldige accept og leverandørflow.
4. Validér repræsentative dokumenter i NemHandels officielle validator.
5. Kør ende-til-ende-test til et separat CVR/GLN og gem kvitteringerne.
6. Gennemfør leverandørspecifik ende-til-ende-test af afvisning, timeout,
   kreditnota og alle svarmeddelelser. Dublet- og signaturkontrol dækkes også
   automatisk af den lokale produktions-smoke-test.

En lokal grøn strukturkontrol er ikke det samme som NemHandel-godkendelse.

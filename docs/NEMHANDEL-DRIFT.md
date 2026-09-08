# NemHandel og Peppol — drifts- og integrationsbeskrivelse

Status: integrationsklar, men ikke tilsluttet et produktionsadgangspunkt.

## Implementeret

- Generering af OIOUBL 2.1 og Peppol BIS Billing 3 fra en eksisterende faktura.
- Modtageridentifikation via GLN/EAN (`0088`) eller dansk CVR (`0184`).
- Lokal XML- og minimumskontrol samt mulighed for ekstern validator.
- Afsendelse med idempotensnøgle til en access-point-leverandør.
- Afsendelse fejler lukket, hvis leverandøren eller validatoren afviser dokumentet.
- Leverandør-ID, antal forsøg, fejl, tider og status gemmes i revisionssporet.
- Signaturkontrolleret webhook til indgående dokumenter.
- Manuel, godkendt import samt XML-download til ekstern validering.

## Leverandørkontrakt

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
   leverandørspecifik adapter.
3. Registrér ADD SmartRegnskab eller serviceleverandøren korrekt i
   Nemhandelsregisteret.
4. Validér repræsentative dokumenter i NemHandels officielle validator.
5. Kør ende-til-ende-test til et separat CVR/GLN og gem kvitteringerne.
6. Test afvisning, dublet, timeout, kreditnota, Application Response, Message
   Level Response og Invoice Response.

En lokal grøn strukturkontrol er ikke det samme som NemHandel-godkendelse.


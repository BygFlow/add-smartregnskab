# Driftsbevis — ADD SmartRegnskab 3.15.1

Dato: 19. september 2026

## Leveret

- Leverandørspecifik Sproom-adapter til NemHandel og Peppol.
- Modtageropslag før afsendelse og binær XML-upload.
- Krav om `X-Sproom-DocumentId`, før et dokument markeres som sendt.
- Isoleret child-company-token og eksplicit virksomheds-ID-kort pr. kunde.
- RSA-SHA256-verificeret webhook til leveringsstatus og modtagne dokumenter.
- Automatisk hentning, validering, dubletkontrol og revisionsspor for indgående dokumenter.

## Kontroller

- TypeScript-kontrol: bestået.
- Produktionsbuild og automatiske tests: 8 af 8 bestået.
- Sikkerhedskontrol: bestået uden fund.
- `npm audit --omit=dev`: 0 kendte sårbarheder.
- Android debug-build: bestået for version 3.15.1, versionCode 23.

## Ekstern aktivering, som fortsat kræves

Release 3.15.1 aktiverer ikke NemHandel alene. Før reel drift kræves:

1. Sproom integrations-/access-point-aftale og API-token.
2. Oprettelse eller godkendt tilmelding af hver kunde som child company.
3. Registrering af hver kundes CVR/GLN til NemHandel og eventuelt Peppol.
4. Sprooms webhook-offentlige nøgle og oprettelse af begge webhooks.
5. Ekstern validator samt dokumenteret ende-til-ende-test med et separat CVR/GLN.

Indtil alle fem punkter er opfyldt, viser systemet integrationen som ikke
driftsklar og nægter at markere e-fakturaer som leveret.

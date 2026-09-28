# ADD Connect — verificeret Render-stagingtest, 28. september 2026

## Afgrænsning

Testen blev udført mellem tre private Render-tjenester i projektet **ADD Integration Staging**. Den brugte den fiktive virksomhed `Fiktiv ADD Connect-stagingkunde`, syntetiske fakturaer/PDF'er og en kortlivet nøgle med `add_connect:read` og `add_connect:write`. Ingen produktionsdata, kundemails, betalinger eller EDI-afsendelser indgik.

| Tjeneste | Staging-commit | Testet |
| --- | --- | --- |
| SmartRegnskab (`srv-dat13nbncjis73cmttg0`) | `206eb64` | Modtagelse, bogføring, originaldokument og nøgledeaktivering |
| Pro (`srv-dat10dh7lnhs73b7irc0`) | `b960020` | Syntetisk `invoice.issued` via ADD Connect og læsekontrol |
| Clean (`srv-dat11st9fdbs73fg97cg`) | `91c60db` | Fakturaconnectorens `syncInvoices` og gensynkronisering |

## Observerede resultater

- SmartRegnskabs log viste `ADD Connect staging-fixture klar for firma 1`; nøglen havde en udløbstid på to timer.
- Pro sendte én fiktiv udstedt faktura. Loggen viste `success=2, duplicate=false, booked=true, archived=true`. Efter genstart med samme payload viste loggen `success=0, duplicate=true, booked=true, archived=true`.
- Clean kørte den normale `syncInvoices`-connector med én fiktiv faktura. Dens andet kald kontrollerede den gemte faktura i SmartRegnskab og sprang den over. Loggen viste `faktura bogført og arkiveret én gang; gensynkronisering sprunget over`.
- `STAGING_CONNECT_TOKEN` blev fjernet fra alle tre Render-tjenesters miljøvariabler. SmartRegnskabs log viste `ADD Connect staging-testnøgle deaktiveret`, og alle tre tjenester startede igen. Variablen var derefter ikke længere synlig i nogen af de tre miljøer.
- En lokal regressionstest kontrollerer nu også HTTP-adgangen: den aktive testnøgle kan læse et ADD Connect-endpoint, mens samme nøgle får `401` efter deaktivering. Det er ikke en erstatning for en ny negativ Render-stagingtest.

## Hvad testen **ikke** beviser

- Pro-testen kaldte det private ADD Connect-endpoint fra staging-opstartskoden; den gennemløb ikke hele den almindelige Pro-brugerflade eller fakturaudstedelsesruten.
- Clean-testen gennemløb connectoren, men ikke hele brugerfladen eller en faktisk kundes fakturaafsendelse.
- Der blev ikke afprøvet rigtig e-mail, QuickPay, Sproom/NemHandel/Peppol, AiiA, eksternt ERP, en rigtig XML-validator eller produktionsmiljøet.
- En faktisk restore af de tre Render-stagingdatabaser og fillagre på separate instanser er ikke udført. Lokale backuptests erstatter ikke den øvelse.
- Den fiktive virksomhed og fakturaer forbliver i den isolerede stagingdatabase som testspor; kun den midlertidige adgangsnøgle er deaktiveret.

## Før intern integration kan foreslås til produktion

1. Kør de almindelige brugerflows i Pro og Clean med godkendte testbrugere og fiktive fakturaer, og kontroller at kun den allerede udstedte faktura bogføres i SmartRegnskab.
2. Kør negativ stagingtest med forkert virksomheds-/programnøgle, manglende konti, ugyldigt dokumenthash og afbrudt forbindelse.
3. Tag og gendan en krypteret backup af hver nødvendig stagingdatabase og hvert fillager på en separat instans; dokumentér RPO/RTO og alarm ved fejl.
4. Gennemgå logge, rettigheder og driftsinstruks. Beslut eventuel produktion særskilt; denne rapport er ikke en go-live-godkendelse.

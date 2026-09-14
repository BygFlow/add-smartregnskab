# AiiA og QuickPay — produktionsdrift

## AiiA / Mastercard Open Banking

Integrationen bruger AiiAs OAuth 2.0 connect-flow med scopes `accounts offline_access`.
Bankbrugeren sendes altid til AiiA for at vælge konto og afgive samtykke. Callback-state
er et kryptografisk engangstoken med ti minutters levetid. Access- og refresh-token
krypteres med `ENCRYPTION_KEY`; de udleveres aldrig gennem API'et.

Efter tilslutning hentes konti fra `/v1/accounts` og bogførte transaktioner fra
`/v1/accounts/{accountId}/transactions`. DKK-poster importeres med AiiAs transaktions-id,
så samme post ikke kan oprettes to gange. Scheduler-jobbet `aiia_bank_sync` kører hvert
15. minut. Andre valutaer springes over, indtil valutakursgrundlag er konfigureret.

Miljøvariabler: `AIIA_CLIENT_ID`, `AIIA_CLIENT_SECRET`, `AIIA_BASE_URL`,
`AIIA_REDIRECT_URI` og `AIIA_SCOPES`. Redirect-URL'en skal være registreret præcist hos
Mastercard. Produktionsadgang, databehandleraftale, samtykketekst og slettefrister skal
godkendes før kundedrift.

Officiel reference:

- https://github.com/Mastercard/open-banking-eu-postman-collections
- https://developer.mastercard.com/apis

## QuickPay

QuickPay bruges som primær betalingsadapter via API v10. Systemet opretter først en
subscription og derefter QuickPays hostede betalingslink. Når kunden har godkendt
aftalen, aktiverer en signeret callback betalingsmidlet. Fornyelser oprettes via
`/subscriptions/{id}/recurring` og markeres først betalt efter godkendt API-svar eller
callback. Refunderinger sendes til `/payments/{id}/refund`.

Alle callbacks kontrolleres mod `QuickPay-Checksum-Sha256` med HMAC-SHA256 over den
rå request body og `QUICKPAY_PRIVATE_KEY`. Genleverede callbacks er idempotente.
Kortnumre lagres aldrig i ADD SmartRegnskab.

Miljøvariabler: `QUICKPAY_API_KEY`, `QUICKPAY_PRIVATE_KEY` og valgfrit
`QUICKPAY_SETUP_AMOUNT_ORE`. Brug en begrænset API-bruger og registrér callback-URL'en
`https://app.addsmartregnskab.dk/api/webhooks/quickpay` i QuickPay Manager.

Officiel reference:

- https://learn.quickpay.net/tech-talk/api/
- https://learn.quickpay.net/tech-talk/payments/link/
- https://learn.quickpay.net/tech-talk/api/callback/

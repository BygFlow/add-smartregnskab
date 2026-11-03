# App Store Review – version 3.16.4 (build 31604)

## Foreslået review-note

The review account has permanent access to the dedicated company **App Review Testvirksomhed**. The credentials are stored only in App Store Connect.

The account now contains clearly marked, non-real demo data:

- customer: `Demo Kunde A/S (testdata)`;
- product: `Demo rådgivningstime (testdata)`;
- one unsent invoice draft, `F-2026-0001`;
- a document-inbox address unique to the demo company.

Suggested review path:

1. Sign in with the review credentials already entered in App Store Connect.
2. Open **Kunder** to inspect the demo customer.
3. Open **Produkter & ydelser** to inspect the demo product.
4. Open **Fakturering** to inspect the unsent demo invoice draft. Please do not press **Send**; the draft is intentionally not addressed to a real recipient.
5. Open **Bilagsindbakke** or **Mobilvisning** to test receipt capture.
6. Open the AI assistant. AI produces suggestions only; a user must review and approve before accounting data is posted.

The review company intentionally has no real CVR number, bank consent or NemHandel registration. Those production integrations require the legal company's own CVR and explicit bank/NemHandel consent and are therefore not activated for a fictional review tenant. This does not block the core receipt, invoice, bookkeeping, reporting or AI-assisted review flows.

Web login fallback: `https://app.addsmartregnskab.dk/#/login`

## Før ny indsendelse

- Build 31604 er uploadet og står som `Ready to Submit` i TestFlight.
- Build 31604 er valgt på version 1.0.
- Kontrollér App Privacy og kontaktoplysninger.
- Ovenstående note er indsat uden testkontoens adgangskode.
- Det markerede demo-bilag `app-review-demo-bilag.png` ligger i testvirksomhedens bilagsindbakke.
- Test buildet fysisk på iPhone eller iPad via TestFlight.
- Den interne gruppe `Intern test – ADD SmartRegnskab` indeholder build 31604, og kontoindehaveren er inviteret som tester.
- Tag et skærmbillede eller en kort video af login, bilagsindbakke og fakturakladde som internt bevis.
- App Store Connect står på `Prepare for Submission`. Vælg først **Update Review** efter en særskilt bekræftelse på selve genindsendelsen.

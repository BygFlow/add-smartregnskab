# App Store Review – version 3.16.4 (build 31607)

## Review-note til App Store Connect

### 1. Physical-device screen recording

Screen recording: `[INSERT PUBLICLY ACCESSIBLE REVIEW VIDEO URL]`

The recording is captured on a physical iPhone running the latest available iOS version. It begins with launching the app and shows sign-in, the typical accounting workflow, access to subscription features and the in-app account-deletion entry point.

### 2. Purpose, target audience and value

ADD SmartRegnskab is a Danish business-accounting app for small companies, tradespeople, service businesses and self-employed professionals. It brings receipts, invoice drafts, customers, products, bank reconciliation, VAT and reporting into one private company workspace. Its purpose is to reduce manual administration while keeping the business user in control of bookkeeping decisions. AI provides suggestions only; a user must review and approve before accounting data is posted.

### 3. Access and review path

The review credentials are stored only in the **Sign-In Information** fields in App Store Connect. They provide permanent access to the dedicated company **App Review Testvirksomhed**.

The company contains clearly marked, non-real demo data:

- customer: `Demo Kunde A/S (testdata)`;
- product: `Demo rådgivningstime (testdata)`;
- one unsent invoice draft: `F-2026-0001`;
- one demo receipt in **Bilagsindbakke**: `app-review-demo-bilag.png`;
- a document-inbox email address unique to the demo company.

Suggested review path:

1. Launch the app and sign in with the review credentials.
2. Open **Kunder** to inspect the demo customer.
3. Open **Produkter & ydelser** to inspect the demo product.
4. Open **Fakturering** to inspect the unsent demo invoice draft. Please do not press **Send**; it is intentionally not addressed to a real recipient.
5. Open **Bilagsindbakke** or **Mobilvisning** to inspect the demo receipt and receipt-capture flow.
6. Open the AI assistant. AI produces suggestions only and requires user review before posting.
7. Open **Abonnement & betaling** to view paid-plan information and the account-deletion entry point under **Konto og data**. The deletion request is separate from subscription cancellation and requires an explicit confirmation phrase.

The app does not require a reviewer to create a new legal company or activate a paid production integration. Web login fallback: `https://app.addsmartregnskab.dk/#/login`.

### 4. External services and platforms

- **OpenAI**: AI-assisted document reading and accounting suggestions; suggestions are not posted automatically.
- **Mastercard Open Banking (AiiA)**: optional bank-data and payment connectivity after explicit consent by the legal company.
- **Sproom / NemHandel**: optional Danish electronic-invoicing connectivity for registered legal companies.
- **QuickPay and Clearhaus**: recurring card payment for the ADD SmartRegnskab subscription; card data is handled by the payment providers and is not stored by the app.
- **Render**: production application and database hosting.
- **Hetzner Object Storage**: encrypted document archive and backup storage, including retained bookkeeping material.
- **Resend**: transactional service emails.
- **e-conomic**: optional ERP connector when enabled by the customer.

The fictional review company deliberately has no real CVR number, bank consent or NemHandel registration. Those integrations require the legal company's own identity and consent and are therefore not activated for the review tenant. This does not block the core receipt, invoice, bookkeeping, reporting, subscription-information or AI-assisted review flows.

### 5. Regional differences

The core app functions consistently wherever the app is available. The product is localized for Danish businesses and Danish bookkeeping, VAT and e-invoicing rules. Bank, payment, NemHandel and ERP integrations are available only where the relevant provider supports the legal company and the company has granted the required consent.

### 6. Regulatory and third-party authorization

ADD SmartRegnskab is business-accounting software. It does not act as a bank, hold customer funds or provide investment advice. Regulated bank connectivity is delivered through Mastercard Open Banking (AiiA), and card payments are processed by QuickPay/Clearhaus. NemHandel connectivity is delivered through Sproom. ADD SmartDrift ApS holds the applicable provider agreements; supporting agreements can be supplied to App Review on request. The demo tenant cannot initiate real bank payments, transmit real electronic invoices or charge a real card.

## Fysisk optagelse – obligatorisk rækkefølge

1. Opdatér ADD SmartRegnskab til build `31607` i TestFlight.
2. Start iOS-skærmoptagelse, før appen åbnes.
3. Vis appstart og login med reviewkontoen.
4. Vis Kunder, Produkter & ydelser, fakturakladden og demobilaget.
5. Vis AI-forslaget uden at godkende eller bogføre det.
6. Vis Abonnement & betaling samt Konto og data.
7. Åbn kontosletningsdialogen, men gennemfør ikke sletningen.
8. Stop optagelsen og upload den til et link, som Apple kan åbne uden login.

## Status før genindsendelse

- Build `31607` er uploadet uden `ITMS-90683` og står som **Ready to Submit**.
- Build `31607` er knyttet til `Intern test – ADD SmartRegnskab`.
- Reviewkontoens loginoplysninger er udfyldt i App Store Connect.
- Reviewnoten ovenfor er klar, men videolinket mangler.
- Build `31604` er fortsat valgt på App Store-version 1.0 og skal udskiftes med `31607`, når videoen er klar.
- Vælg først **Update Review / Resubmit to App Review**, når videolinket er indsat og kontrolleret.

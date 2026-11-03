# ADD SmartRegnskab – færdiggørelsesstatus 3. november 2026

## Live og teknisk verificeret

- Produktionsversion 3.16.4 er live på `https://app.addsmartregnskab.dk`.
- `/readyz` melder database, filopbevaring, scheduler, ekstern backup, QuickPay, AiiA og e-mail som klar/konfigureret.
- Alle offentlige juridiske sider svarer med HTTPS, HSTS, CSP og `X-Frame-Options: DENY`.
- 77 backend-/driftstests og 59 klient-/produktkontroller består.
- `npm audit --audit-level=moderate` finder 0 kendte sårbarheder.
- En rigtig originalfil er arkiveret med Object Lock, læst tilbage og gendannelsesvalideret i produktionslageret.
- AiiA-produktionsadgang er godkendt.
- Sproom-masterintegration og sikker kundetilmelding er implementeret; hver rigtig kunde kræver eget CVR og samtykke.
- Google Play-versionen er offentliggjort.
- iOS-version 3.16.4, build 31604, er uploadet og står som `Ready to Test` i TestFlight.
- Den interne TestFlight-gruppe `Intern test – ADD SmartRegnskab` indeholder build 31604 og to inviterede interne testere, herunder `drag_24@icloud.com`.
- Webklienten genindlæser nu automatisk én gang, hvis en åben browser efter en deploy forsøger at hente en udgået JavaScript-chunk.
- AI-tilkøbet er aktivt for App Review-testvirksomheden. En kontrolleret produktionstest læste demobilaget som `Demo Leverandør (testdata)`, 1.250,00 kr., 250,00 kr. moms og dato 03.11.2026. Bilaget blev ikke godkendt eller bogført.

## App Review-konto

Testvirksomheden indeholder nu tydeligt markerede demo-data:

- demo-kunde `DEMO-001`;
- demo-produkt `DEMO-YD-001`;
- usendt fakturakladde `F-2026-0001`;
- tydeligt markeret demo-bilag `app-review-demo-bilag.png` i bilagsindbakken;
- unik bilagsadresse;
- fungerende bilagsapp og AI-assistentpanel.

Ingen demo-faktura er sendt, og ingen rigtig kunde, betaling eller CVR er anvendt.

## Åbne eksterne trin

1. Build 31604 er valgt på App Store-version 1.0, og reviewnoten er opdateret. De inviterede interne testere skal acceptere TestFlight-adgangen og teste buildet fysisk på iPhone/iPad.
2. App Store Connect står på `Prepare for Submission`; `Update Review`/genindsendelse kræver særskilt godkendelse på handlingstidspunktet.
3. Render viser en betalingsfejl; kontoens betalingskort skal opdateres af kontoejeren.
4. En kontrolleret rigtig QuickPay-opkrævning og refundering kræver brugerens kort og økonomiske godkendelse.
5. Første rigtige AiiA-bankforbindelse kræver banklogin/MitID og samtykke fra virksomheden.
6. Sproom/NemHandel end-to-end for en kundecase kræver et andet rigtigt kunde-CVR og kundens samtykke; ADD SmartDrift ApS må ikke oprettes som sit eget child-selskab.
7. Det fulde femårsbevis kræver en rigtig afsluttet/valgt regnskabsperiode med mindst én bogført postering eller faktura og et tilknyttet originalbilag. Den tidligere testperiode havde en rigtig originalfil, men 0 bogførte posteringer og 0 fakturaer.
8. De syv eksisterende selskabsposter uden regnskabsårsstart må ikke udfyldes ved gæt. Den regnskabsansvarlige skal vælge den korrekte dato pr. juridisk enhed.
9. Myndighedsindsendelse bør først ske efter uafhængig juridisk/regnskabsmæssig gennemgang og særskilt godkendelse af selve indsendelsen.

## Myndighedspakke

Den samlede pakke findes lokalt som:

`artifacts/ADD-SmartRegnskab-myndighedspakke-3.16.4.zip`

SHA-256:

`8872ED5866A7EBDB1631C5BA04E4913324791709E0DADA97C79D69810D91BFCD`

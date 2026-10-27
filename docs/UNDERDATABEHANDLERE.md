# Underdatabehandlerregister

Version: 1.1 — 22. september 2026

Den offentlige liste genereres fra `shared/legal-documents.ts`. Dette register er
den interne kontroloversigt og må ikke bruges som bevis for en underskrevet
leverandøraftale.

| Leverandør | Formål | Status før produktionsdata | Kontrolpunkt |
| --- | --- | --- | --- |
| Render Services, Inc. | Applikationshosting og teknisk drift | Aktiv kerneleverandør | EU-region, DPA, underleverandører og tredjelandsoverførsler gennemgås og arkiveres |
| Hetzner Online GmbH | Krypteret ekstern backup og objektlagring | Aktiv, når S3-konfigurationen er sat | Bucket skal ligge i Tyskland eller Finland; 35 dages retention og restore-test dokumenteres |
| Simply.com A/S | Drifts-, konto- og supportmail | Aktiv kerneleverandør | DPA, mailopbevaring og sletteprocedure arkiveres |
| QuickPay ApS | Betalingsvindue og abonnementsbetaling | Aktiv ved betalt abonnement | Produktionsaftale, webhooksignatur og dataminimering kontrolleres |
| Clearhaus A/S | Kortindløsning | Aktiv produktionsaftale | Anvendes sammen med QuickPay; ADD SmartRegnskab lagrer ikke kortnummer eller kontrolcifre |
| Mastercard Open Banking / Aiia | Kontoindsigt og banktransaktioner | Produktionsadgang godkendt; valgfri og kun efter kundens samtykke | Før kundedrift skal DPA, dataplacering og slettefrister være afstemt i den juridiske leverandørkontrol |
| Visma e-conomic A/S (Sproom) | NemHandel/Peppol og child-company-profiler under ADD SmartDrift ApS' masteraftale | Valgfri; aktiveres pr. kunde efter godkendelse, når produktionskoblingen er klar | DPA, underleverandørliste, aftale og produktionsnøgler arkiveres før aktivering |

## Kontrolprocedure

1. Gem underskrevet aftale, DPA, aktuelle vilkår og underleverandørliste i det
   interne leverandørarkiv.
2. Registrér ejer, kontrol- og fornyelsesdato, datalokation, slettefrist og
   gyldigt overførselsgrundlag.
3. Aktivér først produktionsnøgler, når sikkerheds- og databeskyttelseskontrollen
   er godkendt.
4. Varsl kunder om væsentlige nye eller ændrede underdatabehandlere og håndtér
   saglige indsigelser før ændringen, når aftalen kræver det.
5. Gennemgå registret mindst årligt og ved enhver væsentlig leverandørændring.

En leverandør markeret som afventende må ikke modtage produktionsdata.

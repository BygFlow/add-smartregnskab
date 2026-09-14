# Underdatabehandlerregister

Status: skal færdiggøres og varsles til kunder før produktionsaftale.

| Leverandør | Formål | Data | Placering/overførsel | DPA og kontrol |
| --- | --- | --- | --- | --- |
| Render | Hosting, database-disk, log og netværk | Konto-, regnskabs- og driftsdata | Skal dokumenteres kontraktuelt | DPA, region og overførselsgrundlag mangler dokumentation |
| Simply.com | SMTP og domænedrift | Modtager, emne og e-mailindhold | Skal dokumenteres kontraktuelt | DPA og mailopbevaring skal kontrolleres |
| Valgt S3-leverandør | Uafhængig backup | Krypteret database, bilag og manifest | Skal være server i EU/EØS | Leverandør er endnu ikke valgt |
| Valgt NemHandel-adgangspunkt | E-fakturering | Faktura-, kunde- og virksomhedsdata | Skal dokumenteres | Leverandør er endnu ikke valgt |
| Mastercard OB Services Europe A/S (AiiA), hvis aktiveret | Open Banking-konti og bankposter efter samtykke | Kontoidentifikation, saldi og transaktioner | DPA, formål, samtykke og opbevaring skal dokumenteres | Produktionsaftale mangler |
| QuickPay, hvis aktiveret | Abonnementsbetaling | Konto-, faktura- og betalingstoken | Leverandørvilkår og dataplacering vurderes | Produktionsaftale mangler |
| AI-leverandør, hvis aktiveret | Forslag og dokumentanalyse | Kun nødvendige felter efter kundens valg | Skal dokumenteres før aktivering | Ingen produktionsnøgle dokumenteret |

Listen må ikke betegnes som endelig, før aftaler, regioner, slettefrister,
underdatabehandlere og eventuelle tredjelandsoverførsler er verificeret.

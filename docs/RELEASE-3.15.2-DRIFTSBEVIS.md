# Driftsbevis — ADD SmartRegnskab 3.15.2

Dato: 20. september 2026

## Omfang

Denne vedligeholdelsesrelease retter versionskonsistens, SAF-T-metadata, API-nøgleflow og Sproom-konfigurationsvalidering. Den ændrer ikke kundernes bogføringsdata.

## Kontroller

- TypeScript-kontrol og produktionsbuild skal bestå.
- Den samlede automatiske testpakke skal bestå.
- Sikkerhedsselvkontrol og afhængighedskontrol skal være uden fund på det valgte alvorlighedsniveau.
- Serverstatus, PWA-cache, npm-pakke og Android-app viser version 3.15.2.
- SAF-T-eksportens `SoftwareVersion` følger den deployede applikationsversion.
- API-dokumentationen sender brugeren til den rigtige nøglestyring; rå nøgler vises kun ved oprettelsen.

## Eksterne forudsætninger

NemHandel/Peppol er først komplet i reel drift, når Sproom har aktiveret integrationspartneradgang, child companies og webhooks, og en end-to-end-test er godkendt. Automatisk bankdata kræver tilsvarende produktionsgodkendelse og aktive legitimationsoplysninger hos Mastercard Open Banking/Aiia.

Juridiske tekster i løsningen er tekniske udkast og skal godkendes af juridisk rådgiver. Denne release er derfor ikke i sig selv en juridisk certificering.

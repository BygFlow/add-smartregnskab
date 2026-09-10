# Sikkerhedsreview 3.6.0

## Kontrolleret

- Godkendte API-prefixes og autentificering før private ruter.
- Tenant-filter ved objektopslag og destruktive handlinger.
- Rollebegrænsning på regnskab, AI, migrering, SAF-T og driftsstatus.
- Signaturkontrol på betalings- og e-faktura-webhooks.
- Kryptering/secret-konfiguration, login-rate-limit, 2FA og sessionshåndtering.
- Låsning af bogførte posteringer og kreditnotaer.
- AI-godkendelsesporte, dokumentation, risikoniveau og beslutningsspor.
- Importstørrelse, feltvalidering, dubletter, HMAC-bundet forhåndsvisning og rollback-manifest.
- Backup-integritet, checksum og restore-drill.

## Resterende eksterne beviser

- Uafhængig penetrationstest.
- Restore-drill mod den faktiske produktionsbucket.
- End-to-end-test med valgt NemHandel/Peppol access point.
- Verificering af maildomænets SPF, DKIM og DMARC.
- Endelig juridisk og revisionsfaglig gennemgang.

Ingen kodegennemgang kan love fuldstændig sikkerhed eller juridisk overholdelse. Kritiske leverandør- og myndighedsafhængigheder skal dokumenteres før registreret drift.

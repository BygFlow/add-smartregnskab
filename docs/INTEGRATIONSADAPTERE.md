# Integrationsadaptere

| Adapter | Understøttet funktion | Produktionskrav |
|---|---|---|
| e-conomic | API-test/synkronisering samt CSV-migrering | Kundens API-aftale og credentials |
| Dinero | Valideret CSV-migrering | CSV-eksport fra kunden |
| Billy | Valideret CSV-migrering | CSV-eksport fra kunden |
| NemHandel/Peppol | OIOUBL 2.1, Peppol BIS 3, kvittering og inbound webhook | Access-point-URL/nøgle, validator og webhook-hemmelighed |
| Simply.com | SMTP-mail via outbox og revisionsspor | SMTP-host, bruger, adgangskode og MAIL_FROM |
| S3 | Krypteret ekstern backup, checksum og verifikation | Bucket, region og adgangsnøgler |
| Stripe | Abonnementsbetaling og signeret webhook | Secret key og webhook secret |

Adapterstatus vises i Driftsklarhed. “Klar” betyder, at nødvendig lokal konfiguration er fundet; det erstatter ikke en end-to-end-test med leverandøren.

# Drift, backup og gendannelse

## Produktionskrav

Sæt `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` og `S3_SECRET_ACCESS_KEY`.
`S3_ENDPOINT` bruges kun til en S3-kompatibel udbyder. Bucket'en skal være i en
aftalt EU/EØS-region, være privat, have versionering og helst Object Lock.

Applikationen opretter dagligt en fuld snapshot af en konsistent SQLite-kopi og
alle filer/bilag i `FILE_STORAGE_DIR`. Hvert objekt får en SHA-256-kontrolsum,
uploades med server-side AES-256-kryptering og samles i et krypteret manifest.
Database og manifest kontrolleres straks efter upload. Fejl fremgår af jobloggen.

## Gendannelseskontrol

Platformadministratoren kan kalde `POST /api/external-backup/verify` med
`{"key":"smartregnskab/backups/<fil>.db"}`. Systemet downloader kopien til en
midlertidig fil, kontrollerer database og samtlige bilag mod manifestets SHA-256,
åbner databasen read-only, kører `quick_check`, tæller tabeller og sletter
derefter testfilen.

En fuld restore skal foretages i et isoleret miljø. Stop applikationen, tag en
ekstra kopi af den nuværende database, gendan den verificerede fil, kør
migrationerne og gennemfør smoke-test før trafik åbnes igen.

Mål før kundedrift:

- RPO: højst 24 timer; vælg hyppigere backup ved større transaktionsmængde.
- RTO: dokumentér og test et realistisk mål, anbefalet højst fire timer.
- Månedlig automatisk download- og integritetskontrol.
- Kvartalsvis fuld restore-øvelse med dato, ansvarlig og resultat.
- Alarm ved fejlet backup eller backup ældre end 24 timer.

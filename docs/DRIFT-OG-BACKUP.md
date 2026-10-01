# Drift, backup og gendannelse

## Produktionskrav

Sæt `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` og `S3_SECRET_ACCESS_KEY`.
`S3_ENDPOINT` bruges kun til en S3-kompatibel udbyder. Bucket'en skal være i en
aftalt EU/EØS-region, være privat, have versionering og helst Object Lock.

Applikationen opretter dagligt en fuld snapshot af en konsistent SQLite-kopi og
alle filer/bilag i `FILE_STORAGE_DIR`. Hvert objekt får en SHA-256-kontrolsum,
uploades med server-side AES-256-kryptering og samles i et krypteret manifest.
Database og manifest kontrolleres straks efter upload. Manglende konfiguration
og fejl opretter en aktiv hændelse i systemets sundhedslog; en efterfølgende
vellykket backup lukker hændelsen automatisk.

## Særskilt femårsarkiv

Den rullende S3-backup ovenfor har sin egen retention (normalt 35 dage) og er
ikke et femårsarkiv. Koden kan kontrollere Object Lock og udføre en syntetisk,
låst læse-/gendannelsestest, men en automatisk kæde fra reelle bogførte
posteringer, fakturaer og originale bilag til arkiv-bucketen er endnu ikke
implementeret eller verificeret. `GET /api/external-backup/status` viser derfor
`bookkeepingArchive.ready: false`, også når arkiv-bucketen er konfigureret.
Markér ikke femårsopbevaring som opfyldt på baggrund af en backup eller en
syntetisk test. Arkivering kræver et afgrænset datavalg pr. virksomhed og
regnskabsår, låst objektversion med kvittering samt en isoleret læsetest.

`bookkeepingArchiveInventory` er nu en skrivebeskyttet forundersøgelse på en
konsistent databasekopi. Den tæller bogførte posteringer med linjer, fakturaer
med linjer, bogførte bilag og tilknyttede originaler pr. selskab og regnskabsår.
Den markerer manglende linjer, ufuldstændige filreferencer og ubundne dokumenter
for manuel afklaring. `verifyBookkeepingOriginals` kan derefter læse de
tilknyttede originaler tilbage og sammenholde størrelse og SHA-256 med
databasekopien. En filnøgle skal høre til samme virksomhed; ellers afbrydes
kontrollen. Funktionerne eksporterer eller uploader intet og kan ikke alene
bevise fuldstændighed: bl.a. kreditnotaer, momsperioder, regnskabsmaterialets
øvrige afhængigheder, fysiske originalfiler, planlægning, kvitteringer og
gendannelse skal stadig afklares, implementeres og prøves, før reel arkivering
kan aktiveres.

## Gendannelseskontrol

Platformadministratoren kan kalde `POST /api/external-backup/verify` med
`{"key":"smartregnskab/backups/<fil>.db"}`. Systemet downloader kopien til en
midlertidig fil, kontrollerer database og samtlige bilag mod manifestets SHA-256,
åbner databasen read-only, kører `quick_check`, tæller tabeller og sletter
derefter testfilen.

En fuld restore skal foretages i et isoleret miljø. Stop applikationen, tag en
ekstra kopi af den nuværende database, gendan den verificerede fil, kør
migrationerne og gennemfør smoke-test før trafik åbnes igen.

Den lokale, ikke-destruktive øvelse køres med `npm run restore:drill`. Den tager
en konsistent midlertidig kopi, kører SQLite `integrity_check`, kontrollerer de
centrale tabeller og sletter testkopien igen. Gem JSON-resultatet i driftsloggen.

Mål før kundedrift:

- RPO: højst 24 timer; vælg hyppigere backup ved større transaktionsmængde.
- RTO: dokumentér og test et realistisk mål, anbefalet højst fire timer.
- Månedlig automatisk download- og integritetskontrol.
- Kvartalsvis fuld restore-øvelse med dato, ansvarlig og resultat.
- Alarm ved fejlet backup eller backup ældre end 24 timer.

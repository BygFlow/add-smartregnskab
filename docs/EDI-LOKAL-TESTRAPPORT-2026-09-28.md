# Lokal EDI-testrapport — 28. september 2026

## Resultat

- SmartRegnskab: fuld `npm test` bestod (31 JavaScript- og 38 TypeScript-tests), `npm run check` bestod, og separat `npm run edi:build` bestod.
- Direkte test af krypteret offsite-backup, gendannelseskontrol, webhook-signatur, kø, dubletter og genforsøg bestod. Offsite-testen brugte et simuleret S3-lager; den beviser **ikke**, at et rigtigt objektlager er konfigureret.
- Læsebeskyttet cutover-kontrol bestod med testdatabaser. Den viste uafklarede dokumenter, uenighed om child-profil og overlappende dokument-ID'er uden at ændre data. De faktiske kundedatabaser er **ikke** åbnet eller ændret.
- En samlet fiktiv gateway-test af SmartRegnskab, Pro og Clean bestod med simuleret Sproom/validator. Den demonstrerer fælles CVR/child-profil, tre afsendere, én modtager og signerede status-/indgående hændelser. Den afprøver ikke Sprooms rigtige staging-tjeneste eller de tre komplette brugergrænseflader.
- Pro: `npm run test:bookkeeping-integrations` og `npm run test:invoicing` bestod. Pro har ikke et samlet `npm test`-script. Clean: `npm run check` og alle 365 tests i `npm test` bestod. SmartRegnskab: `npm run check` og 12 målrettede EDI-/isolationstests bestod igen. Ingen ny produktionstest er udført her.
- Første interne staging-spor er beskrevet i `EDI-STAGING-OG-LANCERINGSKONTROL.md`. Ingen Render-stagingtjenester er oprettet eller ændret, og ingen live faktura er sendt.

## Ikke testet / ikke frigivet

- Intet kald til Sproom staging eller produktion; ingen rigtige child-profiler eller NemHandel-registreringer.
- Ingen rigtig ekstern XML-validator, ingen rigtig S3-upload, ingen overvåget backupplan og ingen gendannelse i et separat driftsmiljø.
- Ingen gennemgang af de faktiske SmartRegnskab-dokumenter ved overgang fra ældre direkte Sproom-flow.
- Ingen fuld ende-til-ende-test mellem Pro, Clean, SmartRegnskab og et eksternt ERP.
- Hjemmeside, gateway og integration er ikke sat live af denne opgave.

Konklusion: **Lokal kode er forberedt og testet; staging og produktion er ikke godkendt.** Følg kontrolpunkterne i `EDI-STAGING-OG-LANCERINGSKONTROL.md` før pilot.

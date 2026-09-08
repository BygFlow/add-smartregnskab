# Informationssikkerhed og hændelsesberedskab

## Minimumsdrift

- Produktion må ikke starte med fallback-krypteringsnøgle eller demo-brugere.
- Administratorer skal anvende TOTP; adgange gennemgås kvartalsvist.
- Hemmeligheder må kun ligge i driftsplatformens secret store og roteres ved mistanke om eksponering.
- Backup skal ligge hos en uafhængig part i EU/EØS, have versionering/Object Lock og testes ved gendannelse mindst kvartalsvist.
- Kritiske afhængigheder og container-image scannes ved hver release.
- Logning må ikke indeholde adgangskoder, tokens, fulde betalingsdata eller unødvendige personoplysninger.

## Hændelsesflow

1. Begræns hændelsen: spærr kompromitterede konti/nøgler og isolér berørte integrationer uden at slette beviser.
2. Registrér starttid, opdager, systemer, virksomheder, datatyper og handlinger.
3. Bevar revisionslog og relevante snapshots med integritetskontrol.
4. Vurdér fortrolighed, integritet, tilgængelighed og risiko for registrerede.
5. Underret berørte dataansvarlige uden unødig forsinkelse. Den dataansvarlige vurderer anmeldelse til Datatilsynet inden for den gældende frist.
6. Gendan fra verificeret backup, skift nøgler og overvåg for gentagelse.
7. Dokumentér årsag, læring, korrigerende handlinger, ejer og frist.

## Beredskabsmål

- RPO: højst 24 timer, indtil hyppigere backup er konfigureret.
- RTO: mål på 8 timer ved almindelig tjenestefejl; større leverandørsvigt håndteres efter den indgåede driftsaftale.
- Kritisk sikkerhedshændelse eskaleres straks til den driftsansvarlige.

Kontakt, vagttelefon, stedfortræder og cyberforsikring skal indsættes i den underskrevne beredskabsplan.


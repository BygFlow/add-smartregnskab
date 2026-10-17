# SAF-T 2.1 — implementering og bevis

Status: 17. oktober 2026
Produktversion: 3.16.2
SAF-T-version: 2.1
Standardkontoplan: `20260101`

## Implementering

ADD SmartRegnskab kan:

- kontrollere virksomhedsoplysninger, kontomapping og balancer før eksport;
- mappe lokale konti til den fællesoffentlige standardkontoplan;
- eksportere dansk SAF-T 2.1 for en valgt periode;
- importere SAF-T 2.0 og 2.1 som forhåndsvisning;
- kræve en særskilt godkendelse, før en import bogføres;
- afvise filer over 25 MB, ukendte versioner, manglende hovedsektioner,
  ubalancerede posteringer og konti, der ikke findes i kontoplanen;
- føre importerede registreringer ind med kilde og revisionsspor.

## Tekniske indgange

- `GET /api/saft/status`
- `GET /api/saft/accounts`
- `PATCH /api/saft/accounts/:id`
- `GET /api/saft/export?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/saft/import/preview`
- `POST /api/saft/import`

Alle indgange kræver en bemyndiget virksomhedsrolle og arbejder i den aktive
virksomheds tenant-kontekst.

## Automatiske beviser

Produktions-smoke-testen opretter en balanceret journal, kører SAF-T-status,
eksporterer XML, kontrollerer blandt andet:

- `<AuditFileVersion>2.1</AuditFileVersion>`;
- den aktuelle produktversion i `<SoftwareVersion>`;
- den forventede transaktionsreference;
- at eksporten kan læses af importens forhåndsvisning.

Den samlede releaseverifikation den 17. oktober 2026 bestod 56 JavaScript-tests
og 75 TypeScript-/integrationstests uden kendte produktionssårbarheder.

## Bilag før myndighedsindsendelse

Følgende skal gemmes som særskilte, ikke-hemmelige releaseartefakter:

1. SAF-T-fil med syntetiske eller fuldt anonymiserede data.
2. Resultat fra validering mod Erhvervsstyrelsens seneste XSD.
3. SAF-T-klarhedsrapport, som viser alle anvendte kontis mapping.
4. Roundtrip-rapport med antal konti, posteringer og linjer samt afstemt
   samlet debet og kredit.
5. Skærmbillede eller loguddrag med produktversion, SAF-T-version og
   testtidspunkt.

Den syntetiske eksport fra release 3.16.2 er valideret uden fejl mod
Erhvervsstyrelsens officielle SAF-T 2.1-XSD. Resultat og filhashes findes i
`SAF-T-XSD-VALIDERING-2026-10-17.md`.

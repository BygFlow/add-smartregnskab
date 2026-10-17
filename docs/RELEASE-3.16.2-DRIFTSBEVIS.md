# Release 3.16.2 — SAF-T 2.1 XSD-kompatibilitet

Dato: 17. oktober 2026
Produkt: ADD SmartRegnskab
Udbyder: ADD SmartDrift ApS, CVR 46761898

## Leverance

- SAF-T 2.1-eksporten indeholder nu den obligatoriske momstabel (`TaxTable`).
- Momskoder fra den aktive kontoplan medtages uden at eksponere kundedata.
- Produktions-smoke-testen kan gemme en syntetisk SAF-T-bevisfil efter behov.
- Releaseversionen er ens i app, API, driftsstatus og SAF-T-metadata.

## Gennemførte kontroller

- Produktionsbuild: bestået.
- Produktions-smoke-test: bestået.
- Officiel SAF-T 2.1 XSD-validering: bestået uden fejl.
- Syntetisk SAF-T-fil og officiel XSD er SHA-256-hashet.

## Eksterne porte

Den syntetiske Object Lock- og gendannelsesprøve i den faktiske
produktionsbucket bestod 17. oktober 2026 og er dokumenteret i
`OBJECT-LOCK-RESTORE-BEVIS-2026-10-17.md`. En isoleret gendannelse af en rigtig
virksomheds repræsentative bogføringsdata mangler fortsat.

Clearhaus' endelige accept, den første rigtige Sproom/NemHandel-
produktionsprøve, den uvildige sikkerhedstest og Erhvervsstyrelsens
registrering er separate eksterne porte.

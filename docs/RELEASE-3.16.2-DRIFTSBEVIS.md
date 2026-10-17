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

Clearhaus' endelige accept, den første rigtige Sproom/NemHandel-
produktionsprøve, Object Lock-beviset, den uvildige sikkerhedstest og
Erhvervsstyrelsens registrering er separate eksterne porte.

# AI-governance og menneskelig godkendelse

Version: 1.0 — 8. september 2026

ADD SmartRegnskab bruger AI som bogføringsassistent, ikke som selvstændig juridisk eller revisionsmæssig ansvarlig. Systemet kan indlæse, kategorisere, foreslå, afstemme, forklare afvigelser og forberede dokumentation. Hvert forslag skal have kildegrundlag, begrundelse og sikkerhedsniveau i revisionssporet.

## Handlinger der kræver menneskelig godkendelse

- betalinger, bankoverførsler og ændring af betalingsmodtager
- indberetning eller rettelse hos Skattestyrelsen og andre myndigheder
- indsendelse af årsrapport eller erklæring
- endelig bogføring ved lav sikkerhed, manglende bilag eller væsentlig afvigelse
- ændring af kontoplan, momsopsætning, åbningsbalance eller lukkede perioder
- sletning, anonymisering eller eksport af personoplysninger
- adgangsændringer, API-nøgler og integrationer

Godkendelsen skal være knyttet til bruger, tidspunkt, objekt, før/efter-værdi og grundlag. AI må ikke omgå rollekrav eller genbruge en godkendelse til et andet objekt.

## Kontroller

Forslag med lav sikkerhed går til manuel kø. Regelændringer fra den automatiske overvågning går til faglig godkendelse og aktiveres aldrig alene på baggrund af en websideændring. Alle automatiske beslutninger skal kunne forklares og tilbageføres til inputdata og regelversion. Følsomme data må ikke sendes til en AI-leverandør uden databehandleraftale, dokumenteret behandlingsgrundlag og passende datareduktion.

## Ansvar og begrænsning

En dansk godkendt revisor, bogholder eller juridisk rådgiver skal godkende produktets regnskabs-, skatte- og complianceopsætning før registreret drift. 99 % automatisering er et produktmål, ikke en garanti for 100 % faglig korrekthed. Virksomhedens ledelse beholder ansvaret for bogføring og indberetninger.

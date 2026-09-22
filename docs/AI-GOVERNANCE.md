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

# Produktions-AI

ADD SmartRegnskab kan bruge OpenAI Responses API til assistentens tekstsvar, når
`OPENAI_API_KEY` er konfigureret. Kald sendes med `store: false`, et pseudonymt
`safety_identifier` og kun de aggregerede, verificerede fakta som assistenten
skal bruge. Personnavne, bilagstekster og komplette posteringer sendes ikke af
chat-endpointet.

Standardmodellen er `gpt-5.6-luna`, men kan fastlåses med `OPENAI_MODEL`.
Leverandørpriser og USD/DKK-kurs styres med
`OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION` og
`OPENAI_USD_DKK_RATE`, så omkostningsberegningen kan ændres uden kodeudrulning.
`OPENAI_MAX_REQUEST_COST_DKK` er den konservative reservation, der kontrolleres
før hvert betalt kald.

Hvis API-nøglen mangler, leverandøren fejler, eller kundeorganisationens kredit-
eller omkostningsloft er nået, fortsætter assistenten med det regelbaserede,
verificerede standardsvar. Ingen regnskabsfunktion bliver utilgængelig.

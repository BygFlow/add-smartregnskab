# SAF-T 2.1 — officiel XSD-validering

Dato: 17. oktober 2026
Produkt: ADD SmartRegnskab 3.16.2
Resultat: bestået uden valideringsfejl

## Grundlag

- Officiel kilde: Erhvervsstyrelsens GitLab-projekt `standard-filformater`.
- Git-commit: `ea9a4b5704c7a0e9646b0d3b928a59089d71cf0e`.
- XSD: `Danish_SAF-T_Financial_Schema_v_2_1.xsd`.
- Validator: lxml 6.1.1 / libxml2 XML Schema 1.0.
- Testdata: fuldt syntetisk virksomhed, kontoplan og balanceret postering.

## Filhashes

- Officiel XSD, SHA-256:
  `01CD75F7BF10F1CDAB00B48EA2579E97647D7D01FA00862F76EDD5D0A6AD8EC3`
- Syntetisk ADD SmartRegnskab-eksport, SHA-256:
  `D006EF8975CEFF9C310DF48ED2F84D02193FD8348A7212058861C7CCFA21A3F7`

## Forløb

Den første officielle validering fandt, at SAF-T 2.1 kræver en `TaxTable`.
Eksportgeneratoren blev rettet til at medtage virksomhedens anvendte momskoder
og en gyldig momstabel. Produktions-smoke-testen blev udvidet med en
regressionskontrol. Den efterfølgende validering returnerede `VALID=True` uden
fejl i skemaloggen.

Bevismappen indeholder den syntetiske XML, den officielle XSD og denne rapport.
Den indeholder ingen produktionsdata, adgangskoder eller API-nøgler.

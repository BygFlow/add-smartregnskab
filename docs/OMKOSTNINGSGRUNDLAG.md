# Omkostningsgrundlag for priser

Dato for kontrol: 21. september 2026

Status: **Delvist dokumenteret – priserne må ikke låses endnu.** Beløb i USD
og EUR skal omregnes efter den faktiske afregningskurs og tillægges relevant
moms, valutagebyr og eventuelle skatter.

## Kendte offentlige priser

### QuickPay og kortindløsning

Offentlig Merchant-pris:

- 99 kr. pr. måned;
- 0,25 kr. pr. transaktion;
- Visa/Mastercard-indløsning gennem QuickPay fra 1,35 % af beløbet, minimum
  0,75 kr., plus 0,22 kr.;
- 3-D Secure: 0,30 kr.;
- refundering: 1,75 kr.;
- indsigelse/chargeback: 240 kr.;
- branding af betalingsvinduet: 19 kr. pr. måned, hvis det vælges.

Kilde: [QuickPay – priser](https://quickpay.net/dk/prices-dk/).

En abonnementsbetaling på `P` kroner koster derfor som udgangspunkt mindst
`0,25 + max(0,75; 1,35 % × P) + 0,22 + 0,30` kroner, før QuickPays faste
månedspris fordeles mellem kunderne. Den endelige pris afhænger af indløser,
korttype, land, refunderinger og indsigelser.

### Render

Projektets `render.yaml` anvender aktuelt:

- én Starter-webservice: 7 USD pr. måned ifølge projektets konfiguration;
- 5 GB persistent disk;
- Render oplyser 0,25 USD pr. GB persistent disk pr. måned, altså 1,25 USD
  for den nuværende disk;
- båndbredde over den inkluderede kvote koster 0,15 USD pr. GB;
- Hobby-workspace er 0 USD; Pro-workspace er 25 USD pr. måned plus compute.

Foreløbig teknisk minimumsomkostning er dermed 8,25 USD pr. måned plus
båndbredde. Det er ikke et godkendt produktionsbudget: høj tilgængelighed,
separat database, worker, staging, overvågning og større kapacitet kan hæve
beløbet væsentligt.

Kilde: [Render – pricing](https://render.com/pricing).

### Hetzner Object Storage

- 4,99 EUR pr. måned ekskl. moms;
- inkluderer 1 TB lagring og 1 TB udgående trafik;
- ekstra lagring: 0,0067 EUR pr. TB-time;
- ekstra udgående trafik: 1,00 EUR pr. TB;
- S3-operationer og indgående trafik er uden særskilt betaling.

Kilder: [Hetzner Object Storage](https://www.hetzner.com/storage/object-storage/)
og [Hetzner-prisbeskrivelse](https://www.hetzner.com/pressroom/object-storage/).

### Mail

Programmet er konfigureret til transaktionsmail via Resend og bruger ikke
Simply-postkasserne som transaktionsmailtjeneste.

- Resend Free: 0 USD, 3.000 mails pr. måned og højst 100 pr. dag;
- Resend Pro: 20 USD pr. måned, 50.000 mails;
- ekstra mails på Pro: 0,90 USD pr. påbegyndt 1.000 mails;
- Simply Basic Mail: introduktionspris 0,36 USD pr. måned første år, derefter
  6,00 USD pr. måned for fem postkasser;
- Simply Mail Plus: 7,14 USD pr. måned første år, derefter 13,14 USD pr. måned.

Kilder: [Resend – pricing](https://resend.com/pricing) og
[Simply – e-mail](https://www.simply.com/dk/email/).

### AI

Den officielle OpenAI API-pris for standardbehandling pr. én million tokens
er blandt andet:

| Model | Input | Cachet input | Output |
| --- | ---: | ---: | ---: |
| GPT-5.6 Luna | 0,20 USD | 0,02 USD | 1,20 USD |
| GPT-5.6 Terra | 2,00 USD | 0,20 USD | 12,00 USD |
| GPT-5.6 Sol | 4,00 USD | 0,40 USD | 20,00 USD |

Kilde: [OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

**Kritisk fund:** Den nuværende kode har AI-regler, forslag, godkendelseslog,
credits og interne omkostningslofter, men ingen tilsluttet ekstern AI-model og
ingen faktisk tokenmåling. De nuværende “AI-handlinger” kan derfor ikke bruges
som et økonomisk prisgrundlag endnu.

Før AI-priser godkendes, skal hver handlingstype testes med faktisk input,
output, dokumentbilleder, retries og valgt model. Billige rutineopgaver og
dyrere komplekse kontroller skal have forskellige interne omkostningsprofiler,
selv hvis kunden ser én samlet credit-type.

## Modtagne, men ikke bindende leverandøroplysninger

### Sproom / NemHandel

Det modtagne ISV-materiale angiver følgende månedlige dokumenttrin:

| Dokumenter/transaktioner | Månedlig pris | Pris pr. dokument |
| ---: | ---: | ---: |
| 500 | 399 kr. | 0,80 kr. |
| 1.000 | 749 kr. | 0,75 kr. |
| 2.000 | 1.399 kr. | 0,70 kr. |
| 5.000 | 2.999 kr. | 0,60 kr. |
| 10.000 | 4.999 kr. | 0,50 kr. |
| 25.000 | 9.999 kr. | 0,40 kr. |
| 50.000 | 14.999 kr. | 0,30 kr. |
| 75.000 | 19.999 kr. | 0,27 kr. |
| 100.000 | 24.999 kr. | 0,25 kr. |

Materialet oplyser samme pris for sendte og modtagne dokumenter, og at ubrugt
forbrug ikke overføres. Den modtagne e-mail oplyser desuden foreløbigt gratis
child companies, NemHandel/Peppol-registrering og integration service ved en
ISV-aftale. Oplysningerne er ikke en underskrevet produktionsaftale og skal
bekræftes med aftaleperiode, minimumsforbrug, regulering, SLA, support,
opsigelse, databehandleraftale og alle gebyrer.

## Priser der mangler et individuelt tilbud

### Mastercard Open Banking / Aiia

Mastercard offentliggør ikke en anvendelig standardpris for den relevante
produktionsaftale. Følgende skal stå i tilbuddet:

- fast platformspris og minimumsforbrug;
- pris pr. aktiv virksomhed, bankforbindelse og konto;
- pris pr. login, samtykkefornyelse og API-kald;
- pris og vilkår for Account Information Service;
- eventuelle krav om AISP/PISP eller brug af Mastercards licenserede løsning;
- sandbox, produktion, support, SLA, databehandling og opsigelse.

Kilder: [Mastercard Open Banking Developer Portal](https://devportal.openbanking.mastercard.com/)
og [Mastercard om licensmodellen](https://www.mastercard.com/de/de/business/open-finance/help-articles/do-i-need-a-license-to-use-aiia-enterprise.html).

### Alternativ til Sproom

Storecove og andre access points offentliggør ikke tilstrækkelige ISV-priser
til en bindende sammenligning. Der skal indhentes et tilbud med samme volumen,
child-company-model og danske OIOUBL/NemHandel-krav som Sproom-tilbuddet.

## Første økonomiske konklusion

1. NemHandel kan indgå i pakkerne, fordi den foreløbige marginalpris er under
   én krone pr. dokument, men det faste dokumenttrin skal fordeles over den
   samlede kundeportefølje.
2. Et særskilt aktiveringsgebyr for NemHandel er ikke nødvendigt. Inkluderet
   forbrug og en offentlig overforbrugspris er mere konkurrencedygtigt.
3. QuickPay er ikke den store omkostningsrisiko; indløserprocent, chargebacks
   og den faste pris skal dog indgå i dækningsbidraget.
4. AI-prisen må ikke låses, før en rigtig modelintegration og repræsentative
   målinger findes.
5. Aiia er den største ukendte løbende leverandøromkostning og blokerer den
   endelige pakkepris.
6. Starter-hosting er et pilotbudget, ikke dokumentation for en skalerbar og
   redundant regnskabsplatform.

## Blokerende næste skridt

- Få et skriftligt, bindende Aiia-produktionstilbud.
- Få Sprooms endelige kontraktudkast og et sammenligneligt alternativt tilbud.
- Vælg AI-modelstrategi, implementer faktisk forbrugsmåling og kør en testpakke.
- Hent den aktuelle Render-faktura og dimensionér produktion, staging og
  gendannelsesmiljø.
- Bekræft QuickPay-indløseraftalen og de faktiske kortgebyrer på merchantkontoen.
- Mål månedlige mails, backupstørrelse, trafik og gennemsnitlig supporttid.

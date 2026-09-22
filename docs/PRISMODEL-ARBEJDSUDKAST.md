# Prismodel – arbejdsudkast

Status: **Ikke godkendt til produktion eller kundeaftaler**

Det dokumenterede omkostningsgrundlag findes i
[`OMKOSTNINGSGRUNDLAG.md`](./OMKOSTNINGSGRUNDLAG.md). Ensartede kladder til
bindende tilbud findes i [`TILBUDSFORESPORGSLER.md`](./TILBUDSFORESPORGSLER.md).

Priserne må først markeres som endelige, når alle direkte leverandør- og
driftsomkostninger er dokumenteret. Dette dokument er beslutningsgrundlag og
ændrer ikke eksisterende abonnementer eller betalinger.

## Foreløbig model

| Pakke | Foreløbig grundpris pr. måned | Juridiske CVR | AI | NemHandel |
| --- | ---: | ---: | --- | --- |
| Start | 199 kr. | 1 | Tilkøb | Send/modtag indgår; foreløbigt 25 dokumenter pr. måned |
| Drift | 399 kr. | 1 | Tilkøb | Send/modtag indgår; foreløbigt 25 dokumenter pr. måned |
| Professionel | 799 kr. | 1 | Foreløbigt 1.500 handlinger | Foreløbigt 100 dokumenter pr. måned |
| Koncern | 1.499 kr. | 3 | Foreløbigt 4.000 handlinger | Foreløbigt 250 dokumenter pr. måned |

Foreløbigt forslag for ekstra juridisk CVR: 299 kr. pr. måned. SE-numre under
samme CVR er ikke et ekstra betalende selskab.

NemHandel er ikke et aktiveringstilkøb. Et eventuelt forbrugstillæg over det
inkluderede antal dokumenter må først fastsættes, når den valgte access
point-leverandørs bindende ISV-pris er kendt. Ekstra forbrug må ikke aktiveres
eller faktureres uden en offentliggjort pris og kundens accept.

Posteringstrin vurderes separat fra funktionspakken. De nuværende trin er kun
et arbejdsudkast, indtil database-, backup-, support- og revisionsomkostninger
ved hvert forbrugsniveau er beregnet.

## Omkostninger der skal dokumenteres

| Område | Leverandør/mulighed | Skal dokumenteres | Status |
| --- | --- | --- | --- |
| NemHandel og Peppol | Sproom samt mindst ét alternativ | Fast ISV-beløb, pris pr. sendt/modtaget dokument, minimumsforbrug, child companies, staging, support og opsigelse | Foreløbig Sproom-prisliste modtaget; kontrakt og alternativ mangler |
| AI | Valgte AI-modeller | Pris pr. input/output-token, gennemsnitsforbrug pr. handling, fejl/retries og maksimal leverandøromkostning pr. pakke | Offentlige tokenpriser dokumenteret; rigtig modelintegration og målinger mangler |
| Bankdata | Mastercard Open Banking/Aiia | Fast pris, pris pr. bankforbindelse/konto/kald, samtykkefornyelse og minimumsforbrug | Afventer produktionsaftale |
| Betaling | QuickPay og indløser | Abonnement, transaktionspris, kortgebyrer, refunderinger og chargebacks | Offentlig QuickPay-pris dokumenteret; faktisk indløseraftale mangler |
| Database og applikationsdrift | Render eller endelig driftsplatform | Produktion, database, lager, trafik, skalering, logning og testmiljø | Pilotkonfiguration dokumenteret; produktionskapacitet mangler |
| Ekstern backup | Hetzner Object Storage eller alternativ | Lager, trafik, API-kald, retention, restore-test og geografisk placering | Offentlig pris dokumenteret; faktisk forbrug og restore-kapacitet mangler |
| E-mail | Resend til transaktionsmail og Simply.com til postkasser | Konti, API/SMTP-forbrug, leveringsgrænser og transaktionsmail | Offentlige priser dokumenteret; faktisk volumen mangler |
| Overvågning og sikkerhed | Valgte tjenester | Fejllogning, oppetid, sårbarhedskontrol, certifikater og hændelseshåndtering | Afventer valg |
| Support og administration | ADD SmartDrift ApS | Supporttid, onboarding, bogholder/revisorportal, fakturering og tab på debitorer | Afventer tidsmåling |

## Godkendelseskrav før priserne låses

1. Der foreligger skriftlige priser eller kontraktudkast for alle eksterne
   leverandører.
2. AI er belastningstestet med realistiske danske bilag og arbejdsgange.
3. Der er beregnet dækningsbidrag ved lavt, normalt og højt forbrug for hver
   pakke.
4. Professionel og Koncern kan ikke give flere selskaber billigere end en
   mindre pakke med ekstra CVR.
5. Alle inkluderede mængder håndhæves og måles server-side.
6. Overforbrugspris, varsling og spærringsregler fremgår tydeligt før køb.
7. Prissiden, QuickPay-beløbene, abonnementsfakturaen og handelsbetingelserne
   viser samme godkendte prisversion.
8. ADD SmartDrift ApS godkender skriftligt prisversionen og ikrafttrædelsesdatoen.

## Beslutningsregel

En pakke kan først frigives, når forventet dækningsbidrag fortsat er positivt
ved det højeste inkluderede normale forbrug og der samtidig er afsat plads til
support, fejl, retries, betalingsgebyrer og drift. Ukendte leverandørpriser må
ikke erstattes af antagelser i den endelige kundevendte pris.

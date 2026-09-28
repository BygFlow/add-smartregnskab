# ADD Connect: fakturaejerskab og bogføring

Status: lokal pilot i SmartRegnskab, Pro og Clean. Ingen produktionstest eller udrulning er gennemført.

## Hvem gør hvad?

- Et tilsluttet faktureringsprogram (først Pro/Clean) opretter, nummererer, færdiggør og sender fakturaen til slutkunden via sin valgte kanal, også EDI/NemHandel hvis det er konfigureret. Det håndterer leveringskvittering og kreditnota.
- SmartRegnskab kan modtage enten en kladde eller en **allerede udstedt** faktura fra et godkendt tilsluttet program. For den udstedte faktura bevarer det oprindeligt fakturanummer og bogfører én gang uden genafsendelse.
- En virksomhed, der **kun** bruger SmartRegnskab, kan oprette en kladde dér. Ved direkte afsendelse vedhæftes PDF, og den sendte faktura bogføres i SmartRegnskab. Kladder bogføres ikke.
- En Pro/Clean-kunde uden SmartRegnskab bruger et særskilt valgt regnskabssystem eller manuel eksport. Der oprettes ikke automatisk en SmartRegnskab-virksomhed eller EDI-registrering.

Tenant (`companyId`) udledes af den begrænsede API-nøgle, aldrig af JSON. En nøgle hører til én juridisk virksomheds regnskab. Pro/Clean er indbyggede kilder; et andet program kan bruge et `external_...` program-ID og en særskilt API-nøgle bundet til både virksomheden og dette program. Nøglen kan oprettes på API-nøglesiden af virksomhedens leder. Det eksterne program skal stadig implementere og teste kontrakten; en API-nøgle alene skaber ingen færdig integration.

Et eksternt program vælger **pr. faktura** ét af to flows:

- `invoice.draft`: Programmet overdrager fakturagrundlag og linjer. SmartRegnskab giver kladden sit eget fakturanummer; den er hverken sendt eller bogført. En bruger kontrollerer og sender den fra SmartRegnskab, som derefter bogfører den.
- `invoice.issued`: Programmet har allerede udstedt og sendt fakturaen. Det afleverer oprindeligt fakturanummer, linjer, afsendelseskvittering og det **eksakte dokument, der blev sendt**, som base64 plus SHA-256. For e-mail er dokumentet PDF; for `deliveryChannel: "edi"` er det den originale e-faktura i XML (`documentMimeType: "application/xml"`). SmartRegnskab kontrollerer hash, arkiverer dokumentet privat for virksomheden og bogfører uden genafsendelse.

`documentBase64` må højst være 8.000.000 tegn. Sendere skal dele store synkroniseringer i mindre batches, så hver HTTP-anmodning holder sig under appens 12 MB JSON-grænse. En EDI-kvittering er ikke det samme som en PDF-kvittering; Sproom-/transportstatus skal kontrolleres separat.

Samme `sourceId` fra samme program kan ikke bruges til begge flows. Et program må ikke kalde `invoice.issued` efter at have overdraget den samme faktura som kladde. Kladdeimport kan i denne pilot ikke ændre en eksisterende kladde automatisk.

Det tilsluttede program kan efterfølgende læse `GET /api/add-connect/records?sourceProduct=external_other_invoice_app&sourceId=draft-123` med sin læseberettigede nøgle. Svaret viser SmartRegnskabs fakturanummer, status, afsendelsestidspunkt og om bogføring er sket. Kilden kan ikke slå andre programmer eller virksomheder op.

Eksempel på kladde fra et fiktivt eksternt program (med kilde-scopet `add_connect:source:external_other_invoice_app`):

```json
{
  "sourceProduct": "external_other_invoice_app",
  "idempotencyKey": "draft-other-123-v1",
  "events": [
    { "type": "customer.upsert", "data": { "sourceId": "customer-7", "name": "Fiktiv slutkunde" } },
    { "type": "invoice.draft", "data": {
      "sourceId": "draft-123", "customerSourceId": "customer-7", "issueDate": "2026-09-27",
      "currency": "DKK", "lines": [
        { "description": "Fiktiv ydelse", "quantity": 1, "unitPrice": 100, "amount": 100, "vatRate": 25 }
      ]
    } }
  ]
}
```

## Udstedt faktura ind i SmartRegnskab

`POST /api/add-connect/sync`, `Authorization: Bearer <virksomhedens ADD Connect-nøgle>` med `add_connect:write`. Fiktivt eksempel:

```json
{
  "sourceProduct": "smartdrift_pro",
  "idempotencyKey": "issued-pro-123-v1",
  "events": [
    { "type": "customer.upsert", "data": { "sourceId": "customer-7", "name": "Fiktiv slutkunde" } },
    {
      "type": "invoice.issued",
      "data": {
        "sourceId": "pro-invoice-123",
        "customerSourceId": "customer-7",
        "invoiceNumber": "PRO-2026-123",
        "issueDate": "2026-09-27",
        "sentAt": "2026-09-27T10:00:00.000Z",
        "deliveryChannel": "email",
        "deliveryReference": "message-id-123",
        "documentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "documentBase64": "<base64 af den eksakte afsendte PDF; hash skal matche>",
        "netAmount": 100,
        "vatAmount": 25,
        "totalAmount": 125,
        "ledgerAccounts": { "receivables": "1200", "revenue": "3000", "outputVat": "2310" },
        "lines": [{ "description": "Fiktiv ydelse", "quantity": 1, "unitPrice": 100, "amount": 100, "vatRate": 25 }]
      }
    }
  ]
}
```

Kunden synkroniseres før fakturaen. Debitor-, omsætnings- og eventuel salgsmomskonto skal eksistere og være aktiv hos samme virksomhed. Original-PDF eller -XML gemmes i privat fillager med virksomhedspræfiks; faktura, linjer, afbalanceret journal, dokumentmetadata og kildemapping oprettes i én database-transaktion. Hvis transaktionen fejler, forsøges den gemte fil fjernet. Ukendt konto, ubalanceret beløb, ændret dokument eller dublet afvises. XML-fakturaen skal desuden stemme med fakturanummer og totalbeløb. Genforsøg skal bruge **samme** idempotencyKey. Det ældre `invoice.upsert` afvises nu; kladder overdrages udelukkende med `invoice.draft`. Kilden kan læse sin arkiverede original via `GET /api/add-connect/documents?sourceProduct=...&sourceId=...` med læseadgang. Denne API giver ikke adgang til andre virksomheders eller programmers dokumenter. Den almindelige faktura-PDF-visning bruger originalen, hvis den er PDF; ved EDI er original-XML tilgængelig særskilt på `/api/invoices/:id/original`.

## Før produktionsbrug

1. Pro/Clean-senderne er ændret lokalt til at kræve dokumenteret afsendelse og bevare eksakt PDF. Begge skal fortsat testes ende til ende med en isoleret testvirksomhed, uden rigtige kundedata. Hvert yderligere program kræver sin egen afprøvede afsender.
2. Den oprindelige PDF arkiveres nu ved import. Produktion afviser import, hvis hverken S3 eller `FILE_STORAGE_DIR` er konfigureret. Det skal desuden verificeres, at fillageret faktisk er vedvarende. EDI-XML, udbyderens kvittering, kreditnotaer, fast opbevaringspolitik, restoreprøve og revisionssikker adgangskontrol skal fortsat afklares. En hash og en tekstreference er ikke i sig selv en leveringskvittering. Derfor er løsningen endnu ikke klar til at påstå fuld arkiverings- eller lovmæssig efterlevelse.
3. Kontoopsætning skal godkendes i SmartRegnskab, før en integration må bruge den. `ledgerAccounts` i eventet er en pilotkontrakt, ikke selvbetjeningsgodkendelse til bogføring.
4. Betalingsstatus må kun opdateres fra autoritativ betalings-/bankafstemning; `payment.updated` er ikke i sig selv betalingsbevis.
5. Test kreditnota, rettelser, valuta/moms, forsinkede events, genforsøg og lukkede perioder før kundedrift. Importen må aldrig udløse EDI- eller fakturaafsendelse.

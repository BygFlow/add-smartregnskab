# Bogholder- og revisorportal 3.7.0

## Leveret

- Roller: `bogholder`, `revisor` og `revisor_admin`.
- Flerklientadgang med ét login og servervalideret klientskifte.
- Rettigheder pr. bruger og klient: læs, skriv, slet, anmod om godkendelse, godkend, dokumenter, audit og brugeradministration.
- Revisor er skrivebeskyttet som standard. Bogholder kan arbejde, men kan ikke slette. Revisionsadministrator kan administrere fagteamet.
- Obligatorisk tofaktorgodkendelse før klientdata åbnes.
- Invitation via e-mail, udløbsdato, suspension og tilbagekaldelse. Tilbagekaldelse lukker aktive sessioner.
- Fire-øjne-princip: en bruger kan aldrig godkende sin egen anmodning.
- Eksisterende revisorportal, revisionspakke, SAF-T og auditspor er tilgængelige i samme klientkontekst.

## Sikkerhedsmodel

Den aktive klient gemmes i den serverstyrede session. Klienten accepteres kun, hvis der findes et aktivt, ikke-udløbet medlemskab. URL-parametre kan ikke bruges til at åbne en anden virksomheds data. Alle fagbrugere passerer en fail-closed adgangsvagt før API-ruterne.

## Resterende eksterne eller organisatoriske punkter

Følgende kan ikke færdiggøres alene i programkoden:

1. Indgå databehandleraftaler med hvert bogholder- eller revisionsfirma.
2. Fastlæg kundens konkrete fuldmagter til moms, bank, Skat og NemHandel.
3. Kontrollér identitet og autorisation, hvis en bruger præsenteres som godkendt eller statsautoriseret revisor.
4. Gennemfør en pilot med en rigtig bogholder og revisor samt dokumentér accepttesten.
5. Fastlæg support-SLA, ansvar ved fejl og procedure for ophør/overdragelse af klientdata.
6. Konfigurér ekstern backup, NemHandel-adgangspunkt og øvrige produktionsnøgler.

Disse punkter er drifts- og aftalekrav; systemet må ikke automatisk påstå, at en fagbruger er autoriseret.

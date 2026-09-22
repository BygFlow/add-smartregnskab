# Sletning, eksport og exit

Version: 1.1 — 22. september 2026

## Forløb ved ophør

1. Opsigelsen registreres til udløbet af den betalte periode.
2. Kunden eksporterer SAF-T, kontoplan, posteringer, fakturaer, kreditnotaer,
   kunder, leverandører, momsgrundlag, bilag og revisionsspor inden udløbet.
3. En sletteinstruks valideres mod afsenderens identitet, rolle, virksomhedens
   rettigheder, bogføringsloven og eventuelle verserende retskrav.
4. Konto-, kontakt- og adgangsdata, som ikke skal bevares, slettes eller
   anonymiseres med et driftsmål på højst 30 dage efter udløb og valideret
   instruks. Handlingen registreres i revisionssporet.
5. Regnskabsmateriale bevares som udgangspunkt i fem år fra udgangen af det
   regnskabsår, materialet vedrører. Efter udløb slettes eller anonymiseres det,
   hvis ingen anden lovlig opbevaring gælder.
6. Kunden kan anmode om en skriftlig bekræftelse på udført eksport og sletning.

## Backupretention

- Alle nye eksterne snapshots krypteres på applikationssiden og verificeres
  efter upload.
- `S3_BACKUP_RETENTION_DAYS` er 35 dage i produktion og accepterer kun værdier
  fra 7 til 365 dage.
- Efter en verificeret ny backup slettes komplette snapshots, hvis nyeste objekt
  er ældre end retentionfristen. Det aktuelle snapshot slettes aldrig af samme
  kørsel.
- Lokale backupfiler med produktets kontrollerede filnavn beskæres efter samme
  periode. Andre filer berøres ikke.
- Ved restore genanvendes tidligere sletteinstrukser, før den gendannede kopi
  sættes i almindelig drift.

## Dokumentationskrav

Hver slette- eller exit-sag skal indeholde kunde, virksomhed, instruks,
identitetskontrol, lovkontrol, eksportstatus, udførte handlinger, ansvarlig,
tidsstempler og eventuelle undtagelser. Standardperioderne fremgår af den
offentlige side om dataopbevaring; konkret lov eller en dokumenteret tvist kan
kræve længere opbevaring.

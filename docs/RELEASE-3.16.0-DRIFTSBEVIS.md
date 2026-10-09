# Release 3.16.0 — driftsbevis

Dato: 9. oktober 2026
Produkt: ADD SmartRegnskab
Udbyder: ADD SmartDrift ApS, CVR 46761898

## Leverance

- Mobil bilagsarbejdsgang til Android og mobilweb.
- Virksomhedsvælger med serversidekontrolleret adgang.
- Kamera- og filupload via den eksisterende tenant-isolerede bilagsindbakke.
- AI-udtræk som forslag med obligatorisk menneskelig godkendelse før bogføring.
- Privat kamerahåndtering uden lagring i telefonens galleri.
- Android-systembackup af appdata er deaktiveret.

## Gennemførte kontroller

- TypeScript-kontrol: bestået.
- Produktionsbuild: bestået.
- Automatiske tests: 101 deltests bestået.
- Sikkerhedsselvtest: 203 kildefiler kontrolleret, 0 fund.
- Produktionsafhængigheder: 0 kendte sårbarheder ved `npm audit`.
- Teknisk release-readiness: bestået; eksterne leverandørporte fremgår særskilt nedenfor.
- Android Capacitor-synkronisering: bestået.
- Android debug-build: bestået.
- Android-manifest: kamera og netværk er tilladt; placering er ikke tilladt; systembackup er deaktiveret.

## Bogføringskontrol

AI kan alene udtrække og foreslå leverandør, fakturadato, fakturanummer,
beløb, moms og udgiftskonto. Bogføring foretages kun gennem det særskilte
godkendelses-endpoint efter en aktiv brugerhandling. Godkendelsen registreres i
revisionssporet. Dubletter, periodeafslutning, dokument- og posteringsgrænser,
konti, modtager-CVR, valuta og moms kontrolleres på serveren.

## Opbevaring

Mobilappen bruger samme fil- og arkiveringsvej som webudgaven. Denne release
ændrer ikke de eksisterende krav til den eksterne, krypterede femårsarkivering,
Object Lock, restore-øvelser eller den separate løbende sikkerhedskopi.

## Eksterne udgivelsesporte

- Google Play-signering og butiksudgivelse kræver virksomhedens Play Console og release-keystore.
- iOS kræver Apple Developer-konto, macOS/Xcode, signering og App Store-godkendelse.
- Clearhaus-, Sproom-, AiiA- og myndighedsgodkendelser er separate eksterne porte og dokumenteres ikke som afsluttet af denne build.

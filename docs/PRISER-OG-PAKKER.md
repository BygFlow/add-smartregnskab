# Priser, pakker og prøveforløb

De aktive priser hentes fra plan-tabellen og vises i produktet. Planernes funktions- og kapacitetsgrænser håndhæves server-side.

## Kontroller før salg

- Pris skal vises med valuta, momsforhold og faktureringsperiode.
- Prøveperiodens slutdato og hvad der sker bagefter skal stå tydeligt.
- Betalt abonnement kræver en udtrykkelig brugerhandling; prøveoprettelse må ikke udløse skjult betaling.
- Opsigelse, dataportabilitet, sletning og adgang efter ophør følger abonnementsvilkår og exitprocedure.
- Prisændringer versionsstyres og varsles efter de gældende aftaler.

Produktet kan oprette prøveabonnement uden betalingsadapter. Automatisk kortbetaling er kun tilgængelig, når QuickPay API-nøglen og den signaturkontrollerede callback er konfigureret.

## Kapacitetsgrænser

Pakkerne begrænses ikke efter antal kunder eller leverandører. De relevante kapacitetsgrænser er:

- bilag pr. kalendermåned;
- posteringer pr. kalendermåned;
- virksomheder i abonnementet;
- aktive integrationer.

Start har 500 bilag, 5.000 posteringer, 1 virksomhed og 2 integrationer. Virksomhed har 2.500 bilag, 25.000 posteringer, 1 virksomhed og 5 integrationer. Professionel har 10.000 bilag, 100.000 posteringer, 3 virksomheder og 15 integrationer. Enterprise er ubegrænset. Oprettelse af bilag, posteringer og integrationer afvises server-side, når den relevante grænse er nået.

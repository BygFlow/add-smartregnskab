# Priser, pakker og prøveforløb

De aktive priser hentes fra plan-tabellen og vises i produktet. Planernes funktions- og kapacitetsgrænser håndhæves server-side.

## Kontroller før salg

- Pris skal vises med valuta, momsforhold og faktureringsperiode.
- Prøveperiodens slutdato og hvad der sker bagefter skal stå tydeligt.
- Betalt abonnement kræver en udtrykkelig brugerhandling; prøveoprettelse må ikke udløse skjult betaling.
- Opsigelse, dataportabilitet, sletning og adgang efter ophør følger abonnementsvilkår og exitprocedure.
- Prisændringer versionsstyres og varsles efter de gældende aftaler.

Produktet kan oprette prøveabonnement uden betalingsadapter. Automatisk kortbetaling er kun tilgængelig, når Stripe-nøgler og signaturkontrolleret webhook er konfigureret.

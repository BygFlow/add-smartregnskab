export const LEGAL_UPDATED_AT = "22. september 2026";
export const DPA_VERSION = "1.0-2026-09-22";

export type LegalSection = readonly [heading: string, body: string];

export const dpaSections: readonly LegalSection[] = [
  ["1. Parter og aftalens genstand", "Den dataansvarlige er den kundeorganisation, som indgår aftalen om ADD SmartRegnskab. Databehandleren er ADD SmartDrift ApS, CVR 46761898, Lynæs Søpark 49, 3390 Hundested. Aftalen regulerer databehandlerens behandling af personoplysninger på kundens vegne og er en del af kundens hovedaftale om ADD SmartRegnskab."],
  ["2. Varighed, karakter og formål", "Behandlingen varer, så længe hovedaftalen løber, samt i den nødvendige afviklings- og sletteperiode. Formålet er at levere bogføring, bilag, fakturering, bankafstemning, moms, rapportering, automatisering, support, sikkerhed, backup og dokumenteret revisionsspor. Behandlingen består i indsamling, registrering, organisering, opbevaring, søgning, visning, ændring, overførsel efter instruks, backup, eksport og sletning."],
  ["3. Registrerede og oplysninger", "Registrerede kan være kundens brugere, ejere, ansatte, kontaktpersoner, kunder, leverandører, rådgivere og andre personer i regnskabsmaterialet. Oplysninger kan omfatte identitets- og kontaktdata, virksomhedsrelationer, bruger- og sikkerhedslog, bilag, fakturaer, posteringer, betalings- og bankdata, korrespondance og revisionsspor. Kunden må ikke indlæse følsomme oplysninger eller CPR-numre, medmindre det er nødvendigt, lovligt og særskilt sikret."],
  ["4. Dokumenteret instruks", "ADD SmartDrift ApS behandler kun oplysninger efter kundens dokumenterede instruks, herunder denne aftale, hovedaftalen og de funktioner kunden aktiverer. Hvis en instruks efter databehandlerens vurdering strider mod databeskyttelsesreglerne, underrettes kunden straks, og den berørte behandling sættes om muligt på pause."],
  ["5. Fortrolighed og adgang", "Personer med adgang er underlagt fortrolighed og får kun den mindst nødvendige adgang. Adgange tildeles efter rolle, væsentlige handlinger logges, og fagpersoner skal anvende deres personlige konto. Kunden er ansvarlig for korrekte roller, sikre loginoplysninger og rettidig lukning af egne brugere."],
  ["6. Behandlingssikkerhed", "Der anvendes passende tekniske og organisatoriske foranstaltninger efter risikoen, herunder virksomhedsadskillelse, rollebaseret adgang, tofaktorgodkendelse for fagbrugere, sessionsbeskyttelse, krypteret transport, kontrolleret fillagring, logning, backup, gendannelseskontrol, sårbarhedsrettelser og hændelseshåndtering. Foranstaltningerne vurderes løbende og dokumenteres i det omfang, det er nødvendigt for kundens kontrol."],
  ["7. Underdatabehandlere", "Kunden giver generel skriftlig godkendelse til de underdatabehandlere, der fremgår af den til enhver tid gældende underdatabehandlerliste. ADD SmartDrift ApS pålægger dem tilsvarende databeskyttelsesforpligtelser. Planlagte tilføjelser eller udskiftninger varsles, så kunden kan gøre en saglig indsigelse gældende inden ændringen. Valgfrie leverandører anvendes kun, når kunden aktiverer den tilhørende funktion."],
  ["8. Overførsler uden for EU/EØS", "Personoplysninger overføres ikke uden for EU/EØS uden dokumenteret instruks og et gyldigt overførselsgrundlag. Hvor en leverandør eller dennes underleverandør kan medføre en tredjelandsoverførsel, skal ADD SmartDrift ApS dokumentere grundlaget, foretage den nødvendige risikovurdering og anvende relevante supplerende foranstaltninger."],
  ["9. Bistand til kunden", "Under hensyn til behandlingens karakter bistår ADD SmartDrift ApS kunden med anmodninger om indsigt, rettelse, sletning, begrænsning, indsigelse og dataportabilitet samt med sikkerhedsvurderinger, konsekvensanalyser og forudgående høring. Kunden er fortsat ansvarlig for den juridiske vurdering og svaret til den registrerede."],
  ["10. Brud på persondatasikkerheden", "ADD SmartDrift ApS underretter kunden uden unødig forsinkelse efter at være blevet bekendt med et brud, der vedrører kundens oplysninger. Underretningen gives løbende og indeholder, i det omfang oplysningerne er kendt, bruddets karakter, berørte kategorier og antal, mulige konsekvenser, kontaktpunkt og iværksatte eller foreslåede foranstaltninger."],
  ["11. Tilbagelevering og sletning", "Ved hovedaftalens ophør kan kunden vælge en tilgængelig eksport eller anmode om tilbagelevering. Derefter slettes eller anonymiseres personoplysninger og kopier efter den beskrevne afviklingsproces, medmindre dansk ret eller EU-ret kræver fortsat opbevaring. Data i backup bliver utilgængelige for almindelig drift og udløber efter backupcyklussen; hvis en ældre backup gendannes, genanvendes registrerede sletteinstrukser."],
  ["12. Dokumentation og revision", "ADD SmartDrift ApS stiller de oplysninger til rådighed, der med rimelighed er nødvendige for at dokumentere artikel 28-overholdelse, og medvirker til en rimeligt varslet revision udført af kunden eller en uafhængig revisor. Revision gennemføres under fortrolighed, uden adgang til andre kunders oplysninger og uden unødig forstyrrelse af driften."],
  ["13. Rangorden og ændringer", "Ved modstrid går denne databehandleraftale forud for hovedaftalen i spørgsmål om behandling af personoplysninger. Væsentlige ændringer versionsstyres og varsles. En ny version kræver ny accept, når ændringen påvirker kundens rettigheder, instrukser eller risici væsentligt."],
] as const;

export type SubprocessorEntry = {
  name: string;
  purpose: string;
  data: string;
  location: string;
  use: string;
};

export const subprocessors: readonly SubprocessorEntry[] = [
  { name: "Render Services, Inc.", purpose: "Applikationshosting og teknisk drift", data: "Konto-, virksomheds- og regnskabsdata samt driftslog", location: "Valgt EU-region; leverandøren har også underleverandører i tredjelande", use: "Kerneleverandør" },
  { name: "Hetzner Online GmbH", purpose: "Krypteret ekstern backup og objektlagring", data: "Backupkopier af database og filer", location: "EU-lokation valgt i kundekontoen (Tyskland eller Finland)", use: "Kerneleverandør, når ekstern backup er aktiveret" },
  { name: "Simply.com A/S", purpose: "Drifts-, konto- og supportmail", data: "Navn, e-mailadresse og nødvendigt meddelelsesindhold", location: "EU/EØS efter den indgåede leverandøraftale", use: "Kerneleverandør" },
  { name: "QuickPay ApS", purpose: "Betalingsvindue og abonnementsbetaling", data: "Kunde-, ordre-, beløbs- og betalingsreferencer; ADD SmartRegnskab gemmer ikke kortnummer eller kontrolcifre", location: "EU/EØS efter den indgåede leverandøraftale", use: "Anvendes ved betalt abonnement" },
  { name: "Clearhaus A/S", purpose: "Kortindløsning", data: "Betalings- og transaktionsoplysninger", location: "EU/EØS efter den indgåede leverandøraftale", use: "Afventer endelig produktionsgodkendelse" },
  { name: "Mastercard Open Banking / Aiia", purpose: "Kontoindsigt og indlæsning af banktransaktioner", data: "Bankkonto-, saldo-, transaktions- og samtykkeoplysninger", location: "Behandles efter den konkrete Open Banking-aftale", use: "Valgfri; kun når kunden forbinder sin bank" },
  { name: "Visma e-conomic A/S (Sproom)", purpose: "NemHandel og Peppol e-fakturering samt administration af child-company-profiler", data: "CVR- og virksomhedsoplysninger, modtager-, faktura-, dokument- og leveringsoplysninger", location: "Dansk leverandør; konkrete behandlingssteder og eventuelle tredjelandsoverførsler følger Sprooms databehandleraftale og offentliggjorte underleverandørliste", use: "Valgfri; aktiveres først, når ISV-aftalen er underskrevet" },
] as const;

export const retentionSections: readonly LegalSection[] = [
  ["Kundens ansvar", "Kunden er dataansvarlig for indholdet i sit regnskab og fastlægger lovligt formål, adgang og opbevaringsbehov. ADD SmartDrift ApS behandler data efter kundens instruks. Kunden skal selv sikre, at lovpligtigt regnskabsmateriale bevares i den krævede periode, også før et abonnement opsiges."],
  ["Mens abonnementet er aktivt", "Regnskabsdata og bilag opbevares, mens tjenesten leveres, medmindre kunden sletter eller anonymiserer data efter en lovlig instruks. Sikkerheds- og revisionslog opbevares så længe, det er nødvendigt for dokumentation, fejlsøgning og beskyttelse mod misbrug."],
  ["Lovpligtigt regnskabsmateriale", "Regnskabsmateriale skal som udgangspunkt opbevares i fem år fra udgangen af det regnskabsår, materialet vedrører. En anmodning om sletning gennemføres derfor ikke, hvis materialet fortsat skal bevares efter bogføringsloven eller anden bindende ret. Personoplysninger, som ikke længere er nødvendige, skal slettes eller anonymiseres."],
  ["Eksport", "En virksomhedsadministrator kan eksportere regnskabsdata gennem de tilgængelige eksportfunktioner, herunder relevante rapporter, CSV/JSON og SAF-T, afhængigt af datatypen. Før opsigelse skal kunden kontrollere eksporten og sikre, at den kan læses og opbevares forsvarligt. En persondataanmodning kan udleveres i JSON eller CSV."],
  ["Ved opsigelse", "Opsigelse stopper ikke straks adgangen: kunden beholder adgang til udløbet af den betalte periode. Inden ophør skal kunden hente nødvendige data. Den endelige afviklingsfrist og slettefrist skal fremgå af ordrebekræftelsen eller en særskilt skriftlig aftale; systemet må ikke love en automatisk frist, før den tekniske sletteproces er aktiveret og testet."],
  ["Sletning og anonymisering", "Sletning udføres først efter kontrol af identitet, rettigheder, lovkrav og berørte data. Hvor en postering eller et bilag ikke lovligt kan slettes, begrænses adgangen eller personoplysninger anonymiseres, når det er muligt. En almindelig deaktivering eller skjult markering regnes ikke i sig selv som permanent sletning."],
  ["Backup", "Slettede oplysninger fjernes fra aktiv drift. Kopier i beskyttede backups slettes ved udløbet af den fastsatte backupcyklus og bruges ikke til andre formål end gendannelse. Ved gendannelse skal tidligere sletteinstrukser genanvendes, så slettede oplysninger ikke vender tilbage til normal drift."],
  ["Anmodninger og kontakt", "Anmodninger om eksport, rettelse eller sletning sendes af virksomhedens administrator til regnskab@addsmartregnskab.dk. ADD SmartDrift ApS registrerer anmodningen og udførelsen i revisionssporet. Registrerede personer skal som udgangspunkt kontakte den virksomhed, der er dataansvarlig for regnskabet."],
] as const;

export function dpaPlainText(): string {
  const content = dpaSections.map(([heading, body]) => `${heading}\n${body}`).join("\n\n");
  return `DATABEHANDLERAFTALE\nVersion ${DPA_VERSION}\nSenest opdateret ${LEGAL_UPDATED_AT}\n\n${content}`;
}

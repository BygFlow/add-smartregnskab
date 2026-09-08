/**
 * seed-templates.ts
 * ─────────────────────────────────────────────────────────────────
 * Seeder til branche-kontoplaner (industry_account_templates) samt
 * compliance-dokument-skabeloner (compliance_documents) og
 * kontroltest-skabeloner (control_tests).
 *
 * Kør med:  npx tsx server/seed-templates.ts
 *
 * VIGTIGT: Kontoplanerne er VEJLEDENDE standardopsætninger baseret på
 * almindelig dansk kontoplan-praksis (Dansk Standardkontoplan-inspireret).
 * De er IKKE juridisk godkendt af Erhvervsstyrelsen, SKAT/Skattestyrelsen
 * eller en registreret revisor, og skal gennemgås af revisor/bogholder
 * før brug i et rigtigt regnskab.
 */

import { db } from "./storage";
import {
  industryAccountTemplates,
  complianceDocuments,
  controlTests,
} from "@shared/schema";
import type {
  InsertIndustryAccountTemplate,
  InsertComplianceDocument,
  InsertControlTest,
} from "@shared/schema";

function nowISO(): string {
  return new Date().toISOString();
}

const VEJLEDENDE_NOTE =
  "Vejledende standardkonto — ikke juridisk godkendt. Skal gennemgås af revisor/bogholder før brug.";

type AccountType = "aktiv" | "passiv" | "indtægt" | "omkostning" | "status";
type VatCode = "salg" | "kob" | "ingen";

interface AccountRow {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  vatCode?: VatCode;
  isDefault?: boolean;
  description?: string;
}

const industries = [
  "rengøring",
  "håndværk",
  "detail",
  "konsulent",
  "restaurant",
  "transport",
  "klinik",
  "ejendom",
  "saas",
] as const;

type Industry = (typeof industries)[number];

// ═════════════════════════════════════════════════════════════════
// FÆLLES KONTI — genbruges på tværs af alle brancher
// (aktiver, passiver, personale, drift, afskrivninger, finans, status)
// ═════════════════════════════════════════════════════════════════

const commonAssetAccounts: AccountRow[] = [
  { accountNumber: "1210", accountName: "Driftsmateriel og inventar", accountType: "aktiv", isDefault: true, description: "Anlægsaktiv — maskiner, inventar og driftsmidler." },
  { accountNumber: "1610", accountName: "Tilgodehavender fra salg", accountType: "aktiv", isDefault: true, description: "Debitorer — udestående fakturaer fra kunder." },
  { accountNumber: "1810", accountName: "Likvide beholdninger, bank", accountType: "aktiv", isDefault: true, description: "Indestående på virksomhedens bankkonti." },
];

const commonLiabilityAccounts: AccountRow[] = [
  { accountNumber: "2000", accountName: "Selskabskapital", accountType: "passiv", isDefault: true, description: "Egenkapital — indskudt selskabskapital (ApS/A/S)." },
  { accountNumber: "2100", accountName: "Overført resultat", accountType: "passiv", isDefault: true, description: "Egenkapital — akkumuleret overført overskud/underskud." },
  { accountNumber: "2500", accountName: "Leverandørgæld", accountType: "passiv", isDefault: true, description: "Kreditorer — skyldige beløb til leverandører." },
  { accountNumber: "2600", accountName: "Skyldig moms", accountType: "passiv", isDefault: true, vatCode: "ingen", description: "Skyldig/tilgodehavende moms, afregnes til Skattestyrelsen." },
];

const commonStaffAccounts: AccountRow[] = [
  { accountNumber: "5100", accountName: "Lønninger", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Bruttoløn til medarbejdere." },
  { accountNumber: "5200", accountName: "ATP", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Arbejdsgiverens bidrag til Arbejdsmarkedets Tillægspension." },
  { accountNumber: "5300", accountName: "AM-bidrag", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Arbejdsmarkedsbidrag (8%) tilbageholdt i medarbejderens løn." },
];

const commonOperatingAccounts: AccountRow[] = [
  { accountNumber: "6000", accountName: "Husleje", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Husleje for lokaler/kontor." },
  { accountNumber: "6100", accountName: "El, vand og varme", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Forbrugsudgifter til lokaler." },
  { accountNumber: "6200", accountName: "Forsikringer", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Erhvervsforsikringer, ansvarsforsikring mv." },
  { accountNumber: "6600", accountName: "Revisor og bogholderi", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Honorar til revisor og ekstern bogføring." },
];

const commonDepreciationAccounts: AccountRow[] = [
  { accountNumber: "7100", accountName: "Afskrivninger, driftsmateriel og inventar", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Årets afskrivning på driftsmidler og inventar." },
];

const commonFinancialAccounts: AccountRow[] = [
  { accountNumber: "8200", accountName: "Renteomkostninger", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Renter på banklån og kreditter." },
];

const commonStatusAccounts: AccountRow[] = [
  { accountNumber: "9100", accountName: "Årets resultat", accountType: "status", isDefault: true, description: "Statuskonto — overføres til balancen ved årsafslutning." },
];

// ═════════════════════════════════════════════════════════════════
// BRANCHESPECIFIKKE KONTI — indtægter (3000-3999) og
// vareforbrug/underleverandører (4000-4999)
// ═════════════════════════════════════════════════════════════════

const industrySpecificAccounts: Record<Industry, AccountRow[]> = {
  "rengøring": [
    { accountNumber: "3000", accountName: "Salg af rengøring", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Indtægter fra fast erhvervs- og privatrengøring." },
    { accountNumber: "3010", accountName: "Salg af vinduespolering", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Indtægter fra vinduespudsning." },
    { accountNumber: "3020", accountName: "Salg af hovedrengøring", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Engangsydelser, fx flytte- og hovedrengøring." },
    { accountNumber: "4000", accountName: "Underleverandører, rengøring", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Fremmed arbejdskraft og underentreprenører." },
    { accountNumber: "6000", accountName: "Rengøringsmaterialer", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Forbrugsstoffer, rengøringsmidler og udstyr." },
    { accountNumber: "6010", accountName: "Arbejdstøj og værnemidler", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Uniformer, handsker og sikkerhedsudstyr." },
    { accountNumber: "6020", accountName: "Køretøjer og transport", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Drift af servicebiler til opgaver hos kunder." },
  ],
  "håndværk": [
    { accountNumber: "3000", accountName: "Salg af håndværksydelser", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Fakturerede timer og entrepriser for håndværksarbejde." },
    { accountNumber: "3010", accountName: "Salg af materialer, viderefaktureret", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Materialer indkøbt og viderefaktureret til kunde." },
    { accountNumber: "3020", accountName: "Salg, akkord- og tillægsarbejde", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Ekstraarbejde og tillæg til oprindeligt tilbud." },
    { accountNumber: "4000", accountName: "Varekøb, byggematerialer", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Indkøb af tømmer, beslag og øvrige byggematerialer." },
    { accountNumber: "4100", accountName: "Underleverandører og fremmed arbejde", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Fagentrepriser udført af underleverandører." },
    { accountNumber: "6000", accountName: "Håndværktøj og smådele", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Mindre værktøjsanskaffelser og forbrugsdele." },
    { accountNumber: "6010", accountName: "Køretøjer og maskiner, drift", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Brændstof, service og leje af maskiner/varevogne." },
    { accountNumber: "6020", accountName: "Arbejdstøj og sikkerhedsudstyr", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Arbejdstøj, hjelme og sikkerhedsudstyr." },
  ],
  "detail": [
    { accountNumber: "3000", accountName: "Salg af varer, butik", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Kontant- og kortsalg i butik." },
    { accountNumber: "3010", accountName: "Salg af varer, webshop", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Onlinesalg via webshop." },
    { accountNumber: "3900", accountName: "Opnåede rabatter, salg", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Ydede rabatter og bonusordninger til kunder (modkonto)." },
    { accountNumber: "4000", accountName: "Varekøb", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Indkøb af varer til videresalg." },
    { accountNumber: "4010", accountName: "Fragt og told, varekøb", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Fragtomkostninger og told ved varekøb." },
    { accountNumber: "4020", accountName: "Varelagerregulering", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "Regulering af varelager, svind og kassation." },
    { accountNumber: "6000", accountName: "Emballage og poser", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Emballage, poser og pakkematerialer." },
    { accountNumber: "6010", accountName: "Betalingsgebyrer, kortterminal", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "Gebyrer til betalingskortudbyder/POS-system." },
  ],
  "konsulent": [
    { accountNumber: "3000", accountName: "Salg af konsulentydelser", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Fakturerede rådgivnings- og konsulenttimer." },
    { accountNumber: "3010", accountName: "Salg, projektarbejde", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Indtægter fra fastpris-projekter." },
    { accountNumber: "3020", accountName: "Salg, kurser og foredrag", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Undervisnings- og foredragsindtægter." },
    { accountNumber: "4000", accountName: "Underkonsulenter", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Fremmed konsulentbistand videresolgt til kunde." },
    { accountNumber: "6000", accountName: "Rejseomkostninger", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Transport, hotel og forplejning ved kundebesøg." },
    { accountNumber: "6010", accountName: "Faglitteratur og abonnementer", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Fagbøger, tidsskrifter og faglige abonnementer." },
    { accountNumber: "6020", accountName: "Kontorhotel og mødelokaler", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Leje af kontorplads og mødefaciliteter." },
  ],
  "restaurant": [
    { accountNumber: "3000", accountName: "Salg af mad", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Salg af mad til servering og takeaway." },
    { accountNumber: "3010", accountName: "Salg af drikkevarer", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Salg af alkoholiske og alkoholfrie drikkevarer." },
    { accountNumber: "3020", accountName: "Salg, catering", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Catering- og eventindtægter." },
    { accountNumber: "3030", accountName: "Drikkepenge, viderefordelt", accountType: "indtægt", vatCode: "ingen", isDefault: false, description: "Modtagne og viderefordelte drikkepenge til personale." },
    { accountNumber: "4000", accountName: "Varekøb, råvarer mad", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Indkøb af fødevarer og råvarer." },
    { accountNumber: "4010", accountName: "Varekøb, drikkevarer", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Indkøb af øl, vin, spiritus og sodavand." },
    { accountNumber: "6000", accountName: "Køkkenudstyr og service", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Service, bestik og mindre køkkenudstyr." },
    { accountNumber: "6010", accountName: "Musik- og skænkebevilling, afgifter", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "KODA/Gramex-afgifter og bevillinger." },
  ],
  "transport": [
    { accountNumber: "3000", accountName: "Salg af transportydelser", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Fragt- og kørselsindtægter." },
    { accountNumber: "3010", accountName: "Salg af flytteydelser", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Indtægter fra flytteopgaver." },
    { accountNumber: "3020", accountName: "Salg, opbevaring", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Udlejning af lager-/opbevaringsplads." },
    { accountNumber: "4000", accountName: "Underleverandører, vognmænd", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Fragtkørsel udført af andre vognmænd." },
    { accountNumber: "6000", accountName: "Brændstof", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Diesel og brændstofforbrug til køretøjer." },
    { accountNumber: "6010", accountName: "Vedligeholdelse af køretøjer", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Service, reparation og dæk til lastbiler/varevogne." },
    { accountNumber: "6020", accountName: "Vejafgifter og broafgifter", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Vignetter, bropassage og vejafgifter." },
    { accountNumber: "6030", accountName: "Forsikring, køretøjer", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "Ansvars- og kaskoforsikring på flåden." },
  ],
  "klinik": [
    { accountNumber: "3000", accountName: "Salg af behandlinger", accountType: "indtægt", vatCode: "ingen", isDefault: true, description: "Indtægt fra momsfri sundhedsbehandling (behandlerydelser)." },
    { accountNumber: "3010", accountName: "Salg af produkter", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Momspligtigt salg af plejeprodukter mv. i klinikken." },
    { accountNumber: "3020", accountName: "Salg, gruppetræning/-forløb", accountType: "indtægt", vatCode: "ingen", isDefault: false, description: "Indtægt fra hold- og gruppebehandlinger." },
    { accountNumber: "4000", accountName: "Underleverandører, behandlere", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Honorar til tilknyttede eksterne behandlere." },
    { accountNumber: "6000", accountName: "Klinikmateriale og forbrugsvarer", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Engangsmateriale, plejeprodukter og forbrugsvarer." },
    { accountNumber: "6010", accountName: "Medicinsk udstyr, mindre anskaffelser", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Mindre udstyrsanskaffelser under aktiveringsgrænsen." },
    { accountNumber: "6020", accountName: "Autorisation og faglige medlemskaber", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "Autorisationsgebyrer og medlemskab af faglige organisationer." },
  ],
  "ejendom": [
    { accountNumber: "3000", accountName: "Lejeindtægter", accountType: "indtægt", vatCode: "ingen", isDefault: true, description: "Momsfri udlejning af fast ejendom til bolig." },
    { accountNumber: "3010", accountName: "Lejeindtægter, erhverv (momspligtig)", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Frivilligt momsregistreret erhvervsudlejning." },
    { accountNumber: "3020", accountName: "Salg, administrationsydelser", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Ejendomsadministration for tredjepart." },
    { accountNumber: "4000", accountName: "Ejendomsskatter og afgifter", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Grundskyld og øvrige ejendomsrelaterede afgifter." },
    { accountNumber: "6000", accountName: "Vedligeholdelse af ejendom", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Løbende vedligeholdelse og reparation af ejendomme." },
    { accountNumber: "6010", accountName: "Ejendomsforsikring", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "Bygningsforsikring." },
    { accountNumber: "6020", accountName: "Ejendomsservice og vicevært", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Vicevært, trappevask og udearealer." },
    { accountNumber: "7400", accountName: "Afskrivninger, bygninger", accountType: "omkostning", vatCode: "ingen", isDefault: true, description: "Skattemæssige/regnskabsmæssige afskrivninger på bygninger." },
  ],
  "saas": [
    { accountNumber: "3000", accountName: "Salg af abonnementer", accountType: "indtægt", vatCode: "salg", isDefault: true, description: "Tilbagevendende abonnementsindtægt (MRR/ARR)." },
    { accountNumber: "3010", accountName: "Salg af implementering og onboarding", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Engangsindtægt fra opsætning og onboarding." },
    { accountNumber: "3020", accountName: "Salg, support og tillægsmoduler", accountType: "indtægt", vatCode: "salg", isDefault: false, description: "Ekstra moduler, API-adgang og supportaftaler." },
    { accountNumber: "4000", accountName: "Hostingomkostninger (cloud)", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Cloud-infrastruktur, fx AWS/Azure/GCP-forbrug." },
    { accountNumber: "4010", accountName: "Tredjeparts API og datatjenester", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Eksterne API'er og datatjenester integreret i produktet." },
    { accountNumber: "6000", accountName: "Udvikling, eksterne udviklere", accountType: "omkostning", vatCode: "kob", isDefault: false, description: "Fremmed udviklingsarbejde og freelance-udviklere." },
    { accountNumber: "6010", accountName: "Softwarelicenser, interne værktøjer", accountType: "omkostning", vatCode: "kob", isDefault: true, description: "Interne SaaS-værktøjer (support, analytics, CI/CD mv.)." },
    { accountNumber: "7500", accountName: "Afskrivninger, udviklingsomkostninger", accountType: "omkostning", vatCode: "ingen", isDefault: false, description: "Afskrivning af aktiverede udviklingsomkostninger." },
  ],
};

function buildAccountsForIndustry(industry: Industry): InsertIndustryAccountTemplate[] {
  const rows: AccountRow[] = [
    ...industrySpecificAccounts[industry],
    ...commonAssetAccounts,
    ...commonLiabilityAccounts,
    ...commonStaffAccounts,
    ...commonOperatingAccounts,
    ...commonDepreciationAccounts,
    ...commonFinancialAccounts,
    ...commonStatusAccounts,
  ];

  // Sortér efter kontonummer for læsevenlighed
  rows.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  return rows.map((row) => ({
    industry,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    accountType: row.accountType,
    vatCode: row.vatCode ?? null,
    isDefault: row.isDefault ?? false,
    description: row.description
      ? `${row.description} ${VEJLEDENDE_NOTE}`
      : VEJLEDENDE_NOTE,
  }));
}

// ═════════════════════════════════════════════════════════════════
// COMPLIANCE-DOKUMENT-SKABELONER
// ═════════════════════════════════════════════════════════════════

const complianceDocumentTemplates: InsertComplianceDocument[] = [
  {
    companyId: null,
    documentType: "databehandleraftale",
    title: "Databehandleraftale (skabelon)",
    status: "kladde",
    version: "1.0",
    requiresLegalReview: true,
    reviewedBy: null,
    reviewedAt: null,
    validUntil: null,
    content:
      "Skabelon til databehandleraftale (DPA) mellem dataansvarlig og databehandler jf. GDPR art. 28. " +
      "Skal tilpasses konkrete behandlingsaktiviteter, underdatabehandlere og sikkerhedsforanstaltninger, og " +
      "godkendes juridisk før ikrafttrædelse. Vejledende skabelon — ikke juridisk bindende i sin nuværende form.",
  },
  {
    companyId: null,
    documentType: "privacy_policy",
    title: "Persondatapolitik (skabelon)",
    status: "kladde",
    version: "1.0",
    requiresLegalReview: true,
    reviewedBy: null,
    reviewedAt: null,
    validUntil: null,
    content:
      "Skabelon til virksomhedens persondatapolitik: hvilke persondata der behandles, formål, retsgrundlag, " +
      "opbevaringsperioder, videregivelse til tredjepart og de registreredes rettigheder. Skal gennemgås af " +
      "jurist/DPO og tilpasses virksomhedens faktiske databehandling før offentliggørelse.",
  },
  {
    companyId: null,
    documentType: "gdpr_assessment",
    title: "GDPR risikovurdering (skabelon)",
    status: "kladde",
    version: "1.0",
    requiresLegalReview: true,
    reviewedBy: null,
    reviewedAt: null,
    validUntil: null,
    content:
      "Skabelon til risikovurdering (og evt. konsekvensanalyse/DPIA) af databehandlingsaktiviteter: " +
      "identifikation af risici for de registreredes rettigheder, sandsynlighed og konsekvens, samt " +
      "afhjælpende foranstaltninger. Kræver juridisk/DPO-gennemgang før den lægges til grund.",
  },
  {
    companyId: null,
    documentType: "control_description",
    title: "Kontrolbeskrivelse (skabelon)",
    status: "kladde",
    version: "1.0",
    requiresLegalReview: true,
    reviewedBy: null,
    reviewedAt: null,
    validUntil: null,
    content:
      "Skabelon til beskrivelse af interne kontroller (adgangsstyring, ændringsstyring, driftsstyring og " +
      "dataintegritet) til brug for revision og compliance-dokumentation. Skal udfyldes med faktiske " +
      "procedurer og godkendes af ledelsen/revisor.",
  },
  {
    companyId: null,
    documentType: "audit_report",
    title: "Revision rapport (skabelon)",
    status: "kladde",
    version: "1.0",
    requiresLegalReview: true,
    reviewedBy: null,
    reviewedAt: null,
    validUntil: null,
    content:
      "Skabelon til revisionsrapport der opsummerer udførte kontroltests, observationer, afvigelser og " +
      "anbefalinger. Endelig rapport skal udarbejdes/godkendes af registreret revisor før udsendelse.",
  },
];

// ═════════════════════════════════════════════════════════════════
// KONTROLTEST-SKABELONER
// ═════════════════════════════════════════════════════════════════

const controlTestTemplates: InsertControlTest[] = [
  // Adgangsstyring
  {
    companyId: null,
    controlName: "Brugerkonti gennemgås kvartalvis",
    controlCategory: "adgangsstyring",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Kontrollér at aktive brugerkonti stemmer overens med nuværende medarbejdere og deres roller, og at fratrådte medarbejderes adgang er lukket.",
  },
  {
    companyId: null,
    controlName: "Adgangsrettigheder dokumenteres",
    controlCategory: "adgangsstyring",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Verificér at tildeling og ændring af adgangsrettigheder til systemer og data er dokumenteret og godkendt af relevant leder.",
  },
  // Ændringsstyring
  {
    companyId: null,
    controlName: "Kodeændringer gennemgås før deploy",
    controlCategory: "ændringsstyring",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Kontrollér at kodeændringer gennemgår code review og godkendelse, inden de udrulles til produktionsmiljøet.",
  },
  {
    companyId: null,
    controlName: "Versionsstyring anvendes",
    controlCategory: "ændringsstyring",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Verificér at alle kodeændringer registreres i et versionsstyringssystem med sporbar historik og ansvarlig committer.",
  },
  // Driftsstyring
  {
    companyId: null,
    controlName: "Daglig backup verificeret",
    controlCategory: "driftsstyring",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Kontrollér at daglige backups gennemføres succesfuldt, og at stikprøver af gendannelse testes regelmæssigt.",
  },
  {
    companyId: null,
    controlName: "Systemovervågning aktiv",
    controlCategory: "driftsstyring",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Verificér at overvågning og alarmering af systemernes tilgængelighed og ydeevne er aktiv og fungerer som forventet.",
  },
  // Dataintegritet
  {
    companyId: null,
    controlName: "Datavalidering på input",
    controlCategory: "dataintegritet",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Kontrollér at input fra brugere og integrationer valideres for format og konsistens, før det gemmes i systemet.",
  },
  {
    companyId: null,
    controlName: "Revisionslog aktiveret",
    controlCategory: "dataintegritet",
    testStatus: "ikke_testet",
    testResult: null,
    testedBy: null,
    testedAt: null,
    frequency: "kvartalvis",
    description: "Verificér at der føres revisionslog over kritiske dataændringer, og at loggen er beskyttet mod utilsigtet sletning eller ændring.",
  },
];

// ═════════════════════════════════════════════════════════════════
// SEED-FUNKTION
// ═════════════════════════════════════════════════════════════════

function seedIndustryAccountTemplates() {
  const existing = db.select().from(industryAccountTemplates).all();
  if (existing.length > 0) {
    console.log(
      `⏭  industry_account_templates: ${existing.length} rækker findes allerede — springer over.`
    );
    return 0;
  }

  let count = 0;
  for (const industry of industries) {
    const rows = buildAccountsForIndustry(industry);
    for (const row of rows) {
      db.insert(industryAccountTemplates).values(row).run();
      count++;
    }
    console.log(`   • ${industry}: ${rows.length} konti`);
  }
  return count;
}

function seedComplianceDocuments() {
  const existing = db.select().from(complianceDocuments).all();
  const existingTypes = new Set(existing.map((d) => d.documentType));

  let count = 0;
  for (const doc of complianceDocumentTemplates) {
    if (existingTypes.has(doc.documentType)) {
      console.log(`⏭  compliance_documents: "${doc.documentType}" findes allerede — springer over.`);
      continue;
    }
    db.insert(complianceDocuments)
      .values({ ...doc, createdAt: nowISO() })
      .run();
    count++;
  }
  return count;
}

function seedControlTests() {
  const existing = db.select().from(controlTests).all();
  const existingNames = new Set(existing.map((c) => c.controlName));

  let count = 0;
  for (const test of controlTestTemplates) {
    if (existingNames.has(test.controlName)) {
      console.log(`⏭  control_tests: "${test.controlName}" findes allerede — springer over.`);
      continue;
    }
    db.insert(controlTests)
      .values({ ...test, createdAt: nowISO() })
      .run();
    count++;
  }
  return count;
}

function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" Seed: Danske branche-kontoplaner & compliance-skabeloner");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("→ Seeder industry_account_templates …");
  const accountsInserted = seedIndustryAccountTemplates();
  console.log(`  ✔ ${accountsInserted} kontoskabeloner indsat.\n`);

  console.log("→ Seeder compliance_documents …");
  const docsInserted = seedComplianceDocuments();
  console.log(`  ✔ ${docsInserted} compliance-dokumentskabeloner indsat.\n`);

  console.log("→ Seeder control_tests …");
  const testsInserted = seedControlTests();
  console.log(`  ✔ ${testsInserted} kontroltest-skabeloner indsat.\n`);

  // Verifikation
  const totalAccounts = db.select().from(industryAccountTemplates).all().length;
  const totalDocs = db.select().from(complianceDocuments).all().length;
  const totalTests = db.select().from(controlTests).all().length;

  console.log("═══════════════════════════════════════════════════════");
  console.log(" Verifikation (samlet antal rækker i databasen)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  industry_account_templates : ${totalAccounts}`);
  console.log(`  compliance_documents       : ${totalDocs}`);
  console.log(`  control_tests              : ${totalTests}`);
  console.log("═══════════════════════════════════════════════════════");
}

main();

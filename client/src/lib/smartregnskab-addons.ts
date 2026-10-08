export type SmartRegnskabAddon = {
  name: string;
  category: "AI-tilkøb" | "Tillægsmodul" | "Engangsydelse";
  feature: string;
  description: string;
  route: string;
  protectedRoutes: string[];
};

export const SMARTREGNSKAB_ADDONS: SmartRegnskabAddon[] = [
  { name: "AI-regnskab", category: "AI-tilkøb", feature: "ai_bogforing", description: "Forslag til kontering, bilagskontrol og forklaringer. Kritiske handlinger kræver fortsat godkendelse.", route: "ai_styring", protectedRoutes: ["ai", "ai_chef", "ai_styring"] },
  { name: "Automatisk fakturering", category: "Tillægsmodul", feature: "faste_fakturaer", description: "Faste fakturaer, planlagt oprettelse og rykkerflow til tilbagevendende kunder.", route: "faste_fakturaer", protectedRoutes: ["faste_fakturaer"] },
  { name: "Budget og likviditet", category: "Tillægsmodul", feature: "budget", description: "Budgetter, prognoser og løbende overblik over virksomhedens likviditet.", route: "budget", protectedRoutes: ["budget", "cashflow", "budget_scenarier"] },
  { name: "Løn og lønindberetning", category: "Tillægsmodul", feature: "loen", description: "Beregn lønsedler og klargør indberetning til eIndkomst og FerieKonto. Almindelig bogføring af lønudgifter er altid inkluderet.", route: "lonmotor_regnskab", protectedRoutes: ["lonindberetning", "lonmotor_regnskab"] },
  { name: "Betalingskørsler", category: "Tillægsmodul", feature: "betalinger", description: "Saml, godkend og eksportér leverandørbetalinger i kontrollerede kørsler. Manuel betalingsregistrering og bankafstemning er fortsat en del af grundregnskabet.", route: "betaling", protectedRoutes: ["betaling", "bank_payments"] },
  { name: "Lagerregnskab", category: "Tillægsmodul", feature: "lagerregnskab", description: "Lageroptælling, lokationer og regnskabsmæssig lagerværdi. Det almindelige produktkartotek med varer, ydelser og fakturapriser er altid inkluderet.", route: "lagerregnskab", protectedRoutes: ["lagerregnskab"] },
  { name: "Årsrapport", category: "Tillægsmodul", feature: "aarsrapport", description: "Klargør årsrapportens data, dokumentation og status efter den almindelige årsafslutning.", route: "arsrapport", protectedRoutes: ["arsrapport"] },
  { name: "Revisorportal", category: "Tillægsmodul", feature: "revision", description: "Afgrænset samarbejdsportal, anmodninger og revisionspakker med sign-off. Revisionsspor, SAF-T og almindelig regnskabseksport er fortsat inkluderet.", route: "revisorportal", protectedRoutes: ["revisorportal", "revisionspakke"] },
  { name: "Koncern", category: "Tillægsmodul", feature: "konsolidering", description: "Konsolidering, elimineringer og koncernrapportering på tværs af juridiske virksomheder. Almindelig administration af selskaber, afdelinger og SE-enheder er fortsat inkluderet.", route: "konsolidering", protectedRoutes: ["konsolidering"] },
  { name: "API og webhooks", category: "Tillægsmodul", feature: "api_integration", description: "Tenant-isolerede API-nøgler og kontrolleret dataudveksling med eksterne fagsystemer.", route: "api_webhooks", protectedRoutes: ["api_webhooks", "api_keys_mgmt"] },
  { name: "Kundeportal", category: "Tillægsmodul", feature: "kundeportal", description: "Privat selvbetjening, hvor hver kunde kun kan se egne fakturaer og dokumenter, som virksomheden udtrykkeligt har delt.", route: "kunde_portal_indstillinger", protectedRoutes: ["kunde_portal_indstillinger", "portal_dokumenter"] },
  { name: "Avancerede arbejdsgange", category: "Tillægsmodul", feature: "workflow_builder", description: "Byg og test kontrollerede godkendelses- og automatiseringsflow til organisationens særlige processer.", route: "workflow_builder", protectedRoutes: ["workflow_builder"] },
  { name: "International moms og specialregler", category: "Tillægsmodul", feature: "avanceret_moms", description: "OSS, Intrastat, delvist momsfradrag og momsregistrering i flere lande. Almindelig dansk moms, EU-moms, reverse charge og importmoms er fortsat inkluderet.", route: "avanceret_moms", protectedRoutes: ["avanceret_moms"] },
  { name: "Datamigrering og onboarding", category: "Engangsydelse", feature: "dedikeret_onboarding", description: "Valideret engangsimport med forhåndsvisning, dubletkontrol og dokumenteret rollback.", route: "migration_wizard", protectedRoutes: ["migration_wizard"] },
];

export function getSmartRegnskabAddonForRoute(route: string) {
  return SMARTREGNSKAB_ADDONS.find((addon) => addon.protectedRoutes.includes(route));
}

export function isSmartRegnskabAddonIncluded(
  addon: SmartRegnskabAddon,
  access: { hasFeature: (feature: string) => boolean; hasAI: boolean },
) {
  return addon.feature === "ai_bogforing"
    ? access.hasAI || access.hasFeature(addon.feature)
    : access.hasFeature(addon.feature);
}

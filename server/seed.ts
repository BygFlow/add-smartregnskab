import { db } from "./storage";
import {
  companies, users, employees, customers, tasks, timeEntries, notifications,
  invoices, invoiceItems, integrations, absences, shifts, plans, subscriptions,
  platformInvoices, quotes, quoteItems, contracts, materials, materialUsage,
  keys, keyHandovers, inspections, paymentMethods, consents,
  accounts, journalEntries, journalLines, vatPeriods,
  templates, cleaningServices, cleaningAgreements, cleaningPlans,
  leads, supportCases, backups,
  outboundMessages, inboundMessages, communicationIntegrations,
} from "@shared/schema";
import { hashPassword } from "./auth";
import { encryptField } from "./crypto";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
function nowISO(): string {
  return new Date().toISOString();
}

/** Alle demokonti bruger samme kodeord — det hashes, ikke gemmes i klartekst. */
const DEMO_PW = hashPassword("demo1234");

/** Production-safe reference data. Never creates companies or users. */
export function seedReferenceData() {
  if (db.select().from(plans).all().length > 0) return;
  const common = ["opgaver", "tidsregistrering", "kunder", "fakturering"];
  db.insert(plans).values([
    { name: "Start", slug: "start", description: "Til den lille virksomhed, der vil have styr på opgaver og timer.", monthlyPrice: 199, pricePerEmployee: 39, maxEmployees: 5, maxCustomers: 15, features: JSON.stringify(common), active: 1, sortOrder: 1 },
    { name: "Drift", slug: "drift", description: "Til virksomheder i vækst.", monthlyPrice: 499, pricePerEmployee: 29, maxEmployees: 25, maxCustomers: 100, features: JSON.stringify([...common, "vagtplan", "fravaer", "fotodokumentation", "loen_eksport", "regnskab_eksport", "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler", "api_integration", "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "gdpr_vaerktoejer"]), active: 1, sortOrder: 2 },
    { name: "Professionel", slug: "professionel", description: "Fuld drift, regnskab og backup.", monthlyPrice: 999, pricePerEmployee: 19, maxEmployees: -1, maxCustomers: -1, features: JSON.stringify([...common, "vagtplan", "fravaer", "fotodokumentation", "loen_eksport", "regnskab_eksport", "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler", "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "regnskab", "backup"]), active: 1, sortOrder: 3 },
    { name: "Enterprise", slug: "enterprise", description: "Alt inklusive API, revisionsspor og support/SLA.", monthlyPrice: 1999, pricePerEmployee: 0, maxEmployees: -1, maxCustomers: -1, features: JSON.stringify([...common, "vagtplan", "fravaer", "fotodokumentation", "loen_eksport", "regnskab_eksport", "geofence", "api_integration", "revisionsspor", "tilbud", "materialer", "kvalitetskontrol", "noegler", "gdpr_vaerktoejer", "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "regnskab", "backup", "support_sla"]), active: 1, sortOrder: 4 },
  ]).run();
}

export function seedDatabase() {
  const count = db.select().from(companies).all().length;
  if (count > 0) return;

  // ══════════════════════════════════════════════
  //  PAKKER — ADD SmartRegnskabs prisliste (4 pakker)
  // ══════════════════════════════════════════════
  const pStart = db.insert(plans).values({
    name: "Start", slug: "start",
    description: "Til den lille virksomhed, der vil have styr på opgaver og timer.",
    monthlyPrice: 199, pricePerEmployee: 39,
    maxEmployees: 5, maxCustomers: 15,
    features: JSON.stringify(["opgaver", "tidsregistrering", "kunder", "fakturering"]),
    active: 1, sortOrder: 1,
  }).returning().get();

  const pDrift = db.insert(plans).values({
    name: "Drift", slug: "drift",
    description: "Til virksomheder i vækst — vagtplan, ansatte, materialer, kvalitetskontrol.",
    monthlyPrice: 499, pricePerEmployee: 29,
    maxEmployees: 25, maxCustomers: 100,
    features: JSON.stringify([
      "opgaver", "tidsregistrering", "kunder", "fakturering",
      "vagtplan", "fravaer", "fotodokumentation", "loen_eksport", "regnskab_eksport", "geofence",
      "tilbud", "materialer", "kvalitetskontrol", "noegler", "api_integration",
      "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner", "gdpr_vaerktoejer",
    ]),
    active: 1, sortOrder: 2,
  }).returning().get();

  const pProf = db.insert(plans).values({
    name: "Professionel", slug: "professionel",
    description: "Skabeloner, rengøringsaftaler, regnskab, backup og fuld drift.",
    monthlyPrice: 999, pricePerEmployee: 19,
    maxEmployees: -1, maxCustomers: -1,
    features: JSON.stringify([
      "opgaver", "tidsregistrering", "kunder", "fakturering",
      "vagtplan", "fravaer", "fotodokumentation", "loen_eksport", "regnskab_eksport",
      "geofence", "tilbud", "materialer", "kvalitetskontrol", "noegler",
      "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner",
      "regnskab", "backup",
    ]),
    active: 1, sortOrder: 3,
  }).returning().get();

  const pEnterprise = db.insert(plans).values({
    name: "Enterprise", slug: "enterprise",
    description: "Alt inklusiv — API/integrationer, avanceret backup, revisionsspor, GDPR/DPA, support/SLA.",
    monthlyPrice: 1999, pricePerEmployee: 0,
    maxEmployees: -1, maxCustomers: -1,
    features: JSON.stringify([
      "opgaver", "tidsregistrering", "kunder", "fakturering",
      "vagtplan", "fravaer", "fotodokumentation", "loen_eksport", "regnskab_eksport",
      "geofence", "api_integration", "revisionsspor",
      "tilbud", "materialer", "kvalitetskontrol", "noegler", "gdpr_vaerktoejer",
      "skabeloner", "rengoringsservice", "rengoringsaftaler", "rengoringsplaner",
      "regnskab", "backup", "support_sla",
    ]),
    active: 1, sortOrder: 4,
  }).returning().get();

  // ══════════════════════════════════════════════
  //  VIRKSOMHEDER
  // ══════════════════════════════════════════════
  const c1 = db.insert(companies).values({
    name: "Renser København ApS",
    address: "Vesterbrogade 4A, 1620 København V",
    cvr: "38 12 45 67",
    phone: "+45 33 12 34 56",
    email: "info@renser-kbh.dk",
    status: "aktiv",
    createdAt: todayPlus(-240) + "T09:00:00.000Z",
  }).returning().get();

  const c2 = db.insert(companies).values({
    name: "Nordjylland Rengøring",
    address: "Boulevarden 12, 9000 Aalborg",
    cvr: "35 67 89 01",
    phone: "+45 98 12 34 56",
    email: "kontakt@nordjylland-rengoering.dk",
    status: "proeve",
    createdAt: todayPlus(-9) + "T11:30:00.000Z",
  }).returning().get();

  // Tredje virksomhed i restance — så platformens spærringsflow kan ses virke
  const c3 = db.insert(companies).values({
    name: "Sydhavn Service ApS",
    address: "Sluseholmen 8, 2450 København SV",
    cvr: "41 22 88 03",
    phone: "+45 70 20 30 40",
    email: "post@sydhavnservice.dk",
    status: "i_restance",
    createdAt: todayPlus(-120) + "T08:15:00.000Z",
    notes: "Abonnementsfaktura RA-0002 er forfalden.",
  }).returning().get();

  // Fjerde virksomhed — spærret
  const c4 = db.insert(companies).values({
    name: "Midtby Rengøring",
    address: "Vestergade 22, 8000 Aarhus C",
    cvr: "29 14 56 70",
    phone: "+45 86 18 22 33",
    email: "info@midtby-rengoering.dk",
    status: "spaerret",
    createdAt: todayPlus(-200) + "T09:00:00.000Z",
    notes: "Spærret pga. manglende betaling efter 3 rykkere.",
  }).returning().get();

  // Femte virksomhed — aktiv, Vækst-pakke
  const c5 = db.insert(companies).values({
    name: "Hvidslibe Service",
    address: "Guldborgvej 14, 2000 Frederiksberg",
    cvr: "38 90 12 34",
    phone: "+45 33 21 45 67",
    email: "kontakt@hvidslibe.dk",
    status: "aktiv",
    createdAt: todayPlus(-90) + "T10:30:00.000Z",
    notes: "",
  }).returning().get();

  // Sjette virksomhed — prøveperiode, Start-pakke
  const c6 = db.insert(companies).values({
    name: "Blank & Klar ApS",
    address: "Hovedgaden 45, 4300 Holbæk",
    cvr: "52 33 71 88",
    phone: "+45 59 44 12 10",
    email: "hej@blankogklar.dk",
    status: "proeve",
    createdAt: todayPlus(-3) + "T14:20:00.000Z",
    notes: "Oprettet via selvbetjening.",
  }).returning().get();

  // Syvende virksomhed — aktiv, Fuld-pakke, årlig
  const c7 = db.insert(companies).values({
    name: "Pro-Clean Danmark",
    address: "Industrivej 12, 2600 Glostrup",
    cvr: "60 77 88 91",
    phone: "+45 43 26 70 80",
    email: "salg@proclean.dk",
    status: "aktiv",
    createdAt: todayPlus(-300) + "T08:00:00.000Z",
    notes: "Stor kunde — 18 ansatte.",
  }).returning().get();

  // ADD SmartRegnskabs egen driftsenhed — huser platformadministratoren
  const cPlatform = db.insert(companies).values({
    name: "ADD SmartRegnskab ApS (platform)",
    address: "Rentemestervej 62, 2400 København NV",
    cvr: "44 55 66 77",
    phone: "+45 71 99 00 11",
    email: "hej@addsmartregnskab.dk",
    status: "aktiv",
    kind: "platform",
    createdAt: todayPlus(-400) + "T10:00:00.000Z",
    notes: "Intern konto for ADD SmartRegnskabs eget team.",
  }).returning().get();

  // ══════════════════════════════════════════════
  //  ABONNEMENTER
  // ══════════════════════════════════════════════
  db.insert(subscriptions).values({
    companyId: c1.id, planId: pDrift.id, status: "aktiv", billingCycle: "maanedlig",
    trialEndsAt: null, currentPeriodStart: todayPlus(-8), currentPeriodEnd: todayPlus(22),
    startedAt: todayPlus(-240) + "T09:05:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: c2.id, planId: pStart.id, status: "proeve", billingCycle: "maanedlig",
    trialEndsAt: todayPlus(5), currentPeriodStart: todayPlus(-9), currentPeriodEnd: todayPlus(5),
    startedAt: todayPlus(-9) + "T11:32:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: c3.id, planId: pProf.id, status: "i_restance", billingCycle: "aarlig",
    trialEndsAt: null, currentPeriodStart: todayPlus(-40), currentPeriodEnd: todayPlus(325),
    startedAt: todayPlus(-120) + "T08:20:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: c4.id, planId: pStart.id, status: "spaerret", billingCycle: "maanedlig",
    trialEndsAt: null, currentPeriodStart: todayPlus(-50), currentPeriodEnd: todayPlus(-20),
    startedAt: todayPlus(-200) + "T09:00:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: c5.id, planId: pDrift.id, status: "aktiv", billingCycle: "maanedlig",
    trialEndsAt: null, currentPeriodStart: todayPlus(-10), currentPeriodEnd: todayPlus(20),
    startedAt: todayPlus(-90) + "T10:30:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: c6.id, planId: pStart.id, status: "proeve", billingCycle: "maanedlig",
    trialEndsAt: todayPlus(11), currentPeriodStart: todayPlus(-3), currentPeriodEnd: todayPlus(11),
    startedAt: todayPlus(-3) + "T14:20:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: c7.id, planId: pProf.id, status: "aktiv", billingCycle: "aarlig",
    trialEndsAt: null, currentPeriodStart: todayPlus(-100), currentPeriodEnd: todayPlus(265),
    startedAt: todayPlus(-300) + "T08:00:00.000Z", cancelledAt: null,
  }).run();

  db.insert(subscriptions).values({
    companyId: cPlatform.id, planId: pProf.id, status: "aktiv", billingCycle: "aarlig",
    trialEndsAt: null, currentPeriodStart: todayPlus(-30), currentPeriodEnd: todayPlus(335),
    startedAt: todayPlus(-400) + "T10:05:00.000Z", cancelledAt: null,
  }).run();

  // ══════════════════════════════════════════════
  //  BRUGERE — alle kodeord er hashede
  // ══════════════════════════════════════════════
  db.insert(users).values({ companyId: cPlatform.id, name: "Platform Administrator", email: "platform@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "platform_admin", active: 1 }).run();

  db.insert(users).values({ companyId: c1.id, name: "Admin Bruger", email: "leder@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();
  db.insert(users).values({ companyId: c1.id, name: "Mette Hansen", email: "holdleder@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "holdleder", employeeId: 1, active: 1 }).run();
  db.insert(users).values({ companyId: c1.id, name: "Lars Nielsen", email: "assistent@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "assistent", employeeId: 2, active: 1 }).run();
  db.insert(users).values({ companyId: c1.id, name: "Anne Christensen", email: "kunde@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "kunde", customerId: 1, active: 1 }).run();

  db.insert(users).values({ companyId: c2.id, name: "Erik Sørensen", email: "leder2@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();
  db.insert(users).values({ companyId: c3.id, name: "Hanne Krog", email: "leder3@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();
  db.insert(users).values({ companyId: c4.id, name: "Bo Martin", email: "leder4@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();
  db.insert(users).values({ companyId: c5.id, name: "Camilla Bjerg", email: "leder5@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();
  db.insert(users).values({ companyId: c6.id, name: "Dennis Lund", email: "leder6@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();
  db.insert(users).values({ companyId: c7.id, name: "Eva Holm", email: "leder7@addsmartregnskab.dk", password: DEMO_PW, emailVerified: 1, role: "leder", active: 1 }).run();

  // ══════════════════════════════════════════════
  //  MEDARBEJDERE
  // ══════════════════════════════════════════════
  const e1 = db.insert(employees).values({ companyId: c1.id, name: "Mette Hansen", phone: "+4523456789", email: "mette@addsmartregnskab.dk", role: "Holdleder", status: "optaget", weeklyHours: 40, employeeNumber: "M-0001", employmentStatus: "aktiv", startDate: "2023-03-01", position: "Holdleder", hourlyRate: 185, monthlySalary: 31000, contractType: "fast", skills: JSON.stringify(["IPC-certifikat", "Trappevask", "Kontorrenhold"]), contractDraft: "Ansættelseskontrakt for Mette Hansen..." }).returning().get();
  const e2 = db.insert(employees).values({ companyId: c1.id, name: "Lars Nielsen", phone: "+4531223344", email: "lars@addsmartregnskab.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37, employeeNumber: "M-0002", employmentStatus: "aktiv", startDate: "2024-01-15", position: "Rengøringsassistent", hourlyRate: 165, monthlySalary: 0, contractType: "timelønnet", skills: JSON.stringify(["Vinduespudsning", "Gulvvask"]) }).returning().get();
  const e3 = db.insert(employees).values({ companyId: c1.id, name: "Sofia Petersen", phone: "+4542556677", email: "sofia@addsmartregnskab.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 30, employeeNumber: "M-0003", employmentStatus: "aktiv", startDate: "2024-06-01", position: "Rengøringsassistent", hourlyRate: 155, monthlySalary: 0, contractType: "timelønnet", skills: JSON.stringify(["Kontorrenhold", "Trappevask"]) }).returning().get();
  const e4 = db.insert(employees).values({ companyId: c1.id, name: "Jens Müller", phone: "+4556789012", email: "jens@addsmartregnskab.dk", role: "Rengøringsassistent", status: "orlov", weeklyHours: 37, employeeNumber: "M-0004", employmentStatus: "pauseret", startDate: "2023-08-01", endDate: "2026-02-01", position: "Rengøringsassistent", hourlyRate: 160, monthlySalary: 0, contractType: "fast", skills: JSON.stringify(["Flytterengøring"]) }).returning().get();

  db.insert(employees).values({ companyId: c2.id, name: "Pia Holm", phone: "+4523112233", email: "pia@nordjylland.dk", role: "Holdleder", status: "ledig", weeklyHours: 40 }).run();
  db.insert(employees).values({ companyId: c2.id, name: "Tom Berg", phone: "+4534556677", email: "tom@nordjylland.dk", role: "Rengøringsassistent", status: "optaget", weeklyHours: 37 }).run();

  db.insert(employees).values({ companyId: c3.id, name: "Ove Dam", phone: "+4520304050", email: "ove@sydhavnservice.dk", role: "Holdleder", status: "ledig", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c3.id, name: "Rita Lund", phone: "+4520304051", email: "rita@sydhavnservice.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 32 }).run();
  db.insert(employees).values({ companyId: c3.id, name: "Naveed Aslam", phone: "+4520304052", email: "naveed@sydhavnservice.dk", role: "Rengøringsassistent", status: "optaget", weeklyHours: 37 }).run();

  db.insert(employees).values({ companyId: c4.id, name: "Bo Martin", phone: "+4586182234", email: "bo@midtby-rengoering.dk", role: "Holdleder", status: "ledig", weeklyHours: 40 }).run();
  db.insert(employees).values({ companyId: c4.id, name: "Gitte Vang", phone: "+4586182235", email: "gitte@midtby-rengoering.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37 }).run();

  db.insert(employees).values({ companyId: c5.id, name: "Camilla Bjerg", phone: "+4533214568", email: "camilla@hvidslibe.dk", role: "Holdleder", status: "optaget", weeklyHours: 40 }).run();
  db.insert(employees).values({ companyId: c5.id, name: "Mads Oddershede", phone: "+4533214569", email: "mads@hvidslibe.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c5.id, name: "Lene Friis", phone: "+4533214570", email: "lene@hvidslibe.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 30 }).run();

  db.insert(employees).values({ companyId: c6.id, name: "Dennis Lund", phone: "+4559441211", email: "dennis@blankogklar.dk", role: "Holdleder", status: "ledig", weeklyHours: 37 }).run();

  db.insert(employees).values({ companyId: c7.id, name: "Eva Holm", phone: "+4543267081", email: "eva@proclean.dk", role: "Holdleder", status: "optaget", weeklyHours: 40 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Kasper Vinther", phone: "+4543267082", email: "kasper@proclean.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Trine Madsen", phone: "+4543267083", email: "trine@proclean.dk", role: "Rengøringsassistent", status: "optaget", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Hussain Ali", phone: "+4543267084", email: "hussain@proclean.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Stine Borch", phone: "+4543267085", email: "stine@proclean.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 32 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Mikkel Dahl", phone: "+4543267086", email: "mikkel@proclean.dk", role: "Rengøringsassistent", status: "optaget", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Yasmin Khan", phone: "+4543267087", email: "yasmin@proclean.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37 }).run();
  db.insert(employees).values({ companyId: c7.id, name: "Per Højgaard", phone: "+4543267088", email: "per@proclean.dk", role: "Rengøringsassistent", status: "ledig", weeklyHours: 37 }).run();

  // ══════════════════════════════════════════════
  //  KUNDER — med koordinater, så geofence kan virke
  // ══════════════════════════════════════════════
  const cu1 = db.insert(customers).values({ companyId: c1.id, name: "København Erhverv A/S", address: "Vesterbrogade 4A, 1620 København V", phone: "+4533123456", email: "anne@kbherhverv.dk", contact: "Anne Christensen", hourlyRate: 375, lat: 55.6721, lng: 12.5528, geofenceRadius: 150, customerNumber: "K-0001", contactPerson: "Anne Christensen", cvr: "12345678", ean: "5790001234567", paymentTerms: "30 dage", invoiceEmail: "faktura@kbherhverv.dk", accessNotes: "Nøgle i nøgleboks ved hovedindgang. Kode: 4823. Adgang 06:00-18:00.", multipleAddresses: JSON.stringify([{label: "Hovedkontor", address: "Vesterbrogade 4A", postcode: "1620", city: "København V"}, {label: "Lager", address: "Sydhavnsgade 12", postcode: "2450", city: "København SV"}]) }).returning().get();
  const cu2 = db.insert(customers).values({ companyId: c1.id, name: "Nordhavn Kontorcenter", address: "Nordre Toldbod 17, 1259 København K", phone: "+4533112233", email: "peter@nordhavnkc.dk", contact: "Peter Lund", hourlyRate: 350, lat: 55.6889, lng: 12.5990, geofenceRadius: 200, customerNumber: "K-0002", contactPerson: "Peter Lund", cvr: "23456789", ean: "5790002345678", paymentTerms: "14 dage", invoiceEmail: "okonomi@nordhavnkc.dk", accessNotes: "Portnøgle hos portner. Adgang døgnet rundt.", multipleAddresses: JSON.stringify([{label: "Kontorcenter", address: "Nordre Toldbod 17", postcode: "1259", city: "København K"}]) }).returning().get();
  const cu3 = db.insert(customers).values({ companyId: c1.id, name: "Frederiksberg Skole", address: "Frederiksberg Allé 25, 1820 Frederiksberg", phone: "+4538872211", email: "birgitte@fbskole.dk", contact: "Birgitte Holm", hourlyRate: 325, lat: 55.6739, lng: 12.5388, geofenceRadius: 250, customerNumber: "K-0003", contactPerson: "Birgitte Holm", cvr: "34567890", ean: "5790003456789", paymentTerms: "30 dage", invoiceEmail: "okonomi@fbskole.dk", accessNotes: "Hovednøgle hos vicevært. Rengøring uden for undervisningstid.", multipleAddresses: JSON.stringify([{label: "Skole", address: "Frederiksberg Allé 25", postcode: "1820", city: "Frederiksberg"}]) }).returning().get();
  const cu4 = db.insert(customers).values({ companyId: c1.id, name: "Tivoli Konference", address: "Vesterbrogade 3, 1630 København V", phone: "+4533151001", email: "mikkel@tivolikonference.dk", contact: "Mikkel Berg", hourlyRate: 400, lat: 55.6736, lng: 12.5681, geofenceRadius: 150, customerNumber: "K-0004", contactPerson: "Mikkel Berg", cvr: "45678901", ean: "5790004567890", paymentTerms: "8 dage", invoiceEmail: "faktura@tivolikonference.dk", accessNotes: " Receptionen har adgangskort. Kode til rengørum: 7788.", multipleAddresses: JSON.stringify([{label: "Konferencecenter", address: "Vesterbrogade 3", postcode: "1630", city: "København V"}]) }).returning().get();
  const cu5 = db.insert(customers).values({ companyId: c1.id, name: "Amager Medicinalhus", address: "Amagerbrogade 112, 2300 København S", phone: "+4532884455", email: "camilla@amagermed.dk", contact: "Camilla Vie", hourlyRate: 360, lat: 55.6588, lng: 12.6104, geofenceRadius: 150, customerNumber: "K-0005", contactPerson: "Camilla Vie", cvr: "56789012", ean: "5790005678901", paymentTerms: "30 dage", invoiceEmail: "okonomi@amagermed.dk", accessNotes: "Nøglekort udleveres ved reception. Særlige hygiejnekrav.", multipleAddresses: JSON.stringify([{label: "Medicinalhus", address: "Amagerbrogade 112", postcode: "2300", city: "København S"}]) }).returning().get();

  db.insert(customers).values({ companyId: c2.id, name: "Aalborg Universitet", address: "Fredrik Bajers Vej 7, 9220 Aalborg", phone: "+4599401234", email: "karl@aau.dk", contact: "Karl Nielsen", hourlyRate: 340, lat: 57.0158, lng: 9.9764, geofenceRadius: 300 }).run();
  db.insert(customers).values({ companyId: c3.id, name: "Sluseholmen Beboerforening", address: "Sluseholmen 2, 2450 København SV", phone: "+4570203041", email: "formand@sluseholmen.dk", contact: "Bent Ravn", hourlyRate: 330, lat: 55.6469, lng: 12.5386, geofenceRadius: 200 }).run();

  db.insert(customers).values({ companyId: c4.id, name: "Aarhus Rådhus", address: "Rådhuspladsen 2, 8000 Aarhus C", phone: "+4589401234", email: "service@aarhus.dk", contact: "Lene Friis", hourlyRate: 350, lat: 56.1500, lng: 10.2044, geofenceRadius: 200 }).run();
  db.insert(customers).values({ companyId: c5.id, name: "Frederiksberg Centret", address: "Frederiksberggade 30, 2000 Frederiksberg", phone: "+4533214580", email: "info@fbg-centret.dk", contact: "Hanne Berg", hourlyRate: 360, lat: 55.6800, lng: 12.5340, geofenceRadius: 150 }).run();
  db.insert(customers).values({ companyId: c6.id, name: "Holbæk Bibliotek", address: "Søndre Strandvej 3, 4300 Holbæk", phone: "+4559441300", email: "bib@holbaek.dk", contact: "Marianne Lund", hourlyRate: 320, lat: 55.7180, lng: 11.7100, geofenceRadius: 150 }).run();
  db.insert(customers).values({ companyId: c7.id, name: "Glostrup Hospital", address: "Nordre Ringvej 57, 2600 Glostrup", phone: "+4543267090", email: "service@glosh.dk", contact: "Karsten Holm", hourlyRate: 380, lat: 55.6640, lng: 12.3940, geofenceRadius: 300 }).run();
  db.insert(customers).values({ companyId: c7.id, name: "BFN Kontorhus", address: "Industrivej 10, 2600 Glostrup", phone: "+4543267091", email: "kontor@bfn.dk", contact: "Søren Krog", hourlyRate: 370, lat: 55.6635, lng: 12.3920, geofenceRadius: 150 }).run();

  // ══════════════════════════════════════════════
  //  OPGAVER
  // ══════════════════════════════════════════════
  const t1 = db.insert(tasks).values({ companyId: c1.id, title: "Daglig rengøring — kontoretage", customerId: cu1.id, employeeId: e1.id, date: todayStr(), startTime: "08:00", endTime: "11:00", status: "igang", priority: "høj", description: "Gulve, borde, køkken, toiletter.", checklist: JSON.stringify([{ label: "Gulvvask gang A", done: true }, { label: "Køkken rengjort", done: false }]), recurrence: "daglig", recurrenceEndDate: todayPlus(21) }).returning().get();
  const t2 = db.insert(tasks).values({ companyId: c1.id, title: "Vinduespudsning — stueetage", customerId: cu2.id, employeeId: e2.id, date: todayStr(), startTime: "09:00", endTime: "12:00", status: "planlagt", priority: "normal", description: "Alle indvendige vinduer i stueetagen.", recurrence: "ugentlig", recurrenceEndDate: todayPlus(56) }).returning().get();
  db.insert(tasks).values({ companyId: c1.id, title: "Gulvafspritning — klasselokaler", customerId: cu3.id, employeeId: e3.id, date: todayStr(), startTime: "14:00", endTime: "16:30", status: "planlagt", priority: "høj", description: "Efter rengøring af klasselokaler.", recurrence: "ingen" }).run();
  db.insert(tasks).values({ companyId: c1.id, title: "Storengøring — konferencesal", customerId: cu4.id, employeeId: e1.id, date: todayPlus(1), startTime: "07:00", endTime: "15:00", status: "planlagt", priority: "høj", description: "Dybderengøring før arrangement.", recurrence: "ingen" }).run();
  const t5 = db.insert(tasks).values({ companyId: c1.id, title: "Ugentlig grundrengøring", customerId: cu5.id, employeeId: e3.id, date: todayPlus(-1), startTime: "10:00", endTime: "13:00", status: "færdig", priority: "normal", description: "Standard ugentlig rengøring.", recurrence: "ugentlig", recurrenceEndDate: todayPlus(84), checklist: JSON.stringify([{ label: "Venteværelse", done: true }, { label: "Toiletter", done: true }]) }).returning().get();
  db.insert(tasks).values({ companyId: c1.id, title: "Glas og spejle — alle etager", customerId: cu1.id, employeeId: e2.id, date: todayPlus(2), startTime: "08:00", endTime: "10:00", status: "planlagt", priority: "lav", description: "Ugentlig vinduespudsning indvendig.", recurrence: "ugentlig", recurrenceEndDate: todayPlus(70) }).run();

  // ══════════════════════════════════════════════
  //  TIDSREGISTRERINGER — inkl. en afvigelse
  // ══════════════════════════════════════════════
  db.insert(timeEntries).values({ companyId: c1.id, employeeId: e1.id, taskId: t1.id, date: todayStr(), startTime: "08:00", endTime: null, note: "Igangværende rengøring af kontoretage.", checkInLat: 55.6722, checkInLng: 12.5530, checkInDistance: 22, geofenceStatus: "indenfor" }).run();
  db.insert(timeEntries).values({ companyId: c1.id, employeeId: e3.id, taskId: t5.id, date: todayPlus(-1), startTime: "10:00", endTime: "13:00", durationMinutes: 180, note: "Færdiggjort grundrengøring.", checkInLat: 55.6590, checkInLng: 12.6106, checkOutLat: 55.6589, checkOutLng: 12.6105, checkInDistance: 27, checkOutDistance: 18, geofenceStatus: "indenfor", approved: 1 }).run();
  // Denne er registreret 2,4 km fra adressen — den skal give en advarsel i systemet
  db.insert(timeEntries).values({ companyId: c1.id, employeeId: e2.id, taskId: t2.id, date: todayPlus(-1), startTime: "08:00", endTime: "12:00", durationMinutes: 240, note: "Kørte forkert — startede måleren for tidligt.", checkInLat: 55.6700, checkInLng: 12.5700, checkInDistance: 2094, geofenceStatus: "udenfor" }).run();
  db.insert(timeEntries).values({ companyId: c1.id, employeeId: e1.id, date: todayPlus(-2), startTime: "07:30", endTime: "11:00", durationMinutes: 210, note: "Morgenrunde Nordhavn.", geofenceStatus: "ingen_gps", approved: 1 }).run();
  db.insert(timeEntries).values({ companyId: c1.id, employeeId: e2.id, date: todayPlus(-3), startTime: "08:00", endTime: "15:30", durationMinutes: 450, note: "Fuld dag hos Frederiksberg Skole.", geofenceStatus: "ingen_gps", approved: 1 }).run();

  // ══════════════════════════════════════════════
  //  FRAVÆR
  // ══════════════════════════════════════════════
  db.insert(absences).values({ companyId: c1.id, employeeId: e4.id, type: "barsel", startDate: todayPlus(-30), endDate: todayPlus(150), hoursPerDay: 7.4, status: "godkendt", paid: 1, note: "Barselsorlov aftalt med HR.", approvedBy: 2, approvedAt: todayPlus(-32) + "T10:00:00.000Z", createdAt: todayPlus(-40) + "T09:00:00.000Z" }).run();
  db.insert(absences).values({ companyId: c1.id, employeeId: e2.id, type: "ferie", startDate: todayPlus(14), endDate: todayPlus(25), hoursPerDay: 7.4, status: "godkendt", paid: 1, note: "Sommerferie.", approvedBy: 2, approvedAt: todayPlus(-5) + "T14:20:00.000Z", createdAt: todayPlus(-7) + "T16:00:00.000Z" }).run();
  db.insert(absences).values({ companyId: c1.id, employeeId: e3.id, type: "sygdom", startDate: todayPlus(-4), endDate: todayPlus(-3), hoursPerDay: 6, status: "godkendt", paid: 1, note: "Influenza.", approvedBy: 2, approvedAt: todayPlus(-3) + "T08:10:00.000Z", createdAt: todayPlus(-4) + "T07:15:00.000Z" }).run();
  db.insert(absences).values({ companyId: c1.id, employeeId: e1.id, type: "omsorgsdag", startDate: todayPlus(7), endDate: todayPlus(7), hoursPerDay: 7.4, status: "afventer", paid: 1, note: "Skolestart for datteren.", createdAt: todayPlus(-1) + "T19:30:00.000Z" }).run();
  db.insert(absences).values({ companyId: c1.id, employeeId: e2.id, type: "barn_syg", startDate: todayPlus(-10), endDate: todayPlus(-10), hoursPerDay: 7.4, status: "godkendt", paid: 1, note: null, approvedBy: 2, approvedAt: todayPlus(-10) + "T09:00:00.000Z", createdAt: todayPlus(-10) + "T06:45:00.000Z" }).run();

  // ══════════════════════════════════════════════
  //  VAGTPLAN — næste uge
  // ══════════════════════════════════════════════
  const shiftPlan: Array<[number, number, number, string, string, string]> = [
    [e1.id, cu1.id, 1, "07:00", "15:00", "Fast morgenvagt"],
    [e2.id, cu2.id, 1, "09:00", "16:00", ""],
    [e3.id, cu3.id, 1, "13:00", "20:00", "Aftenrengøring skole"],
    [e1.id, cu1.id, 2, "07:00", "15:00", ""],
    [e3.id, cu5.id, 2, "10:00", "17:00", ""],
    [e2.id, cu4.id, 3, "06:00", "14:00", "Konference — ekstra bemanding"],
    [e1.id, cu2.id, 3, "08:00", "16:00", ""],
    [e3.id, cu3.id, 4, "13:00", "20:00", ""],
    [e2.id, cu1.id, 4, "07:30", "15:30", ""],
    [e1.id, cu5.id, 5, "09:00", "16:00", ""],
  ];
  for (const [empId, custId, dayOffset, start, end, note] of shiftPlan) {
    db.insert(shifts).values({
      companyId: c1.id, employeeId: empId, customerId: custId,
      date: todayPlus(dayOffset), startTime: start, endTime: end,
      note: note || null, published: dayOffset <= 2 ? 1 : 0,
    }).run();
  }

  // ══════════════════════════════════════════════
  //  NOTIFIKATIONER
  // ══════════════════════════════════════════════
  db.insert(notifications).values({ companyId: c1.id, userId: 2, title: "Check-in uden for arbejdsadressen", message: "Lars Nielsen: Check-in var 2094 m fra Nordhavn Kontorcenter (grænse 200 m).", type: "warning", read: false, createdAt: nowISO() }).run();
  db.insert(notifications).values({ companyId: c1.id, userId: 2, title: "Fravær afventer godkendelse", message: "Mette Hansen har anmodet om omsorgsdag.", type: "info", read: false, createdAt: nowISO() }).run();
  db.insert(notifications).values({ companyId: c1.id, userId: 2, title: "Tidsmåler kører", message: "Mette Hansen har en aktiv tidsmåler siden 08:00.", type: "info", read: false, createdAt: nowISO() }).run();
  db.insert(notifications).values({ companyId: c1.id, userId: 2, title: "Faktura forfalden", message: "F-2026-0004 til Nordhavn Kontorcenter er forfalden.", type: "warning", read: false, createdAt: nowISO() }).run();
  db.insert(notifications).values({ companyId: c1.id, userId: 2, title: "Opgave afsluttet", message: "Ugentlig grundrengøring hos Amager Medicinalhus er færdig.", type: "success", read: true, createdAt: nowISO() }).run();

  // ══════════════════════════════════════════════
  //  KUNDEFAKTURAER — med rigtig momsopdeling
  // ══════════════════════════════════════════════
  function seedInvoice(
    customerId: number, number: string, status: string,
    issue: string, due: string, lines: Array<[string, number, number]>,
    extra: Record<string, unknown> = {},
  ) {
    let net = 0;
    for (const [, qty, price] of lines) net += qty * price;
    net = Math.round(net * 100) / 100;
    const vat = Math.round(net * 25) / 100;
    const inv = db.insert(invoices).values({
      companyId: c1.id, customerId, invoiceNumber: number, status,
      issueDate: issue, dueDate: due,
      netAmount: net, vatRate: 25, vatAmount: vat, totalAmount: Math.round((net + vat) * 100) / 100,
      paymentTerms: 14, ...extra,
    }).returning().get();
    for (const [desc, qty, price] of lines) {
      db.insert(invoiceItems).values({
        invoiceId: inv.id, description: desc, quantity: qty, unitPrice: price,
        amount: Math.round(qty * price * 100) / 100, vatRate: 25,
      }).run();
    }
    return inv;
  }

  seedInvoice(cu1.id, "F-2026-0001", "sendt", todayPlus(-7), todayPlus(7),
    [["Daglig rengøring — kontoretage (25 timer)", 25, 375]],
    { sentAt: todayPlus(-7) + "T14:00:00.000Z" });

  seedInvoice(cu5.id, "F-2026-0002", "betalt", todayPlus(-30), todayPlus(-16),
    [["Ugentlig grundrengøring (9 timer)", 9, 360]],
    { sentAt: todayPlus(-30) + "T10:00:00.000Z", paidAt: todayPlus(-19) + "T09:12:00.000Z" });

  seedInvoice(cu4.id, "F-2026-0003", "kladde", todayStr(), todayPlus(14),
    [["Storengøring — konferencesal (16 timer)", 16, 400], ["Særligt rengøringsmiddel", 4, 189]]);

  // Denne er forfalden — så rykkerflowet kan afprøves med det samme
  seedInvoice(cu2.id, "F-2026-0004", "sendt", todayPlus(-45), todayPlus(-31),
    [["Vinduespudsning — stueetage (12 timer)", 12, 350]],
    { sentAt: todayPlus(-45) + "T11:00:00.000Z" });

  seedInvoice(cu3.id, "F-2026-0005", "forfalden", todayPlus(-60), todayPlus(-46),
    [["Gulvafspritning — klasselokaler (20 timer)", 20, 325]],
    { sentAt: todayPlus(-60) + "T09:30:00.000Z", reminderCount: 1, lastReminderAt: todayPlus(-20) + "T09:00:00.000Z" });

  // ══════════════════════════════════════════════
  //  ABONNEMENTSFAKTURAER — ADD SmartRegnskab → virksomhederne
  // ══════════════════════════════════════════════
  db.insert(platformInvoices).values({
    companyId: c1.id, subscriptionId: 1, invoiceNumber: "RA-2026-0001",
    periodStart: todayPlus(-38), periodEnd: todayPlus(-8),
    planName: "Vækst", employeeCount: 4,
    netAmount: 715, vatAmount: 178.75, totalAmount: 893.75,
    status: "betalt", issueDate: todayPlus(-38), dueDate: todayPlus(-24),
    paidAt: todayPlus(-30) + "T12:00:00.000Z",
  }).run();

  db.insert(platformInvoices).values({
    companyId: c3.id, subscriptionId: 3, invoiceNumber: "RA-2026-0002",
    periodStart: todayPlus(-40), periodEnd: todayPlus(325),
    planName: "Fuld", employeeCount: 3,
    netAmount: 13560, vatAmount: 3390, totalAmount: 16950,
    status: "forfalden", issueDate: todayPlus(-40), dueDate: todayPlus(-26),
    paidAt: null,
  }).run();

  // ══════════════════════════════════════════════
  //  INTEGRATIONER
  // ══════════════════════════════════════════════
  const integrationSet: Array<[string, string, string]> = [
    ["loen", "Danløn", "demo_forbundet"],
    ["loen", "Dataløn (Bluegarden)", "ikke_opsat"],
    ["loen", "Zenegy", "ikke_opsat"],
    ["regnskab", "e-conomic", "demo_forbundet"],
    ["regnskab", "Dinero", "ikke_opsat"],
    ["regnskab", "Billy", "ikke_opsat"],
    ["regnskab", "Visma eAccounting", "ikke_opsat"],
  ];
  for (const [category, provider, status] of integrationSet) {
    db.insert(integrations).values({
      companyId: c1.id, category, provider, status, syncMode: "eksport",
      lastSyncAt: status === "demo_forbundet" ? nowISO() : null,
    }).run();
  }
  db.insert(integrations).values({ companyId: c2.id, category: "loen", provider: "Danløn", status: "ikke_opsat", syncMode: "eksport" }).run();
  db.insert(integrations).values({ companyId: c2.id, category: "regnskab", provider: "e-conomic", status: "ikke_opsat", syncMode: "eksport" }).run();
  db.insert(integrations).values({ companyId: c3.id, category: "loen", provider: "Zenegy", status: "ikke_opsat", syncMode: "eksport" }).run();

  // ══════════════════════════════════════════════
  //  TILBUD OG AFTALER
  // ══════════════════════════════════════════════
  function seedQuote(
    customerId: number, number: string, title: string, status: string,
    issueOffset: number, validOffset: number,
    items: Array<[string, number, string, number]>,
    contractId: number | null = null,
  ) {
    const net = items.reduce((sum, [, qty, , price]) => sum + qty * price, 0);
    const vat = Math.round(net * 0.25 * 100) / 100;
    const q = db.insert(quotes).values({
      companyId: c1.id, customerId, quoteNumber: number, title,
      description: "Tilbuddet er baseret på en gennemgang af lokalerne. Prisen er ekskl. moms og reguleres årligt efter nettoprisindekset.",
      netAmount: Math.round(net * 100) / 100, vatAmount: vat,
      totalAmount: Math.round((net + vat) * 100) / 100,
      status, validUntil: todayPlus(validOffset), issueDate: todayPlus(issueOffset),
      respondedAt: status === "accepteret" || status === "afvist" ? todayPlus(issueOffset + 4) + "T10:00:00.000Z" : null,
      contractId,
    }).returning().get();
    for (const [description, quantity, unit, unitPrice] of items) {
      db.insert(quoteItems).values({
        quoteId: q.id, description, quantity, unit, unitPrice,
        amount: Math.round(quantity * unitPrice * 100) / 100,
      }).run();
    }
    return q;
  }

  const k1 = db.insert(contracts).values({
    companyId: c1.id, customerId: cu1.id, contractNumber: "K-2026-0001",
    title: "Daglig kontorrengøring — Nordhavn", pricingModel: "fast_maaned",
    agreedRate: 18500, hoursIncluded: 160, overtimeRate: 375,
    frequency: "daglig", startDate: todayPlus(-210), endDate: null, noticeMonths: 3,
    indexAdjustment: 1, status: "aktiv",
    terms: "Rengøring alle hverdage kl. 17-20. Forbrugsmaterialer indgår. Ekstraopgaver afregnes efter aftale til 375 kr. pr. time.",
  }).returning().get();

  db.insert(contracts).values({
    companyId: c1.id, customerId: cu5.id, contractNumber: "K-2026-0002",
    title: "Ugentlig grundrengøring — klinik", pricingModel: "timepris",
    agreedRate: 395, hoursIncluded: 0, overtimeRate: 0,
    frequency: "ugentlig", startDate: todayPlus(-95), endDate: todayPlus(270), noticeMonths: 1,
    indexAdjustment: 0, status: "aktiv",
    terms: "Afregning efter registrerede timer. Klinikken stiller egne desinfektionsmidler til rådighed."
  }).run();

  db.insert(contracts).values({
    companyId: c1.id, customerId: cu2.id, contractNumber: "K-2026-0003",
    title: "Vinduespolering — hver 14. dag", pricingModel: "pr_besoeg",
    agreedRate: 1450, hoursIncluded: 0, overtimeRate: 0,
    frequency: "hver_14_dag", startDate: todayPlus(-60), endDate: null, noticeMonths: 1,
    indexAdjustment: 0, status: "aktiv",
    terms: "Indvendig og udvendig polering i stueetagen. Lift bestilles særskilt ved etager over 2."
  }).run();

  seedQuote(cu1.id, "T-2026-0001", "Daglig kontorrengøring — Nordhavn", "accepteret", -215, -180, [
    ["Daglig rengøring, kontoretage, alle hverdage", 1, "md", 15500],
    ["Forbrugsmaterialer og aftørringspapir", 1, "md", 1800],
    ["Vinduespolering indvendig, månedligt", 1, "md", 1200],
  ], k1.id);

  seedQuote(cu3.id, "T-2026-0002", "Trappevask — 4 opgange", "sendt", -6, 24, [
    ["Trappevask, opgang A-D, ugentligt", 4, "stk", 890],
    ["Hovedrengøring af kældergang, engangsopgave", 6, "timer", 395],
  ]);

  seedQuote(cu4.id, "T-2026-0003", "Storrengøring efter arrangement", "kladde", -1, 29, [
    ["Storrengøring, konferencesal 480 m²", 480, "m2", 14],
    ["Polering af gulve", 8, "timer", 425],
  ]);

  seedQuote(cu2.id, "T-2026-0004", "Facadevask med lift", "afvist", -45, -15, [
    ["Facadevask, 320 m²", 320, "m2", 38],
    ["Liftleje inkl. fører", 2, "stk", 4200],
  ]);

  // ══════════════════════════════════════════════
  //  MATERIALER OG LAGER
  // ══════════════════════════════════════════════
  const materialSeed: Array<[string, string, string, number, number, number, number, string, number]> = [
    ["Universalrengøring, koncentrat 5 l", "RM-001", "liter", 82, 149, 14, 6, "Abena", 0],
    ["Sanitetsrens, sur 1 l", "RM-002", "stk", 34, 69, 3, 8, "Abena", 1],
    ["Aftørringspapir, 6 ruller", "PA-010", "stk", 96, 165, 22, 10, "Lyreco", 0],
    ["Toiletpapir, 36 ruller", "PA-011", "stk", 178, 289, 9, 6, "Lyreco", 0],
    ["Affaldssække 120 l, 100 stk", "PO-020", "stk", 118, 199, 5, 8, "Stadsing", 0],
    ["Mikrofiberklude, 10 stk", "RE-030", "stk", 89, 159, 31, 12, "Vikan", 0],
    ["Moppe, fladmoppe 40 cm", "RE-031", "stk", 145, 245, 12, 5, "Vikan", 0],
    ["Nitrilhandsker str. M, 100 stk", "VM-040", "stk", 72, 129, 2, 10, "Abena", 0],
    ["Gulvpolish, 5 l", "RM-003", "liter", 265, 445, 4, 3, "Diversey", 1],
    ["Vinduesvaskersæt med skraber", "RE-032", "stk", 320, 520, 6, 2, "Unger", 0],
  ];
  const materialIds: number[] = [];
  for (const [name, sku, unit, cost, sales, stock, minStock, supplier, hazardous] of materialSeed) {
    const m = db.insert(materials).values({
      companyId: c1.id, name, sku, unit, costPrice: cost, salesPrice: sales,
      stock, minStock, supplier, hazardous,
      safetySheetUrl: hazardous ? "https://example.dk/sikkerhedsdatablad/" + sku : null,
      active: 1
    }).returning().get();
    materialIds.push(m.id);
  }

  const usageSeed: Array<[number, number, number, string, number | null, number | null, number, string]> = [
    [0, 2, -1, "forbrug", cu1.id, e1.id, 1, "Daglig rengøring, kontoretage."],
    [2, 4, -1, "forbrug", cu1.id, e1.id, 1, "Genopfyldning af dispensere."],
    [3, 2, -2, "forbrug", cu3.id, e2.id, 1, "Opgang A og B."],
    [4, 3, -2, "forbrug", cu5.id, e3.id, 1, "Ugentlig grundrengøring."],
    [1, 2, -3, "forbrug", cu4.id, e1.id, 0, "Indgår i den faste månedspris."],
    [5, 10, -5, "indkoeb", null, null, 0, "Indkøb fra Vikan, faktura 88431."],
    [7, 20, -5, "indkoeb", null, null, 0, "Indkøb fra Abena, faktura 22190."],
    [8, 2, -8, "forbrug", cu4.id, e2.id, 1, "Polering af konferencesal."],
    [9, 1, -12, "forbrug", cu2.id, e2.id, 1, "Erstatning for slidt skraber."],
    [6, 4, -14, "forbrug", cu1.id, e4.id, 1, "Udskiftning af moppehoveder."],
  ];
  for (const [idx, quantity, dayOffset, kind, customerId, employeeId, billable, note] of usageSeed) {
    db.insert(materialUsage).values({
      companyId: c1.id, materialId: materialIds[idx], taskId: null,
      customerId, employeeId, quantity, kind, billable,
      invoicedAt: null, date: todayPlus(dayOffset), note
    }).run();
  }

  // ══════════════════════════════════════════════
  //  NØGLER OG ALARMKODER
  // ══════════════════════════════════════════════
  const keySeed: Array<[number, string, string, string, string | null, string | null, number | null, string]> = [
    [cu1.id, "Hovedindgang Nordhavn", "noegle", "NK-014", null, "Nøglen hænger i skabet ved varelevering uden for arbejdstid.", e1.id, "udlaant"],
    [cu1.id, "Alarm, hovedpanel", "alarmkode", "AL-01", "492817", "Alarmen slås fra inden 30 sekunder. Panelet sidder til højre for døren.", e1.id, "udlaant"],
    [cu2.id, "Adgangsbrik stueetage", "brik", "BR-221", null, "Brikken virker kun mellem kl. 06 og 22.", e2.id, "udlaant"],
    [cu3.id, "Opgang A-D, systemnøgle", "noegle", "SY-los-9", null, "Samme nøgle passer til alle fire opgange og til kældergangen.", null, "på_lager"],
    [cu4.id, "Kodelås personaleindgang", "kode", "KL-3", "7742", "Tryk stjerne før koden. Låsen bipper to gange ved godkendt kode.", null, "på_lager"],
    [cu5.id, "Klinikkens bagdør", "noegle", "KL-77", null, "Adgang kun efter kl. 16, når patienterne er gået.", e3.id, "udlaant"],
    [cu2.id, "Reservenøgle kontor", "noegle", "RE-04", null, "Meldt bortkommet — låsen bør omlægges.", null, "bortkommet"],
  ];
  const keyIds: number[] = [];
  for (const [customerId, label, keyType, identifier, secret, accessNote, holder, status] of keySeed) {
    const k = db.insert(keys).values({
      companyId: c1.id, customerId, label, keyType, identifier,
      secretEnc: secret ? encryptField(secret) : null,
      accessNote, holderEmployeeId: holder, status,
      deposit: keyType === "noegle" ? 500 : 0,
      createdAt: todayPlus(-180) + "T09:00:00.000Z",
    }).returning().get();
    keyIds.push(k.id);
  }

  const handoverSeed: Array<[number, number | null, number | null, string, string, number, string]> = [
    [0, null, e1.id, "udlaan", "Mette Hansen", -180, "Udleveret ved aftalens start. Kvittering underskrevet."],
    [1, null, e1.id, "udlaan", "Mette Hansen", -180, "Alarmkode gennemgået sammen med kunden."],
    [2, null, e2.id, "udlaan", "Lars Nielsen", -60, "Brik aktiveret af kundens driftschef."],
    [5, null, e3.id, "udlaan", "Sofie Berg", -95, "Udleveret sammen med instruks om aftenadgang."],
    [6, e2.id, null, "bortkommet", "Lars Nielsen", -20, "Nøglen forsvandt under transport. Kunden er orienteret samme dag."],
    [3, e4.id, null, "retur", "Anders Dam", -30, "Returneret efter endt vikariat."],
  ];
  for (const [idx, fromEmployeeId, toEmployeeId, action, signedBy, dayOffset, note] of handoverSeed) {
    db.insert(keyHandovers).values({
      companyId: c1.id, keyId: keyIds[idx], fromEmployeeId, toEmployeeId,
      action, signedBy, date: todayPlus(dayOffset), note
    }).run();
  }

  // ══════════════════════════════════════════════
  //  KVALITETSKONTROL
  // ══════════════════════════════════════════════
  function seedInspection(
    customerId: number, employeeId: number, dayOffset: number,
    raw: Array<[string, number, number]>,
    followUpOffset: number | null, followUpDone: number, note: string,
  ) {
    const scores = raw.map(([area, weight, score]) => ({ area, weight, score }));
    const weightSum = scores.reduce((s, x) => s + x.weight, 0);
    const total = Math.round((scores.reduce((s, x) => s + x.score * x.weight, 0) / (weightSum * 5)) * 1000) / 10;
    const result = total >= 90 ? "godkendt" : total >= 75 ? "anmaerkning" : "ikke_godkendt";
    db.insert(inspections).values({
      companyId: c1.id, customerId, taskId: null, employeeId, inspectorId: e1.id,
      date: todayPlus(dayOffset), scores: JSON.stringify(scores),
      totalScore: total, result,
      followUpDate: followUpOffset === null ? null : todayPlus(followUpOffset),
      followUpDone, customerVisible: 1, note
    }).run();
  }

  const areaW: Array<[string, number]> = [
    ["gulve", 25], ["sanitet", 25], ["inventar", 20], ["koekken", 15], ["affald", 10], ["indtryk", 5],
  ];
  const mk = (v: number[]) => areaW.map(([a, w], i) => [a, w, v[i]] as [string, number, number]);

  seedInspection(cu1.id, e1.id, -3, mk([5, 5, 5, 4, 5, 5]), null, 0, "Meget pænt niveau. Kun mindre støv på reoler i mødelokale 3.");
  seedInspection(cu2.id, e2.id, -7, mk([4, 3, 4, 4, 4, 4]), 3, 0, "Sanitet skal have et løft. Kalkaflejringer i to håndvaske.");
  seedInspection(cu5.id, e3.id, -10, mk([5, 5, 4, 5, 5, 5]), null, 0, "Klinikken er tilfreds. Ingen bemærkninger fra personalet.");
  seedInspection(cu3.id, e2.id, -18, mk([3, 3, 3, 2, 4, 3]), -11, 1, "Trappevask var ikke gennemført i opgang C. Genbesøg aftalt og udført.");
  seedInspection(cu4.id, e4.id, -25, mk([4, 4, 5, 4, 5, 4]), null, 0, "God stand efter arrangementet. Enkelte pletter på gulv i foyer.");
  seedInspection(cu1.id, e4.id, -34, mk([5, 4, 4, 4, 5, 4]), null, 0, "Stabil kvalitet gennem hele måneden.");

  // ══════════════════════════════════════════════
  //  BETALINGSMIDLER OG SAMTYKKER
  // ══════════════════════════════════════════════
  db.insert(paymentMethods).values({
    companyId: c1.id, provider: "stripe", providerRef: "pm_demo_c1_visa",
    brand: "visa", last4: "4242", expMonth: 11, expYear: 2029,
    isDefault: 1, status: "aktiv", createdAt: todayPlus(-240) + "T09:10:00.000Z",
  }).run();
  db.insert(paymentMethods).values({
    companyId: c1.id, provider: "mobilepay", providerRef: "mp_demo_c1",
    brand: "mobilepay", last4: "6789", expMonth: null, expYear: null,
    isDefault: 0, status: "aktiv", createdAt: todayPlus(-120) + "T09:10:00.000Z",
  }).run();
  db.insert(paymentMethods).values({
    companyId: c3.id, provider: "stripe", providerRef: "pm_demo_c3_mc",
    brand: "mastercard", last4: "8210", expMonth: 4, expYear: 2026,
    isDefault: 1, status: "fejlet", createdAt: todayPlus(-400) + "T10:10:00.000Z",
  }).run();

  // DPA-samtykke for alle kundevirksomheder (nogle har accepteret, andre afventer)
  for (const [comp, accepted] of [[c1, true], [c2, true], [c3, true], [c4, false], [c5, true], [c6, false], [c7, true]] as [any, boolean][]) {
    db.insert(consents).values({
      companyId: comp.id, employeeId: 0, kind: "databehandling", granted: accepted ? 1 : 0,
      grantedAt: accepted ? todayPlus(-100) + "T10:00:00.000Z" : null, withdrawnAt: null, textVersion: "1.0",
    }).run();
  }

  for (const emp of [e1, e2, e3, e4]) {
    db.insert(consents).values({
      companyId: c1.id, employeeId: emp.id, kind: "databehandling", granted: 1,
      grantedAt: todayPlus(-150) + "T09:00:00.000Z", withdrawnAt: null, textVersion: "1.0",
    }).run();
  }
  db.insert(consents).values({
    companyId: c1.id, employeeId: e1.id, kind: "gps", granted: 1,
    grantedAt: todayPlus(-150) + "T09:01:00.000Z", withdrawnAt: null, textVersion: "1.0",
  }).run();
  db.insert(consents).values({
    companyId: c1.id, employeeId: e2.id, kind: "gps", granted: 0,
    grantedAt: todayPlus(-150) + "T09:02:00.000Z", withdrawnAt: todayPlus(-40) + "T11:00:00.000Z", textVersion: "1.0",
  }).run();
  db.insert(consents).values({
    companyId: c1.id, employeeId: e3.id, kind: "foto", granted: 1,
    grantedAt: todayPlus(-150) + "T09:03:00.000Z", withdrawnAt: null, textVersion: "1.0",
  }).run();

  // ═══════════════════════════════════════════════
  //  REGNSKAB — Dansk kontoplan for virksomhed 1
  // ═══════════════════════════════════════════════
  const dkAccounts = [
    { companyId: c1.id, accountNumber: "1000", name: "Bank", type: "aktiv", vatCode: "ingen", balance: 125000, active: 1 },
    { companyId: c1.id, accountNumber: "1010", name: "Kasse", type: "aktiv", vatCode: "ingen", balance: 3500, active: 1 },
    { companyId: c1.id, accountNumber: "1200", name: "Debitorer", type: "aktiv", vatCode: "ingen", balance: 45000, active: 1 },
    { companyId: c1.id, accountNumber: "1300", name: "Inventar og driftsmidler", type: "aktiv", vatCode: "ingen", balance: 89000, active: 1 },
    { companyId: c1.id, accountNumber: "1400", name: "Deposita", type: "aktiv", vatCode: "ingen", balance: 12000, active: 1 },
    { companyId: c1.id, accountNumber: "1500", name: "Varelager", type: "aktiv", vatCode: "ingen", balance: 18000, active: 1 },
    { companyId: c1.id, accountNumber: "2000", name: "Egenkapital", type: "passiv", vatCode: "ingen", balance: 150000, active: 1 },
    { companyId: c1.id, accountNumber: "2100", name: "Årets resultat", type: "passiv", vatCode: "ingen", balance: 0, active: 1 },
    { companyId: c1.id, accountNumber: "2200", name: "Leverandører", type: "passiv", vatCode: "ingen", balance: 28000, active: 1 },
    { companyId: c1.id, accountNumber: "2300", name: "Skyldig moms", type: "passiv", vatCode: "ingen", balance: 15600, active: 1 },
    { companyId: c1.id, accountNumber: "2310", name: "Salgsmoms (25%)", type: "passiv", vatCode: "I25", balance: 31200, active: 1 },
    { companyId: c1.id, accountNumber: "2320", name: "Koebsmoms (25%)", type: "passiv", vatCode: "S25", balance: 15600, active: 1 },
    { companyId: c1.id, accountNumber: "2400", name: "Skyldig løn", type: "passiv", vatCode: "ingen", balance: 22000, active: 1 },
    { companyId: c1.id, accountNumber: "2500", name: "Banklån", type: "passiv", vatCode: "ingen", balance: 65000, active: 1 },
    { companyId: c1.id, accountNumber: "3000", name: "Rengøringsydelser 25% moms", type: "indtaegt", vatCode: "I25", balance: 320000, active: 1 },
    { companyId: c1.id, accountNumber: "3010", name: "Faste rengoeringsaftaler", type: "indtaegt", vatCode: "I25", balance: 180000, active: 1 },
    { companyId: c1.id, accountNumber: "3020", name: "Ekstraopgaver", type: "indtaegt", vatCode: "I25", balance: 45000, active: 1 },
    { companyId: c1.id, accountNumber: "3030", name: "Materialer viderefaktureret", type: "indtaegt", vatCode: "I25", balance: 12000, active: 1 },
    { companyId: c1.id, accountNumber: "3040", name: "Salg uden moms (fritaget)", type: "indtaegt", vatCode: "FRI", balance: 0, active: 1 },
    { companyId: c1.id, accountNumber: "4000", name: "Rengøringsmidler", type: "udgift", vatCode: "S25", balance: 35000, active: 1 },
    { companyId: c1.id, accountNumber: "4010", name: "Forbrugsartikler", type: "udgift", vatCode: "S25", balance: 12000, active: 1 },
    { companyId: c1.id, accountNumber: "4020", name: "Underleverandoerer", type: "udgift", vatCode: "S25", balance: 28000, active: 1 },
    { companyId: c1.id, accountNumber: "4030", name: "Arbejdstoej", type: "udgift", vatCode: "S25", balance: 8000, active: 1 },
    { companyId: c1.id, accountNumber: "5000", name: "Løn", type: "udgift", vatCode: "ingen", balance: 145000, active: 1 },
    { companyId: c1.id, accountNumber: "5010", name: "Pension (ATP)", type: "udgift", vatCode: "ingen", balance: 8500, active: 1 },
    { companyId: c1.id, accountNumber: "5020", name: "Feriepenge", type: "udgift", vatCode: "ingen", balance: 13000, active: 1 },
    { companyId: c1.id, accountNumber: "5030", name: "Personaleomkostninger", type: "udgift", vatCode: "ingen", balance: 5000, active: 1 },
    { companyId: c1.id, accountNumber: "6000", name: "Husleje", type: "udgift", vatCode: "S25", balance: 42000, active: 1 },
    { companyId: c1.id, accountNumber: "6010", name: "Telefon/internet", type: "udgift", vatCode: "S25", balance: 8500, active: 1 },
    { companyId: c1.id, accountNumber: "6020", name: "Forsikring", type: "udgift", vatCode: "S25", balance: 15000, active: 1 },
    { companyId: c1.id, accountNumber: "6030", name: "Software/licenser", type: "udgift", vatCode: "S25", balance: 12000, active: 1 },
    { companyId: c1.id, accountNumber: "6040", name: "Markedsføring", type: "udgift", vatCode: "S25", balance: 8000, active: 1 },
    { companyId: c1.id, accountNumber: "6050", name: "Revisor/bogfoering", type: "udgift", vatCode: "S25", balance: 18000, active: 1 },
    { companyId: c1.id, accountNumber: "6060", name: "Bankgebyrer", type: "udgift", vatCode: "ingen", balance: 1200, active: 1 },
    { companyId: c1.id, accountNumber: "6070", name: "Koerselsgodtgorelse", type: "udgift", vatCode: "ingen", balance: 9500, active: 1 },
  ];
  for (const a of dkAccounts) {
    db.insert(accounts).values({ ...a, createdAt: nowISO() }).run();
  }

  // Demo posteringer
  const je1 = db.insert(journalEntries).values({
    companyId: c1.id, entryNumber: "B-001", date: todayPlus(-5), description: "Kontorrenhold Kvartalsafregning",
    reference: "INV-2026-081", sourceType: "faktura", sourceId: 1, status: "bogfoert",
    createdBy: "leder@addsmartregnskab.dk", createdAt: nowISO(),
  }).returning().get();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je1.id, accountId: 3, description: "Debitor Kvartalsafregning",
    debit: 25000, credit: 0, vatCode: "I25",
  }).run();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je1.id, accountId: 15, description: "Salg rengoeringsydelser",
    debit: 0, credit: 20000, vatCode: "I25",
  }).run();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je1.id, accountId: 11, description: "Salgsmoms 25%",
    debit: 0, credit: 5000, vatCode: "I25",
  }).run();

  const je2 = db.insert(journalEntries).values({
    companyId: c1.id, entryNumber: "B-002", date: todayPlus(-3), description: "Indkoeb rengoeringsmidler",
    reference: "REM-78901", sourceType: "bilag", sourceId: null, status: "bogfoert",
    createdBy: "leder@addsmartregnskab.dk", createdAt: nowISO(),
  }).returning().get();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je2.id, accountId: 19, description: "Rengøringsmidler",
    debit: 5000, credit: 0, vatCode: "S25",
  }).run();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je2.id, accountId: 12, description: "Koebsmoms 25%",
    debit: 1250, credit: 0, vatCode: "S25",
  }).run();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je2.id, accountId: 1, description: "Bank",
    debit: 0, credit: 6250, vatCode: "ingen",
  }).run();

  const je3 = db.insert(journalEntries).values({
    companyId: c1.id, entryNumber: "B-003", date: todayPlus(-1), description: "Loen januar 2026",
    reference: "LON-2026-01", sourceType: "loen", sourceId: null, status: "kladde",
    createdBy: "leder@addsmartregnskab.dk", createdAt: nowISO(),
  }).returning().get();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je3.id, accountId: 24, description: "Løn",
    debit: 14500, credit: 0, vatCode: "ingen",
  }).run();
  db.insert(journalLines).values({
    companyId: c1.id, journalEntryId: je3.id, accountId: 13, description: "Skyldig løn",
    debit: 0, credit: 14500, vatCode: "ingen",
  }).run();

  // Momsperiode
  db.insert(vatPeriods).values({
    companyId: c1.id, period: "2026-Q2", vatType: "kvartal",
    outputVat: 31200, inputVat: 15600, netVat: 15600, status: "indberettet",
    reportedAt: todayPlus(-10) + "T12:00:00.000Z", createdAt: nowISO(),
  }).run();
  db.insert(vatPeriods).values({
    companyId: c1.id, period: "2026-Q3", vatType: "kvartal",
    outputVat: 0, inputVat: 0, netVat: 0, status: "kladde",
    reportedAt: null, createdAt: nowISO(),
  }).run();

  // SKABELONER
  db.insert(templates).values({
    companyId: null, type: "tilbud", name: "Standard tilbud", subject: "Tilbud på rengoering {{virksomhed}}",
    body: "Kaere {{kunde}}\n\nVi fremsender hermed tilbud på rengoeringsydelser.\n\nOmfang: {{beskrivelse}}\nPris: {{pris}} kr. ekskl. moms\nGyldighed: 30 dage\n\nVi ser frem til at hoere fra dig.\n\nMed venlig hilsen\n{{virksomhed}}",
    isDefault: 1, createdAt: nowISO(),
  }).run();
  db.insert(templates).values({
    companyId: null, type: "faktura", name: "Standard faktura", subject: "Faktura {{fakturanr}} {{virksomhed}}",
    body: "Faktura nr: {{fakturanr}}\nDato: {{dato}}\nKunde: {{kunde}}\n\nBeskrivelse: {{beskrivelse}}\nBeloeb: {{beloeb}} kr. ekskl. moms\nMoms (25%): {{moms}} kr.\nI alt: {{total}} kr.\n\nBetalingsfrist: {{forfaldsdato}}",
    isDefault: 1, createdAt: nowISO(),
  }).run();
  db.insert(templates).values({
    companyId: null, type: "rykker", name: "Standard rykker", subject: "Rykker Faktura {{fakturanr}}",
    body: "Kaere {{kunde}}\n\nVi har endnu ikke modtaget betaling på faktura {{fakturanr}}.\n\nForfaldsdato: {{forfaldsdato}}\nBeloeb: {{beloeb}} kr.\n\nVi beder om betaling inden 5 dage.\n\nMed venlig hilsen\n{{virksomhed}}",
    isDefault: 1, createdAt: nowISO(),
  }).run();
  db.insert(templates).values({
    companyId: c1.id, type: "tilbud", name: "Renser Koebenhavn Tilbud", subject: "Tilbud fra Renser Koebenhavn",
    body: "Kaere {{kunde}}\n\nTak for jeres henvendelse. Vi er glade for at fremsende tilbud.\n\nYdelser: {{beskrivelse}}\nPris: {{pris}} kr./md ekskl. moms\n\nVi haaber at hoere fra jer snart.\n\nMed venlig hilsen\nRenser Koebenhavn ApS",
    isDefault: 0, createdAt: nowISO(),
  }).run();

  // RENGØRINGSYDELSER
  const services = [
    { companyId: c1.id, name: "Kontorrenhold — timebasis", description: "Regelmæssig rengøring af kontorlokaler på timebasis", unitType: "time", price: 350, hourlyRate: 350, estimatedHours: 3, estimatedTime: 180, category: "Kontor", active: 1, vatCode: "I25", weekendSurcharge: 50, eveningSurcharge: 25, materialSurcharge: 10, transportSurcharge: 4.5, standardTasks: JSON.stringify(["Støvsug gulve", "Vask gulve", "Aftør overflader", "Tøm skraldespande", "Rengør toiletter"]), standardMaterials: JSON.stringify([{name: "Universalrengøring", qty: 1, unit: "L"}, {name: "Støvsugerposer", qty: 2, unit: "stk"}]) },
    { companyId: c1.id, name: "Kontorrenhold — pr. m²", description: "Rengøring baseret på kvadratmeter", unitType: "kvm", price: 12, hourlyRate: 0, estimatedHours: 0, estimatedTime: 0, category: "Kontor", active: 1, vatCode: "I25", weekendSurcharge: 50, eveningSurcharge: 25, materialSurcharge: 10, transportSurcharge: 4.5, standardTasks: JSON.stringify(["Vask gulve", "Aftør overflader"]), standardMaterials: JSON.stringify([{name: "Gulvvaskmiddel", qty: 0.5, unit: "L"}]) },
    { companyId: c1.id, name: "Trappevask", description: "Ugentlig trapperens", unitType: "pr_omgang", price: 150, hourlyRate: 150, estimatedHours: 1, estimatedTime: 60, category: "Trappe", active: 1, vatCode: "I25", weekendSurcharge: 50, eveningSurcharge: 25, materialSurcharge: 5, transportSurcharge: 0, standardTasks: JSON.stringify(["Fej trappe", "Vask trappe", "Aftør gelænder", "Vask dørtavler"]), standardMaterials: JSON.stringify([{name: "Universalmiddel", qty: 0.2, unit: "L"}]) },
    { companyId: c1.id, name: "Vinduespudsning", description: "Indvendig og udvendig vinduespudsning", unitType: "pr_omgang", price: 45, hourlyRate: 0, estimatedHours: 0, estimatedTime: 30, category: "Vindue", active: 1, vatCode: "I25", weekendSurcharge: 0, eveningSurcharge: 0, materialSurcharge: 5, transportSurcharge: 0, standardTasks: JSON.stringify(["Vask glas", "Tør vinduer", "Rens rammer"]), standardMaterials: JSON.stringify([{name: "Vinduespuds", qty: 1, unit: "flaske"}]) },
    { companyId: c1.id, name: "Flytterengøring", description: "Fuld rengøring ved fraflytning", unitType: "fast_pris", price: 3500, hourlyRate: 0, estimatedHours: 6, estimatedTime: 360, category: "Special", active: 1, vatCode: "I25", weekendSurcharge: 50, eveningSurcharge: 25, materialSurcharge: 15, transportSurcharge: 5, standardTasks: JSON.stringify(["Dybderengøring af køkken", "Dybderengøring af badeværelse", "Vask alle gulve", "Vask vægge", "Vinduespudsning"]), standardMaterials: JSON.stringify([{name: "Specialrengøring", qty: 2, unit: "L"}, {name: "Svamp", qty: 5, unit: "stk"}]) },
    { companyId: c1.id, name: "Gulvvask", description: "Gulvvask og vedligeholdelse", unitType: "time", price: 400, hourlyRate: 400, estimatedHours: 2, estimatedTime: 120, category: "Gulv", active: 1, vatCode: "I25", weekendSurcharge: 50, eveningSurcharge: 25, materialSurcharge: 10, transportSurcharge: 4.5, standardTasks: JSON.stringify(["Fej gulv", "Vask gulv", "Poler gulv"]), standardMaterials: JSON.stringify([{name: "Gulvvaskmiddel", qty: 1, unit: "L"}, {name: "Moppehoved", qty: 2, unit: "stk"}]) },
    { companyId: c1.id, name: "Tømning af skraldespande", description: "Skraldtømming og sortering", unitType: "pr_omgang", price: 75, hourlyRate: 0, estimatedHours: 0, estimatedTime: 15, category: "Affald", active: 1, vatCode: "I25", weekendSurcharge: 0, eveningSurcharge: 0, materialSurcharge: 0, transportSurcharge: 0, standardTasks: JSON.stringify(["Tøm skraldespande", "Sorter affald", "Rens spande"]), standardMaterials: JSON.stringify([{name: "Affaldssække", qty: 10, unit: "stk"}]) },
  ];
  for (const s of services) {
    db.insert(cleaningServices).values({ ...s, createdAt: nowISO() }).run();
  }

  // RENGØRINGSAFTALER — med fuldt workflow
  db.insert(cleaningAgreements).values({
    companyId: c1.id, customerId: 1, name: "Kontorrenhold Erhvervsbygning Nordhavn",
    status: "aktiv", startDate: "2026-01-01", endDate: "2026-12-31", frequency: "ugentligt",
    monthlyPrice: 8500, serviceIds: JSON.stringify([1, 2, 3, 4]),
    notes: "Fast aftale med 12 måneders løbetid. Inkluderer vinduespudsning 4 gange om året.",
    agreementNumber: "A-0001", contactPerson: "Anne Christensen", contactEmail: "anne@kbherhverv.dk", contactPhone: "+4533123456",
    agreementLines: JSON.stringify([
      {serviceId: 1, name: "Kontorrenhold — timebasis", qty: 20, unit: "timer", price: 350, total: 7000},
      {serviceId: 3, name: "Trappevask", qty: 4, unit: "omgange", price: 150, total: 600},
      {serviceId: 4, name: "Vinduespudsning", qty: 4, unit: "omgange", price: 225, total: 900}
    ]),
    totalSetup: 0, bindingPeriod: 6, noticePeriod: 3, paymentTerms: "30 dage",
    terms: "Aftalen kan opsiges med 3 måneders varsel efter bindingsperiodens udløb. Prisen reguleres årligt i forhold til nettoprisindekset.",
    sentAt: "2025-12-15T10:00:00.000Z", customerApprovedAt: "2025-12-18T14:00:00.000Z",
    customerSignature: "Anne Christensen",
    createdAt: nowISO(),
  }).run();
  db.insert(cleaningAgreements).values({
    companyId: c1.id, customerId: 2, name: "Trappevask Boligforening Frederiksberg",
    status: "sendt", startDate: "2026-02-01", endDate: "2027-01-31", frequency: "hver_14_dag",
    monthlyPrice: 3200, serviceIds: JSON.stringify([3]),
    notes: "Trappegang A, B og C. Ekstra opgaver efter behov.",
    agreementNumber: "A-0002", contactPerson: "Peter Lund", contactEmail: "peter@nordhavnkc.dk", contactPhone: "+4533112233",
    agreementLines: JSON.stringify([
      {serviceId: 3, name: "Trappevask", qty: 2, unit: "omgange/md", price: 1600, total: 3200}
    ]),
    totalSetup: 0, bindingPeriod: 3, noticePeriod: 1, paymentTerms: "14 dage",
    terms: "Aftalen løber i 12 måneder med 1 måneds opsigelsesvarsel.",
    sentAt: todayPlus(-2) + "T09:00:00.000Z",
    createdAt: nowISO(),
  }).run();
  db.insert(cleaningAgreements).values({
    companyId: c1.id, customerId: 3, name: "Flytterengøring Lejligheder",
    status: "kladde", startDate: "2026-03-01", endDate: "2026-09-01", frequency: "manuelt",
    monthlyPrice: 0, serviceIds: JSON.stringify([5, 6]),
    notes: "Efter behov faktureres pr. opgave.",
    agreementNumber: "A-0003", contactPerson: "Birgitte Holm", contactEmail: "birgitte@fbskole.dk", contactPhone: "+4538872211",
    agreementLines: JSON.stringify([
      {serviceId: 5, name: "Flytterengøring", qty: 1, unit: "stk", price: 3500, total: 3500}
    ]),
    totalSetup: 0, bindingPeriod: 0, noticePeriod: 0, paymentTerms: "kontant",
    terms: "Pr. opgave. Ingen binding.",
    createdAt: nowISO(),
  }).run();

  // RENGØRINGSPLANER — med områder og tjeklister
  db.insert(cleaningPlans).values({
    companyId: c1.id, customerId: 1, agreementId: 1, name: "Ugentlig plan Nordhavn",
    area: "Nordre Toldbod 17, 1259 København K", tasks: JSON.stringify([
      {task: "Støvsuge kontorer", freq: "ugentligt", done: false},
      {task: "Tørre gulve", freq: "ugentligt", done: false},
      {task: "Rengøre toiletter", freq: "ugentligt", done: false}
    ]),
    frequency: "ugentligt", active: 1, planNumber: "P-0001", location: "Nordre Toldbod 17, 1259 København K",
    areas: JSON.stringify([
      {name: "Kontor 1. sal", assignedEmployeeId: 1, tasks: [
        {description: "Støvsug gulv", frequency: "ugentligt", estimatedMinutes: 15, materials: ["Støvsugerpose"]},
        {description: "Vask gulv", frequency: "ugentligt", estimatedMinutes: 20, materials: ["Gulvvaskmiddel"]},
        {description: "Tøm skraldespande", frequency: "ugentligt", estimatedMinutes: 5, materials: ["Affaldssække"]},
        {description: "Rengør toiletter", frequency: "ugentligt", estimatedMinutes: 15, materials: ["Universalmiddel"]}
      ]},
      {name: "Kantine", assignedEmployeeId: 2, tasks: [
        {description: "Vask borde", frequency: "dagligt", estimatedMinutes: 10, materials: ["Universalmiddel"]},
        {description: "Vask gulv", frequency: "ugentligt", estimatedMinutes: 15, materials: ["Gulvvaskmiddel"]},
        {description: "Tøm kaffemaskine", frequency: "dagligt", estimatedMinutes: 5, materials: []}
      ]},
      {name: "Trapperum", assignedEmployeeId: 3, tasks: [
        {description: "Fej trappe", frequency: "ugentligt", estimatedMinutes: 10, materials: []},
        {description: "Vask trappe", frequency: "ugentligt", estimatedMinutes: 15, materials: ["Universalmiddel"]},
        {description: "Aftør gelænder", frequency: "ugentligt", estimatedMinutes: 5, materials: ["Universalmiddel"]}
      ]}
    ]),
    scheduleType: "fast", startDate: "2026-01-01", endDate: "2026-12-31", nextScheduledDate: todayPlus(2),
    totalEstimatedMinutes: 115, checklistEnabled: 1,
    createdAt: nowISO(),
  }).run();
  db.insert(cleaningPlans).values({
    companyId: c1.id, customerId: 2, agreementId: 2, name: "Trappeplan Frederiksberg",
    area: "Frederiksberg Allé 25, 1820 Frederiksberg", tasks: JSON.stringify([
      {task: "Vaske trapper", freq: "hver_14_dag", done: false},
      {task: "Vaske gelændere", freq: "hver_14_dag", done: false}
    ]),
    frequency: "hver_14_dag", active: 1, planNumber: "P-0002", location: "Frederiksberg Allé 25, 1820 Frederiksberg",
    areas: JSON.stringify([
      {name: "Opgang A", assignedEmployeeId: 1, tasks: [
        {description: "Fej trappe", frequency: "hver_14_dag", estimatedMinutes: 10, materials: []},
        {description: "Vask trappe", frequency: "hver_14_dag", estimatedMinutes: 15, materials: ["Universalmiddel"]},
        {description: "Aftør gelænder", frequency: "hver_14_dag", estimatedMinutes: 5, materials: ["Universalmiddel"]}
      ]},
      {name: "Opgang B", assignedEmployeeId: 2, tasks: [
        {description: "Fej trappe", frequency: "hver_14_dag", estimatedMinutes: 10, materials: []},
        {description: "Vask trappe", frequency: "hver_14_dag", estimatedMinutes: 15, materials: ["Universalmiddel"]},
        {description: "Aftør gelænder", frequency: "hver_14_dag", estimatedMinutes: 5, materials: ["Universalmiddel"]}
      ]}
    ]),
    scheduleType: "fast", startDate: "2026-02-01", endDate: "2027-01-31", nextScheduledDate: todayPlus(3),
    totalEstimatedMinutes: 60, checklistEnabled: 1,
    createdAt: nowISO(),
  }).run();

  // LEADS
  db.insert(leads).values({
    companyId: c1.id, source: "email",
    customerName: "Marie Christensen", customerEmail: "marie@christensen.dk", customerPhone: "+45 22 33 44 55",
    customerAddress: "Valby Langgade 88, 2500 Valby",
    message: "Hej, vi søger et rengøringsselskab til vores kontor på 350 kvm i Valby. Vi har brug for daglig rengoering samt vinduespudsning en gang om måneden. Hvad koster det?",
    status: "ny", aiAnalysis: null, aiOfferDraft: null, aiReplyDraft: null,
    approvedBy: null, approvedAt: null, sentAt: null, createdAt: todayPlus(-2) + "T08:00:00.000Z",
  }).run();
  db.insert(leads).values({
    companyId: c1.id, source: "google_ads",
    customerName: "Thomas Nielsen", customerEmail: "thomas@nielsen-byg.dk", customerPhone: "+45 33 44 55 66",
    customerAddress: "Industrivej 15, 2600 Glostrup",
    message: "Vi har et industribyggeri med 800 kvm der skal have grundig rengoering for indflytning. Det skal være klart om 14 dage.",
    status: "tilbud_kladde", aiAnalysis: "Kunde søger flytterengøring/større rengoering af 800 kvm industribygning. Tidshorisont: 14 dage. Forventet pris: 8-12.000 kr baseret på kvmpris.",
    aiOfferDraft: JSON.stringify({ title: "Tilbud på rengoering Industribygning", items: [{ name: "Grundrengoering 800 kvm", qty: 800, price: 12, unit: "kvm" }, { name: "Vinduespudsning", qty: 20, price: 150, unit: "stk" }], total: 12600, valid: 14 }),
    aiReplyDraft: "Kære Thomas\n\nMange tak for din henvendelse. Vi har analyseret dit behov og kan tilbyde grundrengøring af jeres industribygning på 800 kvm.\n\nVi kan gennemføre opgaven inden for 14 dage som ønsket.\n\nMed venlig hilsen\nRenser København ApS",
    approvedBy: null, approvedAt: null, sentAt: null, createdAt: todayPlus(-1) + "T10:30:00.000Z",
  }).run();
  db.insert(leads).values({
    companyId: c1.id, source: "facebook",
    customerName: "Sofia Bergstroem", customerEmail: "sofia.berg@gmail.com", customerPhone: "+45 44 55 66 77",
    customerAddress: "Strandvejen 123, 2900 Hellerup",
    message: "Vi er en lejlighedsforening med 12 lejligheder og fælles trappeopgang. Vi søger tilbud på trappevask hver 14. dag.",
    status: "godkendt", aiAnalysis: "Kunde søger trappevask for 12 lejligheder. Forventet pris: 2.000-3.500 kr/md baseret på antal opgange.",
    aiOfferDraft: JSON.stringify({ title: "Tilbud på trappevask", items: [{ name: "Trappevask hver 14. dag", qty: 1, price: 3200, unit: "pr. md" }], total: 3200, valid: 30 }),
    aiReplyDraft: "Kære Sofia\n\nMange tak for jeres henvendelse. Vi kan tilbyde trappevask hver 14. dag for jeres lejlighedsforening.\n\nMed venlig hilsen\nRenser København ApS",
    approvedBy: 1, approvedAt: todayPlus(-1) + "T14:00:00.000Z", sentAt: null,
    createdAt: todayPlus(-3) + "T15:00:00.000Z",
  }).run();
  db.insert(leads).values({
    companyId: c1.id, source: "website",
    customerName: "Henrik Soerensen", customerEmail: "henrik@soerensen.dk", customerPhone: "+45 55 66 77 88",
    customerAddress: "Amagerbrogade 200, 2300 Koebenhavn S",
    message: "Hej, jeg har en mindre klinik på 120 kvm og søger fast rengoering 2 gange om ugen. Hvad er jeres priser?",
    status: "afsendt", aiAnalysis: "Kunde søger fast rengoering af 120 kvm klinik 2x/uge. Forventet pris: 4.000-6.000 kr/md.",
    aiOfferDraft: JSON.stringify({ title: "Tilbud på klinikrengoering", items: [{ name: "Klinikrengoering 2x/uge", qty: 1, price: 5200, unit: "pr. md" }], total: 5200, valid: 30 }),
    aiReplyDraft: "Kære Henrik\n\nTak for din henvendelse. Vi tilbyder fast rengøring af jeres klinik 2 gange om ugen til 5.200 kr/md ekskl. moms.\n\nMed venlig hilsen\nRenser København ApS",
    approvedBy: 1, approvedAt: todayPlus(-2) + "T09:00:00.000Z", sentAt: todayPlus(-1) + "T11:00:00.000Z",
    createdAt: todayPlus(-5) + "T12:00:00.000Z",
  }).run();

  // SUPPORT SAGER
  db.insert(supportCases).values({
    companyId: c2.id, subject: "Problemer med fakturering", message: "Vi kan ikke oprette nye fakturaer systemet viser en fejlmeddelelse ved klik på Opret faktura.",
    status: "aaben", priority: "hoej", reply: null, replyStatus: "kladde", createdBy: "leder2@addsmartregnskab.dk",
    createdAt: todayPlus(-2) + "T09:00:00.000Z", updatedAt: todayPlus(-2) + "T09:00:00.000Z",
  }).run();
  db.insert(supportCases).values({
    companyId: c3.id, subject: "Spoergsmaal om AI-tilaeg", message: "Hvad koster AI-tilaegget og hvad indeholder det? Kan vi proeve det gratis?",
    status: "aaben", priority: "mellem", reply: null, replyStatus: "kladde", createdBy: "leder3@addsmartregnskab.dk",
    createdAt: todayPlus(-1) + "T14:30:00.000Z", updatedAt: todayPlus(-1) + "T14:30:00.000Z",
  }).run();
  db.insert(supportCases).values({
    companyId: c1.id, subject: "Eksport af loen til loensystem", message: "Vi skal bruge loen eksporteret i et format der kan laeses af Danloen. Er det muligt?",
    status: "lukket", priority: "mellem", reply: "Hej, ja vi understoetter eksport til Danloen via CSV format. Du finder det under Tidsregistrering Eksport Vaelg Danloen CSV.",
    replyStatus: "sendt", createdBy: "leder@addsmartregnskab.dk",
    createdAt: todayPlus(-10) + "T10:00:00.000Z", updatedAt: todayPlus(-8) + "T15:00:00.000Z",
  }).run();

  // BACKUPS
  db.insert(backups).values({
    companyId: null, scope: "platform", status: "fuldfort", size: "45 MB",
    summary: JSON.stringify({ tables: 25, rows: 12500 }), createdBy: "platform@addsmartregnskab.dk",
    createdAt: todayPlus(-1) + "T02:00:00.000Z",
  }).run();
  db.insert(backups).values({
    companyId: null, scope: "platform", status: "fuldfort", size: "42 MB",
    summary: JSON.stringify({ tables: 25, rows: 11800 }), createdBy: "platform@addsmartregnskab.dk",
    createdAt: todayPlus(-8) + "T02:00:00.000Z",
  }).run();
  db.insert(backups).values({
    companyId: c1.id, scope: "company", status: "fuldfort", size: "12 MB",
    summary: JSON.stringify({ tables: 15, rows: 2100 }), createdBy: "leder@addsmartregnskab.dk",
    createdAt: todayPlus(-2) + "T03:00:00.000Z",
  }).run();
  db.insert(backups).values({
    companyId: c1.id, scope: "company", status: "fuldfort", size: "11 MB",
    summary: JSON.stringify({ tables: 15, rows: 1950 }), createdBy: "leder@addsmartregnskab.dk",
    createdAt: todayPlus(-9) + "T03:00:00.000Z",
  }).run();

  // ══════════════════════════════════════════════
  //  KOMMUNIKATIONSINTEGRATION + BESKEDER
  // ══════════════════════════════════════════════
  db.insert(communicationIntegrations).values({
    companyId: c1.id, provider: "email", fromEmail: "kontakt@addsmartregnskab.dk",
    fromName: "ADD SmartRegnskab", status: "aktiv", config: "{}",
    createdAt: nowISO(),
  }).run();

  // Outbound message — tilbud sendt til kunde
  db.insert(outboundMessages).values({
    companyId: c1.id, customerId: 2, relatedType: "aftale", relatedId: 2,
    channel: "email", recipientName: "Peter Lund", recipientEmail: "peter@nordhavnkc.dk",
    subject: "Tilbud på trappevask — Frederiksberg",
    body: "Kære Peter\n\nVi fremsender hermed tilbud på trappevask for jeres boligforening.\n\nTilbudet dækker trappevask hver 14. dag i opgang A og B.\n\nMånedlig pris: 3.200 kr ekskl. moms\n\nTilbudet er gældende i 30 dage.\n\nMed venlig hilsen\nADD SmartRegnskab",
    status: "sendt", aiGenerated: 1, approvedBy: 1,
    approvedAt: todayPlus(-2) + "T08:00:00.000Z",
    sentAt: todayPlus(-2) + "T09:00:00.000Z",
    createdAt: todayPlus(-2) + "T09:00:00.000Z",
  }).run();

  // Inbound message — svar fra kunde
  db.insert(inboundMessages).values({
    companyId: c1.id, customerId: 2, relatedType: "aftale", relatedId: 2,
    fromEmail: "peter@nordhavnkc.dk",
    body: "Hej\n\nMange tak for tilbudet. Det ser rigtig fornuftigt ud. Vi vil gerne acceptere tilbuddet.\n\nHvordan går vi videre herfra?\n\nVenlig hilsen\nPeter Lund",
    read: 0, receivedAt: todayPlus(-1) + "T10:00:00.000Z",
  }).run();

  console.log("Databasen er fyldt med demodata (8 virksomheder, 4 pakker, dansk kontoplan, demo posteringer, leads, support sager, skabeloner, rengøringsydelser, kommunikation og hashede kodeord).");
}

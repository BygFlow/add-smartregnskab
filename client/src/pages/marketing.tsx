import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BarChart3, BookOpen, Building2, Check, CheckCircle2, ChevronRight,
  CircleHelp, Cookie, CreditCard, FileCheck2, FileText, Gauge, Landmark, LockKeyhole,
  Mail, MapPin, Menu, Phone, PlayCircle, Receipt, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { SiMastercard, SiVisa } from "react-icons/si";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import type { Plan } from "@shared/schema";
import { POSTING_PRICE_TIERS, estimatedMonthlyDocuments } from "@shared/posting-pricing";
import { DPA_VERSION, LEGAL_UPDATED_AT, dpaSections, retentionSchedule, retentionSections, subprocessors } from "@shared/legal-documents";

type MarketingPage = "home" | "features" | "pricing" | "integrations" | "security" | "faq" | "about" | "contact" | "demo" | "help" | "guides" | "guide" | "privacy" | "terms" | "payment" | "cookies" | "dpa" | "subprocessors" | "retention" | "landing";

const nav = [
  ["Funktioner", "/funktioner"], ["Priser", "/priser"], ["Integrationer", "/integrationer"],
  ["Sikkerhed", "/sikkerhed"], ["Hjælp", "/hjaelp"],
] as const;

const features = [
  { icon: Receipt, title: "Bilag og udgifter", text: "Saml bilag, kontrollér moms og bogfør med et tydeligt godkendelsesflow." },
  { icon: FileText, title: "Fakturering", text: "Opret fakturaer og kreditnotaer, følg betalinger og håndtér rykkere." },
  { icon: Landmark, title: "Bankafstemning", text: "Importér bankposter og afstem dem mod bogføringen i én arbejdsgang." },
  { icon: BarChart3, title: "Rapporter og overblik", text: "Se resultat, balance, likviditet, moms og udvikling med tal fra dit regnskab." },
  { icon: Sparkles, title: "AI med godkendelse", text: "Få forklarlige forslag. Du godkender altid kritisk bogføring, betaling, moms og skat." },
  { icon: Users, title: "Bogholder og revisor", text: "Invitér fagpersoner med afgrænset, logget og tidsstyret adgang." },
];

const integrations = [
  ["AiiA / Open Banking", "Automatisk bankdata, når virksomhedens bankaftale er tilsluttet", "Kræver aftale"],
  ["NemHandel / Peppol", "Elektroniske fakturaer via én Sproom ISV Parent-aftale med unikke CVR-profiler som child-companies. Både afsendelse og modtagelse tæller som dokumenter.", "Afventer underskrevet ISV-aftale"],
  ["REST API og webhooks", "Sikker integration med afgrænsede API-nøgler, hændelser og revisionsspor", "Til udviklere"],
] as const;

const migrationSources = [
  ["Import fra e-conomic", "Flyt kontoplan, stamdata, saldi og regnskabshistorik til ADD SmartRegnskab. Kunden godkender altid importen.", "Aktiv"],
  ["Import fra Dinero", "Flyt data fra en kontrolleret eksport med forhåndsvisning, validering og mulighed for rollback.", "Aktiv"],
  ["Import fra Billy", "Flyt data fra en kontrolleret eksport uden at gøre Billy til en nødvendig del af den fremtidige bogføring.", "Aktiv"],
  ["Excel- og CSV-import", "Importér kontoplan, bankposter og andre godkendte datafiler fra eksisterende systemer.", "Aktiv"],
] as const;

const guides = {
  "bedre-oekonomioverblik": {
    title: "Sådan får små virksomheder bedre økonomioverblik",
    intro: "Et godt økonomioverblik begynder med faste rutiner og afstemte data — ikke med flere regneark.",
    sections: [
      ["Saml grundlaget", "Få bilag, fakturaer og bankposter ind samme sted, og undersøg mangler løbende."],
      ["Følg få nøgletal", "Se omsætning, udgifter, resultat, likviditet og ubetalte fakturaer i den samme valgte periode."],
      ["Afstem før du beslutter", "Rapporter er mest værdifulde, når bank, debitorer, kreditorer og moms er kontrolleret."],
    ],
  },
  "guide-bilag-bogfoering": {
    title: "Guide til bilag og bogføring",
    intro: "Et ensartet bilagsflow gør bogføringen hurtigere at kontrollere og lettere at dokumentere.",
    sections: [
      ["1. Modtag og kontrollér", "Kontrollér leverandør, dato, beløb, valuta og om dokumentet er læsbart."],
      ["2. Moms og kontering", "Vurder momsbehandling og vælg konto ud fra den konkrete udgift og virksomhedens kontoplan."],
      ["3. Godkend og arkivér", "Bogfør først efter kontrol, og bevar bilag og revisionsspor efter gældende krav."],
    ],
  },
  "professionelle-fakturaer": {
    title: "Sådan laver du professionelle fakturaer",
    intro: "En tydelig faktura mindsker spørgsmål og gør betalingen lettere at matche.",
    sections: [
      ["Afsender og kunde", "Kontrollér virksomhedsnavn, CVR, adresse og kundens korrekte faktureringsoplysninger."],
      ["Ydelse og beløb", "Beskriv ydelsen præcist, angiv dato, antal, pris, moms og samlet beløb."],
      ["Betaling og levering", "Angiv betalingsfrist og betalingsoplysninger, og kontrollér leveringsstatus efter afsendelse."],
    ],
  },
  "fem-administrative-opgaver": {
    title: "5 administrative opgaver du kan gøre enklere",
    intro: "Små faste arbejdsgange kan reducere den tid, der forsvinder på gentagelser og eftersøgning.",
    sections: [
      ["1–2. Bilag og fakturaer", "Brug en fast bilagsindbakke, og genbrug sikre fakturakladder til gentagne ydelser."],
      ["3–4. Bank og opfølgning", "Afstem bankposter løbende, og arbejd fra en samlet liste over ubetalte fakturaer."],
      ["5. Månedsafslutning", "Brug den samme checkliste hver måned, og dokumentér hvem der kontrollerede hvad."],
    ],
  },
  "regnskabsworkflow-mindre-virksomheder": {
    title: "Regnskabsworkflow for mindre virksomheder",
    intro: "Et enkelt uge- og månedsflow giver bedre kontrol uden at gøre regnskabet til et heldagsprojekt.",
    sections: [
      ["Hver uge", "Indlæs bilag og bankposter, send fakturaer og følg op på forfaldne betalinger."],
      ["Hver måned", "Afstem bank, debitorer, kreditorer og moms, og gennemgå resultat og likviditet."],
      ["Ved periodens afslutning", "Undersøg differencer, lås først efter godkendelse, og gem dokumentation til revisor."],
    ],
  },
} as const;

const leadMagnets = [
  ["Fakturacheckliste", "Afsender, kunde, dato, nummer, ydelse, moms, frist, betalingsoplysninger og slutkontrol."],
  ["Månedlig økonomicheckliste", "Bankafstemning, manglende bilag, debitorer, kreditorer, moms, periodisering og backupstatus."],
  ["Bilagscheckliste", "Læsbar fil, leverandør, dato, beløb, moms, konto, godkendelse og arkivering."],
] as const;

const faqs = [
  ["Kan jeg prøve uden betalingskort?", "Ja. Oprettelsen starter med 14 dages prøveperiode uden betalingskort."],
  ["Er AI'en autoriseret til at bogføre alt automatisk?", "Nej. AI giver forslag og udfører kun sikre, reversible rutiner. Betaling, moms, skat, løn og væsentlige posteringer kræver menneskelig godkendelse."],
  ["Kan min bogholder eller revisor få adgang?", "Ja. Fagpersoner inviteres til en særskilt portal med rollebaseret adgang, tofaktorgodkendelse og handlingslog."],
  ["Hvordan opbevares bilag?", "Bilag knyttes til virksomheden, adgang kontrolleres pr. rolle, og løsningen understøtter ekstern backup og dokumenteret gendannelse."],
  ["Kan jeg skifte pakke?", "Ja. En leder kan se forbrug og skifte pakke under Abonnement & betaling. Systemet advarer, hvis en lavere pakke ikke kan rumme det aktuelle forbrug."],
  ["Er der binding?", "Pakke- og betalingsvilkår vises før bestilling. Årsbetaling svarer til ti måneders pris og giver dermed to måneder inkluderet."],
] as const;

const helpArticles = [
  ["Kom i gang", "Udfyld virksomhedsoplysninger, vælg kontoplan, kontrollér momsopsætningen og følg driftsklarhedstrinnene."],
  ["Virksomhedsopsætning", "Kontrollér navn, CVR, adresse, kontaktmail, regnskabsperiode og fakturaoplysninger før første bogføring."],
  ["Upload bilag", "Åbn Bilagsindbakke, vælg upload, kontrollér fil og beløb, og gem bilaget til behandling."],
  ["Bogfør bilag", "Kontrollér dato, beløb, moms og konti. Debet og kredit skal balancere, før posteringen godkendes."],
  ["Opret kunde", "Gå til Kunder, vælg ny kunde, udfyld kontakt- og betalingsoplysninger og gem."],
  ["Opret faktura", "Vælg kunde, tilføj linjer, kontrollér moms og betalingsfrist, gem som kladde og send først efter kontrol."],
  ["Registrer betaling", "Åbn fakturaen eller bankafstemningen, match betalingen og kontrollér dato og beløb."],
  ["Bankafstemning", "Importér eller hent bankposter, match eksisterende posteringer og undersøg differencer, før perioden afsluttes."],
  ["Moms", "Afslut periodens bogføring, kør momsafstemning, undersøg differencer og få en ansvarlig til at godkende."],
  ["Rapporter", "Vælg periode og rapporttype. Kontrollér datagrundlaget, og eksportér kun den endelige, afstemte rapport."],
  ["Integrationer", "Vælg udbyder, indtast kun nøgler i den beskyttede opsætning, test forbindelsen og kontrollér første synkronisering."],
  ["Brugere og roller", "Giv mindst mulig nødvendig adgang. Bogholder og revisor skal bruge tofaktorgodkendelse."],
  ["Abonnement", "Se pakke, forbrug, fakturaer og betalingsaftale under Abonnement & betaling."],
  ["Glemt adgangskode", "Vælg Glemt adgangskode på login. Linket er tidsbegrænset og kan kun bruges én gang."],
] as const;

const landingCopy: Record<string, { eyebrow: string; title: string; lead: string; bullets: string[] }> = {
  "regnskabsprogram-smaa-virksomheder": { eyebrow: "Regnskabsprogram til små virksomheder", title: "Få økonomien samlet uden at gøre hverdagen tung", lead: "Bogføring, fakturaer, bank, moms og rapporter i et enkelt dansk workflow.", bullets: ["Overblik over resultat og likviditet", "Bilag og fakturaer samlet", "Bogholder- og revisoradgang"] },
  "fakturaprogram-virksomheder": { eyebrow: "Fakturaprogram til virksomheder", title: "Fra kladde til betaling med fuldt overblik", lead: "Opret professionelle fakturaer, følg status og registrér betalinger samme sted.", bullets: ["Fakturaer og kreditnotaer", "Betalingsfrister og rykkerflow", "OIOUBL og NemHandel ved tilslutning"] },
  "bilag-og-bogfoering": { eyebrow: "Bilag og bogføring", title: "Et roligt bilagsflow med kontrol før bogføring", lead: "Upload, kontrollér, konter og godkend uden at miste dokumentationen.", bullets: ["Bilagsindbakke", "Moms- og kontokontrol", "Revisionsspor"] },
  "oekonomioverblik": { eyebrow: "Økonomioverblik", title: "Forstå tallene, før du træffer beslutningen", lead: "Se omsætning, udgifter, resultat, ubetalte fakturaer og momsstatus fra faktiske regnskabsdata.", bullets: ["Tydelige nøgletal", "Rapporter og budget", "Likviditetsblik"] },
  "regnskab-haandvaerkere": { eyebrow: "Regnskab til håndværkere", title: "Mindre administration efter dagens opgaver", lead: "Gem bilag, send fakturaer og følg betalinger fra computer eller mobil.", bullets: ["Mobil bilagsupload", "Enkel fakturering", "Adgang til bogholder"] },
  "regnskab-servicevirksomheder": { eyebrow: "Regnskab til servicevirksomheder", title: "Et regnskabsflow der følger virksomhedens vækst", lead: "Automatisér gentagelser, bevar kontrollen og del de rigtige data med din rådgiver.", bullets: ["Faste fakturaer", "Debitoroverblik", "Integrationer og rapporter"] },
};

function money(value: number) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(value);
}

function limit(value: number) { return value < 0 ? "Ubegrænset" : new Intl.NumberFormat("da-DK").format(value); }

const planAudience: Record<string, string> = {
  start: "Til den lille virksomhed med enkel bogføring",
  virksomhed: "Til virksomheden med mere bank, fakturering og automatisering",
  drift: "Til virksomheden med mere bank, fakturering og automatisering",
  professionel: "Til vækstvirksomheder og koncerner med flere selskaber",
  enterprise: "Til større organisationer med avancerede krav",
};

function aiSummary(plan: Plan) {
  if (plan.includedAiCredits > 0) return `${limit(plan.includedAiCredits)} AI-handlinger inkluderet pr. måned`;
  if (plan.aiAddonCredits > 0) return `AI kan tilkøbes: ${limit(plan.aiAddonCredits)} handlinger for ${money(plan.aiAddonPrice)}/md.`;
  return "AI er ikke inkluderet";
}

const CONSENT_KEY = "add_cookie_consent";

function analyticsAllowed() {
  return localStorage.getItem(CONSENT_KEY) === "analytics";
}

function installAnalytics() {
  if (!analyticsAllowed()) return;
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
  if (!measurementId || document.querySelector("script[data-add-analytics]")) return;
  const target = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  target.dataLayer = target.dataLayer || [];
  target.gtag = (...args: unknown[]) => target.dataLayer?.push(args);
  target.gtag("js", new Date());
  target.gtag("config", measurementId, { anonymize_ip: true, send_page_view: false });
  const script = document.createElement("script");
  script.async = true;
  script.dataset.addAnalytics = "true";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

function useSeo(title: string, description: string, path = "") {
  useEffect(() => {
    document.title = `${title} | ADD SmartRegnskab`;
    const setMeta = (selector: string, attr: string, value: string) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!element) {
        element = document.createElement(attr === "rel" ? "link" : "meta");
        if (attr === "name") (element as HTMLMetaElement).name = selector.match(/\[name="(.+)"\]/)?.[1] ?? "";
        if (attr === "property") (element as HTMLMetaElement).setAttribute("property", selector.match(/\[property="(.+)"\]/)?.[1] ?? "");
        if (attr === "rel") (element as HTMLLinkElement).rel = "canonical";
        document.head.appendChild(element);
      }
      if (attr === "rel") (element as HTMLLinkElement).href = value; else (element as HTMLMetaElement).content = value;
    };
    setMeta('meta[name="description"]', "name", description);
    setMeta('meta[property="og:title"]', "property", title);
    setMeta('meta[property="og:description"]', "property", description);
    setMeta('meta[property="og:type"]', "property", "website");
    setMeta('meta[property="og:url"]', "property", `https://app.addsmartregnskab.dk/${path}`);
    setMeta('link[rel="canonical"]', "rel", `https://app.addsmartregnskab.dk/${path}`);
  }, [description, path, title]);
}

function track(event: string, data: Record<string, string> = {}) {
  window.dispatchEvent(new CustomEvent("add:analytics", { detail: { event, ...data } }));
  if (!analyticsAllowed()) return;
  installAnalytics();
  const target = window as typeof window & { gtag?: (...args: unknown[]) => void };
  target.gtag?.("event", event, data);
}

function Header() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
      <Link href="/" className="flex items-center gap-3" aria-label="ADD SmartRegnskab forside"><Logo className="h-9 w-9 text-emerald-800" /><div><div className="text-sm font-bold text-emerald-950">ADD SmartRegnskab</div><div className="text-[9px] font-semibold tracking-[0.18em] text-emerald-800/60">TIL DIN VIRKSOMHED</div></div></Link>
      <nav className="hidden items-center gap-6 lg:flex">{nav.map(([label, href]) => <Link key={href} href={href} className="text-sm font-medium text-slate-600 hover:text-emerald-800">{label}</Link>)}</nav>
      <div className="hidden items-center gap-2 sm:flex"><Button asChild variant="ghost"><Link href="/login">Log ind</Link></Button><Button asChild className="bg-emerald-800 hover:bg-emerald-900"><Link href="/tilmeld" onClick={() => track("signup_start")}>Prøv gratis</Link></Button></div>
      <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Åbn menu">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav className="border-t bg-white px-4 py-4 lg:hidden">{nav.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-emerald-50">{label}</Link>)}<div className="mt-3 grid grid-cols-2 gap-2"><Button asChild variant="outline"><Link href="/login">Log ind</Link></Button><Button asChild><Link href="/tilmeld">Prøv gratis</Link></Button></div></nav>}
  </header>;
}

function Footer() {
  return <footer className="bg-emerald-950 text-emerald-50"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
    <div className="md:col-span-1"><div className="flex items-center gap-3"><Logo className="h-9 w-9 text-emerald-300" /><div className="font-semibold">ADD SmartRegnskab</div></div><p className="mt-4 text-sm leading-6 text-emerald-100/70">Mere tid til det, der skaber værdi.</p></div>
    <div><p className="text-sm font-semibold">Produkt</p><div className="mt-3 space-y-2 text-sm text-emerald-100/70"><Link className="block" href="/funktioner">Funktioner</Link><Link className="block" href="/priser">Priser</Link><Link className="block" href="/integrationer">Integrationer</Link><Link className="block" href="/sikkerhed">Sikkerhed</Link></div></div>
    <div><p className="text-sm font-semibold">Hjælp</p><div className="mt-3 space-y-2 text-sm text-emerald-100/70"><Link className="block" href="/hjaelp">Hjælpecenter</Link><Link className="block" href="/guides">Guides og checklister</Link><Link className="block" href="/faq">FAQ</Link><Link className="block" href="/kontakt">Kontakt</Link><Link className="block" href="/book-demo">Book demo</Link></div></div>
    <div><p className="text-sm font-semibold">Virksomhed</p><div className="mt-3 space-y-2 text-sm text-emerald-100/70"><Link className="block" href="/om">Om produktet</Link><Link className="block" href="/privatliv">Privatliv</Link><Link className="block" href="/databehandleraftale">Databehandleraftale</Link><Link className="block" href="/underdatabehandlere">Underdatabehandlere</Link><Link className="block" href="/dataopbevaring-og-sletning">Dataopbevaring og sletning</Link><Link className="block" href="/vilkaar">Vilkår</Link><Link className="block" href="/betaling-og-refusion">Betaling og refusion</Link><Link className="block" href="/cookies">Cookies</Link></div></div>
  </div><div className="border-t border-white/10 px-4 py-5 text-center text-xs text-emerald-100/55">© {new Date().getFullYear()} ADD SmartDrift ApS · CVR 46761898 · Lynæs Søpark 49, 3390 Hundested</div></footer>;
}

function CookieConsent() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY));
  if (!visible) return null;
  const choose = (value: "necessary" | "analytics") => { localStorage.setItem(CONSENT_KEY, value); setVisible(false); window.dispatchEvent(new CustomEvent("add:consent", { detail: value })); if (value === "analytics") installAnalytics(); };
  return <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border bg-white p-4 shadow-2xl sm:p-5" aria-label="Cookievalg"><div className="flex gap-3"><Cookie className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="font-semibold">Dit valg om cookies</p><p className="mt-1 text-sm text-slate-600">Nødvendige cookies bruges til sikker login og drift. Analyse aktiveres kun med dit valg.</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => choose("necessary")}>Kun nødvendige</Button><Button size="sm" onClick={() => choose("analytics")}>Tillad analyse</Button><Button asChild size="sm" variant="ghost"><Link href="/cookies">Læs mere</Link></Button></div></div></div></aside>;
}

function Layout({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#f7faf8] text-slate-950"><Header />{children}<Footer /><CookieConsent /></div>; }

function Hero({ eyebrow = "Dansk regnskab, gjort forståeligt", title = "Mere tid til det, der skaber værdi", lead = "Saml bogføring, bilag, fakturaer, bankafstemning, moms og rapporter i én sikker arbejdsflade." }) {
  return <section className="overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#163e35] text-white"><div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:py-28"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-emerald-300">{eyebrow}</p><h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">{title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50/75">{lead}</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg" className="bg-white text-emerald-950 hover:bg-emerald-50"><Link href="/tilmeld" onClick={() => track("signup_start")}>Prøv gratis i 14 dage <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/book-demo" onClick={() => track("click_demo")}>Book en demo</Link></Button></div><p className="mt-4 text-xs text-emerald-100/60">Ingen betalingskort ved oprettelse · Dansk support · Rollebaseret adgang</p></div><div className="rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur"><div className="rounded-2xl bg-white p-5 text-slate-900"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Økonomioverblik</p><p className="mt-1 font-semibold">Din virksomhed</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Opdateret nu</span></div><div className="mt-5 grid grid-cols-2 gap-3">{[["Omsætning", "128.400 kr."], ["Resultat", "42.850 kr."], ["Ubetalte fakturaer", "18.200 kr."], ["Bilag til kontrol", "7"]].map(([a,b]) => <div key={a} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{a}</p><p className="mt-2 text-lg font-semibold tabular-nums">{b}</p></div>)}</div><div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Næste handling: Kontrollér 7 bilag før bogføring.</div></div></div></div></section>;
}

function Home() {
  useSeo("Dansk regnskabsprogram", "Bogføring, fakturering, bankafstemning, moms og rapporter i én sikker dansk regnskabsplatform.");
  return <Layout>
    <Hero title="Regnskabet samlet – med kontrol over hver vigtig handling" lead="Bilag, bogføring, fakturaer, bankafstemning, moms og rapporter i én løsning til danske virksomheder, koncerner, bogholdere og revisorer." />
    <section className="border-b bg-white"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><div className="grid gap-5 md:grid-cols-3">{[
      ["1. Saml", "Bilag, fakturaer og bankposter kommer ind i samme arbejdsgang."],
      ["2. Kontrollér", "Systemet finder mangler og foreslår næste handling med dokumentation."],
      ["3. Godkend", "Mennesket godkender kritisk bogføring, betaling, moms og skat."],
    ].map(([title, text]) => <div key={title} className="rounded-xl bg-slate-50 p-5"><p className="font-semibold text-emerald-900">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="max-w-2xl"><p className="text-sm font-semibold text-emerald-700">ÉN SAMLET ARBEJDSFLADE</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Færre løse ender i økonomien</h2><p className="mt-4 text-slate-600">Funktionerne hænger sammen, så næste handling er tydelig, og kritiske beslutninger forbliver under menneskelig kontrol.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map(({icon: Icon,title,text}) => <article key={title} className="rounded-2xl border bg-white p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></section>
    <section className="bg-white"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2"><div><p className="text-sm font-semibold text-emerald-700">KONTROL FØR AUTOMATIK</p><h2 className="mt-3 text-3xl font-semibold">AI hjælper. Du godkender.</h2><p className="mt-4 leading-7 text-slate-600">AI bliver et tilkøb i Start og Drift og er inkluderet i Professionel og Enterprise. Handlinger med økonomisk eller juridisk betydning kræver godkendelse og registreres i revisionssporet.</p><Button asChild variant="outline" className="mt-6"><Link href="/priser">Se pakker og AI-priser</Link></Button></div><div className="space-y-3">{["Forklarlige bogføringsforslag", "Ingen automatisk indsendelse af moms eller skat", "Ingen betaling uden godkendelse", "Log over forslag, ændringer og godkendelser"].map(x => <div key={x} className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />{x}</div>)}</div></div></section>
    <Callout />
  </Layout>;
}

function Callout() { return <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="rounded-3xl bg-emerald-900 px-6 py-12 text-center text-white sm:px-12"><h2 className="text-3xl font-semibold">Klar til et enklere regnskabsflow?</h2><p className="mx-auto mt-3 max-w-2xl text-emerald-100/75">Start uden betalingskort, eller book en gennemgang af løsningen.</p><div className="mt-7 flex justify-center gap-3"><Button asChild className="bg-white text-emerald-950 hover:bg-emerald-50"><Link href="/tilmeld">Prøv gratis</Link></Button><Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white"><Link href="/book-demo">Book demo</Link></Button></div></div></section>; }

function Features() { useSeo("Funktioner", "Se funktionerne i ADD SmartRegnskab: bilag, bogføring, fakturaer, bank, moms, rapporter og sikker fagadgang.", "funktioner"); return <Layout><Hero eyebrow="Funktioner" title="Regnskabsarbejde med en tydelig næste handling" lead="Fra første bilag til rapportering og årsafslutning — med kontrol, forklaringer og rollebaseret adgang." /><section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-5 md:grid-cols-2">{features.concat([{icon: CreditCard,title:"Betaling og abonnement",text:"QuickPay-betalingsaftale, fakturaoversigt og selvbetjent pakkeskift."},{icon: FileCheck2,title:"Revision og afslutning",text:"Kontrolspor, afstemninger, periodeafslutning, SAF-T og dokumenteret godkendelse."}]).map(({icon:Icon,title,text})=><article key={title} className="flex gap-4 rounded-2xl border bg-white p-6"><Icon className="h-6 w-6 shrink-0 text-emerald-700"/><div><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div></article>)}</div></section><Callout/></Layout>; }

function Pricing() {
  useSeo("Priser", "Vælg ADD SmartRegnskab-pakke efter bilag, posteringer, virksomheder og AI-behov. Integrationer og brugere er ubegrænsede.", "priser");
  const { data = [], isLoading, isError } = useQuery<Plan[]>({ queryKey: ["/api/plans"], queryFn: async () => (await apiRequest("GET", "/api/plans")).json() });
  useEffect(() => track("view_pricing"), []);
  return <Layout>
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:py-20">
        <p className="text-sm font-semibold text-emerald-700">PAKKER OG PRISER</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Start med ét CVR – udvid når virksomheden vokser</h1>
        <p className="mx-auto mt-4 max-w-3xl leading-7 text-slate-600">Grundprisen gælder én kundeorganisation. Hvert juridisk selskab har sit eget regnskab. SE-numre oprettes som enheder under selskabet og koster ikke ekstra.</p>
        <div className="mx-auto mt-7 grid max-w-4xl gap-3 text-left text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 p-4"><strong>Priser</strong><span className="mt-1 block text-slate-600">Pr. måned ekskl. moms</span></div>
          <div className="rounded-xl bg-emerald-50 p-4"><strong>Årsbetaling</strong><span className="mt-1 block text-slate-600">Betal for 10 måneder</span></div>
          <div className="rounded-xl bg-emerald-50 p-4"><strong>Prøveperiode</strong><span className="mt-1 block text-slate-600">14 dage uden betalingskort</span></div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      {isLoading ? <p className="rounded-2xl border bg-white p-8 text-center text-slate-600">Henter pakker…</p> : isError ? <p className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800">Pakkerne kunne ikke hentes. Prøv igen om lidt.</p> : <div className="grid gap-5 text-left md:grid-cols-2 xl:grid-cols-4">{data.map((plan) => {
        const recommended = plan.slug === "virksomhed" || plan.slug === "drift";
        return <article key={plan.id} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${recommended ? "ring-2 ring-emerald-700" : ""}`}>
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{plan.name}</h2><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{planAudience[plan.slug] ?? plan.description}</p></div>{recommended && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">POPULÆR</span>}</div>
          <p className="mt-5 text-3xl font-semibold">{money(plan.monthlyPrice)}<span className="text-sm font-normal text-slate-500"> /md.</span></p>
          <p className="mt-1 text-xs text-slate-500">{money(plan.monthlyPrice * 10)} ved årsbetaling</p>
          <div className="my-5 h-px bg-slate-100" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Det får du</p>
          <ul className="mt-3 flex-1 space-y-3 text-sm">
            {["Ubegrænset bilagsopbevaring", "1.000 posteringer pr. regnskabsår inkluderet", "Ubegrænsede integrationer", `${plan.includedCompanies || 1} juridisk CVR inkluderet`, "Ubegrænsede brugere, kunder og leverandører"].map((item) => <li className="flex gap-2" key={item}><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span>{item}</span></li>)}
          </ul>
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"><Sparkles className="mr-1 inline h-4 w-4" /><strong>AI:</strong> {aiSummary(plan)}</div>
          {plan.additionalCompanyPrice > 0 && <p className="mt-3 text-xs leading-5 text-slate-600"><strong>Flere selskaber:</strong> +{money(plan.additionalCompanyPrice)} pr. ekstra CVR. Hvert ekstra CVR giver {limit(plan.aiCreditsPerAdditionalCompany)} ekstra AI-handlinger.</p>}
          <Button asChild className="mt-6 w-full" variant={recommended ? "default" : "outline"}><Link href={`/tilmeld?pakke=${encodeURIComponent(plan.slug)}`}>Prøv {plan.name} gratis</Link></Button>
        </article>;
      })}</div>}
      <div className="mt-10 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-6"><h2 className="text-xl font-semibold">Pris efter årlige posteringer</h2><p className="mt-2 text-sm leading-6 text-slate-600">Alle pakker inkluderer 1.000 posteringer pr. regnskabsår. Når forbruget passerer et trin, opgraderes posteringstillægget automatisk. Du får besked og kan følge forbruget i programmet.</p></div>
        <div className="divide-y sm:hidden">{POSTING_PRICE_TIERS.map((tier) => <div className="grid grid-cols-[1fr_auto] gap-2 px-6 py-4 text-sm" key={tier.annualLimit}><div><strong>Op til {limit(tier.annualLimit)} posteringer</strong><span className="mt-1 block text-xs text-slate-500">ca. {limit(estimatedMonthlyDocuments(tier.annualLimit))} bilag pr. måned</span></div><strong className="text-right text-emerald-800">{tier.monthlySurcharge === 0 ? "Inkluderet" : `+${money(tier.monthlySurcharge)}/md.`}</strong></div>)}</div>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-6 py-3 font-medium">Posteringer pr. regnskabsår</th><th className="px-6 py-3 font-medium">Ca. bilag pr. måned</th><th className="px-6 py-3 font-medium">Tillæg pr. måned</th></tr></thead><tbody className="divide-y">{POSTING_PRICE_TIERS.map((tier) => <tr key={tier.annualLimit}><td className="px-6 py-3 font-medium">Op til {limit(tier.annualLimit)}</td><td className="px-6 py-3 text-slate-600">ca. {limit(estimatedMonthlyDocuments(tier.annualLimit))}</td><td className="px-6 py-3">{tier.monthlySurcharge === 0 ? "Inkluderet" : `+${money(tier.monthlySurcharge)}`}</td></tr>)}</tbody></table></div>
        <p className="border-t bg-slate-50 px-6 py-4 text-xs leading-5 text-slate-600">Et bilag giver typisk flere posteringer. Over 100.000 posteringer pr. regnskabsår aftales en individuel pris. Alle priser er ekskl. moms.</p>
      </div>
    </section>

    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="text-sm font-semibold text-emerald-700">SÅDAN BEREGNES PRISEN</p><h2 className="mt-3 text-3xl font-semibold">Ingen skjulte selskabspriser</h2><p className="mt-4 leading-7 text-slate-600">Et CVR er et selvstændigt juridisk regnskab. Et SE-nummer er en driftsenhed under et CVR og udløser derfor ikke et ekstra abonnement.</p></div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border p-5"><div className="flex items-center justify-between gap-4"><strong>Én almindelig virksomhed</strong><span className="font-semibold">Pakkens grundpris</span></div><p className="mt-2 text-slate-600">Ét CVR og eventuelle SE-numre.</p></div>
            <div className="rounded-xl border p-5"><div className="flex items-center justify-between gap-4"><strong>Koncern med 3 CVR på Professionel</strong><span className="font-semibold">1.547 kr./md.</span></div><p className="mt-2 text-slate-600">549 kr. + 2 × 499 kr. · 6.000 AI-handlinger · SE-numre inkluderet.</p></div>
            <div className="rounded-xl border p-5"><div className="flex items-center justify-between gap-4"><strong>Start eller Drift med AI</strong><span className="font-semibold">Valgfrit tilkøb</span></div><p className="mt-2 text-slate-600">AI lægges kun til abonnementet, hvis virksomhedens administrator vælger det.</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6"><h2 className="text-center text-3xl font-semibold">Hvad betyder ordene?</h2><div className="mt-8 grid gap-4 md:grid-cols-3"><article className="rounded-2xl border bg-white p-6"><Building2 className="h-5 w-5 text-emerald-700"/><h3 className="mt-3 font-semibold">Juridisk CVR</h3><p className="mt-2 text-sm leading-6 text-slate-600">Et selvstændigt selskab med separat bogføring, moms og årsafslutning.</p></article><article className="rounded-2xl border bg-white p-6"><Gauge className="h-5 w-5 text-emerald-700"/><h3 className="mt-3 font-semibold">SE-nummer</h3><p className="mt-2 text-sm leading-6 text-slate-600">En enhed under et CVR. Den kan bruges som dimension og koster ikke ekstra.</p></article><article className="rounded-2xl border bg-white p-6"><Sparkles className="h-5 w-5 text-emerald-700"/><h3 className="mt-3 font-semibold">AI-handling</h3><p className="mt-2 text-sm leading-6 text-slate-600">Én målt AI-opgave. Kritisk bogføring, betaling, moms og skat kræver fortsat godkendelse.</p></article></div></section>
    <section className="border-y bg-white"><div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-10 text-center sm:px-6"><div><h2 className="text-xl font-semibold">Sikker abonnementsbetaling</h2><p className="mt-2 text-sm leading-6 text-slate-600">Kortbetaling gennemføres hos QuickPay med indløsning via Clearhaus. ADD SmartRegnskab gemmer ikke kortnummer eller kontrolcifre.</p></div><div className="flex items-center gap-5" aria-label="Betalingskort"><SiVisa className="h-8 w-16 text-[#1434CB]" title="Visa"/><SiMastercard className="h-9 w-14 text-[#EB001B]" title="Mastercard"/></div><p className="text-xs text-slate-500">Læs <Link className="font-medium text-emerald-800 underline" href="/betaling-og-refusion">betalings-, opsigelses- og refusionsvilkårene</Link>.</p></div></section>
    <Callout />
  </Layout>;
}

function Integrations() { useSeo("Integrationer", "Forbind ADD SmartRegnskab med bankdata, e-fakturering og sikre API'er, eller flyt data fra dit nuværende regnskabssystem.", "integrationer"); return <Layout><Hero eyebrow="Integrationer og dataflytning" title="Forbind økonomiflowet og flyt dine eksisterende data" lead="Løbende forbindelser og engangsimport vises hver for sig, så andre regnskabssystemer aldrig bliver et krav for at bruge ADD SmartRegnskab."/><section className="mx-auto max-w-5xl px-4 py-20 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Løbende forbindelser</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Integrationer til dit daglige regnskabsarbejde</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{integrations.map(([name,text,status])=><article key={name} className="rounded-2xl border bg-white p-6"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{name}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium">{status}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></div><div className="mt-14"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Flyt fra et andet system</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Import og migrering</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Disse løsninger bruges til at flytte data ind i ADD SmartRegnskab. Du behøver ikke fortsætte med at abonnere på det tidligere regnskabssystem.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{migrationSources.map(([name,text,status])=><article key={name} className="rounded-2xl border bg-white p-6"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{name}</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">{status}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></div><p className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">Systemmail, abonnementbetaling og ekstern backup er interne driftsydelser. De overvåges af ADD SmartRegnskab og er derfor ikke integrationer, som kunden skal opsætte.</p></section></Layout>; }

function Security() { useSeo("Sikkerhed", "Læs om adgangskontrol, kryptering, backup, revisionsspor og databeskyttelse i ADD SmartRegnskab.", "sikkerhed"); const cards=[[LockKeyhole,"Adgang","Sikre sessioner, rollebaserede rettigheder, loginbegrænsning og tofaktorgodkendelse for fagbrugere."],[ShieldCheck,"Kontrolspor","Væsentlige handlinger, godkendelser og ændringer registreres med bruger og tidspunkt."],[FileCheck2,"Data og filer","Virksomhedsadskillelse, kontrollerede uploads, krypteret transport og beskyttet fillagring."],[Gauge,"Drift og backup","Sundhedskontrol, ekstern backup, checksums og dokumenteret restore-øvelse."]]; return <Layout><Hero eyebrow="Sikkerhed" title="Regnskabsdata kræver mere end et stærkt password" lead="ADD SmartRegnskab er bygget med lagdelt adgangskontrol, sikker konfiguration og sporbarhed."/><section className="mx-auto max-w-5xl px-4 py-20 sm:px-6"><div className="grid gap-5 sm:grid-cols-2">{cards.map(([Icon,title,text])=><article className="rounded-2xl border bg-white p-6" key={String(title)}><Icon className="h-6 w-6 text-emerald-700"/><h2 className="mt-4 font-semibold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{String(text)}</p></article>)}</div><p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Sikkerhed er et løbende arbejde. Juridiske dokumenter og databehandleraftale bør altid gennemgås af virksomhedens juridiske rådgiver før endelig anvendelse.</p></section></Layout>; }

function Faq() { useSeo("Ofte stillede spørgsmål", "Svar på spørgsmål om prøveperiode, AI, fagadgang, sikkerhed, pakker og betaling.", "faq"); return <Layout><section className="mx-auto max-w-4xl px-4 py-20 sm:px-6"><p className="text-sm font-semibold text-emerald-700">FAQ</p><h1 className="mt-3 text-4xl font-semibold">Ofte stillede spørgsmål</h1><div className="mt-10 space-y-3">{faqs.map(([q,a])=><details key={q} className="group rounded-xl border bg-white p-5"><summary className="cursor-pointer list-none font-semibold">{q}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{a}</p></details>)}</div></section></Layout>; }

function About() { useSeo("Om ADD SmartRegnskab", "ADD SmartRegnskab er et dansk regnskabsprodukt fra ADD SmartDrift ApS.", "om"); return <Layout><section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2"><div><p className="text-sm font-semibold text-emerald-700">OM PRODUKTET</p><h1 className="mt-3 text-4xl font-semibold">Økonomi skal være forståelig og kontrollerbar</h1><p className="mt-5 leading-7 text-slate-600">ADD SmartRegnskab er udviklet til mindre danske virksomheder, der ønsker mindre administration og et bedre økonomisk overblik. Produktet samler centrale regnskabsflows og gør næste handling tydelig.</p></div><div className="rounded-2xl border bg-white p-7"><h2 className="font-semibold">ADD SmartDrift ApS</h2><dl className="mt-5 grid grid-cols-[7rem_1fr] gap-y-3 text-sm"><dt className="text-slate-500">CVR</dt><dd>46761898</dd><dt className="text-slate-500">Adresse</dt><dd>Lynæs Søpark 49<br/>3390 Hundested</dd><dt className="text-slate-500">E-mail</dt><dd><a className="text-emerald-700" href="mailto:regnskab@addsmartregnskab.dk">regnskab@addsmartregnskab.dk</a></dd></dl></div></section></Layout>; }

function LeadForm({ demo = false }: { demo?: boolean }) {
  const [form,setForm]=useState({name:"",email:"",phone:"",company:"",message:"",consent:false});
  const mutation=useMutation({mutationFn:async()=> (await apiRequest("POST","/api/public/leads",{...form,kind:demo?"demo":"kontakt",source:sessionStorage.getItem("add_utm_source")||"website"})).json(),onSuccess:()=>track(demo?"demo_request":"contact_request")});
  if(mutation.isSuccess)return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="h-7 w-7 text-emerald-700"/><h2 className="mt-3 font-semibold">Tak for din henvendelse</h2><p className="mt-2 text-sm text-slate-600">Vi har modtaget dine oplysninger og vender tilbage hurtigst muligt.</p></div>;
  return <form className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm" onSubmit={e=>{e.preventDefault();mutation.mutate();}}><div><Label htmlFor="lead-name">Navn</Label><Input id="lead-name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><Label htmlFor="lead-company">Virksomhed</Label><Input id="lead-company" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="lead-email">E-mail</Label><Input id="lead-email" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div><Label htmlFor="lead-phone">Telefon</Label><Input id="lead-phone" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div></div><div><Label htmlFor="lead-message">{demo?"Hvad vil du gerne se?":"Besked"}</Label><Textarea id="lead-message" required value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></div><label className="flex gap-2 text-xs text-slate-600"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span>Jeg accepterer, at ADD SmartDrift ApS bruger oplysningerne til at besvare min henvendelse. Se <Link className="text-emerald-700 underline" href="/privatliv">privatlivspolitikken</Link>.</span></label>{mutation.isError&&<p className="text-sm text-red-700">Henvendelsen kunne ikke sendes. Skriv til regnskab@addsmartregnskab.dk.</p>}<Button className="w-full" disabled={mutation.isPending}>{mutation.isPending?"Sender…":demo?"Book demo":"Send besked"}</Button></form>;
}

function Contact({demo=false}:{demo?:boolean}) { useSeo(demo?"Book demo":"Kontakt", demo?"Book en demonstration af ADD SmartRegnskab.":"Kontakt ADD SmartRegnskab.",demo?"book-demo":"kontakt"); return <Layout><section className="mx-auto grid max-w-5xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold text-emerald-700">{demo?"BOOK DEMO":"KONTAKT"}</p><h1 className="mt-3 text-4xl font-semibold">{demo?"Se hvordan løsningen passer til jeres arbejdsgang":"Hvordan kan vi hjælpe?"}</h1><p className="mt-5 leading-7 text-slate-600">{demo?"Fortæl kort om virksomheden og de vigtigste regnskabsopgaver. Demoen bruger kun sikre demodata.":"Send en besked om produktet, priser eller opstart. Del aldrig adgangskoder eller følsomme regnskabsdata i formularen."}</p><div className="mt-7 space-y-3 text-sm"><a className="flex items-center gap-3 hover:text-emerald-800" href="mailto:regnskab@addsmartregnskab.dk"><Mail className="h-5 w-5 text-emerald-700"/>regnskab@addsmartregnskab.dk</a><a className="flex items-center gap-3 hover:text-emerald-800" href="tel:+4542751341"><Phone className="h-5 w-5 text-emerald-700"/>+45 42 75 13 41</a><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-emerald-700"/><span>ADD SmartDrift ApS · CVR 46761898<br/>Lynæs Søpark 49, 3390 Hundested</span></div></div></div><LeadForm demo={demo}/></section></Layout>; }

function Help() { const [q,setQ]=useState(""); useSeo("Hjælpecenter", "Hjælp til opsætning, bilag, bogføring, fakturaer, bank, moms, rapporter og adgang.", "hjaelp"); const shown=useMemo(()=>helpArticles.filter(([t,b])=>(t+" "+b).toLowerCase().includes(q.toLowerCase())),[q]); return <Layout><section className="mx-auto max-w-6xl px-4 py-20 sm:px-6"><p className="text-sm font-semibold text-emerald-700">HJÆLPECENTER</p><h1 className="mt-3 text-4xl font-semibold">Hvad vil du have hjælp til?</h1><Input className="mt-7 max-w-xl bg-white" placeholder="Søg i hjælpen" value={q} onChange={e=>setQ(e.target.value)} aria-label="Søg i hjælpecenter"/><div className="mt-10 grid gap-4 md:grid-cols-2">{shown.map(([title,body])=><article key={title} className="rounded-2xl border bg-white p-6"><BookOpen className="h-5 w-5 text-emerald-700"/><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></article>)}</div>{shown.length===0&&<p className="mt-10 text-slate-600">Ingen artikler matcher søgningen. <Link href="/kontakt" className="text-emerald-700 underline">Kontakt support</Link>.</p>}</section></Layout>; }

function Guides() {
  useSeo("Guides og checklister", "Praktiske danske guides til bilag, bogføring, fakturaer og økonomioverblik.", "guides");
  return <Layout><section className="mx-auto max-w-6xl px-4 py-20 sm:px-6"><p className="text-sm font-semibold text-emerald-700">GUIDES</p><h1 className="mt-3 text-4xl font-semibold">Praktisk hjælp til et roligere regnskabsflow</h1><p className="mt-4 max-w-2xl leading-7 text-slate-600">Fagligt forsigtige arbejdsgange til mindre virksomheder. Indholdet er generel information og erstatter ikke konkret rådgivning fra bogholder, revisor eller juridisk rådgiver.</p><div className="mt-10 grid gap-4 md:grid-cols-2">{Object.entries(guides).map(([slug, guide])=><article key={slug} className="rounded-2xl border bg-white p-6"><BookOpen className="h-5 w-5 text-emerald-700"/><h2 className="mt-3 text-lg font-semibold">{guide.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{guide.intro}</p><Link href={`/guide/${slug}`} className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-800">Læs guiden <ChevronRight className="ml-1 h-4 w-4"/></Link></article>)}</div><div className="mt-16"><p className="text-sm font-semibold text-emerald-700">CHECKLISTER</p><h2 className="mt-3 text-3xl font-semibold">Klar til brug</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{leadMagnets.map(([title, body])=><article key={title} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6"><FileCheck2 className="h-5 w-5 text-emerald-700"/><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{body}</p><Button type="button" variant="outline" className="mt-5" onClick={()=>window.print()}>Udskriv checkliste</Button></article>)}</div></div></section></Layout>;
}

function Guide({ slug }: { slug: string }) {
  const guide = guides[slug as keyof typeof guides] || guides["bedre-oekonomioverblik"];
  useSeo(guide.title, guide.intro, `guide/${slug}`);
  return <Layout><article className="mx-auto max-w-3xl px-4 py-20 sm:px-6"><Link href="/guides" className="text-sm font-semibold text-emerald-800">← Alle guides</Link><p className="mt-8 text-sm font-semibold text-emerald-700">ADD SMARTREGNSKAB GUIDE</p><h1 className="mt-3 text-4xl font-semibold leading-tight">{guide.title}</h1><p className="mt-5 text-lg leading-8 text-slate-600">{guide.intro}</p><div className="mt-10 space-y-8">{guide.sections.map(([title, body])=><section key={title} className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 leading-7 text-slate-600">{body}</p></section>)}</div><p className="mt-10 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Guiden er generel information. Regler, moms og skat skal vurderes ud fra virksomhedens konkrete forhold.</p></article></Layout>;
}

function LegalDraftNotice() {
  return <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Juridisk kontrol:</strong> Dokumentet er godkendt til offentliggørelse af ADD SmartDrift ApS. Det er et standarddokument og erstatter ikke konkret juridisk rådgivning. Leverandøraftaler, behandlingssteder og tekniske slettefrister kontrolleres løbende.</div>;
}

function DocumentPage({ title, intro, path, sections, children }: { title: string; intro: string; path: string; sections: readonly (readonly [string, string])[]; children?: React.ReactNode }) {
  useSeo(title, intro, path);
  return <Layout><article className="mx-auto max-w-4xl px-4 py-20 sm:px-6"><h1 className="text-4xl font-semibold">{title}</h1><p className="mt-4 text-lg text-slate-600">{intro}</p><p className="mt-3 text-xs text-slate-500">Senest opdateret {LEGAL_UPDATED_AT}</p><LegalDraftNotice/><div className="mt-10 space-y-8">{sections.map(([heading, body])=><section key={heading}><h2 className="text-xl font-semibold">{heading}</h2><p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{body}</p></section>)}</div>{children}</article></Layout>;
}

function DpaPage() {
  return <DocumentPage title="Databehandleraftale" intro={`Standardvilkår for ADD SmartRegnskab, version ${DPA_VERSION}.`} path="databehandleraftale" sections={dpaSections}><p className="mt-10 rounded-xl border bg-white p-4 text-sm leading-6 text-slate-600">Den virksomhed, der accepterer aftalen i programmet, indsættes som dataansvarlig. Se også <Link className="font-medium text-emerald-800 underline" href="/underdatabehandlere">underdatabehandlerlisten</Link> og <Link className="font-medium text-emerald-800 underline" href="/dataopbevaring-og-sletning">reglerne for dataopbevaring og sletning</Link>.</p></DocumentPage>;
}

function SubprocessorsPage() {
  useSeo("Underdatabehandlere", "Leverandører der kan behandle personoplysninger for ADD SmartRegnskab.", "underdatabehandlere");
  return <Layout><article className="mx-auto max-w-6xl px-4 py-20 sm:px-6"><h1 className="text-4xl font-semibold">Underdatabehandlere</h1><p className="mt-4 max-w-3xl text-lg text-slate-600">Leverandører, som kan behandle personoplysninger på vegne af ADD SmartDrift ApS for at levere ADD SmartRegnskab.</p><p className="mt-3 text-xs text-slate-500">Senest opdateret {LEGAL_UPDATED_AT}</p><LegalDraftNotice/><div className="mt-10 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-700"><tr><th className="p-4">Leverandør</th><th className="p-4">Formål</th><th className="p-4">Data</th><th className="p-4">Behandlingssted</th><th className="p-4">Anvendelse</th></tr></thead><tbody className="divide-y">{subprocessors.map((entry)=><tr key={entry.name} className="align-top"><td className="p-4 font-medium">{entry.name}</td><td className="p-4 text-slate-600">{entry.purpose}</td><td className="p-4 text-slate-600">{entry.data}</td><td className="p-4 text-slate-600">{entry.location}</td><td className="p-4 text-slate-600">{entry.use}</td></tr>)}</tbody></table></div><div className="mt-8 space-y-3 text-sm leading-6 text-slate-600"><p>Valgfrie leverandører modtager kun data, når virksomhedens administrator aktiverer funktionen. Leverandører markeret som afventende må ikke behandle produktionsdata, før aftale, databehandlergrundlag og teknisk opsætning er godkendt.</p><p>Væsentlige ændringer varsles til kundens registrerede administrator. Begrundede indsigelser sendes til regnskab@addsmartregnskab.dk inden den frist, der står i varslet.</p></div></article></Layout>;
}

function RetentionPage() {
  return <DocumentPage title="Dataopbevaring, eksport og sletning" intro="Sådan håndteres regnskabsdata gennem hele kundens livscyklus i ADD SmartRegnskab." path="dataopbevaring-og-sletning" sections={retentionSections}><section className="mt-12"><h2 className="text-2xl font-semibold">Standardtidsplan</h2><p className="mt-3 text-sm leading-6 text-slate-600">Tidsplanen er ADD SmartRegnskabs driftsstandard. En bindende lovregel, dokumenteret tvist eller kundens lovlige instruks kan kræve en anden periode.</p><div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-700"><tr><th className="p-4">Datakategori</th><th className="p-4">Standardperiode</th><th className="p-4">Handling</th><th className="p-4">Kontrol</th></tr></thead><tbody className="divide-y">{retentionSchedule.map((entry)=><tr key={entry.category} className="align-top"><td className="p-4 font-medium">{entry.category}</td><td className="p-4 text-slate-600">{entry.standardPeriod}</td><td className="p-4 text-slate-600">{entry.action}</td><td className="p-4 text-slate-600">{entry.control}</td></tr>)}</tbody></table></div></section></DocumentPage>;
}

const legal: Record<"privacy"|"terms"|"payment"|"cookies",{title:string;intro:string;sections:[string,string][]}>={privacy:{title:"Privatlivspolitik",intro:"Sådan behandler ADD SmartDrift ApS oplysninger i forbindelse med ADD SmartRegnskab.",sections:[["Dataansvarlig","ADD SmartDrift ApS, CVR 46761898, Lynæs Søpark 49, 3390 Hundested. Kontakt: regnskab@addsmartregnskab.dk eller +45 42 75 13 41."],["Oplysninger og formål","Vi behandler kontakt-, konto-, virksomheds-, support-, brugs- og betalingsoplysninger for at levere tjenesten, beskytte kontoen, håndtere abonnementet, forebygge misbrug og besvare henvendelser. Kortnummer og kontrolcifre opbevares ikke af ADD SmartRegnskab."],["Retsgrundlag","Behandling sker efter aftalen med kunden, retlige forpligtelser, legitime interesser i sikker og stabil drift eller samtykke, afhængigt af formålet."],["Databehandlere og overførsler","Vi bruger leverandører til blandt andet hosting, fillagring og backup, e-mail, betaling, bankforbindelse og elektronisk fakturering. De får kun de oplysninger, som er nødvendige for opgaven, og er omfattet af aftaler og sikkerhedskrav. Eventuelle overførsler uden for EU/EØS skal have et gyldigt overførselsgrundlag. Den aktuelle liste findes på siden Underdatabehandlere."],["Opbevaring og sikkerhed","Oplysninger opbevares kun så længe formål, aftale og lovkrav kræver det. Adgang styres efter rolle, væsentlige handlinger logges, og data beskyttes under transport og ved kontrolleret backup. Se den særskilte side om dataopbevaring, eksport og sletning."],["Dine rettigheder","Du kan anmode om indsigt, rettelse, sletning, begrænsning, indsigelse og dataportabilitet, hvor databeskyttelsesreglerne giver ret til det. En anmodning vurderes konkret, da bogførings- og dokumentationskrav kan begrænse sletning."],["Kontakt og klage","Skriv til regnskab@addsmartregnskab.dk om privatliv og rettigheder. Du kan klage til Datatilsynet via datatilsynet.dk."]]},terms:{title:"Vilkår",intro:"Vilkår for virksomheders brug af ADD SmartRegnskab.",sections:[["Aftaleparter og anvendelse","ADD SmartRegnskab leveres af ADD SmartDrift ApS, CVR 46761898. Tjenesten er et erhvervsprodukt til virksomheder og organisationer. Den valgte pakke, pris og faktureringsperiode fremgår før bestilling og i abonnementsoverblikket."],["Tjenesten og levering","Tjenesten leveres digitalt. Adgang gives efter oprettelse og e-mailbekræftelse. Funktioner, selskaber, AI-forbrug og posteringstrin følger den valgte pakke og de priser, der er oplyst på prissiden."],["Kundens ansvar","Kunden er ansvarlig for korrekte oplysninger, sikre brugeradgange, lovlig brug, rettidig kontrol og godkendelse af bogføring samt egne bogførings-, moms- og skatteforpligtelser. Adgang må ikke deles mellem personer."],["AI og automatisering","AI-resultater er forslag og kan indeholde fejl. Kunden, bogholderen eller revisoren skal kontrollere resultatet. Betaling, moms, skat, løn og andre kritiske handlinger kræver udtrykkelig menneskelig godkendelse."],["Betaling, fornyelse og opsigelse","Alle offentlige priser er ekskl. moms. Efter prøveperioden bliver kunden kun betalende efter et aktivt valg. Et betalt abonnement fornyes efter den valgte periode, indtil en administrator opsiger det. Opsigelse kan foretages i abonnementsoverblikket og har virkning ved udløbet af den allerede betalte periode."],["Pris- og pakkeændringer","Pakkeskift, tilkøb og relevante forbrugsændringer vises før bekræftelse. Væsentlige ændringer i priser eller vilkår varsles før næste fornyelse, så kunden kan opsige inden ændringen får virkning."],["Drift, ansvar og ophør","Vi arbejder for stabil drift og varsler planlagt vedligeholdelse, når det er praktisk muligt. Kunden bør eksportere nødvendige data før aftalens ophør. Ansvar vurderes efter aftalen og ufravigelig dansk ret; tjenesten erstatter ikke konkret rådgivning fra bogholder, revisor eller advokat."],["Kontakt","Spørgsmål til aftalen kan sendes til regnskab@addsmartregnskab.dk eller +45 42 75 13 41. ADD SmartDrift ApS, Lynæs Søpark 49, 3390 Hundested."]]},payment:{title:"Betaling, opsigelse og refusion",intro:"Sådan fungerer betaling og ophør af ADD SmartRegnskrabs erhvervsabonnement.",sections:[["Priser og moms","Den aktuelle abonnementspris, eventuelle tilkøb, ekstra selskaber og posteringstillæg vises på prissiden og i abonnementsoverblikket. Alle priser er i danske kroner og ekskl. 25 % moms, medmindre andet står udtrykkeligt."],["Prøveperiode og aktivering","Prøveperioden varer 14 dage og kræver ikke betalingskort. Der trækkes ikke automatisk efter prøveperioden, før virksomhedens administrator aktivt har valgt et betalt abonnement og oprettet en betalingsaftale."],["Betalingsmetode og sikkerhed","Betaling sker med de korttyper, der vises i betalingsvinduet, herunder Visa og Mastercard. QuickPay behandler betalingsvinduet, og Clearhaus leverer kortindløsning, når produktionsaftalen er godkendt. ADD SmartRegnskab opbevarer ikke kortnummer eller kontrolcifre."],["Fornyelse og kvittering","Måneds- og årsabonnementer fornyes automatisk ved periodens udløb, når automatisk fornyelse er aktiv. Pris, moms og næste periode fremgår af abonnementsoverblikket. En abonnementsfaktura gøres tilgængelig i programmet."],["Opsigelse","Virksomhedens administrator kan slå automatisk fornyelse fra i Abonnement og betaling. Adgangen fortsætter til udløbet af den betalte periode, og der foretages derefter ikke en ny automatisk opkrævning."],["Refusion og fejlbetaling","Betalte abonnementsperioder refunderes som udgangspunkt ikke, når tjenesten har været tilgængelig. Ved dobbelttræk, forkert beløb, manglende levering eller anden betalingsfejl skal kunden kontakte os hurtigst muligt. Berettigede beløb tilbageføres til det oprindelige betalingsmiddel. Ufravigelige rettigheder påvirkes ikke."],["Manglende betaling","Hvis en betaling afvises, kan vi forsøge opkrævningen igen og kontakte kunden. Adgang kan begrænses efter rimeligt varsel, indtil betaling er modtaget. Regnskabsdata slettes ikke alene på grund af én mislykket betaling."],["Kontakt om betaling","Skriv til regnskab@addsmartregnskab.dk eller ring +45 42 75 13 41. Oplys virksomhedens navn og fakturanummer, men send aldrig kortnummer eller kontrolcifre."]]},cookies:{title:"Cookieinformation",intro:"Vi bruger kun analyse, når du har valgt det.",sections:[["Nødvendige cookies","Session, sikkerhed, login og dit cookievalg kræver teknisk lagring. Disse kan ikke fravælges, hvis tjenesten skal fungere."],["Analyse","Analyse af besøg og konverteringer aktiveres kun efter samtykke. Et afslag påvirker ikke adgangen til produktet."],["Ændr dit valg","Slet nøglen add_cookie_consent i browserens lokale lager for at få valget vist igen. En selvbetjeningsknap til ændring tilføjes før eksterne analysetags aktiveres."],["Tredjeparter","Eksterne marketingtags må først aktiveres, når de er konfigureret og samtykket er registreret."]]}};
legal.payment.intro = "Sådan fungerer betaling og ophør af ADD SmartRegnskabs erhvervsabonnement.";
function Legal({kind}:{kind:"privacy"|"terms"|"payment"|"cookies"}){const d=legal[kind];const paths={privacy:"privatliv",terms:"vilkaar",payment:"betaling-og-refusion",cookies:"cookies"} as const;useSeo(d.title,d.intro,paths[kind]);return <Layout><article className="mx-auto max-w-3xl px-4 py-20 sm:px-6"><h1 className="text-4xl font-semibold">{d.title}</h1><p className="mt-4 text-lg text-slate-600">{d.intro}</p><p className="mt-3 text-xs text-slate-500">Senest opdateret 22. september 2026</p><div className="mt-10 space-y-8">{d.sections.map(([h,p])=><section key={h}><h2 className="text-xl font-semibold">{h}</h2><p className="mt-3 leading-7 text-slate-600">{p}</p></section>)}</div>{kind==="cookies"&&<Button className="mt-10" variant="outline" onClick={()=>{localStorage.removeItem("add_cookie_consent");window.location.reload();}}>Ændr cookievalg</Button>}</article></Layout>}

function Landing({slug}:{slug:string}){const c=landingCopy[slug]??landingCopy["regnskabsprogram-smaa-virksomheder"];useSeo(c.eyebrow,c.lead,slug);return <Layout><Hero eyebrow={c.eyebrow} title={c.title} lead={c.lead}/><section className="mx-auto max-w-4xl px-4 py-16 sm:px-6"><div className="grid gap-4 sm:grid-cols-3">{c.bullets.map(x=><div key={x} className="rounded-xl border bg-white p-5 text-sm font-medium"><CheckCircle2 className="mb-3 h-5 w-5 text-emerald-700"/>{x}</div>)}</div></section><Callout/></Layout>}

export function Marketing({ page, landingSlug, guideSlug }: { page: MarketingPage; landingSlug?: string; guideSlug?: string }) {
  useEffect(() => {
    const query = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : window.location.search.slice(1);
    const params = new URLSearchParams(query);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const value = params.get(key); if (value) sessionStorage.setItem(`add_${key}`, value.slice(0, 120));
    }
    track("page_view", { page, landing: landingSlug ?? "" });
  }, [landingSlug, page]);
  if(page==="home")return <Home/>; if(page==="features")return <Features/>; if(page==="pricing")return <Pricing/>; if(page==="integrations")return <Integrations/>; if(page==="security")return <Security/>; if(page==="faq")return <Faq/>; if(page==="about")return <About/>; if(page==="contact")return <Contact/>; if(page==="demo")return <Contact demo/>; if(page==="help")return <Help/>; if(page==="guides")return <Guides/>; if(page==="guide")return <Guide slug={guideSlug??""}/>; if(page==="privacy")return <Legal kind="privacy"/>; if(page==="terms")return <Legal kind="terms"/>; if(page==="payment")return <Legal kind="payment"/>; if(page==="cookies")return <Legal kind="cookies"/>; if(page==="dpa")return <DpaPage/>; if(page==="subprocessors")return <SubprocessorsPage/>; if(page==="retention")return <RetentionPage/>; return <Landing slug={landingSlug??""}/>;
}

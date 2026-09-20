import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BarChart3, BookOpen, Building2, Check, CheckCircle2, ChevronRight,
  CircleHelp, Cookie, CreditCard, FileCheck2, FileText, Gauge, Landmark, LockKeyhole,
  Mail, Menu, PlayCircle, Receipt, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import type { Plan } from "@shared/schema";

type MarketingPage = "home" | "features" | "pricing" | "integrations" | "security" | "faq" | "about" | "contact" | "demo" | "help" | "guides" | "guide" | "privacy" | "terms" | "cookies" | "landing";

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
  ["NemHandel / Peppol", "Elektroniske fakturaer via Sproom med validering og leveringsstatus", "Afventer partneraktivering"],
  ["e-conomic", "Kontrolleret udveksling af regnskabsdata, når kundens aftale og adgang er tilsluttet", "Kræver aftale"],
  ["CSV-import", "Kontoplan, bankposter og data fra andre systemer", "Aktiv"],
  ["REST API og webhooks", "Sikker integration med afgrænsede API-nøgler, hændelser og revisionsspor", "Pakkeafhængig"],
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
    <div><p className="text-sm font-semibold">Virksomhed</p><div className="mt-3 space-y-2 text-sm text-emerald-100/70"><Link className="block" href="/om">Om produktet</Link><Link className="block" href="/privatliv">Privatliv</Link><Link className="block" href="/vilkaar">Vilkår</Link><Link className="block" href="/cookies">Cookies</Link></div></div>
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
  return <Layout><Hero /><section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="max-w-2xl"><p className="text-sm font-semibold text-emerald-700">ÉN SAMLET ARBEJDSFLADE</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Færre løse ender i økonomien</h2><p className="mt-4 text-slate-600">Funktionerne hænger sammen, så næste handling er tydelig, og kritiske beslutninger forbliver under menneskelig kontrol.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map(({icon: Icon,title,text}) => <article key={title} className="rounded-2xl border bg-white p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></section><section className="bg-white"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2"><div><p className="text-sm font-semibold text-emerald-700">KONTROL FØR AUTOMATIK</p><h2 className="mt-3 text-3xl font-semibold">AI hjælper. Du godkender.</h2><p className="mt-4 leading-7 text-slate-600">Systemet kan analysere, foreslå og prioritere. Handlinger med økonomisk eller juridisk betydning kræver godkendelse og registreres i revisionssporet.</p></div><div className="space-y-3">{["Forklarlige bogføringsforslag", "Ingen automatisk indsendelse af moms eller skat", "Ingen betaling uden godkendelse", "Log over forslag, ændringer og godkendelser"].map(x => <div key={x} className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />{x}</div>)}</div></div></section><Callout /></Layout>;
}

function Callout() { return <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="rounded-3xl bg-emerald-900 px-6 py-12 text-center text-white sm:px-12"><h2 className="text-3xl font-semibold">Klar til et enklere regnskabsflow?</h2><p className="mx-auto mt-3 max-w-2xl text-emerald-100/75">Start uden betalingskort, eller book en gennemgang af løsningen.</p><div className="mt-7 flex justify-center gap-3"><Button asChild className="bg-white text-emerald-950 hover:bg-emerald-50"><Link href="/tilmeld">Prøv gratis</Link></Button><Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white"><Link href="/book-demo">Book demo</Link></Button></div></div></section>; }

function Features() { useSeo("Funktioner", "Se funktionerne i ADD SmartRegnskab: bilag, bogføring, fakturaer, bank, moms, rapporter og sikker fagadgang.", "funktioner"); return <Layout><Hero eyebrow="Funktioner" title="Regnskabsarbejde med en tydelig næste handling" lead="Fra første bilag til rapportering og årsafslutning — med kontrol, forklaringer og rollebaseret adgang." /><section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-5 md:grid-cols-2">{features.concat([{icon: CreditCard,title:"Betaling og abonnement",text:"QuickPay-betalingsaftale, fakturaoversigt og selvbetjent pakkeskift."},{icon: FileCheck2,title:"Revision og afslutning",text:"Kontrolspor, afstemninger, periodeafslutning, SAF-T og dokumenteret godkendelse."}]).map(({icon:Icon,title,text})=><article key={title} className="flex gap-4 rounded-2xl border bg-white p-6"><Icon className="h-6 w-6 shrink-0 text-emerald-700"/><div><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div></article>)}</div></section><Callout/></Layout>; }

function Pricing() {
  useSeo("Priser", "Vælg ADD SmartRegnskab-pakke efter bilag, posteringer, virksomheder og integrationer.", "priser");
  const { data = [] } = useQuery<Plan[]>({ queryKey: ["/api/plans"], queryFn: async () => (await apiRequest("GET", "/api/plans")).json() });
  useEffect(() => track("view_pricing"), []);
  return <Layout><section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6"><p className="text-sm font-semibold text-emerald-700">PRISER</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Vælg efter dit regnskabsbehov</h1><p className="mx-auto mt-4 max-w-2xl text-slate-600">Alle priser er pr. måned ekskl. moms. Årsbetaling koster ti måneders pris.</p><div className="mt-12 grid gap-5 text-left lg:grid-cols-4">{data.map((plan, i) => <article key={plan.id} className={`rounded-2xl border bg-white p-6 shadow-sm ${i===1?"ring-2 ring-emerald-700":""}`}><div className="flex items-center justify-between"><h2 className="font-semibold">{plan.name}</h2>{i===1&&<span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">POPULÆR</span>}</div><p className="mt-5 text-3xl font-semibold">{money(plan.monthlyPrice)}<span className="text-sm font-normal text-slate-500"> /md.</span></p><p className="mt-1 text-xs text-slate-500">{money(plan.monthlyPrice*10)} /år</p><div className="my-5 h-px bg-slate-100"/><ul className="space-y-3 text-sm">{[[`${limit(plan.maxDocuments)} bilag/md.`],[`${limit(plan.maxEntries)} posteringer/md.`],[plan.maxCompanies===1?"1 virksomhed":`${limit(plan.maxCompanies)} virksomheder`],[`${limit(plan.maxIntegrations)} integrationer`]].map(([x])=><li className="flex gap-2" key={x}><Check className="h-4 w-4 text-emerald-700"/>{x}</li>)}</ul><Button asChild className="mt-7 w-full" variant={i===1?"default":"outline"}><Link href="/tilmeld">Start gratis</Link></Button></article>)}</div></section><Callout/></Layout>;
}

function Integrations() { useSeo("Integrationer", "Forbind ADD SmartRegnskab med bankdata, e-fakturering, import og sikre API'er.", "integrationer"); return <Layout><Hero eyebrow="Integrationer" title="Forbind de vigtigste dele af økonomiflowet" lead="Her vises kun forbindelser, som kunden kan tilslutte eller bruge i sit regnskabsarbejde."/><section className="mx-auto max-w-5xl px-4 py-20 sm:px-6"><div className="grid gap-4 sm:grid-cols-2">{integrations.map(([name,text,status])=><article key={name} className="rounded-2xl border bg-white p-6"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{name}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium">{status}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}</div><p className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">Systemmail, abonnementbetaling og ekstern backup er interne driftsydelser. De overvåges af ADD SmartRegnskab og er derfor ikke integrationer, som kunden skal opsætte.</p></section></Layout>; }

function Security() { useSeo("Sikkerhed", "Læs om adgangskontrol, kryptering, backup, revisionsspor og databeskyttelse i ADD SmartRegnskab.", "sikkerhed"); const cards=[[LockKeyhole,"Adgang","Sikre sessioner, rollebaserede rettigheder, loginbegrænsning og tofaktorgodkendelse for fagbrugere."],[ShieldCheck,"Kontrolspor","Væsentlige handlinger, godkendelser og ændringer registreres med bruger og tidspunkt."],[FileCheck2,"Data og filer","Virksomhedsadskillelse, kontrollerede uploads, krypteret transport og beskyttet fillagring."],[Gauge,"Drift og backup","Sundhedskontrol, ekstern backup, checksums og dokumenteret restore-øvelse."]]; return <Layout><Hero eyebrow="Sikkerhed" title="Regnskabsdata kræver mere end et stærkt password" lead="ADD SmartRegnskab er bygget med lagdelt adgangskontrol, sikker konfiguration og sporbarhed."/><section className="mx-auto max-w-5xl px-4 py-20 sm:px-6"><div className="grid gap-5 sm:grid-cols-2">{cards.map(([Icon,title,text])=><article className="rounded-2xl border bg-white p-6" key={String(title)}><Icon className="h-6 w-6 text-emerald-700"/><h2 className="mt-4 font-semibold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{String(text)}</p></article>)}</div><p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Sikkerhed er et løbende arbejde. Juridiske dokumenter og databehandleraftale bør altid gennemgås af virksomhedens juridiske rådgiver før endelig anvendelse.</p></section></Layout>; }

function Faq() { useSeo("Ofte stillede spørgsmål", "Svar på spørgsmål om prøveperiode, AI, fagadgang, sikkerhed, pakker og betaling.", "faq"); return <Layout><section className="mx-auto max-w-4xl px-4 py-20 sm:px-6"><p className="text-sm font-semibold text-emerald-700">FAQ</p><h1 className="mt-3 text-4xl font-semibold">Ofte stillede spørgsmål</h1><div className="mt-10 space-y-3">{faqs.map(([q,a])=><details key={q} className="group rounded-xl border bg-white p-5"><summary className="cursor-pointer list-none font-semibold">{q}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{a}</p></details>)}</div></section></Layout>; }

function About() { useSeo("Om ADD SmartRegnskab", "ADD SmartRegnskab er et dansk regnskabsprodukt fra ADD SmartDrift ApS.", "om"); return <Layout><section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2"><div><p className="text-sm font-semibold text-emerald-700">OM PRODUKTET</p><h1 className="mt-3 text-4xl font-semibold">Økonomi skal være forståelig og kontrollerbar</h1><p className="mt-5 leading-7 text-slate-600">ADD SmartRegnskab er udviklet til mindre danske virksomheder, der ønsker mindre administration og et bedre økonomisk overblik. Produktet samler centrale regnskabsflows og gør næste handling tydelig.</p></div><div className="rounded-2xl border bg-white p-7"><h2 className="font-semibold">ADD SmartDrift ApS</h2><dl className="mt-5 grid grid-cols-[7rem_1fr] gap-y-3 text-sm"><dt className="text-slate-500">CVR</dt><dd>46761898</dd><dt className="text-slate-500">Adresse</dt><dd>Lynæs Søpark 49<br/>3390 Hundested</dd><dt className="text-slate-500">E-mail</dt><dd><a className="text-emerald-700" href="mailto:regnskab@addsmartregnskab.dk">regnskab@addsmartregnskab.dk</a></dd></dl></div></section></Layout>; }

function LeadForm({ demo = false }: { demo?: boolean }) {
  const [form,setForm]=useState({name:"",email:"",phone:"",company:"",message:"",consent:false});
  const mutation=useMutation({mutationFn:async()=> (await apiRequest("POST","/api/public/leads",{...form,kind:demo?"demo":"kontakt",source:sessionStorage.getItem("add_utm_source")||"website"})).json(),onSuccess:()=>track(demo?"demo_request":"contact_request")});
  if(mutation.isSuccess)return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="h-7 w-7 text-emerald-700"/><h2 className="mt-3 font-semibold">Tak for din henvendelse</h2><p className="mt-2 text-sm text-slate-600">Vi har modtaget dine oplysninger og vender tilbage hurtigst muligt.</p></div>;
  return <form className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm" onSubmit={e=>{e.preventDefault();mutation.mutate();}}><div><Label htmlFor="lead-name">Navn</Label><Input id="lead-name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><Label htmlFor="lead-company">Virksomhed</Label><Input id="lead-company" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="lead-email">E-mail</Label><Input id="lead-email" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div><Label htmlFor="lead-phone">Telefon</Label><Input id="lead-phone" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div></div><div><Label htmlFor="lead-message">{demo?"Hvad vil du gerne se?":"Besked"}</Label><Textarea id="lead-message" required value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></div><label className="flex gap-2 text-xs text-slate-600"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span>Jeg accepterer, at ADD SmartDrift ApS bruger oplysningerne til at besvare min henvendelse. Se <Link className="text-emerald-700 underline" href="/privatliv">privatlivspolitikken</Link>.</span></label>{mutation.isError&&<p className="text-sm text-red-700">Henvendelsen kunne ikke sendes. Skriv til regnskab@addsmartregnskab.dk.</p>}<Button className="w-full" disabled={mutation.isPending}>{mutation.isPending?"Sender…":demo?"Book demo":"Send besked"}</Button></form>;
}

function Contact({demo=false}:{demo?:boolean}) { useSeo(demo?"Book demo":"Kontakt", demo?"Book en demonstration af ADD SmartRegnskab.":"Kontakt ADD SmartRegnskab.",demo?"book-demo":"kontakt"); return <Layout><section className="mx-auto grid max-w-5xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold text-emerald-700">{demo?"BOOK DEMO":"KONTAKT"}</p><h1 className="mt-3 text-4xl font-semibold">{demo?"Se hvordan løsningen passer til jeres arbejdsgang":"Hvordan kan vi hjælpe?"}</h1><p className="mt-5 leading-7 text-slate-600">{demo?"Fortæl kort om virksomheden og de vigtigste regnskabsopgaver. Demoen bruger kun sikre demodata.":"Send en besked om produktet, priser eller opstart. Del aldrig adgangskoder eller følsomme regnskabsdata i formularen."}</p><div className="mt-7 flex items-center gap-3 text-sm"><Mail className="h-5 w-5 text-emerald-700"/>regnskab@addsmartregnskab.dk</div></div><LeadForm demo={demo}/></section></Layout>; }

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

const legal: Record<"privacy"|"terms"|"cookies",{title:string;intro:string;sections:[string,string][]}>={privacy:{title:"Privatlivspolitik",intro:"Sådan behandler ADD SmartDrift ApS oplysninger i forbindelse med ADD SmartRegnskab.",sections:[["Dataansvarlig","ADD SmartDrift ApS, CVR 46761898, Lynæs Søpark 49, 3390 Hundested."],["Formål","Vi behandler kontakt-, konto-, virksomheds-, support- og betalingsoplysninger for at levere tjenesten, beskytte kontoen, håndtere abonnementet og besvare henvendelser."],["Retsgrundlag","Behandling sker efter aftale, retlig forpligtelse, legitim interesse eller samtykke, afhængigt af formålet."],["Opbevaring og rettigheder","Oplysninger opbevares kun så længe formål og lovkrav kræver det. Du kan anmode om indsigt, rettelse, sletning, begrænsning og dataportabilitet, hvor reglerne giver ret til det."],["Kontakt","Skriv til regnskab@addsmartregnskab.dk om privatliv og rettigheder. Klage kan indgives til Datatilsynet."]]},terms:{title:"Vilkår",intro:"Grundvilkår for brug af ADD SmartRegnskab.",sections:[["Tjenesten","Abonnementet giver adgang til de funktioner og grænser, der fremgår af den valgte pakke."],["Kundens ansvar","Kunden er ansvarlig for korrekte oplysninger, brugeradgange, godkendelse af bogføring og overholdelse af egne bogførings- og skatteforpligtelser."],["AI og automatisering","Forslag fra AI er hjælpemidler og erstatter ikke kundens, bogholderens eller revisorens kontrol. Kritiske handlinger kræver godkendelse."],["Betaling og ændringer","Pris, periode og eventuel prøveperiode vises før bestilling. Pakkeændringer bekræftes tydeligt i løsningen."],["Ansvar og drift","Planlagt vedligeholdelse og driftsforstyrrelser håndteres efter gældende support- og driftsprocedurer. Endelige aftalevilkår skal accepteres ved køb."]]},cookies:{title:"Cookieinformation",intro:"Vi bruger kun analyse, når du har valgt det.",sections:[["Nødvendige cookies","Session, sikkerhed, login og dit cookievalg kræver teknisk lagring. Disse kan ikke fravælges, hvis tjenesten skal fungere."],["Analyse","Analyse af besøg og konverteringer aktiveres kun efter samtykke. Et afslag påvirker ikke adgangen til produktet."],["Ændr dit valg","Slet nøglen add_cookie_consent i browserens lokale lager for at få valget vist igen. En selvbetjeningsknap til ændring tilføjes før eksterne analysetags aktiveres."],["Tredjeparter","Eksterne marketingtags må først aktiveres, når de er konfigureret og samtykket er registreret."]]}};
function Legal({kind}:{kind:"privacy"|"terms"|"cookies"}){const d=legal[kind];useSeo(d.title,d.intro,kind==="privacy"?"privatliv":kind==="terms"?"vilkaar":"cookies");return <Layout><article className="mx-auto max-w-3xl px-4 py-20 sm:px-6"><h1 className="text-4xl font-semibold">{d.title}</h1><p className="mt-4 text-lg text-slate-600">{d.intro}</p><p className="mt-3 text-xs text-slate-500">Senest opdateret 19. september 2026</p><div className="mt-10 space-y-8">{d.sections.map(([h,p])=><section key={h}><h2 className="text-xl font-semibold">{h}</h2><p className="mt-3 leading-7 text-slate-600">{p}</p></section>)}</div>{kind==="cookies"&&<Button className="mt-10" variant="outline" onClick={()=>{localStorage.removeItem("add_cookie_consent");window.location.reload();}}>Ændr cookievalg</Button>}</article></Layout>}

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
  if(page==="home")return <Home/>; if(page==="features")return <Features/>; if(page==="pricing")return <Pricing/>; if(page==="integrations")return <Integrations/>; if(page==="security")return <Security/>; if(page==="faq")return <Faq/>; if(page==="about")return <About/>; if(page==="contact")return <Contact/>; if(page==="demo")return <Contact demo/>; if(page==="help")return <Help/>; if(page==="guides")return <Guides/>; if(page==="guide")return <Guide slug={guideSlug??""}/>; if(page==="privacy")return <Legal kind="privacy"/>; if(page==="terms")return <Legal kind="terms"/>; if(page==="cookies")return <Legal kind="cookies"/>; return <Landing slug={landingSlug??""}/>;
}

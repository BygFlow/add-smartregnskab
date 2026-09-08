import { useEffect, useState } from"react";
import { Link } from"wouter";
import { useAuth } from"@/lib/auth";
import { Logo } from"@/components/logo";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { ApiError, apiUrl } from"@/lib/queryClient";
import { AlertCircle, BarChart3, Clock3, FileText, ShieldCheck, TriangleAlert } from"lucide-react";

const DEMO_PASSWORD ="demo1234";

const DEMO_USERS = [
 { email:"platform@smartdriftclean.dk", role:"ADD SmartDrift Clean platform" },
 { email:"leder@smartdriftclean.dk", role:"Leder" },
 { email:"holdleder@smartdriftclean.dk", role:"Holdleder" },
 { email:"assistent@smartdriftclean.dk", role:"Assistent" },
 { email:"kunde@smartdriftclean.dk", role:"Kunde" },
 { email:"leder2@smartdriftclean.dk", role:"Leder (prøveperiode)" },
 { email:"leder3@smartdriftclean.dk", role:"Leder (i restance)" },
];

type LoginStep ="credentials" |"twoFactor";
type LoginNotice ="error" |"locked" |"subscription";

function formatRetry(seconds: number) {
 const minutes = Math.floor(seconds / 60);
 const remainingSeconds = seconds % 60;
 return `${minutes}:${String(remainingSeconds).padStart(2,"0")}`;
}

const FEATURES = [
 { icon: ShieldCheck, label:"GDPR & DPA håndtering" },
 { icon: FileText, label:"Fakturering & abonnementer" },
 { icon: BarChart3, label:"Indsigt & analytics" },
];

export default function Login() {
 const { login } = useAuth();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [code, setCode] = useState("");
 const [step, setStep] = useState<LoginStep>("credentials");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [notice, setNotice] = useState<LoginNotice>("error");
 const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

 useEffect(() => {
 if (!retryAfterSeconds || retryAfterSeconds <= 0) return;
 const interval = window.setInterval(() => {
 setRetryAfterSeconds((seconds) => {
 if (!seconds || seconds <= 1) return null;
 return seconds - 1;
 });
 }, 1000);
 return () => window.clearInterval(interval);
 }, [retryAfterSeconds]);

 const clearFeedback = () => {
 setError(null);
 setRetryAfterSeconds(null);
 setNotice("error");
 };

 const handleSubmit = async (event: React.FormEvent) => {
 event.preventDefault();
 setLoading(true);
 clearFeedback();
 try {
 await login(email, password, step ==="twoFactor" ? code : undefined);
 } catch (err) {
 const apiError = err instanceof ApiError ? err : null;
 const message = apiError?.message ??"Kunne ikke få forbindelse til serveren. Prøv igen.";

 if (apiError?.code ==="to_faktor_kraeves") {
 if (step ==="credentials") {
 setStep("twoFactor");
 } else {
 setError(message);
 }
 } else if (apiError?.code ==="for_mange_forsoeg") {
 const seconds = Number(apiError.payload?.retryAfterSeconds);
 setNotice("locked");
 setError(message);
 setRetryAfterSeconds(Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60);
 } else if (apiError?.code ==="abonnement_spaerret") {
 setNotice("subscription");
 setError(message);
 } else {
 setNotice("error");
 setError(message);
 }
 } finally {
 setLoading(false);
 }
 };

 const quickLogin = (demoEmail: string) => {
 setEmail(demoEmail);
 setPassword(DEMO_PASSWORD);
 setCode("");
 setStep("credentials");
 clearFeedback();
 };

 const goBack = () => {
 setStep("credentials");
 setCode("");
 clearFeedback();
 };

 const locked = retryAfterSeconds !== null && retryAfterSeconds > 0;

 return (
 <div className="login-split bg-background">
 {/* Brand panel — hidden on mobile */}
 <aside className="login-brand hidden md:flex">
 <div className="w-full max-w-md mx-auto">
 <div className="bg-white/95 rounded-md p-2 w-fit mb-8 shadow-lg">
 <Logo className="h-10 w-10 text-primary" />
 </div>

 <h2 className="text-lg font-bold mb-2">Rengøringsselskab Styring</h2>
 <p className="text-sm text-white/80 mb-10">
 Komplet platform til drift af rengøringsselskaber
 </p>

 <ul className="space-y-3">
 {FEATURES.map(({ icon: Icon, label }) => (
 <li key={label} className="flex items-center gap-3">
 <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 shrink-0">
 <Icon className="w-5 h-5" />
 </span>
 <span className="text-sm font-medium">{label}</span>
 </li>
 ))}
 </ul>
 </div>
 </aside>

 {/* Login form — centered vertically */}
 <section className="flex items-center justify-center p-4 sm:p-4">
 <div className="w-full max-w-sm">
 <div className="flex flex-col items-center mb-8">
 <Logo className="h-12 w-12 text-primary mb-3" />
 <h1 className="text-lg font-bold text-foreground">ADD SmartDrift Clean</h1>
 </div>

 <form onSubmit={handleSubmit} className="space-y-3 bg-card border border-card-border rounded-md p-4">
 {step ==="credentials" ? (
 <>
 <div className="space-y-1.5">
 <Label htmlFor="email">E-mail</Label>
 <Input id="email" type="email" data-testid="input-login-email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="din@email.dk" autoComplete="username" />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="password">Adgangskode</Label>
 <Input id="password" type="password" data-testid="input-login-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" autoComplete="current-password" />
 </div>
 </>
 ) : (
 <>
 <div className="space-y-1">
 <h2 className="text-lg font-semibold text-foreground" data-testid="text-login-two-factor-title">Bekræft login</h2>
 <p className="text-sm text-muted-foreground">
 Indtast engangskoden fra din godkendelsesapp. Du kan også bruge en af dine reservekoder.
 </p>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="login-code">Engangskode</Label>
 <Input
 id="login-code"
 data-testid="input-login-code"
 value={code}
 onChange={(event) => setCode(event.target.value.replace(/\D/g,"").slice(0, 6))}
 inputMode="numeric"
 maxLength={6}
 pattern="[0-9]*"
 autoFocus
 autoComplete="one-time-code"
 required
 placeholder="000000"
 className="text-center tracking-[0.35em] tabular-nums"
 />
 </div>
 <button type="button" onClick={goBack} data-testid="button-login-back" className="text-sm font-medium text-primary hover:underline">
 Tilbage
 </button>
 </>
 )}

 {error && (
 <div
 data-testid="text-login-error"
 className={`flex gap-2 items-start rounded-md border p-3 text-xs ${
 notice ==="subscription"
 ?"bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
 :"bg-destructive/10 border-destructive/30 text-destructive"
 }`}
 >
 {notice ==="subscription" ? <TriangleAlert className="w-4 h-4 shrink-0 mt-px" /> : notice ==="locked" ? <Clock3 className="w-4 h-4 shrink-0 mt-px" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-px" />}
 <div className="min-w-0 space-y-1">
 <p>{error}</p>
 {locked && <p className="font-medium" data-testid="text-login-retry">Prøv igen om {formatRetry(retryAfterSeconds)}.</p>}
 {notice ==="subscription" && <p>Kontakt ADD SmartDrift Clean for at få hjælp til at genåbne adgangen.</p>}
 </div>
 </div>
 )}

 <Button type="submit" className="w-full" disabled={loading || locked} data-testid="button-login">
 {loading ?"Logger ind..." : locked ? `Prøv igen om ${formatRetry(retryAfterSeconds ?? 0)}` : step ==="twoFactor" ?"Bekræft" :"Log ind"}
 </Button>
 </form>

 <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
 <Link href="/tilmeld" data-testid="link-signup" className="font-medium text-primary hover:underline">Opret virksomhed</Link>
 <Link href="/glemt" data-testid="link-forgot-password" className="font-medium text-primary hover:underline">Glemt adgangskode?</Link>
 <a href={apiUrl("/api/legal/privatliv")} target="_blank" rel="noreferrer" data-testid="link-privacy-policy" className="font-medium text-primary hover:underline">Privatlivspolitik</a>
 </div>

 {/* Demo-login må aldrig eksponeres i et produktionsbuild. */}
 {import.meta.env.DEV && <details className="mt-4 rounded-lg bg-muted/50 border border-border group">
 <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground select-none flex items-center justify-between">
 <span>Demobrugere (adgangskode: {DEMO_PASSWORD})</span>
 <span className="text-muted-foreground/60 group-open:rotate-180 transition-transform">▾</span>
 </summary>
 <div className="px-3 pb-3 pt-1 space-y-1.5">
 {DEMO_USERS.map((user) => (
 <button
 type="button"
 key={user.email}
 onClick={() => quickLogin(user.email)}
 data-testid={`quicklogin-${user.email}`}
 className="flex items-center justify-between gap-2 w-full text-left px-3 py-1.5 rounded-md text-xs hover:bg-accent transition-colors"
 >
 <span className="text-foreground font-medium shrink-0">{user.role}</span>
 <span className="text-muted-foreground truncate">{user.email}</span>
 </button>
 ))}
 <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
 Sessionen ligger kun i browserens hukommelse, så du bliver logget ud, hvis du genindlæser siden.
 </p>
 </div>
 </details>}

 {/* Link to SmartRegnskab */}
 <div className="mt-4 text-center text-xs text-muted-foreground">
 Regnskabsplatform?{" "}
 <Link href="/smartregnskab/login" data-testid="link-to-smartregnskab" className="font-medium text-primary hover:underline">
 ADD SmartRegnskab
 </Link>
 </div>
 </div>
 </section>
 </div>
 );
}

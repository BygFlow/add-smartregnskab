import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiRequest, apiUrl } from "@/lib/queryClient";
import type { Plan } from "@shared/schema";

type ApiResult = {
  ok?: boolean;
  message?: string;
  demoToken?: string;
};

type InvitationInfo = {
  email: string;
  companyName: string | null;
  role: string;
  name?: string;
};

const ROLE_LABELS: Record<string, string> = {
  leder: "Leder",
  holdleder: "Holdleder",
  assistent: "Medarbejder",
  kunde: "Kundeadgang",
};

function tokenFromHash() {
  const fraHash = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("token");
  // Nogle mailklienter flytter query-strengen foran hash-delen, så vi læser begge steder.
  return fraHash ?? new URLSearchParams(window.location.search).get("token") ?? "";
}

function errorDetails(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return {
      message: error.message || fallback,
      problems: Array.isArray(error.payload?.problems) ? error.payload.problems.map(String) : [],
    };
  }
  return { message: fallback, problems: [] as string[] };
}

function money(value: number) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(value);
}

function PublicLayout({ children, title, description, testId = "card-public" }: {
  children: React.ReactNode;
  title: string;
  description?: string;
  testId?: string;
}) {
  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="w-full max-w-lg py-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="h-12 w-12 text-primary mb-3" />
          <h1 className="text-lg font-bold text-foreground" data-testid={`text-${testId}-title`}>{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>}
        </div>
        <div className="rounded-md border border-border/50 bg-card  p-3 " data-testid={testId}>
          {children}
        </div>
        <div className="mt-4 text-center">
          <Link href="/" data-testid="link-back-to-login" className="text-sm font-medium text-primary hover:underline">
            Tilbage til login
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ message, problems, testId = "card-public-error" }: { message: string; problems?: string[]; testId?: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" data-testid={testId}>
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p>{message}</p>
          {problems && problems.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs" data-testid="list-password-problems">
              {problems.map((problem, index) => <li key={`${problem}-${index}`}>{problem}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessCard({ message, children, testId = "card-public-success" }: { message: string; children?: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300" data-testid={testId}>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-2"><p>{message}</p>{children}</div>
      </div>
    </div>
  );
}

function DemoLink({ token, to, testId }: { token?: string; to: "/bekraeft" | "/nulstil"; testId: string }) {
  if (!token) return null;
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground" data-testid={testId}>
      <p>Linket vises kun her, fordi der ikke er sat en mailudbyder op i demoen.</p>
      <a href={`#${to}?token=${encodeURIComponent(token)}`} className="mt-1 inline-block break-all font-medium text-primary hover:underline">
        Åbn {to === "/bekraeft" ? "e-mailbekræftelse" : "nulstilling af adgangskode"}
      </a>
    </div>
  );
}

export function Tilmeld() {
  const [companyName, setCompanyName] = useState("");
  const [cvr, setCvr] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  const { data: plans, isLoading: plansLoading, isError: plansError } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/plans")).json(),
  });

  const signup = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/signup", {
        companyName,
        cvr: cvr.trim() || undefined,
        name,
        email,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        password,
        plan: selectedPlan || plans?.[0]?.slug,
      });
      return response.json() as Promise<ApiResult>;
    },
    onSuccess: (data) => {
      setLocalError(null);
      setResult(data);
    },
    onError: (error) => {
      setResult(null);
      setLocalError(null);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    if (password !== repeatPassword) {
      setLocalError("Adgangskoderne er ikke ens.");
      return;
    }
    if (!acceptedPrivacy) {
      setLocalError("Du skal acceptere privatlivspolitikken for at fortsætte.");
      return;
    }
    setLocalError(null);
    signup.mutate();
  };

  const signupError = signup.error ? errorDetails(signup.error, "Virksomheden kunne ikke oprettes.") : null;

  return (
    <PublicLayout title="Opret din virksomhed" description="14 dages gratis prøveperiode uden betalingskort." testId="card-signup">
      {result ? (
        <SuccessCard message={result.message ?? "Tjek din indbakke for næste skridt."} testId="card-signup-success">
          <DemoLink token={result.demoToken} to="/bekraeft" testId="card-signup-demo-link" />
        </SuccessCard>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground" data-testid="text-signup-trial">
            Prøv ADD SmartRegnskab gratis i 14 dage — du behøver ikke indtaste et betalingskort.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="signup-company">Virksomhedsnavn</Label>
            <Input id="signup-company" data-testid="input-signup-company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-cvr">CVR <span className="text-muted-foreground">(valgfri)</span></Label>
            <Input id="signup-cvr" data-testid="input-signup-cvr" value={cvr} onChange={(event) => setCvr(event.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-name">Dit navn</Label>
            <Input id="signup-name" data-testid="input-signup-name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">E-mail</Label>
            <Input id="signup-email" data-testid="input-signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="signup-phone">Telefon <span className="text-muted-foreground">(valgfri)</span></Label>
              <Input id="signup-phone" data-testid="input-signup-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="signup-address">Adresse <span className="text-muted-foreground">(valgfri)</span></Label>
              <Input id="signup-address" data-testid="input-signup-address" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="signup-password">Adgangskode</Label>
              <Input id="signup-password" data-testid="input-signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="signup-password-repeat">Gentag adgangskode</Label>
              <Input id="signup-password-repeat" data-testid="input-signup-password-repeat" type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} required autoComplete="new-password" />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">Vælg pakke</h2>
              <p className="text-xs text-muted-foreground">Du kan ændre pakken senere.</p>
            </div>
            {plansLoading ? (
              <div className="grid gap-2 sm:grid-cols-2" data-testid="skeleton-signup-plans">
                <Skeleton className="h-24 rounded-md" /><Skeleton className="h-24 rounded-md" />
              </div>
            ) : plansError || !plans?.length ? (
              <ErrorCard message="Pakkerne kunne ikke hentes. Prøv igen om lidt." testId="card-signup-plans-error" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {plans.map((plan, index) => {
                  const active = (selectedPlan || plans[0]?.slug) === plan.slug;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      data-testid={`button-signup-plan-${plan.slug}`}
                      onClick={() => setSelectedPlan(plan.slug)}
                      className={`min-w-0 rounded-md border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{plan.name}</span>
                        {index === 0 && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Første pakke</span>}
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{money(plan.monthlyPrice)} <span className="font-normal text-xs text-muted-foreground">/ md.</span></p>
                      <p className="mt-0.5 text-xs text-muted-foreground">+ {money(plan.pricePerEmployee)} pr. ansat / md.</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="signup-privacy" data-testid="checkbox-signup-privacy" checked={acceptedPrivacy} onCheckedChange={(value) => setAcceptedPrivacy(value === true)} />
            <Label htmlFor="signup-privacy" className="text-sm leading-5 font-normal cursor-pointer">
              Jeg accepterer <a href={apiUrl("/api/legal/privatliv")} target="_blank" rel="noreferrer" data-testid="link-signup-privacy" className="font-medium text-primary hover:underline">privatlivspolitikken</a>.
            </Label>
          </div>

          {localError && <ErrorCard message={localError} testId="card-signup-local-error" />}
          {signupError && <ErrorCard message={signupError.message} problems={signupError.problems} testId="card-signup-error" />}
          <Button type="submit" className="w-full" data-testid="button-signup" disabled={signup.isPending || plansLoading || plansError}>
            {signup.isPending ? "Opretter virksomhed..." : "Opret virksomhed"}
          </Button>
        </form>
      )}
    </PublicLayout>
  );
}

export function Bekraeft() {
  const token = tokenFromHash();
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const resend = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/verify/resend", { email })).json() as Promise<ApiResult>,
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setMessage("Bekræftelseslinket mangler eller er ugyldigt.");
      setState("error");
      return;
    }
    apiRequest("POST", "/api/auth/verify", { token })
      .then((response) => response.json() as Promise<ApiResult>)
      .then((data) => {
        setMessage(data.message ?? "Din e-mailadresse er bekræftet. Du kan logge ind nu.");
        setState("success");
      })
      .catch((error) => {
        setMessage(errorDetails(error, "E-mailadressen kunne ikke bekræftes.").message);
        setState("error");
      });
  }, [token]);

  return (
    <PublicLayout title="Bekræft e-mail" description="Vi bekræfter dit link, før du kan logge ind." testId="card-verify">
      {state === "loading" && (
        <div className="space-y-3" data-testid="skeleton-verify">
          <Skeleton className="h-5 w-3/4" /><Skeleton className="h-10 w-full" />
        </div>
      )}
      {state === "success" && (
        <SuccessCard message={message} testId="card-verify-success">
          <Button asChild className="mt-1 w-full"><Link href="/" data-testid="button-verify-login">Gå til login</Link></Button>
        </SuccessCard>
      )}
      {state === "error" && (
        <div className="space-y-4">
          <ErrorCard message={message} testId="card-verify-error" />
          <form onSubmit={(event) => { event.preventDefault(); resend.mutate(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="verify-resend-email">E-mail</Label>
              <Input id="verify-resend-email" data-testid="input-verify-resend-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="din@email.dk" />
            </div>
            {resend.isSuccess && <p className="text-sm text-muted-foreground" data-testid="text-verify-resend-message">{resend.data.message ?? "Hvis adressen mangler bekræftelse, har vi sendt en ny e-mail."}</p>}
            {resend.isError && <ErrorCard message={errorDetails(resend.error, "Kunne ikke sende en ny bekræftelse.").message} testId="card-verify-resend-error" />}
            <Button type="submit" variant="outline" className="w-full" data-testid="button-verify-resend" disabled={resend.isPending}>
              {resend.isPending ? "Sender..." : "Send ny bekræftelse"}
            </Button>
          </form>
        </div>
      )}
    </PublicLayout>
  );
}

export function Glemt() {
  const [email, setEmail] = useState("");
  const forgot = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/forgot", { email })).json() as Promise<ApiResult>,
  });

  return (
    <PublicLayout title="Glemt adgangskode" description="Indtast din e-mailadresse, så sender vi et link, hvis der findes en aktiv konto." testId="card-forgot">
      {forgot.isSuccess ? (
        <SuccessCard message={forgot.data.message ?? "Findes kontoen, er der sendt en e-mail."} testId="card-forgot-success">
          <DemoLink token={forgot.data.demoToken} to="/nulstil" testId="card-forgot-demo-link" />
        </SuccessCard>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); forgot.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">E-mail</Label>
            <Input id="forgot-email" data-testid="input-forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="din@email.dk" />
          </div>
          {forgot.isError && <ErrorCard message={errorDetails(forgot.error, "Kunne ikke behandle din anmodning.").message} testId="card-forgot-error" />}
          <Button type="submit" className="w-full" data-testid="button-forgot" disabled={forgot.isPending}>
            {forgot.isPending ? "Sender..." : "Send nulstillingslink"}
          </Button>
        </form>
      )}
    </PublicLayout>
  );
}

export function Nulstil() {
  const token = tokenFromHash();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/reset", { token, password })).json() as Promise<ApiResult>,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setLocalError("Nulstillingslinket mangler eller er ugyldigt.");
      return;
    }
    if (password !== repeatPassword) {
      setLocalError("Adgangskoderne er ikke ens.");
      return;
    }
    setLocalError(null);
    reset.mutate();
  };
  const resetError = reset.error ? errorDetails(reset.error, "Adgangskoden kunne ikke ændres.") : null;

  return (
    <PublicLayout title="Vælg ny adgangskode" description="Vælg en stærk adgangskode, du ikke bruger andre steder." testId="card-reset">
      {reset.isSuccess ? (
        <SuccessCard message={reset.data.message ?? "Adgangskoden er skiftet. Log ind med den nye kode."} testId="card-reset-success">
          <Button asChild className="mt-1 w-full"><Link href="/" data-testid="button-reset-login">Gå til login</Link></Button>
        </SuccessCard>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">Ny adgangskode</Label>
            <Input id="reset-password" data-testid="input-reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password-repeat">Gentag ny adgangskode</Label>
            <Input id="reset-password-repeat" data-testid="input-reset-password-repeat" type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} required autoComplete="new-password" />
          </div>
          {localError && <ErrorCard message={localError} testId="card-reset-local-error" />}
          {resetError && <ErrorCard message={resetError.message} problems={resetError.problems} testId="card-reset-error" />}
          <Button type="submit" className="w-full" data-testid="button-reset" disabled={reset.isPending}>
            {reset.isPending ? "Gemmer..." : "Gem ny adgangskode"}
          </Button>
        </form>
      )}
    </PublicLayout>
  );
}

export function Invitation() {
  const token = tokenFromHash();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const invitation = useQuery<InvitationInfo>({
    queryKey: ["/api/auth/invitation", token],
    queryFn: async () => (await apiRequest("GET", `/api/auth/invitation/${encodeURIComponent(token)}`)).json(),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (invitation.data?.name && !name) setName(invitation.data.name);
  }, [invitation.data?.name, name]);

  const accept = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/invitation", { token, name, password })).json() as Promise<ApiResult>,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== repeatPassword) {
      setLocalError("Adgangskoderne er ikke ens.");
      return;
    }
    setLocalError(null);
    accept.mutate();
  };
  const acceptError = accept.error ? errorDetails(accept.error, "Kontoen kunne ikke oprettes.") : null;
  const invitationError = !token
    ? "Invitationen mangler eller er ugyldig."
    : invitation.error ? errorDetails(invitation.error, "Invitationen kunne ikke hentes.").message : null;

  return (
    <PublicLayout title="Velkommen til ADD SmartRegnskab" description="Opret din adgang fra invitationen." testId="card-invitation">
      {!token || invitation.isError ? (
        <ErrorCard message={invitationError ?? "Invitationen er ugyldig eller udløbet."} testId="card-invitation-error" />
      ) : invitation.isLoading ? (
        <div className="space-y-3" data-testid="skeleton-invitation"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-20 w-full" /></div>
      ) : accept.isSuccess ? (
        <SuccessCard message={accept.data.message ?? "Din konto er oprettet. Log ind nu."} testId="card-invitation-success">
          <Button asChild className="mt-1 w-full"><Link href="/" data-testid="button-invitation-login">Gå til login</Link></Button>
        </SuccessCard>
      ) : invitation.data ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3" data-testid="card-invitation-details">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">Du er inviteret til {invitation.data.companyName ?? "virksomheden"}</p>
                <p className="mt-1 truncate text-muted-foreground" data-testid="text-invitation-email">{invitation.data.email}</p>
                <p className="mt-1 text-muted-foreground" data-testid="text-invitation-role">Rolle: {ROLE_LABELS[invitation.data.role] ?? invitation.data.role}</p>
              </div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invitation-name">Dit navn</Label>
              <Input id="invitation-name" data-testid="input-invitation-name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invitation-password">Adgangskode</Label>
              <Input id="invitation-password" data-testid="input-invitation-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invitation-password-repeat">Gentag adgangskode</Label>
              <Input id="invitation-password-repeat" data-testid="input-invitation-password-repeat" type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} required autoComplete="new-password" />
            </div>
            {localError && <ErrorCard message={localError} testId="card-invitation-local-error" />}
            {acceptError && <ErrorCard message={acceptError.message} problems={acceptError.problems} testId="card-invitation-submit-error" />}
            <Button type="submit" className="w-full" data-testid="button-invitation" disabled={accept.isPending}>
              {accept.isPending ? "Opretter konto..." : "Opret konto"}
            </Button>
          </form>
        </div>
      ) : (
        <ErrorCard message="Invitationen er ugyldig eller udløbet." testId="card-invitation-error" />
      )}
    </PublicLayout>
  );
}

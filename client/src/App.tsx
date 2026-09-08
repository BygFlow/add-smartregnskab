import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { RegnskabsPlatformShell } from "@/pages/regnskabs-shell";
import RegnskabLogin from "@/pages/regnskab-login";
import { Bekraeft, Glemt, Invitation, Nulstil, Tilmeld } from "@/pages/offentlig";

function useRouteLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const [location, navigate] = useHashLocation();
  return [location.split("?")[0] || "/", navigate];
}

function AccessDenied() {
  const { logout } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Ingen adgang til regnskabsplatformen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Denne konto har ikke en regnskabsrolle. Kontakt virksomhedens leder for at få korrekt adgang.
        </p>
        <Button className="mt-5" variant="outline" onClick={() => logout()}>Log ud</Button>
      </section>
    </main>
  );
}

function AuthenticatedApp() {
  const { user, company, companyId } = useAuth();
  const [location] = useRouteLocation();
  const role = user?.role ?? "";
  if (!["leder", "holdleder", "platform_admin", "regnskab_admin", "regnskab_bogfoerer"].includes(role)) return <AccessDenied />;
  if (!location.startsWith("/smartregnskab/app")) return <Redirect to="/smartregnskab/app" />;
  return (
    <RegnskabsPlatformShell
      user={user}
      companyId={companyId}
      role={role}
      companyName={company?.name || "ADD SmartRegnskab"}
    />
  );
}

function Root() {
  const { user } = useAuth();
  if (user) return <AuthenticatedApp />;
  return (
    <Switch>
      <Route path="/tilmeld" component={Tilmeld} />
      <Route path="/bekraeft" component={Bekraeft} />
      <Route path="/glemt" component={Glemt} />
      <Route path="/nulstil" component={Nulstil} />
      <Route path="/invitation" component={Invitation} />
      <Route component={RegnskabLogin} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router hook={useRouteLocation}>
              <Root />
            </Router>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

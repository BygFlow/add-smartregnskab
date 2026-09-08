import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import RegnskabLogin from "@/pages/regnskab-login";
import { RegnskabsPlatformShell } from "@/pages/regnskabs-shell";
import { Bekraeft, Glemt, Invitation, Nulstil, Tilmeld } from "@/pages/offentlig";

function useRouteLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const [location, navigate] = useHashLocation();
  return [location.split("?")[0] || "/", navigate];
}

function Root() {
  const { user, company, companyId } = useAuth();

  if (!user) {
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

  if (user.role === "assistent" || user.role === "kunde") {
    return (
      <main className="min-h-screen grid place-items-center bg-background p-6">
        <section className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Ingen adgang</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            SmartRegnskab kræver en leder- eller platformadministratorprofil.
          </p>
        </section>
      </main>
    );
  }

  return (
    <RegnskabsPlatformShell
      user={user}
      companyId={companyId}
      role={user.role}
      companyName={company?.name || "ADD SmartRegnskab"}
    />
  );
}

function App() {
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

export default App;

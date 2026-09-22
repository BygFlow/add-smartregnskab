import { lazy, Suspense } from "react";
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
import { Marketing } from "@/pages/marketing";

const Fagportal = lazy(() => import("@/pages/regnskab-tabs/fagportal"));

function useRouteLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const [location, navigate] = useHashLocation();
  return [location.split("?")[0] || "/", navigate];
}

function Root() {
  const { user, company, companyId, initializing } = useAuth();

  if (initializing) {
    return <main className="min-h-screen grid place-items-center bg-background"><p className="text-sm text-muted-foreground">Indlæser sikker session…</p></main>;
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={() => <Marketing page="home" />} />
        <Route path="/funktioner" component={() => <Marketing page="features" />} />
        <Route path="/priser" component={() => <Marketing page="pricing" />} />
        <Route path="/integrationer" component={() => <Marketing page="integrations" />} />
        <Route path="/sikkerhed" component={() => <Marketing page="security" />} />
        <Route path="/faq" component={() => <Marketing page="faq" />} />
        <Route path="/om" component={() => <Marketing page="about" />} />
        <Route path="/kontakt" component={() => <Marketing page="contact" />} />
        <Route path="/book-demo" component={() => <Marketing page="demo" />} />
        <Route path="/hjaelp" component={() => <Marketing page="help" />} />
        <Route path="/guides" component={() => <Marketing page="guides" />} />
        <Route path="/guide/bedre-oekonomioverblik" component={() => <Marketing page="guide" guideSlug="bedre-oekonomioverblik" />} />
        <Route path="/guide/guide-bilag-bogfoering" component={() => <Marketing page="guide" guideSlug="guide-bilag-bogfoering" />} />
        <Route path="/guide/professionelle-fakturaer" component={() => <Marketing page="guide" guideSlug="professionelle-fakturaer" />} />
        <Route path="/guide/fem-administrative-opgaver" component={() => <Marketing page="guide" guideSlug="fem-administrative-opgaver" />} />
        <Route path="/guide/regnskabsworkflow-mindre-virksomheder" component={() => <Marketing page="guide" guideSlug="regnskabsworkflow-mindre-virksomheder" />} />
        <Route path="/privatliv" component={() => <Marketing page="privacy" />} />
        <Route path="/vilkaar" component={() => <Marketing page="terms" />} />
        <Route path="/betaling-og-refusion" component={() => <Marketing page="payment" />} />
        <Route path="/databehandleraftale" component={() => <Marketing page="dpa" />} />
        <Route path="/underdatabehandlere" component={() => <Marketing page="subprocessors" />} />
        <Route path="/dataopbevaring-og-sletning" component={() => <Marketing page="retention" />} />
        <Route path="/abonnementsbetingelser" component={() => <Marketing page="subscriptionTerms" />} />
        <Route path="/cookies" component={() => <Marketing page="cookies" />} />
        <Route path="/regnskabsprogram-smaa-virksomheder" component={() => <Marketing page="landing" landingSlug="regnskabsprogram-smaa-virksomheder" />} />
        <Route path="/fakturaprogram-virksomheder" component={() => <Marketing page="landing" landingSlug="fakturaprogram-virksomheder" />} />
        <Route path="/bilag-og-bogfoering" component={() => <Marketing page="landing" landingSlug="bilag-og-bogfoering" />} />
        <Route path="/oekonomioverblik" component={() => <Marketing page="landing" landingSlug="oekonomioverblik" />} />
        <Route path="/regnskab-haandvaerkere" component={() => <Marketing page="landing" landingSlug="regnskab-haandvaerkere" />} />
        <Route path="/regnskab-servicevirksomheder" component={() => <Marketing page="landing" landingSlug="regnskab-servicevirksomheder" />} />
        <Route path="/login" component={RegnskabLogin} />
        <Route path="/tilmeld" component={Tilmeld} />
        <Route path="/bekraeft" component={Bekraeft} />
        <Route path="/glemt" component={Glemt} />
        <Route path="/nulstil" component={Nulstil} />
        <Route path="/invitation" component={Invitation} />
        <Route component={() => <Marketing page="home" />} />
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

  if (["bogholder", "revisor", "revisor_admin"].includes(user.role) && user.twoFactorEnabled !== 1) {
    return (
      <Suspense fallback={<main className="min-h-screen grid place-items-center bg-background"><p className="text-sm text-muted-foreground">Indlæser fagportal…</p></main>}>
        <main className="min-h-screen bg-background p-6"><Fagportal /></main>
      </Suspense>
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

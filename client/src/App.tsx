import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import DailyLog from "@/pages/DailyLog";
import History from "@/pages/History";
import { useStore } from "@/lib/store";
import { useEffect } from "react";

function Router() {
  const { hasAcceptedDisclaimer, isBaselineComplete } = useStore();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Basic route protection / redirection logic
    if (!hasAcceptedDisclaimer && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [hasAcceptedDisclaimer, location, setLocation]);

  // If we are in onboarding, render it without the app layout
  if (location === '/onboarding') {
    return (
      <Switch>
        <Route path="/onboarding" component={Onboarding} />
        <Route component={Onboarding} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/log" component={DailyLog} />
        <Route path="/history" component={History} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <>
      <Toaster />
      <Router />
    </>
  );
}

export default App;

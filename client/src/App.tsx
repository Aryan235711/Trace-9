import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import { AppLayout } from "@/components/layout/AppLayout";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import DailyLog from "@/pages/DailyLog";
import History from "@/pages/History";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/lib/store";
import { useEffect } from "react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasAcceptedDisclaimer } = useStore();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // If authenticated but haven't accepted disclaimer, go to onboarding
    if (isAuthenticated && !hasAcceptedDisclaimer && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [isAuthenticated, hasAcceptedDisclaimer, location, setLocation]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // If in onboarding, render it without app layout
  if (location === '/onboarding') {
    return (
      <Switch>
        <Route path="/onboarding" component={Onboarding} />
        <Route component={Onboarding} />
      </Switch>
    );
  }

  // Authenticated and past onboarding
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

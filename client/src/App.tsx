import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/lib/store";
import { Suspense, lazy, useEffect } from "react";

const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DailyLog = lazy(() => import("@/pages/DailyLog"));
const History = lazy(() => import("@/pages/History"));
const Upgrade = lazy(() => import("@/pages/Upgrade"));

function Router() {
  const { isAuthenticated, loading } = useAuth();
  const { hasAcceptedDisclaimer } = useStore();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // If authenticated but haven't accepted disclaimer, go to onboarding
    if (isAuthenticated && !hasAcceptedDisclaimer && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [isAuthenticated, hasAcceptedDisclaimer, location, setLocation]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-300">Loading...</div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-gray-300">Loading...</div></div>}>
        <Switch>
          <Route path="/" component={LoginPage} />
          <Route component={LoginPage} />
        </Switch>
      </Suspense>
    );
  }

  // If in onboarding, render it without app layout
  if (location === '/onboarding') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-gray-300">Loading...</div></div>}>
        <Switch>
          <Route path="/onboarding" component={Onboarding} />
          <Route component={Onboarding} />
        </Switch>
      </Suspense>
    );
  }

  // Authenticated and past onboarding
  return (
    <AppLayout>
      <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><div className="text-gray-300">Loading...</div></div>}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/log" component={DailyLog} />
          <Route path="/history" component={History} />
          <Route path="/upgrade" component={Upgrade} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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

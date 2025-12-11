import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            Trace-9
          </h1>
          <p className="text-xl text-gray-600">
            Health Self-Diagnostic Tool
          </p>
        </div>

        <div className="space-y-6 py-8">
          <p className="text-lg text-gray-700 max-w-xl mx-auto">
            Correlate your wearable data with lifestyle inputs to identify triggers 
            through visual clustering and automated hypothesis generation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <div className="text-3xl">📊</div>
              <div className="font-medium">Track 8 Metrics</div>
              <div className="text-xs">Sleep, HRV, RHR, Protein, Gut, Sun, Exercise, Symptoms</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">🎯</div>
              <div className="font-medium">3-Day Trend Rule</div>
              <div className="text-xs">Detect patterns through visual clustering</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">💡</div>
              <div className="font-medium">Auto-Hypothesis</div>
              <div className="text-xs">Get actionable insights automatically</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            data-testid="button-login"
            size="lg"
            className="rounded-2xl px-8 text-lg h-12"
            onClick={() => {
              window.location.href = "/api/login";
            }}
          >
            Log In to Start
          </Button>
          
          <p className="text-xs text-gray-500">
            Powered by Replit Auth
          </p>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";

async function openCheckout() {
  const checkoutUrl = (import.meta as any).env?.VITE_CHECKOUT_URL as string | undefined;
  if (!checkoutUrl) {
    alert("Checkout link not configured. Set VITE_CHECKOUT_URL in your environment.");
    return;
  }
  window.open(checkoutUrl, "_blank", "noopener,noreferrer");
}

const freeItems = [
  "Unlimited daily logging (all 9 metrics)",
  "Last 14 days fully readable",
  "1 insight per week (headline depth)",
  "1 intervention start per month; 1 active at a time",
  "Older history visible but locked",
];

const premiumItems = [
  "Full history + insights archive",
  "Full explanations: evidence, confidence, next step",
  "Unlimited interventions + comparisons",
  "Advanced charts and correlations",
  "CSV/PDF exports",
];

export default function Upgrade() {
  const { getAuthHeaders, refresh } = useAuth();
  const { plan } = useEntitlements();
  const [loading, setLoading] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const processedReturn = useRef(false);

  const activatePro = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      if (!res.ok) throw new Error('Upgrade failed');

      const data = await res.json();
      await refresh();
      setMessage(`Plan updated to ${data.plan ?? 'pro'}. Enjoy full access!`);
    } catch (error: any) {
      setMessage(error?.message || 'Upgrade failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downgrade = async () => {
    setDowngrading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error('Downgrade failed');
      const data = await res.json();
      await refresh();
      setMessage(`Plan updated to ${data.plan ?? 'free'}. Free tier restored.`);
    } catch (error: any) {
      setMessage(error?.message || 'Downgrade failed. Please try again.');
    } finally {
      setDowngrading(false);
    }
  };

  const isPro = plan === 'pro';

  // If we return from checkout with success=1, finalize upgrade and refresh plan
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const canceled = params.get('canceled');
    if (processedReturn.current) return;
    if (success === '1' && !isPro) {
      processedReturn.current = true;
      activatePro();
    } else if (canceled === '1') {
      processedReturn.current = true;
      setMessage('Checkout canceled. You can retry anytime.');
    }
  }, [isPro]);

  return (
    <div className="min-h-[70vh] px-4 py-8 flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <Badge variant="outline" className="text-xs uppercase tracking-wide">Premium</Badge>
        <h1 className="text-2xl font-semibold">Unlock full insights for ₹199 / 3 months</h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Same as a Netflix month, but invested consciously in your health. Keep free logging; upgrade to unlock depth: full history, deeper insights, unlimited experiments, comparisons, and exports.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Free • Habit Builder</CardTitle>
            <CardDescription>Stay unblocked while you build the logging habit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {freeItems.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Premium • ₹199 / 3 months</CardTitle>
            <CardDescription>Clarity, proof, and acceleration for your experiments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            {premiumItems.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-primary" />
                <span>{item}</span>
              </div>
            ))}
            <div className="pt-4 flex gap-2 flex-col sm:flex-row">
              <Button className="w-full" onClick={activatePro} disabled={loading || isPro}>
                {isPro ? 'You are Pro' : loading ? 'Activating…' : 'Activate Pro now'}
              </Button>
              <Button variant="outline" className="w-full" onClick={openCheckout} disabled={loading || downgrading}>
                Pay via checkout link
              </Button>
              <Button variant="ghost" className="w-full" onClick={downgrade} disabled={downgrading || !isPro}>
                {downgrading ? 'Reverting…' : 'Revert to Free for QA'}
              </Button>
            </div>
            {message && <p className="text-xs text-muted-foreground mt-2">{message}</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Data is never deleted. If premium expires, you keep logging and can read the last 14 days; older history stays visible but locked until you renew.
      </p>
    </div>
  );
}

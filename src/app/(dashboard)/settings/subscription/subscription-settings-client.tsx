"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { TrialBanner } from "@/components/subscription/trial-banner";
import { PricingCard } from "@/components/subscription/pricing-card";
import { toast } from "sonner";

export interface SubscriptionData {
  mode: "managed" | "self-hosted";
  subscription: {
    id: string;
    plan: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    isTrialing: boolean;
    trialDaysLeft: number;
  };
  limits: any;
  usage: {
    clients: { current: number; limit: number | null };
    activeProjects: { current: number; limit: number | null };
    invoicesPerMonth: { current: number; limit: number | null };
    emailsPerMonth: { current: number; limit: number | null };
    paymentLinksPerMonth: { current: number; limit: number | null };
    recurringTemplates: { current: number; limit: number | null };
    sowTemplates: { current: number; limit: number | null };
  };
}

export function SubscriptionSettingsClient({ isSelfHosted }: { isSelfHosted: boolean }) {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing: "MONTHLY" }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error(error);
      toast.error("Failed to initiate checkout");
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/subscription")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load subscription data");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (isSelfHosted) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Self-Hosted Edition</CardTitle>
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Unlimited</Badge>
          </div>
          <CardDescription>
            You are running ProjectBill in self-hosted mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">
            Because you are hosting this application on your own infrastructure and managing your own API keys (Resend, Mayar, etc.), all features and resources are completely unrestricted.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Unlimited Clients & Projects</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Unlimited Emails & Invoices</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Unlimited Payment Links</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">PDF Auto-Delivery</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="pt-6">
          <p className="text-red-600 dark:text-red-400">Failed to load subscription data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const { subscription, usage } = data;
  const isStarter = subscription.plan === "starter";
  const isPro = subscription.plan === "pro";
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const UsageBar = ({ label, current, limit, isMonthly = false }: { label: string, current: number, limit: number | null, isMonthly?: boolean }) => {
    const isUnlimited = limit === null || limit === undefined || limit > 999999;
    const percentage = isUnlimited ? 0 : Math.min(100, (current / limit!) * 100);
    const isNearLimit = !isUnlimited && percentage >= 80;
    const isAtLimit = !isUnlimited && percentage >= 100;

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{label} {isMonthly && <span className="text-muted-foreground text-xs font-normal">(Resets monthly)</span>}</span>
          <span className={`${isAtLimit ? 'text-red-500 font-bold' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
            {current} / {isUnlimited ? "∞" : limit}
          </span>
        </div>
        {!isUnlimited ? (
          <Progress value={percentage} className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`} />
        ) : (
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-full opacity-50" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {subscription.isTrialing && (
        <TrialBanner daysLeft={subscription.trialDaysLeft} />
      )}

      {/* Current Plan Card */}
      <Card className={isPro ? "border-primary shadow-sm" : ""}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl capitalize flex items-center gap-2">
                {subscription.plan} Plan
                {isPro && <Badge variant="default" className="ml-2">Most Popular</Badge>}
                {isStarter && <Badge variant="secondary" className="ml-2">Free</Badge>}
              </CardTitle>
              <CardDescription>
                {subscription.status === "ACTIVE" 
                  ? `Active until ${formatDate(subscription.currentPeriodEnd)}`
                  : `Status: ${subscription.status}`
                }
              </CardDescription>
            </div>
            {isStarter && (
              <Button onClick={() => handleCheckout("pro")} disabled={checkoutLoading}>
                {checkoutLoading ? "Processing..." : "Upgrade to Pro"}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Usage Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Allowances</CardTitle>
            <CardDescription>Resources that reset at the beginning of each billing cycle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageBar label="Emails Sent" current={usage.emailsPerMonth.current} limit={usage.emailsPerMonth.limit} isMonthly />
            <UsageBar label="Invoices Created" current={usage.invoicesPerMonth.current} limit={usage.invoicesPerMonth.limit} isMonthly />
            <UsageBar label="Payment Links Generated" current={usage.paymentLinksPerMonth.current} limit={usage.paymentLinksPerMonth.limit} isMonthly />
          </CardContent>
        </Card>

        {/* Static Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workspace Limits</CardTitle>
            <CardDescription>Maximum number of active records across your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageBar label="Total Clients" current={usage.clients.current} limit={usage.clients.limit} />
            <UsageBar label="Active Projects" current={usage.activeProjects.current} limit={usage.activeProjects.limit} />
            <UsageBar label="Recurring Templates" current={usage.recurringTemplates.current} limit={usage.recurringTemplates.limit} />
            <UsageBar label="SOW Templates" current={usage.sowTemplates.current} limit={usage.sowTemplates.limit} />
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <div className="pt-8" id="plans">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Upgrade Plan</h2>
          <p className="text-muted-foreground text-sm">Select the best plan for your growing business.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PricingCard
            plan="starter"
            title="Starter"
            description="For freelancers just starting out."
            price={0}
            features={["Up to 5 Clients", "Up to 5 Active Projects", "Basic Built-in Templates"]}
            ctaText={subscription.plan === "starter" ? "Current Plan" : "Downgrade"}
            loading={checkoutLoading}
            onCtaClick={() => handleCheckout("starter")}
          />
          <PricingCard
            plan="pro"
            title="Pro"
            description="Perfect for growing teams."
            price={79000}
            isPopular={true}
            highlight={true}
            features={["Unlimited Clients & Projects", "Unlimited Invoices", "Automated PDF Delivery", "No Watermark"]}
            ctaText={subscription.plan === "pro" && !subscription.isTrialing ? "Current Plan" : "Upgrade to Pro"}
            loading={checkoutLoading}
            onCtaClick={() => handleCheckout("pro")}
          />
          <PricingCard
            plan="business"
            title="Business"
            description="For agencies requiring scale."
            price={179000}
            features={["Include all Pro features", "Up to 15 Team Members", "Priority Support", "Advanced Analytics"]}
            ctaText={subscription.plan === "business" ? "Current Plan" : "Upgrade to Business"}
            loading={checkoutLoading}
            onCtaClick={() => handleCheckout("business")}
          />
        </div>
      </div>
    </div>
  );
}

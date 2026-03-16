"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

export function SubscriptionSettingsClient({ isSelfHosted }: { isSelfHosted: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const UsageBar = ({ label, current, limit, isMonthly = false }: { label: string, current: number, limit: number, isMonthly?: boolean }) => {
    const isUnlimited = limit === null || limit === undefined || limit > 999999;
    const percentage = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
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
                {subscription.status === "active" 
                  ? `Active until ${formatDate(subscription.currentPeriodEnd)}`
                  : `Status: ${subscription.status}`
                }
              </CardDescription>
            </div>
            {isStarter && (
              <Button onClick={() => window.open('mailto:mrndev@example.com?subject=Upgrade to Pro', '_blank')}>
                Upgrade to Pro
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
    </div>
  );
}

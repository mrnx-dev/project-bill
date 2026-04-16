import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SubscriptionSettingsClient } from "./subscription-settings-client";
import { isSelfHosted } from "@/lib/billing/subscription";

export default async function SubscriptionSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Allow all users to see this page so they know their limits.
  // We don't restrict this to admin only.

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your plan, view usage limits, and see billing details.
        </p>
      </div>

      <SubscriptionSettingsClient isSelfHosted={isSelfHosted()} />
    </div>
  );
}

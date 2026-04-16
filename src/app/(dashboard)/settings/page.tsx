import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SettingsFormClient } from "./settings-form-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Server-side role check — always reads fresh from JWT, no client cache issues
  if (session.user.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 mt-12">
        <h2 className="text-2xl font-bold tracking-tight text-red-500">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You do not have the required administrative permissions to view or modify application settings.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return <SettingsFormClient />;
}

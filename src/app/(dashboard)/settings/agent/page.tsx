import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AgentSettingsClient } from "./agent-settings-client";

export default async function AgentSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = session.user.activeOrganizationRole;

  if (role !== "OWNER" && role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 mt-12">
        <h2 className="text-2xl font-bold tracking-tight text-red-500">
          Access Denied
        </h2>
        <p className="text-muted-foreground text-center max-w-md">
          You do not have the required permissions to manage AI agent
          settings. Only owners and admins can access this page.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return <AgentSettingsClient />;
}
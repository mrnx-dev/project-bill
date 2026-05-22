import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TeamClient } from "./team-client";

export default async function TeamPage() {
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
          You do not have the required permissions to manage team
          settings. Only owners and admins can access this page.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground mt-2">
          Manage team members and their roles in this organization.
        </p>
      </div>

      <TeamClient orgId={session.user.activeOrganizationId!} />
    </div>
  );
}

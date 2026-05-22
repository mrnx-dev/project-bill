import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OrganizationSettingsForm } from "./organization-settings-form";

export const metadata = {
  title: "Organization Settings",
};

export default async function OrganizationSettingsPage() {
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
          You do not have the required permissions to manage organization
          settings. Only owners and admins can access this page.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const orgId = session.user.activeOrganizationId;

  if (!orgId) {
    redirect("/");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  if (!organization) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization name and danger zone actions.
        </p>
      </div>

      <OrganizationSettingsForm organization={organization} />
    </div>
  );
}
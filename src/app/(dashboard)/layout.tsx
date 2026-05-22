import type { Metadata } from "next";
import "@/app/globals.css";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SwipeSidebarHandler } from "@/components/swipe-sidebar-handler";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { OnboardingModal } from "@/components/onboarding-modal";
import { AIFloatingChat } from "@/components/ai/ai-floating-chat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ProjectBill",
  description: "Self-hosted invoicing and project tracking",
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const orgId = session.user.activeOrganizationId;
  if (!orgId) {
    redirect("/onboarding/organization");
  }

  // Verify user still has access to active org
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    include: { organization: true },
  });

  if (!membership || membership.organization.deletedAt) {
    // User lost access or org was deleted — find next available org
    const nextOrg = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organization: { deletedAt: null },
      },
      include: { organization: true },
      orderBy: { joinedAt: "asc" },
    });

    if (!nextOrg) {
      redirect("/onboarding/organization");
    }

    // Auto-switch to next available org via switch endpoint
    redirect(`/api/organizations/${nextOrg.organizationId}/switch?auto=true`);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, onboardingCompleted: true },
  });

  const settings = await prisma.settings.findFirst({
    where: { organizationId: orgId },
  });

  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <SidebarProvider>
      <SwipeSidebarHandler />
      <AppSidebar
        user={dbUser || session.user}
        company={settings || undefined}
        organizations={memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          logoUrl: m.organization.logoUrl,
          role: m.role,
        }))}
        activeOrgId={orgId}
        activeRole={membership.role}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6 lg:gap-8">
          {children}
        </main>
      </SidebarInset>

      {dbUser && dbUser.onboardingCompleted === false && (
        <OnboardingModal
          isOpen={true}
          userName={dbUser.name}
          existingSettings={settings ? {
            companyName: settings.companyName || "",
            companyAddress: settings.companyAddress || "",
            companyEmail: settings.companyEmail || "",
            senderEmail: settings.senderEmail || "",
            companyLogoUrl: settings.companyLogoUrl || "",
            companyWhatsApp: settings.companyWhatsApp || "",
            bankName: settings.bankName || "",
            bankAccountName: settings.bankAccountName || "",
            bankAccountNumber: settings.bankAccountNumber || "",
            resendApiKey: settings.resendApiKey || "",
            mayarApiKey: settings.mayarApiKey || "",
            mayarWebhookSecret: settings.mayarWebhookSecret || "",
          } : undefined}
          existingClients={clients}
        />
      )}
      <AIFloatingChat />
    </SidebarProvider>
  );
}

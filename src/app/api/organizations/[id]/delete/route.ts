import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendExportReadyEmail } from "@/lib/email";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: id } },
    });
    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can delete an organization" }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (org.deletedAt) return NextResponse.json({ error: "Organization is already scheduled for deletion" }, { status: 400 });

    await prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } });

    // Delete the organization's subscription
    await prisma.subscription.deleteMany({
      where: { organizationId: id },
    });

    // Notify all members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: { user: { select: { email: true, name: true } } },
    });
    for (const m of members) {
      const { sendOrgDeletionEmail } = await import("@/lib/email");
      sendOrgDeletionEmail({ to: m.user.email, orgName: org.name, organizationId: id }).catch(console.error);
    }

    return NextResponse.json({ success: true, message: "Organization scheduled for deletion" });
  } catch (error) {
    console.error("Failed to delete org:", error);
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }
}

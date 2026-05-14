import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id: projectId, milestoneId } = await params;
    const orgId = session.user.activeOrganizationId!;

    const milestone = await prisma.paymentMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId: orgId },
      include: { invoice: true },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status !== "INVOICED") {
      return NextResponse.json(
        { error: "Can only un-approve INVOICED milestones" },
        { status: 400 },
      );
    }

    // Only allow un-approve if invoice is UNPAID
    if (milestone.invoice && milestone.invoice.status !== "UNPAID") {
      return NextResponse.json(
        { error: "Cannot un-approve milestone with a paid invoice" },
        { status: 400 },
      );
    }

    // Delete the invoice and rollback milestone
    if (milestone.invoiceId) {
      await prisma.invoice.delete({ where: { id: milestone.invoiceId } });
    }

    const updated = await prisma.paymentMilestone.update({
      where: { id: milestoneId, organizationId: orgId },
      data: { status: "PENDING", invoiceId: null },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to un-approve milestone:", error);
    return NextResponse.json({ error: "Failed to un-approve" }, { status: 500 });
  }
}

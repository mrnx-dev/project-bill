import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

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
      include: { invoice: { select: { id: true, status: true } } },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status === "PAID") {
      return NextResponse.json({ error: "Already marked as paid" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Mark milestone as PAID
      const m = await tx.paymentMilestone.update({
        where: { id: milestoneId, organizationId: orgId },
        data: { status: "PAID" },
      });

      // Also mark the linked invoice as paid if it exists
      if (milestone.invoiceId) {
        await tx.invoice.update({
          where: { id: milestone.invoiceId, organizationId: orgId },
          data: { status: "paid", paidAt: new Date() },
        });
      }

      return m;
    });

    await createAuditLog({
      userId: session.user.id,
      action: "milestone.mark_paid",
      entityType: "MILESTONE",
      entityId: milestoneId,
      newValue: milestone.status + " → PAID",
      organizationId: orgId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to mark milestone paid:", error);
    return NextResponse.json({ error: "Failed to mark paid" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id: projectId, milestoneId } = await params;
    const orgId = session.user.activeOrganizationId!;
    const json = await request.json();

    const existing = await prisma.paymentMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    // Validate percentage if changing
    if (json.percentage !== undefined) {
      const pct = parseFloat(json.percentage);
      const existingSum = await prisma.paymentMilestone.aggregate({
        where: { projectId, organizationId: orgId, id: { not: milestoneId } },
        _sum: { percentage: true },
      });
      const otherTotal = Number(existingSum._sum.percentage || 0);
      if (otherTotal + pct > 100) {
        return NextResponse.json(
          { error: `Total percentage would exceed 100%` },
          { status: 400 },
        );
      }

      const project = await prisma.project.findFirst({
        where: { id: projectId },
        select: { totalPrice: true },
      });
      json.amount = (Number(project!.totalPrice) * pct) / 100;
    }

    const milestone = await prisma.paymentMilestone.update({
      where: { id: milestoneId, organizationId: orgId },
      data: json,
    });

    return NextResponse.json(milestone);
  } catch (error) {
    console.error("Failed to update milestone:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id: projectId, milestoneId } = await params;
    const orgId = session.user.activeOrganizationId!;

    const existing = await prisma.paymentMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING milestones can be deleted" },
        { status: 400 },
      );
    }

    await prisma.paymentMilestone.delete({
      where: { id: milestoneId, organizationId: orgId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete milestone:", error);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}

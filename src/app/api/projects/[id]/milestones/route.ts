import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id: projectId } = await params;
    const orgId = session.user.activeOrganizationId!;
    const json = await request.json();
    const { name, percentage, dueDate } = json;

    if (!name || percentage === undefined) {
      return NextResponse.json(
        { error: "Name and percentage are required" },
        { status: 400 },
      );
    }

    const pct = parseFloat(percentage);
    if (pct <= 0 || pct > 100) {
      return NextResponse.json(
        { error: "Percentage must be between 0 and 100" },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { totalPrice: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Validate total percentage doesn't exceed 100
    const existingSum = await prisma.paymentMilestone.aggregate({
      where: { projectId, organizationId: orgId },
      _sum: { percentage: true },
    });

    const currentTotal = Number(existingSum._sum.percentage || 0);
    if (currentTotal + pct > 100) {
      return NextResponse.json(
        { error: `Total percentage would be ${currentTotal + pct}%, cannot exceed 100%` },
        { status: 400 },
      );
    }

    const amount = (Number(project.totalPrice) * pct) / 100;
    const maxSort = await prisma.paymentMilestone.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });

    const milestone = await prisma.paymentMilestone.create({
      data: {
        projectId,
        name,
        percentage: pct,
        amount,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        organizationId: orgId,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: "milestone.create",
      entityType: "MILESTONE",
      entityId: milestone.id,
      newValue: name,
      organizationId: orgId,
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    console.error("Failed to create milestone:", error);
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id: projectId } = await params;
    const orgId = session.user.activeOrganizationId!;

    const milestones = await prisma.paymentMilestone.findMany({
      where: { projectId, organizationId: orgId },
      orderBy: { sortOrder: "asc" },
      include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
    });

    return NextResponse.json(milestones);
  } catch (error) {
    console.error("Failed to fetch milestones:", error);
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }
}

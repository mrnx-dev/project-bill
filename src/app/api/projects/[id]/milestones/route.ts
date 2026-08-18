import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { milestonePlanSchema } from "@/lib/validations/milestone";
import { computeMilestoneAmounts } from "@/lib/milestone-utils";
import { createAuditLog } from "@/lib/audit-logger";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const orgId = session.user.activeOrganizationId!;
    const { id: projectId } = await params;

    const json = await request.json();
    const parsed = milestonePlanSchema.safeParse(json.milestones);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId, organizationId: orgId },
      include: { milestones: true, invoices: true },
    });
    if (!project) return new NextResponse("Not Found", { status: 404 });
    if (project.billingMode !== "MILESTONE") {
      return NextResponse.json({ error: "Project is not in MILESTONE billing mode" }, { status: 400 });
    }

    // Plan lock: cannot edit once any milestone is INVOICED.
    const invoiced = await prisma.paymentMilestone.findFirst({
      where: { projectId, status: "INVOICED" },
      select: { id: true },
    });
    if (invoiced) {
      return NextResponse.json(
        { error: "Milestone plan is locked after the first invoice is issued." },
        { status: 403 },
      );
    }

    const computed = computeMilestoneAmounts(parsed.data, Number(project.totalPrice));

    await prisma.$transaction(async (tx) => {
      await tx.paymentMilestone.deleteMany({ where: { projectId } });
      await tx.paymentMilestone.createMany({
        data: computed.map((m, i) => ({
          projectId,
          organizationId: orgId,
          name: m.name,
          percentage: m.percentage,
          amount: m.amount,
          dueDate: m.dueDate ? new Date(m.dueDate) : null,
          order: m.order ?? i,
          status: "PLANNED",
        })),
      });
    });

    await createAuditLog({
      userId: session.user.id,
      organizationId: orgId,
      action: "milestone_plan_created",
      entityType: "Project",
      entityId: projectId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save milestone plan:", error);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}

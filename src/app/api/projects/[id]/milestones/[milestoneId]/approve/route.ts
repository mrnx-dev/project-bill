import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInvoiceNumber } from "@/lib/invoice-utils";
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
      include: { project: { select: { title: true } } },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot approve milestone in ${milestone.status} status` },
        { status: 400 },
      );
    }

    // Auto-generate invoice
    const invoiceNumber = await generateInvoiceNumber(orgId);
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        projectId,
        type: "MILESTONE",
        amount: milestone.amount,
        notes: `${milestone.project.title} — Milestone: ${milestone.name}`,
        dueDate: milestone.dueDate || defaultDueDate,
        status: "UNPAID",
        organizationId: orgId,
      },
    });

    const updated = await prisma.paymentMilestone.update({
      where: { id: milestoneId, organizationId: orgId },
      data: {
        status: "INVOICED",
        invoiceId: invoice.id,
      },
      include: { invoice: true },
    });

    await createAuditLog({
      userId: session.user.id,
      action: "milestone.approve",
      entityType: "MILESTONE",
      entityId: milestoneId,
      newValue: `Approved → Invoice ${invoiceNumber}`,
      organizationId: orgId,
    });

    return NextResponse.json({ milestone: updated, invoice });
  } catch (error) {
    console.error("Failed to approve milestone:", error);
    return NextResponse.json({ error: "Failed to approve milestone" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInvoiceNumber } from "@/lib/invoice-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const orgId = session.user.activeOrganizationId!;
    const { id: projectId, mid: milestoneId } = await params;

    const milestone = await prisma.paymentMilestone.findUnique({
      where: { id: milestoneId },
      include: { project: { include: { client: true } } },
    });
    if (!milestone || milestone.organizationId !== orgId || milestone.projectId !== projectId) {
      return new NextResponse("Not Found", { status: 404 });
    }
    if (milestone.project.billingMode !== "MILESTONE") {
      return NextResponse.json({ error: "Project is not in MILESTONE mode" }, { status: 400 });
    }
    if (milestone.status !== "PLANNED") {
      return new NextResponse("Milestone already invoiced", { status: 409 });
    }

    const { checkOrgLimit, incrementOrgUsage } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(orgId, "invoicesPerMonth");
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: "Plan limit reached", limitCheck }, { status: 403 });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const invoiceNumber = await generateInvoiceNumber(orgId);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          organizationId: orgId,
          invoiceNumber,
          projectId,
          type: "MILESTONE",
          amount: milestone.amount,
          notes: `Milestone: ${milestone.name}`,
          status: "UNPAID",
          dueDate,
        },
      });
      await tx.paymentMilestone.update({
        where: { id: milestoneId },
        data: { invoiceId: inv.id, status: "INVOICED" },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: orgId,
          action: "milestone_invoiced",
          entityType: "PaymentMilestone",
          entityId: milestoneId,
          newValue: inv.id,
        },
      });
      return inv;
    });

    await incrementOrgUsage(orgId, "invoicesCreated");

    // Soft-fail email (same pattern as the existing generate route)
    if (milestone.project.client?.email) {
      try {
        const { sendInvoiceEmail } = await import("@/app/actions/send-invoice");
        await sendInvoiceEmail(invoice.id, true);
      } catch (err) {
        console.error("Milestone invoice email failed non-fatally", err);
      }
    }

    return NextResponse.json({ invoice, milestone: { ...milestone, status: "INVOICED", invoiceId: invoice.id } });
  } catch (error) {
    console.error("Failed to tagih milestone:", error);
    return NextResponse.json({ error: "Failed to create milestone invoice" }, { status: 500 });
  }
}

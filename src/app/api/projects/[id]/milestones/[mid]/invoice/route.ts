import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { generateInvoiceNumber } from "@/lib/invoice-utils";

export const POST = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const userId = tenant.userId;
    const { id: projectId, mid: milestoneId } = await ctx.params as { id: string; mid: string };

    const milestone = await tx.paymentMilestone.findUnique({
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

    // Atomic via the withTenantRls request transaction (GUC set → DB-RLS scopes
    // the invoice/milestone/auditLog writes to this org; data carries organizationId = GUC).
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
        userId,
        organizationId: orgId,
        action: "milestone_invoiced",
        entityType: "PaymentMilestone",
        entityId: milestoneId,
        newValue: inv.id,
      },
    });

    await incrementOrgUsage(orgId, "invoicesCreated");

    // Soft-fail email (same pattern as the existing generate route)
    if (milestone.project.client?.email) {
      try {
        const { sendInvoiceEmail } = await import("@/app/actions/send-invoice");
        await sendInvoiceEmail(inv.id, true);
      } catch (err) {
        console.error("Milestone invoice email failed non-fatally", err);
      }
    }

    return NextResponse.json({ invoice: inv, milestone: { ...milestone, status: "INVOICED", invoiceId: inv.id } });
  } catch (error) {
    console.error("Failed to tagih milestone:", error);
    return NextResponse.json({ error: "Failed to create milestone invoice" }, { status: 500 });
  }
});
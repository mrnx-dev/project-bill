import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";
import { createNotification } from "@/lib/notifications";
import { formatMoney } from "@/lib/currency";

export const POST = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    if (tenant.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const orgId = tenant.organizationId;
    const userId = tenant.userId;
    const id = (await ctx.params).id as string;

    // Check if invoice exists and is unpaid
    const existingInvoice = await tx.invoice.findUnique({
      where: { id, organizationId: orgId },
      include: {
        project: { include: { client: true } },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (existingInvoice.status === "PAID") {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
    }

    const { project } = existingInvoice;
    const { client } = project;

    const amountStr = formatMoney(Number(existingInvoice.amount), project.currency || "IDR");

    // Update the invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    // Create Audit Log (global prisma helper — app-layer scoped via rlsContext)
    await createAuditLog({
      userId,
      organizationId: orgId,
      action: "INVOICE_MARKED_PAID_MANUALLY",
      title: `${existingInvoice.invoiceNumber} (${project.title})`,
      entityType: "INVOICE",
      entityId: id,
      oldValue: "UNPAID",
      newValue: "PAID",
    }).catch(console.error);

    // Create Notification (global prisma helper)
    await createNotification({
      title: `Invoice Paid (Manual)`,
      message: `Manual payment received for invoice ${existingInvoice.invoiceNumber} (${client.name} - ${project.title}) amounting to ${amountStr}.`,
      type: "payment",
      linkUrl: `/invoices/${id}`,
      organizationId: orgId,
    }).catch(console.error);

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error("Failed to mark invoice as paid:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
});
import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";

export const PATCH = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const resolvedParams = await ctx.params;
    const id = resolvedParams.id as string;
    const json = await request.json();
    const { status, cancelAtPeriodEnd } = json;

    const invoice = await tx.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: { project: { include: { client: true } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;

    const updated = await tx.invoice.update({
      where: { id, organizationId: orgId },
      data: updateData,
      include: { project: { include: { client: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
});

export const DELETE = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const userId = tenant.userId;
    const resolvedParams = await ctx.params;
    const id = resolvedParams.id as string;

    const invoice = await tx.invoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await tx.invoice.delete({ where: { id, organizationId: orgId } });

    await createAuditLog({
      userId,
      action: "invoice.delete",
      entityType: "INVOICE",
      entityId: id,
      oldValue: invoice.invoiceNumber,
      organizationId: orgId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
});
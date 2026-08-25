import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const PUT = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const id = (await ctx.params).id as string;
    const json = await request.json();

    const existing = await tx.recurringInvoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    }

    const updated = await tx.recurringInvoice.update({
      where: { id, organizationId: orgId },
      data: json,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update recurring invoice:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
});

export const DELETE = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const id = (await ctx.params).id as string;

    const existing = await tx.recurringInvoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    }

    await tx.recurringInvoice.update({
      where: { id, organizationId: orgId },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to deactivate recurring invoice:", error);
    return NextResponse.json({ error: "Failed to deactivate" }, { status: 500 });
  }
});
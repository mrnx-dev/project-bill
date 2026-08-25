import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";

export const PATCH = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const userId = tenant.userId;
    const resolvedParams = await ctx.params;
    const id = resolvedParams.id as string;
    const json = await request.json();
    const { name, email, phone } = json;

    const existing = await tx.client.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = await tx.client.update({
      where: { id, organizationId: orgId },
      data: { name, email, phone },
    });

    await createAuditLog({
      userId,
      action: "client.update",
      entityType: "CLIENT",
      entityId: id,
      oldValue: existing?.name || undefined,
      newValue: name || undefined,
      organizationId: orgId,
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Failed to update client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 },
    );
  }
});

export const DELETE = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const userId = tenant.userId;
    const resolvedParams = await ctx.params;
    const id = resolvedParams.id as string;

    const clientWithInvoices = await tx.client.findFirst({
      where: { id, organizationId: orgId },
      include: {
        projects: {
          include: { invoices: true },
        },
      },
    });

    if (!clientWithInvoices) {
      return new NextResponse(null, { status: 404 });
    }

    const hasPaidInvoices = clientWithInvoices.projects.some((project) =>
      project.invoices.some((invoice) => invoice.status === "PAID"),
    );

    if (hasPaidInvoices) {
      await tx.client.update({
        where: { id, organizationId: orgId },
        data: { isArchived: true },
      });
    } else {
      await tx.client.delete({
        where: { id, organizationId: orgId },
      });
    }

    await createAuditLog({
      userId,
      action: hasPaidInvoices ? "client.archive" : "client.delete",
      entityType: "CLIENT",
      entityId: id,
      oldValue: clientWithInvoices.name,
      organizationId: orgId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 },
    );
  }
});
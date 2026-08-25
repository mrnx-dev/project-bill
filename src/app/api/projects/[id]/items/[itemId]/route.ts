import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const DELETE = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const { id: projectId, itemId } = await ctx.params as { id: string; itemId: string };

    const item = await tx.projectItem.findUnique({
      where: { id: itemId, organizationId: orgId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.projectId !== projectId) {
      return NextResponse.json(
        { error: "Item does not belong to this project" },
        { status: 403 },
      );
    }

    const project = await tx.project.findUnique({
      where: { id: projectId, organizationId: orgId },
      include: { invoices: true },
    });

    if (project?.invoices && project.invoices.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete items. Invoices have already been generated for this project.",
        },
        { status: 403 },
      );
    }

    // Atomic via the withTenantRls request transaction.
    await tx.projectItem.delete({ where: { id: itemId } });
    const updatedProject = await tx.project.update({
      where: { id: projectId, organizationId: orgId },
      data: { totalPrice: { decrement: item.price } },
    });

    return NextResponse.json(
      { success: true, projectTotal: updatedProject.totalPrice },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to delete project item:", error);
    return NextResponse.json(
      { error: "Failed to delete project item" },
      { status: 500 },
    );
  }
});
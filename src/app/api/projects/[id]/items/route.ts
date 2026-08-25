import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const POST = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const projectId = (await ctx.params).id as string;
    const json = await request.json();
    const { description, price } = json;

    if (!description || price === undefined) {
      return NextResponse.json(
        { error: "Description and price are required" },
        { status: 400 },
      );
    }

    const numericPrice = parseFloat(price);

    let parsedQuantity = null;
    let parsedRate = null;

    if (json.quantity !== undefined && json.rate !== undefined && json.rate !== "") {
      parsedQuantity = parseFloat(json.quantity);
      parsedRate = parseFloat(json.rate);
    }

    // 1. Check if the project exists
    const project = await tx.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      include: { invoices: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Phase 4: Mechanism for Price/Scope Immutability
    // Assert that the parent project does not have any generated invoices.
    if (project.invoices && project.invoices.length > 0) {
      return NextResponse.json(
        { error: "Cannot modify scope. Invoices have already been generated for this project." },
        { status: 403 },
      );
    }

    // 2. Insert the item and update the project's tracked price atomically
    // (atomic via the withTenantRls request transaction)
    const newItem = await tx.projectItem.create({
      data: {
        organizationId: orgId,
        projectId,
        description,
        price: numericPrice,
        ...(parsedQuantity !== null ? { quantity: parsedQuantity } : {}),
        ...(parsedRate !== null ? { rate: parsedRate } : {}),
      },
    });
    const updatedProject = await tx.project.update({
      where: { id: projectId, organizationId: orgId },
      data: {
        totalPrice: { increment: numericPrice },
      },
    });

    return NextResponse.json(
      { item: newItem, projectTotal: updatedProject.totalPrice },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to add project item:", error);
    return NextResponse.json(
      { error: "Failed to add project item" },
      { status: 500 },
    );
  }
});
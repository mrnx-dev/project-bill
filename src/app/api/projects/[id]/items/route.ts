import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const { id: projectId } = await params;
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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

    // 2. Insert the item and update the project's totally tracked price atomically
    const [newItem, updatedProject] = await prisma.$transaction([
      prisma.projectItem.create({
        data: {
          projectId,
          description,
          price: numericPrice,
          ...(parsedQuantity !== null ? { quantity: parsedQuantity } : {}),
          ...(parsedRate !== null ? { rate: parsedRate } : {})
        },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: {
          totalPrice: {
            increment: numericPrice,
          },
        },
      }),
    ]);

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
}

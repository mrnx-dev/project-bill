import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const { id: projectId, itemId } = await params;

    const item = await prisma.projectItem.findUnique({
      where: { id: itemId },
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { invoices: true },
    });

    if (
      project?.invoices.some((i) => i.type === "full_payment" && i.paymentLink)
    ) {
      return NextResponse.json(
        {
          error: "Cannot delete items. An invoice has already been generated.",
        },
        { status: 403 },
      );
    }

    // Attempt to delete and subtract from total price
    const [, updatedProject] = await prisma.$transaction([
      prisma.projectItem.delete({
        where: { id: itemId },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: {
          totalPrice: {
            decrement: item.price,
          },
        },
      }),
    ]);

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
}

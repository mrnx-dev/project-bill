import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const json = await request.json();
    const {
      title,
      clientId,
      totalPrice,
      dpAmount,
      status,
      currency,
      deadline,
      terms,
    } = json;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (totalPrice !== undefined)
      updateData.totalPrice = parseFloat(totalPrice);
    if (dpAmount !== undefined)
      updateData.dpAmount = dpAmount ? parseFloat(dpAmount) : null;
    if (status !== undefined) updateData.status = status;
    if (currency !== undefined) updateData.currency = currency;
    if (deadline !== undefined)
      updateData.deadline = deadline ? new Date(deadline) : null;
    if (terms !== undefined) updateData.terms = terms ? terms : null;

    // Validate DP does not exceed totalPrice
    if (
      updateData.totalPrice !== undefined ||
      updateData.dpAmount !== undefined
    ) {
      const existing = await prisma.project.findUnique({ where: { id } });
      if (existing) {
        const effectiveTotal =
          updateData.totalPrice ?? Number(existing.totalPrice);
        const effectiveDp =
          updateData.dpAmount !== undefined
            ? updateData.dpAmount
            : existing.dpAmount
              ? Number(existing.dpAmount)
              : null;
        if (effectiveDp !== null && effectiveDp > effectiveTotal) {
          return NextResponse.json(
            { error: "DP amount cannot exceed total price" },
            { status: 400 },
          );
        }
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: { client: true, invoices: true },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Check for unpaid invoices
    const project = await prisma.project.findUnique({
      where: { id },
      include: { invoices: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const hasUnpaidInvoices = project.invoices.some(
      (inv) => inv.status === "unpaid",
    );
    if (hasUnpaidInvoices) {
      return NextResponse.json(
        {
          error:
            "Cannot delete project with unpaid invoices. Please resolve all invoices first.",
        },
        { status: 403 },
      );
    }

    await prisma.project.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}

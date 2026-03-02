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
    const { status, paidAt, paymentLink, paymentId } = json;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (paidAt !== undefined)
      updateData.paidAt = paidAt ? new Date(paidAt) : null;
    if (paymentLink !== undefined) updateData.paymentLink = paymentLink;
    if (paymentId !== undefined) updateData.paymentId = paymentId;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        project: { include: { client: true } },
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
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
    await prisma.invoice.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 },
    );
  }
}

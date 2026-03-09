import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

    const updateData: Prisma.InvoiceUpdateInput = {};
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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { projectId } = invoice;

    // Count remaining invoices for this project (excluding the one being deleted)
    const remainingInvoicesCount = await prisma.invoice.count({
      where: {
        projectId,
        id: { not: id },
      },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Delete the invoice
      await tx.invoice.delete({
        where: { id },
      });

      // 2. If it was the last invoice, unlock the project
      if (remainingInvoicesCount === 0) {
        await tx.project.update({
          where: { id: projectId },
          data: {
            termsAcceptedAt: null,
            termsAcceptedUserAgent: null,
            termsAcceptedSessionId: null,
          },
        });
      }
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

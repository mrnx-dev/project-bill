import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

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

    try {
      if (session?.user?.id && Object.keys(updateData).length > 0) {
         await createAuditLog({
            userId: session.user.id,
            action: "UPDATE_INVOICE",
            title: `${invoice.invoiceNumber} (${invoice.project.title})`,
            entityType: "INVOICE",
            entityId: invoice.id,
            newValue: JSON.stringify(updateData),
         });
      }
    } catch (e) {
      console.error(e)
    }

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
      select: { projectId: true, invoiceNumber: true, project: { select: { title: true } } },
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

    try {
      if (session?.user?.id) {
         await createAuditLog({
            userId: session.user.id,
            action: "DELETE_INVOICE",
            title: `${invoice.invoiceNumber} (${invoice.project.title})`,
            entityType: "INVOICE",
            entityId: id,
         });
      }
    } catch (e) {
      console.error(e)
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 },
    );
  }
}

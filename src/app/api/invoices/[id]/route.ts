import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const { status, cancelAtPeriodEnd } = json;
    const orgId = session.user.activeOrganizationId!;

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: { project: { include: { client: true } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;

    const updated = await prisma.invoice.update({
      where: { id, organizationId: orgId },
      data: updateData,
      include: { project: { include: { client: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
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
    const orgId = session.user.activeOrganizationId!;

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.invoice.delete({ where: { id, organizationId: orgId } });

    await createAuditLog({
      userId: session.user.id,
      action: "invoice.delete",
      entityType: "INVOICE",
      entityId: id,
      oldValue: invoice.invoiceNumber,
      organizationId: orgId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}

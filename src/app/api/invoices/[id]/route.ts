import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";
import { INVOICE_STATUS } from "@/lib/invoice-status";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN", "MEMBER"]);
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const json = await request.json();

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { project: { include: { client: true } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow notes and dueDate updates; strip status and cancelAtPeriodEnd
    const updateData: Record<string, unknown> = {};
    if (json.notes !== undefined) updateData.notes = json.notes;
    if (json.dueDate !== undefined) updateData.dueDate = json.dueDate;

    const updated = await prisma.invoice.update({
      where: { id, organizationId },
      data: updateData,
      include: { project: { include: { client: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === INVOICE_STATUS.PAID) {
      return NextResponse.json(
        { error: "Cannot delete a paid invoice. Void the invoice first." },
        { status: 409 },
      );
    }

    await prisma.invoice.delete({ where: { id, organizationId } });

    await createAuditLog({
      userId: session.user.id,
      action: "invoice.delete",
      entityType: "INVOICE",
      entityId: id,
      oldValue: invoice.invoiceNumber,
      organizationId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to delete invoice:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}

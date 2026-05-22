import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";
import { isValidTransition } from "@/lib/invoice-status";
import { createAuditLog } from "@/lib/audit-logger";
import { createNotification } from "@/lib/notifications";
import { formatMoney } from "@/lib/currency";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);

    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Check if invoice exists and is unpaid
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        project: { include: { client: true } },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!isValidTransition(existingInvoice.status, 'PAID')) {
      return NextResponse.json(
        { error: `Cannot transition invoice from ${existingInvoice.status} to PAID` },
        { status: 409 }
      );
    }

    const { project } = existingInvoice;
    const { client } = project;

    const amountStr = formatMoney(Number(existingInvoice.amount), project.currency || "IDR");

    // Update the invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id, organizationId },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    // Create Audit Log
    if (session?.user?.id) {
      await createAuditLog({
        userId: session.user.id,
        organizationId,
        action: "INVOICE_MARKED_PAID_MANUALLY",
        title: `${existingInvoice.invoiceNumber} (${project.title})`,
        entityType: "INVOICE",
        entityId: id,
        oldValue: existingInvoice.status,
        newValue: "PAID",
      }).catch(console.error);
    }

    // Create Notification
    await createNotification({
      title: `Invoice Paid (Manual)`,
      message: `Manual payment received for invoice ${existingInvoice.invoiceNumber} (${client.name} - ${project.title}) amounting to ${amountStr}.`,
      type: "payment",
      linkUrl: `/invoices/${id}`,
      organizationId,
    }).catch(console.error);

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    if (error instanceof AuthError) {
      return new NextResponse(error.message, { status: error.statusCode });
    }
    console.error("Failed to mark invoice as paid:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

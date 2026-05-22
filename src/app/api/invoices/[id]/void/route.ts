import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";
import { isValidTransition, INVOICE_STATUS } from "@/lib/invoice-status";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (!isValidTransition(invoice.status, INVOICE_STATUS.VOID)) {
      return NextResponse.json(
        { error: `Cannot void invoice with status ${invoice.status}` },
        { status: 409 }
      );
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: INVOICE_STATUS.VOID,
        voidedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
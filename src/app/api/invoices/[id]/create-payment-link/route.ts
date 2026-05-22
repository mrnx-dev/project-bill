import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";
import { signInvoicePay } from "@/lib/auth/hmac";
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

    // If already has a payment link, return existing + HMAC
    if (invoice.paymentLink) {
      const hmacSig = signInvoicePay(invoice.id, organizationId);
      return NextResponse.json({ paymentLink: invoice.paymentLink, hmacSig });
    }

    // Create Mayar payment link logic — placeholder for now
    // The actual Mayar integration would go here, similar to the /pay route
    return NextResponse.json({ error: "Payment link creation not yet implemented" }, { status: 501 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
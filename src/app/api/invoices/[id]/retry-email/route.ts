import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/app/actions/send-invoice";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
         project: {
            include: { client: true }
         }
      }
    });

    if (!invoice) {
       return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.project.client.email) {
       return NextResponse.json({ error: "Client has no email" }, { status: 400 });
    }

    const res = await sendInvoiceEmail(id);

    if (res.success) {
       return NextResponse.json({ success: true, manual: res.manual });
    } else {
       return NextResponse.json({ error: res.error }, { status: 500 });
    }
    
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Retry Email API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

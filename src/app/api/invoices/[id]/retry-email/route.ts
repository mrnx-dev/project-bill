import { NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/app/actions/send-invoice";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const POST = withTenantRls(async (request, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const id = (await ctx.params).id as string;

    const invoice = await tx.invoice.findUnique({
      where: { id, organizationId: orgId },
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
    console.error("Retry Email API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMayarWebhook } from "@/lib/mayar";

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-callback-token") || request.headers.get("x-mayar-signature") || request.headers.get("authorization");

    if (!signature || !verifyMayarWebhook(payload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(payload);

    // Handling Event: payment.received
    const eventType = data.event || data["event.received"];
    const isPaid =
      eventType === "payment.received" ||
      eventType === "payment.success" ||
      data.status === "paid" ||
      data.data?.status === true;

    if (isPaid) {
      // In our pay route payload, we send the Invoice ID as the `referenceId`.
      // Mayar webhooks return this as `data.reference_id` or similar depending on event.
      let invoiceId = data.data?.reference_id || data.reference_id;

      if (!invoiceId) {
        // Fallback: extract from productDescription (e.g., "Invoice for Project. ID: uuid")
        const desc = data.data?.productDescription || data.productDescription || "";
        const idMatch = desc.match(/ID:\s*([a-f0-9\-]{36})/i);
        if (idMatch && idMatch[1]) {
          invoiceId = idMatch[1];
        }
      }

      if (invoiceId) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "paid",
            paidAt: new Date(),
            paymentId: data.data?.id || data.transaction_id || data.id, // Save the final payment ID back to our DB
          },
        });

        // Trigger cache revalidation so other pages updates immediately
        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/invoices/${invoiceId}`);
        revalidatePath("/invoices");
        revalidatePath("/board");

      } else {
        console.warn("[Webhook Warn] Payment successful, but no reference_id found to link to Invoice.");
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}

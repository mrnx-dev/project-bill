import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMayarWebhook } from "@/lib/mayar";

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-mayar-signature");

    if (!signature || !verifyMayarWebhook(payload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(payload);

    // Handling payment.success
    if (data.event === "payment.success" || data.status === "paid") {
      const transactionId = data.transaction_id || data.data?.id;

      if (transactionId) {
        await prisma.invoice.updateMany({
          where: { paymentId: transactionId },
          data: {
            status: "paid",
            paidAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}

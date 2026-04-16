import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMayarWebhook } from "@/lib/billing/mayar";
import { addMonths, addYears } from "date-fns";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const headersList = await headers();
    const signature = headersList.get("x-callback-token") || headersList.get("Authorization") || "";

    const isValid = await verifyMayarWebhook(bodyText, signature);
    if (!isValid) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(bodyText);

    if (payload.event !== "payment.success" && payload.status !== "SUCCESS") {
      return new NextResponse("Ignored", { status: 200 });
    }

    const paymentId = payload.data?.id || payload.id;
    
    // Find subscription with this pending payment
    const subscription = await prisma.subscription.findFirst({
      where: { mayarPaymentId: paymentId }
    });

    if (!subscription) {
      console.warn("Webhook received for unknown payment ID:", paymentId);
      return new NextResponse("Subscription not found", { status: 404 });
    }

    const description = (payload.data?.description || payload.description || "").toLowerCase();
    let updatedPlan = subscription.plan;
    let periodMonths = 1;

    if (description.includes("pro")) updatedPlan = "pro";
    if (description.includes("business")) updatedPlan = "business";
    if (description.includes("YEARLY")) periodMonths = 12;

    const now = new Date();
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: updatedPlan,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodMonths === 12 ? addYears(now, 1) : addMonths(now, 1),
        trialEndsAt: null, // clear trial if they upgrade
        mayarPaymentId: null, // clear pending intent
      }
    });

    return new NextResponse("Success", { status: 200 });
  } catch (error) {
    console.error("[WEBHOOK_ERROR]", error);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}

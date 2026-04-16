import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_PRICING, getSubscription } from "@/lib/billing/subscription";
import { createPaymentLink } from "@/lib/billing/mayar";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { plan, billing } = body;

    const pricingPlan = PLAN_PRICING[plan as keyof typeof PLAN_PRICING];
    if (!pricingPlan) {
      return new NextResponse("Invalid plan", { status: 400 });
    }

    const price = pricingPlan[billing as "monthly" | "yearly"];
    if (price === 0) {
      return new NextResponse("Free plan selected", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Ensure subscription exists
    await getSubscription(userId);

    // Create payment link via Mayar
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const payment = await createPaymentLink({
      amount: price,
      customerName: user.name || "Customer",
      customerEmail: user.email || "",
      customerMobile: "08000000000", // Fallback mobile
      description: `ProjectBill - Upgrade to ${plan.toUpperCase()} (${billing})`,
      redirectUrl: `${baseUrl}/settings/subscription?success=true`,
    });

    // Save payment intent
    await prisma.subscription.update({
      where: { userId },
      data: {
        mayarPaymentId: payment.id,
      },
    });

    return NextResponse.json({ checkoutUrl: payment.link, paymentId: payment.id });
  } catch (error) {
    console.error("[CHECKOUT_ERROR]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

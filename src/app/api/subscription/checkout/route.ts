import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_PRICING, getSubscriptionByOrg } from "@/lib/billing/subscription";
import { createPaymentLink } from "@/lib/billing/mayar";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.user.activeOrganizationId!;
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

    // Ensure subscription exists
    await getSubscriptionByOrg(orgId);

    // Create payment link via Mayar
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const payment = await createPaymentLink({
      amount: price,
      customerName: session.user.name || "Customer",
      customerEmail: session.user.email || "",
      customerMobile: "08000000000",
      description: `ProjectBill - Upgrade to ${plan.toUpperCase()} (${billing})`,
      redirectUrl: `${baseUrl}/settings/subscription?success=true`,
      organizationId: orgId,
    });

    // Save payment intent
    await prisma.subscription.update({
      where: { organizationId: orgId },
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

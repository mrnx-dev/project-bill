import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscription, checkTrialStatus, isSelfHosted, PLAN_LIMITS, type PlanType } from "@/lib/billing/subscription";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET: Fetch current user's subscription info
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (isSelfHosted()) {
            return NextResponse.json({
                mode: "self-hosted",
                plan: "unlimited",
                limits: null,
                usage: null,
            });
        }

        const sub = await getSubscription(session.user.id);
        const trialStatus = await checkTrialStatus(session.user.id);
        const planName = sub.plan as PlanType;
        const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.starter;

        // Get current counts for static resources
        const [clientCount, projectCount, recurringCount, sowCount, teamCount] = await Promise.all([
            prisma.client.count({ where: { isArchived: false } }),
            prisma.project.count({ where: { status: { not: "DONE" } } }),
            prisma.recurringInvoice.count({ where: { isActive: true } }),
            prisma.sOWTemplate.count(),
            prisma.user.count(),
        ]);

        return NextResponse.json({
            mode: "managed",
            subscription: {
                id: sub.id,
                plan: sub.plan,
                status: sub.status,
                currentPeriodStart: sub.currentPeriodStart,
                currentPeriodEnd: sub.currentPeriodEnd,
                trialEndsAt: sub.trialEndsAt,
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                isTrialing: trialStatus.isTrialing,
                trialDaysLeft: trialStatus.daysLeft,
            },
            limits,
            usage: {
                clients: { current: clientCount, limit: limits.clients },
                activeProjects: { current: projectCount, limit: limits.activeProjects },
                invoicesPerMonth: { current: sub.invoicesCreated, limit: limits.invoicesPerMonth },
                emailsPerMonth: { current: sub.emailsSent, limit: limits.emailsPerMonth },
                paymentLinksPerMonth: { current: sub.paymentLinksUsed, limit: limits.paymentLinksPerMonth },
                recurringTemplates: { current: recurringCount, limit: limits.recurringTemplates },
                sowTemplates: { current: sowCount, limit: limits.sowTemplates },
                teamMembers: { current: teamCount, limit: limits.teamMembers },
            },
        });
    } catch (error) {
        console.error("[SUBSCRIPTION_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PUT: Admin-only endpoint to update a user's subscription plan
const updateSchema = z.object({
    userId: z.string().uuid().optional(), // If not provided, updates current user
    plan: z.enum(["starter", "pro", "business"]),
});

export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Only admin can update plans
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (currentUser?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        let json;
        try {
            json = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const validation = updateSchema.safeParse(json);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const { userId, plan } = validation.data;
        const targetUserId = userId || session.user.id;

        // Ensure subscription exists first
        await getSubscription(targetUserId);

        const updated = await prisma.subscription.update({
            where: { userId: targetUserId },
            data: { plan },
        });

        return NextResponse.json({
            success: true,
            subscription: updated,
        });
    } catch (error) {
        console.error("[SUBSCRIPTION_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

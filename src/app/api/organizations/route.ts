import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createOrganizationSchema } from "@/lib/validations/organization";
import { isSelfHosted } from "@/lib/billing/subscription";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.activeOrganizationId) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      include: { organization: true },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(
      memberships.map((m) => ({
        ...m.organization,
        role: m.role,
        joinedAt: m.joinedAt,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createOrganizationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name } = validation.data;
    const slug = Math.random().toString(36).substring(2, 12);

    const org = await prisma.organization.create({
      data: { name, slug },
    });

    await prisma.organizationMember.create({
      data: {
        userId: session.user.id,
        organizationId: org.id,
        role: "OWNER",
      },
    });

    // Auto-create trial subscription for managed mode
    if (!isSelfHosted()) {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          plan: "pro",
          status: "TRIALING",
          trialStartedAt: now,
          trialEndsAt: trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnds,
        },
      });
    }

    return NextResponse.json(
      { ...org, role: "OWNER" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}

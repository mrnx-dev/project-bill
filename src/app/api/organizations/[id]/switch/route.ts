import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 });
    }

    // Persist defaultOrganizationId so it survives across sessions
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { defaultOrganizationId: id },
      });
      console.log(`[ORG_SWITCH] Persisted defaultOrganizationId=${id} for userId=${session.user.id}`);
    } catch (dbError) {
      console.error("[ORG_SWITCH] Failed to persist defaultOrganizationId to DB:", dbError);
    }

    console.log(`[ORG_SWITCH] userId=${session.user.id} fromOrg=${session.user.activeOrganizationId ?? "none"} toOrg=${id} role=${membership.role}`);

    return NextResponse.json({
      success: true,
      organizationId: id,
      activeOrganizationRole: membership.role,
    });
  } catch (error) {
    console.error("Failed to switch organization:", error);
    return NextResponse.json(
      { error: "Failed to switch organization" },
      { status: 500 }
    );
  }
}

// Handle auto-redirect from layout.tsx when user's active org is inaccessible
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      const loginUrl = `/login?callbackUrl=${encodeURIComponent(new URL(request.url).pathname)}`;
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    const { id } = await params;
    const url = new URL(request.url);
    const isAuto = url.searchParams.get("auto") === "true";

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: id } },
    });

    if (!membership) {
      return NextResponse.redirect(new URL("/onboarding/organization", request.url));
    }

    // For auto-redirect, just redirect to dashboard
    if (isAuto) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.json({
      success: true,
      organizationId: id,
      activeOrganizationRole: membership.role,
    });
  } catch (error) {
    console.error("Failed to switch organization:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}

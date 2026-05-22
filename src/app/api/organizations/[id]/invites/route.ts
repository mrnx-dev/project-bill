import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { inviteMemberSchema } from "@/lib/validations/organization";
import { checkOrgLimit } from "@/lib/billing/subscription";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/email";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const invites = await prisma.organizationInvite.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invites);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to fetch invites:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: id } },
    });
    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = inviteMemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Validation failed", details: validation.error.flatten() }, { status: 400 });
    }

    const { email, role } = validation.data;

    const existingMembership = await prisma.organizationMember.findFirst({
      where: { organizationId: id, user: { email } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const pendingInvite = await prisma.organizationInvite.findFirst({
      where: { organizationId: id, email, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (pendingInvite) {
      return NextResponse.json({ error: "An active invite already exists for this email" }, { status: 409 });
    }

    const limitCheck = await checkOrgLimit(id, "teamMembers");
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: "Team member limit reached", limitCheck }, { status: 403 });
    }

    const token = crypto.randomUUID();
    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId: id,
        email,
        role,
        token,
        createdBy: session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
    if (org) {
      sendInviteEmail({ to: email, orgName: org.name, token, role, organizationId: id }).catch(console.error);
    }

    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}

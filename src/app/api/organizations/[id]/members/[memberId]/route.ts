import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { updateMemberRoleSchema } from "@/lib/validations/organization";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id, memberId } = await params;

    const body = await request.json();
    const validation = updateMemberRoleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const member = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: validation.data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to update member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { membership: requesterMembership } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id, memberId } = await params;

    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.organizationId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove the organization owner" },
        { status: 403 }
      );
    }

    const isLeavingOwn = targetMember.userId === session.user.id;

    // MEMBER role can only remove themselves (leave org)
    if (requesterMembership.role === "MEMBER" && !isLeavingOwn) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}

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

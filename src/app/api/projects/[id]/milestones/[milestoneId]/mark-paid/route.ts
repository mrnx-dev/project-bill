import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id: projectId, milestoneId } = await params;
    const orgId = session.user.activeOrganizationId!;

    const milestone = await prisma.paymentMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId: orgId },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status === "PAID") {
      return NextResponse.json({ error: "Already marked as paid" }, { status: 400 });
    }

    const updated = await prisma.paymentMilestone.update({
      where: { id: milestoneId, organizationId: orgId },
      data: { status: "PAID" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to mark milestone paid:", error);
    return NextResponse.json({ error: "Failed to mark paid" }, { status: 500 });
  }
}

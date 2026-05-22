import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id: projectId, milestoneId } = await params;

    const milestone = await prisma.paymentMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId },
      include: { invoice: true },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status !== "INVOICED") {
      return NextResponse.json(
        { error: "Can only un-approve INVOICED milestones" },
        { status: 400 },
      );
    }

    // Only allow un-approve if invoice is UNPAID
    if (milestone.invoice && milestone.invoice.status !== "unpaid") {
      return NextResponse.json(
        { error: "Cannot un-approve milestone with a paid invoice" },
        { status: 400 },
      );
    }

    // Delete the invoice and rollback milestone atomically
    const updated = await prisma.$transaction(async (tx) => {
      if (milestone.invoiceId) {
        await tx.invoice.delete({ where: { id: milestone.invoiceId, organizationId } });
      }
      return tx.paymentMilestone.update({
        where: { id: milestoneId, organizationId },
        data: { status: "PENDING", invoiceId: null },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to un-approve milestone:", error);
    return NextResponse.json({ error: "Failed to un-approve" }, { status: 500 });
  }
}
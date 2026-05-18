import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const json = await request.json();
    const orgId = session.user.activeOrganizationId!;

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    }

    const updated = await prisma.recurringInvoice.update({
      where: { id, organizationId: orgId },
      data: json,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update recurring invoice:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const orgId = session.user.activeOrganizationId!;

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    }

    await prisma.recurringInvoice.update({
      where: { id, organizationId: orgId },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to deactivate recurring invoice:", error);
    return NextResponse.json({ error: "Failed to deactivate" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id } = await params;
    const json = await request.json();

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    }

    // Strip organizationId and only allow whitelisted fields
    const { organizationId: _, ...rest } = json;
    const allowedKeys = ["name", "amount", "interval", "intervalCount", "nextRunAt", "isActive", "projectId", "description", "startNumber", "prefix"];
    const data: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in rest) {
        data[key] = rest[key];
      }
    }

    const updated = await prisma.recurringInvoice.update({
      where: { id, organizationId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
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
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id } = await params;

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    }

    await prisma.recurringInvoice.update({
      where: { id, organizationId },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to deactivate recurring invoice:", error);
    return NextResponse.json({ error: "Failed to deactivate" }, { status: 500 });
  }
}
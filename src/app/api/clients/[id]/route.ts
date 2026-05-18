import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const json = await request.json();
    const { name, email, phone } = json;

    const orgId = session.user.activeOrganizationId!;

    const existing = await prisma.client.findFirst({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = await prisma.client.update({
      where: { id },
      data: { name, email, phone },
    });

    const changedFields: { field: string; oldValue: string; newValue: string }[] = [];

    if (name !== undefined && name !== existing.name) {
      changedFields.push({ field: "name", oldValue: existing.name, newValue: name });
    }
    const normalizedEmail = email ?? "";
    const normalizedExistingEmail = existing.email ?? "";
    if (email !== undefined && normalizedEmail !== normalizedExistingEmail) {
      changedFields.push({ field: "email", oldValue: normalizedExistingEmail, newValue: normalizedEmail });
    }
    const normalizedPhone = phone ?? "";
    const normalizedExistingPhone = existing.phone ?? "";
    if (phone !== undefined && normalizedPhone !== normalizedExistingPhone) {
      changedFields.push({ field: "phone", oldValue: normalizedExistingPhone, newValue: normalizedPhone });
    }

    for (const entry of changedFields) {
      await createAuditLog({
        userId: session.user.id,
        action: "client.update",
        title: `Updated ${entry.field} for ${existing.name}`,
        entityType: "CLIENT",
        entityId: id,
        field: entry.field,
        oldValue: entry.oldValue || undefined,
        newValue: entry.newValue || undefined,
        organizationId: orgId,
      });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Failed to update client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const orgId = session.user.activeOrganizationId!;

    const clientWithInvoices = await prisma.client.findFirst({
      where: { id },
      include: {
        projects: {
          include: { invoices: true },
        },
      },
    });

    if (!clientWithInvoices) {
      return new NextResponse(null, { status: 404 });
    }

    const hasPaidInvoices = clientWithInvoices.projects.some((project) =>
      project.invoices.some((invoice) => invoice.status === "PAID"),
    );

    if (hasPaidInvoices) {
      await prisma.client.update({
        where: { id },
        data: { isArchived: true },
      });
    } else {
      await prisma.client.delete({
        where: { id },
      });
    }

    await createAuditLog({
      userId: session.user.id,
      action: hasPaidInvoices ? "client.archive" : "client.delete",
      entityType: "CLIENT",
      entityId: id,
      oldValue: clientWithInvoices.name,
      organizationId: orgId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 },
    );
  }
}

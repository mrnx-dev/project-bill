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

    await createAuditLog({
      userId: session.user.id,
      action: "client.update",
      entityType: "CLIENT",
      entityId: id,
      oldValue: existing?.name || undefined,
      newValue: name || undefined,
      organizationId: orgId,
    });

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

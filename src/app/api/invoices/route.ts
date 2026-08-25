import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";
import { invoiceSchema } from "@/lib/validations";
import { generateInvoiceNumber } from "@/lib/invoice-utils";

export const GET = withTenantRls(async (request: Request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const args: Prisma.InvoiceFindManyArgs = {
      where: { organizationId: orgId },
      include: { project: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
    };

    if (limitParam && pageParam) {
      const limit = parseInt(limitParam, 10);
      const page = parseInt(pageParam, 10);
      args.skip = (page - 1) * limit;
      args.take = limit;

      const total = await tx.invoice.count({ where: { organizationId: orgId } });
      const invoices = await tx.invoice.findMany(args);

      return NextResponse.json({
        data: invoices,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const invoices = await tx.invoice.findMany(args);
    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
});

export const POST = withTenantRls(async (request: Request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;
    const userId = ctx.userId;

    let json;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = invoiceSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = validation.data;

    const { checkOrgLimit, incrementOrgUsage } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(orgId, "invoicesPerMonth");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Plan limit reached", limitCheck },
        { status: 403 }
      );
    }

    const invoiceNumber = await generateInvoiceNumber(orgId);

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        projectId: data.projectId,
        type: data.type,
        amount: data.amount,
        notes: data.notes || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : defaultDueDate,
        status: "UNPAID",
        organizationId: orgId,
      },
      include: { project: true },
    });

    await incrementOrgUsage(orgId, "invoicesCreated");

    try {
      await createAuditLog({
        userId,
        action: "CREATE_INVOICE",
        title: `${invoice.invoiceNumber} (${invoice.project.title})`,
        entityType: "INVOICE",
        entityId: invoice.id,
        newValue: JSON.stringify({ amount: invoice.amount.toString(), type: invoice.type }),
        organizationId: orgId,
      });
    } catch (e) {
      console.error(e);
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 },
    );
  }
});
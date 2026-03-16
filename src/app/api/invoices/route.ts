import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const args: Prisma.InvoiceFindManyArgs = {
      include: { project: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
    };

    if (limitParam && pageParam) {
      const limit = parseInt(limitParam, 10);
      const page = parseInt(pageParam, 10);
      args.skip = (page - 1) * limit;
      args.take = limit;

      const total = await prisma.invoice.count();
      const invoices = await prisma.invoice.findMany(args);

      return NextResponse.json({
        data: invoices,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const invoices = await prisma.invoice.findMany(args);
    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}

import { invoiceSchema } from "@/lib/validations";
import { generateInvoiceNumber } from "@/lib/invoice-utils";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    let json;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = invoiceSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    // --- Subscription Gate Check ---
    const { checkLimit, incrementUsage } = await import("@/lib/subscription");
    const limitCheck = await checkLimit(session.user.id, "invoicesPerMonth");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Plan limit reached", limitCheck },
        { status: 403 }
      );
    }
    // -------------------------------

    const invoiceNumber = await generateInvoiceNumber();

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        projectId: data.projectId,
        type: data.type,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : defaultDueDate,
        status: "unpaid",
      },
      include: { project: true },
    });

    // --- Subscription Usage Increment ---
    await incrementUsage(session.user.id, "invoicesCreated");
    // ------------------------------------

    try {
      if (session?.user?.id) {
         await createAuditLog({
            userId: session.user.id,
            action: "CREATE_INVOICE",
            entityType: "INVOICE",
            entityId: invoice.id,
            newValue: JSON.stringify({ amount: invoice.amount.toString(), type: invoice.type }),
         });
      }
    } catch (e) {
      console.error(e)
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 },
    );
  }
}

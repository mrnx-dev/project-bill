import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { recurringInvoiceSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit-logger";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        const args: Prisma.RecurringInvoiceFindManyArgs = {
            include: { project: { include: { client: true } } },
            orderBy: { createdAt: "desc" },
        };

        if (projectId) {
            args.where = { projectId };
        }

        const recurringInvoices = await prisma.recurringInvoice.findMany(args);
        return NextResponse.json(recurringInvoices);
    } catch (error) {
        console.error("Failed to fetch recurring invoices:", error);
        return NextResponse.json(
            { error: "Failed to fetch recurring invoices" },
            { status: 500 },
        );
    }
}

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

        const validation = recurringInvoiceSchema.safeParse(json);
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
        const { checkLimit } = await import("@/lib/billing/subscription");
        const limitCheck = await checkLimit(session.user.id, "recurringTemplates");
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: "Plan limit reached", limitCheck },
                { status: 403 }
            );
        }
        // -------------------------------

        // Check if project exists
        const project = await prisma.project.findUnique({
            where: { id: data.projectId },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 400 });
        }

        // Calculate initial nextRunAt
        // NextRunAt should be startDate if startDate is in the future or today
        const start = new Date(data.startDate);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let nextRunAt = start;
        if (start < today) {
            // if start date is in the past, calculate the next run based on frequency
            nextRunAt = new Date(today);
            if (data.frequency === "MONTHLY") {
                nextRunAt.setDate(data.dayOfMonth);
                if (nextRunAt <= today) {
                    nextRunAt.setMonth(nextRunAt.getMonth() + 1);
                }
            } else if (data.frequency === "WEEKLY") {
                const daysUntilNext = (7 - today.getDay() + start.getDay()) % 7;
                nextRunAt.setDate(today.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
            } else if (data.frequency === "YEARLY") {
                nextRunAt.setMonth(start.getMonth(), start.getDate());
                if (nextRunAt <= today) {
                    nextRunAt.setFullYear(nextRunAt.getFullYear() + 1);
                }
            }
        }

        const recurringInvoice = await prisma.recurringInvoice.create({
            data: {
                projectId: data.projectId,
                title: data.title,
                amount: data.amount,
                frequency: data.frequency,
                dayOfMonth: data.dayOfMonth,
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : null,
                description: data.description,
                isActive: data.isActive,
                nextRunAt: nextRunAt,
            },
            include: { project: true },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "recurring_invoice.create",
            entityType: "RECURRING_INVOICE",
            entityId: recurringInvoice.id,
            newValue: data.title,
        });

        return NextResponse.json(recurringInvoice, { status: 201 });
    } catch (error) {
        console.error("Failed to create recurring invoice:", error);
        return NextResponse.json(
            { error: "Failed to create recurring invoice" },
            { status: 500 },
        );
    }
}

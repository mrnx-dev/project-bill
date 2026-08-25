import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { recurringInvoiceSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit-logger";

export const GET = withTenantRls(async (request, _ctx, tx) => {
    try {
        const ctx = getTenantCtx()!;
        const orgId = ctx.organizationId;

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        const args: Prisma.RecurringInvoiceFindManyArgs = {
            where: { organizationId: orgId },
            include: { project: { include: { client: true } } },
            orderBy: { createdAt: "desc" },
        };

        if (projectId) {
            args.where = { ...args.where, projectId };
        }

        const recurringInvoices = await tx.recurringInvoice.findMany(args);
        return NextResponse.json(recurringInvoices);
    } catch (error) {
        console.error("Failed to fetch recurring invoices:", error);
        return NextResponse.json(
            { error: "Failed to fetch recurring invoices" },
            { status: 500 },
        );
    }
});

export const POST = withTenantRls(async (request, _ctx, tx) => {
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

        const validation = recurringInvoiceSchema.safeParse(json);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const data = validation.data;

        const { checkOrgLimit } = await import("@/lib/billing/subscription");
        const limitCheck = await checkOrgLimit(orgId, "recurringTemplates");
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: "Plan limit reached", limitCheck },
                { status: 403 }
            );
        }

        const project = await tx.project.findFirst({
            where: { id: data.projectId, organizationId: orgId },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 400 });
        }

        if (project.billingMode === "MILESTONE") {
            return NextResponse.json(
                { error: "Recurring invoices are not available for MILESTONE-billing projects." },
                { status: 400 },
            );
        }

        const start = new Date(data.startDate);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let nextRunAt = start;
        if (start < today) {
            nextRunAt = new Date(today);
            if (data.frequency === "MONTHLY") {
                nextRunAt.setDate(data.dayOfMonth);
                if (nextRunAt <= today) nextRunAt.setMonth(nextRunAt.getMonth() + 1);
            } else if (data.frequency === "WEEKLY") {
                const daysUntilNext = (7 - today.getDay() + start.getDay()) % 7;
                nextRunAt.setDate(today.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
            } else if (data.frequency === "YEARLY") {
                nextRunAt.setMonth(start.getMonth(), start.getDate());
                if (nextRunAt <= today) nextRunAt.setFullYear(nextRunAt.getFullYear() + 1);
            }
        }

        const recurringInvoice = await tx.recurringInvoice.create({
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
                organizationId: orgId,
            },
            include: { project: true },
        });

        await createAuditLog({
            userId,
            action: "recurring_invoice.create",
            entityType: "RECURRING_INVOICE",
            entityId: recurringInvoice.id,
            newValue: data.title,
            organizationId: orgId,
        });

        return NextResponse.json(recurringInvoice, { status: 201 });
    } catch (error) {
        console.error("Failed to create recurring invoice:", error);
        return NextResponse.json(
            { error: "Failed to create recurring invoice" },
            { status: 500 },
        );
    }
});
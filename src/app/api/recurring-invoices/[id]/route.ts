import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { recurringInvoiceSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit-logger";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { id } = await params;

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

        const existing = await prisma.recurringInvoice.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "Recurring invoice not found" },
                { status: 404 },
            );
        }

        // Recalculate nextRunAt if frequency or dates changed, but this gets complicated.
        // For simplicity, we just keep nextRunAt as is unless the user is forcing a reset.
        // A better approach is to update nextRunAt if the dayOfMonth changed.
        let nextRunAt = existing.nextRunAt;
        if (existing.dayOfMonth !== data.dayOfMonth && data.frequency === "MONTHLY") {
            nextRunAt = new Date(existing.nextRunAt);
            nextRunAt.setDate(data.dayOfMonth);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (nextRunAt < today) {
                nextRunAt.setMonth(nextRunAt.getMonth() + 1);
            }
        }

        const updated = await prisma.recurringInvoice.update({
            where: { id },
            data: {
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
        });

        await createAuditLog({
            userId: session.user.id,
            action: "recurring_invoice.update",
            entityType: "RECURRING_INVOICE",
            entityId: id,
            oldValue: existing.title,
            newValue: data.title,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update recurring invoice:", error);
        return NextResponse.json(
            { error: "Failed to update recurring invoice" },
            { status: 500 },
        );
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

        const existing = await prisma.recurringInvoice.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "Recurring invoice not found" },
                { status: 404 },
            );
        }

        // Soft delete by deactivating
        await prisma.recurringInvoice.update({
            where: { id },
            data: {
                isActive: false,
            },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "recurring_invoice.deactivate",
            entityType: "RECURRING_INVOICE",
            entityId: id,
            oldValue: existing.title,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete recurring invoice:", error);
        return NextResponse.json(
            { error: "Failed to delete recurring invoice" },
            { status: 500 },
        );
    }
}

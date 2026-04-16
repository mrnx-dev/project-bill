import { prisma } from "@/lib/prisma";
import { RecurringInvoicesClient } from "./recurring-invoices-client";

export const dynamic = "force-dynamic";

export default async function RecurringInvoicesPage() {
    const recurringInvoicesRaw = await prisma.recurringInvoice.findMany({
        include: {
            project: {
                include: { client: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    // Serialize records
    const recurringInvoices = recurringInvoicesRaw.map((inv) => ({
        ...inv,
        amount: inv.amount.toString(),
        frequency: inv.frequency as "MONTHLY" | "WEEKLY" | "YEARLY",
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        startDate: inv.startDate.toISOString(),
        endDate: inv.endDate ? inv.endDate.toISOString() : null,
        nextRunAt: inv.nextRunAt.toISOString(),
        project: {
            ...inv.project,
            totalPrice: inv.project.totalPrice.toString(),
            dpAmount: inv.project.dpAmount?.toString() || null,
            taxRate: inv.project.taxRate?.toString() || null,
            createdAt: inv.project.createdAt.toISOString(),
            updatedAt: inv.project.updatedAt.toISOString(),
            client: {
                ...inv.project.client,
                createdAt: inv.project.client.createdAt.toISOString(),
                updatedAt: inv.project.client.updatedAt.toISOString(),
            },
        },
    }));

    const projectsRaw = await prisma.project.findMany({
        include: { client: true },
        orderBy: { createdAt: "desc" },
    });

    const projects = projectsRaw.map((p) => ({
        ...p,
        totalPrice: p.totalPrice.toString(),
        dpAmount: p.dpAmount?.toString() || null,
        taxRate: p.taxRate?.toString() || null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        client: {
            ...p.client,
            createdAt: p.client.createdAt.toISOString(),
            updatedAt: p.client.updatedAt.toISOString(),
        },
    }))

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recurring Invoices</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage templates that automatically generate invoices on a schedule.
                    </p>
                </div>
            </div>

            <RecurringInvoicesClient initialRecurringInvoices={recurringInvoices} projects={projects} />
        </div>
    );
}

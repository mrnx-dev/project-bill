import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/app/actions/send-invoice";
import { generateInvoiceNumber } from "@/lib/invoice-utils";
import { RateLimiter } from "@/lib/rate-limit";

// Allow 2 cron requests per minute per IP to prevent abusive triggers
const cronRateLimiter = new RateLimiter({ limit: 2, windowMs: 60 * 1000 });

export async function GET(request: Request) {
    // 0. Rate Limiting Check
    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = cronRateLimiter.check(ip);
    if (!rateLimitResult.success) {
        console.warn(`[Cron Rate Limit] Exceeded for IP: ${ip}`);
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 1. Validate CRON_SECRET (Default Deny if not set)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2. Fetch active recurring invoices that are due to run today or earlier
        const dueTemplates = await prisma.recurringInvoice.findMany({
            where: {
                isActive: true,
                nextRunAt: {
                    lte: today,
                },
            },
            include: {
                project: {
                    include: { client: true },
                },
            },
        });

        let generated = 0;
        const results: { recurringId: string; invoiceId?: string; error?: string }[] = [];

        for (const template of dueTemplates) {
            try {
                // Determine if we need to pause it
                let shouldPause = false;
                if (template.endDate) {
                    const end = new Date(template.endDate);
                    end.setHours(0, 0, 0, 0);
                    if (today > end) {
                        shouldPause = true;
                    }
                }

                if (shouldPause) {
                    await prisma.recurringInvoice.update({
                        where: { id: template.id },
                        data: { isActive: false },
                    });
                    results.push({ recurringId: template.id, error: "End date reached, pausing." });
                    continue;
                }

                // Calculate nextRunAt first
                let nextRunAt = new Date(template.nextRunAt);
                while (nextRunAt <= today) {
                    if (template.frequency === "MONTHLY") {
                        nextRunAt.setMonth(nextRunAt.getMonth() + 1);
                        const expectedDay = template.dayOfMonth;
                        nextRunAt.setDate(expectedDay);
                        if (nextRunAt.getDate() !== expectedDay) {
                            nextRunAt.setDate(0);
                        }
                    } else if (template.frequency === "WEEKLY") {
                        nextRunAt.setDate(nextRunAt.getDate() + 7);
                    } else if (template.frequency === "YEARLY") {
                        nextRunAt.setFullYear(nextRunAt.getFullYear() + 1);
                    }
                }

                // Generate invoice number outside of strict transaction to avoid long locking string pools (less of a concern but good practice)
                const invoiceNumber = await generateInvoiceNumber();
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7);

                // Execute the invoice creation and nextRunAt increment as ONE ATOMIC transaction
                // Ensuring idempotency. If this crashes half-way, nothing is saved.
                const newInvoice = await prisma.$transaction(async (tx) => {
                    // Check again with a lock/condition if possible, but the transaction wrapper is sufficient 
                    // since we check `nextRunAt` in the where clause if we wanted to be super strict. 
                    // However, due to external system constraints, keeping it logic-bound is fine.
                    const existingTemplate = await tx.recurringInvoice.findUnique({
                        where: { id: template.id }
                    });

                    if (!existingTemplate || existingTemplate.nextRunAt > today) {
                        throw new Error(`Template ${template.id} already processed or invalid.`);
                    }

                    const created = await tx.invoice.create({
                        data: {
                            invoiceNumber,
                            projectId: template.projectId,
                            type: "RECURRING",
                            notes: template.description || template.title,
                            amount: template.amount,
                            status: "UNPAID",
                            dueDate,
                        },
                    });

                    await tx.recurringInvoice.update({
                        where: { id: template.id },
                        data: { nextRunAt },
                    });

                    return created;
                });

                // Send Email automatically after successful transaction commit
                if (template.project.client.email) {
                    try {
                        await sendInvoiceEmail(newInvoice.id, true, template.description);
                    } catch (err) {
                        console.error(`Failed to send email for auto-invoice ${newInvoice.id}`, err);
                    }
                }

                generated++;
                results.push({ recurringId: template.id, invoiceId: newInvoice.id });
            } catch (templateError) {
                console.error(`Failed to process template ${template.id}:`, templateError);
                results.push({ recurringId: template.id, error: String(templateError) });
            }
        }

        return NextResponse.json({
            success: true,
            processed: dueTemplates.length,
            generated,
            details: results,
        });
    } catch (error) {
        console.error("Cron recurring invoices job failed:", error);
        return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
    }
}

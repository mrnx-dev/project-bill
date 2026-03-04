"use server";

import { prisma } from "@/lib/prisma";

export async function checkInvoiceStatus(invoiceId: string) {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { status: true },
        });

        return invoice?.status || null;
    } catch (error) {
        console.error("Failed to check invoice status:", error);
        return null;
    }
}

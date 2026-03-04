"use server";

import { prisma } from "@/lib/prisma";

export async function countUnpaidInvoices() {
    try {
        const count = await prisma.invoice.count({
            where: { status: "unpaid" },
        });
        return count;
    } catch (error) {
        console.error("Failed to count unpaid invoices:", error);
        return null;
    }
}

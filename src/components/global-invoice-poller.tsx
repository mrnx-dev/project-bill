"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { countUnpaidInvoices } from "@/app/actions/count-unpaid-invoices";

export function GlobalInvoicePoller({ currentUnpaidCount }: { currentUnpaidCount: number }) {
    const router = useRouter();

    useEffect(() => {
        // If there are no unpaid invoices, there is nothing waiting to be paid via webhook. Stop polling.
        if (currentUnpaidCount === 0) return;

        const interval = setInterval(async () => {
            const liveCount = await countUnpaidInvoices();

            // If the database has fewer unpaid invoices than what our screen currently shows, 
            // it means a webhook successfully marked one as paid. Refresh the UI!
            if (liveCount !== null && liveCount < currentUnpaidCount) {
                router.refresh();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [currentUnpaidCount, router]);

    return null;
}

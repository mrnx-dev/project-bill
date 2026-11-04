"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { countUnpaidInvoices } from "@/app/actions/count-unpaid-invoices";
import { reloadOnceOnStaleServerAction } from "@/lib/stale-server-action";

export function GlobalInvoicePoller({ currentUnpaidCount }: { currentUnpaidCount: number }) {
    const router = useRouter();

    useEffect(() => {
        // If there are no unpaid invoices, there is nothing waiting to be paid via webhook. Stop polling.
        if (currentUnpaidCount === 0) return;

        const interval = setInterval(async () => {
            try {
                const liveCount = await countUnpaidInvoices();

                // If the database has fewer unpaid invoices than what our screen currently shows,
                // it means a webhook successfully marked one as paid. Refresh the UI!
                if (liveCount !== null && liveCount < currentUnpaidCount) {
                    router.refresh();
                }
            } catch (error) {
                // The tab was opened before a deploy, so this action id no longer exists on the
                // server. Reload to pick up the current build instead of failing on every tick.
                if (reloadOnceOnStaleServerAction(error)) {
                    clearInterval(interval);
                    return;
                }
                console.warn("[GlobalInvoicePoller] poll failed", error);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [currentUnpaidCount, router]);

    return null;
}

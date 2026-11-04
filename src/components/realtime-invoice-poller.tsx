"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkInvoiceStatus } from "@/app/actions/check-invoice-status";
import { reloadOnceOnStaleServerAction } from "@/lib/stale-server-action";

export function RealtimeInvoicePoller({ invoiceId }: { invoiceId: string }) {
    const router = useRouter();

    useEffect(() => {
        // Poll the server every 5 seconds to check if the invoice status has changed to "PAID"
        const interval = setInterval(async () => {
            try {
                const status = await checkInvoiceStatus(invoiceId);

                if (status === "PAID") {
                    // If the webhook updated the DB to paid, immediately refresh the current route.
                    // This will seamlessly re-fetch server components and dump the "Unpaid" UI.
                    router.refresh();
                }
            } catch (error) {
                // The tab was opened before a deploy, so this action id no longer exists on the
                // server. Reload to pick up the current build instead of failing on every tick.
                if (reloadOnceOnStaleServerAction(error)) {
                    clearInterval(interval);
                    return;
                }
                console.warn("[RealtimeInvoicePoller] poll failed", error);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [invoiceId, router]);

    // This component renders absolutely nothing visually. It just runs the background effect.
    return null;
}

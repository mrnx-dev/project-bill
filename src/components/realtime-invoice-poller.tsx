"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkInvoiceStatus } from "@/app/actions/check-invoice-status";

export function RealtimeInvoicePoller({ invoiceId }: { invoiceId: string }) {
    const router = useRouter();

    useEffect(() => {
        // Poll the server every 5 seconds to check if the invoice status has changed to "PAID"
        const interval = setInterval(async () => {
            const status = await checkInvoiceStatus(invoiceId);

            if (status === "PAID") {
                // If the webhook updated the DB to paid, immediately refresh the current route.
                // This will seamlessly re-fetch server components and dump the "Unpaid" UI.
                router.refresh();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [invoiceId, router]);

    // This component renders absolutely nothing visually. It just runs the background effect.
    return null;
}

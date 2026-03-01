"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export function PrintButton() {
    return (
        <Button
            onClick={() => window.print()}
            variant="outline"
            className="print:hidden flex items-center gap-2 text-slate-600 border-slate-300 hover:bg-slate-50"
        >
            <Printer size={16} />
            Download PDF / Print
        </Button>
    )
}

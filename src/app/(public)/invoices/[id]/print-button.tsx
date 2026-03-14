"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton({ invoiceId }: { invoiceId: string }) {
  return (
    <Button
      onClick={() => window.open(`/invoices/${invoiceId}/print`, "_blank")}
      variant="outline"
      className="print:hidden flex items-center gap-2 text-slate-600 border-slate-300 hover:bg-slate-50"
    >
      <Printer size={16} />
      Download PDF / Print
    </Button>
  );
}

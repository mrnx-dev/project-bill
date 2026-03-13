"use client";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Copy, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ManualPaymentProps {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  invoiceNumber: string;
  lang: "id" | "en";
}

export function ManualPaymentInstructions({
  bankName,
  bankAccountName,
  bankAccountNumber,
  invoiceNumber,
  lang,
}: ManualPaymentProps) {
  const isEn = lang === "en";

  const handleCopy = () => {
    if (bankAccountNumber) {
      navigator.clipboard.writeText(bankAccountNumber);
      toast.success(isEn ? "Account number copied!" : "Nomor rekening disalin!");
    }
  };

  return (
    <Alert className="bg-slate-50 border-slate-200 print:hidden mb-6">
      <Landmark className="h-4 w-4 text-slate-600" />
      <AlertTitle className="font-bold text-slate-800">
        {isEn ? "Manual Bank Transfer" : "Transfer Bank Manual"}
      </AlertTitle>
      <AlertDescription className="text-slate-600 space-y-3 mt-2">
        <p>
          {isEn
            ? `Please transfer the exact amount manually. Include Invoice ${invoiceNumber} in your transfer reference.`
            : `Silakan lakukan transfer secara manual. Cantumkan Invoice ${invoiceNumber} pada berita transfer.`}
        </p>

        <div className="bg-white p-4 rounded-md border shadow-sm">
          <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
            <span className="text-slate-500 font-medium">{isEn ? "Bank" : "Bank"}:</span>
            <span className="font-semibold text-slate-900">{bankName || "-"}</span>

            <span className="text-slate-500 font-medium">{isEn ? "Account Name" : "Atas Nama"}:</span>
            <span className="font-semibold text-slate-900">{bankAccountName || "-"}</span>

            <span className="text-slate-500 font-medium flex items-center">{isEn ? "Account No" : "No Rekening"}:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base text-slate-900">{bankAccountNumber || "-"}</span>
              {bankAccountNumber && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-900" onClick={handleCopy} title="Copy">
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

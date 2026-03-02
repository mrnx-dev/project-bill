"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, FileCheck2 } from "lucide-react";

interface TermsAgreementProps {
  projectId: string;
  terms: string;
  termsAcceptedAt: string | null;
  children: React.ReactNode; // PayButton will be passed as children
}

export function TermsAgreement({
  projectId,
  terms,
  termsAcceptedAt,
  children,
}: TermsAgreementProps) {
  const [accepted, setAccepted] = useState(!!termsAcceptedAt);
  const [acceptedDate, setAcceptedDate] = useState<string | null>(
    termsAcceptedAt,
  );
  const [checked, setChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/accept-terms`, {
        method: "PATCH",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept terms");
      }

      setAccepted(true);
      setAcceptedDate(data.termsAcceptedAt);
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Terms already accepted — show confirmation banner + PayButton
  if (accepted) {
    return (
      <div className="print:hidden">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Terms & Conditions Accepted
            </p>
            {acceptedDate && (
              <p className="text-xs text-emerald-600">
                Digitally signed on{" "}
                {new Date(acceptedDate).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  }

  // Terms NOT yet accepted — show agreement card, hide PayButton
  return (
    <div className="print:hidden">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FileCheck2 className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
              Digital Agreement Required
            </h3>
            <p className="text-xs text-slate-500">
              Please review and accept the terms below to proceed with payment.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-4 max-h-[240px] overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mb-4 shadow-inner">
          {terms}
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            I have read and agree to the <strong>Terms & Conditions</strong> and{" "}
            <strong>Statement of Work</strong> outlined above.
          </span>
        </label>

        <Button
          onClick={handleAccept}
          disabled={!checked || isLoading}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4 mr-2" />
          )}
          {isLoading ? "Processing..." : "Accept Terms & Proceed to Payment"}
        </Button>
      </div>

      {/* PayButton stays hidden until terms are accepted */}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, FileCheck2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [isOpen, setIsOpen] = useState(false);

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
      setIsOpen(false);
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
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Valid Digital Contract Formed
            </p>
            {acceptedDate && (
              <p className="text-xs text-emerald-600 font-medium">
                Digitally signed and accepted on{" "}
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
          <div className="ml-auto">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-50" />
          </div>
        </div>
        {children}
      </div>
    );
  }

  // Terms NOT yet accepted — show dialog trigger card, hide PayButton
  return (
    <div className="print:hidden">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-amber-50/50 border-2 border-amber-200 border-dashed rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:bg-amber-50">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-amber-100 p-3 rounded-full shrink-0">
              <FileCheck2 className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base uppercase tracking-wider">
                Digital Agreement Required
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md leading-relaxed">
                A formal Statement of Work (SOW) has been drafted for this project. Please review and securely sign the terms to unlock the payment module.
              </p>
            </div>
          </div>

          <DialogTrigger asChild>
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white w-full md:w-auto font-medium shadow-sm transition-all shadow-amber-600/20">
              Review & Sign SOW
            </Button>
          </DialogTrigger>
        </div>

        <DialogContent className="light-theme max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 sm:rounded-xl">
          <DialogHeader className="p-6 pb-5 border-b bg-white">
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <DialogTitle className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Statement of Work & Terms</DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 text-sm">
              This is a legally binding mutual agreement. Please review the detailed scope and terms carefully.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 relative">
            <div className="bg-white border rounded-lg shadow-sm min-h-[400px]">
              <div className="p-6 md:p-8 prose prose-sm md:prose-base max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-serif">
                {terms}
              </div>
            </div>
          </div>

          <div className="p-6 pt-5 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
            <label className="flex items-start gap-4 cursor-pointer select-none mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 transition-colors hover:bg-blue-50/50 hover:border-blue-200">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
              />
              <span className="text-sm text-slate-700 leading-relaxed font-medium">
                I acknowledge that I have read and agree to all the <strong className="text-slate-900">Terms & Conditions</strong> and{" "}
                <strong className="text-slate-900">Statement of Work</strong> outlined in the document above. My digital signature below serves as a formal, legally binding acceptance of these terms.
              </span>
            </label>

            <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-0 mt-2">
              <Button variant="outline" className="w-full sm:w-auto border-slate-300 font-medium" onClick={() => setIsOpen(false)} disabled={isLoading}>
                Close & Review Later
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!checked || isLoading}
                size="default"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white min-w-[200px] font-semibold tracking-wide transition-all shadow-md shadow-blue-600/20 disabled:shadow-none"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                {isLoading ? "Securely Signing..." : "Digitally Sign & Accept"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

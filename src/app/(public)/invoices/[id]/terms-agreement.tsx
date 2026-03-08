"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, FileCheck2, CheckCircle2, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { format } from "date-fns";
import { id as localeId, enUS as localeEn } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TranslationKey = "validContract" | "signedOn" | "printSave" | "digitalAgreementRequired" | "reviewSignDescription" | "reviewSignBtn" | "sowTermsTitle" | "sowTermsDescription" | "scrollToBottom" | "acknowledgeText" | "termsConditions" | "statementOfWork" | "cancel" | "signAgreement" | "signing";

const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    validContract: "Valid Digital Contract Formed",
    signedOn: "Digitally signed and accepted on",
    printSave: "Print / Save PDF",
    digitalAgreementRequired: "Digital Agreement Required",
    reviewSignDescription: "A formal Statement of Work (SOW) has been drafted for this project. Please review and securely sign the terms to unlock the payment module.",
    reviewSignBtn: "Review & Sign SOW",
    sowTermsTitle: "Statement of Work & Terms",
    sowTermsDescription: "This is a legally binding mutual agreement. Please review the detailed scope and terms carefully.",
    scrollToBottom: "Scroll to the bottom of the document to accept",
    acknowledgeText: "I acknowledge that I have read and agree to all the [TERMS] and [SOW] outlined above. My digital signature below serves as a formal, legally binding acceptance of this agreement.",
    termsConditions: "Terms & Conditions",
    statementOfWork: "Statement of Work",
    cancel: "Cancel",
    signAgreement: "Sign Agreement",
    signing: "Signing..."
  },
  id: {
    validContract: "Kontrak Digital Sah Dibuat",
    signedOn: "Ditandatangani secara digital dan disetujui pada",
    printSave: "Cetak / Simpan PDF",
    digitalAgreementRequired: "Persetujuan Digital Diperlukan",
    reviewSignDescription: "Perjanjian Kerja (SOW) formal telah disusun untuk proyek ini. Silakan tinjau dan tandatangani syarat secara aman untuk membuka modul pembayaran.",
    reviewSignBtn: "Tinjau & Tandatangani SOW",
    sowTermsTitle: "Perjanjian Kerja (SOW) & Syarat",
    sowTermsDescription: "Ini adalah perjanjian bersama yang mengikat secara hukum. Harap tinjau cakupan detail dan ketentuan secara saksama.",
    scrollToBottom: "Gulir ke bagian bawah dokumen untuk menyetujui",
    acknowledgeText: "Saya menyatakan telah membaca dan menyetujui semua [TERMS] dan [SOW] yang diuraikan di atas. Tanda tangan digital saya di bawah ini berfungsi sebagai penerimaan yang sah secara hukum dan mengikat secara formal atas perjanjian ini.",
    termsConditions: "Syarat & Ketentuan",
    statementOfWork: "Perjanjian Kerja",
    cancel: "Batal",
    signAgreement: "Tandatangani Perjanjian",
    signing: "Menandatangani..."
  }
};

interface TermsAgreementProps {
  projectId: string;
  terms: string;
  termsAcceptedAt: string | null;
  language?: "en" | "id";
  children: React.ReactNode;
}

export function TermsAgreement({
  projectId,
  terms,
  termsAcceptedAt,
  language = "en",
  children,
}: TermsAgreementProps) {
  const [accepted, setAccepted] = useState(!!termsAcceptedAt);
  const [acceptedDate, setAcceptedDate] = useState<string | null>(
    termsAcceptedAt,
  );
  const [checked, setChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];
  const dateLocale = language === "id" ? localeId : localeEn;
  const dateFormat = language === "id" ? "d MMMM yyyy, HH:mm" : "MMMM d, yyyy, h:mm a";

  // Check if content is already smaller than container on mount/open
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollHeight <= clientHeight + 5) {
        setHasScrolledToBottom(true);
      }
    } else if (!isOpen) {
      setHasScrolledToBottom(false);
      setChecked(false);
    }
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setHasScrolledToBottom(true);
    }
  };

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
    } catch (error: unknown) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to accept terms");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to render acknowledge text with bold elements
  const renderAcknowledgeText = () => {
    const parts = t.acknowledgeText.split(/(\[TERMS\]|\[SOW\])/g);
    return (
      <span className={`text-sm leading-relaxed ${hasScrolledToBottom ? "text-slate-700" : "text-slate-400"}`}>
        {parts.map((part, index) => {
          if (part === "[TERMS]") {
            return (
              <strong key={index} className={hasScrolledToBottom ? "text-slate-900" : "text-slate-500"}>
                {t.termsConditions}
              </strong>
            );
          }
          if (part === "[SOW]") {
            return (
              <strong key={index} className={hasScrolledToBottom ? "text-slate-900" : "text-slate-500"}>
                {t.statementOfWork}
              </strong>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  // Terms already accepted — show confirmation banner + PayButton
  if (accepted) {
    return (
      <div className="print:hidden">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {t.validContract}
            </p>
            {acceptedDate && (
              <p className="text-xs text-emerald-600 font-medium">
                {t.signedOn} {format(new Date(acceptedDate), dateFormat, { locale: dateLocale })}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a
              href={`/invoices/${projectId}/sow/print`}
              target="_blank"
              onClick={(e) => {
                // Prevent default navigation initially, use window.open
                e.preventDefault();
                window.open(`/invoices/${projectId}/sow/print`, '_blank');
              }}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 h-8 px-3 py-1 shadow-sm"
            >
              <Download className="w-3 h-3 mr-1.5" />
              {t.printSave}
            </a>
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
                {t.digitalAgreementRequired}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md leading-relaxed">
                {t.reviewSignDescription}
              </p>
            </div>
          </div>

          <DialogTrigger asChild>
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white w-full md:w-auto font-medium shadow-sm transition-all shadow-amber-600/20">
              {t.reviewSignBtn}
            </Button>
          </DialogTrigger>
        </div>

        <DialogContent className="light-theme max-w-[900px] sm:max-w-[900px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden bg-slate-50 sm:rounded-xl">
          <DialogHeader className="p-6 pb-5 border-b bg-white">
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <DialogTitle className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{t.sowTermsTitle}</DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 text-sm">
              {t.sowTermsDescription}
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 relative"
            onScroll={handleScroll}
            ref={scrollContainerRef}
          >
            <div className="bg-white border rounded-lg shadow-sm min-h-[400px]">
              <div className="p-6 md:p-8 prose prose-sm md:prose-base max-w-none text-slate-700 leading-relaxed text-justify">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {terms}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="border-t bg-white z-10">
            {/* Agreement Checkbox */}
            <div className={`px-6 pt-5 pb-4 transition-opacity duration-300 ${!hasScrolledToBottom ? "opacity-50" : "opacity-100"}`}>
              {!hasScrolledToBottom && (
                <div className="mb-3 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 inline-block">
                  {t.scrollToBottom}
                </div>
              )}
              <label
                className={`flex items-start gap-4 select-none p-4 rounded-xl border-2 transition-all duration-200 ${!hasScrolledToBottom
                  ? "cursor-not-allowed bg-slate-50 border-slate-200 grayscale"
                  : checked
                    ? "cursor-pointer bg-blue-50/80 border-blue-300 shadow-sm shadow-blue-100"
                    : "cursor-pointer bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
              >
                <div className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded border-2 transition-all duration-200 shrink-0 ${checked
                  ? "bg-blue-600 border-blue-600"
                  : hasScrolledToBottom
                    ? "bg-white border-slate-300"
                    : "bg-slate-100 border-slate-200"
                  }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => hasScrolledToBottom && setChecked(e.target.checked)}
                    disabled={!hasScrolledToBottom}
                    className="sr-only"
                  />
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {renderAcknowledgeText()}
              </label>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
              <Button
                variant="ghost"
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-medium px-6"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!checked || isLoading}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white min-w-[220px] font-semibold tracking-wide transition-all duration-200 shadow-lg shadow-blue-600/25 disabled:shadow-none disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 rounded-xl h-12"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                {isLoading ? t.signing : t.signAgreement}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

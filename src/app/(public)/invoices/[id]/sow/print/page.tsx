"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ContractDocument, type ContractDocumentProps } from "@/components/contract-document";

export default function SOWPrintPage() {
    const params = useParams();
    const router = useRouter();
    const invoiceId = params.id as string;

    const [project, setProject] = useState<ContractDocumentProps | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchProjectAndSettings() {
            try {
                const projRes = await fetch(`/api/invoices/${invoiceId}/public-sow`);

                if (!projRes.ok) throw new Error("Failed to fetch contract");

                const projData = await projRes.json();
                setProject(projData);
            } catch (error) {
                console.error(error);
                router.push(`/invoices/${invoiceId}`);
            } finally {
                setIsLoading(false);
            }
        }
        fetchProjectAndSettings();
    }, [invoiceId, router]);

    // Automatically trigger print dialog when loaded
    useEffect(() => {
        if (!isLoading && project) {
            // Small delay to ensure styles and fonts are applied
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [isLoading, project]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="bg-white text-slate-900 min-h-screen p-8 md:p-12 mx-auto max-w-[21cm]">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 2cm;
                    }
                    body {
                        background: white;
                    }
                    /* Ensure exact colors are printed */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="print-content block">
                <ContractDocument {...project} />
            </div>
        </div>
    );
}

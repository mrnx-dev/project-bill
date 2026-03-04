"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export default function SOWPrintPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchProject() {
            try {
                // Fetch the project and terms through an existing API we can create or use
                // Wait, we need an endpoint to fetch project details for a public invoice view
                // Actually the invoice page already fetches invoice + project. Let's create a quick API.
                const res = await fetch(`/api/projects/${projectId}/public-sow`);
                if (!res.ok) throw new Error("Failed to fetch SOW");
                const data = await res.json();
                setProject(data);
            } catch (error) {
                console.error(error);
                router.push(`/invoices/${projectId}`);
            } finally {
                setIsLoading(false);
            }
        }
        fetchProject();
    }, [projectId, router]);

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
        <div className="bg-white text-black min-h-screen p-8 md:p-12 font-serif mx-auto max-w-[21cm]">
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
                <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-slate-900">Statement of Work</h1>
                        <h2 className="text-xl text-slate-600">{project.title}</h2>
                    </div>
                    <div className="text-right text-sm text-slate-500 flex flex-col gap-1">
                        <p><strong className="text-slate-700">Client:</strong> {project.client.name}</p>
                        <p><strong className="text-slate-700">Date Generated:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed text-justify mb-16">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {project.terms}
                    </ReactMarkdown>
                </div>

                {project.termsAcceptedAt && (
                    <div className="mt-16 pt-6 border-t-2 border-slate-900">
                        <h3 className="font-bold text-lg mb-4 text-slate-900">Electronic Signature - Audit Trail</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm text-slate-700">
                            <div>
                                <span className="block font-semibold text-slate-900 mb-1">Accepted By</span>
                                <span className="bg-slate-100 px-3 py-1.5 rounded inline-block w-full">{project.client.name}</span>
                            </div>
                            <div>
                                <span className="block font-semibold text-slate-900 mb-1">Timestamp (UTC)</span>
                                <span className="bg-slate-100 px-3 py-1.5 rounded inline-block w-full">{new Date(project.termsAcceptedAt).toUTCString()}</span>
                            </div>
                            <div>
                                <span className="block font-semibold text-slate-900 mb-1">User Agent</span>
                                <span className="bg-slate-100 px-3 py-1.5 rounded inline-block w-full text-xs break-all truncate">{project.termsAcceptedUserAgent || "Unknown"}</span>
                            </div>
                            <div>
                                <span className="block font-semibold text-slate-900 mb-1">Session ID Verification</span>
                                <span className="bg-slate-100 px-3 py-1.5 rounded inline-block w-full text-xs break-all">{project.termsAcceptedSessionId || "Unknown"}</span>
                            </div>
                        </div>

                        <p className="mt-8 text-xs text-slate-400 text-center italic">
                            This document serves as a secure digital agreement generated by ProjectBill.
                            The audit trail above validates non-repudiation of the contracting parties.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

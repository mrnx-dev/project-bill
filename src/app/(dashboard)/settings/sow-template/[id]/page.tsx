"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, FileText, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export default function SOWTemplatePage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const isNew = id === "new";

    const [name, setName] = useState("");
    const [template, setTemplate] = useState("");
    const [isLoading, setIsLoading] = useState(!isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreview, setIsPreview] = useState(false);

    useEffect(() => {
        if (isNew) return;

        async function fetchTemplate() {
            try {
                const res = await fetch(`/api/sow-templates/${id}`);
                if (!res.ok) throw new Error("Failed to fetch SOW template");
                const data = await res.json();
                setName(data.name || "");
                setTemplate(data.content || "");
            } catch (error) {
                console.error(error);
                toast.error("Failed to load template");
                router.push("/settings/sow-template");
            } finally {
                setIsLoading(false);
            }
        }
        fetchTemplate();
    }, [id, isNew, router]);

    async function handleSave() {
        if (!name.trim()) {
            toast.error("Template name is required");
            return;
        }

        setIsSaving(true);
        try {
            const endpoint = isNew ? "/api/sow-templates" : `/api/sow-templates/${id}`;
            const method = isNew ? "POST" : "PUT";

            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, content: template }),
            });

            if (!res.ok) throw new Error("Failed to save SOW template");

            toast.success("SOW Template saved successfully!");
            router.push("/settings/sow-template");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save template.");
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/settings/sow-template">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-xl font-bold">{isNew ? "Create New Template" : "Edit Template"}</h2>
                </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-lg dark:bg-zinc-950 dark:border-zinc-800 flex flex-col gap-4">

                <div className="flex flex-col gap-2 mb-4">
                    <label className="text-sm font-medium">Template Name</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Website Development (ID), SEO Service (EN)"
                        className="max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    />
                </div>

                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2 dark:text-zinc-100">
                        <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Editor Layout
                    </h3>
                    <div className="flex bg-slate-200/50 dark:bg-zinc-900 border dark:border-zinc-800 p-1 rounded-md">
                        <button
                            onClick={() => setIsPreview(false)}
                            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${!isPreview ? 'bg-white dark:bg-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                        >
                            Edit Text
                        </button>
                        <button
                            onClick={() => setIsPreview(true)}
                            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${isPreview ? 'bg-white dark:bg-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                        >
                            Preview
                        </button>
                    </div>
                </div>

                {isPreview ? (
                    <div className="p-6 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md shadow-sm min-h-[400px] overflow-y-auto max-h-[600px]">
                        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-slate-700 dark:text-zinc-300 leading-relaxed text-justify">
                            {template ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                    {template}
                                </ReactMarkdown>
                            ) : (
                                <span className="text-slate-300 dark:text-zinc-600 italic">No template text provided...</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <Textarea
                        className="font-mono min-h-[400px] text-sm leading-relaxed p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        value={template}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTemplate(e.target.value)}
                        placeholder="Enter your SOW Template here..."
                    />
                )}

                <div className="flex justify-end mt-4">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Template
                    </Button>
                </div>
            </div>
        </div>
    );
}

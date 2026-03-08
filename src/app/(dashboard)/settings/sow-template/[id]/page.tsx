"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, NotepadTextDashed, ArrowLeft } from "lucide-react";
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
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800" asChild>
                        <Link href="/settings/sow-template">
                            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                            {isNew ? "Create New Template" : "Edit Template"}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                            {isNew ? "Design a reusable contract template for your projects." : "Update your existing contract template."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="hidden md:flex rounded-full px-6 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300" asChild>
                        <Link href="/settings/sow-template">Cancel</Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-full px-6 shadow-md hover:shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto">
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {isNew ? "Create Template" : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm dark:bg-zinc-950 dark:border-zinc-800 flex flex-col gap-8">

                <div className="flex flex-col gap-3">
                    <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Template Name</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Website Development (ID), SEO Service (EN)"
                        className="max-w-xl h-12 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus-visible:ring-indigo-500 rounded-xl"
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                                <NotepadTextDashed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="font-semibold text-lg text-slate-900 dark:text-zinc-100">
                                Document Content
                            </h3>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-zinc-800">
                            <button
                                onClick={() => setIsPreview(false)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${!isPreview
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100 border border-slate-200/50 dark:border-zinc-700/50'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                            >
                                Write
                            </button>
                            <button
                                onClick={() => setIsPreview(true)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${isPreview
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100 border border-slate-200/50 dark:border-zinc-700/50'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                            >
                                Preview
                            </button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                        {isPreview ? (
                            <div className="p-8 min-h-[500px] overflow-y-auto max-h-[800px] bg-slate-50/50 dark:bg-zinc-950/50">
                                <div className="prose prose-slate dark:prose-invert max-w-3xl mx-auto prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 text-slate-700 dark:text-zinc-300 leading-relaxed text-justify">
                                    {template ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                            {template}
                                        </ReactMarkdown>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full py-20 opacity-50">
                                            <NotepadTextDashed className="w-12 h-12 mb-4 text-slate-400" />
                                            <span className="text-slate-500 dark:text-zinc-500 italic">No content provided yet. Switch to 'Write' mode to start typing.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <Textarea
                                className="font-mono min-h-[500px] text-sm leading-relaxed p-6 bg-transparent border-0 focus-visible:ring-0 resize-y text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                                value={template}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTemplate(e.target.value)}
                                placeholder="Write your template using Markdown here...&#10;&#10;## 1. Scope of Work&#10;Describe the services to be provided...&#10;&#10;## 2. Payment Terms&#10;- 50% Upfront&#10;- 50% Upon Completion"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

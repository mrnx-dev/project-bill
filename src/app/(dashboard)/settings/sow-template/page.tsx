"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Edit, Trash2, NotepadTextDashed } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";

import { useRouter } from "next/navigation";
import { UpgradeDialog } from "@/components/subscription/upgrade-dialog";

interface SOWTemplate {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}


export default function SOWTemplateListPage() {
    const [templates, setTemplates] = useState<SOWTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isUpgradeLimitOpen, setIsUpgradeLimitOpen] = useState(false);
    const [currentLimit, setCurrentLimit] = useState<number>(0);
    const router = useRouter();

    useEffect(() => {
        fetchTemplates();
    }, []);

    async function fetchTemplates() {
        try {
            const res = await fetch("/api/sow-templates");
            if (!res.ok) throw new Error("Failed to fetch SOW templates");
            const data = await res.json();
            setTemplates(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load templates");
        } finally {
            setIsLoading(false);
        }
    }

    const handleCreateClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/subscription/check?resource=sowTemplates");
            if (res.ok) {
                const check = await res.json();
                if (!check.allowed) {
                    setCurrentLimit(check.limit || 0);
                    setIsUpgradeLimitOpen(true);
                    return;
                }
            }
        } catch (error) {
            console.error("Failed to check subscription limit:", error);
        }
        
        router.push("/settings/sow-template/new");
    };

    async function handleDeleteConfirmed() {
        if (!deleteConfirmId) return;
        const id = deleteConfirmId;
        try {
            const res = await fetch(`/api/sow-templates/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete SOW template");
            toast.success("Template deleted successfully!");
            setTemplates(templates.filter(t => t.id !== id));
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete template.");
        } finally {
            setDeleteConfirmId(null);
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
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100 p-6 rounded-xl dark:from-zinc-900 dark:to-zinc-950 dark:border-zinc-800 relative overflow-hidden shadow-sm">
                <div className="relative z-10 w-full mb-4 md:mb-0">
                    <h3 className="font-bold text-2xl tracking-tight flex items-center gap-3 text-slate-900 dark:text-zinc-50">
                        <div className="p-2.5 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-slate-100 dark:border-zinc-700">
                            <NotepadTextDashed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        Agreement Templates
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-xl leading-relaxed">
                        Standardize your agreements. Create reusable SOW templates tailored to different services, languages, or client tiers.
                    </p>
                </div>
                <div className="relative z-10 flex-shrink-0 w-full md:w-auto">
                    <Button onClick={handleCreateClick} className="w-full md:w-auto shadow-md hover:shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Template
                    </Button>
                </div>

                {/* Decorative background element */}
                <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            </div>

            {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl bg-slate-50/50 dark:bg-zinc-900/20 dark:border-zinc-800 transition-all hover:bg-slate-50 dark:hover:bg-zinc-900/40">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4 transform -rotate-6 shadow-sm border border-indigo-200 dark:border-indigo-800">
                        <NotepadTextDashed className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-1">No Templates Yet</h4>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-[280px] text-center mb-6">
                        Start building your library of reusable contracts to streamline your onboarding workflow.
                    </p>
                    <Button onClick={handleCreateClick} variant="outline" className="rounded-full shadow-sm hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-zinc-800 dark:hover:text-indigo-300 transition-colors border-indigo-200 dark:border-zinc-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Draft First Template
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {templates.map(template => (
                        <div key={template.id} className="group relative bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col gap-4 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-900/50 overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full" onClick={() => setDeleteConfirmId(template.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex flex-col h-full">
                                <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl w-fit mb-4 border border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 dark:group-hover:bg-indigo-500/10 dark:group-hover:text-indigo-400 dark:group-hover:border-indigo-500/20 transition-colors">
                                    <NotepadTextDashed className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-lg text-slate-900 dark:text-zinc-100 line-clamp-2 md:line-clamp-1 mb-1 pr-8" title={template.name}>
                                    {template.name}
                                </h4>
                                <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 mb-6">
                                    Updated {new Date(template.updatedAt).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>

                                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800/50 flex w-full">
                                    <Button variant="ghost" className="w-full flex justify-between items-center text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors rounded-lg h-10 px-3" asChild>
                                        <Link href={`/settings/sow-template/${template.id}`}>
                                            <span className="font-semibold text-sm">Edit Template</span>
                                            <Edit className="w-4 h-4 ml-2" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!deleteConfirmId}
                onOpenChange={(open) => !open && setDeleteConfirmId(null)}
                title="Delete Template?"
                description="Are you sure you want to delete this template? This cannot be undone."
                onConfirm={handleDeleteConfirmed}
            />

            <UpgradeDialog 
                isOpen={isUpgradeLimitOpen} 
                onOpenChange={setIsUpgradeLimitOpen}
                resourceName="Agreement Templates"
                limit={currentLimit}
            />
        </div>
    );
}

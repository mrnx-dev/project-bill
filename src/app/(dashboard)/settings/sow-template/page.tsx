"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Edit, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
            <div className="flex justify-between items-center bg-zinc-50 border border-zinc-200 p-6 rounded-lg dark:bg-zinc-950 dark:border-zinc-800">
                <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 dark:text-zinc-100">
                        <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Managed Templates
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create multiple contract templates to quickly generate SOWs for different services.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/settings/sow-template/new">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Template
                    </Link>
                </Button>
            </div>

            {templates.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50">
                    <p className="text-muted-foreground">No templates found. Create one to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(template => (
                        <div key={template.id} className="border bg-white dark:bg-zinc-950 dark:border-zinc-800 p-5 rounded-lg shadow-sm flex flex-col gap-4 transition-all hover:shadow-md">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-zinc-100 line-clamp-1" title={template.name}>
                                        {template.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Last updated: {new Date(template.updatedAt).toLocaleDateString("en-US")}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-zinc-800">
                                <Button variant="outline" size="sm" className="flex-1" asChild>
                                    <Link href={`/settings/sow-template/${template.id}`}>
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                    </Link>
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(template.id)} className="px-3">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
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
        </div>
    );
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { ProjectDetailsDialog } from "./project-details-dialog"
import { CheckCircle2, PartyPopper, FileText, SkipForward, Archive } from "lucide-react"

type Client = { id: string, name: string }
type ProjectItem = { id: string, description: string, price: string }
type Project = {
    id: string
    title: string
    status: string
    totalPrice: string
    dpAmount?: string | null
    currency?: string
    client: Client
    items?: ProjectItem[]
    invoices?: any[]
    deadline?: string | null
}

const COLUMNS = [
    { id: "to_do", title: "To Do" },
    { id: "in_progress", title: "In Progress" },
    { id: "review", title: "Review" },
    { id: "done", title: "Done" },
]

export function DashboardClient({ initialProjects }: { initialProjects: Project[] }) {
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [isGenerating, setIsGenerating] = useState<string | null>(null)
    const [selectedProjectForItems, setSelectedProjectForItems] = useState<string | null>(null)

    // Completion Dialog State
    const [completionProject, setCompletionProject] = useState<Project | null>(null)
    const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false)

    // Archive Toggle State
    const [showArchived, setShowArchived] = useState(false)

    const formatCurrency = (amount: string | number, currencyStr: string) => {
        return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
            style: "currency",
            currency: currencyStr,
            minimumFractionDigits: 0
        }).format(Number(amount))
    }

    const isFullyPaidDone = (project: Project) => {
        if (project.status !== "done") return false
        const fullInv = project.invoices?.find((i: any) => i.type === "full_payment")
        return fullInv?.status === "paid"
    }

    const handleStatusChange = async (projectId: string, newStatus: string) => {
        const project = projects.find(p => p.id === projectId)
        if (!project) return

        // Intercept: if moving to "done", show completion dialog
        if (newStatus === "done" && project.status !== "done") {
            setCompletionProject(project)
            setIsCompletionDialogOpen(true)
            return
        }

        // Normal status update
        setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p))

        try {
            await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            })
            router.refresh()
        } catch (error) {
            console.error(error)
            setProjects(initialProjects)
        }
    }

    const handleCompletionConfirm = async (generateInvoice: boolean) => {
        if (!completionProject) return

        const projectId = completionProject.id

        // Update status to done
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: "done" } : p))
        setIsCompletionDialogOpen(false)

        try {
            await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "done" })
            })

            // Generate invoice if requested
            if (generateInvoice) {
                await handleGenerateInvoice(projectId)
            }

            router.refresh()
        } catch (error) {
            console.error(error)
            setProjects(initialProjects)
        }

        setCompletionProject(null)
    }

    const handleGenerateInvoice = async (projectId: string) => {
        setIsGenerating(projectId)
        try {
            const res = await fetch(`/api/invoices/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId })
            })
            if (res.ok) {
                const data = await res.json()

                if (data.invoice) {
                    setProjects(prev => prev.map(p =>
                        p.id === projectId
                            ? { ...p, invoices: [...(p.invoices || []), data.invoice] }
                            : p
                    ))
                }

                if (data.emailSent) {
                    alert("Invoice generated and email dispatched to client")
                } else {
                    alert("Invoice generated successfully. (Email skipped or mocked)")
                }
                router.refresh()
            } else {
                console.error("Failed to generate invoice")
                alert("Failed to generate invoice")
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsGenerating(null)
        }
    }

    const activeItemProject = projects.find(p => p.id === selectedProjectForItems)

    // Calculate invoice status for completion dialog
    const completionHasFullInvoice = completionProject?.invoices?.some((i: any) => i.type === "full_payment")
    const completionHasDpInvoice = completionProject?.invoices?.some((i: any) => i.type === "dp")
    const completionCanGenerateInvoice = !completionHasFullInvoice

    return (
        <div className="flex flex-col gap-6">
            {/* Archive Toggle */}
            <div className="flex justify-end">
                <Button
                    variant={showArchived ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-2"
                    onClick={() => setShowArchived(!showArchived)}
                >
                    <Archive className="h-3.5 w-3.5" />
                    {showArchived ? "Hide Archived" : "Show Archived"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {COLUMNS.map(column => {
                    let columnProjects = projects.filter(p => p.status === column.id)

                    // If archive toggle is OFF, hide fully-paid done projects
                    if (column.id === "done" && !showArchived) {
                        columnProjects = columnProjects.filter(p => !isFullyPaidDone(p))
                    }

                    const archivedCount = column.id === "done"
                        ? projects.filter(p => p.status === "done" && isFullyPaidDone(p)).length
                        : 0

                    return (
                        <div key={column.id} className="bg-muted/50 p-4 rounded-xl flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="font-semibold text-sm uppercase tracking-wide">{column.title}</h3>
                                <div className="flex items-center gap-1.5">
                                    {column.id === "done" && archivedCount > 0 && !showArchived && (
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                                            +{archivedCount} archived
                                        </Badge>
                                    )}
                                    <Badge variant="secondary">{columnProjects.length}</Badge>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 min-h-[500px]">
                                {columnProjects.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-8 italic">
                                        No projects here
                                    </div>
                                ) : (
                                    columnProjects.map(project => {
                                        const isDone = project.status === "done"
                                        const isPaidDone = isFullyPaidDone(project)

                                        return (
                                            <Card
                                                key={project.id}
                                                className={`shadow-sm transition-all ${isPaidDone
                                                        ? "border-l-4 border-l-emerald-500 bg-emerald-50/30 opacity-70 dark:bg-emerald-950/20"
                                                        : isDone
                                                            ? "border-l-4 border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
                                                            : ""
                                                    }`}
                                            >
                                                <CardHeader className="p-4 pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-base leading-tight flex items-center gap-1.5">
                                                                {isDone && (
                                                                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${isPaidDone ? "text-emerald-600" : "text-emerald-400"}`} />
                                                                )}
                                                                {project.title}
                                                            </CardTitle>
                                                            <CardDescription className="text-xs pt-1">{project.client.name}</CardDescription>
                                                            {project.deadline && (
                                                                <div className="mt-2">
                                                                    <Badge variant="outline" className="text-[10px] font-normal border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                                                                        Due: {new Date(project.deadline).toLocaleDateString()}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                            {isPaidDone && (
                                                                <div className="mt-2">
                                                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 text-[10px] py-0.5 px-2 uppercase tracking-widest font-bold">
                                                                        Completed & Paid
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[10px] px-2"
                                                            onClick={() => setSelectedProjectForItems(project.id)}
                                                        >
                                                            Scope / Items
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 pb-3">
                                                    <div className="text-sm font-medium">{formatCurrency(project.totalPrice, project.currency || "IDR")}</div>
                                                </CardContent>
                                                <CardFooter className="p-4 pt-0 flex flex-col gap-2">
                                                    <Select
                                                        value={project.status}
                                                        onValueChange={(val) => handleStatusChange(project.id, val)}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {COLUMNS.map(col => (
                                                                <SelectItem key={col.id} value={col.id} className="text-xs">{col.title}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    {project.status === "done" && (
                                                        <div className="w-full mt-2">
                                                            {project.invoices && project.invoices.find((i: any) => i.type === "full_payment") ? (
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    className="w-full text-xs font-semibold bg-green-600 hover:bg-green-700 text-white"
                                                                    onClick={() => {
                                                                        const inv = project.invoices!.find((i: any) => i.type === "full_payment");
                                                                        if (inv?.paymentLink) {
                                                                            window.open(inv.paymentLink, "_blank");
                                                                        }
                                                                    }}
                                                                >
                                                                    {project.invoices.find((i: any) => i.type === "full_payment").status === "paid"
                                                                        ? "View Receipt"
                                                                        : "Pay Now Link"}
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    className="w-full text-xs"
                                                                    disabled={isGenerating === project.id}
                                                                    onClick={() => handleGenerateInvoice(project.id)}
                                                                >
                                                                    {isGenerating === project.id ? "Generating..." : "Generate Invoice"}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardFooter>
                                            </Card>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Completion Dialog */}
            <Dialog open={isCompletionDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsCompletionDialogOpen(false)
                    setCompletionProject(null)
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <PartyPopper className="h-5 w-5 text-amber-500" />
                            Project Completed!
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            <span className="font-semibold text-foreground">&ldquo;{completionProject?.title}&rdquo;</span> akan dipindahkan ke <Badge variant="outline" className="ml-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Done</Badge>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">
                            Apakah Anda ingin langsung membuat tagihan pelunasan untuk <strong>{completionProject?.client.name}</strong>?
                        </p>

                        {completionProject && (
                            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Project</span>
                                    <span className="font-semibold">{formatCurrency(completionProject.totalPrice, completionProject.currency || "IDR")}</span>
                                </div>
                                {completionHasDpInvoice && completionProject.dpAmount && (
                                    <div className="flex justify-between text-emerald-600">
                                        <span>DP Terkirim</span>
                                        <span>-{formatCurrency(completionProject.dpAmount, completionProject.currency || "IDR")}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {completionHasFullInvoice && (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                ⚠️ Tagihan Full Payment sudah pernah dibuat untuk proyek ini.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => handleCompletionConfirm(false)}
                        >
                            <SkipForward className="h-4 w-4" />
                            Skip
                        </Button>
                        {completionCanGenerateInvoice && (
                            <Button
                                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleCompletionConfirm(true)}
                            >
                                <FileText className="h-4 w-4" />
                                Generate Invoice
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {activeItemProject && (
                <ProjectDetailsDialog
                    projectId={activeItemProject.id}
                    projectTitle={activeItemProject.title}
                    currency={activeItemProject.currency || "IDR"}
                    items={activeItemProject.items || []}
                    isOpen={!!selectedProjectForItems}
                    onClose={() => setSelectedProjectForItems(null)}
                    onItemAdded={(item, newTotal) => {
                        setProjects(prev => prev.map(p =>
                            p.id === activeItemProject.id
                                ? { ...p, totalPrice: newTotal, items: [...(p.items || []), item] }
                                : p
                        ))
                    }}
                    onItemDeleted={(itemId, newTotal) => {
                        setProjects(prev => prev.map(p =>
                            p.id === activeItemProject.id
                                ? { ...p, totalPrice: newTotal, items: (p.items || []).filter(i => i.id !== itemId) }
                                : p
                        ))
                    }}
                />
            )}
        </div>
    )
}

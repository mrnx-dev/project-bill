"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Plus, FileText } from "lucide-react"
import { useRouter } from "next/navigation"

type Client = { id: string, name: string }

type ProjectItem = {
    id?: string
    description: string
    price: string | number
}

type Project = {
    id: string
    title: string
    clientId: string
    client: Client
    status: string
    deadline?: string | null
    totalPrice: string
    dpAmount: string | null
    currency: string
    invoices: any[]
    items?: ProjectItem[]
    createdAt: string
    updatedAt: string
}

export function ProjectsClient({ initialProjects, clients }: { initialProjects: Project[], clients: Client[] }) {
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [searchQuery, setSearchQuery] = useState("")

    // Project Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [title, setTitle] = useState("")
    const [clientId, setClientId] = useState("")
    const [totalPrice, setTotalPrice] = useState("")
    const [dpAmount, setDpAmount] = useState("")
    const [currency, setCurrency] = useState("IDR")
    const [deadline, setDeadline] = useState("")

    const [items, setItems] = useState<ProjectItem[]>([])
    const [newItemDesc, setNewItemDesc] = useState("")
    const [newItemPrice, setNewItemPrice] = useState("")

    // Invoice Form State
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
    const [invoiceProject, setInvoiceProject] = useState<Project | null>(null)
    const [invoiceType, setInvoiceType] = useState<"dp" | "full_payment">("full_payment")

    const handleOpenDialog = (project?: Project) => {
        if (project) {
            setEditingId(project.id)
            setTitle(project.title)
            setClientId(project.clientId)
            setTotalPrice(project.totalPrice)
            setDpAmount(project.dpAmount || "")
            setCurrency(project.currency || "IDR")
            setDeadline(project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : "")
            setItems(project.items || [])
        } else {
            setEditingId(null)
            setTitle("")
            setClientId("")
            setTotalPrice("")
            setDpAmount("")
            setCurrency("IDR")
            setDeadline("")
            setItems([])
        }
        setNewItemDesc("")
        setNewItemPrice("")
        setIsDialogOpen(true)
    }

    const formatCurrency = (amount: string | number, currencyStr: string) => {
        return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
            style: "currency",
            currency: currencyStr,
            minimumFractionDigits: 0
        }).format(Number(amount))
    }

    const getInvoiceCalculation = (project: Project) => {
        const hasDpInvoice = project.invoices?.some(inv => inv.type === "dp")
        const hasFullInvoice = project.invoices?.some(inv => inv.type === "full_payment")
        const isDpPaid = project.invoices?.some(inv => inv.type === "dp" && inv.status === "paid")

        let fullPaymentAmount = Number(project.totalPrice)
        if (isDpPaid && project.dpAmount) {
            fullPaymentAmount = fullPaymentAmount - Number(project.dpAmount)
        }

        return { hasDpInvoice, hasFullInvoice, isDpPaid, fullPaymentAmount }
    }

    const handleOpenInvoiceDialog = (project: Project) => {
        setInvoiceProject(project)
        const calc = getInvoiceCalculation(project)

        if (!calc.hasDpInvoice && project.dpAmount) {
            setInvoiceType("dp")
        } else {
            setInvoiceType("full_payment")
        }

        setIsInvoiceDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!clientId) return alert("Please select a client")

        // Validate DP does not exceed total price
        if (dpAmount && parseFloat(dpAmount) > parseFloat(totalPrice)) {
            return alert("DP amount cannot exceed total price")
        }

        setIsLoading(true)

        try {
            let finalTotalPrice = totalPrice
            if (items.length > 0) {
                finalTotalPrice = items.reduce((sum, item) => sum + Number(item.price), 0).toString()
            }

            const payload = {
                title,
                clientId,
                totalPrice: finalTotalPrice,
                dpAmount: dpAmount || null,
                currency,
                deadline: deadline || null,
                items: editingId ? undefined : items
            }

            const url = editingId ? `/api/projects/${editingId}` : `/api/projects`
            const method = editingId ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                router.refresh()
                window.location.reload()
            } else {
                const data = await res.json().catch(() => null)
                alert(data?.error || "Failed to save project")
            }
        } catch (error) {
            console.error(error)
            alert("Network error. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleGenerateInvoice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!invoiceProject) return
        setIsLoading(true)

        try {
            const calc = getInvoiceCalculation(invoiceProject)
            const amount = invoiceType === "dp" ? invoiceProject.dpAmount : String(calc.fullPaymentAmount)

            const res = await fetch(`/api/invoices`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: invoiceProject.id,
                    type: invoiceType,
                    amount
                })
            })

            if (res.ok) {
                setIsInvoiceDialogOpen(false)
                router.push('/invoices')
            } else {
                alert("Failed to create invoice")
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project?")) return

        try {
            const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
            if (res.ok) {
                setProjects(projects.filter(p => p.id !== id))
                router.refresh()
            }
        } catch (error) {
            console.error(error)
        }
    }

    const filteredProjects = projects.filter(project =>
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.client.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Input
                    placeholder="Search projects or clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                />

                <div className="flex items-center gap-2">
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add Project
                    </Button>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingId ? "Edit Project" : "Add Project"}</DialogTitle>
                                <DialogDescription>
                                    {editingId ? "Make changes to your project here." : "Create a new project for a client."}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Project Title</Label>
                                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Website Redesign" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="client">Client</Label>
                                    <Select value={clientId} onValueChange={setClientId} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map(client => (
                                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="deadline">Deadline (Optional)</Label>
                                    <Input id="deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currency">Currency</Label>
                                        <Select value={currency} onValueChange={setCurrency}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Currency" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="IDR">IDR</SelectItem>
                                                <SelectItem value="USD" disabled>USD (Pending feature)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="totalPrice">Total Price</Label>
                                        <Input
                                            id="totalPrice"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={items.length > 0 ? items.reduce((sum, item) => sum + Number(item.price), 0) : totalPrice}
                                            onChange={e => setTotalPrice(e.target.value)}
                                            required
                                            disabled={items.length > 0}
                                            placeholder={items.length > 0 ? "Auto-calculated" : "1000.00"}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="dpAmount">DP Amount (Optional)</Label>
                                        <Input id="dpAmount" type="number" step="0.01" min="0" value={dpAmount} onChange={e => setDpAmount(e.target.value)} placeholder="300.00" />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2 border-t mt-4">
                                    <Label>Project Scope / Items {editingId ? "" : "(Optional)"}</Label>
                                    <p className="text-xs text-muted-foreground">Adding items will automatically calculate the Total Price.</p>

                                    {items.length > 0 && (
                                        <div className="flex flex-col gap-2 mb-3">
                                            {items.map((item, idx) => (
                                                <div key={item.id || idx} className="flex justify-between items-center text-sm border p-2 rounded-md bg-muted/20">
                                                    <span className="flex-1 truncate pr-2">{item.description}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-medium text-xs">{formatCurrency(item.price, currency)}</span>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (editingId && item.id) {
                                                                    if (!confirm("Remove this item?")) return
                                                                    try {
                                                                        const res = await fetch(`/api/projects/${editingId}/items/${item.id}`, { method: "DELETE" })
                                                                        if (res.ok) {
                                                                            const data = await res.json()
                                                                            setItems(items.filter((_, i) => i !== idx))
                                                                            setTotalPrice(String(data.projectTotal))
                                                                        } else {
                                                                            const errData = await res.json().catch(() => ({}))
                                                                            alert(errData.error || "Failed to delete item.")
                                                                        }
                                                                    } catch { alert("Network error") }
                                                                } else {
                                                                    setItems(items.filter((_, i) => i !== idx))
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 text-xs px-1"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Task description..."
                                            value={newItemDesc}
                                            onChange={(e) => setNewItemDesc(e.target.value)}
                                            className="flex-1 text-sm h-9"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Price"
                                            value={newItemPrice}
                                            onChange={(e) => setNewItemPrice(e.target.value)}
                                            className="w-[120px] text-sm h-9"
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            disabled={!newItemDesc || !newItemPrice}
                                            onClick={async () => {
                                                if (editingId) {
                                                    try {
                                                        const res = await fetch(`/api/projects/${editingId}/items`, {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ description: newItemDesc, price: newItemPrice })
                                                        })
                                                        if (res.ok) {
                                                            const data = await res.json()
                                                            setItems([...items, { id: data.item.id, description: data.item.description, price: String(data.item.price) }])
                                                            setTotalPrice(String(data.projectTotal))
                                                            setNewItemDesc("")
                                                            setNewItemPrice("")
                                                        } else {
                                                            const errData = await res.json().catch(() => ({}))
                                                            alert(errData.error || "Failed to add item.")
                                                        }
                                                    } catch { alert("Network error") }
                                                } else {
                                                    setItems([...items, { description: newItemDesc, price: newItemPrice }])
                                                    setNewItemDesc("")
                                                    setNewItemPrice("")
                                                }
                                            }}
                                            className="h-9"
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? "Saving..." : "Save changes"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Invoice Generation Dialog */}
                    <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Generate Invoice</DialogTitle>
                                <DialogDescription>
                                    Create an invoice for {invoiceProject?.title}.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleGenerateInvoice} className="space-y-4">
                                {invoiceProject && (() => {
                                    const calc = getInvoiceCalculation(invoiceProject)
                                    return (
                                        <div className="space-y-4">
                                            <p className="text-sm font-medium">Select Payment Type:</p>

                                            <div className="flex flex-col gap-3">
                                                {invoiceProject.dpAmount && !calc.hasDpInvoice && (
                                                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                        <input
                                                            type="radio"
                                                            name="invoiceType"
                                                            value="dp"
                                                            checked={invoiceType === "dp"}
                                                            onChange={() => setInvoiceType("dp")}
                                                            className="w-4 h-4"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-medium inline-block pr-2">Down Payment</div>
                                                            <Badge variant="outline">{formatCurrency(invoiceProject.dpAmount, invoiceProject.currency)}</Badge>
                                                        </div>
                                                    </label>
                                                )}

                                                {!calc.hasFullInvoice && (
                                                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                        <input
                                                            type="radio"
                                                            name="invoiceType"
                                                            value="full_payment"
                                                            checked={invoiceType === "full_payment"}
                                                            onChange={() => setInvoiceType("full_payment")}
                                                            className="w-4 h-4"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-medium inline-block pr-2">Full Payment {calc.isDpPaid && "(Balance)"}</div>
                                                            <Badge variant="outline">{formatCurrency(calc.fullPaymentAmount, invoiceProject.currency)}</Badge>
                                                        </div>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })()}

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? "Generating..." : "Generate Invoice"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead>Total Price</TableHead>
                            <TableHead>DP Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProjects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No projects found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProjects.map(project => (
                                <TableRow key={project.id}>
                                    <TableCell className="font-medium">{project.title}</TableCell>
                                    <TableCell>{project.client.name}</TableCell>
                                    <TableCell>{project.deadline ? new Date(project.deadline).toLocaleDateString() : "-"}</TableCell>
                                    <TableCell>{formatCurrency(project.totalPrice, project.currency)}</TableCell>
                                    <TableCell>{project.dpAmount ? formatCurrency(project.dpAmount, project.currency) : "-"}</TableCell>
                                    <TableCell className="capitalize">{project.status.replace("_", " ")}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" disabled={getInvoiceCalculation(project).hasFullInvoice} onClick={() => handleOpenInvoiceDialog(project)} title={getInvoiceCalculation(project).hasFullInvoice ? "All invoices generated" : "Generate Invoice"}>
                                            <FileText className={`h-4 w-4 ${getInvoiceCalculation(project).hasFullInvoice ? "text-gray-400" : "text-blue-600"}`} />
                                            <span className="sr-only">Generate Invoice</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(project)}>
                                            <Pencil className="h-4 w-4" />
                                            <span className="sr-only">Edit</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(project.id)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete</span>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

"use client";

import { useState } from "react";
import { UpgradeDialog } from "@/components/subscription/upgrade-dialog";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Power, Pencil, Trash2, CalendarClock } from "lucide-react";
import { NumericFormat } from "react-number-format";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/currency";

interface Client {
    id: string;
    name: string;
    email: string | null;
}

interface Project {
    id: string;
    title: string;
    client: Client;
    currency: string;
}

interface RecurringInvoice {
    id: string;
    projectId: string;
    title: string;
    amount: string;
    frequency: "MONTHLY" | "WEEKLY" | "YEARLY";
    dayOfMonth: number;
    startDate: string;
    endDate: string | null;
    nextRunAt: string;
    isActive: boolean;
    description: string | null;
    project: Project;
}

export function RecurringInvoicesClient({
    initialRecurringInvoices,
    projects,
}: {
    initialRecurringInvoices: RecurringInvoice[];
    projects: Project[];
}) {
    const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>(initialRecurringInvoices);
    const [open, setOpen] = useState(false);
    const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
    const [currentLimit, setCurrentLimit] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [id, setId] = useState<string | null>(null);
    const [projectId, setProjectId] = useState("");
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY" | "YEARLY">("MONTHLY");
    const [dayOfMonth, setDayOfMonth] = useState<number>(1);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [description, setDescription] = useState("");
    const [isActive, setIsActive] = useState(true);

    const resetForm = () => {
        setId(null);
        setProjectId("");
        setTitle("");
        setAmount("");
        setFrequency("MONTHLY");
        setDayOfMonth(1);
        setStartDate(format(new Date(), "yyyy-MM-dd"));
        setEndDate("");
        setDescription("");
        setIsActive(true);
    };

    const handleOpenDialog = async (ri?: RecurringInvoice) => {
        if (ri) {
            setId(ri.id);
            setProjectId(ri.projectId);
            setTitle(ri.title);
            setAmount(ri.amount);
            setFrequency(ri.frequency);
            setDayOfMonth(ri.dayOfMonth);
            setStartDate(format(new Date(ri.startDate), "yyyy-MM-dd"));
            setEndDate(ri.endDate ? format(new Date(ri.endDate), "yyyy-MM-dd") : "");
            setDescription(ri.description || "");
            setIsActive(ri.isActive);
            setOpen(true);
        } else {
            // Check limit before opening create dialog
            try {
                const res = await fetch("/api/subscription/check?resource=recurringTemplates");
                if (res.ok) {
                    const check = await res.json();
                    if (!check.allowed) {
                        setCurrentLimit(check.limit);
                        setIsUpgradeDialogOpen(true);
                        return;
                    }
                }
            } catch (error) {
                console.error("Failed to check subscription limit:", error);
            }
            
            resetForm();
            setOpen(true);
        }
    };

    const handleToggleActive = async (ri: RecurringInvoice) => {
        try {
            const response = await fetch(`/api/recurring-invoices/${ri.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: ri.projectId,
                    title: ri.title,
                    amount: ri.amount,
                    frequency: ri.frequency,
                    dayOfMonth: ri.dayOfMonth,
                    startDate: ri.startDate,
                    endDate: ri.endDate,
                    description: ri.description,
                    isActive: !ri.isActive,
                }),
            });

            if (!response.ok) throw new Error("Failed to toggle status");

            setRecurringInvoices(recurringInvoices.map((item) =>
                item.id === ri.id ? { ...item, isActive: !ri.isActive } : item
            ));

            toast.success("Status Updated", {
                description: `Recurring invoice has been ${ri.isActive ? "paused" : "activated"}.`,
            });
        } catch (error) {
            console.error(error);
            toast.error("Error", {
                description: "Failed to update status",
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                projectId,
                title,
                amount: Number(amount),
                frequency,
                dayOfMonth: Number(dayOfMonth),
                startDate: new Date(startDate).toISOString(),
                endDate: endDate ? new Date(endDate).toISOString() : null,
                description,
                isActive,
            };

            if (id) {
                const res = await fetch(`/api/recurring-invoices/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error("Failed to update");

                toast.success("Success", { description: "Recurring invoice updated." });
            } else {
                const res = await fetch("/api/recurring-invoices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error("Failed to create");

                toast.success("Success", { description: "Recurring invoice created." });
            }

            // Reload window to simplify state management for now since we rely on server component heavily
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Error", {
                description: "An error occurred.",
            });
            setLoading(false);
        }
    };

    const handleDelete = async (deleteIdToProcess: string) => {
        try {
            const response = await fetch(`/api/recurring-invoices/${deleteIdToProcess}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Failed to delete");

            setRecurringInvoices(recurringInvoices.filter((r) => r.id !== deleteIdToProcess));
            toast.success("Deleted", { description: "Recurring invoice has been deleted." });
        } catch (error) {
            console.error(error);
            toast.error("Error", { description: "Failed to delete" });
        }
    };

    const filteredRecurringInvoices = recurringInvoices.filter((ri) => {
        const matchesSearch = ri.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              ri.project.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              ri.project.title.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (statusFilter === "ACTIVE") return matchesSearch && ri.isActive;
        if (statusFilter === "paused") return matchesSearch && !ri.isActive;
        return matchesSearch;
    });

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>All Recurring Invoices</CardTitle>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => handleOpenDialog()}>
                                <Plus className="h-4 w-4 mr-2" />
                                New Recurring Invoice
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {id ? "Edit Recurring Invoice" : "Create Recurring Invoice"}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-1 md:col-span-2">
                                        <Label>Project</Label>
                                        <Select
                                            value={projectId}
                                            onValueChange={setProjectId}
                                            required
                                            disabled={!!id}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a project" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {projects.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.title} ({p.client.name})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 col-span-1 md:col-span-2">
                                        <Label htmlFor="title">Schedule Name (e.g. Monthly Maintenance)</Label>
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Amount</Label>
                                        <NumericFormat
                                            value={amount}
                                            onValueChange={(values) => setAmount(values.value)}
                                            allowLeadingZeros={false}
                                            allowNegative={false}
                                            thousandSeparator="."
                                            decimalSeparator=","
                                            prefix="Rp "
                                            customInput={Input}
                                            required
                                            placeholder="e.g. 5.000.000"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Frequency</Label>
                                        <Select
                                            value={frequency}
                                            onValueChange={(val: any) => setFrequency(val)}
                                            required
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                                                <SelectItem value="WEEKLY">Weekly</SelectItem>
                                                <SelectItem value="YEARLY">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {frequency === "MONTHLY" && (
                                        <div className="space-y-2">
                                            <Label>Day of Month (1-28)</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="28"
                                                value={dayOfMonth}
                                                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>End Date (Optional)</Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-1 md:col-span-2 flex items-center justify-between border rounded-lg p-3">
                                        <div className="space-y-0.5">
                                            <Label>Active Status</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Turn off to pause schedule generation.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={isActive}
                                            onCheckedChange={setIsActive}
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-1 md:col-span-2">
                                        <Label>Line Item Description (will appear on invoice)</Label>
                                        <Input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>

                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={loading}>
                                        {loading ? "Saving..." : "Save"}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <Input
                            placeholder="Search schedules..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {filteredRecurringInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg mt-4">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <CalendarClock className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">No recurring invoices found</h3>
                            <p className="text-muted-foreground mb-4 max-w-sm">
                                Create a scheduled template to automatically send monthly or weekly invoices to your clients.
                            </p>
                            <Button onClick={() => handleOpenDialog()}>
                                <Plus className="mr-2 h-4 w-4" /> Add Recurring
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Mobile View: Cards */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {filteredRecurringInvoices.map((ri) => (
                                    <Card key={ri.id} className={`overflow-hidden ${!ri.isActive ? "opacity-60" : ""}`}>
                                        <CardHeader className="border-b border-border/50 pb-3">
                                            <CardTitle className="flex justify-between items-start text-base gap-2">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="truncate pr-2 font-bold">{ri.title}</span>
                                                    <span className="text-sm font-normal text-muted-foreground truncate">{ri.project.client.name}</span>
                                                </div>
                                                <div className="shrink-0 flex flex-col gap-1 items-end">
                                                    <Badge variant={ri.isActive ? "default" : "secondary"} className="text-[10px] py-0 px-2 uppercase tracking-widest font-bold">
                                                        {ri.isActive ? "Active" : "Paused"}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground capitalize">
                                                        {ri.frequency}
                                                        {ri.frequency === "MONTHLY" && ` Day ${ri.dayOfMonth}`}
                                                    </span>
                                                </div>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 pt-3">
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span className="text-sm">Amount</span>
                                                <span className="font-semibold text-foreground">{formatMoney(ri.amount, ri.project.currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span className="text-sm">Next Run</span>
                                                <span className="font-semibold text-foreground">{format(new Date(ri.nextRunAt), "MMM d, yyyy")}</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full px-1 text-xs"
                                                    onClick={() => handleToggleActive(ri)}
                                                >
                                                    <Power className={`h-3 w-3 mr-1 shrink-0 ${ri.isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                                                    <span className="truncate">{ri.isActive ? "Pause" : "Activate"}</span>
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full px-1 text-xs"
                                                    onClick={() => handleOpenDialog(ri)}
                                                >
                                                    <Pencil className="h-3 w-3 mr-1 shrink-0" />
                                                    <span className="truncate">Edit</span>
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="w-full px-1 text-xs"
                                                    onClick={() => setDeleteId(ri.id)}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1 shrink-0" />
                                                    <span className="truncate">Delete</span>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Desktop View: Table */}
                            <div className="hidden md:block rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Project / Client</TableHead>
                                            <TableHead>Schedule</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Next Run</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecurringInvoices.map((ri) => (
                                            <TableRow key={ri.id} className={!ri.isActive ? "opacity-60" : ""}>
                                                <TableCell>
                                                    <div className="font-medium">{ri.title}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {ri.project.client.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="capitalize font-medium">{ri.frequency}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {ri.frequency === "MONTHLY" && `Day ${ri.dayOfMonth}`}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {formatMoney(ri.amount, ri.project.currency)}
                                                </TableCell>
                                                <TableCell>
                                                    {format(new Date(ri.nextRunAt), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={ri.isActive ? "default" : "secondary"}>
                                                        {ri.isActive ? "Active" : "Paused"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleToggleActive(ri)}
                                                            title={ri.isActive ? "Pause schedule" : "Activate schedule"}
                                                        >
                                                            <Power className={`h-4 w-4 mr-2 ${ri.isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                                                            {ri.isActive ? "Pause" : "Activate"}
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => handleOpenDialog(ri)}
                                                        >
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteId(ri.id)}
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                            title="Delete schedule"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <ConfirmDialog
                        open={!!deleteId}
                        onOpenChange={(open) => !open && setDeleteId(null)}
                        title="Delete Schedule"
                        description="Are you sure you want to stop and delete this recurring invoice schedule? This action cannot be undone."
                        onConfirm={async () => {
                            if (deleteId) {
                                await handleDelete(deleteId);
                                setDeleteId(null);
                            }
                        }}
                    />
                </CardContent>
            </Card>

            <UpgradeDialog
                isOpen={isUpgradeDialogOpen}
                onOpenChange={setIsUpgradeDialogOpen}
                resourceName="Recurring Invoices"
                limit={currentLimit}
            />
        </>
    );
}

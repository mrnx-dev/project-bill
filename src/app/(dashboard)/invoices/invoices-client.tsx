"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Send, Loader2 } from "lucide-react"
import { sendInvoiceEmail } from "@/app/actions/send-invoice"

export function InvoicesClient({ initialInvoices }: { initialInvoices: any[] }) {
    const [invoices, setInvoices] = useState(initialInvoices)
    const [searchQuery, setSearchQuery] = useState("")
    const [sendingId, setSendingId] = useState<string | null>(null)

    const formatCurrency = (amount: string | number, currencyStr: string) => {
        return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
            style: "currency",
            currency: currencyStr,
            minimumFractionDigits: 0
        }).format(Number(amount))
    }

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "paid" ? "unpaid" : "paid"

        // Optimistic update
        setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv))

        try {
            const res = await fetch(`/api/invoices/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) throw new Error("Failed to update status")
        } catch (e) {
            console.error(e)
            setInvoices(initialInvoices) // Revert on error
        }
    }

    const handleSendEmail = async (id: string) => {
        setSendingId(id)
        try {
            const res = await sendInvoiceEmail(id)
            if (res.success) {
                alert("Email sent successfully!")
            } else {
                alert("Failed to send email: " + res.error)
            }
        } catch (e: any) {
            console.error(e)
            alert("An error occurred: " + e.message)
        } finally {
            setSendingId(null)
        }
    }

    const filteredInvoices = invoices.filter(inv =>
        inv.project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.type.replace('_', ' ').toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Input
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No invoices found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInvoices.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-medium">{inv.project.title}</TableCell>
                                    <TableCell>{inv.project.client.name}</TableCell>
                                    <TableCell className="capitalize">{inv.type.replace('_', ' ')}</TableCell>
                                    <TableCell>{formatCurrency(inv.amount, inv.project.currency || "IDR")}</TableCell>
                                    <TableCell>
                                        {inv.status === 'paid'
                                            ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 text-xs py-1 px-3 uppercase tracking-widest font-bold">Paid</Badge>
                                            : <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300 text-xs py-1 px-3 uppercase tracking-widest font-bold">Unpaid</Badge>
                                        }
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => toggleStatus(inv.id, inv.status)}>
                                                Mark {inv.status === "paid" ? "Unpaid" : "Paid"}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleSendEmail(inv.id)}
                                                disabled={sendingId === inv.id || inv.status === 'paid'}
                                                title={inv.status === 'paid' ? 'Invoice already paid' : 'Send invoice email'}
                                            >
                                                {sendingId === inv.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                                Send
                                            </Button>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer">View</Link>
                                            </Button>
                                        </div>
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

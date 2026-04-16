"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Send, Loader2, Trash2 } from "lucide-react";
import { sendInvoiceEmail } from "@/app/actions/send-invoice";
import { sendReceiptEmail } from "@/app/actions/send-receipt";
import { toast } from "sonner";
import { formatEnum } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmailProviderModal } from "@/components/email-provider-modal";
import { formatMoney } from "@/lib/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InvoicesClient({
  initialInvoices,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialInvoices: any[];
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toggleConfirmId, setToggleConfirmId] = useState<{ id: string, currentStatus: string } | null>(null);
  const [markPaidConfirmId, setMarkPaidConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [emailModalData, setEmailModalData] = useState<{ to: string; subject: string; body: string } | null>(null);

  const toggleStatus = async (id: string, currentStatus: string) => {
    // Only used for reverting to unpaid now
    const newStatus = "UNPAID";

    // Optimistic update
    setInvoices(
      invoices.map((inv) =>
        inv.id === id ? { ...inv, status: newStatus } : inv,
      ),
    );

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch (e) {
      console.error(e);
      setInvoices(initialInvoices); // Revert on error
    }
  };

  const handleMarkPaidManual = async (id: string) => {
    // Optimistic update
    setInvoices(
      invoices.map((inv) =>
        inv.id === id ? { ...inv, status: "PAID" } : inv,
      ),
    );

    try {
      const res = await fetch(`/api/invoices/${id}/mark-paid`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to mark paid");
      }
      toast.success("Invoice marked as Paid (Manual)");
    } catch (e: any) {
      console.error(e);
      setInvoices(initialInvoices); // Revert on error
      toast.error(e.message || "Failed to mark as paid");
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInvoices(invoices.filter((inv) => inv.id !== id));
        toast.success("Invoice deleted");
        setDeleteConfirmId(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to delete invoice");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendEmail = async (id: string, isReceipt: boolean = false) => {
    setSendingId(id);
    try {
      const res = isReceipt ? await sendReceiptEmail(id) : await sendInvoiceEmail(id);
      if (res.success) {
        if (res.manual) {
          toast.success("Manual Mode Enabled", {
            description: "Please select your preferred email provider.",
            duration: 5000,
            action: res.invoiceLink ? {
              label: "Copy Link",
              onClick: () => {
                navigator.clipboard.writeText(res.invoiceLink!);
                toast.info("Link copied to clipboard!");
              },
            } : undefined,
          });
          if (res.mailtoData) {
            setEmailModalData(res.mailtoData);
          }
        } else {
          toast.success("Email sent successfully!", {
            description: `The client will receive the ${isReceipt ? "receipt" : "invoice"} in their inbox shortly.`,
          });
        }
      } else {
        toast.error("Failed to send email", {
          description: res.error,
        });
      }
      
      // Attempt a router refresh internally if we just sent an email so status shows "Email Sent" or "Email Failed" if implemented later
      try {
         const { useRouter } = await import("next/navigation")
         // Minimal hack hook via Next Router, else rely on page poll. We will just wait.
      } catch (ex) {}

    } catch (e: unknown) {
      console.error(e);
      toast.error("An error occurred", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSendingId(null);
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) => {
      const matchesSearch = inv.project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.project.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatEnum(inv.type).toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === "PAID") return matchesSearch && inv.status === "PAID";
      if (statusFilter === "UNPAID") return matchesSearch && inv.status === "UNPAID";
      return matchesSearch;
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <Input
          placeholder="Search invoices..."
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
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="UNPAID">Awaiting Payment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile View: Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredInvoices.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>No invoices found.</CardContent>
          </Card>
        ) : (
          filteredInvoices.map((inv) => (
            <Card key={inv.id} className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex justify-between items-start text-base gap-2">
                  <div className="flex flex-col">
                    <span className="truncate pr-4 font-bold">{inv.project.title}</span>
                    <span className="text-sm font-normal text-muted-foreground truncate">{inv.project.client.name}</span>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1 items-end">
                    {inv.status === "PAID" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900 border text-[10px] py-0 px-2 uppercase tracking-widest font-bold">
                        Paid
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900 border text-[10px] py-0 px-2 uppercase tracking-widest font-bold"
                      >
                        Awaiting Payment
                      </Badge>
                    )}
                    {inv.emailStatus === 'FAILED' && (
                        <Badge variant="outline" className="text-red-500 border-red-500 bg-red-50 dark:bg-red-950 text-[10px] py-0 px-2 uppercase tracking-tight">
                          Email Failed
                        </Badge>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{formatEnum(inv.type)}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-sm">Amount</span>
                  <span className="font-semibold text-foreground">{formatMoney(Number(inv.amount), inv.project.currency || "IDR")}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full px-1 text-xs"
                    disabled={inv.status === "PAID" && !!inv.paymentId}
                    onClick={() => {
                      if (inv.status === "PAID") {
                        setToggleConfirmId({ id: inv.id, currentStatus: inv.status });
                      } else {
                        setMarkPaidConfirmId(inv.id);
                      }
                    }}
                  >
                    {inv.status === "PAID" ? "Mark Unpaid" : "Mark Paid (Manual)"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full px-1 text-xs"
                    onClick={() => handleSendEmail(inv.id, inv.status === "PAID")}
                    disabled={sendingId === inv.id}
                  >
                    {sendingId === inv.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    {inv.status === "PAID" ? "Send Receipt" : "Send"}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full px-1 text-xs" asChild>
                    <Link
                      href={`/invoices/${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full px-1 text-xs"
                    onClick={() => setDeleteConfirmId(inv.id)}
                    disabled={inv.status === "PAID"}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block rounded-md border">
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
                  <TableCell className="font-medium">
                    {inv.project.title}
                  </TableCell>
                  <TableCell>{inv.project.client.name}</TableCell>
                  <TableCell className="capitalize">
                    {formatEnum(inv.type)}
                  </TableCell>
                  <TableCell>
                    {formatMoney(Number(inv.amount), inv.project.currency || "IDR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                    {inv.status === "PAID" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900 border text-xs py-1 px-3 uppercase tracking-widest font-bold">
                        Paid
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900 border text-xs py-1 px-3 uppercase tracking-widest font-bold"
                      >
                        Awaiting Payment
                      </Badge>
                    )}
                    {inv.emailStatus === 'FAILED' && (
                        <Badge variant="outline" className="text-red-500 border-red-500 bg-red-50 dark:bg-red-950 text-[10px] py-0 px-2 uppercase tracking-tight flex items-center gap-1">
                          Email Failed
                        </Badge>
                    )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inv.status === "PAID" && !!inv.paymentId}
                        title={inv.status === "PAID" && !!inv.paymentId ? "Invoice already paid via Mayar" : ""}
                        onClick={() => {
                          if (inv.status === "PAID") {
                            setToggleConfirmId({ id: inv.id, currentStatus: inv.status });
                          } else {
                            setMarkPaidConfirmId(inv.id);
                          }
                        }}
                      >
                        {inv.status === "PAID" ? "Mark Unpaid" : "Mark Paid (Manual)"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSendEmail(inv.id, inv.status === "PAID")}
                        disabled={sendingId === inv.id}
                        title={
                          inv.status === "PAID"
                            ? "Send payment receipt"
                            : "Send invoice email"
                        }
                      >
                        {sendingId === inv.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {inv.status === "PAID" ? "Send Receipt" : "Send"}
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/invoices/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => setDeleteConfirmId(inv.id)}
                        disabled={inv.status === "PAID"}
                        title="Delete invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!toggleConfirmId}
        onOpenChange={(open) => !open && setToggleConfirmId(null)}
        title="Mark as Unpaid?"
        description="This will manually mark the invoice as unpaid. Are you sure you want to proceed?"
        confirmLabel="Confirm"
        onConfirm={() => {
          if (toggleConfirmId) {
            toggleStatus(toggleConfirmId.id, "PAID"); // actually reverted to unpaid via the function
            setToggleConfirmId(null);
          }
        }}
      />
      <ConfirmDialog
        open={!!markPaidConfirmId}
        onOpenChange={(open) => !open && setMarkPaidConfirmId(null)}
        title="Mark Invoice as Paid (Manual)?"
        description="Are you sure this invoice has been paid? This will manually record the payment as it does not go through the payment gateway."
        confirmLabel="Yes, Mark as Paid"
        onConfirm={() => {
          if (markPaidConfirmId) {
            handleMarkPaidManual(markPaidConfirmId);
            setMarkPaidConfirmId(null);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Invoice?"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        onConfirm={() => {
          if (deleteConfirmId) {
            handleDelete(deleteConfirmId);
          }
        }}
      />
      
      <EmailProviderModal 
        isOpen={!!emailModalData}
        onClose={() => setEmailModalData(null)}
        emailData={emailModalData}
      />
    </div>
  );
}

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
import { Send, Loader2 } from "lucide-react";
import { sendInvoiceEmail } from "@/app/actions/send-invoice";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
export function InvoicesClient({
  initialInvoices,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialInvoices: any[];
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toggleConfirmId, setToggleConfirmId] = useState<{ id: string, currentStatus: string } | null>(null);

  const formatCurrency = (amount: string | number, currencyStr: string) => {
    return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currencyStr,
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "paid" ? "unpaid" : "paid";

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

  const handleSendEmail = async (id: string) => {
    setSendingId(id);
    try {
      const res = await sendInvoiceEmail(id);
      if (res.success) {
        if (res.manual) {
          toast.success(res.message, {
            description: `Invoice Link: ${res.invoiceLink}`,
            duration: 10000,
            action: res.invoiceLink ? {
              label: "Copy Link",
              onClick: () => {
                navigator.clipboard.writeText(res.invoiceLink!);
                toast.info("Link copied to clipboard!");
              },
            } : undefined,
          });
        } else {
          toast.success("Email sent successfully!", {
            description: "The client will receive the invoice in their inbox shortly.",
          });
        }
      } else {
        toast.error("Failed to send email", {
          description: res.error,
        });
      }
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
    (inv) =>
      inv.project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.type
        .replace("_", " ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

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
                    {inv.status === "paid" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900 border text-[10px] py-0 px-2 uppercase tracking-widest font-bold">
                        Paid
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900 border text-[10px] py-0 px-2 uppercase tracking-widest font-bold"
                      >
                        Unpaid
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{inv.type.replace("_", " ")}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-sm">Amount</span>
                  <span className="font-semibold text-foreground">{formatCurrency(Number(inv.amount), inv.project.currency || "IDR")}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full px-1 text-xs"
                    disabled={inv.status === "paid" && !!inv.paymentId}
                    onClick={() => {
                      if (inv.status === "paid") {
                        setToggleConfirmId({ id: inv.id, currentStatus: inv.status });
                      } else {
                        toggleStatus(inv.id, inv.status);
                      }
                    }}
                  >
                    Mark {inv.status === "paid" ? "Unpaid" : "Paid"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full px-1 text-xs"
                    onClick={() => handleSendEmail(inv.id)}
                    disabled={sendingId === inv.id || inv.status === "paid"}
                  >
                    {sendingId === inv.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    Send
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
                    {inv.type.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Number(inv.amount), inv.project.currency || "IDR")}
                  </TableCell>
                  <TableCell>
                    {inv.status === "paid" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900 border text-xs py-1 px-3 uppercase tracking-widest font-bold">
                        Paid
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900 border text-xs py-1 px-3 uppercase tracking-widest font-bold"
                      >
                        Unpaid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inv.status === "paid" && !!inv.paymentId}
                        title={inv.status === "paid" && !!inv.paymentId ? "Invoice already paid via Mayar" : ""}
                        onClick={() => {
                          if (inv.status === "paid") {
                            setToggleConfirmId({ id: inv.id, currentStatus: inv.status });
                          } else {
                            toggleStatus(inv.id, inv.status);
                          }
                        }}
                      >
                        Mark {inv.status === "paid" ? "Unpaid" : "Paid"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSendEmail(inv.id)}
                        disabled={sendingId === inv.id || inv.status === "paid"}
                        title={
                          inv.status === "paid"
                            ? "Invoice already paid"
                            : "Send invoice email"
                        }
                      >
                        {sendingId === inv.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send
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
            toggleStatus(toggleConfirmId.id, toggleConfirmId.currentStatus);
            setToggleConfirmId(null);
          }
        }}
      />
    </div>
  );
}

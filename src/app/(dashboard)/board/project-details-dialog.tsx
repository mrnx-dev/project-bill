"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { NumericFormat } from "react-number-format";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertCircle } from "lucide-react";

type ProjectItem = {
  id: string;
  description: string;
  price: string;
  quantity?: number | null;
  rate?: string | null;
};

type ProjectDetailsDialogProps = {
  projectId: string;
  projectTitle: string;
  currency: string;
  items: ProjectItem[];
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: (item: ProjectItem, newTotal: string) => void;
  onItemDeleted: (itemId: string, newTotal: string) => void;
  hasInvoices?: boolean;
};

export function ProjectDetailsDialog({
  projectId,
  projectTitle,
  currency,
  items,
  isOpen,
  onClose,
  onItemAdded,
  onItemDeleted,
  hasInvoices = false,
}: ProjectDetailsDialogProps) {
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemRate, setNewItemRate] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  // Auto-calculate price if rating & qty are used instead of fixed price
  const computedPrice = useMemo(() => {
    if (newItemQty && newItemRate) {
      const q = parseFloat(newItemQty);
      const r = parseFloat(newItemRate);
      if (!isNaN(q) && !isNaN(r)) return (q * r).toString();
    }
    return newItemPrice;
  }, [newItemQty, newItemRate, newItemPrice]);

  const handleAddItem = async () => {
    if (!newItemDesc || !computedPrice) return;

    setIsSaving(true);
    try {
      const payload: any = { description: newItemDesc, price: computedPrice };

      if (newItemQty && newItemRate) {
        payload.quantity = parseFloat(newItemQty);
        payload.rate = newItemRate;
      }

      const res = await fetch(`/api/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        onItemAdded(data.item, data.projectTotal);
        setNewItemDesc("");
        setNewItemPrice("");
        setNewItemQty("");
        setNewItemRate("");
        toast.success("Scope item added");
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to add scope item.");
      }
    } catch (error: unknown) {
      console.error("Failed to add item:", error);
      alert(error instanceof Error ? error.message : "Failed to add item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/items/${itemId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        onItemDeleted(itemId, data.projectTotal);
        toast.success("Item removed");
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to delete item.");
      }
    } catch (error) {
      console.error("Failed to delete", error);
      toast.error("Network error while deleting item");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Project Details</DialogTitle>
          <DialogDescription>
            Manage scoped deliverables for {projectTitle}.
          </DialogDescription>
        </DialogHeader>

        {hasInvoices && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-md p-3 flex items-start gap-3 mt-2">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold block">Scope Locked</span>
              You have already generated invoices for this project. The deliverables scope is now locked to maintain financial consistency.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 py-4 max-h-[60vh] overflow-y-auto px-1 -mx-1">
          <div className="hidden md:flex gap-3 items-center text-sm font-semibold text-muted-foreground pb-2 border-b px-2">
            <span className="flex-1">Description</span>
            <span className="w-[60px] text-right">Qty</span>
            <span className="w-[100px] text-right">Rate</span>
            <span className="w-[110px] text-right">Amount</span>
          </div>

          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4 italic">
              No items outlined yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 md:gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-center text-sm group px-2 py-3 md:py-1 border border-slate-100 dark:border-slate-800 md:border-transparent rounded-lg md:rounded-none bg-slate-50/50 md:bg-transparent dark:bg-slate-900/50"
                >
                  <div className="flex justify-between items-start flex-1">
                    <span className="font-medium md:font-normal line-clamp-2 md:truncate md:flex-1 text-slate-900 dark:text-slate-100" title={item.description}>
                      {item.description}
                    </span>
                    {!hasInvoices && (
                      <button
                        onClick={() => setDeleteItemId(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 md:hidden"
                        title="Remove Item"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground text-xs md:text-sm mt-1 md:mt-0">
                    <div className="flex flex-wrap gap-x-4 md:hidden">
                      {item.quantity && <span>Qty: {item.quantity}</span>}
                      {item.rate && <span>Rate: {formatCurrency(item.rate)}</span>}
                    </div>

                    <div className="hidden md:flex gap-3 items-center">
                      <span className="w-[60px] text-right shrink-0">
                        {item.quantity ? item.quantity : "-"}
                      </span>
                      <span className="w-[100px] text-right truncate shrink-0" title={item.rate ? formatCurrency(item.rate) : "-"}>
                        {item.rate ? formatCurrency(item.rate) : "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 md:w-[110px] md:justify-end text-foreground shrink-0">
                      <span className="md:hidden text-muted-foreground">Amount:</span>
                      <span className="font-semibold md:font-medium text-right text-emerald-600 dark:text-emerald-400 md:text-foreground">
                        {formatCurrency(item.price)}
                      </span>
                      {!hasInvoices && (
                        <button
                          onClick={() => setDeleteItemId(item.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
                          title="Remove Item"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-2" />

          {!hasInvoices && (
            <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-lg border">
              <span className="text-sm font-medium">Add Change Request / Deliverable</span>
              <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <Input
                  placeholder="Task desc..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="text-sm h-9 md:h-8 flex-1"
                />
                <div className="flex gap-2 w-full md:w-auto">
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="text-sm h-9 md:h-8 w-[70px] md:w-[60px] px-2 shrink-0"
                    min="0"
                    step="0.01"
                  />
                  <NumericFormat
                    value={newItemRate}
                    onValueChange={(values) => setNewItemRate(values.value)}
                    placeholder="Rate"
                    thousandSeparator="."
                    decimalSeparator=","
                    className="h-9 md:h-8 w-full md:w-[100px] shrink rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <NumericFormat
                    value={computedPrice}
                    onValueChange={(values) => {
                      if (!newItemQty && !newItemRate) {
                        setNewItemPrice(values.value);
                      }
                    }}
                    disabled={!!(newItemQty && newItemRate)}
                    placeholder="Amount"
                    thousandSeparator="."
                    decimalSeparator=","
                    className="h-9 md:h-8 w-full md:w-[110px] shrink rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={isSaving || !newItemDesc || !computedPrice}
                onClick={handleAddItem}
                className="w-full text-xs h-9 md:h-8 mt-1"
              >
                {isSaving ? "Adding..." : "+ Add to Scope"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Delete Item Confirmation */}
      <ConfirmDialog
        open={!!deleteItemId}
        onOpenChange={(open) => !open && setDeleteItemId(null)}
        title="Remove Item?"
        description="This will remove this deliverable from the project scope and adjust the total price."
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleteItemId) {
            handleDeleteItem(deleteItemId);
            setDeleteItemId(null);
          }
        }}
      />
    </Dialog>
  );
}

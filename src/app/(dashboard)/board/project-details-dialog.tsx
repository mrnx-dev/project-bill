"use client";

import { useState } from "react";
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

type ProjectItem = {
  id: string;
  description: string;
  price: string;
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
}: ProjectDetailsDialogProps) {
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const handleAddItem = async () => {
    if (!newItemDesc || !newItemPrice) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newItemDesc, price: newItemPrice }),
      });

      if (res.ok) {
        const data = await res.json();
        onItemAdded(data.item, data.projectTotal);
        setNewItemDesc("");
        setNewItemPrice("");
        toast.success("Scope item added");
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to add scope item.");
      }
    } catch (error) {
      console.error("Failed to add logic", error);
      toast.error("Network error while adding item");
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Project Details</DialogTitle>
          <DialogDescription>
            Manage scoped deliverables for {projectTitle}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex justify-between items-center text-sm font-semibold text-muted-foreground pb-2 border-b">
            <span>Description</span>
            <span>Price</span>
          </div>

          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4 italic">
              No items outlined yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="flex-1">{item.description}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {formatCurrency(item.price)}
                    </span>
                    <button
                      onClick={() => setDeleteItemId(item.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold px-2"
                      title="Remove Item"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-lg border">
            <span className="text-sm font-medium">
              Add Change Request / Deliverable
            </span>
            <div className="flex gap-2">
              <Input
                placeholder="Task description..."
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                className="flex-1 text-sm h-8"
              />
              <NumericFormat
                value={newItemPrice}
                onValueChange={(values) => setNewItemPrice(values.value)}
                placeholder="Price"
                thousandSeparator="."
                decimalSeparator=","
                className="w-[120px] flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <Button
              size="sm"
              disabled={isSaving || !newItemDesc || !newItemPrice}
              onClick={handleAddItem}
              className="w-full text-xs h-8"
            >
              {isSaving ? "Adding..." : "+ Add to Scope"}
            </Button>
          </div>
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

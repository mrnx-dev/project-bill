"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatMoney } from "@/lib/currency";
import { Check, X, Undo2, Trash2, Clock, DollarSign } from "lucide-react";

interface Milestone {
  id: string;
  name: string;
  percentage: string;
  amount: string;
  status: string;
  dueDate: string | null;
  invoiceId: string | null;
  sortOrder: number;
  invoice?: { id: string; invoiceNumber: string; status: string } | null;
}

interface PaymentScheduleProps {
  projectId: string;
  currency: string;
  milestones: Milestone[];
  hasInvoices: boolean;
  onMilestoneChange: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-gray-100", text: "text-gray-700", label: "Pending" },
  APPROVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved" },
  INVOICED: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Invoiced" },
  PAID: { bg: "bg-green-100", text: "text-green-800", label: "Paid" },
};

export function PaymentSchedule({
  projectId,
  currency,
  milestones,
  hasInvoices,
  onMilestoneChange,
}: PaymentScheduleProps) {
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPaid = milestones
    .filter((m) => m.status === "PAID")
    .reduce((sum, m) => sum + Number(m.percentage), 0);

  const handleAdd = async () => {
    if (!name || !percentage) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, percentage: parseFloat(percentage), dueDate: dueDate || null }),
      });
      if (res.ok) {
        setName("");
        setPercentage("");
        setDueDate("");
        onMilestoneChange();
        toast.success("Milestone added");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add milestone");
      }
    } catch {
      toast.error("Failed to add milestone");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        onMilestoneChange();
        toast.success("Milestone approved and invoice generated");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to approve");
      }
    } catch {
      toast.error("Failed to approve milestone");
    }
  };

  const handleUnapprove = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}/unapprove`, {
        method: "POST",
      });
      if (res.ok) {
        onMilestoneChange();
        toast.success("Milestone un-approved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to un-approve");
      }
    } catch {
      toast.error("Failed to un-approve");
    }
  };

  const handleDelete = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onMilestoneChange();
        toast.success("Milestone deleted");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete milestone");
    }
  };

  const handleMarkPaid = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}/mark-paid`, {
        method: "POST",
      });
      if (res.ok) {
        onMilestoneChange();
        toast.success("Milestone marked as paid");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to mark paid");
      }
    } catch {
      toast.error("Failed to mark paid");
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      {milestones.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Payment Progress</span>
            <span className="font-medium text-gray-900">{totalPaid}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${totalPaid}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestone List */}
      <div className="space-y-2">
        {milestones.map((m, i) => {
          const style = STATUS_STYLES[m.status] || STATUS_STYLES.PENDING;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white"
            >
              {/* Step number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                {i + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{m.name}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </div>
                <div className="flex gap-3 mt-1 text-sm text-gray-500">
                  <span>{m.percentage}%</span>
                  <span>{formatMoney(m.amount, currency)}</span>
                  {m.dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(m.dueDate).toLocaleDateString("id-ID")}
                    </span>
                  )}
                  {m.invoice && (
                    <span className="text-indigo-600">
                      {m.invoice.invoiceNumber}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {m.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => handleApprove(m.id)}
                    >
                      <Check className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-red-500"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
                {m.status === "INVOICED" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => handleMarkPaid(m.id)}
                    >
                      <DollarSign className="w-3 h-3 mr-1" /> Mark Paid
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-orange-500"
                      onClick={() => handleUnapprove(m.id)}
                    >
                      <Undo2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
                {m.status === "PAID" && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <Check className="w-4 h-4" /> Done
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Milestone Form */}
      {!hasInvoices && (
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Add Payment Milestone</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Milestone name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 h-9 text-sm"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="%"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="w-20 h-9 text-sm"
                min="0"
                max="100"
                step="0.01"
              />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={loading || !name || !percentage}
                className="h-9 text-xs"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

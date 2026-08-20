"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Milestone = {
  id: string; name: string; percentage: string; amount: string; order: number;
  status: string; invoiceId: string | null; dueDate: string | null;
};

export function MilestoneTimeline({
  projectId,
  milestones,
  currency,
  totalPrice,
  onChanged,
}: {
  projectId: string;
  milestones: Milestone[];
  currency: string;
  totalPrice: number;
  onChanged?: () => void;
}) {
  const paidAmount = milestones
    .filter((m) => m.status === "PAID")
    .reduce((acc, m) => acc + Number(m.amount), 0);
  const pct = totalPrice > 0 ? Math.round((paidAmount / totalPrice) * 100) : 0;
  const sorted = [...milestones].sort((a, b) => a.order - b.order);

  const tagih = async (mid: string) => {
    const res = await fetch(`/api/projects/${projectId}/milestones/${mid}/invoice`, { method: "POST" });
    if (res.ok) {
      toast.success("Invoice created & sent");
      onChanged?.();
    } else {
      toast.error("Failed to create invoice");
    }
  };

  const badge = (s: string) =>
    s === "PAID" ? <Badge className="bg-green-600">Lunas</Badge>
    : s === "INVOICED" ? <Badge className="bg-blue-600">Dikirim</Badge>
    : <Badge variant="secondary">Belum ditagih</Badge>;

  return (
    <div className="space-y-4">
      <div>
        <Progress value={pct} />
        <p className="text-sm text-muted-foreground mt-1">
          {formatMoney(paidAmount, currency)} / {formatMoney(totalPrice, currency)} — {pct}% lunas
        </p>
      </div>
      {!milestones.some((m) => m.status === "INVOICED" || m.status === "PAID") &&
        milestones.some((m) => m.status === "PLANNED") && (
        <p className="text-xs text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30 rounded p-2">
          Tip: lengkapi seluruh milestone sebelum menagih — plan terkunci setelah invoice pertama diterbitkan.
        </p>
      )}
      <div className="space-y-2">
        {sorted.map((m) => (
          <div key={m.id} className="flex items-center justify-between border rounded p-3">
            <div>
              <p className="font-medium">{m.name} <span className="text-muted-foreground">({Number(m.percentage)}%)</span></p>
              <p className="text-sm text-muted-foreground">{formatMoney(Number(m.amount), currency)}</p>
            </div>
            <div className="flex items-center gap-2">
              {badge(m.status)}
              {m.status === "PLANNED" && <Button size="sm" onClick={() => tagih(m.id)}>Tagih</Button>}
              {m.invoiceId && m.status !== "PLANNED" && (
                <Button size="sm" variant="outline" onClick={() => (window.location.href = `/invoices/${m.invoiceId}`)}>Lihat Invoice</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

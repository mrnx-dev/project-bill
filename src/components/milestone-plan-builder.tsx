"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/currency";

export type PlanRow = { name: string; percentage: number; order: number };

export function MilestonePlanBuilder({
  totalPrice,
  currency,
  initial,
  onChange,
}: {
  totalPrice: number;
  currency: string;
  initial: PlanRow[];
  onChange: (rows: PlanRow[]) => void;
}) {
  const [rows, setRows] = useState<PlanRow[]>(initial.length ? initial : [{ name: "Deposit", percentage: 0, order: 0 }]);
  const sum = rows.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);

  const update = (i: number, patch: Partial<PlanRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next);
  };
  const add = () => {
    const next = [...rows, { name: "", percentage: 0, order: rows.length }];
    setRows(next);
    onChange(next);
  };
  const remove = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, order: idx }));
    setRows(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Milestone name</Label>
            <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Design" />
          </div>
          <div className="w-24">
            <Label className="text-xs">%</Label>
            <Input type="number" value={r.percentage} onChange={(e) => update(i, { percentage: Number(e.target.value) })} />
          </div>
          <div className="w-40 text-sm text-right pb-2">
            {formatMoney((Number(r.percentage) / 100) * totalPrice, currency)}
          </div>
          <Button type="button" variant="ghost" onClick={() => remove(i)}>✕</Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Add milestone</Button>
      <div className={`text-sm font-medium ${sum === 100 ? "text-green-600" : "text-red-600"}`}>
        Total: {sum}% {sum === 100 ? "✓" : "(must be 100)"}
      </div>
    </div>
  );
}

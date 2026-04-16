"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Label,
  Rectangle,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  FileSpreadsheet,
  FileText,
  CalendarDays,
} from "lucide-react";
import { exportToCSV, exportToXLSX } from "@/lib/export";
import { formatEnum } from "@/lib/utils";
import { formatMoney, formatAxisCurrency } from "@/lib/currency";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────

interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  type: string;
  notes: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  clientName: string;
  clientId: string;
  projectName: string;
  projectId: string;
}

interface ClientInfo {
  id: string;
  name: string;
}

interface ReportsClientProps {
  invoices: SerializedInvoice[];
  clients: ClientInfo[];
}

// ─── Config ─────────────────────────────────────────

type Preset = "mtd" | "qtd" | "ytd" | "all" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  mtd: "Month to Date",
  qtd: "Quarter to Date",
  ytd: "Year to Date",
  all: "All Time",
  custom: "Custom Range",
};

const PIE_COLORS = [
  "oklch(0.6 0.118 184.704)",
  "oklch(0.828 0.189 84.429)",
  "oklch(0.7 0.15 250)",
  "oklch(0.65 0.18 310)",
  "oklch(0.75 0.12 40)",
  "oklch(0.55 0.15 160)",
  "oklch(0.8 0.1 120)",
  "oklch(0.6 0.2 0)",
];

const revenueConfig = {
  revenue: { label: "Revenue", color: "oklch(0.6 0.118 184.704)" },
} satisfies ChartConfig;

const agingConfig = {
  current: { label: "Not Yet Due", color: "oklch(0.6 0.118 184.704)" },
  "1-30": { label: "1-30 Days", color: "oklch(0.828 0.189 84.429)" },
  "31-60": { label: "31-60 Days", color: "oklch(0.75 0.15 40)" },
  "61-90": { label: "61-90 Days", color: "oklch(0.65 0.18 310)" },
  "90+": { label: "90+ Days", color: "oklch(0.6 0.2 0)" },
} satisfies ChartConfig;

// ─── Helpers ────────────────────────────────────────

function getDateRange(preset: Preset, customFrom?: string, customTo?: string) {
  const now = new Date();
  let from: Date;
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (preset) {
    case "mtd":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
      break;
    }
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      from = customFrom ? new Date(customFrom) : new Date(0);
      if (customTo) {
        const ct = new Date(customTo);
        ct.setHours(23, 59, 59, 999);
        return { from, to: ct };
      }
      return { from, to };
    case "all":
    default:
      from = new Date(0);
      break;
  }
  return { from, to };
}

function getDaysDiff(dueDate: string | null): number {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Component ──────────────────────────────────────

export function ReportsClient({ invoices, clients }: ReportsClientProps) {
  const [preset, setPreset] = useState<Preset>("ytd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(
    () => getDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  // Filter invoices by date range
  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        const d = new Date(inv.createdAt);
        return d >= from && d <= to;
      }),
    [invoices, from, to]
  );

  // ─── Summary cards ──────────────────────────────
  const summaryData = useMemo(() => {
    const paid = filtered.filter((i) => i.status === "PAID");
    const outstanding = filtered.filter(
      (i) => i.status !== "PAID" && i.status !== "CANCELLED"
    );
    const totalRevenue = paid.reduce((s, i) => s + i.amount, 0);
    const totalOutstanding = outstanding.reduce((s, i) => s + i.amount, 0);
    const avgInvoice = paid.length > 0 ? totalRevenue / paid.length : 0;

    // Compare with previous period for trend
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo = new Date(from.getTime() - 1);
    const prevPaid = invoices.filter(
      (i) =>
        i.status === "PAID" &&
        new Date(i.createdAt) >= prevFrom &&
        new Date(i.createdAt) <= prevTo
    );
    const prevRevenue = prevPaid.reduce((s, i) => s + i.amount, 0);
    const revenueChange =
      prevRevenue > 0
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
        : totalRevenue > 0
          ? 100
          : 0;

    return {
      totalRevenue,
      totalOutstanding,
      avgInvoice,
      invoiceCount: filtered.length,
      paidCount: paid.length,
      revenueChange,
    };
  }, [filtered, invoices, from, to]);

  // ─── Revenue trend (monthly) ────────────────────
  const revenueTrend = useMemo(() => {
    const months = new Map<string, number>();
    filtered
      .filter((i) => i.status === "PAID")
      .forEach((inv) => {
        const d = new Date(inv.paidAt || inv.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.set(key, (months.get(key) || 0) + inv.amount);
      });

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => {
        const [y, m] = month.split("-");
        const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", {
          month: "short",
          year: "2-digit",
        });
        return { month: label, revenue };
      });
  }, [filtered]);

  // ─── Client revenue breakdown ───────────────────
  const clientBreakdown = useMemo(() => {
    const clientMap = new Map<string, number>();
    filtered
      .filter((i) => i.status === "PAID")
      .forEach((inv) => {
        clientMap.set(
          inv.clientName,
          (clientMap.get(inv.clientName) || 0) + inv.amount
        );
      });

    return Array.from(clientMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // top 8
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const totalClientRevenue = clientBreakdown.reduce((s, c) => s + c.value, 0);

  // ─── Invoice aging ──────────────────────────────
  const agingData = useMemo(() => {
    const buckets = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };
    filtered
      .filter((i) => i.status !== "PAID" && i.status !== "CANCELLED" && i.dueDate)
      .forEach((inv) => {
        const days = getDaysDiff(inv.dueDate);
        if (days <= 0) buckets.current++;
        else if (days <= 30) buckets["1-30"]++;
        else if (days <= 60) buckets["31-60"]++;
        else if (days <= 90) buckets["61-90"]++;
        else buckets["90+"]++;
      });

    return Object.entries(buckets).map(([bucket, count]) => ({
      bucket,
      count,
      label:
        agingConfig[bucket as keyof typeof agingConfig]?.label || bucket,
    }));
  }, [filtered]);

  // ─── Export handlers ────────────────────────────
  const handleExportCSV = (scope: "filtered" | "all") => {
    const data = scope === "filtered" ? filtered : invoices;
    const rows = data.map((inv) => ({
      "Invoice Number": inv.invoiceNumber,
      Client: inv.clientName,
      Project: inv.projectName,
      Amount: inv.amount,
      Type: formatEnum(inv.type),
      Status: formatEnum(inv.status),
      Notes: inv.notes || "",
      "Due Date": inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "",
      "Paid Date": inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "",
      "Created At": new Date(inv.createdAt).toLocaleDateString(),
    }));
    exportToCSV(rows, `ProjectBill_Invoices_${new Date().toISOString().slice(0, 10)}`);
    toast.success("CSV exported successfully");
  };

  const handleExportXLSX = async (scope: "filtered" | "all") => {
    const data = scope === "filtered" ? filtered : invoices;

    // Sheet 1: Invoices
    const invoiceRows = data.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      client: inv.clientName,
      project: inv.projectName,
      amount: inv.amount,
      type: formatEnum(inv.type),
      status: formatEnum(inv.status),
      notes: inv.notes || "",
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "",
      paidAt: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "",
      createdAt: new Date(inv.createdAt).toLocaleDateString(),
    }));

    // Sheet 2: Summary
    const summaryRows = [
      { metric: "Total Revenue (Paid)", value: summaryData.totalRevenue },
      { metric: "Total Outstanding", value: summaryData.totalOutstanding },
      { metric: "Average Invoice Value", value: summaryData.avgInvoice },
      { metric: "Total Invoices", value: summaryData.invoiceCount },
      { metric: "Paid Invoices", value: summaryData.paidCount },
    ];

    // Sheet 3: Client Breakdown
    const clientRows = clientBreakdown.map((c) => ({
      client: c.name,
      revenue: c.value,
    }));

    await exportToXLSX(
      [
        {
          name: "Invoices",
          data: invoiceRows,
          columns: [
            { header: "Invoice #", key: "invoiceNumber", width: 15 },
            { header: "Client", key: "client", width: 25 },
            { header: "Project", key: "project", width: 25 },
            { header: "Amount", key: "amount", width: 18 },
            { header: "Type", key: "type", width: 16 },
            { header: "Status", key: "status", width: 14 },
            { header: "Notes", key: "notes", width: 30 },
            { header: "Due Date", key: "dueDate", width: 15 },
            { header: "Paid Date", key: "paidAt", width: 15 },
            { header: "Created", key: "createdAt", width: 15 },
          ],
        },
        { name: "Summary", data: summaryRows },
        { name: "Client Breakdown", data: clientRows },
      ],
      `ProjectBill_Report_${new Date().toISOString().slice(0, 10)}`
    );
    toast.success("XLSX exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* ─── Controls Row ─────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as Preset)}
          >
            <SelectTrigger className="w-[180px]">
              <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESET_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[150px]"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
          )}
        </div>

        {/* Export dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Filtered Data
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleExportCSV("filtered")}
              >
                <FileText className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleExportXLSX("filtered")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export XLSX
              </Button>
              <div className="border-t my-1" />
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                All Data
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleExportCSV("all")}
              >
                <FileText className="h-4 w-4" />
                Export CSV (All)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleExportXLSX("all")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export XLSX (All)
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ─── Summary Cards ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {formatMoney(summaryData.totalRevenue, "IDR")}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-full">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            {summaryData.revenueChange !== 0 && (
              <div className="flex items-center gap-1 mt-2">
                {summaryData.revenueChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${summaryData.revenueChange > 0 ? "text-emerald-600" : "text-red-500"}`}
                >
                  {summaryData.revenueChange > 0 ? "+" : ""}
                  {summaryData.revenueChange.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs previous period</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {formatMoney(summaryData.totalOutstanding, "IDR")}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-full">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {filtered.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").length}{" "}
              unpaid invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Invoice</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {formatMoney(summaryData.avgInvoice, "IDR")}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/10 p-2.5 rounded-full">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              From {summaryData.paidCount} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {summaryData.invoiceCount}
                </p>
              </div>
              <div className="bg-violet-50 dark:bg-violet-500/10 p-2.5 rounded-full">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {summaryData.paidCount} Paid
              </Badge>
              <Badge variant="outline" className="text-xs">
                {summaryData.invoiceCount - summaryData.paidCount} Pending
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts Row ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              Monthly paid revenue over selected period
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-6">
            {revenueTrend.length > 0 ? (
              <ChartContainer
                config={revenueConfig}
                className="mx-auto w-full min-h-[200px] max-h-[320px]"
              >
                <AreaChart
                  data={revenueTrend}
                  margin={{ top: 16, right: 8, bottom: 0, left: 8 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="oklch(0.6 0.118 184.704)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="oklch(0.6 0.118 184.704)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={60}
                    tickFormatter={(v) => formatAxisCurrency(v, "IDR")}
                    fontSize={12}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value: number | string) =>
                          `Rp ${Number(value).toLocaleString("id-ID")}`
                        }
                      />
                    }
                  />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    fill="url(#revenueGrad)"
                    stroke="oklch(0.6 0.118 184.704)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No revenue data for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Revenue Breakdown */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Client Revenue</CardTitle>
            <CardDescription>Top clients by paid revenue</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {clientBreakdown.length > 0 ? (
              <>
                <ChartContainer
                  config={{ value: { label: "Revenue" } }}
                  className="mx-auto aspect-square min-h-[200px] max-h-[250px]"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value: number | string) =>
                            `Rp ${Number(value).toLocaleString("id-ID")}`
                          }
                        />
                      }
                    />
                    <Pie
                      data={clientBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      strokeWidth={3}
                      paddingAngle={3}
                    >
                      {clientBreakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-lg font-bold"
                                >
                                  {clientBreakdown.length}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 18}
                                  className="fill-muted-foreground text-[10px]"
                                >
                                  Clients
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-1">
                  {clientBreakdown.map((client, i) => (
                    <div
                      key={client.name}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="text-muted-foreground truncate max-w-[100px]">
                        {client.name}
                      </span>
                      <span className="font-medium tabular-nums">
                        {((client.value / totalClientRevenue) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No client data for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Invoice Aging ────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Aging</CardTitle>
          <CardDescription>
            Outstanding invoices by days past due date
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agingData.some((d) => d.count > 0) ? (
            <ChartContainer
              config={agingConfig}
              className="mx-auto w-full min-h-[180px] max-h-[260px]"
            >
              <BarChart
                data={agingData}
                margin={{ top: 16, right: 8, bottom: 0, left: 8 }}
                barCategoryGap="25%"
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={30}
                  allowDecimals={false}
                  fontSize={12}
                />
                <ChartTooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                  shape={(props: any) => {
                    const { payload } = props;
                    const color =
                      agingConfig[payload.bucket as keyof typeof agingConfig]
                        ?.color || "var(--chart-1)";
                    return <Rectangle {...props} fill={color} />;
                  }}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
              🎉 No outstanding invoices — all paid!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

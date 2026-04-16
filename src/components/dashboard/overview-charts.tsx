"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Label,
  Rectangle
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
import { formatAxisCurrency, formatMoney } from "@/lib/currency";

type ChartData = {
  revenueData: { name: string; total: number; currency: string }[];
  statusData: { name: string; value: number }[];
};

/**
 * Build dynamic chart config from revenue data.
 * Each bar name (e.g. "Paid IDR", "Pending USD") gets its own color.
 */
function buildRevenueConfig(revenueData: ChartData["revenueData"]): ChartConfig {
  const config: ChartConfig = {
    total: { label: "Revenue" },
  };

  // Color palette: paid = emerald, pending = amber, cycle for multiple currencies
  const paidColors = [
    "oklch(0.6 0.118 184.704)",   // emerald
    "oklch(0.55 0.14 250)",        // blue
    "oklch(0.55 0.15 300)",        // purple
  ];
  const pendingColors = [
    "oklch(0.828 0.189 84.429)",   // amber
    "oklch(0.75 0.15 60)",         // orange
    "oklch(0.75 0.12 340)",        // pink
  ];

  let paidIdx = 0;
  let pendingIdx = 0;

  for (const item of revenueData) {
    if (item.name.startsWith("Paid")) {
      config[item.name] = {
        label: item.name,
        color: paidColors[paidIdx % paidColors.length],
      };
      paidIdx++;
    } else if (item.name.startsWith("Pending")) {
      config[item.name] = {
        label: item.name,
        color: pendingColors[pendingIdx % pendingColors.length],
      };
      pendingIdx++;
    }
  }

  return config as ChartConfig;
}

const STATUS_COLORS: Record<string, string> = {
  "TO DO": "var(--chart-1)",
  "IN PROGRESS": "var(--chart-2)",
  "REVIEW": "var(--chart-5)",
  "DONE": "var(--chart-3)",
};

const statusConfig = {
  value: {
    label: "Projects",
  },
  "TO DO": {
    label: "To Do",
    color: "var(--chart-1)",
  },
  "IN PROGRESS": {
    label: "In Progress",
    color: "var(--chart-2)",
  },
  "REVIEW": {
    label: "Review",
    color: "var(--chart-5)",
  },
  "DONE": {
    label: "Done",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function OverviewCharts({ data }: { data: ChartData }) {
  const totalProjects = data.statusData
    .filter((s) => s.name !== "No Projects")
    .reduce((sum, s) => sum + s.value, 0);

  const revenueConfig = buildRevenueConfig(data.revenueData);

  // Determine primary currency for Y-axis formatting (first item's currency)
  const primaryCurrency = data.revenueData[0]?.currency || "IDR";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ────────── Revenue Bar Chart ────────── */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>
            Total revenue by currency — paid and pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-6">
          <ChartContainer
            config={revenueConfig}
            className="mx-auto w-full min-h-[200px] max-h-[320px]"
          >
            <BarChart
              data={data.revenueData}
              margin={{ top: 16, right: 8, bottom: 0, left: 8 }}
              barCategoryGap="30%"
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  // "Paid IDR" → "Paid", "Pending USD" → "Pending USD"
                  const cfg = revenueConfig[value as keyof typeof revenueConfig];
                  return (cfg && "label" in cfg ? cfg.label : value) as string;
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={60}
                tickFormatter={(v) => formatAxisCurrency(v, primaryCurrency)}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value: number | string, _name: string, entry: any) => {
                      const num = Number(value);
                      // Extract currency from the bar name: "Paid IDR" → "IDR"
                      const barName: string = entry?.payload?.name || "";
                      const parts = barName.split(" ");
                      const currency = parts.length > 1 ? parts[parts.length - 1] : primaryCurrency;
                      return formatMoney(num, currency);
                    }}
                  />
                }
              />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                shape={(props: any) => {
                  const { payload } = props;
                  const config = revenueConfig[payload.name as keyof typeof revenueConfig];
                  const fill = (config as any)?.color || "var(--chart-1)";
                  return <Rectangle {...props} fill={fill} />;
                }}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ────────── Project Status Donut ────────── */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Project Status Distribution</CardTitle>
          <CardDescription>Current state of active projects.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-4">
          <ChartContainer
            config={statusConfig}
            className="mx-auto aspect-square min-h-[200px] max-h-[280px]"
          >
            <PieChart>
              {totalProjects > 0 && (
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
              )}
              <Pie
                data={data.statusData.map((entry) => ({
                  ...entry,
                  fill:
                    entry.name === "No Projects"
                      ? "hsl(var(--muted))"
                      : STATUS_COLORS[entry.name] || "var(--chart-1)",
                }))}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={100}
                strokeWidth={3}
                paddingAngle={3}
              >
                {/* Center label: total project count */}
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
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalProjects}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            Total Projects
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          {/* Custom vertical legend below */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
            {data.statusData
              .filter((entry) => entry.name !== "No Projects")
              .map((entry) => {
                const cfg = statusConfig[entry.name as keyof typeof statusConfig];
                const label = cfg && "label" in cfg ? cfg.label : entry.name;
                const color = STATUS_COLORS[entry.name] || "var(--chart-1)";
                return (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-muted-foreground">{label as string}</span>
                    <span className="font-medium tabular-nums">{entry.value}</span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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

type ChartData = {
  revenueData: { name: string; total: number }[];
  statusData: { name: string; value: number }[];
};

// 🎯 Color consistency: Paid = emerald, Pending = amber (matches cards above)
const revenueConfig = {
  total: {
    label: "Revenue",
  },
  "Paid IDR": {
    label: "Paid",
    color: "oklch(0.6 0.118 184.704)",
  },
  "Pending IDR": {
    label: "Pending",
    color: "oklch(0.828 0.189 84.429)",
  },
} satisfies ChartConfig;

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

/**
 * Format angka IDR agar ringkas:
 * >= 1 Miliar  => "1,2 M"
 * >= 1 Juta    => "10 Jt"
 * >= 1 Ribu    => "100 Rb"
 * di bawahnya  => angka biasa
 */
function formatAxisIDR(value: number): string {
  if (value >= 1_000_000_000) {
    const v = value / 1_000_000_000;
    return `${v % 1 === 0 ? v : v.toFixed(1)} M`;
  }
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `${v % 1 === 0 ? v : v.toFixed(1)} Jt`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return `${v % 1 === 0 ? v : v.toFixed(1)} Rb`;
  }
  return value.toLocaleString("id-ID");
}

export function OverviewCharts({ data }: { data: ChartData }) {
  const totalProjects = data.statusData
    .filter((s) => s.name !== "No Projects")
    .reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ────────── Revenue Bar Chart ────────── */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>
            Total revenue filtered by currency basis.
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
                  const cfg = revenueConfig[value as keyof typeof revenueConfig];
                  return (cfg && "label" in cfg ? cfg.label : value) as string;
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={60}
                tickFormatter={formatAxisIDR}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value: number | string) => {
                      const num = Number(value);
                      return `Rp ${num.toLocaleString("id-ID")}`;
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

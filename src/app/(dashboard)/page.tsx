import { prisma } from "@/lib/prisma";
import { getProactiveInsights } from "@/lib/ai/agent";
import { auth } from "@/auth";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Wallet, Clock } from "lucide-react";
import { formatEnum } from "@/lib/utils";
import { formatMoney, getCurrency } from "@/lib/currency";

export const dynamic = "force-dynamic";

type CurrencyRevenue = {
  currency: string;
  symbol: string;
  paid: number;
  pending: number;
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";

  // Sequential queries (Prisma pg@9 — no Promise.all)
  const projectsRaw = await prisma.project.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  const unpaidInvoices = await prisma.invoice.count({
    where: { status: "UNPAID" },
  });

  const totalClients = await prisma.client.count();

  // Fetch all invoices with project currency for multi-currency aggregation
  const allInvoices = await prisma.invoice.findMany({
    select: {
      amount: true,
      status: true,
      project: { select: { currency: true } },
    },
  });

  // Aggregate revenue by currency
  const revenueByCurrency = new Map<string, { paid: number; pending: number }>();
  for (const inv of allInvoices) {
    const curr = inv.project.currency || "IDR";
    const entry = revenueByCurrency.get(curr) ?? { paid: 0, pending: 0 };
    const amt = Number(inv.amount);
    if (inv.status === "PAID") entry.paid += amt;
    else if (inv.status === "UNPAID") entry.pending += amt;
    revenueByCurrency.set(curr, entry);
  }

  // Build typed array for rendering
  const currencyRevenues: CurrencyRevenue[] = Array.from(revenueByCurrency.entries())
    .map(([currency, data]) => ({
      currency,
      symbol: getCurrency(currency).symbol,
      paid: data.paid,
      pending: data.pending,
    }))
    .sort((a, b) => b.paid - a.paid); // primary currency first

  // For charts: flatten to { name, total, currency }
  const chartRevenueData = currencyRevenues.flatMap((cr) => {
    const items: { name: string; total: number; currency: string }[] = [];
    if (cr.paid > 0) items.push({ name: `Paid ${cr.currency}`, total: cr.paid, currency: cr.currency });
    if (cr.pending > 0) items.push({ name: `Pending ${cr.currency}`, total: cr.pending, currency: cr.currency });
    return items;
  });

  const revenueData = chartRevenueData.length > 0
    ? chartRevenueData
    : [{ name: "No Data", total: 0, currency: "IDR" }];

  // Project status distribution (unchanged)
  const statuses = ["TO_DO", "IN_PROGRESS", "REVIEW", "DONE"];
  let statusCounts = statuses.map((s) => ({
    name: formatEnum(s).toUpperCase(),
    value: projectsRaw.filter((p) => p.status === s).length,
  }));

  if (statusCounts.every((s) => s.value === 0)) {
    statusCounts = [{ name: "No Projects", value: 1 }];
  } else {
    statusCounts = statusCounts.filter((s) => s.value > 0);
  }

  // Fetch proactive AI insights
  const insights = userId ? await getProactiveInsights(userId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of active projects tracking.
          </p>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <AIInsightCard key={insight.type} insight={insight as any} />
          ))}
        </div>
      )}

      {/* Revenue cards — dynamic per currency */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {currencyRevenues.map((cr) => (
          <Card key={`paid-${cr.currency}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue ({cr.currency})
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1 pb-5">
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(cr.paid, cr.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                From Paid Invoices
              </p>
            </CardContent>
          </Card>
        ))}

        {currencyRevenues.map((cr) => (
          <Card key={`pending-${cr.currency}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Revenue ({cr.currency})
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1 pb-5">
              <div className="text-2xl font-bold text-amber-500">
                {formatMoney(cr.pending, cr.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                From Awaiting Payment Invoices
              </p>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1 pb-5">
            <div className="text-2xl font-bold">{totalClients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Awaiting Payment Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1 pb-5">
            <div className="text-2xl font-bold">{unpaidInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <OverviewCharts data={{ revenueData, statusData: statusCounts }} />
    </div>
  );
}

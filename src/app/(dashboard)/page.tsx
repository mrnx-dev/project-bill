import { prisma } from "@/lib/prisma";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Wallet, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projectsRaw, unpaidInvoices, totalClients, paidInvoicesIDR, unpaidInvoicesIDR] =
    await Promise.all([
      prisma.project.findMany({
        include: { client: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({
        where: { status: "unpaid" },
      }),
      prisma.client.count(),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: "paid", project: { currency: "IDR" } }
      }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: "unpaid", project: { currency: "IDR" } }
      })
    ]);

  const totalRevenueIDR = Number(paidInvoicesIDR._sum?.amount || 0);
  const pendingRevenueIDR = Number(unpaidInvoicesIDR._sum?.amount || 0);

  const formatCurrency = (amount: number, currencyStr: string) => {
    return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currencyStr,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Recharts fails to render (complains about negative width/height) if data array is completely empty.
  // We ensure there's at least one empty datum if they are all filtered out.
  let revenueData = [
    { name: "Paid IDR", total: totalRevenueIDR },
    { name: "Pending IDR", total: pendingRevenueIDR },
  ];
  if (revenueData.every(d => d.total === 0)) {
    revenueData = [{ name: "No Data", total: 0 }];
  } else {
    revenueData = revenueData.filter((d) => d.total > 0);
  }

  const statuses = ["to_do", "in_progress", "review", "done"];
  let statusCounts = statuses
    .map((s) => {
      return {
        name: s.replace("_", " ").toUpperCase(),
        value: projectsRaw.filter((p) => p.status === s).length,
      };
    });
  
  if (statusCounts.every(s => s.value === 0)) {
    statusCounts = [{ name: "No Projects", value: 1 }]; // Value 1 ensures pie chart renders a grey circle
  } else {
    statusCounts = statusCounts.filter((s) => s.value > 0);
  }

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue (IDR)
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1 pb-5">
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalRevenueIDR, "IDR")}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              From Paid Invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Revenue (IDR)
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1 pb-5">
            <div className="text-2xl font-bold text-amber-500">
              {formatCurrency(pendingRevenueIDR, "IDR")}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              From Awaiting Payment Invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Clients
            </CardTitle>
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

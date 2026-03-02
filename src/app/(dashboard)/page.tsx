import { prisma } from "@/lib/prisma"
import { OverviewCharts } from "@/components/dashboard/overview-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Briefcase, FileText } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [projectsRaw, unpaidInvoices, invoicesRaw, totalClients] = await Promise.all([
    prisma.project.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoice.count({
      where: { status: 'unpaid' }
    }),
    prisma.invoice.findMany({
      include: { project: true }
    }),
    prisma.client.count()
  ])

  // Serializing and calculating actual revenue from invoices
  let totalRevenueIDR = 0;
  let totalRevenueUSD = 0;
  let pendingRevenueIDR = 0;
  let pendingRevenueUSD = 0;

  invoicesRaw.forEach(inv => {
    const amount = Number(inv.amount);
    const isIDR = !inv.project.currency || inv.project.currency === 'IDR';

    if (inv.status === 'paid') {
      if (isIDR) totalRevenueIDR += amount;
      else totalRevenueUSD += amount;
    } else {
      if (isIDR) pendingRevenueIDR += amount;
      else pendingRevenueUSD += amount;
    }
  });

  // Serialize records
  const projects = projectsRaw.map(p => ({
    ...p,
    totalPrice: p.totalPrice.toString(),
    dpAmount: p.dpAmount?.toString() || null,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    client: {
      ...p.client,
      createdAt: p.client.createdAt.toISOString(),
      updatedAt: p.client.updatedAt.toISOString()
    }
  }))

  const formatCurrency = (amount: number, currencyStr: string) => {
    return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currencyStr,
      minimumFractionDigits: 0
    }).format(amount)
  }

  const revenueData = [
    { name: 'Paid IDR', total: totalRevenueIDR },
    { name: 'Pending IDR', total: pendingRevenueIDR },
    // Temporarily disabled USD metrics for V1.1
    // { name: 'Paid USD', total: totalRevenueUSD },
    // { name: 'Pending USD', total: pendingRevenueUSD }
  ].filter(d => d.total > 0) // Only show bars that have values

  const statuses = ['to_do', 'in_progress', 'review', 'done']
  const statusCounts = statuses.map(s => {
    return {
      name: s.replace('_', ' ').toUpperCase(),
      value: projectsRaw.filter(p => p.status === s).length
    }
  }).filter(s => s.value > 0) // Only show statuses that have projects

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of active projects tracking.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (IDR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenueIDR, "IDR")}</div>
            <p className="text-xs text-muted-foreground mt-1">From Paid Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Revenue (IDR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{formatCurrency(pendingRevenueIDR, "IDR")}</div>
            <p className="text-xs text-muted-foreground mt-1">From Unpaid Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unpaidInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <OverviewCharts data={{ revenueData, statusData: statusCounts }} />
    </div>
  )
}
